import mongoose from 'mongoose'

const expenseSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  expense_number: { type: String, required: true, maxlength: 50 },
  category: {
    type: String,
    enum: ['salary', 'marketing', 'office_expenses', 'utilities', 'travel', 'maintenance', 'legal', 'miscellaneous', 'rent', 'office_supplies', 'other'],
    required: true
  },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String, maxlength: 500 },
  vendor: { type: String, maxlength: 200 },
  payment_mode: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'],
  },
  reference: { type: String, maxlength: 100 },
  bill_document: { type: String },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_at: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  paid_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

expenseSchema.index({ tenant: 1, category: 1 })
expenseSchema.index({ tenant: 1, date: -1 })
expenseSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('Expense', expenseSchema)
