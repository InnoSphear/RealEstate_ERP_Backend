import mongoose from 'mongoose'
import Attendance from '../models/Attendance.js'
import Employee from '../models/Employee.js'
import Tenant from '../models/Tenant.js'
import ActivityLog from '../models/ActivityLog.js'

const toObjectId = (id) => {
  if (mongoose.isValidObjectId(id)) return new mongoose.Types.ObjectId(id)
  return null
}

const toUtcMidnight = (dateStr) => new Date(`${dateStr}T00:00:00.000Z`)
const endOfUtcDay = (dateStr) => new Date(`${dateStr}T23:59:59.999Z`)
const toUtcTime = (dateStr, time) => new Date(`${dateStr}T${time}:00.000Z`)
const wallDate = (date) => (date ? date.toISOString().split('T')[0] : '')
const minutesOf = (timeStr) => {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10) || 0)
  return h * 60 + m
}

const loadAttendanceSettings = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).lean()
  return tenant?.attendance_settings || {}
}

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

const autoMarkNoCheckout = async (tenantId) => {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const today = toUtcMidnight(todayStr)
  const sevenPM = new Date(`${todayStr}T19:00:00.000Z`)
  if (now < sevenPM) return
  await Attendance.updateMany(
    {
      tenant: tenantId,
      date: today,
      check_in: { $ne: null },
      check_out: null,
      status: { $nin: ['half_day', 'absent', 'holiday', 'leave'] },
    },
    { $set: { status: 'half_day' } }
  )
}

const calcHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return { working_hours: 0, overtime_hours: 0 }
  const elapsed = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60)
  const lunchBreak = 1
  const netHours = Math.max(0, elapsed - lunchBreak)
  const working_hours = Math.round(netHours * 100) / 100
  let overtime_hours = 0
  if (netHours > 8.5) {
    overtime_hours = Math.round((netHours - 8.5) * 100) / 100
  }
  return { working_hours, overtime_hours }
}

