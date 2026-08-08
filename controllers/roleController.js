import Role from '../models/Role.js'
import Permission from '../models/Permission.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'

const resolvePermissions = async (permissionMap, tenantId) => {
  if (!permissionMap || typeof permissionMap !== 'object') return []
  const ids = []
  for (const [module, actions] of Object.entries(permissionMap)) {
    for (const [action, value] of Object.entries(actions)) {
      if (value) {
        const doc = await Permission.findOneAndUpdate(
          { tenant: tenantId, module, action },
          { tenant: tenantId, module, action },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        ids.push(doc._id)
      }
    }
  }
  return ids
}

export const createRole = async (req, res) => {
  try {
    const { name, slug, description, permissions } = req.body
    if (!name || !slug) return res.status(400).json({ message: 'Name and slug are required' })

    const existing = await Role.findOne({ tenant: req.tenant._id, slug })
    if (existing) return res.status(400).json({ message: 'A role with this slug already exists' })

    const permissionIds = await resolvePermissions(permissions, req.tenant._id)
    const role = await Role.create({ name, slug, description, permissions: permissionIds, tenant: req.tenant._id })
    const populated = await Role.findById(role._id).populate('permissions', 'module action description')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_role',
      resource: 'Role',
      resource_id: role._id,
      description: `Role ${role.name} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getRoles = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active === 'true'
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { slug: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const roles = await Role.find(filter)
      .populate('permissions', 'module action description')
      .sort({ createdAt: -1 })
      .lean()

    const User = (await import('../models/User.js')).default
    const roleIds = roles.map(r => r._id)
    const userCounts = await User.aggregate([
      { $match: { tenant: req.tenant._id, role: { $in: roleIds }, is_deleted: false } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ])
    const countMap = {}
    userCounts.forEach(u => { countMap[u._id.toString()] = u.count })

    const result = roles.map(r => ({
      ...r,
      user_count: countMap[r._id.toString()] || 0,
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('permissions', 'module action description')
    if (!role) return res.status(404).json({ message: 'Role not found' })
    res.json(role)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateRole = async (req, res) => {
  try {
    const { name, slug, description, permissions, is_active } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (slug !== undefined) data.slug = slug
    if (description !== undefined) data.description = description
    if (permissions !== undefined) data.permissions = await resolvePermissions(permissions, req.tenant._id)
    if (is_active !== undefined) data.is_active = is_active

    const oldRole = await Role.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!oldRole) return res.status(404).json({ message: 'Role not found' })

    const role = await Role.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    ).populate('permissions', 'module action description')

    if (slug && slug !== oldRole.slug) {
      await User.updateMany(
        { tenant: req.tenant._id, role: role._id },
        { $set: { role_slug: slug, refresh_token: null, sessions: [] } }
      )
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_role',
      resource: 'Role',
      resource_id: role._id,
      description: `Role ${role.name} updated`,
      type: 'crud',
      severity: 'info',
      details: data,
    })

    res.json(role)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, tenant: req.tenant._id, is_system: false })
    if (!role) return res.status(404).json({ message: 'Role not found or is a system role' })

    const User = (await import('../models/User.js')).default
    const usersWithRole = await User.countDocuments({ tenant: req.tenant._id, role: role._id, is_deleted: false })
    if (usersWithRole > 0) {
      return res.status(400).json({ message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role.` })
    }

    await Role.deleteOne({ _id: role._id })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_role',
      resource: 'Role',
      resource_id: role._id,
      description: `Role ${role.name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Role deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
