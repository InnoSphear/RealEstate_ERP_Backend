export const validateCreateClient = (data) => {
  const errors = []
  if (!data.full_name || !data.full_name.trim()) {
    errors.push('Full name is required')
  }
  if (!data.mobile || !data.mobile.trim()) {
    errors.push('Mobile is required')
  }
  return { isValid: errors.length === 0, errors }
}
