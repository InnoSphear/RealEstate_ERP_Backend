import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  project_name: { type: String, required: true, maxlength: 200 },
  builder_name: { type: String, maxlength: 200 },
  builder_contact: { type: String, maxlength: 20 },
  builder_email: { type: String, maxlength: 100 },
  location: { type: String, required: true, maxlength: 300 },
  city: { type: String, maxlength: 100 },
  state: { type: String, maxlength: 100 },
  launch_date: { type: Date },
  completion_date: { type: Date },
  total_units: { type: Number, default: 0 },
  available_units: { type: Number, default: 0 },
  unit_types: [{
    type: { type: String, maxlength: 100 },
    total: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    price_from: { type: Number, default: 0 },
    price_to: { type: Number, default: 0 },
    carpet_area: { type: Number },
  }],
  amenities: [{ type: String }],
  description: { type: String, maxlength: 2000 },
  images: [{
    url: { type: String },
    public_id: { type: String },
    is_primary: { type: Boolean, default: false },
  }],
  brochure: { type: String },
  documents: [{
    name: { type: String },
    url: { type: String },
    type: { type: String },
    uploaded_at: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'hold', 'cancelled'],
    default: 'upcoming'
  },
  featured: { type: Boolean, default: false },
  daily_updates: [{
    date: { type: Date, default: Date.now },
    title: { type: String },
    description: { type: String },
    images: [{ type: String }],
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

projectSchema.index({ tenant: 1, status: 1 })
projectSchema.index({ tenant: 1, city: 1 })
projectSchema.index({ tenant: 1, featured: 1 })

export default mongoose.model('Project', projectSchema)
