export const validateCreateUser = (data) => {
  const errors = []
  if (!data.full_name || !data.full_name.trim()) {
    errors.push('Full name is required')
  } else if (data.full_name.length > 100) {
    errors.push('Full name must be at most 100 characters')
  }
  if (!data.email || !data.email.trim()) {
    errors.push('Email is required')
  }
  if (!data.role || !data.role.trim()) {
    errors.push('Role is required')
  }
  if (!data.password || !data.password.trim()) {
    errors.push('Password is required')
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters')
  }
  return { isValid: errors.length === 0, errors }
}
