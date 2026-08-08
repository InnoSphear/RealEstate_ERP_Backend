import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Employee from '../models/Employee.js'
import Role from '../models/Role.js'
import ActivityLog from '../models/ActivityLog.js'

const getClientInfo = (req) => ({
  ip_address: req.ip || req.connection?.remoteAddress,
  user_agent: req.headers['user-agent'],
  device: req.headers['user-agent']?.substring(0, 100),
})

const resolveRole = async (tenantId, roleValue) => {
  if (!roleValue) throw new Error('Role is required')
  let roleDoc
  if (mongoose.Types.ObjectId.isValid(roleValue)) {
    roleDoc = await Role.findOne({ _id: roleValue, tenant: tenantId, is_deleted: false })
  } else {
    roleDoc = await Role.findOne({ slug: roleValue, tenant: tenantId, is_deleted: false })
  }
  if (!roleDoc) throw new Error(`Role '${roleValue}' not found`)
  return { role: roleDoc._id, role_slug: roleDoc.slug }
}

const roleToDepartment = {
  admin: 'management',
  manager: 'management',
  telecaller: 'telecalling',
  sales_executive: 'sales',
  accounts: 'accounts',
  agent: 'agent',
  receptionist: 'reception',
  interior_manager: 'management',
  junior_interior_manager: 'management',
}

const ensureEmployee = async (tenantId, user) => {
  let employee = await Employee.findOne({ tenant: tenantId, user: user._id, is_deleted: false })
  if (employee) return employee
  employee = await Employee.findOne({ tenant: tenantId, email: user.email, is_deleted: false })
  if (employee) {
    employee.user = user._id
    await employee.save()
    user.employee = employee._id
    await user.save()
    return employee
  }
  const dept = roleToDepartment[user.role_slug] || 'management'
  const empType = dept === 'management' ? 'telecaller' : dept === 'telecalling' ? 'telecaller' : dept === 'sales' ? 'sales' : dept === 'accounts' ? 'accounts' : dept === 'agent' ? 'agent' : dept === 'reception' ? 'reception' : 'telecaller'
  const count = await Employee.countDocuments({ tenant: tenantId })
  const employeeId = `EMP-${String(count + 1).padStart(4, '0')}`
  employee = await Employee.create({
    tenant: tenantId,
    employee_id: employeeId,
    user: user._id,
    full_name: user.full_name,
    email: user.email || `${user._id}@auto.local`,
    mobile: user.phone || `${user._id}`.slice(-10).padStart(10, '0'),
    joining_date: new Date(),
    department: dept,
    employee_type: empType,
  })
  user.employee = employee._id
  await user.save()
  return employee
}

export const createUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body
    if (!password) return res.status(400).json({ message: 'Password is required' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const existing = await User.findOne({ tenant: req.tenant._id, email: rest.email })
    if (existing) return res.status(400).json({ message: 'A user with this email already exists under this tenant' })

    const password_hash = await bcrypt.hash(password, 10)
    const roleData = await resolveRole(req.tenant._id, rest.role)
    const user = await User.create({ ...rest, ...roleData, tenant: req.tenant._id, password_hash })

    await ensureEmployee(req.tenant._id, user)

    const populated = await User.findById(user._id)
      .populate('role', 'name slug')
      .populate('employee', 'employee_id full_name')
      .select('-password_hash -refresh_token -sessions')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_user',
      resource: 'User',
      resource_id: user._id,
      description: `User ${user.full_name} created`,
      type: 'crud',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getUsers = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.role) filter.role = req.query.role
    if (req.query.role_slug) filter.role_slug = req.query.role_slug
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active === 'true'
    if (req.query.search) {
      filter.$or = [
        { full_name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const users = await User.find(filter)
      .populate('role', 'name slug')
      .populate('employee', 'employee_id full_name department')
      .select('-password_hash -refresh_token -reset_password_token -reset_password_expires -sessions')
      .sort({ createdAt: -1 })

    res.json(users)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('role', 'name slug permissions')
      .populate('employee', 'employee_id full_name department designation photo')
      .populate('tenant', 'company_name')
      .select('-password_hash -refresh_token -reset_password_token -reset_password_expires -sessions')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateUser = async (req, res) => {
  try {
    const data = { ...req.body }
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 10)
      data.password_changed_at = new Date()
      delete data.password
    }
    let roleChanged = false
    if (data.role) {
      const roleData = await resolveRole(req.tenant._id, data.role)
      data.role = roleData.role
      data.role_slug = roleData.role_slug
      roleChanged = true
    }
    delete data.tenant
    delete data.is_deleted

    const user = await User.findOne(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false }
    )
    if (!user) return res.status(404).json({ message: 'User not found' })

    Object.assign(user, data)
    if (roleChanged) {
      user.refresh_token = null
      user.sessions = []
    }
    await user.save()

    await ensureEmployee(req.tenant._id, user)

    const populated = await User.findById(user._id)
      .populate('role', 'name slug')
      .select('-password_hash -refresh_token -sessions')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_user',
      resource: 'User',
      resource_id: user._id,
      description: `User ${user.full_name} updated`,
      type: 'crud',
      severity: 'info',
      details: data,
      ...getClientInfo(req),
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!user) return res.status(404).json({ message: 'User not found' })

    user.is_active = false
    user.refresh_token = null
    user.sessions = []
    await user.save()

    await User.deleteOne({ _id: user._id })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_user',
      resource: 'User',
      resource_id: user._id,
      description: `User ${user.full_name} deleted`,
      type: 'crud',
      severity: 'warning',
      ...getClientInfo(req),
    })

    res.json({ message: 'User deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const toggleActive = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot toggle your own active status' })
    }
    const user = await User.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!user) return res.status(404).json({ message: 'User not found' })

    user.is_active = !user.is_active
    if (!user.is_active) {
      user.refresh_token = null
      user.sessions = []
    }
    await user.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: user.is_active ? 'activate_user' : 'deactivate_user',
      resource: 'User',
      resource_id: user._id,
      description: `User ${user.full_name} ${user.is_active ? 'activated' : 'deactivated'}`,
      type: 'crud',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.json({ message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully`, is_active: user.is_active })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const bulkCreate = async (req, res) => {
  try {
    const { users } = req.body
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Users array is required' })
    }

    const results = { created: [], errors: [] }
    for (const userData of users) {
      try {
        if (!userData.password || userData.password.length < 6) {
          results.errors.push({ email: userData.email, message: 'Password must be at least 6 characters' })
          continue
        }
        const existing = await User.findOne({ tenant: req.tenant._id, email: userData.email })
        if (existing) {
          results.errors.push({ email: userData.email, message: 'Email already exists' })
          continue
        }
        const password_hash = await bcrypt.hash(userData.password, 10)
        const roleData = await resolveRole(req.tenant._id, userData.role)
        const created = await User.create({ ...userData, ...roleData, tenant: req.tenant._id, password_hash })

        await ensureEmployee(req.tenant._id, created)

        results.created.push({ _id: created._id, full_name: created.full_name, email: created.email })
      } catch (err) {
        results.errors.push({ email: userData.email, message: err.message })
      }
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_create_users',
      resource: 'User',
      description: `Bulk created ${results.created.length} users (${results.errors.length} errors)`,
      type: 'crud',
      severity: 'info',
      details: results,
      ...getClientInfo(req),
    })

    res.status(201).json(results)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
