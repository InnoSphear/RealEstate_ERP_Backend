import mongoose from 'mongoose'

const followUpSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  lead_name: { type: String, maxlength: 100 },
  lead_mobile: { type: String, maxlength: 20 },
  client_name: { type: String, maxlength: 100 },
  client_mobile: { type: String, maxlength: 20 },
  client_id_value: { type: String, maxlength: 50 },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  follow_up_date: { type: Date, required: true },
  follow_up_time: { type: String, maxlength: 20 },
  reason: { type: String, maxlength: 500 },
  notes: { type: String, maxlength: 1000 },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed', 'rescheduled'],
    default: 'pending'
  },
  completed_at: { type: Date },
  completion_notes: { type: String, maxlength: 1000 },
  rescheduled_date: { type: Date },
  notification_sent: { type: Boolean, default: false },
  notification_channel: { type: String, enum: ['email', 'whatsapp', 'sms', 'in_app'], default: 'in_app' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

followUpSchema.index({ tenant: 1, assigned_to: 1, follow_up_date: 1 })
followUpSchema.index({ tenant: 1, lead: 1 })
followUpSchema.index({ tenant: 1, client: 1 })
followUpSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('FollowUp', followUpSchema)
