import mongoose from 'mongoose'

const purchaseOrderItemSchema = new mongoose.Schema({
  po_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  qty_ordered: { type: Number },
  qty_received: { type: Number },
  unit_cost: { type: Number },
  total_cost: { type: Number },
})

purchaseOrderItemSchema.index({ po_id: 1 })
purchaseOrderItemSchema.index({ material_id: 1 })

export default mongoose.model('PurchaseOrderItem', purchaseOrderItemSchema)
