import ProjectTeam from '../models/ProjectTeam.js'

export const addTeamMember = async (req, res) => {
  try { const member = await ProjectTeam.create(req.body); res.status(201).json(member) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getTeamByProject = async (req, res) => {
  try {
    const team = await ProjectTeam.find({ project_id: req.params.projectId }).populate('user_id', 'full_name email role')
    res.json(team)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const removeTeamMember = async (req, res) => {
  try { const member = await ProjectTeam.findByIdAndDelete(req.params.id); if (!member) return res.status(404).json({ message: 'Team member not found' }); res.json({ message: 'Team member removed' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
