import PropertyKey from '../models/PropertyKey.js'
import ActivityLog from '../models/ActivityLog.js'
import Employee from '../models/Employee.js'
import Commission from '../models/Commission.js'

export const createPropertyKey = async (req, res) => {
  try {
    const { property, key_number } = req.body
    if (!property || !key_number) return res.status(400).json({ message: 'Property and key number are required' })

    const existing = await PropertyKey.findOne({ tenant: req.tenant._id, property, key_number })
    if (existing) return res.status(400).json({ message: 'Key number already exists for this property' })

    const key = await PropertyKey.create({ ...req.body, tenant: req.tenant._id })
    const populated = await PropertyKey.findById(key._id)
      .populate('property', 'property_id location society_name tower flat_number')
      .populate('key_holder', 'full_name')
      .populate('issued_to', 'full_name')
      .populate('issued_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_property_key',
      resource: 'PropertyKey',
      resource_id: key._id,
      description: `Key ${key_number} created for property`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getPropertyKeys = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.property) filter.property = req.query.property
    if (req.query.status) filter.status = req.query.status
    if (req.query.key_holder) filter.key_holder = req.query.key_holder

    const keys = await PropertyKey.find(filter)
      .populate('property', 'property_id location society_name tower flat_number status is_deleted')
      .populate('key_holder', 'full_name')
      .populate('issued_to', 'full_name')
      .populate('issued_by', 'full_name')
      .sort({ createdAt: -1 })

    const activeKeys = keys.filter((k) => k.property && k.property.status === 'active')

    res.json(activeKeys)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPropertyKeyById = async (req, res) => {
  try {
    const key = await PropertyKey.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('property', 'property_id location society_name tower flat_number owner_name')
      .populate('key_holder', 'full_name email phone')
      .populate('issued_to', 'full_name email')
      .populate('issued_by', 'full_name')
    if (!key) return res.status(404).json({ message: 'Property key not found' })
    res.json(key)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updatePropertyKey = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted

    const key = await PropertyKey.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('property', 'property_id location tower flat_number')
      .populate('key_holder', 'full_name')
    if (!key) return res.status(404).json({ message: 'Property key not found' })

    res.json(key)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const issueKey = async (req, res) => {
  try {
    const key = await PropertyKey.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: 'available' })
    if (!key) return res.status(404).json({ message: 'Key not found or already issued' })

    const { issued_to, notes } = req.body
    if (!issued_to) return res.status(400).json({ message: 'Issued to user is required' })

    key.status = 'issued'
    key.issued_to = issued_to
    key.issued_by = req.user._id
    key.issue_date = new Date()
    key.key_holder = issued_to
    key.notes = notes || key.notes
    key.history.push({
      action: 'issued',
      issued_to,
      issued_by: req.user._id,
      issue_date: new Date(),
      notes: notes || '',
    })
    await key.save()

    const populated = await PropertyKey.findById(key._id)
      .populate('property', 'property_id location tower flat_number')
      .populate('issued_to', 'full_name')
      .populate('issued_by', 'full_name')
      .populate('key_holder', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'issue_key',
      resource: 'PropertyKey',
      resource_id: key._id,
      description: `Key ${key.key_number} issued`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const returnKey = async (req, res) => {
  try {
    const key = await PropertyKey.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: 'issued' })
    if (!key) return res.status(404).json({ message: 'Key not found or not currently issued' })

    key.status = 'returned'
    key.return_date = new Date()
    key.key_holder = null
    key.history.push({
      action: 'returned',
      issued_to: key.issued_to,
      issued_by: key.issued_by,
      return_date: new Date(),
      notes: req.body.notes || '',
    })
    await key.save()

    const populated = await PropertyKey.findById(key._id)
      .populate('property', 'property_id location tower flat_number')
      .populate('issued_to', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'return_key',
      resource: 'PropertyKey',
      resource_id: key._id,
      description: `Key ${key.key_number} returned`,
      type: 'crud',
      severity: 'info',
    })

    try {
      const employee = await Employee.findOne({ user: req.user._id, tenant: req.tenant._id })
      if (employee && employee.department === 'telecalling') {
        await Commission.create({
          tenant: req.tenant._id,
          employee: employee._id,
          user: req.user._id,
          commission_type: 'fixed',
          commission_value: 100,
          commission_amount: 100,
          source: 'service',
          source_id: key._id,
          source_description: 'Key managed successfully',
          status: 'pending',
        })
      }
    } catch (e) {
      // silent fail on commission auto-creation
    }

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deletePropertyKey = async (req, res) => {
  try {
    const key = await PropertyKey.findOneAndDelete(
      { _id: req.params.id, tenant: req.tenant._id }
    )
    if (!key) return res.status(404).json({ message: 'Property key not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_property_key', resource: 'PropertyKey',
      resource_id: key._id,
      description: `Key ${key.key_number} deleted`,
      type: 'crud', severity: 'warning',
    })
    res.json({ message: 'Key deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const markKeyOutside = async (req, res) => {
  try {
    const key = await PropertyKey.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: 'issued' })
    if (!key) return res.status(404).json({ message: 'Key not found or not currently issued' })

    key.status = 'outside'
    key.history.push({
      action: 'outside',
      issued_to: key.issued_to,
      issued_by: key.issued_by,
      notes: req.body.notes || 'Key taken outside',
      timestamp: new Date(),
    })
    await key.save()

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'mark_key_outside', resource: 'PropertyKey',
      resource_id: key._id,
      description: `Key ${key.key_number} marked as outside`,
      type: 'crud', severity: 'info',
    })

    res.json(key)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const markKeyAvailable = async (req, res) => {
  try {
    const key = await PropertyKey.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!key) return res.status(404).json({ message: 'Key not found' })
    if (key.status !== 'returned') return res.status(400).json({ message: 'Only returned keys can be marked available' })

    key.status = 'available'
    key.key_holder = null
    key.issued_to = null
    key.issued_by = null
    await key.save()

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'mark_key_available', resource: 'PropertyKey',
      resource_id: key._id,
      description: `Key ${key.key_number} marked as available`,
      type: 'crud', severity: 'info',
    })

    res.json(key)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getHistory = async (req, res) => {
  try {
    const key = await PropertyKey.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!key) return res.status(404).json({ message: 'Property key not found' })

    const history = await PropertyKey.findById(key._id)
      .populate('history.issued_to', 'full_name')
      .populate('history.issued_by', 'full_name')

    res.json(history.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
