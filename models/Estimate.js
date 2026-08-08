import mongoose from 'mongoose'

const estimateSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  full_name: { type: String, maxlength: 100 },
  mobile: { type: String, maxlength: 20 },
  email: { type: String, maxlength: 100 },
  estimate_number: { type: String, required: true, maxlength: 50 },
  title: { type: String, maxlength: 200 },
  instructions: { type: String },
  delivery_terms: { type: String },
  valid_until: { type: Date },
  items: [{
    item_name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number, required: true, default: 1 },
    unit: { type: String, default: 'pcs' },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    delivery_time: { type: String },
  }],
  subtotal: { type: Number, default: 0 },
  tax_percent: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
    default: 'draft',
  },
  notes: { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_by_name: { type: String, maxlength: 100 },
  company_logo: { type: String },
  company_phone: { type: String, maxlength: 50 },
  company_address: { type: String, maxlength: 500 },
  client_signature: { type: String },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

estimateSchema.pre('save', function () {
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, i) => sum + (i.amount || 0), 0)
    this.tax_amount = (this.subtotal * (this.tax_percent || 0)) / 100
    this.grand_total = this.subtotal + this.tax_amount - (this.discount || 0)
  }
})

estimateSchema.index({ tenant: 1, estimate_number: 1 }, { unique: true, sparse: true })
estimateSchema.index({ tenant: 1, project: 1 })
estimateSchema.index({ tenant: 1, client: 1 })
estimateSchema.index({ tenant: 1, lead: 1 })

export default mongoose.model('Estimate', estimateSchema)
