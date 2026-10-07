import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

import { dateInTimeZone } from '@/utils/dates'
import { CONTACT_NUMBER, PAYMENT_DETAILS } from '@/utils/academy-settings'
import { isValidEmail, normalizeEmail } from '@/utils/email'
import { sendGmail } from '@/utils/gmail'
import { formatCoverage, type PaymentType } from '@/utils/payment-fees'
import { reminderWindowFor, type ReminderType, type ReminderWindow } from '@/utils/reminder-timing'

// Kept here too so existing imports from this file keep working.
export { reminderWindowFor, type ReminderType, type ReminderWindow } from '@/utils/reminder-timing'
export type ReminderStatus = 'Scheduled' | 'Sent' | 'Failed' | 'Skipped'

// Each type can be sent once per payment (UNIQUE payment_id + reminder_type), so at most 3.
export const REMINDER_TYPES: ReminderType[] = ['Before due', 'Due today', 'After due']

// A Gmail send times out within seconds, so a row still Scheduled after this was interrupted.
const STUCK_AFTER_MINUTES = 10

const NO_GUARDIAN_EMAIL = 'No guardian email. Add one on the Students page first.'
const INVALID_GUARDIAN_EMAIL = 'This guardian email looks invalid. Fix it on the Students page first.'
const ALREADY_SENDING = 'This reminder was already sent or is being sent. Refresh the page.'
type Admin = ReturnType<typeof createAdminClient>

type PaymentWithStudent = {
  id: number
  amount: number | string
  due_date: string
  status: string
  payment_type: PaymentType | null
  quantity: number | null
  coverage_start: string | null

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
const PAYMENT_SELECT = 'id, amount, due_date, status, payment_type, quantity, coverage_start, student:student(first_name, middle_name, last_name, guardian_name, guardian_email, is_active)'

type ExistingReminder = {
  id: number
  reminder_type: ReminderType
  status: ReminderStatus
  attempt_count: number
  sent_at: string | null
}

export type ReminderPreview = {
  studentName: string
  guardianName: string | null
  recipient: string
  amount: string
  dueDate: string
  reminderType: ReminderType
  subject: string
  html: string
  text: string
}

/** What the Head Coach saw in the review popup. Sending stops if it changed since. */
export type ReviewedReminder = { recipient: string; reminderType: ReminderType }

// closed = a failed reminder was closed as Skipped because no reminder is needed any more.
type Problem = { error: string; closed?: boolean }

export type ReminderPreviewResult = { preview: ReminderPreview } | Problem
export type SendReminderResult = { status: 'Sent'; reminderType: ReminderType; recipient: string } | Problem

const nowIso = () => new Date().toISOString()

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

// '2026-10-06' → "Oct 6, 2026"
const formatShortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

const opensLater = (timing: Extract<ReminderWindow, { open: false }>) =>
  `The "${timing.nextType}" reminder opens on ${formatShortDate(timing.opensOn)}.`

const guardianEmail = (payment: PaymentWithStudent) => normalizeEmail(payment.student?.guardian_email)

const studentName = (payment: PaymentWithStudent) =>
  [payment.student?.first_name, payment.student?.middle_name, payment.student?.last_name].filter(Boolean).join(' ') || 'your student'

export const formatAmount = (amount: number | string) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount))

const formatDueDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })

const formatSentDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const ACADEMY = 'Rising Dragon Taekwondo'

type EmailTone = 'soon' | 'urgent'

const LABEL_COLORS: Record<EmailTone, { color: string; background: string }> = {
  soon: { color: '#92400e', background: '#fef3c7' },
  urgent: { color: '#b91c1c', background: '#fee2e2' },
}

// The small colored label at the top of the email, from the real days until the due date.
function emailLabel(daysUntilDue: number): { label: string; tone: EmailTone } {
  if (daysUntilDue > 1) return { label: `Due in ${daysUntilDue} days`, tone: 'soon' }
  if (daysUntilDue === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (daysUntilDue === 0) return { label: 'Due today', tone: 'urgent' }
  return { label: 'Overdue', tone: 'urgent' }
}

// '2026-10-01' → "October 2026"
const formatLongMonth = (date: string) =>
  new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })

