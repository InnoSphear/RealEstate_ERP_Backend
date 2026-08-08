import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['email', 'whatsapp', 'sms', 'in_app'],
    required: true
  },
  channel: {
    type: String,
    enum: ['email', 'whatsapp', 'sms', 'in_app'],
    required: true
  },
  title: { type: String, required: true, maxlength: 200 },
  message: { type: String, required: true, maxlength: 2000 },
  data: { type: mongoose.Schema.Types.Mixed },
  link: { type: String },
  is_read: { type: Boolean, default: false },
  read_at: { type: Date },
  is_sent: { type: Boolean, default: false },
  sent_at: { type: Date },
  is_delivered: { type: Boolean, default: false },
  delivered_at: { type: Date },
  error_message: { type: String },
}, { timestamps: true })

notificationSchema.index({ tenant: 1, recipient: 1, is_read: 1 })
notificationSchema.index({ tenant: 1, type: 1 })
notificationSchema.index({ tenant: 1, created_at: -1 })

export default mongoose.model('Notification', notificationSchema)
