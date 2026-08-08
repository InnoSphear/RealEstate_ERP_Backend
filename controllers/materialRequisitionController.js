import MaterialRequisition from '../models/MaterialRequisition.js'
import RequisitionItem from '../models/RequisitionItem.js'

export const createRequisition = async (req, res) => {
  try {
    const { items, ...reqData } = req.body
    reqData.requested_by = reqData.requested_by || req.user._id
    const requisition = await MaterialRequisition.create(reqData)
    if (items && items.length) {
      const reqItems = items.map(item => ({ ...item, requisition_id: requisition._id }))
      await RequisitionItem.insertMany(reqItems)
    }
    const populated = await MaterialRequisition.findById(requisition._id).populate('project_id', 'project_code title').populate('requested_by', 'full_name')
    res.status(201).json(populated)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const getRequisitions = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.project_id) filter.project_id = req.query.project_id
    const requisitions = await MaterialRequisition.find(filter)
      .populate('project_id', 'project_code title')
      .populate('requested_by', 'full_name')
      .sort({ createdAt: -1 })
    res.json(requisitions)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getRequisitionById = async (req, res) => {
  try {
    const requisition = await MaterialRequisition.findById(req.params.id)
      .populate('project_id', 'project_code title')
      .populate('requested_by', 'full_name')
    if (!requisition) return res.status(404).json({ message: 'Requisition not found' })
    const items = await RequisitionItem.find({ requisition_id: requisition._id }).populate('material_id', 'name sku unit')
    res.json({ ...requisition.toObject(), items })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateRequisition = async (req, res) => {
  try {
    const reqq = await MaterialRequisition.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!reqq) return res.status(404).json({ message: 'Requisition not found' });
    const populated = await MaterialRequisition.findById(reqq._id).populate('project_id', 'project_code title').populate('requested_by', 'full_name')
    res.json(populated)
  }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteRequisition = async (req, res) => {
  try {
    const reqq = await MaterialRequisition.findByIdAndDelete(req.params.id)
    if (!reqq) return res.status(404).json({ message: 'Requisition not found' })
    await RequisitionItem.deleteMany({ requisition_id: req.params.id })
    res.json({ message: 'Requisition deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
}
