import Leave from '../models/Leave.js'
import Employee from '../models/Employee.js'
import ActivityLog from '../models/ActivityLog.js'

const linkAndSave = async (employee, user) => {
  employee.user = user._id
  await employee.save()
  user.employee = employee._id
  await user.save()
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

const autoCreateEmployee = async (tenantId, user) => {
  const dept = roleToDepartment[user.role_slug] || 'management'
  const empType = dept === 'management' ? 'telecaller' : dept === 'telecalling' ? 'telecaller' : dept === 'sales' ? 'sales' : dept === 'accounts' ? 'accounts' : dept === 'agent' ? 'agent' : dept === 'reception' ? 'reception' : 'telecaller'
  const count = await Employee.countDocuments({ tenant: tenantId })
  const employeeId = `EMP-${String(count + 1).padStart(4, '0')}`
  const employee = await Employee.create({
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

const findEmployee = async (tenantId, user) => {
  let employee = await Employee.findOne({ tenant: tenantId, user: user._id, is_deleted: false })
  if (!employee && user.employee) {
    employee = await Employee.findOne({ _id: user.employee, tenant: tenantId, is_deleted: false })
  }
  if (!employee && user.email) {
    employee = await Employee.findOne({ tenant: tenantId, email: user.email, is_deleted: false })
    if (employee) await linkAndSave(employee, user)
  }
  if (!employee && user.full_name) {
    const name = user.full_name.trim().replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    employee = await Employee.findOne({ tenant: tenantId, full_name: { $regex: name, $options: 'i' }, is_deleted: false })
    if (employee) await linkAndSave(employee, user)
  }
  if (!employee) {
    const unlinked = await Employee.find({ tenant: tenantId, user: null, is_deleted: false }).limit(2)
    if (unlinked.length === 1) {
      employee = unlinked[0]
      await linkAndSave(employee, user)
    }
  }
  if (!employee) {
    employee = await autoCreateEmployee(tenantId, user)
  }
  return employee
}

const checkLeaveBalance = async (tenantId, employeeId, newDays) => {
  const currentYear = new Date().getFullYear()
  const startOfYear = new Date(currentYear, 0, 1)
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999)

  const approvedLeaves = await Leave.find({
    tenant: tenantId,
    employee: employeeId,
    status: 'approved',
    from_date: { $lte: endOfYear },
    to_date: { $gte: startOfYear },
  })
  const totalTaken = approvedLeaves.reduce((sum, l) => sum + l.total_days, 0)
  const totalAllowed = 4
  if (totalTaken + newDays > totalAllowed) {
    throw new Error('Leave balance exhausted. You have used all 4 leaves for this year.')
  }
}

export const createLeave = async (req, res) => {
  try {
    const body = { ...req.body }
    if (body.employee_id && !body.employee) body.employee = body.employee_id
    delete body.employee_id
    const { employee, leave_type, from_date, to_date, reason } = body
    if (!employee || !leave_type || !from_date || !to_date) {
      return res.status(400).json({ message: 'Employee, leave type, from date, and to date are required' })
    }

    const from = new Date(from_date)
    const to = new Date(to_date)
    if (from > to) return res.status(400).json({ message: 'From date must be before to date' })

    const total_days = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1

    const existing = await Leave.findOne({
      tenant: req.tenant._id,
      employee,
      status: { $in: ['pending', 'approved'] },
      from_date: { $lte: to },
      to_date: { $gte: from },
    })
    if (existing) return res.status(400).json({ message: 'Leave already exists for this period' })

    try {
      await checkLeaveBalance(req.tenant._id, employee, total_days)
    } catch (balanceErr) {
      return res.status(400).json({ message: balanceErr.message })
    }

    const leave = await Leave.create({
      tenant: req.tenant._id,
      employee,
      leave_type,
      from_date: from,
      to_date: to,
      total_days,
      reason,
    })

    const populated = await Leave.findById(leave._id)
      .populate('employee', 'employee_id full_name department')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_leave',
      resource: 'Leave',
      resource_id: leave._id,
      description: `Leave ${leave_type} created for ${total_days} day(s)`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getLeaves = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id }
    if (req.query.status) filter.status = req.query.status
    if (req.query.leave_type) filter.leave_type = req.query.leave_type
    if (req.query.employee) filter.employee = req.query.employee
    if (req.query.from_date || req.query.to_date) {
      filter.from_date = {}
      if (req.query.from_date) filter.from_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.from_date.$lte = new Date(req.query.to_date)
    }

    const leaves = await Leave.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')
      .sort({ createdAt: -1 })

    res.json(leaves)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getLeavesByEmployee = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, employee: req.params.employeeId }
    if (req.query.status) filter.status = req.query.status
    if (req.query.from_date || req.query.to_date) {
      filter.from_date = {}
      if (req.query.from_date) filter.from_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.from_date.$lte = new Date(req.query.to_date)
    }

    const leaves = await Leave.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')
      .sort({ createdAt: -1 })

    res.json(leaves)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, tenant: req.tenant._id, status: 'pending' })
    if (!leave) return res.status(404).json({ message: 'Leave not found or already processed' })

    const employee = await Employee.findOne({ _id: leave.employee, tenant: req.tenant._id, is_deleted: false })
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    const balanceKey = leave.leave_type === 'annual' ? 'annual'
      : leave.leave_type === 'sick' ? 'sick'
      : leave.leave_type === 'casual' ? 'casual'
      : leave.leave_type === 'personal' ? 'personal'
      : null

    if (balanceKey && employee.leave_balance[balanceKey] < leave.total_days) {
      return res.status(400).json({ message: `Insufficient ${balanceKey} leave balance` })
    }

    leave.status = 'approved'
    leave.approved_by = req.user._id
    leave.approved_at = new Date()
    await leave.save()

    if (balanceKey) {
      employee.leave_balance[balanceKey] -= leave.total_days
      await employee.save()
    }

    const populated = await Leave.findById(leave._id)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'approve_leave',
      resource: 'Leave',
      resource_id: leave._id,
      description: `Leave approved for ${leave.total_days} day(s), balance updated`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const updateLeave = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    if (data.employee_id) { data.employee = data.employee_id; delete data.employee_id }

    if (data.from_date) data.from_date = new Date(data.from_date)
    if (data.to_date) data.to_date = new Date(data.to_date)
    if (data.from_date && data.to_date) {
      data.total_days = Math.floor((data.to_date - data.from_date) / (1000 * 60 * 60 * 24)) + 1
    }

    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id },
      data,
      { new: true, runValidators: true }
    )
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')

    if (!leave) return res.status(404).json({ message: 'Leave not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_leave',
      resource: 'Leave',
      resource_id: leave._id,
      description: `Leave updated for ${leave.employee?.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(leave)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const rejectLeave = async (req, res) => {
  try {
    const { rejection_reason } = req.body
    const leave = await Leave.findOne({ _id: req.params.id, tenant: req.tenant._id, status: 'pending' })
    if (!leave) return res.status(404).json({ message: 'Leave not found or already processed' })

    leave.status = 'rejected'
    leave.approved_by = req.user._id
    leave.approved_at = new Date()
    leave.rejection_reason = rejection_reason
    await leave.save()

    const populated = await Leave.findById(leave._id)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'reject_leave',
      resource: 'Leave',
      resource_id: leave._id,
      description: `Leave rejected for ${leave.employee.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getLeaveBalance = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.query.employee
    let empId
    if (!employeeId) {
      const employee = await findEmployee(req.tenant._id, req.user)
      if (!employee) return res.status(404).json({ message: 'Employee not found' })
      empId = employee._id
    } else {
      empId = employeeId
    }

    const currentYear = new Date().getFullYear()
    const startOfYear = new Date(currentYear, 0, 1)
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999)

    const leaves = await Leave.find({
      tenant: req.tenant._id,
      employee: empId,
      status: 'approved',
      from_date: { $lte: endOfYear },
      to_date: { $gte: startOfYear },
    })

    const totalTaken = leaves.reduce((sum, l) => sum + l.total_days, 0)
    const totalAllowed = 4
    const remaining = Math.max(0, totalAllowed - totalTaken)

    const leavesByType = {}
    leaves.forEach((l) => {
      leavesByType[l.leave_type] = (leavesByType[l.leave_type] || 0) + l.total_days
    })

    res.json({
      total_allowed: totalAllowed,
      taken: totalTaken,
      remaining,
      leaves_by_type: leavesByType,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const applyLeave = async (req, res) => {
  try {
    const employee = await findEmployee(req.tenant._id, req.user)
    if (!employee) return res.status(400).json({ message: 'Employee record not found' })

    const { leave_type, from_date, to_date, reason } = req.body
    if (!leave_type || !from_date || !to_date) {
      return res.status(400).json({ message: 'Leave type, from date, and to date are required' })
    }

    const from = new Date(from_date)
    const to = new Date(to_date)
    if (from > to) return res.status(400).json({ message: 'From date must be before to date' })

    const total_days = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1

    const existing = await Leave.findOne({
      tenant: req.tenant._id,
      employee: employee._id,
      status: { $in: ['pending', 'approved'] },
      from_date: { $lte: to },
      to_date: { $gte: from },
    })
    if (existing) return res.status(400).json({ message: 'Leave already exists for this period' })

    try {
      await checkLeaveBalance(req.tenant._id, employee._id, total_days)
    } catch (balanceErr) {
      return res.status(400).json({ message: balanceErr.message })
    }

    const leave = await Leave.create({
      tenant: req.tenant._id,
      employee: employee._id,
      leave_type,
      from_date: from,
      to_date: to,
      total_days,
      reason,
    })

    const populated = await Leave.findById(leave._id)
      .populate('employee', 'employee_id full_name department')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'apply_leave',
      resource: 'Leave',
      resource_id: leave._id,
      description: `Leave ${leave_type} applied for ${total_days} day(s)`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getMyLeaves = async (req, res) => {
  try {
    const employee = await findEmployee(req.tenant._id, req.user)
    if (!employee) return res.status(400).json({ message: 'Employee record not found' })

    const filter = { tenant: req.tenant._id, employee: employee._id }
    if (req.query.status) filter.status = req.query.status
    if (req.query.from_date || req.query.to_date) {
      filter.from_date = {}
      if (req.query.from_date) filter.from_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.from_date.$lte = new Date(req.query.to_date)
    }

    const leaves = await Leave.find(filter)
      .sort({ createdAt: -1 })

    res.json(leaves)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
