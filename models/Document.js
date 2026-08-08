import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  module: { type: String, enum: ['property', 'client', 'employee', 'project'], required: true },
  module_item_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, maxlength: 200 },
  file_name: { type: String, maxlength: 200 },
  file_url: { type: String, maxlength: 500, required: true },
  file_size: { type: Number },
  mime_type: { type: String, maxlength: 100 },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  is_deleted: { type: Boolean, default: false },
}, { timestamps: true })

documentSchema.index({ tenant: 1, module: 1, is_deleted: 1 })
documentSchema.index({ tenant: 1, module_item_id: 1 })
documentSchema.index({ tenant: 1, name: 1 })

export default mongoose.model('Document', documentSchema)
