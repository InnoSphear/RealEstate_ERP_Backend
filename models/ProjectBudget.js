import mongoose from 'mongoose'

const projectBudgetSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject', required: true },
  estimated_amount: { type: Number },
  approved_amount: { type: Number },
  revised_amount: { type: Number },
  currency: { type: String, default: 'INR', maxlength: 5 },
  remarks: { type: String },
}, { timestamps: true })

projectBudgetSchema.index({ project_id: 1 })

export default mongoose.model('ProjectBudget', projectBudgetSchema)
