import 'server-only'

import nodemailer, { type Transporter } from 'nodemailer'

type GmailConfig = { user: string; appPassword: string; fromName: string; replyTo?: string }

export type GmailMessage = { to: string; subject: string; html: string; text: string }
export type GmailSendResult = { messageId: string } | { error: string }

let transporter: Transporter | null = null

function gmailConfig(): GmailConfig | null {
  const user = process.env.GMAIL_USER?.trim()
  // Google shows App Passwords in groups of 4 ("abcd efgh ..."), so drop the spaces.
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  const fromName = process.env.REMINDER_FROM_NAME?.trim() || 'Rising Dragon Taekwondo'
  // Optional: where guardians' replies go. Unset = replies go to GMAIL_USER.
  const replyTo = process.env.REMINDER_REPLY_TO?.trim() || undefined
  return user && appPassword ? { user, appPassword, fromName, replyTo } : null
}

// Created on the first send, not at import, so a missing env var only breaks sending.
function getTransporter(config: GmailConfig) {
  transporter ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: config.user, pass: config.appPassword },
    // Fail fast so a hung send ends long before the 10-minute "stuck" rule.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return transporter
}

function describeError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === 'EAUTH') return 'Gmail rejected the login. Check GMAIL_USER and GMAIL_APP_PASSWORD.'
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET') return 'Could not reach Gmail. Try again in a minute.'
  return error instanceof Error ? error.message : 'Could not send the email.'
}

/** Send one email from the project Gmail account. Never throws. */
export async function sendGmail(message: GmailMessage): Promise<GmailSendResult> {
  const config = gmailConfig()
  if (!config) return { error: 'Email sending is not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD to the server environment.' }

  try {
    const info = await getTransporter(config).sendMail({
      // Gmail only sends as the signed-in account, so From is always GMAIL_USER.
      // Nodemailer quotes and encodes the name: "<REMINDER_FROM_NAME>" <GMAIL_USER>.
      from: { name: config.fromName, address: config.user },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    })
    if (info.rejected?.length) return { error: `Gmail refused the recipient ${message.to}.` }
    return { messageId: info.messageId }
  } catch (error) {
    return { error: describeError(error) }
  }
}
