import mongoose from 'mongoose'
import Role from './Role.js'

const userSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  full_name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, maxlength: 100 },
  phone: { type: String, maxlength: 20 },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  role_slug: { type: String, required: true, maxlength: 50 },
  password_hash: { type: String, required: true },
  refresh_token: { type: String },
  profile_photo: { type: String },
  is_active: { type: Boolean, default: true },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
  last_login: { type: Date },
  last_login_ip: { type: String },
  last_login_device: { type: String },
  password_changed_at: { type: Date },
  reset_password_token: { type: String },
  reset_password_expires: { type: Date },
  sessions: [{
    token: { type: String },
    device: { type: String },
    ip: { type: String },
    user_agent: { type: String },
    last_active: { type: Date },
    is_active: { type: Boolean, default: true },
    login_at: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

userSchema.pre('save', async function () {
  if (this.isModified('role') && this.role) {
    try {
      const roleDoc = await Role.findById(this.role).select('slug').lean()
      if (roleDoc && roleDoc.slug) {
        this.role_slug = roleDoc.slug
      }
    } catch {
      // silently fail – role_slug stays as-is
    }
  }
})

userSchema.index({ tenant: 1, email: 1 }, { unique: true })
userSchema.index({ tenant: 1, role: 1 })
userSchema.index({ tenant: 1, is_active: 1 })
userSchema.index({ reset_password_token: 1 }, { sparse: true })

export default mongoose.model('User', userSchema)
