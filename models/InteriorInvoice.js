import mongoose from 'mongoose'

const interiorInvoiceSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  interior_project: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  invoice_number: { type: String, required: true, maxlength: 50 },
  invoice_date: { type: Date, default: Date.now },
  due_date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
    default: 'draft'
  },
  sale_items: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    category: { type: String, enum: ['labor', 'material', 'design', 'consultation', 'other'], default: 'other' },
  }],
  purchase_items: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    vendor: { type: String, maxlength: 100 },
    category: { type: String, enum: ['raw_material', 'furniture', 'fixtures', 'equipment', 'other'], default: 'other' },
  }],
  expense_items: [{
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, enum: ['transport', 'labor', 'permit', 'utility', 'miscellaneous'], default: 'miscellaneous' },
    date: { type: Date },
  }],
  total_sale: { type: Number, default: 0 },
  total_purchase: { type: Number, default: 0 },
  total_expense: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  paid_amount: { type: Number, default: 0 },
  due_amount: { type: Number, default: 0 },
  payment_mode: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'],
  },
  notes: { type: String, maxlength: 500 },
  terms: { type: String, maxlength: 1000 },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

interiorInvoiceSchema.index({ tenant: 1, invoice_number: 1 }, { unique: true })
interiorInvoiceSchema.index({ tenant: 1, interior_project: 1 })
interiorInvoiceSchema.index({ tenant: 1, client: 1 })
interiorInvoiceSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('InteriorInvoice', interiorInvoiceSchema)
