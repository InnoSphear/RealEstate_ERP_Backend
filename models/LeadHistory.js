import mongoose from 'mongoose'

const leadHistorySchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  field: { type: String, maxlength: 50 },
  old_value: { type: mongoose.Schema.Types.Mixed },
  new_value: { type: mongoose.Schema.Types.Mixed },
  type: {
    type: String,
    enum: ['status_change', 'assignment', 'note', 'conversion', 'update', 'creation', 'call_note'],
    default: 'update'
  },
  description: { type: String, maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true })

leadHistorySchema.index({ tenant: 1, lead: 1, createdAt: -1 })
leadHistorySchema.index({ tenant: 1, user: 1 })

export default mongoose.model('LeadHistory', leadHistorySchema)
