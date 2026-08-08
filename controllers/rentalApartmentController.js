import RentalApartment from '../models/RentalApartment.js'
import ActivityLog from '../models/ActivityLog.js'

const tenantFilter = (req) => ({ tenant: req.tenant._id, is_deleted: false })

export const createRental = async (req, res) => {
  try {
    const rental = await RentalApartment.create({ ...req.body, tenant: req.tenant._id })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'create_rental', resource: 'RentalApartment',
      resource_id: rental._id,
      description: `Rental unit ${rental.unit_number} created`,
      type: 'crud', severity: 'info',
    })
    res.status(201).json(rental)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getRentals = async (req, res) => {
  try {
    const filter = { ...tenantFilter(req) }
    if (req.query.status) filter.status = req.query.status
    if (req.query.property) filter.property = req.query.property
    if (req.query.search) {
      filter.$or = [
        { unit_number: { $regex: req.query.search, $options: 'i' } },
        { building_name: { $regex: req.query.search, $options: 'i' } },
        { 'owner.name': { $regex: req.query.search, $options: 'i' } },
        { 'tenant_info.name': { $regex: req.query.search, $options: 'i' } },
      ]
    }
    const rentals = await RentalApartment.find(filter)
      .populate('property', 'property_id building_name location')
      .sort({ createdAt: -1 })
    res.json(rentals)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getRentalById = async (req, res) => {
  try {
    const rental = await RentalApartment.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('property', 'property_id building_name location city state')
    if (!rental) return res.status(404).json({ message: 'Rental not found' })
    res.json(rental)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateRental = async (req, res) => {
  try {
    const prev = await RentalApartment.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!prev) return res.status(404).json({ message: 'Rental not found' })

    const rental = await RentalApartment.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    )

    if (req.body.status && req.body.status !== prev.status) {
      await ActivityLog.create({
        tenant: req.tenant._id, user: req.user._id,
        action: 'update_rental_status', resource: 'RentalApartment',
        resource_id: rental._id,
        description: `Rental ${rental.unit_number} status changed from ${prev.status} to ${rental.status}`,
        type: 'crud', severity: 'info',
      })
    }

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'update_rental', resource: 'RentalApartment',
      resource_id: rental._id,
      description: `Rental ${rental.unit_number} updated`,
      type: 'crud', severity: 'info',
    })

    res.json(rental)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteRental = async (req, res) => {
  try {
    const rental = await RentalApartment.findOneAndDelete(
      { _id: req.params.id, tenant: req.tenant._id }
    )
    if (!rental) return res.status(404).json({ message: 'Rental not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_rental', resource: 'RentalApartment',
      resource_id: rental._id,
      description: `Rental ${rental.unit_number} deleted`,
      type: 'crud', severity: 'warning',
    })
    res.json({ message: 'Rental deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPrintableInfo = async (req, res) => {
  try {
    const rental = await RentalApartment.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('property', 'property_id building_name location city state address')
    if (!rental) return res.status(404).json({ message: 'Rental not found' })
    res.json(rental)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
