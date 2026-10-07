// The only payment methods the Payments page accepts. Used by the server action and the popup.
export const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank transfer'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  PAYMENT_METHODS.some((method) => method === value)
