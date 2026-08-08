import mongoose from 'mongoose'

const materialRequisitionSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject', required: true },
  requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  req_number: { type: String, unique: true, maxlength: 30 },
  req_date: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled'],
    default: 'pending'
  },
  notes: { type: String },
}, { timestamps: true })

materialRequisitionSchema.index({ project_id: 1 })
materialRequisitionSchema.index({ requested_by: 1 })
materialRequisitionSchema.index({ status: 1 })

export default mongoose.model('MaterialRequisition', materialRequisitionSchema)
