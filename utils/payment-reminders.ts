import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, dateInTimeZone } from '@/utils/dates'

export type ReminderType = 'Before due' | 'Due today' | 'After due'
export type ReminderStatus = 'Scheduled' | 'Sent' | 'Failed' | 'Skipped'

// Resend's free plan allows 100 emails a day. Stay under it.
export const DAILY_EMAIL_LIMIT = 90
const DELAY_BETWEEN_EMAILS_MS = 600
const STUCK_AFTER_MINUTES = 60

// Days from the due date (negative = before). Each reminder may still go out a few
// days late in case the daily job missed a day. The windows never overlap.
export const REMINDER_WINDOWS: { type: ReminderType; dueOffset: number; lastDay: number }[] = [
  { type: 'Before due', dueOffset: -3, lastDay: -1 },
  { type: 'Due today', dueOffset: 0, lastDay: 2 },
  { type: 'After due', dueOffset: 3, lastDay: 6 },
]

type Admin = ReturnType<typeof createAdminClient>

type PaymentWithStudent = {
  id: number
  amount: number | string
  due_date: string
  status: string
  student: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    guardian_name: string | null
    guardian_email: string | null
    is_active: boolean
  } | null
}

// payment has only one link to student, so no foreign key hint is needed.
const PAYMENT_SELECT = 'id, amount, due_date, status, student:student(first_name, middle_name, last_name, guardian_name, guardian_email, is_active)'

type ResendConfig = { apiKey: string; from: string; replyTo?: string }

type ClaimedReminder = {
  id: number
  payment_id: number
  reminder_type: ReminderType
  recipient_email: string
  attempt_count: number
}

export type PaymentReminderRunResult = {
  sent: number
  failed: number
  skipped: number
  noGuardianEmail: number
  limitReached: boolean
  error?: string
}

export type RetryReminderResult = { status: ReminderStatus } | { error: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const nowIso = () => new Date().toISOString()

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Which reminder (if any) is due today for a payment with this due date. */
export function reminderWindowFor(dueDate: string, today = dateInTimeZone()) {
  const daysAfterDue = daysBetween(dueDate, today)
  return REMINDER_WINDOWS.find((window) => daysAfterDue >= window.dueOffset && daysAfterDue <= window.lastDay) ?? null
}

const guardianEmail = (payment: PaymentWithStudent) => payment.student?.guardian_email?.trim() ?? ''

const studentName = (payment: PaymentWithStudent) =>
  [payment.student?.first_name, payment.student?.middle_name, payment.student?.last_name].filter(Boolean).join(' ') || 'your student'

export const formatAmount = (amount: number | string) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount))

const formatDueDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

type EmailTone = 'soon' | 'urgent'

const LABEL_COLORS: Record<EmailTone, { color: string; background: string }> = {
  soon: { color: '#92400e', background: '#fef3c7' },
  urgent: { color: '#b91c1c', background: '#fee2e2' },
}

// Wording is based on the real number of days on the send date, so a reminder
// sent late (catch-up days) still says the right thing.
function emailWording(daysUntilDue: number, student: string, amount: string, dueDate: string) {
  if (daysUntilDue > 1) {
    return {
      label: `Due in ${daysUntilDue} days`,
      tone: 'soon' as EmailTone,
      subject: `Payment reminder: ${amount} due on ${dueDate}`,
      message: `This is a friendly reminder that ${student}'s payment of ${amount} is due on ${dueDate}, in ${daysUntilDue} days.`,
    }
  }
  if (daysUntilDue === 1) {
    return {
      label: 'Due tomorrow',
      tone: 'soon' as EmailTone,
      subject: `Payment due tomorrow: ${amount}`,
      message: `This is a friendly reminder that ${student}'s payment of ${amount} is due tomorrow, ${dueDate}.`,
    }
  }
  if (daysUntilDue === 0) {
    return {
      label: 'Due today',
      tone: 'urgent' as EmailTone,
      subject: `Payment due today: ${amount}`,
      message: `${student}'s payment of ${amount} is due today, ${dueDate}.`,
    }
  }
  const daysLate = -daysUntilDue
  return {
    label: 'Overdue',
    tone: 'urgent' as EmailTone,
    subject: `Overdue payment: ${amount} was due on ${dueDate}`,
    message: `${student}'s payment of ${amount} was due on ${dueDate}, ${daysLate} day${daysLate === 1 ? '' : 's'} ago, and is still unpaid.`,
  }
}

