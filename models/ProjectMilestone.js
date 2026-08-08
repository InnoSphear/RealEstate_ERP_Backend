import mongoose from 'mongoose'

const projectMilestoneSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject', required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String },
  progress_pct: { type: Number, min: 0, max: 100, default: 0 },
  due_date: { type: Date },
  completed_date: { type: Date },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'delayed'],
    default: 'pending'
  },
}, { timestamps: true })

projectMilestoneSchema.index({ project_id: 1 })
projectMilestoneSchema.index({ status: 1 })

export default mongoose.model('ProjectMilestone', projectMilestoneSchema)
