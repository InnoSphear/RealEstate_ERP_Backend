export const validateCreateEmployee = (data) => {
  const errors = []
  if (!data.employee_id || !data.employee_id.trim()) {
    errors.push('Employee ID is required')
  }
  if (!data.full_name || !data.full_name.trim()) {
    errors.push('Full name is required')
  }
  if (!data.email || !data.email.trim()) {
    errors.push('Email is required')
  }
  if (!data.mobile || !data.mobile.trim()) {
    errors.push('Mobile is required')
  }
  if (!data.joining_date) {
    errors.push('Joining date is required')
  }
  if (!data.department || !data.department.trim()) {
    errors.push('Department is required')
  }
  if (!data.employee_type || !data.employee_type.trim()) {
    errors.push('Employee type is required')
  }
  return { isValid: errors.length === 0, errors }
}
