import mongoose from 'mongoose'

const permissionSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  module: { type: String, required: true, maxlength: 100 },
  action: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 200 },
  is_active: { type: Boolean, default: true },
}, { timestamps: true })

permissionSchema.index({ tenant: 1, module: 1, action: 1 }, { unique: true })

export default mongoose.model('Permission', permissionSchema)
