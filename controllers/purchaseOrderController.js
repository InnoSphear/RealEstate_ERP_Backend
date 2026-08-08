import PurchaseOrder from '../models/PurchaseOrder.js'
import PurchaseOrderItem from '../models/PurchaseOrderItem.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

export const createPO = async (req, res) => {
  try {
    const { items, ...poData } = req.body
    const allowedFields = ['branch_id', 'requisition_id', 'raised_by', 'po_number', 'supplier_name', 'supplier_contact', 'order_date', 'expected_delivery', 'actual_delivery', 'total_amount', 'status', 'payment_status', 'purchaser_name', 'invoice_number', 'payment_reference', 'notes']
    const cleanData = {}
    for (const key of allowedFields) {
      if (poData[key] !== undefined) cleanData[key] = poData[key]
    }
    const po = await PurchaseOrder.create(cleanData)
    if (items && items.length) {
      const poItems = items.map(item => ({ ...item, po_id: po._id }))
      await PurchaseOrderItem.insertMany(poItems)
    }
    res.status(201).json(po)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const getPOs = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.branch_id) filter.branch_id = req.query.branch_id
    const pos = await PurchaseOrder.find(filter)
      .populate('branch_id', 'name')
      .populate('raised_by', 'full_name')
      .populate('requisition_id', 'req_number')
    res.json(pos)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getPOById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('branch_id', 'name')
      .populate('raised_by', 'full_name')
      .populate('requisition_id', 'req_number')
    if (!po) return res.status(404).json({ message: 'Purchase order not found' })
    const items = await PurchaseOrderItem.find({ po_id: po._id }).populate('material_id', 'name sku unit')
    res.json({ ...po.toObject(), items })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updatePO = async (req, res) => {
  try {
    const allowedFields = ['branch_id', 'requisition_id', 'raised_by', 'po_number', 'supplier_name', 'supplier_contact', 'order_date', 'expected_delivery', 'actual_delivery', 'total_amount', 'status', 'payment_status', 'purchaser_name', 'invoice_number', 'payment_reference', 'notes']
    const updateData = {}
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key]
    }
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    if (!po) return res.status(404).json({ message: 'Purchase order not found' })
    res.json(po)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deletePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndDelete(req.params.id)
    if (!po) return res.status(404).json({ message: 'Purchase order not found' })
    await PurchaseOrderItem.deleteMany({ po_id: req.params.id })
    res.json({ message: 'Purchase order deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const uploadBillPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' })
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ message: 'Purchase order not found' })
    const result = await uploadToCloudinary(req.file.buffer, { folder: 'purchase_orders' })
    po.bill_photos.push({
      url: result.url,
      public_id: result.public_id,
      name: req.body.name || req.file.originalname,
      uploaded_at: new Date(),
    })
    await po.save()
    res.json(po)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const uploadInvoice = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' })
    const po = await PurchaseOrder.findById(req.params.id)
    if (!po) return res.status(404).json({ message: 'Purchase order not found' })
    const result = await uploadToCloudinary(req.file.buffer, { folder: 'purchase_orders' })
    po.invoice_url = result.url
    po.invoice_public_id = result.public_id
    await po.save()
    res.json({ url: result.url, public_id: result.public_id })
  } catch (err) { res.status(500).json({ message: err.message }) }
}