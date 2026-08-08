import Tenant from '../models/Tenant.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'

export const createTenant = async (req, res) => {
  try {
    const existing = await Tenant.findOne({ company_email: req.body.company_email })
    if (existing) return res.status(400).json({ message: 'A tenant with this email already exists' })

    const tenant = await Tenant.create(req.body)

    await ActivityLog.create({
      tenant: tenant._id,
      user: req.user?._id,
      action: 'create_tenant',
      resource: 'Tenant',
      resource_id: tenant._id,
      description: `Tenant ${tenant.company_name} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(tenant)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getTenants = async (req, res) => {
  try {
    const filter = { is_deleted: false }
    if (req.query.search) {
      filter.$or = [
        { company_name: { $regex: req.query.search, $options: 'i' } },
        { company_email: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    if (req.query.subscription_plan) filter.subscription_plan = req.query.subscription_plan
    if (req.query.subscription_status) filter.subscription_status = req.query.subscription_status
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active === 'true'

    const tenants = await Tenant.find(filter).sort({ createdAt: -1 })
    res.json(tenants)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
    if (!tenant || tenant.is_deleted) return res.status(404).json({ message: 'Tenant not found' })
    res.json(tenant)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!tenant || tenant.is_deleted) return res.status(404).json({ message: 'Tenant not found' })

    await ActivityLog.create({
      tenant: tenant._id,
      user: req.user?._id,
      action: 'update_tenant',
      resource: 'Tenant',
      resource_id: tenant._id,
      description: `Tenant ${tenant.company_name} updated`,
      type: 'crud',
      severity: 'info',
      details: req.body,
    })

    res.json(tenant)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndDelete({ _id: req.params.id })
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' })

    await User.updateMany({ tenant: tenant._id }, { is_active: false })

    await ActivityLog.create({
      tenant: tenant._id,
      user: req.user?._id,
      action: 'delete_tenant',
      resource: 'Tenant',
      resource_id: tenant._id,
      description: `Tenant ${tenant.company_name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Tenant deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateSubscription = async (req, res) => {
  try {
    const { subscription_plan, subscription_status, subscription_start, subscription_end } = req.body
    const tenant = await Tenant.findById(req.params.id)
    if (!tenant || tenant.is_deleted) return res.status(404).json({ message: 'Tenant not found' })

    if (subscription_plan) tenant.subscription_plan = subscription_plan
    if (subscription_status) tenant.subscription_status = subscription_status
    if (subscription_start) tenant.subscription_start = subscription_start
    if (subscription_end) tenant.subscription_end = subscription_end
    await tenant.save()

    await ActivityLog.create({
      tenant: tenant._id,
      user: req.user?._id,
      action: 'update_subscription',
      resource: 'Tenant',
      resource_id: tenant._id,
      description: `Subscription updated for ${tenant.company_name} to ${subscription_plan}`,
      type: 'crud',
      severity: 'info',
      details: req.body,
    })

    res.json(tenant)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const updateLimits = async (req, res) => {
  try {
    const { max_users, max_properties, max_projects, storage_limit_mb } = req.body
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { max_users, max_properties, max_projects, storage_limit_mb },
      { new: true, runValidators: true }
    )
    if (!tenant || tenant.is_deleted) return res.status(404).json({ message: 'Tenant not found' })

    await ActivityLog.create({
      tenant: tenant._id,
      user: req.user?._id,
      action: 'update_limits',
      resource: 'Tenant',
      resource_id: tenant._id,
      description: `Limits updated for ${tenant.company_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(tenant)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getTenantStats = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
    if (!tenant || tenant.is_deleted) return res.status(404).json({ message: 'Tenant not found' })

    const totalUsers = await User.countDocuments({ tenant: tenant._id, is_deleted: false })

    res.json({
      tenant,
      stats: {
        totalUsers,
        maxUsers: tenant.max_users,
        usersPercentage: Math.round((totalUsers / tenant.max_users) * 100),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
