import mongoose from 'mongoose'

const projectTeamSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role_in_project: { type: String, maxlength: 50 },
  assigned_at: { type: Date, default: Date.now },
})

projectTeamSchema.index({ project_id: 1 })
projectTeamSchema.index({ user_id: 1 })

export default mongoose.model('ProjectTeam', projectTeamSchema)
