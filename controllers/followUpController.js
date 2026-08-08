import FollowUp from '../models/FollowUp.js'
import Lead from '../models/Lead.js'
import Client from '../models/Client.js'
import ActivityLog from '../models/ActivityLog.js'

export const createFollowUp = async (req, res) => {
  try {
    if (req.body.lead_id) { req.body.lead = req.body.lead_id; delete req.body.lead_id }
    if (req.body.client_id) { req.body.client = req.body.client_id; delete req.body.client_id }
    const { lead, client, assigned_to, follow_up_date } = req.body
    if ((!lead && !client) || !assigned_to || !follow_up_date) {
      return res.status(400).json({ message: 'Lead or client, assigned_to, and follow_up_date are required' })
    }

    const snapshotData = {}
    if (lead) {
      const leadDoc = await Lead.findOne({ _id: lead, tenant: req.tenant._id }).select('full_name mobile')
      if (leadDoc) {
        snapshotData.lead_name = leadDoc.full_name
        snapshotData.lead_mobile = leadDoc.mobile
      }
    }
    if (client) {
      const clientDoc = await Client.findOne({ _id: client, tenant: req.tenant._id }).select('client_id full_name mobile')
      if (clientDoc) {
        snapshotData.client_name = clientDoc.full_name
        snapshotData.client_mobile = clientDoc.mobile
        snapshotData.client_id_value = clientDoc.client_id
      }
    }

    const followUp = await FollowUp.create({
      ...req.body,
      ...snapshotData,
      tenant: req.tenant._id,
      assigned_by: req.user._id,
    })

    if (lead) {
      await Lead.findOneAndUpdate(
        { _id: lead, tenant: req.tenant._id },
        { next_follow_up: follow_up_date, last_contacted: new Date() }
      )
    }

    const populated = await FollowUp.findById(followUp._id)
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email')
      .populate('assigned_by', 'full_name')

    const target = lead ? `lead ${populated.lead?.full_name || ''}` : `client ${populated.client?.full_name || ''}`

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_follow_up',
      resource: 'FollowUp',
      resource_id: followUp._id,
      description: `Follow-up created for ${target}`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getFollowUps = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to
    if (req.query.lead) filter.lead = req.query.lead
    if (req.query.client) filter.client = req.query.client

    if (req.query.classification) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      switch (req.query.classification) {
        case 'due':
          filter.status = 'pending'
          filter.follow_up_date = { $gte: today, $lt: tomorrow }
          break
        case 'overdue':
          filter.status = 'pending'
          filter.follow_up_date = { $lt: today }
          break
        case 'completed':
          filter.status = 'completed'
          break
        case 'pending':
          filter.status = 'pending'
          filter.follow_up_date = { $gte: today }
          break
      }
    }

    if (!req.query.classification) {
      if (req.query.status) filter.status = req.query.status
      if (req.query.from_date || req.query.to_date || req.query.date_from || req.query.date_to) {
        filter.follow_up_date = {}
        const fromDate = req.query.from_date || req.query.date_from
        const toDate = req.query.to_date || req.query.date_to
        if (fromDate) filter.follow_up_date.$gte = new Date(fromDate)
        if (toDate) filter.follow_up_date.$lte = new Date(toDate)
      }
    }

    const andConditions = []

    if (req.query.search) {
      const regex = { $regex: req.query.search, $options: 'i' }
      andConditions.push({
        $or: [
          { reason: regex },
          { notes: regex },
          { follow_up_type: regex },
          { follow_up_mode: regex },
        ]
      })
    }

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      andConditions.push({
        $or: [
          { assigned_to: req.user._id },
          { assigned_by: req.user._id },
        ]
      })
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions
    }

    const followUps = await FollowUp.find(filter)
      .populate('lead', 'full_name mobile status')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email phone')
      .populate('assigned_by', 'full_name email')
      .sort({ follow_up_date: 1 })

    const enriched = followUps.map((fu) => {
      const doc = fu.toObject()
      if (!doc.lead && doc.lead_name) {
        doc.lead = { _id: fu.lead, full_name: doc.lead_name, mobile: doc.lead_mobile || '' }
      }
      if (!doc.client && doc.client_name) {
        doc.client = { _id: fu.client, client_id: doc.client_id_value || '', full_name: doc.client_name, mobile: doc.client_mobile || '' }
      }
      return doc
    })

    res.json(enriched)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getFollowUpCounts = async (req, res) => {
  try {
    const tenant = req.tenant._id
    const baseFilter = { tenant, is_deleted: false }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (req.query.assigned_to) baseFilter.assigned_to = req.query.assigned_to

    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      if (!req.query.assigned_to) {
        baseFilter.$or = [
          { assigned_to: req.user._id },
          { assigned_by: req.user._id },
        ]
      }
    }

    const [total, due, overdue, completed, pending] = await Promise.all([
      FollowUp.countDocuments(baseFilter),
      FollowUp.countDocuments({ ...baseFilter, status: 'pending', follow_up_date: { $gte: today, $lt: tomorrow } }),
      FollowUp.countDocuments({ ...baseFilter, status: 'pending', follow_up_date: { $lt: today } }),
      FollowUp.countDocuments({ ...baseFilter, status: 'completed' }),
      FollowUp.countDocuments({ ...baseFilter, status: 'pending', follow_up_date: { $gte: today } }),
    ])

    res.json({ total, due, overdue, completed, pending })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getFollowUpById = async (req, res) => {
  try {
    const followUp = await FollowUp.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('lead', 'full_name mobile status source')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email phone')
      .populate('assigned_by', 'full_name')
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' })
    const doc = followUp.toObject()
    if (!doc.lead && doc.lead_name) {
      doc.lead = { _id: followUp.lead, full_name: doc.lead_name, mobile: doc.lead_mobile || '' }
    }
    if (!doc.client && doc.client_name) {
      doc.client = { _id: followUp.client, client_id: doc.client_id_value || '', full_name: doc.client_name, mobile: doc.client_mobile || '' }
    }
    res.json(doc)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateFollowUp = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    if (data.lead_id) { data.lead = data.lead_id; delete data.lead_id }
    if (data.client_id) { data.client = data.client_id; delete data.client_id }

    const followUp = await FollowUp.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email')

    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' })

    if (followUp.lead && data.follow_up_date) {
      await Lead.findOneAndUpdate(
        { _id: followUp.lead, tenant: req.tenant._id },
        { next_follow_up: data.follow_up_date, last_contacted: new Date() }
      )
    }

    res.json(followUp)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const completeFollowUp = async (req, res) => {
  try {
    const { completion_notes } = req.body
    const followUp = await FollowUp.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: 'pending' },
      { status: 'completed', completed_at: new Date(), completion_notes },
      { new: true }
    )
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name')

    if (!followUp) return res.status(404).json({ message: 'Follow-up not found or already completed' })

    if (followUp.lead) {
      const nextFu = await FollowUp.findOne({
        tenant: req.tenant._id, lead: followUp.lead,
        _id: { $ne: followUp._id }, is_deleted: false, status: 'pending',
      }).sort({ follow_up_date: 1 })
      await Lead.findOneAndUpdate(
        { _id: followUp.lead, tenant: req.tenant._id },
        {
          last_contacted: new Date(),
          ...(nextFu ? { next_follow_up: nextFu.follow_up_date } : { $unset: { next_follow_up: '' } }),
        }
      )
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'complete_follow_up',
      resource: 'FollowUp',
      resource_id: followUp._id,
      description: 'Follow-up completed',
      type: 'crud',
      severity: 'info',
    })

    res.json(followUp)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const rescheduleFollowUp = async (req, res) => {
  try {
    const { rescheduled_date, notes } = req.body
    if (!rescheduled_date) return res.status(400).json({ message: 'Rescheduled date is required' })

    const followUp = await FollowUp.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false, status: 'pending' },
      { status: 'rescheduled', rescheduled_date, follow_up_date: rescheduled_date, notes },
      { new: true }
    )
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name')

    if (!followUp) return res.status(404).json({ message: 'Follow-up not found or already completed' })

    if (followUp.lead) {
      await Lead.findOneAndUpdate(
        { _id: followUp.lead, tenant: req.tenant._id },
        { next_follow_up: rescheduled_date, last_contacted: new Date() }
      )
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'reschedule_follow_up',
      resource: 'FollowUp',
      resource_id: followUp._id,
      description: 'Follow-up rescheduled',
      type: 'crud',
      severity: 'info',
    })

    res.json(followUp)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteFollowUp = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug === 'interior_manager' || roleSlug === 'junior_interior_manager') {
      return res.status(403).json({ message: 'Interior managers cannot delete follow-ups' })
    }
    const followUp = await FollowUp.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' })
    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_follow_up',
      resource: 'FollowUp',
      resource_id: followUp._id,
      description: 'Follow-up deleted',
      type: 'crud',
      severity: 'warning',
    })
    res.json({ message: 'Follow-up deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const bulkDeleteFollowUps = async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' })
    }
    const result = await FollowUp.deleteMany(
      { _id: { $in: ids }, tenant: req.tenant._id }
    )
    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_delete_follow_ups',
      resource: 'FollowUp',
      description: `${result.deletedCount} follow-ups bulk deleted`,
      type: 'crud',
      severity: 'warning',
    })
    res.json({ message: `${result.deletedCount} follow-ups deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getReminders = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const filter = {
      tenant: req.tenant._id,
      status: 'pending',
      is_deleted: false,
    }

    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to

    const todayFollowUps = await FollowUp.find({ ...filter, follow_up_date: { $gte: today, $lt: tomorrow } })
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email')
      .sort({ follow_up_date: 1 })

    const upcomingFollowUps = await FollowUp.find({ ...filter, follow_up_date: { $gte: tomorrow } })
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email')
      .sort({ follow_up_date: 1 })
      .limit(parseInt(req.query.limit) || 20)

    const overdueFollowUps = await FollowUp.find({ ...filter, follow_up_date: { $lt: today } })
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name email')
      .sort({ follow_up_date: 1 })

    res.json({
      today: todayFollowUps,
      upcoming: upcomingFollowUps,
      overdue: overdueFollowUps,
      counts: {
        today: todayFollowUps.length,
        upcoming: upcomingFollowUps.length,
        overdue: overdueFollowUps.length,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const backfillNames = async (req, res) => {
  try {
    const tenant = req.tenant._id
    const followUps = await FollowUp.find({ tenant, is_deleted: false }).limit(500)
    let updated = 0
    for (const fu of followUps) {
      const updates = {}
      if (fu.lead && !fu.lead_name) {
        const leadDoc = await Lead.findOne({ _id: fu.lead, tenant }).select('full_name mobile')
        if (leadDoc) { updates.lead_name = leadDoc.full_name; updates.lead_mobile = leadDoc.mobile }
        else { updates.lead_name = 'Deleted Lead'; updates.lead_mobile = '' }
      }
      if (fu.client && !fu.client_name) {
        const clientDoc = await Client.findOne({ _id: fu.client, tenant }).select('client_id full_name mobile')
        if (clientDoc) { updates.client_name = clientDoc.full_name; updates.client_mobile = clientDoc.mobile; updates.client_id_value = clientDoc.client_id }
        else { updates.client_name = 'Deleted Client'; updates.client_mobile = '' }
      }
      if (!fu.lead && !fu.client && !fu.lead_name && !fu.client_name) {
        updates.lead_name = fu.reason || 'Unknown'
      }
      if (Object.keys(updates).length > 0) {
        await FollowUp.updateOne({ _id: fu._id }, { $set: updates })
        updated++
      }
    }
    res.json({ message: `Backfilled ${updated} follow-ups` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
