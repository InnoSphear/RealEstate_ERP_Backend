import ProductionUsage from '../models/ProductionUsage.js'
import MaterialInventory from '../models/MaterialInventory.js'
import InteriorProject from '../models/InteriorProject.js'

async function adjustInventory(materialId, branchId, qtyDelta) {
  if (!materialId || !branchId || !qtyDelta) return
  await MaterialInventory.findOneAndUpdate(
    { material_id: materialId, branch_id: branchId },
    { $inc: { qty_on_hand: qtyDelta, qty_available: qtyDelta }, last_updated: new Date() },
    { upsert: false }
  )
}

export const createUsage = async (req, res) => {
  try {
    const data = { ...req.body }
    if (!data.recorded_by) data.recorded_by = req.user._id
    if (!data.branch_id && data.project_id) {
      const project = await InteriorProject.findById(data.project_id).select('branch_id')
      if (project) data.branch_id = project.branch_id
    }
    data.qty_used = Number(data.qty_used) || 0
    data.qty_wasted = Number(data.qty_wasted) || 0
    data.qty_returned = Number(data.qty_returned) || 0
    const usage = await ProductionUsage.create(data)
    const totalDeducted = usage.qty_used + usage.qty_wasted - usage.qty_returned
    if (totalDeducted > 0) await adjustInventory(data.material_id, data.branch_id, -totalDeducted)
    const populated = await ProductionUsage.findById(usage._id)
      .populate('material_id', 'name sku unit')
      .populate('project_id', 'project_code title')
      .populate('branch_id', 'name')
      .populate('recorded_by', 'full_name')
    res.status(201).json(populated)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const getUsageByProject = async (req, res) => {
  try {
    const usage = await ProductionUsage.find({ project_id: req.params.projectId })
      .populate('material_id', 'name sku unit')
      .populate('branch_id', 'name')
      .populate('recorded_by', 'full_name')
      .sort({ usage_date: -1 })
    res.json(usage)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getAllUsage = async (req, res) => {
  try {
    const filter = {}
    if (req.query.project_id) filter.project_id = req.query.project_id
    if (req.query.material_id) filter.material_id = req.query.material_id
    if (req.query.branch_id) filter.branch_id = req.query.branch_id
    const usage = await ProductionUsage.find(filter)
      .populate('material_id', 'name sku unit')
      .populate('project_id', 'project_code title')
      .populate('branch_id', 'name')
      .populate('recorded_by', 'full_name')
      .sort({ usage_date: -1 })
    res.json(usage)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateUsage = async (req, res) => {
  try {
    const old = await ProductionUsage.findById(req.params.id)
    if (!old) return res.status(404).json({ message: 'Usage not found' })
    const data = { ...req.body }
    data.qty_used = Number(data.qty_used) || 0
    data.qty_wasted = Number(data.qty_wasted) || 0
    data.qty_returned = Number(data.qty_returned) || 0
    const usage = await ProductionUsage.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    const oldTotal = old.qty_used + old.qty_wasted - old.qty_returned
    const newTotal = usage.qty_used + usage.qty_wasted - usage.qty_returned
    const delta = newTotal - oldTotal
    if (delta !== 0) await adjustInventory(usage.material_id, usage.branch_id, -delta)
    const populated = await ProductionUsage.findById(usage._id)
      .populate('material_id', 'name sku unit')
      .populate('project_id', 'project_code title')
      .populate('branch_id', 'name')
      .populate('recorded_by', 'full_name')
    res.json(populated)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteUsage = async (req, res) => {
  try {
    const usage = await ProductionUsage.findByIdAndDelete(req.params.id)
    if (!usage) return res.status(404).json({ message: 'Usage not found' })
    const totalReturned = usage.qty_used + usage.qty_wasted - usage.qty_returned
    if (totalReturned > 0) await adjustInventory(usage.material_id, usage.branch_id, totalReturned)
    res.json({ message: 'Usage deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
}
