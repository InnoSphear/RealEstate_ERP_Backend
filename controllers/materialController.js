import Material from '../models/Material.js'
import ActivityLog from '../models/ActivityLog.js'

export const createMaterial = async (req, res) => {
  try {
    const material = await Material.create({ ...req.body, tenant: req.tenant._id })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'create_material', resource: 'Material',
      resource_id: material._id,
      description: `Material ${material.name} created`,
      type: 'crud', severity: 'info',
    })
    res.status(201).json(material)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const getMaterials = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_active: true }
    if (req.query.category) filter.category = req.query.category
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    const materials = await Material.find(filter).sort({ createdAt: -1 })
    res.json(materials)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getLowStockMaterials = async (req, res) => {
  try {
    const materials = await Material.find({
      tenant: req.tenant._id,
      is_active: true,
      $expr: { $and: [
        { $ne: ['$reorder_level', null] },
        { $ne: ['$reorder_level', 0] },
        { $lte: ['$current_stock', '$reorder_level'] },
      ]}
    }).sort({ current_stock: 1 })
    res.json(materials)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getMaterialById = async (req, res) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!material) return res.status(404).json({ message: 'Material not found' })
    res.json(material)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateMaterial = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    const material = await Material.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id },
      data,
      { new: true, runValidators: true }
    )
    if (!material) return res.status(404).json({ message: 'Material not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'update_material', resource: 'Material',
      resource_id: material._id,
      description: `Material ${material.name} updated`,
      type: 'crud', severity: 'info',
    })
    res.json(material)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!material) return res.status(404).json({ message: 'Material not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_material', resource: 'Material',
      resource_id: material._id,
      description: `Material ${material.name} deleted`,
      type: 'crud', severity: 'warning',
    })
    res.json({ message: 'Material deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const bulkUpdateMaterials = async (req, res) => {
  try {
    const { ids, updates } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' })
    }
    const result = await Material.updateMany(
      { _id: { $in: ids }, tenant: req.tenant._id },
      { $set: updates },
      { runValidators: true }
    )
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'bulk_update_materials', resource: 'Material',
      description: `Bulk updated ${result.modifiedCount} materials`,
      type: 'crud', severity: 'info',
    })
    res.json({ message: `Updated ${result.modifiedCount} materials`, result })
  } catch (err) { res.status(400).json({ message: err.message }) }
}