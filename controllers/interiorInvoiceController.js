import InteriorInvoice from '../models/InteriorInvoice.js'
import InteriorProject from '../models/InteriorProject.js'
import ActivityLog from '../models/ActivityLog.js'

const tenantFilter = (req) => ({ tenant: req.tenant._id, is_deleted: false })

const calculateTotals = (data) => {
  if (data.sale_items && Array.isArray(data.sale_items)) {
    data.sale_items = data.sale_items.map((item) => ({
      ...item,
      amount: (item.quantity || 1) * (item.rate || 0),
    }))
    data.total_sale = data.sale_items.reduce((sum, item) => sum + item.amount, 0)
  }
  if (data.purchase_items && Array.isArray(data.purchase_items)) {
    data.purchase_items = data.purchase_items.map((item) => ({
      ...item,
      amount: (item.quantity || 1) * (item.rate || 0),
    }))
    data.total_purchase = data.purchase_items.reduce((sum, item) => sum + item.amount, 0)
  }
  if (data.expense_items && Array.isArray(data.expense_items)) {
    data.total_expense = data.expense_items.reduce((sum, item) => sum + item.amount, 0)
  }
  data.profit = (data.total_sale || 0) - (data.total_purchase || 0) - (data.total_expense || 0)
  data.due_amount = (data.total_sale || 0) - (data.paid_amount || 0)
  return data
}

export const createInteriorInvoice = async (req, res) => {
  try {
    const { invoice_number, interior_project } = req.body
    if (interior_project) {
      const project = await InteriorProject.findOne({ _id: interior_project, tenant: req.tenant._id })
      if (!project) return res.status(404).json({ message: 'Interior project not found' })
    }

    const generatedNumber = invoice_number || `INT-INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const data = calculateTotals({ ...req.body, invoice_number: generatedNumber, tenant: req.tenant._id })

    const invoice = await InteriorInvoice.create(data)
    const populated = await InteriorInvoice.findById(invoice._id)
      .populate('interior_project', 'title project_code')
      .populate('client', 'full_name phone')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_interior_invoice',
      resource: 'InteriorInvoice',
      resource_id: invoice._id,
      description: `Interior invoice ${invoice.invoice_number} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getInteriorInvoices = async (req, res) => {
  try {
    const filter = { ...tenantFilter(req) }
    if (req.query.status) filter.status = req.query.status
    if (req.query.interior_project) filter.interior_project = req.query.interior_project
    if (req.query.client) filter.client = req.query.client
    if (req.query.from_date || req.query.to_date) {
      filter.invoice_date = {}
      if (req.query.from_date) filter.invoice_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.invoice_date.$lte = new Date(req.query.to_date)
    }
    if (req.query.search) {
      filter.$or = [
        { invoice_number: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const invoices = await InteriorInvoice.find(filter)
      .populate('interior_project', 'title project_code')
      .populate('client', 'full_name phone')
      .sort({ createdAt: -1 })

    res.json(invoices)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getInteriorInvoiceById = async (req, res) => {
  try {
    const invoice = await InteriorInvoice.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('interior_project', 'title project_code status start_date expected_end_date')
      .populate('client', 'full_name phone email address')
    if (!invoice) return res.status(404).json({ message: 'Interior invoice not found' })
    res.json(invoice)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateInteriorInvoice = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.invoice_number
    delete data.is_deleted

    const calculated = calculateTotals(data)

    const invoice = await InteriorInvoice.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      calculated,
      { new: true, runValidators: true }
    )
      .populate('interior_project', 'title project_code')
      .populate('client', 'full_name phone')

    if (!invoice) return res.status(404).json({ message: 'Interior invoice not found' })
    res.json(invoice)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteInteriorInvoice = async (req, res) => {
  try {
    const invoice = await InteriorInvoice.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!invoice) return res.status(404).json({ message: 'Interior invoice not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_interior_invoice',
      resource: 'InteriorInvoice',
      resource_id: invoice._id,
      description: `Interior invoice ${invoice.invoice_number} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Interior invoice deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const markInteriorInvoicePaid = async (req, res) => {
  try {
    const { paid_amount, payment_mode } = req.body
    const invoice = await InteriorInvoice.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!invoice) return res.status(404).json({ message: 'Interior invoice not found' })

    const amount = paid_amount || invoice.due_amount
    invoice.paid_amount = (invoice.paid_amount || 0) + amount
    invoice.due_amount = invoice.total_sale - invoice.paid_amount
    invoice.payment_mode = payment_mode || invoice.payment_mode
    invoice.status = invoice.due_amount <= 0 ? 'paid' : 'partial'
    await invoice.save()

    const populated = await InteriorInvoice.findById(invoice._id)
      .populate('interior_project', 'title project_code')
      .populate('client', 'full_name phone')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'mark_interior_invoice_paid',
      resource: 'InteriorInvoice',
      resource_id: invoice._id,
      description: `Interior invoice ${invoice.invoice_number} marked paid`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const sendInteriorInvoice = async (req, res) => {
  try {
    const invoice = await InteriorInvoice.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req), status: 'draft' },
      { status: 'sent' },
      { new: true }
    )
    if (!invoice) return res.status(404).json({ message: 'Invoice not found or already sent' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'send_interior_invoice',
      resource: 'InteriorInvoice',
      resource_id: invoice._id,
      description: `Interior invoice ${invoice.invoice_number} sent`,
      type: 'crud',
      severity: 'info',
    })

    res.json(invoice)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getInteriorInvoicesByProject = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.projectId, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const invoices = await InteriorInvoice.find({ interior_project: req.params.projectId, ...tenantFilter(req) })
      .populate('interior_project', 'title project_code')
      .populate('client', 'full_name phone')
      .sort({ createdAt: -1 })

    res.json(invoices)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getInteriorInvoiceStats = async (req, res) => {
  try {
    const match = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.interior_project) match.interior_project = req.query.interior_project

    const stats = await InteriorInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_invoices: { $sum: 1 },
          total_sale: { $sum: '$total_sale' },
          total_purchase: { $sum: '$total_purchase' },
          total_expense: { $sum: '$total_expense' },
          total_profit: { $sum: '$profit' },
          total_paid: { $sum: '$paid_amount' },
          total_due: { $sum: '$due_amount' },
        },
      },
    ])

    const byStatus = await InteriorInvoice.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    res.json({
      ...(stats[0] || { total_invoices: 0, total_sale: 0, total_purchase: 0, total_expense: 0, total_profit: 0, total_paid: 0, total_due: 0 }),
      by_status: byStatus,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
