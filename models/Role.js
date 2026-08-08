import mongoose from 'mongoose'

const roleSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true, maxlength: 50 },
  slug: { type: String, required: true, maxlength: 50 },
  description: { type: String, maxlength: 200 },
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  is_system: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

roleSchema.index({ tenant: 1, slug: 1 }, { unique: true })
roleSchema.index({ tenant: 1, is_active: 1 })

export default mongoose.model('Role', roleSchema)
