import mongoose from 'mongoose'

const paymentHistorySchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  payment_mode: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'],
    required: true
  },
  reference: { type: String, maxlength: 100 },
  upi_id: { type: String, maxlength: 100 },
  paid_at: { type: Date, default: Date.now },
  paid_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, maxlength: 500 },
  timestamp: { type: Date, default: Date.now },
}, { _id: true })

const commissionSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  commission_type: {
    type: String,
    enum: ['fixed', 'percentage'],
    required: true
  },
  commission_value: { type: Number, required: true },
  commission_amount: { type: Number, required: true },
  source: {
    type: String,
    enum: ['sale', 'rent', 'service', 'brokerage', 'interior', 'referral', 'other'],
    required: true
  },
  source_id: { type: mongoose.Schema.Types.ObjectId },
  source_description: { type: String, maxlength: 500 },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  external_broker: { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalBroker' },
  amount_basis: { type: Number },
  percentage_rate: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_at: { type: Date },
  paid_at: { type: Date },
  payment_mode: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'],
  },
  upi_id: { type: String, maxlength: 100 },
  paid_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  payment_history: [paymentHistorySchema],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

commissionSchema.index({ tenant: 1, employee: 1 })
commissionSchema.index({ tenant: 1, user: 1 })
commissionSchema.index({ tenant: 1, status: 1 })
commissionSchema.index({ tenant: 1, source: 1 })

export default mongoose.model('Commission', commissionSchema)
