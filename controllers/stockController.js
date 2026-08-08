import Stock from '../models/Stock.js'
import ActivityLog from '../models/ActivityLog.js'

export const getStock = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.category) filter.category = req.query.category
    if (req.query.low_stock === 'true') {
      filter.$expr = { $lte: ['$current_quantity', '$reorder_level'] }
    }
    if (req.query.search) {
      filter.$or = [
        { item_name: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    const stock = await Stock.find(filter)
      .populate('material', 'name sku unit')
      .populate('supplier', 'name phone')
      .sort({ createdAt: -1 })
    res.json(stock)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const createStock = async (req, res) => {
  try {
    const initialQty = Number(req.body.current_quantity) || 0
    const stock = await Stock.create({ ...req.body, tenant: req.tenant._id })
    if (initialQty > 0) {
      stock.transactions.push({
        type: 'add',
        quantity: initialQty,
        previous_quantity: 0,
        new_quantity: initialQty,
        reason: 'Initial stock',
        done_by: req.user._id,
      })
      await stock.save()
    }
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'create_stock', resource: 'Stock',
      resource_id: stock._id,
      description: `Stock created for ${stock.item_name}`,
      type: 'crud', severity: 'info',
    })
    res.status(201).json(stock)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const updateStock = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted
    const stock = await Stock.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!stock) return res.status(404).json({ message: 'Stock not found' })

    const previous_quantity = stock.current_quantity
    Object.assign(stock, data)
    const new_quantity = Number(data.current_quantity)
    if (!isNaN(new_quantity) && new_quantity !== previous_quantity) {
      stock.transactions.push({
        type: new_quantity > previous_quantity ? 'add' : 'remove',
        quantity: Math.abs(new_quantity - previous_quantity),
        previous_quantity,
        new_quantity,
        reason: 'Quantity updated in edit',
        done_by: req.user._id,
      })
    }
    stock.last_updated = new Date()
    await stock.save()

    const populated = await Stock.findById(stock._id)
      .populate('material', 'name sku unit')
      .populate('supplier', 'name phone')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'update_stock', resource: 'Stock',
      resource_id: stock._id,
      description: `Stock updated for ${stock.item_name}`,
      type: 'crud', severity: 'info',
    })
    res.json(populated)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteStock = async (req, res) => {
  try {
    const stock = await Stock.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!stock) return res.status(404).json({ message: 'Stock not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_stock', resource: 'Stock',
      resource_id: stock._id,
      description: `Stock deleted for ${stock.item_name}`,
      type: 'crud', severity: 'warning',
    })
    res.json({ message: 'Stock deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const adjustStock = async (req, res) => {
  try {
    const { quantity, type, reason } = req.body
    const qty = Number(quantity)
    if (!qty || !type) return res.status(400).json({ message: 'Quantity and type (add/remove) are required' })
    const stock = await Stock.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!stock) return res.status(404).json({ message: 'Stock not found' })
    
    const previous_quantity = stock.current_quantity
    if (type === 'add') stock.current_quantity = Number(stock.current_quantity || 0) + qty
    else if (type === 'remove') {
      if (Number(stock.current_quantity || 0) < qty) return res.status(400).json({ message: 'Insufficient stock' })
      stock.current_quantity = Number(stock.current_quantity || 0) - qty
    }
    stock.last_updated = new Date()
    
    stock.transactions.push({
      type,
      quantity: qty,
      previous_quantity,
      new_quantity: stock.current_quantity,
      reason: reason || `${type === 'add' ? 'Stock added' : 'Stock removed'}`,
      done_by: req.user._id,
    })
    await stock.save()
    
    const populated = await Stock.findById(stock._id)
      .populate('material', 'name sku unit')
      .populate('supplier', 'name phone')
    
    res.json(populated)
  } catch (err) { res.status(400).json({ message: err.message }) }
}