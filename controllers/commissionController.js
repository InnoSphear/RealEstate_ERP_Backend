import Commission from '../models/Commission.js'
import Employee from '../models/Employee.js'
import ActivityLog from '../models/ActivityLog.js'

export const createCommission = async (req, res) => {
  try {
    const data = { ...req.body, tenant: req.tenant._id, created_by: req.user._id }
    if (data.employee_id) { data.employee = data.employee_id; delete data.employee_id }
    if (data.client_id) { data.client = data.client_id; delete data.client_id }
    if (data.property_id) { data.property = data.property_id; delete data.property_id }
    if (data.external_broker_id) { data.external_broker = data.external_broker_id; delete data.external_broker_id }
    if (data.commission_type === 'fixed') {
      data.commission_amount = data.commission_value || 0
    } else if (data.commission_type === 'percentage' && data.amount_basis && data.percentage_rate) {
      data.commission_amount = (data.amount_basis * data.percentage_rate) / 100
    }
    if (data.employee && !data.user) {
      const emp = await Employee.findOne({ _id: data.employee, is_deleted: false })
      if (emp?.user) data.user = emp.user
    }
    const commission = await Commission.create(data)
    const populated = await Commission.findById(commission._id)
      .populate('employee', 'employee_id full_name')
      .populate('user', 'full_name')
      .populate('created_by', 'full_name')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('invoice', 'invoice_number')
      .populate('payment', 'payment_number')
      .populate('external_broker', 'name company_name phone')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_commission',
      resource: 'Commission',
      resource_id: commission._id,
      description: `Commission of ${commission.commission_amount} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getCommissions = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.employee) filter.employee = req.query.employee
    if (req.query.user) filter.user = req.query.user
    if (req.query.source) filter.source = req.query.source
    if (req.query.commission_type) filter.commission_type = req.query.commission_type

    const commissions = await Commission.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('user', 'full_name email')
      .populate('created_by', 'full_name')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('invoice', 'invoice_number total_amount')
      .populate('payment', 'payment_number amount')
      .populate('paid_by', 'full_name')
      .populate('payment_history.paid_by', 'full_name')
      .populate('external_broker', 'name company_name phone')
      .sort({ createdAt: -1 })

    res.json(commissions)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getCommissionById = async (req, res) => {
  try {
    const commission = await Commission.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('employee', 'employee_id full_name department')
      .populate('user', 'full_name email')
      .populate('client', 'client_id full_name mobile')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('invoice', 'invoice_number total_amount')
      .populate('payment', 'payment_number amount')
      .populate('paid_by', 'full_name')
      .populate('payment_history.paid_by', 'full_name')
      .populate('external_broker', 'name company_name phone')
    if (!commission) return res.status(404).json({ message: 'Commission not found' })
    res.json(commission)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateCommission = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    if (data.employee_id) { data.employee = data.employee_id; delete data.employee_id }
    if (data.client_id) { data.client = data.client_id; delete data.client_id }
    if (data.property_id) { data.property = data.property_id; delete data.property_id }
    if (data.external_broker_id) { data.external_broker = data.external_broker_id; delete data.external_broker_id }

    if (data.commission_type === 'fixed') {
      data.commission_amount = data.commission_value || 0
    } else if (data.commission_type === 'percentage' && data.amount_basis && data.percentage_rate) {
      data.commission_amount = (data.amount_basis * data.percentage_rate) / 100
    }

    const commission = await Commission.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('employee', 'employee_id full_name')
      .populate('user', 'full_name')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('external_broker', 'name company_name phone')
    if (!commission) return res.status(404).json({ message: 'Commission not found' })

    res.json(commission)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteCommission = async (req, res) => {
  try {
    const commission = await Commission.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!commission) return res.status(404).json({ message: 'Commission not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_commission',
      resource: 'Commission',
      resource_id: commission._id,
      description: `Commission deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Commission deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getCommissionsByEmployee = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, employee: req.params.employeeId, is_deleted: false }
    if (req.query.status) filter.status = req.query.status

    const commissions = await Commission.find(filter)
      .populate('employee', 'employee_id full_name')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('invoice', 'invoice_number total_amount')
      .populate('paid_by', 'full_name')
      .populate('payment_history.paid_by', 'full_name')
      .sort({ createdAt: -1 })

    const totals = await Commission.aggregate([
      { $match: { tenant: req.tenant._id, employee: req.params.employeeId, is_deleted: false } },
      { $group: { _id: '$status', total: { $sum: '$commission_amount' }, count: { $sum: 1 } } },
    ])

    res.json({ commissions, totals })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPendingCommissions = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, status: 'pending', is_deleted: false }

    const commissions = await Commission.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('user', 'full_name')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('invoice', 'invoice_number total_amount')
      .populate('paid_by', 'full_name')
      .populate('payment_history.paid_by', 'full_name')
      .sort({ createdAt: -1 })

    const totalPending = await Commission.aggregate([
      { $match: { tenant: req.tenant._id, status: 'pending', is_deleted: false } },
      { $group: { _id: null, total: { $sum: '$commission_amount' }, count: { $sum: 1 } } },
    ])

    res.json({ commissions, totalPending: totalPending[0]?.total || 0, count: totalPending[0]?.count || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const approveCommission = async (req, res) => {
  try {
    const commission = await Commission.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: 'pending' },
      { status: 'approved', approved_by: req.user._id, approved_at: new Date() },
      { new: true }
    )
      .populate('employee', 'employee_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
    if (!commission) return res.status(404).json({ message: 'Commission not found or already processed' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'approve_commission',
      resource: 'Commission',
      resource_id: commission._id,
      description: `Commission of ${commission.commission_amount} approved`,
      type: 'crud',
      severity: 'info',
    })

    res.json(commission)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const payCommission = async (req, res) => {
  try {
    const { payment_mode, reference, upi_id, notes, amount } = req.body

    const commission = await Commission.findOne(
      { _id: req.params.id, tenant: req.tenant._id, status: 'approved' }
    )
    if (!commission) return res.status(404).json({ message: 'Commission not found or not approved' })

    const payAmount = amount || commission.commission_amount

    const paymentEntry = {
      amount: payAmount,
      payment_mode: payment_mode || 'cash',
      reference: reference || '',
      upi_id: upi_id || '',
      paid_at: new Date(),
      paid_by: req.user._id,
      notes: notes || '',
      timestamp: new Date(),
    }

    commission.payment_history.push(paymentEntry)
    commission.status = 'paid'
    commission.paid_at = new Date()
    commission.payment_mode = payment_mode || 'cash'
    commission.upi_id = upi_id || ''
    commission.paid_by = req.user._id
    await commission.save()

    const populated = await Commission.findById(commission._id)
      .populate('employee', 'employee_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('paid_by', 'full_name')
      .populate('payment_history.paid_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'pay_commission',
      resource: 'Commission',
      resource_id: commission._id,
      description: `Commission of ${payAmount} paid via ${payment_mode || 'cash'}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const cancelCommission = async (req, res) => {
  try {
    const commission = await Commission.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    )
      .populate('employee', 'employee_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
    if (!commission) return res.status(404).json({ message: 'Commission not found or already processed' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'cancel_commission',
      resource: 'Commission',
      resource_id: commission._id,
      description: `Commission of ${commission.commission_amount} cancelled`,
      type: 'crud',
      severity: 'warning',
    })

    res.json(commission)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const calculateCommission = async (req, res) => {
  try {
    const { amount_basis, percentage_rate, commission_type, source } = req.body
    if (!amount_basis || !source) return res.status(400).json({ message: 'Amount basis and source are required' })

    let commission_amount = 0
    if (commission_type === 'percentage') {
      if (!percentage_rate) return res.status(400).json({ message: 'Percentage rate is required for percentage type' })
      commission_amount = (amount_basis * percentage_rate) / 100
    } else if (commission_type === 'fixed') {
      commission_amount = amount_basis
    }

    res.json({ commission_amount, amount_basis, percentage_rate, commission_type, source })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const requestCommission = async (req, res) => {
  try {
    const employee = await Employee.findOne({ tenant: req.tenant._id, user: req.user._id, is_deleted: false })
    if (!employee) return res.status(400).json({ message: 'No employee record linked to your account' })

    const data = {
      ...req.body,
      tenant: req.tenant._id,
      employee: employee._id,
      user: req.user._id,
      created_by: req.user._id,
      status: 'pending',
    }
    if (data.client_id) { data.client = data.client_id; delete data.client_id }
    if (data.property_id) { data.property = data.property_id; delete data.property_id }
    if (data.external_broker_id) { data.external_broker = data.external_broker_id; delete data.external_broker_id }
    if (data.commission_type === 'fixed') {
      data.commission_amount = data.commission_value || 0
    } else if (data.commission_type === 'percentage' && data.amount_basis && data.percentage_rate) {
      data.commission_amount = (data.amount_basis * data.percentage_rate) / 100
    }

    const commission = await Commission.create(data)
    const populated = await Commission.findById(commission._id)
      .populate('employee', 'employee_id full_name')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('external_broker', 'name company_name phone')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'request_commission',
      resource: 'Commission',
      resource_id: commission._id,
      description: `Commission of ${commission.commission_amount} requested by ${employee.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getMyCommissions = async (req, res) => {
  try {
    const employee = await Employee.findOne({ tenant: req.tenant._id, user: req.user._id, is_deleted: false })
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (employee) {
      filter.$or = [{ user: req.user._id }, { employee: employee._id }]
    } else {
      filter.user = req.user._id
    }
    if (req.query.status) filter.status = req.query.status

    const commissions = await Commission.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id flat_number tower project_name building_name society_name location city')
      .populate('invoice', 'invoice_number total_amount')
      .populate('paid_by', 'full_name')
      .populate('payment_history.paid_by', 'full_name')
      .populate('external_broker', 'name company_name phone')
      .sort({ createdAt: -1 })

    const matchStage = employee
      ? { $match: { tenant: req.tenant._id, is_deleted: false, $or: [{ user: req.user._id }, { employee: employee._id }] } }
      : { $match: { tenant: req.tenant._id, user: req.user._id, is_deleted: false } }

    const totals = await Commission.aggregate([
      matchStage,
      { $group: { _id: '$status', total: { $sum: '$commission_amount' }, count: { $sum: 1 } } },
    ])

    res.json({ commissions, totals })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
