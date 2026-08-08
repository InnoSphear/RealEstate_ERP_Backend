import Payment from '../models/Payment.js'
import Client from '../models/Client.js'
import Invoice from '../models/Invoice.js'
import ActivityLog from '../models/ActivityLog.js'
import Tenant from '../models/Tenant.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

const addTimelineEntry = (payment, action, user, description, extra = {}) => {
  payment.timeline.push({
    action,
    status: payment.status,
    amount: payment.amount,
    payment_mode: payment.payment_mode,
    changed_by: user._id,
    changed_by_name: user.full_name,
    description,
    createdAt: new Date(),
    ...extra,
  })
}

const updateInvoiceBalance = async (invoiceId) => {
  const inv = await Invoice.findOne({ _id: invoiceId, is_deleted: false })
  if (!inv) return
  const totalPaid = (await Payment.aggregate([
    { $match: { invoice: inv._id, status: { $in: ['completed', 'pending'] }, is_deleted: false } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]))[0]?.total || 0
  inv.paid_amount = totalPaid
  inv.due_amount = inv.total_amount - totalPaid
  if (inv.due_amount <= 0) inv.status = 'paid'
  else if (totalPaid > 0) inv.status = 'partial'
  else inv.status = 'sent'
  await inv.save()
}

export const createPayment = async (req, res) => {
  try {
    const payment_number = req.body.payment_number || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const receipt_number = `RCPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const data = { ...req.body, payment_number, receipt_number, tenant: req.tenant._id }
    data.amount = Number(data.amount) || 0
    data.security_deposit = Number(data.security_deposit) || 0
    data.brokerage = Number(data.brokerage) || 0

    if (Object.prototype.hasOwnProperty.call(req.body, 'paid_amount')) {
      data.total_amount = Number(data.total_amount) || data.amount || 0
      data.paid_amount = Number(data.paid_amount) || 0
      if (data.paid_amount > data.total_amount) data.paid_amount = data.total_amount
      data.amount = data.total_amount
      data.payment_status = data.paid_amount >= data.total_amount ? 'paid' : 'due'
      data.status = data.paid_amount >= data.total_amount ? 'completed' : 'pending'
    } else {
      data.paid_amount = data.payment_status === 'paid' ? data.amount : 0
    }

    if (data.invoice_id && !data.invoice) data.invoice = data.invoice_id
    delete data.invoice_id
    if (data.client_id && !data.client) data.client = data.client_id
    delete data.client_id

    if (data.invoice) {
      const invoice = await Invoice.findOne({ _id: data.invoice, is_deleted: false })
      if (invoice) {
        if (!data.client) data.client = invoice.client
      }
    }
    if (!data.processed_by) data.processed_by = req.user._id
    data.created_by = req.user._id

    const prevCount = await Payment.countDocuments({ client: data.client, tenant: req.tenant._id, is_deleted: false })
    data.payment_sequence = prevCount + 1

    if (data.payment_status === 'due' && !data.paid_amount) {
      data.payment_mode = undefined
      data.status = 'pending'
    }

    const payment = await Payment.create(data)
    let desc = `Payment of ₹${payment.amount} created`
    if (payment.payment_status === 'due') {
      desc += ' (Due)'
    } else {
      desc += ` via ${payment.payment_mode?.replace(/_/g, ' ') || 'N/A'}`
    }
    if (payment.payment_reason) desc += ` | ${payment.payment_reason}`
    if (payment.utr_number) desc += ` | UTR: ${payment.utr_number}`
    if (payment.purchaser_name) desc += ` | Payer: ${payment.purchaser_name}`
    addTimelineEntry(payment, 'created', req.user, desc)
    await payment.save()
    if (payment.invoice) await updateInvoiceBalance(payment.invoice)

    const populated = await Payment.findById(payment._id)
      .populate('invoice', 'invoice_number total_amount due_amount')
      .populate('client', 'client_id full_name mobile email')
      .populate('processed_by', 'full_name')
      .populate('created_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_payment',
      resource: 'Payment',
      resource_id: payment._id,
      description: `Payment ${payment.payment_number} of ${payment.amount} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getPayments = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.invoice) filter.invoice = req.query.invoice
    if (req.query.invoice_id) filter.invoice = req.query.invoice_id
    if (req.query.client) filter.client = req.query.client
    if (req.query.client_id) filter.client = req.query.client_id
    if (req.query.status) filter.status = req.query.status
    if (req.query.payment_mode) filter.payment_mode = req.query.payment_mode
    if (req.query.from_date || req.query.to_date) {
      filter.payment_date = {}
      if (req.query.from_date) filter.payment_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.payment_date.$lte = new Date(req.query.to_date)
    }

    const payments = await Payment.find(filter)
      .populate('invoice', 'invoice_number total_amount due_amount')
      .populate('client', 'client_id full_name mobile email')
      .populate('processed_by', 'full_name')
      .sort({ createdAt: -1 })

    res.json(payments)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('invoice', 'invoice_number total_amount due_amount')
      .populate('client', 'client_id full_name mobile email')
      .populate('processed_by', 'full_name')
    if (!payment) return res.status(404).json({ message: 'Payment not found' })
    res.json(payment)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updatePayment = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.payment_number
    delete data.is_deleted
    delete data.timeline
    if (data.amount !== undefined) data.amount = Number(data.amount) || 0
    if (Object.prototype.hasOwnProperty.call(req.body, 'paid_amount')) {
      data.paid_amount = Number(data.paid_amount) || 0
      data.total_amount = Number(data.total_amount) || data.amount || 0
      if (data.paid_amount > data.total_amount) data.paid_amount = data.total_amount
      data.amount = data.total_amount
      data.payment_status = data.paid_amount >= data.total_amount ? 'paid' : 'due'
      if (data.paid_amount >= data.total_amount) data.status = 'completed'
      else if (data.paid_amount > 0) data.status = 'pending'
    }
    if (data.client_id && !data.client) data.client = data.client_id
    delete data.client_id
    if (data.invoice_id && !data.invoice) data.invoice = data.invoice_id
    delete data.invoice_id

    const prev = await Payment.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!prev) return res.status(404).json({ message: 'Payment not found' })

    if (data.status && data.status !== prev.status) {
      addTimelineEntry(prev, 'status_changed', req.user, `Status changed from ${prev.status} to ${data.status}`)
    }
    if (data.payment_status && data.payment_status !== prev.payment_status) {
      addTimelineEntry(prev, 'status_changed', req.user, `Payment status changed from ${prev.payment_status || 'due'} to ${data.payment_status}`)
    }
    if (data.amount !== undefined && data.amount !== prev.amount) {
      addTimelineEntry(prev, 'amount_changed', req.user, `Amount changed from ₹${prev.amount} to ₹${data.amount}`, { amount: data.amount })
    }
    if (data.payment_mode && data.payment_mode !== prev.payment_mode) {
      addTimelineEntry(prev, 'mode_changed', req.user, `Payment mode changed from ${(prev.payment_mode || '').replace(/_/g, ' ')} to ${data.payment_mode.replace(/_/g, ' ')}`, { payment_mode: data.payment_mode })
    }
    if (data.notes && data.notes !== prev.notes) {
      addTimelineEntry(prev, 'notes_updated', req.user, 'Notes updated')
    }
    if (data.purchaser_name && data.purchaser_name !== prev.purchaser_name) {
      addTimelineEntry(prev, 'payer_updated', req.user, `Payer name changed to ${data.purchaser_name}`)
    }
    if (data.utr_number && data.utr_number !== prev.utr_number) {
      addTimelineEntry(prev, 'utr_updated', req.user, `UTR updated to ${data.utr_number}`)
    }

    if (data.payment_status === 'due') {
      data.status = 'pending'
      data.payment_mode = undefined
    } else if (data.payment_status === 'paid' && prev.payment_status === 'due') {
      data.status = 'completed'
    }

    Object.assign(prev, data)
    await prev.save()

    if (prev.invoice) await updateInvoiceBalance(prev.invoice)

    const populated = await Payment.findById(prev._id)
      .populate('invoice', 'invoice_number total_amount due_amount')
      .populate('client', 'client_id full_name mobile email')
      .populate('processed_by', 'full_name')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!payment) return res.status(404).json({ message: 'Payment not found' })

    payment.is_deleted = true
    payment.deleted_at = new Date()
    payment.deleted_by = req.user._id
    await payment.save()

    if (payment.invoice) await updateInvoiceBalance(payment.invoice)

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_payment',
      resource: 'Payment',
      resource_id: payment._id,
      description: `Payment ${payment.payment_number} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Payment deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPaymentsByInvoice = async (req, res) => {
  try {
    const payments = await Payment.find({
      tenant: req.tenant._id,
      invoice: req.params.invoiceId,
      is_deleted: false,
    })
      .populate('client', 'client_id full_name mobile')
      .populate('processed_by', 'full_name')
      .sort({ createdAt: -1 })

    const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'completed' ? p.amount : 0), 0)
    res.json({ payments, totalPaid })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPaymentsByClient = async (req, res) => {
  try {
    const payments = await Payment.find({
      tenant: req.tenant._id,
      client: req.params.clientId,
      is_deleted: false,
    })
      .populate('invoice', 'invoice_number total_amount')
      .populate('processed_by', 'full_name')
      .sort({ createdAt: -1 })

    res.json(payments)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadReceipt = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    const payment = await Payment.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!payment) return res.status(404).json({ message: 'Payment not found' })

    const result = await uploadToCloudinary(req.file.buffer, { folder: 'realestate_erp/receipts' })

    payment.receipt_screenshot = result.url
    payment.receipt_public_id = result.public_id
    addTimelineEntry(payment, 'receipt_uploaded', req.user, 'Receipt screenshot uploaded')
    await payment.save()

    res.json({ url: result.url, public_id: result.public_id })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPaymentReceipt = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('client', 'full_name mobile email address')
      .populate('processed_by', 'full_name')
      .populate('created_by', 'full_name')
    if (!payment) return res.status(404).json({ message: 'Payment not found' })

    const tenant = await Tenant.findById(req.tenant._id).select('company_name company_logo company_phone company_address')

    res.json({ payment, tenant })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const receivePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!payment) return res.status(404).json({ message: 'Payment not found' })

    const received = Number(req.body.paid_amount) || 0
    if (received <= 0) return res.status(400).json({ message: 'Received amount must be greater than 0' })

    payment.total_amount = payment.total_amount || payment.amount || 0
    payment.amount = payment.total_amount
    payment.paid_amount = (payment.paid_amount || 0) + received
    if (payment.paid_amount > payment.total_amount) payment.paid_amount = payment.total_amount

    if (req.body.payment_mode) payment.payment_mode = req.body.payment_mode
    if (req.body.reference_number) payment.reference_number = req.body.reference_number
    if (req.body.utr_number) payment.utr_number = req.body.utr_number
    if (req.body.paid_by) payment.paid_by = req.body.paid_by
    if (req.body.purchaser_name) payment.purchaser_name = req.body.purchaser_name
    if (req.body.credited_to) payment.credited_to = req.body.credited_to
    if (req.body.remarks) payment.remarks = req.body.remarks
    if (req.body.payment_date) payment.payment_date = new Date(req.body.payment_date)

    payment.payment_status = payment.paid_amount >= payment.total_amount ? 'paid' : 'due'
    payment.status = payment.paid_amount >= payment.total_amount ? 'completed' : 'pending'

    addTimelineEntry(payment, 'amount_received', req.user, `₹${received} received. Total received ₹${payment.paid_amount} of ₹${payment.total_amount}`, { amount: received })
    await payment.save()

    if (payment.invoice) await updateInvoiceBalance(payment.invoice)

    const populated = await Payment.findById(payment._id)
      .populate('invoice', 'invoice_number total_amount due_amount')
      .populate('client', 'client_id full_name mobile email')
      .populate('processed_by', 'full_name')
      .populate('created_by', 'full_name')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getClientBill = async (req, res) => {
  try {
    const clientId = req.params.clientId
    const client = await Client.findOne({ _id: clientId, tenant: req.tenant._id, is_deleted: false })
    if (!client) return res.status(404).json({ message: 'Client not found' })

    const payments = await Payment.find({
      tenant: req.tenant._id,
      client: clientId,
      is_deleted: false,
    })
      .populate('processed_by', 'full_name')
      .populate('created_by', 'full_name')
      .sort({ createdAt: -1 })

    const billedFor = (p) => {
      const isPaid = p.payment_status === 'paid' || p.status === 'completed'
      const paid = p.paid_amount != null ? p.paid_amount : (isPaid ? (p.amount || 0) : 0)
      if (p.total_amount != null) {
        if (isPaid && paid >= p.total_amount) return 0
        return p.total_amount
      }
      return isPaid ? 0 : (p.amount || 0)
    }
    const paidFor = (p) => (p.paid_amount != null ? p.paid_amount : ((p.payment_status === 'paid' || p.status === 'completed') ? (p.amount || 0) : 0))
    let totalAmount = payments.reduce((s, p) => s + (billedFor(p) || 0), 0)
    const totalPaid = payments.reduce((s, p) => s + (paidFor(p) || 0), 0)
    if (totalAmount === 0) totalAmount = totalPaid
    const totalDue = Math.max(0, totalAmount - totalPaid)
    const balance = totalDue

    const tenant = await Tenant.findById(req.tenant._id).select('company_name company_logo company_phone company_address')

    res.json({
      client,
      payments,
      summary: { totalAmount, totalPaid, totalDue, balance },
      tenant,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPaymentReasons = async (req, res) => {
  const reasons = [
    'Welcome Charge',
    'Security Deposit',
    'Token/Advance',
    'Rent',
    'Police Verification Charge',
    'Rent Agreement Charge',
    'Documents',
    'Brokerage',
    'Others',
  ]
  res.json(reasons)
}
