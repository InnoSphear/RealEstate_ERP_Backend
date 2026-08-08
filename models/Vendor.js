import mongoose from 'mongoose'

const purchaseSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
  purchase_date: { type: Date, default: Date.now },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  notes: { type: String, maxlength: 500 },
}, { _id: true })

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  payment_date: { type: Date, default: Date.now },
  payment_mode: { type: String, enum: ['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other'], default: 'cash' },
  reference: { type: String, maxlength: 100 },
  notes: { type: String, maxlength: 500 },
}, { _id: true })

const vendorSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true, maxlength: 200 },
  contact_person: { type: String, maxlength: 100 },
  phone: { type: String, maxlength: 20 },
  email: { type: String, maxlength: 100 },
  address: { type: String, maxlength: 500 },
  gst: { type: String, maxlength: 50 },
  category: {
    type: String,
    enum: ['material', 'labor', 'service', 'transport', 'consultant', 'other'],
    default: 'other'
  },
  purchases: [purchaseSchema],
  payments: [paymentSchema],
  payment_status: {
    type: String,
    enum: ['paid', 'partial', 'credit'],
    default: 'credit'
  },
  total_purchased: { type: Number, default: 0 },
  total_paid: { type: Number, default: 0 },
  total_due: { type: Number, default: 0 },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

vendorSchema.index({ tenant: 1, name: 1 })
vendorSchema.index({ tenant: 1, category: 1 })
vendorSchema.index({ tenant: 1, payment_status: 1 })

export default mongoose.model('Vendor', vendorSchema)