type FeeDetails = Pick<PaymentWithStudent, 'payment_type' | 'quantity' | 'coverage_start'>

// "October 2026" for one month, "Oct – Nov 2026" for several.
const monthsCovered = (coverageStart: string, quantity: number) =>
  quantity === 1 ? formatLongMonth(coverageStart) : formatCoverage(coverageStart, quantity)

const sessions = (quantity: number) => `${quantity} session${quantity === 1 ? '' : 's'}`

/** For the subject: "October 2026 Monthly Fee", "Oct – Nov 2026 Monthly Fee", "Training Fee (6 sessions)" or "Payment". */
function feeTitle(fee: FeeDetails) {
  if (fee.payment_type === 'Monthly' && fee.coverage_start && fee.quantity) {
    return `${monthsCovered(fee.coverage_start, fee.quantity)} Monthly Fee`
  }
  if (fee.payment_type === 'Per session' && fee.quantity) return `Training Fee (${sessions(fee.quantity)})`
  return 'Payment'
}

/** For the sentence: "monthly training fee for October 2026", "training fee for 6 sessions" or "payment". */
function feePhrase(fee: FeeDetails) {
  if (fee.payment_type === 'Monthly' && fee.coverage_start && fee.quantity) {
    return `monthly training fee for ${monthsCovered(fee.coverage_start, fee.quantity)}`
  }
  if (fee.payment_type === 'Per session' && fee.quantity) return `training fee for ${sessions(fee.quantity)}`
  return 'payment'
}

type LetterValues = {
  guardian: string | null
  student: string
  amount: string
  dueDate: string
  today: string
  phrase: string
  paymentDetails: string | null
  contact: string | null
  sender: string | null
}

type Letter = {
  greeting: string
  opening: string
  main: string
  paymentDetails: string | null
  questions: string
  thanks: string
  signOff: string
  sender: string | null
  role: string
}

/**
 * The letter's sentences. Called with escaped values for the HTML and plain values for the text
 * version, so both always say the same thing. It never says the payment was marked paid.
 */
function writeLetter(daysUntilDue: number, v: LetterValues): Letter {
  const what = `the ${v.phrase} for ${v.student}, in the amount of ${v.amount},`
  const main =
    daysUntilDue > 0
      ? `This is a kind reminder that ${what} is due on ${v.dueDate}.`
      : daysUntilDue === 0
        ? `This is a kind reminder that ${what} is due today, ${v.dueDate}.`
        : `This is a kind reminder that ${what} was due on ${v.dueDate} and remains unpaid as of ${v.today}. We kindly ask that it be settled at your earliest convenience.`
  return {
    greeting: v.guardian ? `Dear ${v.guardian},` : 'Dear Parent/Guardian,',
    opening: `Greetings from ${ACADEMY}!`,
    main,
    paymentDetails: v.paymentDetails ? `Payment may be made through ${v.paymentDetails}.` : null,
    questions: `If you have already settled this payment, please disregard this message, and thank you. For any questions or concerns, you may reply to this email${v.contact ? ` or contact us at ${v.contact}` : ''}.`,
    thanks: "Thank you for your continued trust and support in your child's training.",
    signOff: 'Respectfully,',
    sender: v.sender,
    role: `Head Coach, ${ACADEMY}`,
  }
}

const detailRow = (label: string, value: string, isLast = false) =>
  `<tr>
    <td style="padding:10px 16px;font-size:13px;color:#6b7280;width:110px;${isLast ? '' : 'border-bottom:1px solid #e5e7eb;'}">${label}</td>
    <td style="padding:10px 16px;font-size:14px;font-weight:bold;color:#111827;${isLast ? '' : 'border-bottom:1px solid #e5e7eb;'}">${value}</td>
  </tr>`

const PARAGRAPH = 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;'

