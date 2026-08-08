import mongoose from 'mongoose'

const invoiceSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  invoice_number: { type: String, required: true, maxlength: 50 },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  invoice_type: {
    type: String,
    enum: ['sale', 'rent', 'brokerage', 'interior', 'maintenance', 'other'],
    default: 'sale'
  },
  issue_date: { type: Date, default: Date.now },
  due_date: { type: Date, required: true },
  items: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  }],
  subtotal: { type: Number, required: true },
  tax_type: { type: String, enum: ['gst', 'no_tax'], default: 'gst' },
  tax_percentage: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  discount_percentage: { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  paid_amount: { type: Number, default: 0 },
  due_amount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  payment_mode: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'],
  },
  gst_details: {
    gst_no: { type: String },
    hsn_code: { type: String },
    sac_code: { type: String },
    igst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
  },
  digital_signature: { type: String },
  notes: { type: String, maxlength: 500 },
  terms: { type: String, maxlength: 1000 },
  pdf_url: { type: String },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

invoiceSchema.index({ tenant: 1, invoice_number: 1 }, { unique: true })
invoiceSchema.index({ tenant: 1, client: 1 })
invoiceSchema.index({ tenant: 1, status: 1 })
invoiceSchema.index({ tenant: 1, due_date: 1 })
invoiceSchema.index({ tenant: 1, issue_date: -1 })

export default mongoose.model('Invoice', invoiceSchema)
