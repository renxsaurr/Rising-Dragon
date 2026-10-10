import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { REMINDER_TYPES, type ReminderStatus, type ReminderType } from '@/utils/payment-reminders'

type Admin = ReturnType<typeof createAdminClient>

const HISTORY_FETCH_BATCH_SIZE = 1000
export const HISTORY_STATUSES: ReminderStatus[] = ['Sent', 'Failed', 'Skipped', 'Scheduled']
const MAX_SEARCH_LENGTH = 60
const MAX_SEARCH_WORDS = 3

export type HistoryFilters = {
  q: string
  status: ReminderStatus | 'all'
  type: ReminderType | 'all'
  /** 'all' or a branch id. */
  branch: string
}

export type RawHistoryParams = {
  hq?: string
  hstatus?: string
  htype?: string
  hbranch?: string
  hpage?: string
}

export type HistoryRow = {
  id: number
  reminderType: ReminderType
  status: ReminderStatus
  recipientEmail: string
  attemptCount: number
  createdAt: string
  sentAt: string | null
  completedAt: string | null
  lastAttemptAt: string | null
  scheduledFor: string | null
  errorMessage: string | null
  /** null = sent by the old daily job, before Gmail sending. */
  sentByName: string | null
  amount: number | null
  dueDate: string | null
  studentName: string
  branchName: string
}

export type ReminderHistory = {
  filters: HistoryFilters
  rows: HistoryRow[]
  total: number
  /** Respects the branch filter only. */
  summary: { sent: number; failed: number; skipped: number }
  branches: { id: number; name: string }[]
}

type RawHistoryStudent = {
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  branch_id: number | null
}

type RawHistoryPayment = {
  amount: number | string
  due_date: string
  student: RawHistoryStudent | RawHistoryStudent[] | null
}

type RawHistoryRow = {
  id: number
  reminder_type: ReminderType
  status: ReminderStatus
  recipient_email: string
  attempt_count: number | null
  created_at: string
  sent_at: string | null
  completed_at: string | null
  last_attempt_at: string | null
  scheduled_for: string | null
  error_message: string | null
  sent_by: number | null
  payment: RawHistoryPayment | RawHistoryPayment[] | null
}

const HISTORY_COLUMNS =
  'id, reminder_type, status, recipient_email, attempt_count, created_at, sent_at, completed_at, last_attempt_at, scheduled_for, error_message, sent_by'

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null))

/** Turn the h* URL params into safe filters. Anything invalid falls back to the default. */
function parseFilters(raw: RawHistoryParams, branchIds: Set<string>): HistoryFilters {
  return {
    q: (raw.hq ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    status: HISTORY_STATUSES.find((status) => status === raw.hstatus) ?? 'all',
    type: REMINDER_TYPES.find((type) => type === raw.htype) ?? 'all',
    branch: raw.hbranch && branchIds.has(raw.hbranch) ? raw.hbranch : 'all',
  }
}

/**
 * Words for the name search. Only letters, digits, ' and - are kept, so characters
 * that mean something in PostgREST filters ( , . ( ) : * % ) can't change the query.
 */
function searchWords(q: string) {
  return q
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(Boolean)
    .slice(0, MAX_SEARCH_WORDS)
}

// !inner turns the embeds into filters: only reminders whose student matches are returned and counted.
const paymentEmbed = (inner: boolean) => {
  const join = inner ? '!inner' : ''
  return `payment:payment${join}(amount, due_date, student:student${join}(first_name, middle_name, last_name, branch_id))`
}

function historyQuery(admin: Admin, filters: HistoryFilters, head = false) {
  const words = searchWords(filters.q)
  const inner = words.length > 0 || filters.branch !== 'all'
  let query = admin
    .from('payment_reminder')
    .select(`${HISTORY_COLUMNS}, ${paymentEmbed(inner)}`, { count: 'exact', head })
  if (filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.type !== 'all') query = query.eq('reminder_type', filters.type)
  if (filters.branch !== 'all') query = query.eq('payment.student.branch_id', Number(filters.branch))
  // One condition per word, all required: "juan cruz" finds "Juan Dela Cruz".
  for (const word of words) {
    const pattern = `%${word}%`
    query = query.or(
      `first_name.ilike.${pattern},middle_name.ilike.${pattern},last_name.ilike.${pattern}`,
      { referencedTable: 'payment.student' },
    )
  }
  return query
}

function statusCount(admin: Admin, status: ReminderStatus, branch: string) {
  const columns = branch === 'all' ? 'id' : 'id, payment!inner(student!inner(branch_id))'
  let query = admin.from('payment_reminder').select(columns, { count: 'exact', head: true }).eq('status', status)
  if (branch !== 'all') query = query.eq('payment.student.branch_id', Number(branch))
  return query
}

/** For the red banner on the main Payments view. */
export async function countFailedReminders(admin: Admin) {
  const { count, error } = await admin
    .from('payment_reminder')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'Failed')
  return error ? { count: 0, error: error.message } : { count: count ?? 0, error: null }
}

