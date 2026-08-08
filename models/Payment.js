import mongoose from 'mongoose'

const timelineEntrySchema = new mongoose.Schema({
  action: { type: String, required: true },
  status: { type: String },
  amount: { type: Number },
  payment_mode: { type: String },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changed_by_name: { type: String },
  description: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const paymentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  payment_number: { type: String, required: true, maxlength: 50 },
  receipt_number: { type: String, maxlength: 50 },
  payment_sequence: { type: Number, default: 1 },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  amount: { type: Number, required: true },
  total_amount: { type: Number },
  paid_amount: { type: Number, default: 0 },
  reason: { type: String, maxlength: 200 },
  payment_reason: { type: String, maxlength: 200 },
  payment_status: {
    type: String,
    enum: ['paid', 'due'],
    default: 'paid'
  },
  security_deposit: { type: Number, default: 0 },
  brokerage: { type: Number, default: 0 },
  payment_date: { type: Date, default: Date.now },
  payment_mode: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'],
  },
  purchaser_name: { type: String, maxlength: 200 },
  paid_by: { type: String, maxlength: 200 },
  credited_to: { type: String, maxlength: 200 },
  remarks: { type: String, maxlength: 500 },
  receipt_screenshot: { type: String },
  receipt_public_id: { type: String },
  utr_number: { type: String, maxlength: 100 },
  reference_docs: [{ name: String, url: String, type: String, uploaded_at: { type: Date, default: Date.now } }],
  reference_number: { type: String, maxlength: 100 },
  transaction_id: { type: String, maxlength: 100 },
  bank_name: { type: String, maxlength: 100 },
  cheque_number: { type: String, maxlength: 50 },
  cheque_date: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'bounced'],
    default: 'completed'
  },
  notes: { type: String, maxlength: 500 },
  receipt_url: { type: String },
  processed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deleted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
  timeline: [timelineEntrySchema],
}, { timestamps: true })

paymentSchema.index({ tenant: 1, payment_number: 1 }, { unique: true })
paymentSchema.index({ tenant: 1, invoice: 1 })
paymentSchema.index({ tenant: 1, client: 1 })
paymentSchema.index({ tenant: 1, payment_date: -1 })
paymentSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('Payment', paymentSchema)
