import mongoose from 'mongoose'

const incomeSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  income_number: { type: String, required: true, maxlength: 50 },
  category: {
    type: String,
    enum: ['brokerage', 'property_sale', 'rent', 'interior_services', 'consultation', 'other', 'sale', 'service', 'commission', 'interest'],
    required: true
  },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String, maxlength: 500 },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  payment_mode: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'],
  },
  reference: { type: String, maxlength: 100 },
  received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

incomeSchema.index({ tenant: 1, category: 1 })
incomeSchema.index({ tenant: 1, date: -1 })
incomeSchema.index({ tenant: 1, client: 1 })

export default mongoose.model('Income', incomeSchema)
