import mongoose from 'mongoose'

const stockSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  item_name: { type: String, required: true, maxlength: 200 },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
  category: { type: String, enum: ['raw_material', 'finished_good', 'consumable', 'tool', 'equipment', 'furniture', 'fixture', 'other'], default: 'other' },
  sku: { type: String, maxlength: 50 },
  unit: { type: String, maxlength: 20, default: 'pcs' },
  current_quantity: { type: Number, default: 0 },
  reorder_level: { type: Number, default: 0 },
  unit_price: { type: Number, default: 0 },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  location: { type: String, maxlength: 200 },
  notes: { type: String, maxlength: 500 },
  images: [{ url: String, public_id: String }],
  last_updated: { type: Date },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
  transactions: [{
    type: { type: String, enum: ['add', 'remove', 'adjust'], required: true },
    quantity: { type: Number, required: true },
    previous_quantity: { type: Number },
    new_quantity: { type: Number },
    reason: { type: String },
    done_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

stockSchema.index({ tenant: 1, category: 1 })
stockSchema.index({ tenant: 1, sku: 1 }, { unique: true, sparse: true })
stockSchema.index({ tenant: 1, current_quantity: 1 })

export default mongoose.model('Stock', stockSchema)