import mongoose from 'mongoose'

const leaveSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leave_type: {
    type: String,
    enum: ['sick', 'casual', 'earned', 'maternity', 'paternity', 'other', 'annual', 'personal'],
    required: true
  },
  from_date: { type: Date, required: true },
  to_date: { type: Date, required: true },
  total_days: { type: Number, required: true },
  reason: { type: String, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_at: { type: Date },
  rejection_reason: { type: String, maxlength: 500 },
}, { timestamps: true })

leaveSchema.index({ tenant: 1, employee: 1 })
leaveSchema.index({ tenant: 1, status: 1 })

export default mongoose.model('Leave', leaveSchema)