const detailRow = (label: string, value: string, isLast = false) =>
  `<tr>
    <td style="padding:10px 16px;font-size:13px;color:#6b7280;width:110px;${isLast ? '' : 'border-bottom:1px solid #e5e7eb;'}">${label}</td>
    <td style="padding:10px 16px;font-size:14px;font-weight:bold;color:#111827;${isLast ? '' : 'border-bottom:1px solid #e5e7eb;'}">${value}</td>
  </tr>`

function buildEmailHtml(
  daysUntilDue: number,
  values: { guardian: string | undefined; student: string; amount: string; dueDate: string },
) {
  // Every value from the database is escaped before it goes into the HTML.
  const guardian = values.guardian ? escapeHtml(values.guardian) : ''
  const student = escapeHtml(values.student)
  const amount = escapeHtml(values.amount)
  const dueDate = escapeHtml(values.dueDate)
  const wording = emailWording(daysUntilDue, student, amount, dueDate)
  const colors = LABEL_COLORS[wording.tone]

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111827;">
          <tr>
            <td style="background-color:#000000;padding:18px 28px;color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:2px;">RISING DRAGON TAEKWONDO</td>
          </tr>
          <tr>
            <td style="background-color:#dc2626;height:3px;line-height:3px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${colors.background};color:${colors.color};font-size:12px;font-weight:bold;">${wording.label}</span>
              <p style="margin:20px 0 8px;font-size:16px;">${guardian ? `Hi ${guardian},` : 'Hello,'}</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${wording.message}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                ${detailRow('Student', student)}
                ${detailRow('Amount', amount)}
                ${detailRow('Due date', dueDate, true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-size:14px;line-height:1.6;color:#374151;">
              <p style="margin:0 0 8px;">Already paid? Please ignore this email.</p>
              <p style="margin:0;">Questions? Reply to this email or talk to your coach.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding:16px 28px;font-size:12px;color:#9ca3af;">This is an automatic reminder from Rising Dragon Taekwondo.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildEmail(payment: PaymentWithStudent, today: string) {
  const student = studentName(payment)
  const amount = formatAmount(payment.amount)
  const dueDate = formatDueDate(payment.due_date)
  const guardian = payment.student?.guardian_name?.trim()
  const daysUntilDue = daysBetween(today, payment.due_date)
  const wording = emailWording(daysUntilDue, student, amount, dueDate)
  const text = [
    guardian ? `Hi ${guardian},` : 'Hello,',
    '',
    wording.message,
    'If you have already paid, please ignore this email.',
    '',
    'Thank you,',
    'Rising Dragon Taekwondo',
  ].join('\n')
  const html = buildEmailHtml(daysUntilDue, { guardian, student, amount, dueDate })
  return { subject: wording.subject, text, html }
}

function resendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.REMINDER_FROM_EMAIL
  // Optional: where guardians' replies go. Unset = Resend's default (the From address).
  const replyTo = process.env.REMINDER_REPLY_TO?.trim() || undefined
  return apiKey && from ? { apiKey, from, replyTo } : null
}

async function sendWithResend(
  config: ResendConfig,
  to: string,
  email: { subject: string; text: string; html: string },
  idempotencyKey: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!response.ok || !body?.id) return { error: body?.message ?? `Resend returned status ${response.status}.` }
    return { id: body.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not reach Resend.' }
  }
}

