export const validateCreateLead = (data) => {
  const errors = []
  if (!data.full_name || !data.full_name.trim()) {
    errors.push('Full name is required')
  }
  if (!data.mobile || !data.mobile.trim()) {
    errors.push('Mobile is required')
  }
  if (!data.source || !data.source.trim()) {
    errors.push('Source is required')
  }
  return { isValid: errors.length === 0, errors }
}