/** All filtered reminder history, newest first, with status counts. */
export async function loadReminderHistory(
  admin: Admin,
  raw: RawHistoryParams,
): Promise<{ data: ReminderHistory; error: null } | { data: null; error: string }> {
  try {
    const { data: branchData, error: branchError } = await admin.from('branch').select('id, name').order('name')
    if (branchError) throw new Error(branchError.message)
    const branches = ((branchData ?? []) as { id: number; name: string }[]).map((branch) => ({
      id: Number(branch.id),
      name: branch.name,
    }))
    const filters = parseFilters(raw, new Set(branches.map((branch) => String(branch.id))))
    // Search is applied to the loaded rows so it can match both student and branch names.
    const queryFilters = { ...filters, q: '' }

    const fetchBatch = (start: number) =>
      historyQuery(admin, queryFilters)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(start, start + HISTORY_FETCH_BATCH_SIZE - 1)

    const [firstBatch, sent, failed, skipped] = await Promise.all([
      fetchBatch(0),
      statusCount(admin, 'Sent', filters.branch),
      statusCount(admin, 'Failed', filters.branch),
      statusCount(admin, 'Skipped', filters.branch),
    ])
    if (firstBatch.error) throw new Error(firstBatch.error.message)
    for (const result of [sent, failed, skipped]) {
      if (result.error) throw new Error(result.error.message)
    }

    const total = firstBatch.count ?? firstBatch.data?.length ?? 0
    const batchStarts = Array.from(
      { length: Math.ceil(total / HISTORY_FETCH_BATCH_SIZE) - 1 },
      (_, index) => (index + 1) * HISTORY_FETCH_BATCH_SIZE,
    )
    const laterBatches = await Promise.all(batchStarts.map(fetchBatch))
    const batchError = laterBatches.find((batch) => batch.error)
    if (batchError?.error) throw new Error(batchError.error.message)
    const rawRows = [
      ...(firstBatch.data ?? []),
      ...laterBatches.flatMap((batch) => batch.data ?? []),
    ] as unknown as RawHistoryRow[]

    // sent_by is a user id. Resolve names for all loaded reminder records.
    const userIds = [...new Set(rawRows.map((row) => row.sent_by).filter((id): id is number => id != null).map(Number))]
    const userNames = new Map<number, string>()
    if (userIds.length) {
      const { data, error } = await admin.from('user').select('id, first_name, last_name').in('id', userIds)
      if (error) throw new Error(error.message)
      for (const user of (data ?? []) as { id: number; first_name: string | null; last_name: string | null }[]) {
        userNames.set(Number(user.id), [user.first_name, user.last_name].filter(Boolean).join(' '))
      }
    }

    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]))
    const rows = rawRows.map((row): HistoryRow => {
      const payment = one(row.payment)
      const student = one(payment?.student)
      const branchId = student?.branch_id == null ? null : Number(student.branch_id)
      return {
        id: Number(row.id),
        reminderType: row.reminder_type,
        status: row.status,
        recipientEmail: row.recipient_email,
        attemptCount: Number(row.attempt_count ?? 0),
        createdAt: row.created_at,
        sentAt: row.sent_at,
        completedAt: row.completed_at,
        lastAttemptAt: row.last_attempt_at,
        scheduledFor: row.scheduled_for,
        errorMessage: row.error_message,
        sentByName: row.sent_by == null ? null : (userNames.get(Number(row.sent_by)) || 'Unknown user'),
        amount: payment ? Number(payment.amount) : null,
        dueDate: payment?.due_date ?? null,
        studentName: student
          ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
          : 'Unknown student',
        branchName: (branchId !== null && branchNames.get(branchId)) || 'No branch',
      }
    })

    return {
      data: {
        filters,
        rows,
        total,
        summary: { sent: sent.count ?? 0, failed: failed.count ?? 0, skipped: skipped.count ?? 0 },
        branches,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Could not load reminder history.' }
  }
}
