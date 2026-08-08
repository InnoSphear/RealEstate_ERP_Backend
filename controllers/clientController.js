import Client from '../models/Client.js'
import Employee from '../models/Employee.js'
import FollowUp from '../models/FollowUp.js'
import ActivityLog from '../models/ActivityLog.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

const cleanBody = (body) => {
  const removeWhenEmpty = ['property', 'assigned_to', 'interior_project', 'lead', 'transaction_type']
  const cleaned = { ...body }
  for (const field of removeWhenEmpty) {
    if (cleaned[field] === '' || cleaned[field] === null) delete cleaned[field]
  }
  return cleaned
}

export const createClient = async (req, res) => {
  try {
    const data = cleanBody(req.body)
    const client_id = data.client_id || `CL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const existing = await Client.findOne({ tenant: req.tenant._id, client_id })
    if (existing) return res.status(400).json({ message: 'Client with this ID already exists' })

    const client = await Client.create({ ...data, client_id, tenant: req.tenant._id, created_by: req.user._id })
    const populated = await Client.findById(client._id)
      .populate('assigned_to', 'full_name email employee_id')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_client',
      resource: 'Client',
      resource_id: client._id,
      description: `Client ${client.full_name} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getClients = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.source) filter.source = req.query.source
    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to
    if (req.query.converted !== undefined) filter.converted = req.query.converted === 'true'
    if (req.query.requirement_type) filter.requirement_type = req.query.requirement_type
    if (req.query.property) filter.property = req.query.property
    if (req.query.search) {
      filter.$or = [
        { full_name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { mobile: { $regex: req.query.search, $options: 'i' } },
        { client_id: { $regex: req.query.search, $options: 'i' } },
        { notes: { $regex: req.query.search, $options: 'i' } },
        { requirement: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    const dateFrom = req.query.date_from || req.query.from_date
    const dateTo = req.query.date_to || req.query.to_date
    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom)
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (req.query.scope !== 'all' && roleSlug !== 'admin' && roleSlug !== 'manager') {
      const employee = await Employee.findOne({ user: req.user._id, tenant: req.tenant._id, is_deleted: false })
      const roleFilter = [{ created_by: req.user._id }]
      if (employee) roleFilter.push({ assigned_to: employee._id })
      const roleOr = { $or: roleFilter }
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, roleOr]
        delete filter.$or
      } else {
        filter.$or = roleFilter
      }
    }

    const clients = await Client.find(filter)
      .populate('assigned_to', 'full_name email employee_id')
      .sort({ createdAt: -1 })

    res.json(clients)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getClientById = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    const clientFilter = { _id: req.params.id, tenant: req.tenant._id, is_deleted: false }
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      const employee = await Employee.findOne({ user: req.user._id, tenant: req.tenant._id, is_deleted: false })
      clientFilter.$or = [{ created_by: req.user._id }]
      if (employee) clientFilter.$or.push({ assigned_to: employee._id })
    }
    const client = await Client.findOne(clientFilter)
      .populate('assigned_to', 'full_name email employee_id phone')
      .populate('lead', 'full_name mobile')
    if (!client) return res.status(404).json({ message: 'Client not found' })
    res.json(client)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateClient = async (req, res) => {
  try {
    const data = cleanBody(req.body)
    delete data.tenant
    delete data.client_id
    delete data.is_deleted

    const oldClient = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!oldClient) return res.status(404).json({ message: 'Client not found' })

    if (data.property && data.property !== (oldClient.property?.toString() || '')) {
      const Property = (await import('../models/Property.js')).default
      await Property.findOneAndUpdate(
        { _id: data.property, tenant: req.tenant._id },
        { client: oldClient._id }
      )
      const oldProp = oldClient.property
      if (oldProp) {
        await Property.findOneAndUpdate(
          { _id: oldProp, tenant: req.tenant._id },
          { $unset: { client: '' } }
        )
      }
    }
    if (!data.property && oldClient.property) {
      const Property = (await import('../models/Property.js')).default
      await Property.findOneAndUpdate(
        { _id: oldClient.property, tenant: req.tenant._id },
        { $unset: { client: '' } }
      )
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    ).populate('assigned_to', 'full_name email employee_id')
    if (!client) return res.status(404).json({ message: 'Client not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_client',
      resource: 'Client',
      resource_id: client._id,
      description: `Client ${client.full_name} updated`,
      type: 'crud',
      severity: 'info',
      details: data,
    })

    res.json(client)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteClient = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug === 'interior_manager' || roleSlug === 'junior_interior_manager') {
      return res.status(403).json({ message: 'Interior managers cannot delete clients' })
    }
    const client = await Client.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!client) return res.status(404).json({ message: 'Client not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_client',
      resource: 'Client',
      resource_id: client._id,
      description: `Client ${client.full_name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Client deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadDocument = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!client) return res.status(404).json({ message: 'Client not found' })

    const name = req.body.name || (req.file ? req.file.originalname : '')
    let url = req.body.url
    let type = req.body.type || ''
    if (req.file) {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const result = await uploadToCloudinary(req.file.buffer)
        url = result.url
      } else {
        const fs = (await import('fs')).default
        const path = (await import('path')).default
        const { fileURLToPath } = (await import('url'))
        const __dirname = path.dirname(fileURLToPath(import.meta.url))
        const uploadsDir = path.join(__dirname, '..', 'uploads')
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
        const filename = `${Date.now()}-${req.file.originalname}`
        fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer)
        url = `/uploads/${filename}`
      }
      type = req.file.mimetype
    }
    if (!name || !url) return res.status(400).json({ message: 'Document name and file are required' })

    client.documents.push({ name, url, type, uploaded_at: new Date() })
    await client.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'upload_document',
      resource: 'Client',
      resource_id: client._id,
      description: `Document ${name} uploaded for ${client.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(client)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getTimeline = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!client) return res.status(404).json({ message: 'Client not found' })

    const timeline = []
    timeline.push({ type: 'client_created', date: client.createdAt, description: `Client ${client.full_name} was created` })
    if (client.converted_at) {
      timeline.push({ type: 'converted_from_lead', date: client.converted_at, description: 'Converted from lead' })
    }

    const SiteVisit = (await import('../models/SiteVisit.js')).default
    const visits = await SiteVisit.find({ client: client._id, tenant: req.tenant._id, is_deleted: false }).sort({ createdAt: -1 })
    visits.forEach((v) => {
      timeline.push({ type: 'site_visit', date: v.createdAt, description: `Site visit ${v.status} on ${v.scheduled_date}` })
    })

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date))
    res.json(timeline)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getCommunicationHistory = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!client) return res.status(404).json({ message: 'Client not found' })

    const history = await ActivityLog.find({
      tenant: req.tenant._id,
      resource: 'Client',
      resource_id: client._id,
    }).sort({ createdAt: -1 }).populate('user', 'full_name')

    res.json(history)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const convertFromLead = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!client) return res.status(404).json({ message: 'Client not found' })
    if (client.converted) return res.status(400).json({ message: 'Client already converted from a lead' })

    client.converted = true
    client.converted_at = new Date()
    const { converted_from_lead } = req.body
    if (converted_from_lead) {
      const Lead = (await import('../models/Lead.js')).default
      await Lead.findOneAndUpdate(
        { _id: converted_from_lead, tenant: req.tenant._id },
        { converted_to_client: true, converted_to_client_at: new Date(), converted_client: client._id }
      )
    }
    await client.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'convert_lead_to_client',
      resource: 'Client',
      resource_id: client._id,
      description: `Lead converted to client ${client.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(client)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getClientRequirements = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .select('requirement requirement_type budget_min budget_max preferred_locations property_type_preference notes')
    if (!client) return res.status(404).json({ message: 'Client not found' })
    res.json({
      requirement: client.requirement || '',
      requirement_type: client.requirement_type,
      budget_min: client.budget_min,
      budget_max: client.budget_max,
      preferred_locations: client.preferred_locations || [],
      property_type_preference: client.property_type_preference || '',
      notes: client.notes || '',
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addClientNote = async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ message: 'Note text is required' })

    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!client) return res.status(404).json({ message: 'Client not found' })

    client.notes_timeline.push({ text, createdAt: new Date() })
    await client.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'add_client_note',
      resource: 'Client',
      resource_id: client._id,
      description: `Note added for ${client.full_name}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
      type: 'crud',
      severity: 'info',
    })

    res.json(client)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getClientNotes = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .select('notes_timeline')
    if (!client) return res.status(404).json({ message: 'Client not found' })

    const notes = (client.notes_timeline || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json(notes)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getClientFollowUps = async (req, res) => {
  try {
    const followUps = await FollowUp.find({
      tenant: req.tenant._id,
      client: req.params.id,
      is_deleted: false,
    })
      .populate('assigned_to', 'full_name email')
      .populate('assigned_by', 'full_name')
      .sort({ follow_up_date: -1 })
    res.json(followUps)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
