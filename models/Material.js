import mongoose from 'mongoose'

const materialSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true, maxlength: 150 },
  category: {
    type: String,
    enum: ['raw_material', 'finished_good', 'consumable', 'tool', 'equipment', 'furniture', 'fixture', 'other'],
    default: 'other'
  },
  unit: { type: String, maxlength: 20 },
  sku: { type: String, maxlength: 50 },
  supplier_name: { type: String, maxlength: 100 },
  unit_cost: { type: Number },
  current_stock: { type: Number, default: 0 },
  min_stock_level: { type: Number, default: 0 },
  max_stock_level: { type: Number },
  reorder_level: { type: Number },
  location: { type: String, maxlength: 200 },
  description: { type: String },
  images: [{ url: String, public_id: String }],
  is_active: { type: Boolean, default: true },
}, { timestamps: true })

materialSchema.index({ tenant: 1, name: 1 })
materialSchema.index({ tenant: 1, sku: 1 }, { unique: true, sparse: true })
materialSchema.index({ tenant: 1, category: 1 })

export default mongoose.model('Material', materialSchema)
