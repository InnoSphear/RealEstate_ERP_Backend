import mongoose from 'mongoose'

const visitorSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  visitor_name: { type: String, required: true, maxlength: 100 },
  mobile: { type: String, required: true, maxlength: 20 },
  email: { type: String, maxlength: 100 },
  purpose: { type: String, maxlength: 500 },
  interested_property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  assigned_staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['walk_in', 'appointment', 'delivery', 'other'],
    default: 'walk_in'
  },
  check_in: { type: Date, default: Date.now },
  check_out: { type: Date },
  notes: { type: String, maxlength: 500 },
  converted_to_lead: { type: Boolean, default: false },
  converted_lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  id_proof: { type: String },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

visitorSchema.index({ tenant: 1, mobile: 1 })
visitorSchema.index({ tenant: 1, check_in: -1 })
visitorSchema.index({ tenant: 1, type: 1 })

export default mongoose.model('Visitor', visitorSchema)
