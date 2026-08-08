export const validateCreateExpense = (data) => {
  const errors = []
  if (!data.category || !data.category.trim()) {
    errors.push('Category is required')
  }
  if (data.amount === undefined || data.amount === null) {
    errors.push('Amount is required')
  }
  if (!data.date) {
    errors.push('Date is required')
  }
  return { isValid: errors.length === 0, errors }
}
