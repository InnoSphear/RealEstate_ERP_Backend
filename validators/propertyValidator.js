export const validateCreateProperty = (data) => {
  const errors = []
  if (!data.owner_name || !data.owner_name.trim()) {
    errors.push('Owner name is required')
  }
  if (!data.owner_contact || !data.owner_contact.trim()) {
    errors.push('Owner contact is required')
  }
  if (!data.location || !data.location.trim()) {
    errors.push('Location is required')
  }
  if (!data.property_type || !data.property_type.trim()) {
    errors.push('Property type is required')
  }
  if (!data.listing_type || !data.listing_type.trim()) {
    errors.push('Listing type is required')
  }
  if (data.listing_type === 'sale' && !data.price_sale) {
    errors.push('Sale price is required for sale listing')
  }
  if (data.listing_type === 'rent' && !data.rent_amount) {
    errors.push('Rent amount is required for rent listing')
  }
  return { isValid: errors.length === 0, errors }
}
