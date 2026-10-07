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
