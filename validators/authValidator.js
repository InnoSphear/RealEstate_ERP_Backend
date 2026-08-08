export const validateLogin = (data) => {
  const errors = []
  if (!data.email || !data.email.trim()) {
    errors.push('Email is required')
  }
  if (!data.password || !data.password.trim()) {
    errors.push('Password is required')
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters')
  }
  return { isValid: errors.length === 0, errors }
}

export const validateForgotPassword = (data) => {
  const errors = []
  if (!data.email || !data.email.trim()) {
    errors.push('Email is required')
  }
  return { isValid: errors.length === 0, errors }
}

export const validateResetPassword = (data) => {
  const errors = []
  if (!data.token || !data.token.trim()) {
    errors.push('Token is required')
  }
  if (!data.password || !data.password.trim()) {
    errors.push('Password is required')
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters')
  }
  return { isValid: errors.length === 0, errors }
}

export const validateChangePassword = (data) => {
  const errors = []
  if (!data.currentPassword || !data.currentPassword.trim()) {
    errors.push('Current password is required')
  }
  if (!data.newPassword || !data.newPassword.trim()) {
    errors.push('New password is required')
  } else if (data.newPassword.length < 6) {
    errors.push('New password must be at least 6 characters')
  }
  if (data.confirmPassword !== data.newPassword) {
    errors.push('Confirm password must match new password')
  }
  return { isValid: errors.length === 0, errors }
}
