export const validateCreateInvoice = (data) => {
  const errors = []
  if (!data.client) {
    errors.push('Client is required')
  }
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push('At least one item is required')
  } else {
    data.items.forEach((item, index) => {
      if (!item.description) {
        errors.push(`Item ${index + 1}: description is required`)
      }
      if (item.rate === undefined || item.rate === null) {
        errors.push(`Item ${index + 1}: rate is required`)
      }
      if (item.amount === undefined || item.amount === null) {
        errors.push(`Item ${index + 1}: amount is required`)
      }
    })
  }
  if (data.subtotal === undefined || data.subtotal === null) {
    errors.push('Subtotal is required')
  }
  if (data.total_amount === undefined || data.total_amount === null) {
    errors.push('Total amount is required')
  }
  if (!data.due_date) {
    errors.push('Due date is required')
  }
  return { isValid: errors.length === 0, errors }
}
