import mongoose from 'mongoose'

const materialInventorySchema = new mongoose.Schema({
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  qty_on_hand: { type: Number, default: 0 },
  qty_reserved: { type: Number, default: 0 },
  qty_available: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now },
})

materialInventorySchema.index({ material_id: 1, branch_id: 1 }, { unique: true })

// Virtual: qty_on_hand - qty_reserved
materialInventorySchema.pre('save', function () {
  this.qty_available = this.qty_on_hand - this.qty_reserved
  this.last_updated = new Date()
})

export default mongoose.model('MaterialInventory', materialInventorySchema)
