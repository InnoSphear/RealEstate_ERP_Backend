export const validateCreateTenant = (data) => {
  const errors = []
  if (!data.company_name || !data.company_name.trim()) {
    errors.push('Company name is required')
  }
  if (!data.company_email || !data.company_email.trim()) {
    errors.push('Company email is required')
  }
  return { isValid: errors.length === 0, errors }
}
