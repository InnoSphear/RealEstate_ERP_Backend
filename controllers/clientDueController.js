import ClientDue from '../models/ClientDue.js'
import ActivityLog from '../models/ActivityLog.js'

export const createClientDue = async (req, res) => {
  try {
    const data = { ...req.body, tenant: req.tenant._id, created_by: req.user._id }
    const due = await ClientDue.create(data)
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id, action: 'create_client_due',
      resource: 'ClientDue', resource_id: due._id,
      description: `Due of ₹${data.amount} created for client`,
      type: 'financial', severity: 'info',
    })
    res.status(201).json(due)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getClientDues = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, client: req.params.clientId, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    const dues = await ClientDue.find(filter)
      .populate('created_by', 'full_name')
      .sort({ createdAt: -1 })
    res.json(dues)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getAllClientDues = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.client_id) filter.client = req.query.client_id
    const dues = await ClientDue.find(filter)
      .populate('client', 'full_name mobile email')
      .populate('created_by', 'full_name')
      .sort({ createdAt: -1 })
    res.json(dues)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateClientDue = async (req, res) => {
  try {
    const due = await ClientDue.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!due) return res.status(404).json({ message: 'Due record not found' })
    const updatable = ['amount', 'paid_amount', 'reason', 'due_date', 'status', 'notes']
    updatable.forEach(f => { if (req.body[f] !== undefined) due[f] = req.body[f] })
    await due.save()
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id, action: 'update_client_due',
      resource: 'ClientDue', resource_id: due._id,
      description: `Due ${due._id} updated`,
      type: 'financial', severity: 'info',
    })
    res.json(due)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteClientDue = async (req, res) => {
  try {
    const due = await ClientDue.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!due) return res.status(404).json({ message: 'Due record not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id, action: 'delete_client_due',
      resource: 'ClientDue', resource_id: due._id,
      description: `Due of ₹${due.amount} deleted`,
      type: 'financial', severity: 'warning',
    })
    res.json({ message: 'Due deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
