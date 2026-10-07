// The payment categories confirmed for the academy. Used by the server actions and forms.
export const PAYMENT_METHODS = ['Cash', 'Online', 'Card'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  PAYMENT_METHODS.some((method) => method === value)
