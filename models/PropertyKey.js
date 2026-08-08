import mongoose from 'mongoose'

const propertyKeySchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  key_number: { type: String, required: true, maxlength: 50 },
  key_holder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['available', 'scheduled', 'issued', 'outside', 'returned'],
    default: 'available'
  },
  issue_date: { type: Date },
  return_date: { type: Date },
  issued_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issued_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, maxlength: 500 },
  history: [{
    action: { type: String, enum: ['issued', 'returned', 'scheduled', 'outside'] },
    issued_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issued_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issue_date: { type: Date },
    return_date: { type: Date },
    notes: { type: String },
    timestamp: { type: Date, default: Date.now },
  }],
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

propertyKeySchema.index({ tenant: 1, property: 1 })
propertyKeySchema.index({ tenant: 1, key_number: 1 })
propertyKeySchema.index({ tenant: 1, status: 1 })

export default mongoose.model('PropertyKey', propertyKeySchema)