/** Sent + Failed attempts since midnight in Manila (UTC+8, no daylight saving). */
export async function countEmailAttemptsToday(admin: Admin, today = dateInTimeZone()) {
  const startOfDay = new Date(`${today}T00:00:00+08:00`).toISOString()
  const { count, error } = await admin.from('payment_reminder')
    .select('id', { count: 'exact', head: true })
    .in('status', ['Sent', 'Failed'])
    .gte('last_attempt_at', startOfDay)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Send one Scheduled reminder and save the result. Never emails a paid payment. */
async function deliverReminder(admin: Admin, config: ResendConfig, reminder: ClaimedReminder): Promise<ReminderStatus> {
  // completed_at is always set when an attempt finishes; sent_at only when it was Sent.
  const finish = async (status: Exclude<ReminderStatus, 'Scheduled'>, extra: { error_message?: string; provider_message_id?: string } = {}) => {
    const at = nowIso()
    const { error } = await admin.from('payment_reminder')
      .update({ status, completed_at: at, sent_at: status === 'Sent' ? at : null, error_message: null, provider_message_id: null, ...extra })
      .eq('id', reminder.id)
      .eq('status', 'Scheduled')
    if (error) throw new Error(error.message)
    return status
  }

  // Check again right before sending: the guardian may have paid in the meantime.
  const { data, error } = await admin.from('payment').select(PAYMENT_SELECT).eq('id', reminder.payment_id).maybeSingle()
  if (error) return finish('Failed', { error_message: `Could not check the payment: ${error.message}`.slice(0, 500) })
  const payment = data as unknown as PaymentWithStudent | null
  if (!payment) return finish('Skipped', { error_message: 'Payment not found.' })
  if (payment.status !== 'Unpaid') return finish('Skipped', { error_message: 'Payment is already paid.' })

  const result = await sendWithResend(
    config,
    reminder.recipient_email,
    buildEmail(payment, dateInTimeZone()),
    `payment-reminder-${reminder.id}-attempt-${reminder.attempt_count}`,
  )
  if ('error' in result) return finish('Failed', { error_message: result.error.slice(0, 500) })
  return finish('Sent', { provider_message_id: result.id })
}

/** Daily job: create and send the reminders that are due today. */
export async function runPaymentReminders(): Promise<PaymentReminderRunResult> {
  const result: PaymentReminderRunResult = { sent: 0, failed: 0, skipped: 0, noGuardianEmail: 0, limitReached: false }
  const config = resendConfig()
  if (!config) return { ...result, error: 'Set RESEND_API_KEY and REMINDER_FROM_EMAIL in the server environment.' }

  const today = dateInTimeZone()
  const admin = createAdminClient()

  try {
    // A row still Scheduled after an hour means an earlier send was interrupted
    // (for example, the server stopped). Mark it Failed so the Head Coach can retry it.
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString()
    const { error: stuckError } = await admin.from('payment_reminder')
      .update({
        status: 'Failed',
        completed_at: nowIso(),
        sent_at: null,
        error_message: 'Sending was interrupted. Press Retry to send it again.',
      })
      .eq('status', 'Scheduled')
      .lt('last_attempt_at', stuckBefore)
    if (stuckError) return { ...result, error: stuckError.message }

    let attemptsToday = await countEmailAttemptsToday(admin, today)
    const { data, error } = await admin.from('payment').select(PAYMENT_SELECT)
      .eq('status', 'Unpaid')
      .gte('due_date', addDays(today, -Math.max(...REMINDER_WINDOWS.map((window) => window.lastDay))))
      .lte('due_date', addDays(today, -Math.min(...REMINDER_WINDOWS.map((window) => window.dueOffset))))
      .order('due_date')
      .order('id')
    if (error) return { ...result, error: error.message }

    let isFirstEmail = true
    for (const payment of (data ?? []) as unknown as PaymentWithStudent[]) {
      const window = reminderWindowFor(payment.due_date, today)
      if (!window) continue

      // recipient_email can never be blank, so these payments get no reminder row.
      const recipient = guardianEmail(payment)
      if (!recipient) {
        result.noGuardianEmail += 1
        continue
      }
      if (attemptsToday >= DAILY_EMAIL_LIMIT) {
        result.limitReached = true
        break
      }

      const inactive = !payment.student?.is_active
      const row = {
        payment_id: payment.id,
        recipient_email: recipient,
        reminder_type: window.type,
        scheduled_for: addDays(payment.due_date, window.dueOffset),
        sent_by: null,
        last_attempt_at: nowIso(),
        ...(inactive
          ? { status: 'Skipped', attempt_count: 0, completed_at: nowIso(), error_message: 'Student is inactive.' }
          : { status: 'Scheduled', attempt_count: 1 }),
      }
      const { data: inserted, error: insertError } = await admin.from('payment_reminder').insert(row).select('id').single()
      if (insertError) {
        // An earlier run already created this reminder (unique payment_id + reminder_type).
        if (insertError.code === '23505') continue
        return { ...result, error: insertError.message }
      }
      if (inactive) {
        result.skipped += 1
        continue
      }

      if (!isFirstEmail) await sleep(DELAY_BETWEEN_EMAILS_MS)
      isFirstEmail = false
      const status = await deliverReminder(admin, config, {
        id: Number(inserted.id),
        payment_id: payment.id,
        reminder_type: window.type,
        recipient_email: recipient,
        attempt_count: 1,
      })
      if (status === 'Sent') result.sent += 1
      else if (status === 'Failed') result.failed += 1
      else result.skipped += 1
      if (status === 'Sent' || status === 'Failed') attemptsToday += 1
    }
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : 'Could not send payment reminders.' }
  }

  return result
}

