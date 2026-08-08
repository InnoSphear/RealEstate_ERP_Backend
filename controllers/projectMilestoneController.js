import ProjectMilestone from '../models/ProjectMilestone.js'

export const createMilestone = async (req, res) => {
  try { const milestone = await ProjectMilestone.create(req.body); res.status(201).json(milestone) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getMilestonesByProject = async (req, res) => {
  try { const milestones = await ProjectMilestone.find({ project_id: req.params.projectId }); res.json(milestones) }
  catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateMilestone = async (req, res) => {
  try { const milestone = await ProjectMilestone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!milestone) return res.status(404).json({ message: 'Milestone not found' }); res.json(milestone) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteMilestone = async (req, res) => {
  try { const milestone = await ProjectMilestone.findByIdAndDelete(req.params.id); if (!milestone) return res.status(404).json({ message: 'Milestone not found' }); res.json({ message: 'Milestone deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
