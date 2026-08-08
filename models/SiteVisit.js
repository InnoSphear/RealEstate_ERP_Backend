import mongoose from 'mongoose'

const siteVisitSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  assigned_executive: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduled_date: { type: Date, required: true },
  scheduled_time: { type: String, maxlength: 20 },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'],
    default: 'scheduled'
  },
  client_confirmed: { type: Boolean, default: false },
  client_feedback: { type: String, maxlength: 500 },
  visit_notes: { type: String, maxlength: 1000 },
  outcome: {
    type: String,
    enum: ['interested', 'not_interested', 'negotiation', 'booked', 'follow_up', 'none'],
    default: 'none'
  },
  converted: { type: Boolean, default: false },
  converted_at: { type: Date },
  property_keys: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PropertyKey' }],
  rescheduled_date: { type: Date },
  rescheduled_reason: { type: String, maxlength: 500 },
  cancellation_reason: { type: String, maxlength: 500 },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

siteVisitSchema.index({ tenant: 1, client: 1 })
siteVisitSchema.index({ tenant: 1, property: 1 })
siteVisitSchema.index({ tenant: 1, assigned_executive: 1 })
siteVisitSchema.index({ tenant: 1, scheduled_date: 1 })
siteVisitSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('SiteVisit', siteVisitSchema)
