import XLSX from 'xlsx'
import Lead from '../models/Lead.js'
import User from '../models/User.js'
import Client from '../models/Client.js'
import Property from '../models/Property.js'
import InteriorProject from '../models/InteriorProject.js'
import PropertyKey from '../models/PropertyKey.js'
import Branch from '../models/Branch.js'
import Employee from '../models/Employee.js'
import ActivityLog from '../models/ActivityLog.js'
import LeadHistory from '../models/LeadHistory.js'
import { notifyLeadAssignment } from '../services/notificationService.js'

const trackHistory = async ({ tenant, lead, user, field, old_value, new_value, type, description, metadata }) => {
  await LeadHistory.create({ tenant, lead, user, field, old_value, new_value, type, description, metadata })
}

export const createLead = async (req, res) => {
  try {
    const rest = { ...req.body }

    const duplicate = await Lead.findOne({
      tenant: req.tenant._id,
      is_deleted: false,
      $or: [
        { mobile: rest.mobile },
        ...(rest.email ? [{ email: rest.email }] : []),
      ],
    })
    if (duplicate) {
      return res.status(409).json({
        message: 'A lead with this mobile number or email already exists',
        duplicate: { _id: duplicate._id, full_name: duplicate.full_name },
      })
    }

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (!rest.assigned_to && roleSlug !== 'admin' && roleSlug !== 'manager') {
      rest.assigned_to = req.user._id
    }
    const lead = await Lead.create({
      ...rest,
      tenant: req.tenant._id,
      created_by: req.user._id,
      assigned_at: rest.assigned_to ? new Date() : undefined,
    })

    const populated = await Lead.findById(lead._id)
      .populate('assigned_to', 'full_name email')
      .populate('created_by', 'full_name email')
      .populate('converted_client', 'full_name mobile')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_lead',
      resource: 'Lead',
      resource_id: lead._id,
      description: `Lead ${lead.full_name} created`,
      type: 'crud',
      severity: 'info',
    })

    await trackHistory({
      tenant: req.tenant._id, lead: lead._id, user: req.user._id,
      type: 'creation', description: `Lead created with status "${lead.status}"`,
      new_value: { status: lead.status, source: lead.source },
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getLeads = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.source) filter.source = req.query.source
    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to
    if (req.query.converted_to_client !== undefined) filter.converted_to_client = req.query.converted_to_client === 'true'
    if (req.query.lead_score_min || req.query.lead_score_max) {
      filter.lead_score = {}
      if (req.query.lead_score_min) filter.lead_score.$gte = parseInt(req.query.lead_score_min)
      if (req.query.lead_score_max) filter.lead_score.$lte = parseInt(req.query.lead_score_max)
    }
    if (req.query.search) {
      filter.$or = [
        { full_name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { mobile: { $regex: req.query.search, $options: 'i' } },
        { source: { $regex: req.query.search, $options: 'i' } },
        { stage: { $regex: req.query.search, $options: 'i' } },
        { notes: { $regex: req.query.search, $options: 'i' } },
        { location_preference: { $regex: req.query.search, $options: 'i' } },
        { requirement: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    if (req.query.created_by_employee) {
      const emp = await Employee.findOne({ _id: req.query.created_by_employee, tenant: req.tenant._id }).select('user')
      if (emp && emp.user) filter.created_by = emp.user
    }
    const dateFrom = req.query.date_from || req.query.from_date
    const dateTo = req.query.date_to || req.query.to_date
    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom)
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      const visibilityOr = [
        { assigned_to: req.user._id },
        { created_by: req.user._id },
      ]
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: visibilityOr },
        ]
        delete filter.$or
      } else {
        filter.$or = visibilityOr
      }
    }

    const leads = await Lead.find(filter)
      .populate('assigned_to', 'full_name email')
      .populate('created_by', 'full_name email')
      .populate('converted_client', 'full_name mobile')
      .sort({ createdAt: -1 })

    res.json(leads)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getLeadById = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    const leadFilter = { _id: req.params.id, tenant: req.tenant._id, is_deleted: false }
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      leadFilter.$or = [
        { assigned_to: req.user._id },
        { created_by: req.user._id },
      ]
    }
    const lead = await Lead.findOne(leadFilter)
      .populate('assigned_to', 'full_name email phone')
      .populate('created_by', 'full_name email')
      .populate('converted_client', 'full_name mobile email')
      .populate('call_notes.created_by', 'full_name email')
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    res.json(lead)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateLead = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    delete data.call_notes

    const prev = await Lead.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!prev) return res.status(404).json({ message: 'Lead not found' })

    if (data.assigned_to && String(data.assigned_to) !== String(prev.assigned_to)) {
      data.assigned_at = new Date()
    }

    if (data.status === 'lost' && req.body.lost_reason) {
      data.lost_reason = req.body.lost_reason
    }

    if (data.status === 'lost' && !req.body.lost_reason && !prev.lost_reason) {
      data.lost_reason = 'Not specified'
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('assigned_to', 'full_name email')
      .populate('converted_client', 'full_name mobile')

    const changes = []
    for (const key of Object.keys(data)) {
      if (key === 'assigned_at') continue
      const oldVal = prev[key]
      const newVal = data[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field: key, old_value: oldVal, new_value: newVal })
      }
    }

    for (const ch of changes) {
      await trackHistory({
        tenant: req.tenant._id, lead: lead._id, user: req.user._id,
        type: ch.field === 'status' ? 'status_change' : ch.field === 'assigned_to' ? 'assignment' : 'update',
        field: ch.field, old_value: ch.old_value, new_value: ch.new_value,
        description: ch.field === 'status'
          ? `Status changed from "${ch.old_value}" to "${ch.new_value}"`
          : ch.field === 'assigned_to'
            ? 'Lead reassigned'
            : `${ch.field} updated`,
      })
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_lead',
      resource: 'Lead',
      resource_id: lead._id,
      description: `Lead ${lead.full_name} updated`,
      type: 'crud',
      severity: 'info',
      details: data,
    })

    res.json(lead)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteLead = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug === 'interior_manager' || roleSlug === 'junior_interior_manager') {
      return res.status(403).json({ message: 'Interior managers cannot delete leads' })
    }
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_lead',
      resource: 'Lead',
      resource_id: lead._id,
      description: `Lead ${lead.full_name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Lead deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' })
    }
    const result = await Lead.deleteMany(
      { _id: { $in: ids }, tenant: req.tenant._id }
    )
    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_delete_leads',
      resource: 'Lead',
      resource_id: null,
      description: `${result.deletedCount} leads bulk deleted`,
      type: 'crud',
      severity: 'warning',
    })
    res.json({ message: `${result.deletedCount} leads deleted successfully` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const bulkImport = async (req, res) => {
  try {
    let leads = req.body.leads

    if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      leads = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'No leads found in file or body' })
    }

    const fieldMap = {
      'name': 'full_name', 'full name': 'full_name', 'full_name': 'full_name', 'lead name': 'full_name',
      'email': 'email', 'e-mail': 'email',
      'phone': 'mobile', 'mobile': 'mobile', 'contact': 'mobile', 'phone number': 'mobile', 'contact number': 'mobile',
      'alternate mobile': 'alternate_mobile', 'alt mobile': 'alternate_mobile', 'alternate_mobile': 'alternate_mobile', 'alt_mobile': 'alternate_mobile', 'alt phone': 'alternate_mobile',
      'source': 'source', 'lead source': 'source',
      'address': 'address',
      'city': 'city', 'state': 'state', 'pincode': 'pincode', 'zip': 'pincode',
      'requirement': 'requirement', 'requirements': 'requirement',
      'budget': 'budget',
      'property type': 'property_type', 'property_type': 'property_type',
      'society': 'society', 'society name': 'society',
      'tower': 'tower', 'tower number': 'tower',
      'flat number': 'flat_number', 'flat no': 'flat_number', 'unit number': 'flat_number', 'flat_no': 'flat_number', 'flat': 'flat_number',
      'flat size': 'flat_size', 'size': 'flat_size', 'flat_size': 'flat_size', 'sqft': 'flat_size', 'carpet area': 'flat_size',
      'key available': 'key_available', 'key': 'key_available', 'keys': 'key_available',
      'preferred locations': 'preferred_locations', 'preferred location': 'preferred_locations', 'preferred_locations': 'preferred_locations',
      'notes': 'notes', 'remark': 'notes', 'remarks': 'notes',
      'status': 'status', 'lead status': 'status',
    }

    const sourceMap = {
      'facebook': 'facebook', 'fb': 'facebook',
      'google': 'google', 'google ads': 'google',
      'instagram': 'instagram', 'insta': 'instagram',
      'website': 'website', 'online': 'website',
      'walk in': 'walk_in', 'walkin': 'walk_in', 'walk-in': 'walk_in', 'direct': 'walk_in',
      'referral': 'referral', 'reference': 'referral', 'refer': 'referral', 'friend': 'referral',
      '99acres': '99acres', '99 acres': '99acres',
      'magicbricks': 'magicbricks', 'magic bricks': 'magicbricks',
      'housing': 'housing', 'housing.com': 'housing',
      'social media': 'social_media', 'social': 'social_media',
      'call': 'call', 'phone': 'call', 'incoming call': 'call',
      'ad': 'ad', 'advertisement': 'ad', 'ads': 'ad',
    }

    const statusMap = {
      'new': 'new', 'fresh': 'new', 'incoming': 'new',
      'contacted': 'contacted', 'called': 'contacted', 'reach out': 'contacted',
      'hot': 'hot', 'qualified': 'hot', 'high interest': 'hot',
      'warm': 'warm', 'medium interest': 'warm',
      'cold': 'cold', 'low interest': 'cold',
      'follow up': 'follow_up', 'followup': 'follow_up', 'follow_up': 'follow_up', 'callback': 'follow_up', 'call back': 'follow_up',
      'site visit': 'site_visit', 'sitevisit': 'site_visit', 'site_visit': 'site_visit', 'meeting': 'site_visit', 'demo': 'site_visit', 'site visit done': 'site_visit',
      'negotiation': 'negotiation', 'proposal': 'negotiation', 'quoting': 'negotiation', 'price negotiation': 'negotiation',
      'won': 'won', 'win': 'won', 'closed won': 'won', 'closed-won': 'won', 'deal won': 'won',
      'lost': 'lost', 'loss': 'lost', 'closed lost': 'lost', 'closed-lost': 'lost', 'deal lost': 'lost', 'not interested': 'lost', 'not_interested': 'lost', 'no interest': 'lost',
      'interested': 'contacted', 'not now': 'cold',
    }

    const numericFields = ['budget', 'lead_score', 'flat_size']

    const parseNumber = (raw) => {
      if (raw === '' || raw == null) return undefined
      if (typeof raw === 'number') return raw
      let s = String(raw).trim()
      s = s.replace(/[₹$€£¥,]/g, '')
      const lower = s.toLowerCase().replace(/\s+/g, ' ')
      let multiplier = 1
      if (/crore?/.test(lower)) { multiplier = 10000000; s = s.replace(/crore.*/i, '') }
      else if (/lakh?/.test(lower) || /lac/.test(lower)) { multiplier = 100000; s = s.replace(/lakh?.*|lac/i, '') }
      else if (/thousand/.test(lower)) { multiplier = 1000; s = s.replace(/thousand.*/i, '') }
      s = s.trim()
      const num = parseFloat(s)
      return isNaN(num) ? undefined : num * multiplier
    }

    const sizeHeaderPattern = /(flat\s*size|size|sq\s*\.?\s*ft|sqft|carpet\s*area|area)/i

    const normalizeKeys = (obj) => {
      const result = {}
      for (const [key, val] of Object.entries(obj)) {
        const header = key.trim().toLowerCase().replace(/\s+/g, ' ')
        let normalized = fieldMap[header]
        if (!normalized) {
          const bare = header.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
          normalized = fieldMap[bare]
        }
        if (!normalized && sizeHeaderPattern.test(header)) {
          normalized = 'flat_size'
        }
        if (!normalized) normalized = key
        let value = typeof val === 'string' ? val.trim() : val
        if (normalized === 'source' && typeof value === 'string') {
          value = sourceMap[value.toLowerCase().trim()] || 'other'
        }
        if (normalized === 'status' && typeof value === 'string') {
          value = statusMap[value.toLowerCase().trim()] || 'new'
        }
        if (numericFields.includes(normalized)) {
          value = parseNumber(value)
        }
        if (normalized === 'preferred_locations' && typeof value === 'string') {
          value = value.split(/[,|;]/).map(s => s.trim()).filter(Boolean)
        }
        if (normalized === 'key_available') {
          if (typeof value === 'string') {
            value = ['yes', 'true', 'y', '1', 'available'].includes(value.toLowerCase().trim())
          } else if (typeof value === 'number') {
            value = value === 1
          } else {
            value = Boolean(value)
          }
        }
        result[normalized] = value
      }
      return result
    }

    const results = { created: [], errors: [] }
    for (const raw of leads) {
      try {
        const leadData = normalizeKeys(raw)
        if (!leadData.full_name || !leadData.mobile || !leadData.source) {
          results.errors.push({ row: leadData.full_name || leadData.mobile || '(unknown)', message: 'Name, mobile, and source are required' })
          continue
        }
        const created = await Lead.create({ ...leadData, tenant: req.tenant._id, assigned_to: req.user._id, created_by: req.user._id })
        results.created.push({ _id: created._id, full_name: created.full_name })
      } catch (err) {
        results.errors.push({ row: raw.full_name || raw.name || '(unknown)', message: err.message })
      }
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_import_leads',
      resource: 'Lead',
      description: `Bulk imported ${results.created.length} leads (${results.errors.length} errors)`,
      type: 'crud',
      severity: 'info',
      details: results,
    })

    res.status(201).json(results)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const bulkTransferLeads = async (req, res) => {
  try {
    const { leadIds, assigned_to } = req.body
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ message: 'leadIds array is required' })
    }
    if (!assigned_to) return res.status(400).json({ message: 'assigned_to user is required' })

    const leads = await Lead.find({ _id: { $in: leadIds }, tenant: req.tenant._id, is_deleted: false })
    if (leads.length === 0) return res.status(404).json({ message: 'No leads found' })

    const targetUser = await User.findOne({ _id: assigned_to, is_deleted: false })
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' })

    const now = new Date()
    const updated = await Lead.updateMany(
      { _id: { $in: leadIds }, tenant: req.tenant._id, is_deleted: false },
      { assigned_to, assigned_at: now }
    )

    for (const lead of leads) {
      await trackHistory({
        tenant: req.tenant._id, lead: lead._id, user: req.user._id,
        type: 'assignment', field: 'assigned_to',
        old_value: lead.assigned_to, new_value: assigned_to,
        description: 'Lead assigned to a new user',
      })
      try { await notifyLeadAssignment(lead, targetUser) } catch {}
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_transfer_leads',
      resource: 'Lead',
      resource_id: leads[0]._id,
      description: `Bulk transferred ${updated.modifiedCount} lead(s)`,
      type: 'crud',
      severity: 'info',
    })

    res.json({ message: `${updated.modifiedCount} lead(s) transferred successfully`, count: updated.modifiedCount })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const transferToSales = async (req, res) => {
  try {
    const { assigned_to } = req.body
    if (!assigned_to) return res.status(400).json({ message: 'Assigned to user is required' })

    const prev = await Lead.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!prev) return res.status(404).json({ message: 'Lead not found' })

    const targetUser = await User.findOne({ _id: assigned_to, is_deleted: false })
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' })

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      { assigned_to, assigned_at: new Date() },
      { new: true }
    ).populate('assigned_to', 'full_name email')
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    await trackHistory({
      tenant: req.tenant._id, lead: lead._id, user: req.user._id,
      type: 'assignment', field: 'assigned_to',
      old_value: prev.assigned_to, new_value: assigned_to,
      description: 'Lead assigned to a new user',
    })

    try { await notifyLeadAssignment(lead, targetUser) } catch {}

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'transfer_lead',
      resource: 'Lead',
      resource_id: lead._id,
      description: `Lead ${lead.full_name} transferred to sales`,
      type: 'crud',
      severity: 'info',
    })

    res.json(lead)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getLeadsByScore = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.min_score) filter.lead_score = { $gte: parseInt(req.query.min_score) }

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      filter.$or = [
        { assigned_to: req.user._id },
        { created_by: req.user._id },
      ]
    }

    const leads = await Lead.find(filter)
      .populate('assigned_to', 'full_name email')
      .sort({ lead_score: -1 })

    res.json({
      total: leads.length,
      average_score: leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.lead_score, 0) / leads.length) : 0,
      leads,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const convertToClient = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!lead) return res.status(404).json({ message: 'Lead not found' })
    if (lead.converted_to_client) return res.status(400).json({ message: 'Lead already converted to client' })

    const { transaction_type, property_id, interior_project, key_taken, key_id, create_new_property, property_form } = req.body

    const clientId = `CL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    let propertyRef = null
    let interiorRef = null
    let keyRef = null

    if (property_id && (transaction_type === 'sell' || transaction_type === 'purchase' || transaction_type === 'rent')) {
      const prop = await Property.findOne({ _id: property_id, tenant: req.tenant._id, is_deleted: false })
      if (!prop) return res.status(400).json({ message: 'Property not found' })
      propertyRef = prop._id
    }

    if (create_new_property && property_form && (transaction_type === 'sell' || transaction_type === 'purchase' || transaction_type === 'rent')) {
      const generatedId = property_form.property_id || `PR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const bodyData = { ...property_form }
      if (typeof bodyData.amenities === 'string') {
        bodyData.amenities = bodyData.amenities.split(',').map(a => a.trim()).filter(Boolean)
      }
      if (typeof bodyData.materials === 'string') {
        try { bodyData.materials = JSON.parse(bodyData.materials) } catch (e) { bodyData.materials = [] }
      }
      if (bodyData.key_available === 'true') bodyData.key_available = true
      if (bodyData.key_available === 'false') bodyData.key_available = false
      const newProperty = await Property.create({ ...bodyData, property_id: generatedId, tenant: req.tenant._id, created_by: req.user._id })
      if (bodyData.key_available === true) {
        const keyCount = await PropertyKey.countDocuments({ tenant: req.tenant._id, property: newProperty._id })
        const newKey = await PropertyKey.create({
          tenant: req.tenant._id,
          property: newProperty._id,
          key_number: `${generatedId}-KEY-${keyCount + 1}`,
          status: 'available',
        })
        keyRef = newKey._id
      }
      propertyRef = newProperty._id
    }

    if (key_taken) {
      let propertyKey = null
      if (keyRef) {
        propertyKey = await PropertyKey.findById(keyRef)
      } else if (key_id) {
        propertyKey = await PropertyKey.findOne({ _id: key_id, tenant: req.tenant._id, is_deleted: false })
      }
      if (propertyKey && propertyKey.status === 'available') {
        propertyKey.status = 'issued'
        propertyKey.key_holder = lead.assigned_to
        propertyKey.issue_date = new Date()
        propertyKey.issued_to = lead.assigned_to
        propertyKey.issued_by = req.user._id
        propertyKey.history.push({
          action: 'issued',
          issued_to: lead.assigned_to,
          issued_by: req.user._id,
          issue_date: new Date(),
          notes: `Key issued during lead conversion for ${lead.full_name}`,
          timestamp: new Date(),
        })
        await propertyKey.save()
        keyRef = propertyKey._id
      }
    }

    const client = await Client.create({
      tenant: lead.tenant,
      client_id: clientId,
      full_name: lead.full_name,
      email: lead.email,
      mobile: lead.mobile,
      alternate_mobile: lead.alternate_mobile,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      pincode: lead.pincode,
      source: lead.source === 'walk_in' ? 'walk_in' : lead.source,
      assigned_to: lead.assigned_to,
      notes: lead.notes,
      converted: true,
      converted_at: new Date(),
      preferred_locations: lead.preferred_locations,
      budget_min: lead.budget ? lead.budget * 0.8 : 0,
      budget_max: lead.budget || 0,
      transaction_type: transaction_type || undefined,
      lead: lead._id,
      created_by: req.user._id,
    })

    if (transaction_type === 'interior' && interior_project) {
      let branchId = interior_project.branch_id
      if (!branchId) {
        const defaultBranch = await Branch.findOne().sort({ createdAt: 1 })
        if (defaultBranch) branchId = defaultBranch._id
      }
      const project = await InteriorProject.create({
        tenant: lead.tenant,
        client_id: client._id,
        assigned_to: lead.assigned_to,
        branch_id: branchId,
        project_code: interior_project.project_code || `IP-${Date.now()}`,
        title: interior_project.title || `${lead.full_name} - Interior`,
        status: interior_project.status || 'not_started',
        project_type: interior_project.project_type || 'residential',
        address: interior_project.address || lead.address,
        total_area_sqft: interior_project.total_area_sqft,
        start_date: interior_project.start_date,
        expected_end_date: interior_project.expected_end_date,
        scope_of_work: interior_project.scope_of_work,
        estimated_budget: interior_project.estimated_budget,
        approved_budget: interior_project.approved_budget,
        notes: interior_project.notes,
      })
      interiorRef = project._id
      client.interior_project = project._id
      await client.save()
    }

    if (propertyRef) {
      client.property = propertyRef
      await client.save()
    }

    lead.converted_to_client = true
    lead.converted_to_client_at = new Date()
    lead.converted_client = client._id
    lead.conversion_details = {
      transaction_type: transaction_type || undefined,
      property: propertyRef || undefined,
      interior_project: interiorRef || undefined,
      key_taken: key_taken || false,
      key: keyRef || undefined,
    }
    await lead.save()

    const populatedClient = await Client.findById(client._id)
      .populate('assigned_to', 'full_name email')
      .populate('property')
      .populate('interior_project')

    await trackHistory({
      tenant: req.tenant._id, lead: lead._id, user: req.user._id,
      type: 'conversion',
      description: `Lead converted to client (${client.client_id})`,
      new_value: { client_id: client.client_id, client_name: client.full_name, transaction_type },
    })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'convert_lead_to_client',
      resource: 'Lead',
      resource_id: lead._id,
      description: `Lead ${lead.full_name} converted to client ${client.client_id} (${transaction_type})`,
      type: 'crud',
      severity: 'info',
    })

    const populatedLead = await Lead.findById(lead._id)
      .populate('assigned_to', 'full_name email')
      .populate('converted_client')
      .populate('conversion_details.property')
      .populate('conversion_details.interior_project')
      .populate('conversion_details.key')

    res.status(201).json({ lead: populatedLead, client: populatedClient })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const addCallNote = async (req, res) => {
  try {
    const { note } = req.body
    if (!note) return res.status(400).json({ message: 'Call note is required' })

    const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!lead) return res.status(404).json({ message: 'Lead not found' })

    lead.call_notes.push({ text: note, createdAt: new Date(), created_by: req.user._id })
    lead.last_contacted = new Date()
    await lead.save()

    await trackHistory({
      tenant: req.tenant._id, lead: lead._id, user: req.user._id,
      type: 'call_note',
      description: `Call note added: "${note.substring(0, 100)}${note.length > 100 ? '...' : ''}"`,
      metadata: { note },
    })

    const populated = await Lead.findById(lead._id)
      .populate('assigned_to', 'full_name email')
      .populate('created_by', 'full_name email')
      .populate('converted_client', 'full_name mobile')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getLeadHistory = async (req, res) => {
  try {
    const history = await LeadHistory.find({ tenant: req.tenant._id, lead: req.params.id })
      .populate('user', 'full_name email')
      .sort({ createdAt: -1 })
      .limit(100)

    res.json(history)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const exportLeads = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.source) filter.source = req.query.source
    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to
    const dateFrom = req.query.from_date || req.query.date_from
    const dateTo = req.query.to_date || req.query.date_to
    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom)
      if (dateTo) filter.createdAt.$lte = new Date(dateTo)
    }

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      const visibilityOr = [
        { assigned_to: req.user._id },
        { created_by: req.user._id },
      ]
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: visibilityOr },
        ]
        delete filter.$or
      } else {
        filter.$or = visibilityOr
      }
    }

    const leads = await Lead.find(filter)
      .populate('assigned_to', 'full_name')
      .populate('created_by', 'full_name')
      .sort({ createdAt: -1 })

    const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'))
    const header = 'Name,Email,Mobile,Alternate Mobile,Source,Status,Score,Society,Tower,Flat Number,Flat Size sqft,Key Available,Address,City,State,Pincode,Requirement,Budget,Property Type,Assigned To,Created By,Created Date'
    const rows = leads.map(l =>
      `"${esc(l.full_name)}","${esc(l.email)}","${esc(l.mobile)}","${esc(l.alternate_mobile)}","${esc(l.source)}","${esc(l.status)}",${l.lead_score ?? ''},"${esc(l.society)}","${esc(l.tower)}","${esc(l.flat_number)}",${l.flat_size ?? ''},"${l.key_available ? 'Yes' : 'No'}","${esc(l.address)}","${esc(l.city)}","${esc(l.state)}","${esc(l.pincode)}","${esc(l.requirement)}",${l.budget ?? ''},"${esc(l.property_type)}","${esc(l.assigned_to?.full_name)}","${esc(l.created_by?.full_name)}","${l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : ''}"`
    ).join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)
    res.send(`${header}\n${rows}`)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
