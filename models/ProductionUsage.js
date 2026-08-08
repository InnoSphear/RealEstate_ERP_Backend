import mongoose from 'mongoose'

const productionUsageSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject', required: true },
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usage_date: { type: Date },
  qty_used: { type: Number, default: 0 },
  qty_wasted: { type: Number, default: 0 },
  qty_returned: { type: Number, default: 0 },
  notes: { type: String },
}, { timestamps: true })

productionUsageSchema.index({ project_id: 1 })
productionUsageSchema.index({ material_id: 1 })
productionUsageSchema.index({ branch_id: 1 })
productionUsageSchema.index({ recorded_by: 1 })
productionUsageSchema.index({ usage_date: -1 })

export default mongoose.model('ProductionUsage', productionUsageSchema)
