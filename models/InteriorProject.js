import mongoose from 'mongoose'

const interiorProjectSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  project_code: { type: String, maxlength: 30 },
  flat_id: { type: String, maxlength: 30 },
  title: { type: String, required: true, maxlength: 150 },
  status: {
    type: String,
    enum: ['not_started', 'running', 'on_hold', 'completed', 'closed'],
    default: 'not_started'
  },
  project_type: {
    type: String,
    enum: ['residential', 'commercial', 'office', 'renovation']
  },
  address: { type: String },
  total_area_sqft: { type: Number },
  start_date: { type: Date },
  expected_end_date: { type: Date },
  actual_end_date: { type: Date },
  scope_of_work: { type: String },
  notes: { type: String },
  estimated_budget: { type: Number },
  approved_budget: { type: Number },
  contract_amount: { type: Number, default: 0 },
  material_cost: { type: Number, default: 0 },
  other_cost: { type: Number, default: 0 },
  received_amount: { type: Number, default: 0 },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
  direct_expenses: [{
    expense_name: { type: String, required: true },
    category: { type: String, enum: ['labour', 'transport', 'permit', 'utility', 'equipment', 'other'], default: 'other' },
    cost: { type: Number, required: true },
    paid_amount: { type: Number, default: 0 },
    due: { type: Number },
    payment_date: { type: Date },
    vendor: { type: String },
    notes: { type: String },
  }],
  vendors: [{
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    role: { type: String },
    assigned_at: { type: Date, default: Date.now },
    notes: { type: String },
  }],
  labour: [{
    name: { type: String, required: true },
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    role: { type: String },
    phone: { type: String },
    daily_wage: { type: Number },
    assigned_at: { type: Date, default: Date.now },
    notes: { type: String },
  }],
  materials: [{
    item_name: { type: String, required: true },
    cost: { type: Number, required: true },
    purchaser_name: { type: String, maxlength: 100 },
    from_stock: { type: Boolean, default: false },
    stock_item: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    payment_status: { type: String, enum: ['paid', 'partial', 'credit'], default: 'credit' },
    paid_amount: { type: Number, default: 0 },
    bill_photos: [{ url: String, public_id: String, name: String, uploaded_at: { type: Date, default: Date.now } }],
    payments: [{
      amount: { type: Number, required: true },
      payment_date: { type: Date, default: Date.now },
      notes: { type: String },
    }],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    created_at: { type: Date, default: Date.now },
  }],
  payments: [{
    amount: { type: Number, required: true },
    payment_date: { type: Date, default: Date.now },
    payment_mode: { type: String, enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'], default: 'cash' },
    transaction_id: { type: String },
    notes: { type: String },
    received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payment_receiver_name: { type: String, maxlength: 100 },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })

interiorProjectSchema.pre('save', function () {
  if (this.materials && this.materials.length > 0) {
    this.material_cost = this.materials.reduce((sum, m) => sum + (m.cost || 0), 0)
  }
  if (this.payments && this.payments.length > 0) {
    this.received_amount = this.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  }
  if (this.direct_expenses && this.direct_expenses.length > 0) {
    this.direct_expenses.forEach(e => {
      e.due = (e.cost || 0) - (e.paid_amount || 0)
    })
  }
})

interiorProjectSchema.virtual('total_cost').get(function () {
  const expenseTotal = this.direct_expenses
    ? this.direct_expenses.reduce((sum, e) => sum + (e.cost || 0), 0)
    : 0
  return (this.material_cost || 0) + (this.other_cost || 0) + expenseTotal
})

interiorProjectSchema.virtual('balance').get(function () {
  return (this.contract_amount || 0) - (this.received_amount || 0)
})

interiorProjectSchema.virtual('profit_loss').get(function () {
  const totalCost = this.total_cost || 0
  return (this.contract_amount || 0) - totalCost
})

interiorProjectSchema.index({ tenant: 1, project_code: 1 }, { unique: true, sparse: true })
interiorProjectSchema.index({ tenant: 1, flat_id: 1 })
interiorProjectSchema.index({ tenant: 1, client_id: 1 })
interiorProjectSchema.index({ tenant: 1, branch_id: 1 })
interiorProjectSchema.index({ tenant: 1, assigned_to: 1 })
interiorProjectSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('InteriorProject', interiorProjectSchema)
