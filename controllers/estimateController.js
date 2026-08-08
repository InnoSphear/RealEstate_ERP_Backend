import Estimate from '../models/Estimate.js'
import InteriorProject from '../models/InteriorProject.js'
import ActivityLog from '../models/ActivityLog.js'
import Tenant from '../models/Tenant.js'

const tenantFilter = (req) => ({ tenant: req.tenant._id, is_deleted: false })

export const getEstimates = async (req, res) => {
  try {
    const filter = { ...tenantFilter(req) }
    if (req.query.project) filter.project = req.query.project
    if (req.query.client) filter.client = req.query.client
    if (req.query.lead) filter.lead = req.query.lead
    if (req.query.status) filter.status = req.query.status
    const estimates = await Estimate.find(filter)
      .populate('client', 'full_name phone email')
      .populate('lead', 'full_name mobile email')
      .populate('project', 'title project_code')
      .populate('created_by', 'full_name')
      .sort({ createdAt: -1 })
    res.json(estimates)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getEstimateById = async (req, res) => {
  try {
    const estimate = await Estimate.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('client', 'full_name phone email address')
      .populate('lead', 'full_name mobile email')
      .populate('project', 'title project_code flat_id')
      .populate('created_by', 'full_name')
    if (!estimate) return res.status(404).json({ message: 'Estimate not found' })
    const tenant = await Tenant.findById(req.tenant._id).select('company_name company_logo company_phone company_address')
    res.json({ ...estimate.toObject(), tenantData: tenant })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const createEstimate = async (req, res) => {
  try {
    const { project, client, lead, full_name, mobile, email, title, instructions, delivery_terms, valid_until, items, tax_percent, discount, notes } = req.body

    const count = await Estimate.countDocuments({ tenant: req.tenant._id })
    const estimate_number = `EST-${String(count + 1).padStart(4, '0')}`

    const processedItems = (items || []).map((i) => ({
      item_name: i.item_name,
      description: i.description || '',
      quantity: Number(i.quantity) || 1,
      unit: i.unit || 'pcs',
      rate: Number(i.rate) || 0,
      amount: (Number(i.quantity) || 1) * (Number(i.rate) || 0),
      delivery_time: i.delivery_time || '',
    }))

    const tenant = await Tenant.findById(req.tenant._id)
    const estimate = await Estimate.create({
      tenant: req.tenant._id,
      project: project || undefined,
      client: client || undefined,
      lead: lead || undefined,
      full_name: full_name || '',
      mobile: mobile || '',
      email: email || '',
      estimate_number,
      title: title || '',
      instructions: instructions || '',
      delivery_terms: delivery_terms || '',
      valid_until: valid_until || undefined,
      items: processedItems,
      tax_percent: Number(tax_percent) || 0,
      discount: Number(discount) || 0,
      notes: notes || '',
      created_by: req.user._id,
      created_by_name: req.user.full_name || '',
      company_logo: tenant?.company_logo || '',
      company_phone: tenant?.company_phone || '',
      company_address: tenant?.company_address || '',
    })

    const populated = await Estimate.findById(estimate._id)
      .populate('client', 'full_name phone email')
      .populate('lead', 'full_name mobile email')
      .populate('project', 'title project_code')
      .populate('created_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'create_estimate', resource: 'Estimate',
      resource_id: estimate._id,
      description: `Estimate ${estimate_number} created`,
      type: 'crud', severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const updateEstimate = async (req, res) => {
  try {
    const estimate = await Estimate.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!estimate) return res.status(404).json({ message: 'Estimate not found' })

    const { lead, full_name, mobile, email, title, instructions, delivery_terms, valid_until, items, tax_percent, discount, notes, status } = req.body

    if (lead !== undefined) estimate.lead = lead
    if (full_name !== undefined) estimate.full_name = full_name
    if (mobile !== undefined) estimate.mobile = mobile
    if (email !== undefined) estimate.email = email
    if (title !== undefined) estimate.title = title
    if (instructions !== undefined) estimate.instructions = instructions
    if (delivery_terms !== undefined) estimate.delivery_terms = delivery_terms
    if (valid_until !== undefined) estimate.valid_until = valid_until
    if (tax_percent !== undefined) estimate.tax_percent = Number(tax_percent)
    if (discount !== undefined) estimate.discount = Number(discount)
    if (notes !== undefined) estimate.notes = notes
    if (status !== undefined) estimate.status = status

    if (items !== undefined) {
      estimate.items = items.map((i) => ({
        item_name: i.item_name,
        description: i.description || '',
        quantity: Number(i.quantity) || 1,
        unit: i.unit || 'pcs',
        rate: Number(i.rate) || 0,
        amount: (Number(i.quantity) || 1) * (Number(i.rate) || 0),
        delivery_time: i.delivery_time || '',
      }))
    }

    await estimate.save()

    const populated = await Estimate.findById(estimate._id)
      .populate('client', 'full_name phone email')
      .populate('lead', 'full_name mobile email')
      .populate('project', 'title project_code')
      .populate('created_by', 'full_name')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteEstimate = async (req, res) => {
  try {
    const estimate = await Estimate.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!estimate) return res.status(404).json({ message: 'Estimate not found' })
    res.json({ message: 'Estimate deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