/** Every value passed in here is already escaped. */
function buildEmailHtml(
  daysUntilDue: number,
  letter: Letter,
  details: { student: string; title: string; amount: string; dueDate: string },
) {
  const { label, tone } = emailLabel(daysUntilDue)
  const colors = LABEL_COLORS[tone]
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
            <td style="padding:28px 28px 4px;">
              <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${colors.background};color:${colors.color};font-size:12px;font-weight:bold;">${label}</span>
              <p style="margin:20px 0 14px;font-size:15px;color:#111827;">${letter.greeting}</p>
              <p style="${PARAGRAPH}">${letter.opening}</p>
              <p style="${PARAGRAPH}">${letter.main}</p>
              ${letter.paymentDetails ? `<p style="${PARAGRAPH}">${letter.paymentDetails}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                ${detailRow('Student', details.student)}
                ${detailRow('For', details.title)}
                ${detailRow('Amount', details.amount)}
                ${detailRow('Due date', details.dueDate, true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <p style="${PARAGRAPH}">${letter.questions}</p>
              <p style="${PARAGRAPH}">${letter.thanks}</p>
              <p style="margin:0;font-size:15px;color:#374151;">${letter.signOff}</p>
              ${letter.sender ? `<p style="margin:12px 0 0;font-size:15px;font-weight:bold;color:#111827;">${letter.sender}</p>` : ''}
              <p style="margin:${letter.sender ? '2px' : '12px'} 0 0;font-size:14px;color:#6b7280;">${letter.role}</p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding:16px 28px;font-size:12px;color:#9ca3af;">This reminder was sent by Rising Dragon Taekwondo.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildEmailText(letter: Letter) {
  return [
    letter.greeting,
    '',
    letter.opening,
    '',
    letter.main,
    ...(letter.paymentDetails ? ['', letter.paymentDetails] : []),
    '',
    letter.questions,
    '',
    letter.thanks,
    '',
    letter.signOff,
    ...(letter.sender ? [letter.sender] : []),
    letter.role,
  ].join('\n')
}

function buildEmail(payment: PaymentWithStudent, today: string, senderName: string | null) {
  const daysUntilDue = daysBetween(today, payment.due_date)
  const plain: LetterValues = {
    guardian: payment.student?.guardian_name?.trim() || null,
    student: studentName(payment),
    amount: formatAmount(payment.amount),
    dueDate: formatShortDate(payment.due_date),
    today: formatShortDate(today),
    phrase: feePhrase(payment),
    paymentDetails: PAYMENT_DETAILS,
    contact: CONTACT_NUMBER,
    sender: senderName,
  }
  // Every value from the database or settings is escaped before it goes into the HTML.
  const escape = (value: string | null) => (value === null ? null : escapeHtml(value))
  const escaped: LetterValues = {
    guardian: escape(plain.guardian),
    student: escapeHtml(plain.student),
    amount: escapeHtml(plain.amount),
    dueDate: escapeHtml(plain.dueDate),
    today: escapeHtml(plain.today),
    phrase: escapeHtml(plain.phrase),
    paymentDetails: escape(plain.paymentDetails),
    contact: escape(plain.contact),
    sender: escape(plain.sender),
  }
  const title = feeTitle(payment)
  return {
    subject: `Payment Reminder – ${title} – ${plain.student}`,
    text: buildEmailText(writeLetter(daysUntilDue, plain)),
    html: buildEmailHtml(daysUntilDue, writeLetter(daysUntilDue, escaped), {
      student: escaped.student,
      title: escapeHtml(title),
      amount: escaped.amount,
      dueDate: escaped.dueDate,
    }),
  }
}

async function loadPayment(admin: Admin, paymentId: number) {
  const { data, error } = await admin.from('payment').select(PAYMENT_SELECT).eq('id', paymentId).maybeSingle()
  if (error) throw new Error(`Could not load the payment: ${error.message}`)
  return data as unknown as PaymentWithStudent | null
}

/** "First Last" of the Head Coach sending, for the letter's signature. null when it can't be found. */
async function loadSenderName(admin: Admin, userId: number) {
  const { data } = await admin.from('user').select('first_name, last_name').eq('id', userId).maybeSingle()
  const name = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim()
  return name || null
}

// Paid or inactive: no reminder is needed at all.
function noReminderNeeded(payment: PaymentWithStudent) {
  if (payment.status !== 'Unpaid') return 'Payment is already paid.'
  if (!payment.student?.is_active) return 'Student is inactive.'
  return null
}

function paymentProblem(payment: PaymentWithStudent | null) {
  if (!payment) return 'Payment not found.'
  const reason = noReminderNeeded(payment)
  if (reason) return `No reminder needed. ${reason}`
  const email = guardianEmail(payment)
  if (!email) return NO_GUARDIAN_EMAIL
  if (!isValidEmail(email)) return INVALID_GUARDIAN_EMAIL
  return null
}

async function findReminder(admin: Admin, paymentId: number, type: ReminderType) {
  const { data, error } = await admin.from('payment_reminder')
    .select('id, reminder_type, status, attempt_count, sent_at')
    .eq('payment_id', paymentId)
    .eq('reminder_type', type)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as ExistingReminder | null
}

// A Skipped row (left by the old daily job) can be reused; anything else blocks Send.
function blockedBy(existing: ExistingReminder | null, type: ReminderType) {
  if (!existing || existing.status === 'Skipped') return null
  if (existing.status === 'Sent') {
    return `The "${type}" reminder was already sent${existing.sent_at ? ` on ${formatSentDate(existing.sent_at)}` : ''}.`
  }
  if (existing.status === 'Failed') return `The "${type}" reminder failed earlier. Use Retry in Reminder history.`
  return `The "${type}" reminder is being sent right now. Refresh the page in a minute.`
}

function reviewChanged(reviewed: ReviewedReminder, recipient: string, type: ReminderType) {
  return normalizeEmail(reviewed.recipient) !== recipient || reviewed.reminderType !== type
}

function toPreview(payment: PaymentWithStudent, recipient: string, type: ReminderType, senderName: string | null): ReminderPreview {
  return {
    studentName: studentName(payment),
    guardianName: payment.student?.guardian_name?.trim() || null,
    recipient,
    amount: formatAmount(payment.amount),
    dueDate: formatDueDate(payment.due_date),
    reminderType: type,
    ...buildEmail(payment, dateInTimeZone(), senderName),
  }
}

/** Close a Failed reminder without sending it. Only a row that is still Failed is changed. */
async function closeAsSkipped(admin: Admin, reminderId: number, reason: string) {
  const { error } = await admin.from('payment_reminder')
    .update({ status: 'Skipped', completed_at: nowIso(), sent_at: null, error_message: reason })
    .eq('id', reminderId)
    .eq('status', 'Failed')
  if (error) throw new Error(error.message)
}

/** Move a Failed or Skipped row back to Scheduled. Only one click can win this update. */
async function reclaim(admin: Admin, reminder: ExistingReminder, recipient: string, userId: number) {
  const { data, error } = await admin.from('payment_reminder')
    .update({
      status: 'Scheduled',
      completed_at: null,
      sent_at: null,
      error_message: null,
      provider_message_id: null,
      recipient_email: recipient,
      sent_by: userId,
      attempt_count: reminder.attempt_count + 1,
      last_attempt_at: nowIso(),
    })
    .eq('id', reminder.id)
    .eq('status', reminder.status)
    .eq('attempt_count', reminder.attempt_count)
    .select('id')
  if (error) throw new Error(error.message)
  return Boolean(data?.length)
}

/** Send through Gmail and record Sent or Failed on the Scheduled row. Never changes payment.status. */
async function deliver(
  admin: Admin,
  reminderId: number,
  payment: PaymentWithStudent,
  recipient: string,
  type: ReminderType,
  senderName: string | null,
): Promise<SendReminderResult> {
  const result = await sendGmail({ to: recipient, ...buildEmail(payment, dateInTimeZone(), senderName) })

  // completed_at is always set when an attempt finishes; sent_at only when it was Sent.
  const finish = async (values: { status: 'Sent' | 'Failed'; sent_at: string | null; error_message: string | null; provider_message_id: string | null }) => {
    const { error } = await admin.from('payment_reminder')
      .update({ ...values, completed_at: nowIso() })
      .eq('id', reminderId)
      .eq('status', 'Scheduled')
    return error?.message ?? null
  }

  if ('error' in result) {
    const saveError = await finish({ status: 'Failed', sent_at: null, error_message: result.error.slice(0, 500), provider_message_id: null })
    return { error: `Gmail could not send the email: ${result.error}${saveError ? ` (The result could not be saved: ${saveError})` : ''}` }
  }

  const saveError = await finish({ status: 'Sent', sent_at: nowIso(), error_message: null, provider_message_id: result.messageId })
  if (saveError) {
    return { error: `The email was sent, but the result could not be saved (${saveError}). Do not send it again. Check the Gmail Sent folder.` }
  }
  return { status: 'Sent', reminderType: type, recipient }
}

/** Popup data for "Send reminder". The type comes from today's real days until due. */
export async function getPaymentReminderPreview(paymentId: number, userId: number): Promise<ReminderPreviewResult> {
  const admin = createAdminClient()
  try {
    const payment = await loadPayment(admin, paymentId)
    const problem = paymentProblem(payment)
    if (problem || !payment) return { error: problem ?? 'Payment not found.' }

    const timing = reminderWindowFor(payment.due_date)
    // Outside the timing windows nothing can be sent, so stop before any reminder row is touched.
    if (!timing.open) return { error: opensLater(timing) }
    const type = timing.type
    const blocked = blockedBy(await findReminder(admin, payment.id, type), type)
    if (blocked) return { error: blocked }

    return { preview: toPreview(payment, guardianEmail(payment), type, await loadSenderName(admin, userId)) }
  } catch (error) {
    return { error: errorMessage(error, 'Could not load the reminder preview.') }
  }
}

/** "Send reminder": checks everything again, records the attempt, then sends once. */
export async function sendReminderForPayment(
  paymentId: number,
  userId: number,
  reviewed: ReviewedReminder,
): Promise<SendReminderResult> {
  const admin = createAdminClient()
  try {
    const payment = await loadPayment(admin, paymentId)
    const problem = paymentProblem(payment)
    if (problem || !payment) return { error: problem ?? 'Payment not found.' }

    const recipient = guardianEmail(payment)
    const today = dateInTimeZone()
    const timing = reminderWindowFor(payment.due_date, today)
    if (!timing.open) return { error: opensLater(timing) }
    const type = timing.type
    if (reviewChanged(reviewed, recipient, type)) {
      return { error: 'The details changed since you reviewed them. Close this window and review again.' }
    }
    const senderName = await loadSenderName(admin, userId)

    const existing = await findReminder(admin, payment.id, type)
    const blocked = blockedBy(existing, type)
    if (blocked) return { error: blocked }

    let reminderId: number
    if (existing) {
      // Skipped row from the old daily job: reuse it, since the type is unique per payment.
      if (!(await reclaim(admin, existing, recipient, userId))) return { error: ALREADY_SENDING }
      reminderId = Number(existing.id)
    } else {
      const { data, error } = await admin.from('payment_reminder')
        .insert({
          payment_id: payment.id,
          reminder_type: type,
          recipient_email: recipient,
          scheduled_for: today,
          sent_by: userId,
          status: 'Scheduled',
          attempt_count: 1,
          last_attempt_at: nowIso(),
        })
        .select('id')
        .single()
      if (error) {
        // UNIQUE (payment_id, reminder_type): another click got here first.
        if (error.code === '23505') return { error: ALREADY_SENDING }
        throw new Error(error.message)
      }
      reminderId = Number(data.id)
    }

    return await deliver(admin, reminderId, payment, recipient, type, senderName)
  } catch (error) {
    return { error: errorMessage(error, 'Could not send the reminder.') }
  }
}

type RetryContext = { reminder: ExistingReminder; payment: PaymentWithStudent; recipient: string }

/** Load a Failed reminder for Retry. Closes it as Skipped when no reminder is needed any more. */
async function prepareRetry(admin: Admin, reminderId: number): Promise<RetryContext | Problem> {
  const { data, error } = await admin.from('payment_reminder')
    .select('id, payment_id, reminder_type, status, attempt_count, sent_at')
    .eq('id', reminderId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { error: 'Reminder not found.' }
  const reminder = data as ExistingReminder & { payment_id: number }
  if (reminder.status !== 'Failed') return { error: 'Only failed reminders can be retried. Refresh the page.' }

  const payment = await loadPayment(admin, reminder.payment_id)
  if (!payment) return { error: 'Payment not found.' }

  const reason = noReminderNeeded(payment)
  if (reason) {
    await closeAsSkipped(admin, reminder.id, reason)
    return { error: `Not sent. ${reason} The reminder was closed.`, closed: true }
  }

  // Retry only while this reminder's own window is open, so the email wording still fits.
  const timing = reminderWindowFor(payment.due_date)
  if (!timing.open && timing.nextType === reminder.reminder_type) {
    // Too early (an older row sent before these windows existed): keep it Failed for later.
    return { error: `${opensLater(timing)} Retry it then.` }
  }
  if (timing.type !== reminder.reminder_type) {
    const tooLate = `Too late to retry this ${reminder.reminder_type} reminder.`
    await closeAsSkipped(admin, reminder.id, tooLate)
    const next = timing.open
      ? 'Send the current reminder from the payment list instead.'
      : opensLater(timing)
    return { error: `${tooLate} ${next}`, closed: true }
  }

  const recipient = guardianEmail(payment)
  if (!recipient) return { error: NO_GUARDIAN_EMAIL }
  if (!isValidEmail(recipient)) return { error: INVALID_GUARDIAN_EMAIL }
  return { reminder, payment, recipient }
}

/** Popup data for "Retry". Keeps the failed row's type; wording uses today's real days. */
export async function getRetryReminderPreview(reminderId: number, userId: number): Promise<ReminderPreviewResult> {
  const admin = createAdminClient()
  try {
    const context = await prepareRetry(admin, reminderId)
    if ('error' in context) return context
    return {
      preview: toPreview(context.payment, context.recipient, context.reminder.reminder_type, await loadSenderName(admin, userId)),
    }
  } catch (error) {
    return { error: errorMessage(error, 'Could not load the reminder preview.') }
  }
}

/** "Retry": move a Failed reminder back to Scheduled and send it again. */
export async function retryFailedReminder(
  reminderId: number,
  userId: number,
  reviewed: ReviewedReminder,
): Promise<SendReminderResult> {
  const admin = createAdminClient()
  try {
    const context = await prepareRetry(admin, reminderId)
    if ('error' in context) return context
    const { reminder, payment, recipient } = context
    if (reviewChanged(reviewed, recipient, reminder.reminder_type)) {
      return { error: 'The details changed since you reviewed them. Close this window and review again.' }
    }
    if (!(await reclaim(admin, reminder, recipient, userId))) {
      return { error: 'This reminder is already being retried. Refresh the page.' }
    }
    return await deliver(admin, Number(reminder.id), payment, recipient, reminder.reminder_type, await loadSenderName(admin, userId))
  } catch (error) {
    return { error: errorMessage(error, 'Could not retry the reminder.') }
  }
}

/** No cron any more: on page load, mark rows stuck in Scheduled as Failed so they can be retried. */
export async function failStuckReminders(admin: Admin) {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString()
  const { error } = await admin.from('payment_reminder')
    .update({
      status: 'Failed',
      completed_at: nowIso(),
      sent_at: null,
      error_message: 'Sending was interrupted. Check the Gmail Sent folder before pressing Retry.',
    })
    .eq('status', 'Scheduled')
    .lt('last_attempt_at', stuckBefore)
  return error?.message ?? null
}
