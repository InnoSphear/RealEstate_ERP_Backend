export const validateCreateProject = (data) => {
  const errors = []
  if (!data.project_name || !data.project_name.trim()) {
    errors.push('Project name is required')
  }
  if (!data.location || !data.location.trim()) {
    errors.push('Location is required')
  }
  return { isValid: errors.length === 0, errors }
}