export const checkIn = async (req, res) => {
  try {
    const employee = await findEmployee(req.tenant._id, req.user)
    if (!employee) return res.status(400).json({ message: 'Employee record not found for this user' })

    const clientDate = req.body.date
    const clientTime = req.body.check_in
    let dateStr
    let checkInTime
    if (clientDate && clientTime) {
      dateStr = clientDate
      checkInTime = toUtcTime(clientDate, clientTime)
    } else {
      const now = new Date()
      dateStr = now.toISOString().split('T')[0]
      checkInTime = toUtcTime(dateStr, `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`)
    }

    const existing = await Attendance.findOne({
      tenant: req.tenant._id,
      employee: employee._id,
      date: { $gte: toUtcMidnight(dateStr), $lte: endOfUtcDay(dateStr) },
    })
    if (existing) return res.status(400).json({ message: 'Attendance already marked for today' })

    const settings = await loadAttendanceSettings(req.tenant._id)
    const graceEnd = settings.grace_end || '11:00'
    const checkInMinutes = minutesOf(`${String(checkInTime.getUTCHours()).padStart(2, '0')}:${String(checkInTime.getUTCMinutes()).padStart(2, '0')}`)

    let status = 'present'
    if (checkInMinutes > minutesOf(graceEnd)) {
      status = 'half_day'
    }

    const attendance = await Attendance.create({
      tenant: req.tenant._id,
      employee: employee._id,
      date: toUtcMidnight(dateStr),
      check_in: checkInTime,
      status,
      approval_status: 'pending',
      marked_by: req.user._id,
      location: req.body.location,
      ip_address: req.body.ip_address,
    })

    const populated = await Attendance.findById(attendance._id)
      .populate('employee', 'employee_id full_name department')
      .populate('marked_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'check_in',
      resource: 'Attendance',
      resource_id: attendance._id,
      description: `Checked in at ${checkInTime.toISOString().slice(11, 16)}`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const checkOut = async (req, res) => {
  try {
    const employee = await findEmployee(req.tenant._id, req.user)
    if (!employee) return res.status(400).json({ message: 'Employee record not found' })

    const todayStr = new Date().toISOString().split('T')[0]
    const attendance = await Attendance.findOne({
      tenant: req.tenant._id,
      employee: employee._id,
      date: { $gte: toUtcMidnight(todayStr), $lte: endOfUtcDay(todayStr) },
    })
    if (!attendance) return res.status(400).json({ message: 'No check-in found for today' })
    if (attendance.check_out) return res.status(400).json({ message: 'Already checked out' })

    const baseDate = wallDate(attendance.date)
    const wallOut = req.body.check_out
    const now = new Date()
    attendance.check_out = wallOut
      ? toUtcTime(baseDate, wallOut)
      : toUtcTime(baseDate, `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`)
    const { working_hours, overtime_hours } = calcHours(attendance.check_in, attendance.check_out)
    attendance.working_hours = working_hours
    attendance.overtime_hours = overtime_hours
    if (req.body.location) attendance.location = req.body.location
    if (req.body.ip_address) attendance.ip_address = req.body.ip_address
    await attendance.save()

    const populated = await Attendance.findById(attendance._id)
      .populate('employee', 'employee_id full_name department')
      .populate('marked_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'check_out',
      resource: 'Attendance',
      resource_id: attendance._id,
      description: `Checked out at ${attendance.check_out.toISOString().slice(11, 16)} (${attendance.working_hours.toFixed(1)}h)`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const markAttendance = async (req, res) => {
  try {
    if (req.body.employee_id) { req.body.employee = req.body.employee_id; delete req.body.employee_id }
    const { employee, date, check_in, check_out, status, notes } = req.body
    if (!employee || !date) return res.status(400).json({ message: 'Employee and date are required' })

    const startOfDay = toUtcMidnight(date)

    const existing = await Attendance.findOne({
      tenant: req.tenant._id,
      employee,
      date: { $gte: startOfDay, $lte: endOfUtcDay(date) },
    })
    if (existing) return res.status(400).json({ message: 'Attendance already marked for this employee on this date' })

    const parsedCheckIn = check_in ? toUtcTime(date, check_in) : undefined
    const parsedCheckOut = check_out ? toUtcTime(date, check_out) : undefined

    const { working_hours, overtime_hours } = calcHours(parsedCheckIn, parsedCheckOut)

    const attendance = await Attendance.create({
      tenant: req.tenant._id,
      employee,
      date: startOfDay,
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      status: status || 'present',
      approval_status: 'pending',
      working_hours,
      overtime_hours,
      notes,
      marked_by: req.user._id,
      location: req.body.location,
      ip_address: req.body.ip_address,
    })

    const populated = await Attendance.findById(attendance._id)
      .populate('employee', 'employee_id full_name department')
      .populate('marked_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'mark_attendance',
      resource: 'Attendance',
      resource_id: attendance._id,
      description: `Attendance marked for employee on ${date}`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getAttendance = async (req, res) => {
  try {
    await autoMarkNoCheckout(req.tenant._id)

    const filter = { tenant: req.tenant._id }
    if (req.query.employee) filter.employee = req.query.employee
    if (req.query.status) filter.status = req.query.status
    if (req.query.approval_status) filter.approval_status = req.query.approval_status
    if (req.query.from_date || req.query.to_date) {
      filter.date = {}
      if (req.query.from_date) filter.date.$gte = toUtcMidnight(req.query.from_date)
      if (req.query.to_date) filter.date.$lte = endOfUtcDay(req.query.to_date)
    }
    if (req.query.date) filter.date = { $gte: toUtcMidnight(req.query.date), $lte: endOfUtcDay(req.query.date) }
    if (req.query.department) {
      const employees = await Employee.find({ tenant: req.tenant._id, department: req.query.department, is_deleted: false }).select('_id')
      filter.employee = { $in: employees.map((e) => e._id) }
    }

    const attendance = await Attendance.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('marked_by', 'full_name')
      .populate('approved_by', 'full_name')
      .sort({ date: -1 })

    res.json(attendance)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getMyAttendance = async (req, res) => {
  try {
    await autoMarkNoCheckout(req.tenant._id)

    const employee = await findEmployee(req.tenant._id, req.user)
    if (!employee) return res.status(400).json({ message: 'Employee record not found' })

    const filter = { tenant: req.tenant._id, employee: employee._id }
    if (req.query.status) filter.status = req.query.status
    if (req.query.approval_status) filter.approval_status = req.query.approval_status
    if (req.query.from_date || req.query.to_date) {
      filter.date = {}
      if (req.query.from_date) filter.date.$gte = toUtcMidnight(req.query.from_date)
      if (req.query.to_date) filter.date.$lte = endOfUtcDay(req.query.to_date)
    }
    if (req.query.month) {
      const parts = req.query.month.split('-')
      const year = parseInt(parts[0]), month = parseInt(parts[1])
      filter.date = {
        $gte: new Date(Date.UTC(year, month - 1, 1)),
        $lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
      }
    }

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })

    res.json(attendance)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getAttendanceByEmployee = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, employee: req.params.employeeId }
    if (req.query.from_date || req.query.to_date) {
      filter.date = {}
      if (req.query.from_date) filter.date.$gte = toUtcMidnight(req.query.from_date)
      if (req.query.to_date) filter.date.$lte = endOfUtcDay(req.query.to_date)
    }
    if (req.query.month) {
      const parts = req.query.month.split('-')
      const year = parseInt(parts[0]), month = parseInt(parts[1])
      filter.date = {
        $gte: new Date(Date.UTC(year, month - 1, 1)),
        $lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
      }
    }
    if (req.query.status) filter.status = req.query.status

    const attendance = await Attendance.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('marked_by', 'full_name')
      .sort({ date: -1 })

    res.json(attendance)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getMonthlyReport = async (req, res) => {
  try {
    const { year, month, employee } = req.query
    const queryYear = parseInt(year) || new Date().getFullYear()
    const queryMonth = parseInt(month) || new Date().getMonth() + 1

    const startDate = new Date(Date.UTC(queryYear, queryMonth - 1, 1))
    const endDate = new Date(Date.UTC(queryYear, queryMonth, 0, 23, 59, 59, 999))

    const match = {
      tenant: req.tenant._id,
      date: { $gte: startDate, $lte: endDate },
    }
    if (employee) {
      match.employee = toObjectId(employee)
      if (!match.employee) return res.status(400).json({ message: 'Invalid employee id' })
    }

    const report = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: employee ? null : '$employee',
          total_days: { $sum: 1 },
          present_days: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent_days: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          half_days: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          late_days: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          holiday_days: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
          leave_days: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          total_working_hours: { $sum: '$working_hours' },
          total_overtime_hours: { $sum: '$overtime_hours' },
        },
      },
      { $sort: { _id: 1 } },
    ])

    if (!employee && report.length > 0) {
      const empList = await Employee.find(
        { _id: { $in: report.map((r) => r._id) }, tenant: req.tenant._id, is_deleted: false },
        'employee_id full_name department'
      )
      const empMap = {}
      empList.forEach((e) => { empMap[e._id.toString()] = e })
      report.forEach((r) => {
        r.employee = empMap[r._id.toString()] || null
      })
    }

    res.json({ year: queryYear, month: queryMonth, report })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateAttendance = async (req, res) => {
  try {
    const existing = await Attendance.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!existing) return res.status(404).json({ message: 'Attendance record not found' })

    const { check_in, check_out, status, notes, date } = req.body
    const data = {}
    const baseDate = date || wallDate(existing.date)

    if (date) data.date = toUtcMidnight(date)
    if (req.body.employee_id) data.employee = req.body.employee_id
    if (check_in !== undefined) {
      data.check_in = check_in === null || check_in === ''
        ? null
        : check_in.includes('T')
          ? new Date(check_in)
          : toUtcTime(baseDate, check_in)
    }
    if (check_out !== undefined) {
      data.check_out = check_out === null || check_out === ''
        ? null
        : check_out.includes('T')
          ? new Date(check_out)
          : toUtcTime(baseDate, check_out)
    }
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes

    const resolvedCheckIn = data.check_in !== undefined ? data.check_in : existing.check_in
    const resolvedCheckOut = data.check_out !== undefined ? data.check_out : existing.check_out

    if (resolvedCheckIn && resolvedCheckOut) {
      const { working_hours, overtime_hours } = calcHours(resolvedCheckIn, resolvedCheckOut)
      data.working_hours = working_hours
      data.overtime_hours = overtime_hours
    } else {
      data.working_hours = 0
      data.overtime_hours = 0
    }

    const attendance = await Attendance.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id },
      data,
      { new: true, runValidators: true }
    )
      .populate('employee', 'employee_id full_name department')
      .populate('marked_by', 'full_name')

    if (!attendance) return res.status(404).json({ message: 'Attendance record not found' })

    res.json(attendance)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const approveAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
      approval_status: 'pending',
    })
    if (!attendance) return res.status(404).json({ message: 'Attendance not found or already processed' })

    attendance.approval_status = 'approved'
    attendance.approved_by = req.user._id
    attendance.approved_at = new Date()
    await attendance.save()

    const populated = await Attendance.findById(attendance._id)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'approve_attendance',
      resource: 'Attendance',
      resource_id: attendance._id,
      description: `Attendance approved for ${attendance.date.toISOString().split('T')[0]}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const rejectAttendance = async (req, res) => {
  try {
    const { rejection_reason } = req.body
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
      approval_status: 'pending',
    })
    if (!attendance) return res.status(404).json({ message: 'Attendance not found or already processed' })

    attendance.approval_status = 'rejected'
    attendance.approved_by = req.user._id
    attendance.approved_at = new Date()
    attendance.rejection_reason = rejection_reason
    await attendance.save()

    const populated = await Attendance.findById(attendance._id)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'reject_attendance',
      resource: 'Attendance',
      resource_id: attendance._id,
      description: `Attendance rejected for ${attendance.date.toISOString().split('T')[0]}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!attendance) return res.status(404).json({ message: 'Attendance not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_attendance',
      resource: 'Attendance',
      resource_id: attendance._id,
      description: `Attendance record deleted for ${attendance.date?.toISOString().split('T')[0] || 'unknown date'}`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Attendance deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPayrollSummary = async (req, res) => {
  try {
    const { employee_id, from_date, to_date } = req.query
    const match = { tenant: req.tenant._id }
    if (employee_id) {
      match.employee = toObjectId(employee_id)
      if (!match.employee) return res.status(400).json({ message: 'Invalid employee id' })
    }
    if (from_date || to_date) {
      match.date = {}
      if (from_date) match.date.$gte = toUtcMidnight(from_date)
      if (to_date) match.date.$lte = endOfUtcDay(to_date)
    }

    const report = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: employee_id ? null : '$employee',
          total_working_hours: { $sum: '$working_hours' },
          total_overtime_hours: { $sum: '$overtime_hours' },
          total_days_present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          total_days_absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          total_days_late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          total_half_days: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          total_holiday_days: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
          total_leave_days: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
        },
      },
    ])

    if (employee_id || report.length === 0) {
      return res.json(report[0] || {
        total_working_hours: 0, total_overtime_hours: 0,
        total_days_present: 0, total_days_absent: 0,
        total_days_late: 0, total_half_days: 0,
        total_holiday_days: 0, total_leave_days: 0,
      })
    }

    const empList = await Employee.find(
      { _id: { $in: report.map((r) => r._id) }, tenant: req.tenant._id, is_deleted: false },
      'employee_id full_name department'
    )
    const empMap = {}
    empList.forEach((e) => { empMap[e._id.toString()] = e })
    report.forEach((r) => {
      r.employee = empMap[r._id.toString()] || null
    })

    res.json(report)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const processEndOfDay = async (req, res) => {
  try {
    await autoMarkNoCheckout(req.tenant._id)
    res.json({ message: 'End of day processing complete' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getAttendanceSettings = async (req, res) => {
  try {
    const settings = await loadAttendanceSettings(req.tenant._id)
    res.json(settings)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateAttendanceSettings = async (req, res) => {
  try {
    const { grace_start, grace_end } = req.body
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { attendance_settings: { grace_start: grace_start || '10:00', grace_end: grace_end || '10:35' } },
      { new: true }
    )
    res.json(tenant.attendance_settings)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const exportAttendanceSummary = async (req, res) => {
  try {
    const { from_date, to_date, group_by, department } = req.query
    const match = { tenant: req.tenant._id }
    if (from_date || to_date) {
      match.date = {}
      if (from_date) match.date.$gte = toUtcMidnight(from_date)
      if (to_date) match.date.$lte = endOfUtcDay(to_date)
    }

    const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'))

    if (group_by === 'date') {
      const rows = await Attendance.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$date',
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
            half_day: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            holiday: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
            leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
            total: { $sum: 1 },
            working_hours: { $sum: '$working_hours' },
          },
        },
        { $sort: { _id: 1 } },
      ])
      const header = 'Date,Present,Late,Half Day,Absent,Holiday,Leave,Total,Working Hours'
      const csvRows = rows.map((r) =>
        `"${wallDate(r._id)}",${r.present},${r.late},${r.half_day},${r.absent},${r.holiday},${r.leave},${r.total},${(r.working_hours || 0).toFixed(2)}`
      )
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="attendance-date-summary-${Date.now()}.csv"`)
      return res.send(`${header}\n${csvRows.join('\n')}`)
    }

    const empFilter = { tenant: req.tenant._id, is_deleted: false }
    if (department) empFilter.department = department
    const employees = await Employee.find(empFilter).select('employee_id full_name department').lean()

    const stats = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employee',
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          half_day: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          holiday: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          total: { $sum: 1 },
          working_hours: { $sum: '$working_hours' },
          overtime_hours: { $sum: '$overtime_hours' },
        },
      },
    ])
    const statMap = {}
    stats.forEach((s) => { statMap[s._id?.toString()] = s })

    const header = 'Employee ID,Employee,Department,Present,Late,Half Day,Absent,Holiday,Leave,Total Days,Working Hours,Overtime Hours,Attendance %'
    const csvRows = employees.map((emp) => {
      const s = statMap[emp._id.toString()] || {}
      const present = s.present || 0
      const total = s.total || 0
      const pct = total > 0 ? Math.round((present / total) * 100) : 0
      return `"${esc(emp.employee_id)}","${esc(emp.full_name)}","${esc(emp.department)}",${present},${s.late || 0},${s.half_day || 0},${s.absent || 0},${s.holiday || 0},${s.leave || 0},${total},${(s.working_hours || 0).toFixed(2)},${(s.overtime_hours || 0).toFixed(2)},${pct}`
    })
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="attendance-employee-summary-${Date.now()}.csv"`)
    res.send(`${header}\n${csvRows.join('\n')}`)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
