import Permission from '../models/Permission.js'
import ActivityLog from '../models/ActivityLog.js'

const DEFAULT_MODULES = [
  { module: 'leads', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'clients', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'properties', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'projects', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'invoices', actions: ['create', 'read', 'update', 'delete', 'export', 'send'] },
  { module: 'payments', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'expenses', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
  { module: 'income', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'commissions', actions: ['create', 'read', 'update', 'delete', 'approve', 'pay'] },
  { module: 'employees', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'attendance', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'leaves', actions: ['create', 'read', 'update', 'approve', 'reject'] },
  { module: 'site_visits', actions: ['create', 'read', 'update', 'delete', 'confirm', 'cancel'] },
  { module: 'follow_ups', actions: ['create', 'read', 'update', 'delete', 'complete'] },
  { module: 'visitors', actions: ['create', 'read', 'update', 'delete'] },
  { module: 'reports', actions: ['read', 'export'] },
  { module: 'users', actions: ['create', 'read', 'update', 'delete', 'export'] },
  { module: 'roles', actions: ['create', 'read', 'update', 'delete'] },
  { module: 'settings', actions: ['read', 'update'] },
  { module: 'dashboard', actions: ['read'] },
  { module: 'activity_logs', actions: ['read', 'export'] },
  { module: 'notifications', actions: ['read', 'send'] },
  { module: 'property_keys', actions: ['create', 'read', 'update', 'delete', 'issue', 'return'] },
]

export const createPermission = async (req, res) => {
  try {
    const { module, action, description } = req.body
    if (!module || !action) return res.status(400).json({ message: 'Module and action are required' })

    const existing = await Permission.findOne({ tenant: req.tenant._id, module, action })
    if (existing) return res.status(400).json({ message: 'Permission already exists' })

    const permission = await Permission.create({ module, action, description, tenant: req.tenant._id })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_permission',
      resource: 'Permission',
      resource_id: permission._id,
      description: `Permission ${module}:${action} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(permission)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getPermissions = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id }
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active === 'true'
    if (req.query.module) filter.module = req.query.module
    if (req.query.search) {
      filter.$or = [
        { module: { $regex: req.query.search, $options: 'i' } },
        { action: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const permissions = await Permission.find(filter).sort({ module: 1, action: 1 })
    res.json(permissions)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPermissionsByModule = async (req, res) => {
  try {
    const permissions = await Permission.find({ tenant: req.tenant._id }).sort({ module: 1, action: 1 })
    const grouped = permissions.reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = []
      acc[p.module].push(p)
      return acc
    }, {})
    res.json(grouped)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPermissionById = async (req, res) => {
  try {
    const permission = await Permission.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!permission) return res.status(404).json({ message: 'Permission not found' })
    res.json(permission)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updatePermission = async (req, res) => {
  try {
    const { description, is_active } = req.body
    const data = {}
    if (description !== undefined) data.description = description
    if (is_active !== undefined) data.is_active = is_active

    const permission = await Permission.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id },
      data,
      { new: true, runValidators: true }
    )
    if (!permission) return res.status(404).json({ message: 'Permission not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_permission',
      resource: 'Permission',
      resource_id: permission._id,
      description: `Permission ${permission.module}:${permission.action} updated`,
      type: 'crud',
      severity: 'info',
    })

    res.json(permission)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deletePermission = async (req, res) => {
  try {
    const permission = await Permission.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!permission) return res.status(404).json({ message: 'Permission not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_permission',
      resource: 'Permission',
      resource_id: permission._id,
      description: `Permission ${permission.module}:${permission.action} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Permission deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const seedDefaultPermissions = async (req, res) => {
  try {
    const tenantId = req.tenant._id
    const results = { created: [], skipped: [] }

    for (const mod of DEFAULT_MODULES) {
      for (const action of mod.actions) {
        const existing = await Permission.findOne({ tenant: tenantId, module: mod.module, action })
        if (existing) {
          results.skipped.push(`${mod.module}:${action}`)
          continue
        }
        await Permission.create({ tenant: tenantId, module: mod.module, action })
        results.created.push(`${mod.module}:${action}`)
      }
    }

    await ActivityLog.create({
      tenant: tenantId,
      user: req.user._id,
      action: 'seed_permissions',
      resource: 'Permission',
      description: `Seeded ${results.created.length} default permissions (${results.skipped.length} skipped)`,
      type: 'crud',
      severity: 'info',
      details: results,
    })

    res.json({ message: 'Default permissions seeded', results })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
