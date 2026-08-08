export const validateCreatePayment = (data) => {
  const errors = []
  if (!data.client) {
    errors.push('Client is required')
  }
  if (data.amount === undefined || data.amount === null) {
    errors.push('Amount is required')
  }
  if (!data.payment_mode || !data.payment_mode.trim()) {
    errors.push('Payment mode is required')
  }
  return { isValid: errors.length === 0, errors }
}
