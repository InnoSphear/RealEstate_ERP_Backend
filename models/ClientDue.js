import mongoose from 'mongoose'

const clientDueSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  amount: { type: Number, required: true },
  paid_amount: { type: Number, default: 0 },
  reason: { type: String, maxlength: 300 },
  due_date: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'waived'],
    default: 'pending'
  },
  notes: { type: String, maxlength: 500 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

clientDueSchema.virtual('remaining').get(function () {
  return Math.max(0, (this.amount || 0) - (this.paid_amount || 0))
})

clientDueSchema.set('toJSON', { virtuals: true })
clientDueSchema.set('toObject', { virtuals: true })

clientDueSchema.index({ tenant: 1, client: 1 })
clientDueSchema.index({ tenant: 1, status: 1 })
clientDueSchema.index({ tenant: 1, due_date: 1 })

export default mongoose.model('ClientDue', clientDueSchema)
