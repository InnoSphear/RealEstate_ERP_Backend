import Vendor from '../models/Vendor.js'
import ActivityLog from '../models/ActivityLog.js'

const recalcTotals = (vendor) => {
  vendor.total_purchased = vendor.purchases.reduce((sum, p) => sum + (p.amount || 0), 0)
  vendor.total_paid = vendor.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  vendor.total_due = vendor.total_purchased - vendor.total_paid
  vendor.payment_status = vendor.total_due <= 0 ? 'paid' : vendor.total_paid > 0 ? 'partial' : 'credit'
}

export const createVendor = async (req, res) => {
  try {
    const vendor = await Vendor.create({ ...req.body, tenant: req.tenant._id })
    const populated = await Vendor.findById(vendor._id)

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'create_vendor', resource: 'Vendor',
      resource_id: vendor._id,
      description: `Vendor ${vendor.name} created`,
      type: 'crud', severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getVendors = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.category) filter.category = req.query.category
    if (req.query.payment_status) filter.payment_status = req.query.payment_status
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { contact_person: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
        { gst: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const vendors = await Vendor.find(filter)
      .populate('purchases.property', 'property_id location')
      .populate('purchases.project', 'name project_id')
      .sort({ createdAt: -1 })
    res.json(vendors)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('purchases.property', 'property_id location')
      .populate('purchases.project', 'name project_id')
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })
    res.json(vendor)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateVendor = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    delete data.purchases
    delete data.payments

    const vendor = await Vendor.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })

    Object.assign(vendor, data)
    await vendor.save()

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'update_vendor', resource: 'Vendor',
      resource_id: vendor._id,
      description: `Vendor ${vendor.name} updated`,
      type: 'crud', severity: 'info',
    })

    const populated = await Vendor.findById(vendor._id)
      .populate('purchases.property', 'property_id location')
      .populate('purchases.project', 'name project_id')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndDelete(
      { _id: req.params.id, tenant: req.tenant._id }
    )
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_vendor', resource: 'Vendor',
      resource_id: vendor._id,
      description: `Vendor ${vendor.name} deleted`,
      type: 'crud', severity: 'warning',
    })

    res.json({ message: 'Vendor deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addPurchase = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })

    const { item_name, quantity, rate, amount, purchase_date, property, project, notes } = req.body
    if (!item_name || !rate || !amount) return res.status(400).json({ message: 'Item name, rate and amount are required' })

    vendor.purchases.push({ item_name, quantity: quantity || 1, rate, amount, purchase_date, property, project, notes })
    recalcTotals(vendor)
    await vendor.save()

    const populated = await Vendor.findById(vendor._id)
      .populate('purchases.property', 'property_id location')
      .populate('purchases.project', 'name project_id')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const addPayment = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })

    const { amount, payment_date, payment_mode, reference, notes } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid payment amount is required' })

    vendor.payments.push({ amount, payment_date, payment_mode, reference, notes })
    recalcTotals(vendor)
    await vendor.save()

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'vendor_payment', resource: 'Vendor',
      resource_id: vendor._id,
      description: `Payment of ₹${amount} recorded for vendor ${vendor.name}`,
      type: 'crud', severity: 'info',
    })

    const populated = await Vendor.findById(vendor._id)
      .populate('purchases.property', 'property_id location')
      .populate('purchases.project', 'name project_id')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getVendorStats = async (req, res) => {
  try {
    const match = { tenant: req.tenant._id, is_deleted: false }
    const stats = await Vendor.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_vendors: { $sum: 1 },
          total_purchased: { $sum: '$total_purchased' },
          total_paid: { $sum: '$total_paid' },
          total_due: { $sum: '$total_due' },
          credit_count: { $sum: { $cond: [{ $eq: ['$payment_status', 'credit'] }, 1, 0] } },
          partial_count: { $sum: { $cond: [{ $eq: ['$payment_status', 'partial'] }, 1, 0] } },
          paid_count: { $sum: { $cond: [{ $eq: ['$payment_status', 'paid'] }, 1, 0] } },
        },
      },
    ])
    res.json(stats[0] || { total_vendors: 0, total_purchased: 0, total_paid: 0, total_due: 0, credit_count: 0, partial_count: 0, paid_count: 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
