import SiteVisit from '../models/SiteVisit.js'
import PropertyKey from '../models/PropertyKey.js'
import ActivityLog from '../models/ActivityLog.js'

const releaseKey = async (keyId) => {
  const key = await PropertyKey.findById(keyId)
  if (key && (key.status === 'scheduled' || key.status === 'issued')) {
    key.status = 'available'
    key.history.push({ action: 'returned', notes: 'Key released from site visit', timestamp: new Date() })
    await key.save()
  }
}

const scheduleKey = async (keyId, visitId) => {
  const key = await PropertyKey.findOne({ _id: keyId, status: 'available' })
  if (key) {
    key.status = 'scheduled'
    key.history.push({ action: 'scheduled', notes: `Scheduled for site visit ${visitId}`, timestamp: new Date() })
    await key.save()
  }
}

const handleKeysUpdate = async (existingKeys, newKeys, visitId) => {
  const oldSet = new Set((existingKeys || []).map(k => k.toString()))
  const newSet = new Set((newKeys || []).map(k => k.toString()))

  for (const k of oldSet) {
    if (!newSet.has(k)) await releaseKey(k)
  }
  for (const k of newSet) {
    if (!oldSet.has(k)) await scheduleKey(k, visitId)
  }
}

const populateQuery = (query) =>
  query
    .populate('client', 'client_id full_name mobile')
    .populate('property', 'property_id location property_type')
    .populate('lead', 'full_name')
    .populate('assigned_executive', 'full_name email')
    .populate({ path: 'property_keys', populate: { path: 'key_holder issued_to issued_by', select: 'full_name email' } })

