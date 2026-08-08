import ActivityLog from '../models/ActivityLog.js'
import User from '../models/User.js'

export const getActivityLogs = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id }
    if (req.query.user) filter.user = req.query.user
    if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' }
    if (req.query.resource) filter.resource = { $regex: req.query.resource, $options: 'i' }
    if (req.query.type) filter.type = req.query.type
    if (req.query.severity) filter.severity = req.query.severity
    if (req.query.resource_id) filter.resource_id = req.query.resource_id
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }
    if (req.query.search) {
      filter.$or = [
        { description: { $regex: req.query.search, $options: 'i' } },
        { action: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    if (req.query.search_user) {
      const matchingUsers = await User.find({
        tenant: req.tenant._id,
        full_name: { $regex: req.query.search_user, $options: 'i' }
      }).select('_id')
      if (matchingUsers.length > 0) {
        filter.user = { $in: matchingUsers.map(u => u._id) }
      } else {
        filter.user = null
      }
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'full_name email role_slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ])

    const formatted = logs.map(log => ({
      ...log.toObject(),
      user_name: log.user?.full_name || 'Unknown',
      user_email: log.user?.email || '',
      user_role: log.user?.role_slug || '',
    }))

    res.json({
      logs: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getActivityLogById = async (req, res) => {
  try {
    const log = await ActivityLog.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate('user', 'full_name email role_slug')
    if (!log) return res.status(404).json({ message: 'Activity log not found' })
    const formatted = {
      ...log.toObject(),
      user_name: log.user?.full_name || 'Unknown',
      user_email: log.user?.email || '',
      user_role: log.user?.role_slug || '',
    }
    res.json(formatted)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getActivityLogsByUser = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, user: req.params.userId }
    if (req.query.type) filter.type = req.query.type
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'full_name email role_slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ])

    const formatted = logs.map(log => ({
      ...log.toObject(),
      user_name: log.user?.full_name || 'Unknown',
      user_email: log.user?.email || '',
      user_role: log.user?.role_slug || '',
    }))

    res.json({
      logs: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getMyActivityLogs = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, user: req.user._id }
    if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' }
    if (req.query.resource) filter.resource = { $regex: req.query.resource, $options: 'i' }
    if (req.query.type) filter.type = req.query.type
    if (req.query.severity) filter.severity = req.query.severity
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }
    if (req.query.search) {
      filter.$or = [
        { description: { $regex: req.query.search, $options: 'i' } },
        { action: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'full_name email role_slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ])

    const formatted = logs.map(log => ({
      ...log.toObject(),
      user_name: log.user?.full_name || 'Unknown',
      user_email: log.user?.email || '',
      user_role: log.user?.role_slug || '',
    }))

    res.json({
      logs: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getSystemLogs = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, type: { $in: ['system', 'error'] } }
    if (req.query.severity) filter.severity = req.query.severity
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'full_name email role_slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ])

    const formatted = logs.map(log => ({
      ...log.toObject(),
      user_name: log.user?.full_name || 'Unknown',
      user_email: log.user?.email || '',
      user_role: log.user?.role_slug || '',
    }))

    res.json({
      logs: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