/** Head Coach "Retry": move a Failed reminder back to Scheduled and send it again. */
export async function retryPaymentReminder(reminderId: number, userId: number): Promise<RetryReminderResult> {
  const config = resendConfig()
  if (!config) return { error: 'Email sending is not set up. Add RESEND_API_KEY and REMINDER_FROM_EMAIL.' }

  const admin = createAdminClient()
  try {
    const { data: reminder, error } = await admin.from('payment_reminder')
      .select('id, payment_id, reminder_type, status, attempt_count')
      .eq('id', reminderId)
      .maybeSingle()
    if (error || !reminder) return { error: 'Reminder not found.' }
    if (reminder.status !== 'Failed') return { error: 'Only failed reminders can be retried. Refresh the page.' }

    const { data: paymentData, error: paymentError } = await admin.from('payment').select(PAYMENT_SELECT)
      .eq('id', reminder.payment_id)
      .maybeSingle()
    if (paymentError || !paymentData) return { error: 'Payment not found.' }
    const payment = paymentData as unknown as PaymentWithStudent

    // Close the failed row so it no longer shows a Retry button.
    const closeAsSkipped = async (reason: string): Promise<RetryReminderResult> => {
      const { error: skipError } = await admin.from('payment_reminder')
        .update({ status: 'Skipped', completed_at: nowIso(), sent_at: null, error_message: reason })
        .eq('id', reminderId)
        .eq('status', 'Failed')
      if (skipError) return { error: skipError.message }
      return { status: 'Skipped' }
    }
    if (payment.status !== 'Unpaid') return closeAsSkipped('Payment is already paid.')
    if (!payment.student?.is_active) return closeAsSkipped('Student is inactive.')

    const recipient = guardianEmail(payment)
    if (!recipient) return { error: 'No guardian email. Add one on the Students page first.' }
    if (await countEmailAttemptsToday(admin) >= DAILY_EMAIL_LIMIT) {
      return { error: `The daily limit of ${DAILY_EMAIL_LIMIT} emails was reached. Try again tomorrow.` }
    }

    // Only one retry can win this update, so two clicks never send two emails.
    const attempt = Number(reminder.attempt_count) + 1
    const { data: claimed, error: claimError } = await admin.from('payment_reminder')
      .update({
        status: 'Scheduled',
        completed_at: null,
        sent_at: null,
        error_message: null,
        provider_message_id: null,
        recipient_email: recipient,
        sent_by: userId,
        attempt_count: attempt,
        last_attempt_at: nowIso(),
      })
      .eq('id', reminderId)
      .eq('status', 'Failed')
      .eq('attempt_count', reminder.attempt_count)
      .select('id')
    if (claimError) return { error: claimError.message }
    if (!claimed?.length) return { error: 'This reminder is already being retried. Refresh the page.' }

    const status = await deliverReminder(admin, config, {
      id: reminderId,
      payment_id: payment.id,
      reminder_type: reminder.reminder_type as ReminderType,
      recipient_email: recipient,
      attempt_count: attempt,
    })
    return { status }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not retry the reminder.' }
  }
}
