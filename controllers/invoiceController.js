import Invoice from '../models/Invoice.js'
import ActivityLog from '../models/ActivityLog.js'

export const createInvoice = async (req, res) => {
  try {
    const { invoice_number } = req.body
    const generatedNumber = invoice_number || `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const data = { ...req.body, invoice_number: generatedNumber, tenant: req.tenant._id }
    if (data.client_id && !data.client) data.client = data.client_id
    delete data.client_id
    if (data.property_id && !data.property) data.property = data.property_id
    delete data.property_id
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map((item) => ({
        ...item,
        amount: (item.quantity || 1) * (item.rate || 0),
      }))
      data.subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
    }
    if (data.subtotal && data.tax_percentage) data.tax_amount = (data.subtotal * data.tax_percentage) / 100
    data.total_amount = (data.subtotal || 0) + (data.tax_amount || 0) - (data.discount_amount || 0)
    data.due_amount = data.total_amount - (data.paid_amount || 0)

    const invoice = await Invoice.create(data)
    const populated = await Invoice.findById(invoice._id)
      .populate('client', 'client_id full_name mobile email')
      .populate('property', 'property_id location')
      .populate('project', 'project_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_invoice',
      resource: 'Invoice',
      resource_id: invoice._id,
      description: `Invoice ${invoice.invoice_number} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getInvoices = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.client_id) filter.client = req.query.client_id
    if (req.query.client) filter.client = req.query.client
    if (req.query.invoice_type) filter.invoice_type = req.query.invoice_type
    if (req.query.property) filter.property = req.query.property
    if (req.query.from_date || req.query.to_date) {
      filter.issue_date = {}
      if (req.query.from_date) filter.issue_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.issue_date.$lte = new Date(req.query.to_date)
    }
    if (req.query.search) {
      filter.$or = [
        { invoice_number: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const invoices = await Invoice.find(filter)
      .populate('client', 'client_id full_name mobile')
      .populate('property', 'property_id location')
      .populate('project', 'project_name')
      .sort({ createdAt: -1 })

    res.json(invoices)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('client', 'client_id full_name mobile email address')
      .populate('property', 'property_id location property_type')
      .populate('project', 'project_name location')
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })
    res.json(invoice)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateInvoice = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.invoice_number
    delete data.is_deleted
    if (data.client_id && !data.client) data.client = data.client_id
    delete data.client_id
    if (data.property_id && !data.property) data.property = data.property_id
    delete data.property_id

    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map((item) => ({
        ...item,
        amount: (item.quantity || 1) * (item.rate || 0),
      }))
      data.subtotal = data.items.reduce((sum, item) => sum + item.amount, 0)
    }
    if (data.subtotal && data.tax_percentage) data.tax_amount = (data.subtotal * data.tax_percentage) / 100
    if (data.subtotal !== undefined || data.tax_amount !== undefined || data.discount_amount !== undefined) {
      data.total_amount = (data.subtotal || 0) + (data.tax_amount || 0) - (data.discount_amount || 0)
      data.due_amount = data.total_amount - (data.paid_amount || 0)
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('client', 'client_id full_name mobile')
      .populate('property', 'property_id location')

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    res.json(invoice)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_invoice',
      resource: 'Invoice',
      resource_id: invoice._id,
      description: `Invoice ${invoice.invoice_number} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Invoice deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generatePdf = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('client', 'client_id full_name mobile email address city state pincode')
      .populate('property', 'property_id location')
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ margin: 50 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.pdf"`)
    doc.pipe(res)

    const company = req.tenant || {}
    doc.fontSize(20).text(company.company_name || 'Shivam International', { align: 'center' })
    doc.fontSize(10).text('Real Estate & Interior Solutions', { align: 'center' })
    doc.fontSize(8).text(company.company_address || 'F-2 G001, Amrapali Terrace Homes, Techzone-4, Greater Noida West, Gautam Buddha Nagar, Uttar Pradesh – 201308, India', { align: 'center' })
    doc.fontSize(8).text(company.company_phone || '+91 98991 46931 | 9891075835', { align: 'center' })
    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke()
    doc.moveDown()

    doc.fontSize(16).text('INVOICE', { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text(`Invoice #: ${invoice.invoice_number}`)
    doc.text(`Issue Date: ${new Date(invoice.issue_date).toLocaleDateString()}`)
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`)
    doc.text(`Status: ${invoice.status}`)
    doc.moveDown()

    doc.fontSize(14).text('Client Details')
    doc.fontSize(11).text(`Name: ${invoice.client?.full_name}`)
    doc.text(`Email: ${invoice.client?.email}`)
    doc.text(`Mobile: ${invoice.client?.mobile}`)
    doc.moveDown()

    doc.fontSize(14).text('Items')
    doc.fontSize(10)
    invoice.items.forEach((item, i) => {
      doc.text(`${i + 1}. ${item.description} - ${item.quantity} x ${item.rate} = ${item.amount}`)
    })
    doc.moveDown()
    doc.fontSize(12).text(`Subtotal: ${invoice.subtotal}`)
    if (invoice.tax_amount) doc.text(`Tax: ${invoice.tax_amount}`)
    if (invoice.discount_amount) doc.text(`Discount: ${invoice.discount_amount}`)
    doc.fontSize(14).text(`Total: ${invoice.total_amount}`, { underline: true })

    doc.end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: 'draft' },
      { status: 'sent' },
      { new: true }
    )
    if (!invoice) return res.status(404).json({ message: 'Invoice not found or already sent' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'send_invoice',
      resource: 'Invoice',
      resource_id: invoice._id,
      description: `Invoice ${invoice.invoice_number} sent`,
      type: 'crud',
      severity: 'info',
    })

    res.json(invoice)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const markPaid = async (req, res) => {
  try {
    const { paid_amount, payment_mode } = req.body
    const invoice = await Invoice.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    const amount = paid_amount || invoice.due_amount
    invoice.paid_amount = (invoice.paid_amount || 0) + amount
    invoice.due_amount = invoice.total_amount - invoice.paid_amount
    invoice.payment_mode = payment_mode || invoice.payment_mode
    invoice.status = invoice.due_amount <= 0 ? 'paid' : 'partial'
    await invoice.save()

    const populated = await Invoice.findById(invoice._id)
      .populate('client', 'client_id full_name mobile')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'mark_invoice_paid',
      resource: 'Invoice',
      resource_id: invoice._id,
      description: `Invoice ${invoice.invoice_number} marked paid`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const markOverdue = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: { $in: ['sent', 'partial'] } },
      { status: 'overdue' },
      { new: true }
    )
    if (!invoice) return res.status(404).json({ message: 'Invoice not found or cannot be marked overdue' })

    res.json(invoice)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
