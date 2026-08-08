import mongoose from 'mongoose'

const externalBrokerSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true, maxlength: 200 },
  phone: { type: String, maxlength: 20 },
  email: { type: String, maxlength: 100 },
  company_name: { type: String, maxlength: 200 },
  address: { type: String, maxlength: 500 },
  city: { type: String, maxlength: 100 },
  specialization: {
    type: String,
    enum: ['sale', 'rent', 'both', 'other'],
    default: 'both'
  },
  notes: { type: String, maxlength: 1000 },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

externalBrokerSchema.index({ tenant: 1, name: 1 })
externalBrokerSchema.index({ tenant: 1, specialization: 1 })
externalBrokerSchema.index({ tenant: 1, is_active: 1 })

export default mongoose.model('ExternalBroker', externalBrokerSchema)
