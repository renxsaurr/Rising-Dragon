// Make an email ready to save or compare: remove spaces at both ends and make it lowercase.
// Anything that is not text becomes an empty string.
export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const LOCAL_FORBIDDEN = /[\s,;<>"'()[\]\\]/
const DOMAIN_CHARACTERS = /^[a-z0-9.-]+$/i
const TOP_LEVEL = /^[a-z]{2,}$/i

// True only for one plain address like name@example.com. Rejects lists of addresses,
// spaces, a missing ".com"-style ending, and dots or dashes in the wrong place.
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false

  // Exactly one "@".
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts

  // Before "@": 1–64 characters, no spaces or special characters, dots only in the middle.
  if (local.length < 1 || local.length > 64) return false
  if (LOCAL_FORBIDDEN.test(local)) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false

  // After "@": letters, numbers, "-" and "." only, with at least one dot in the right places.
  if (!DOMAIN_CHARACTERS.test(domain)) return false
  // Split "mail.school.edu.ph" into its parts: there must be at least two,
  // and none may be empty or start or end with "-".
  const labels = domain.split('.')
  if (labels.length < 2) return false
  if (labels.some((label) => !label || label.startsWith('-') || label.endsWith('-'))) return false

  // The last part (like "com" or "ph") is at least 2 letters.
  return TOP_LEVEL.test(labels[labels.length - 1])
}
