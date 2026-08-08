import mongoose from 'mongoose'

const activityLogSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, maxlength: 100 },
  resource: { type: String, maxlength: 100 },
  resource_id: { type: mongoose.Schema.Types.ObjectId },
  description: { type: String, maxlength: 500 },
  details: { type: mongoose.Schema.Types.Mixed },
  ip_address: { type: String, maxlength: 50 },
  user_agent: { type: String, maxlength: 500 },
  device: { type: String, maxlength: 100 },
  browser: { type: String, maxlength: 100 },
  os: { type: String, maxlength: 100 },
  location: { type: String, maxlength: 200 },
  type: {
    type: String,
    enum: ['auth', 'crud', 'system', 'login', 'logout', 'error'],
    default: 'crud'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
}, { timestamps: true })

activityLogSchema.index({ tenant: 1, user: 1 })
activityLogSchema.index({ tenant: 1, user: 1, createdAt: -1 })
activityLogSchema.index({ tenant: 1, action: 1 })
activityLogSchema.index({ tenant: 1, resource: 1, resource_id: 1 })
activityLogSchema.index({ tenant: 1, type: 1 })
activityLogSchema.index({ tenant: 1, createdAt: -1 })

export default mongoose.model('ActivityLog', activityLogSchema)