export const createSiteVisit = async (req, res) => {
  try {
    if (req.body.client_id) { req.body.client = req.body.client_id; delete req.body.client_id }
    if (req.body.property_id) { req.body.property = req.body.property_id; delete req.body.property_id }
    if (req.body.notes) { req.body.visit_notes = req.body.notes; delete req.body.notes }
    if (req.body.property_keys && !Array.isArray(req.body.property_keys)) {
      req.body.property_keys = [req.body.property_keys]
    }
    const { client, property, assigned_executive, scheduled_date } = req.body
    if (!client || !property || !assigned_executive || !scheduled_date) {
      return res.status(400).json({ message: 'Client, property, assigned executive, and scheduled date are required' })
    }

    const visit = await SiteVisit.create({ ...req.body, tenant: req.tenant._id })

    if (req.body.property_keys?.length) {
      for (const keyId of req.body.property_keys) {
        await scheduleKey(keyId, visit._id)
      }
    }

    const populated = await populateQuery(SiteVisit.findById(visit._id))

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_site_visit',
      resource: 'SiteVisit',
      resource_id: visit._id,
      description: `Site visit scheduled for ${populated.client?.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getSiteVisits = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.client) filter.client = req.query.client
    if (req.query.property) filter.property = req.query.property
    if (req.query.assigned_executive) filter.assigned_executive = req.query.assigned_executive
    if (req.query.lead) filter.lead = req.query.lead
    if (req.query.outcome) filter.outcome = req.query.outcome
    if (req.query.from_date || req.query.to_date) {
      filter.scheduled_date = {}
      if (req.query.from_date) filter.scheduled_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.scheduled_date.$lte = new Date(req.query.to_date)
    }

    const visits = await populateQuery(SiteVisit.find(filter).sort({ scheduled_date: -1 }))

    res.json(visits)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getSiteVisitById = async (req, res) => {
  try {
    const visit = await populateQuery(SiteVisit.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false }))
    if (!visit) return res.status(404).json({ message: 'Site visit not found' })
    res.json(visit)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateSiteVisit = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    if (data.client_id) { data.client = data.client_id; delete data.client_id }
    if (data.property_id) { data.property = data.property_id; delete data.property_id }
    if (data.notes) { data.visit_notes = data.notes; delete data.notes }
    if (data.property_keys && !Array.isArray(data.property_keys)) {
      data.property_keys = [data.property_keys]
    }

    const existing = await SiteVisit.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Site visit not found' })

    if (data.property_keys) {
      await handleKeysUpdate(existing.property_keys, data.property_keys, req.params.id)
    }

    const visit = await SiteVisit.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
    if (!visit) return res.status(404).json({ message: 'Site visit not found' })

    const populated = await populateQuery(SiteVisit.findById(visit._id))

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const confirmSiteVisit = async (req, res) => {
  try {
    const visit = await SiteVisit.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: 'scheduled' },
      { status: 'confirmed', client_confirmed: true },
      { new: true }
    )
    if (!visit) return res.status(404).json({ message: 'Site visit not found or already processed' })

    if (visit.property_keys?.length) {
      for (const keyRef of visit.property_keys) {
        const key = await PropertyKey.findById(keyRef)
        if (key && key.status === 'scheduled') {
          key.status = 'issued'
          key.issued_to = visit.assigned_executive
          key.issued_by = req.user._id
          key.issue_date = new Date()
          key.key_holder = visit.assigned_executive
          key.history.push({ action: 'issued', issued_to: visit.assigned_executive, issued_by: req.user._id, issue_date: new Date(), notes: 'Key issued for confirmed site visit', timestamp: new Date() })
          await key.save()
        }
      }
    }

    const populated = await populateQuery(SiteVisit.findById(visit._id))

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'confirm_site_visit',
      resource: 'SiteVisit',
      resource_id: visit._id,
      description: 'Site visit confirmed',
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const completeSiteVisit = async (req, res) => {
  try {
    const { outcome, visit_notes, client_feedback } = req.body
    const visit = await SiteVisit.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: { $in: ['scheduled', 'confirmed'] } },
      { status: 'completed', outcome: outcome || 'none', visit_notes, client_feedback },
      { new: true }
    )
    if (!visit) return res.status(404).json({ message: 'Site visit not found or already completed' })

    if (visit.property_keys?.length) {
      for (const keyRef of visit.property_keys) {
        const key = await PropertyKey.findById(keyRef)
        if (key && (key.status === 'scheduled' || key.status === 'issued')) {
          key.status = 'available'
          key.history.push({ action: 'returned', notes: 'Site visit completed', timestamp: new Date() })
          await key.save()
        }
      }
    }

    const populated = await populateQuery(SiteVisit.findById(visit._id))

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'complete_site_visit',
      resource: 'SiteVisit',
      resource_id: visit._id,
      description: 'Site visit completed',
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const cancelSiteVisit = async (req, res) => {
  try {
    const { cancellation_reason } = req.body
    const visit = await SiteVisit.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: { $in: ['scheduled', 'confirmed'] } },
      { status: 'cancelled', cancellation_reason },
      { new: true }
    )
    if (!visit) return res.status(404).json({ message: 'Site visit not found or already processed' })

    if (visit.property_keys?.length) {
      for (const keyRef of visit.property_keys) {
        await releaseKey(keyRef)
      }
    }

    const populated = await populateQuery(SiteVisit.findById(visit._id))

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'cancel_site_visit',
      resource: 'SiteVisit',
      resource_id: visit._id,
      description: 'Site visit cancelled',
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const rescheduleSiteVisit = async (req, res) => {
  try {
    const { rescheduled_date, rescheduled_reason } = req.body
    if (!rescheduled_date) return res.status(400).json({ message: 'Rescheduled date is required' })

    const visit = await SiteVisit.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: { $in: ['scheduled', 'confirmed'] } },
      { status: 'rescheduled', rescheduled_date, scheduled_date: rescheduled_date, rescheduled_reason },
      { new: true }
    )
    if (!visit) return res.status(404).json({ message: 'Site visit not found or already processed' })

    const populated = await populateQuery(SiteVisit.findById(visit._id))

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'reschedule_site_visit',
      resource: 'SiteVisit',
      resource_id: visit._id,
      description: 'Site visit rescheduled',
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const convertSiteVisit = async (req, res) => {
  try {
    const visit = await SiteVisit.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!visit) return res.status(404).json({ message: 'Site visit not found' })
    if (visit.converted) return res.status(400).json({ message: 'Site visit already converted' })

    visit.converted = true
    visit.converted_at = new Date()
    visit.outcome = 'booked'
    await visit.save()

    if (visit.client) {
      const Client = (await import('../models/Client.js')).default
      await Client.findOneAndUpdate(
        { _id: visit.client, tenant: req.tenant._id },
        { status: 'won' }
      )
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'convert_site_visit',
      resource: 'SiteVisit',
      resource_id: visit._id,
      description: 'Site visit converted to deal',
      type: 'crud',
      severity: 'info',
    })

    res.json(visit)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const bulkDeleteSiteVisits = async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' })
    }

    const visits = await SiteVisit.find({ _id: { $in: ids }, tenant: req.tenant._id })

    for (const visit of visits) {
      if (visit.property_keys?.length) {
        for (const keyRef of visit.property_keys) {
          await releaseKey(keyRef)
        }
      }
      await visit.deleteOne()
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_delete_site_visits',
      resource: 'SiteVisit',
      description: `${visits.length} site visit(s) deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: `${visits.length} site visit(s) deleted successfully`, count: visits.length })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
