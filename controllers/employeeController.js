import Employee from '../models/Employee.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

export const createEmployee = async (req, res) => {
  try {
    const { employee_id } = req.body
    if (!employee_id) return res.status(400).json({ message: 'Employee ID is required' })

    const existing = await Employee.findOne({ tenant: req.tenant._id, employee_id })
    if (existing) return res.status(400).json({ message: 'Employee with this ID already exists' })

    const empData = { ...req.body, tenant: req.tenant._id }
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, { folder: 'employee_photos' })
        empData.photo = result.url
      } catch (uploadErr) {
        // silent fail on photo upload
      }
    }
    const employee = await Employee.create(empData)

    const matchedUser = await User.findOne({ tenant: req.tenant._id, email: employee.email, is_deleted: false })
    if (matchedUser) {
      await User.updateOne({ _id: matchedUser._id }, { employee: employee._id })
      employee.user = matchedUser._id
      await employee.save()
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_employee',
      resource: 'Employee',
      resource_id: employee._id,
      description: `Employee ${employee.full_name} (${employee.employee_id}) created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(employee)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getEmployees = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.department) filter.department = req.query.department
    if (req.query.employee_type) filter.employee_type = req.query.employee_type
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active === 'true'
    if (req.query.search) {
      filter.$or = [
        { full_name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { mobile: { $regex: req.query.search, $options: 'i' } },
        { employee_id: { $regex: req.query.search, $options: 'i' } },
        { department: { $regex: req.query.search, $options: 'i' } },
        { designation: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const employees = await Employee.find(filter).sort({ createdAt: -1 })
    res.json(employees)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!employee) return res.status(404).json({ message: 'Employee not found' })
    res.json(employee)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateEmployee = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.employee_id
    delete data.is_deleted

    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, { folder: 'employee_photos' })
        data.photo = result.url
      } catch (uploadErr) {
        // silent fail on photo upload
      }
    }

    const employee = await Employee.findOne(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false }
    )
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    Object.assign(employee, data)
    await employee.save()

    const matchedUser = await User.findOne({ tenant: req.tenant._id, email: employee.email, is_deleted: false })
    if (matchedUser) {
      await User.updateOne({ _id: matchedUser._id }, { employee: employee._id })
      employee.user = matchedUser._id
      await employee.save()
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_employee',
      resource: 'Employee',
      resource_id: employee._id,
      description: `Employee ${employee.full_name} updated`,
      type: 'crud',
      severity: 'info',
    })

    res.json(employee)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_employee',
      resource: 'Employee',
      resource_id: employee._id,
      description: `Employee ${employee.full_name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Employee deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadDocument = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    const name = req.body.name || (req.file ? req.file.originalname : '')
    let url = req.body.url
    let type = req.body.type || ''
    if (req.file) {
      if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(400).json({ message: 'Cloudinary not configured' })
      const result = await uploadToCloudinary(req.file.buffer)
      url = result.url
      type = req.file.mimetype
    }
    if (!name || !url) return res.status(400).json({ message: 'Document name and file are required' })

    employee.documents.push({ name, url, type, uploaded_at: new Date() })
    await employee.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'upload_document',
      resource: 'Employee',
      resource_id: employee._id,
      description: `Document ${name} uploaded for ${employee.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(employee)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const linkUserEmployee = async (req, res) => {
  try {
    const { employee_id, user_id } = req.body
    if (!employee_id || !user_id) {
      return res.status(400).json({ message: 'employee_id and user_id are required' })
    }

    const employee = await Employee.findOne({ _id: employee_id, tenant: req.tenant._id, is_deleted: false })
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    const user = await User.findOne({ _id: user_id, tenant: req.tenant._id, is_deleted: false })
    if (!user) return res.status(404).json({ message: 'User not found' })

    employee.user = user._id
    await employee.save()
    user.employee = employee._id
    await user.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'link_user_employee',
      resource: 'Employee',
      resource_id: employee._id,
      description: `Employee ${employee.full_name} linked to User ${user.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json({ message: 'Linked successfully', employee, user })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getDocument = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    const docId = req.params.docId
    const doc = employee.documents.id(docId)
    if (!doc) return res.status(404).json({ message: 'Document not found' })

    res.json(doc)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
