import ProjectBudget from '../models/ProjectBudget.js'

export const createBudget = async (req, res) => {
  try { const budget = await ProjectBudget.create(req.body); res.status(201).json(budget) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getBudgetsByProject = async (req, res) => {
  try { const budgets = await ProjectBudget.find({ project_id: req.params.projectId }); res.json(budgets) }
  catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateBudget = async (req, res) => {
  try { const budget = await ProjectBudget.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!budget) return res.status(404).json({ message: 'Budget not found' }); res.json(budget) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteBudget = async (req, res) => {
  try { const budget = await ProjectBudget.findByIdAndDelete(req.params.id); if (!budget) return res.status(404).json({ message: 'Budget not found' }); res.json({ message: 'Budget deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
