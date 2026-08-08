import Notification from '../models/Notification.js'
import ActivityLog from '../models/ActivityLog.js'

export const getNotifications = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, recipient: req.user._id }
    if (req.query.is_read !== undefined) filter.is_read = req.query.is_read === 'true'
    if (req.query.type) filter.type = req.query.type
    if (req.query.channel) filter.channel = req.query.channel

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
    ])

    res.json({
      notifications,
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

export const markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, recipient: req.user._id },
      { is_read: true, read_at: new Date() },
      { new: true }
    )
    if (!notification) return res.status(404).json({ message: 'Notification not found' })
    res.json(notification)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { tenant: req.tenant._id, recipient: req.user._id, is_read: false },
      { is_read: true, read_at: new Date() }
    )
    res.json({ message: `${result.modifiedCount} notifications marked as read` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      tenant: req.tenant._id,
      recipient: req.user._id,
      is_read: false,
    })
    res.json({ unread_count: count })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const sendNotification = async (req, res) => {
  try {
    const { recipient, type, channel, title, message, data, link } = req.body
    if (!recipient || !title || !message) {
      return res.status(400).json({ message: 'Recipient, title, and message are required' })
    }

    const notification = await Notification.create({
      tenant: req.tenant._id,
      recipient,
      type: type || 'in_app',
      channel: channel || 'in_app',
      title,
      message,
      data,
      link,
    })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'send_notification',
      resource: 'Notification',
      resource_id: notification._id,
      description: `Notification sent: ${title}`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(notification)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
