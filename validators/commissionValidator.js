export const validateCreateCommission = (data) => {
  const errors = []
  if (!data.employee) {
    errors.push('Employee is required')
  }
  if (!data.commission_type || !data.commission_type.trim()) {
    errors.push('Commission type is required')
  } else if (!['fixed', 'percentage'].includes(data.commission_type)) {
    errors.push('Commission type must be fixed or percentage')
  }
  if (data.commission_type === 'fixed' && (data.commission_value === undefined || data.commission_value === null)) {
    errors.push('Commission value is required for fixed commission')
  }
  if (data.commission_type === 'percentage' && (data.percentage_rate === undefined || data.percentage_rate === null)) {
    errors.push('Percentage rate is required for percentage commission')
  }
  if (!data.source || !data.source.trim()) {
    errors.push('Source is required')
  }
  return { isValid: errors.length === 0, errors }
}
