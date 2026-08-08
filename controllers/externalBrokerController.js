import ExternalBroker from '../models/ExternalBroker.js'
import ActivityLog from '../models/ActivityLog.js'

export const createExternalBroker = async (req, res) => {
  try {
    const broker = await ExternalBroker.create({
      ...req.body,
      tenant: req.tenant._id,
      created_by: req.user._id,
    })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_external_broker',
      resource: 'ExternalBroker',
      resource_id: broker._id,
      description: `External broker ${broker.name} registered`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(broker)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getExternalBrokers = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.specialization) filter.specialization = req.query.specialization
    if (req.query.is_active === 'true') filter.is_active = true
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { company_name: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { city: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const brokers = await ExternalBroker.find(filter).sort({ createdAt: -1 })
    res.json(brokers)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getExternalBrokerById = async (req, res) => {
  try {
    const broker = await ExternalBroker.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
      is_deleted: false,
    })
    if (!broker) return res.status(404).json({ message: 'External broker not found' })
    res.json(broker)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateExternalBroker = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    delete data.created_by

    const broker = await ExternalBroker.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
    if (!broker) return res.status(404).json({ message: 'External broker not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_external_broker',
      resource: 'ExternalBroker',
      resource_id: broker._id,
      description: `External broker ${broker.name} updated`,
      type: 'crud',
      severity: 'info',
    })

    res.json(broker)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteExternalBroker = async (req, res) => {
  try {
    const broker = await ExternalBroker.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      { is_deleted: true, deleted_at: new Date() },
      { new: true }
    )
    if (!broker) return res.status(404).json({ message: 'External broker not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_external_broker',
      resource: 'ExternalBroker',
      resource_id: broker._id,
      description: `External broker ${broker.name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'External broker deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getExternalBrokerStats = async (req, res) => {
  try {
    const match = { tenant: req.tenant._id, is_deleted: false }
    const stats = await ExternalBroker.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_brokers: { $sum: 1 },
          active_brokers: { $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] } },
          sale_brokers: { $sum: { $cond: [{ $in: ['$specialization', ['sale', 'both']] }, 1, 0] } },
          rent_brokers: { $sum: { $cond: [{ $in: ['$specialization', ['rent', 'both']] }, 1, 0] } },
        },
      },
    ])
    res.json(stats[0] || { total_brokers: 0, active_brokers: 0, sale_brokers: 0, rent_brokers: 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
