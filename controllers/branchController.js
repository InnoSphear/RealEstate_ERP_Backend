import Branch from '../models/Branch.js'

export const createBranch = async (req, res) => {
  try { const branch = await Branch.create(req.body); res.status(201).json(branch) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getBranches = async (req, res) => {
  try { const branches = await Branch.find({ is_active: true }); res.json(branches) }
  catch (err) { res.status(500).json({ message: err.message }) }
}

export const getBranchById = async (req, res) => {
  try { const branch = await Branch.findById(req.params.id); if (!branch) return res.status(404).json({ message: 'Branch not found' }); res.json(branch) }
  catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateBranch = async (req, res) => {
  try { const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!branch) return res.status(404).json({ message: 'Branch not found' }); res.json(branch) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteBranch = async (req, res) => {
  try { const branch = await Branch.findByIdAndDelete(req.params.id); if (!branch) return res.status(404).json({ message: 'Branch not found' }); res.json({ message: 'Branch deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
