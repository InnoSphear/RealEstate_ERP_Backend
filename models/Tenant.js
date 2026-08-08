import mongoose from 'mongoose'

const tenantSchema = new mongoose.Schema({
  company_name: { type: String, required: true, maxlength: 200 },
  company_email: { type: String, required: true, unique: true, maxlength: 100 },
  company_phone: { type: String, maxlength: 50 },
  company_address: { type: String, maxlength: 500 },
  company_logo: { type: String },
  gst_number: { type: String, maxlength: 50 },
  pan_number: { type: String, maxlength: 50 },
  subscription_plan: { type: String, enum: ['free', 'basic', 'professional', 'enterprise'], default: 'free' },
  subscription_status: { type: String, enum: ['active', 'expired', 'suspended', 'trial'], default: 'trial' },
  subscription_start: { type: Date },
  subscription_end: { type: Date },
  max_users: { type: Number, default: 5 },
  max_properties: { type: Number, default: 50 },
  max_projects: { type: Number, default: 10 },
  storage_limit_mb: { type: Number, default: 500 },
  domain: { type: String, unique: true, sparse: true },
  db_uri: { type: String },
  is_active: { type: Boolean, default: true },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
  attendance_settings: {
    grace_start: { type: String, default: '10:00' },
    grace_end: { type: String, default: '10:35' },
  },
}, { timestamps: true })

tenantSchema.index({ is_active: 1 })
tenantSchema.index({ subscription_status: 1 })

export default mongoose.model('Tenant', tenantSchema)
