import mongoose from 'mongoose'

const requisitionItemSchema = new mongoose.Schema({
  requisition_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequisition', required: true },
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  qty_requested: { type: Number },
  qty_approved: { type: Number },
  qty_received: { type: Number },
  unit_cost: { type: Number },
  total_cost: { type: Number },
})

requisitionItemSchema.index({ requisition_id: 1 })
requisitionItemSchema.index({ material_id: 1 })

export default mongoose.model('RequisitionItem', requisitionItemSchema)
