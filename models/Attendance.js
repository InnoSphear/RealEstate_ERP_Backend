import mongoose from 'mongoose'

const attendanceSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  check_in: { type: Date },
  check_out: { type: Date },
  status: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'late', 'holiday', 'leave'],
    default: 'present'
  },
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_at: { type: Date },
  rejection_reason: { type: String, maxlength: 500 },
  working_hours: { type: Number, default: 0 },
  overtime_hours: { type: Number, default: 0 },
  notes: { type: String, maxlength: 500 },
  marked_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    accuracy: { type: Number },
    address: { type: String },
  },
  ip_address: { type: String },
}, { timestamps: true })

attendanceSchema.index({ tenant: 1, employee: 1, date: 1 }, { unique: true })
attendanceSchema.index({ tenant: 1, date: 1 })
attendanceSchema.index({ tenant: 1, status: 1 })
attendanceSchema.index({ tenant: 1, approval_status: 1 })

export default mongoose.model('Attendance', attendanceSchema)