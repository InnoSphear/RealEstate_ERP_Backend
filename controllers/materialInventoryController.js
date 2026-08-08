import MaterialInventory from '../models/MaterialInventory.js'

export const createInventory = async (req, res) => {
  try {
    const data = { ...req.body, qty_available: (Number(req.body.qty_on_hand) || 0) - (Number(req.body.qty_reserved) || 0), last_updated: new Date() }
    const inv = await MaterialInventory.create(data)
    const populated = await MaterialInventory.findById(inv._id).populate('material_id', 'name sku category unit unit_cost').populate('branch_id', 'name')
    res.status(201).json(populated)
  }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getInventory = async (req, res) => {
  try {
    const filter = {}
    if (req.query.branch_id) filter.branch_id = req.query.branch_id
    if (req.query.material_id) filter.material_id = req.query.material_id
    const inventory = await MaterialInventory.find(filter)
      .populate('material_id', 'name sku category unit unit_cost')
      .populate('branch_id', 'name')
      .sort({ last_updated: -1 })
    res.json(inventory)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getInventoryById = async (req, res) => {
  try {
    const inv = await MaterialInventory.findById(req.params.id)
      .populate('material_id', 'name sku category unit unit_cost')
      .populate('branch_id', 'name')
    if (!inv) return res.status(404).json({ message: 'Inventory not found' }); res.json(inv)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateInventory = async (req, res) => {
  try {
    const data = { ...req.body, qty_available: (Number(req.body.qty_on_hand) || 0) - (Number(req.body.qty_reserved) || 0), last_updated: new Date() }
    const inv = await MaterialInventory.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    if (!inv) return res.status(404).json({ message: 'Inventory not found' })
    const populated = await MaterialInventory.findById(inv._id).populate('material_id', 'name sku category unit unit_cost').populate('branch_id', 'name')
    res.json(populated)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteInventory = async (req, res) => {
  try { const inv = await MaterialInventory.findByIdAndDelete(req.params.id); if (!inv) return res.status(404).json({ message: 'Inventory not found' }); res.json({ message: 'Inventory deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
