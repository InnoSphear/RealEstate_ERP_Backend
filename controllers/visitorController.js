import Visitor from '../models/Visitor.js'
import ActivityLog from '../models/ActivityLog.js'

export const createVisitor = async (req, res) => {
  try {
    const { visitor_name, mobile } = req.body
    if (!visitor_name || !mobile) return res.status(400).json({ message: 'Visitor name and mobile are required' })

    const visitor = await Visitor.create({ ...req.body, tenant: req.tenant._id })
    const populated = await Visitor.findById(visitor._id)
      .populate('interested_property', 'property_id location')
      .populate('assigned_staff', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_visitor',
      resource: 'Visitor',
      resource_id: visitor._id,
      description: `Visitor ${visitor.visitor_name} checked in`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getVisitors = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.type) filter.type = req.query.type
    if (req.query.assigned_staff) filter.assigned_staff = req.query.assigned_staff
    if (req.query.converted_to_lead !== undefined) filter.converted_to_lead = req.query.converted_to_lead === 'true'
    if (req.query.from_date || req.query.to_date || req.query.date_from || req.query.date_to) {
      filter.check_in = {}
      const fromDate = req.query.from_date || req.query.date_from
      const toDate = req.query.to_date || req.query.date_to
      if (fromDate) filter.check_in.$gte = new Date(fromDate)
      if (toDate) filter.check_in.$lte = new Date(toDate)
    }
    if (req.query.search) {
      filter.$or = [
        { visitor_name: { $regex: req.query.search, $options: 'i' } },
        { mobile: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { purpose: { $regex: req.query.search, $options: 'i' } },
        { notes: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const visitors = await Visitor.find(filter)
      .populate('interested_property', 'property_id location')
      .populate('assigned_staff', 'full_name')
      .populate('converted_lead', 'full_name')
      .sort({ check_in: -1 })

    res.json(visitors)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getVisitorById = async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('interested_property', 'property_id location property_type')
      .populate('assigned_staff', 'full_name email phone')
      .populate('converted_lead', 'full_name')
    if (!visitor) return res.status(404).json({ message: 'Visitor not found' })
    res.json(visitor)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateVisitor = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted

    const visitor = await Visitor.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('interested_property', 'property_id location')
      .populate('assigned_staff', 'full_name')
    if (!visitor) return res.status(404).json({ message: 'Visitor not found' })

    res.json(visitor)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const checkOutVisitor = async (req, res) => {
  try {
    const { notes } = req.body
    const visitor = await Visitor.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false, check_out: null },
      { check_out: new Date(), notes: notes || undefined },
      { new: true }
    )
      .populate('interested_property', 'property_id location')
      .populate('assigned_staff', 'full_name')
    if (!visitor) return res.status(404).json({ message: 'Visitor not found or already checked out' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'checkout_visitor',
      resource: 'Visitor',
      resource_id: visitor._id,
      description: `Visitor ${visitor.visitor_name} checked out`,
      type: 'crud',
      severity: 'info',
    })

    res.json(visitor)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const convertToLead = async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!visitor) return res.status(404).json({ message: 'Visitor not found' })
    if (visitor.converted_to_lead) return res.status(400).json({ message: 'Visitor already converted to lead' })

    const Lead = (await import('../models/Lead.js')).default
    const lead = await Lead.create({
      tenant: visitor.tenant,
      full_name: visitor.visitor_name,
      mobile: visitor.mobile,
      email: visitor.email,
      source: 'walk_in',
      assigned_to: visitor.assigned_staff,
      notes: visitor.notes,
      status: 'new',
    })

    visitor.converted_to_lead = true
    visitor.converted_lead = lead._id
    await visitor.save()

    const populatedLead = await Lead.findById(lead._id).populate('assigned_to', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'convert_visitor_to_lead',
      resource: 'Visitor',
      resource_id: visitor._id,
      description: `Visitor ${visitor.visitor_name} converted to lead`,
      type: 'crud',
      severity: 'info',
    })

    res.json({ visitor, lead: populatedLead })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
