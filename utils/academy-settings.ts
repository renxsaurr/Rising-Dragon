// Academy details used in payment reminders and bills. No server-only imports: the popups use these too.

/** Day of the month a monthly fee is due. Default for now; the owner still has to confirm it. */
export const MONTHLY_DUE_DAY = 10

/**
 * How guardians can pay, e.g. "GCash 0917 123 4567 (Juan Dela Cruz)".
 * Fill in when the owner gives it. While null, the line is left out of the email.
 */
export const PAYMENT_DETAILS: string | null = null

/** Phone number guardians can call or text. Fill in when the owner gives it. While null, the line is left out. */
export const CONTACT_NUMBER: string | null = null

const RAW_TRACKING_START_MONTH = '2026-10'

/**
 * First month the academy uses the system ('YYYY-MM'). Months before it are never counted as unpaid.
 * Confirm with the owner/leader before go-live.
 * Checked once here: if the value isn't a valid 'YYYY-MM', it becomes null and there is no start limit.
 */
export const TRACKING_START_MONTH: string | null = /^\d{4}-(0[1-9]|1[0-2])$/.test(RAW_TRACKING_START_MONTH)
  ? RAW_TRACKING_START_MONTH
  : null
