import mongoose from 'mongoose'

const clientSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  client_id: { type: String, maxlength: 50 },
  full_name: { type: String, required: true, maxlength: 100 },
  email: { type: String, maxlength: 100 },
  mobile: { type: String, required: true, maxlength: 20 },
  alternate_mobile: { type: String, maxlength: 20 },
  address: { type: String, maxlength: 500 },
  city: { type: String, maxlength: 100 },
  state: { type: String, maxlength: 100 },
  pincode: { type: String, maxlength: 10 },
  requirement_type: {
    type: String,
    enum: ['buy', 'rent', 'lease', 'commercial', 'investment', 'interior'],
    default: 'buy'
  },
  budget_min: { type: Number, default: 0 },
  budget_max: { type: Number, default: 0 },
  preferred_locations: [{ type: String }],
  property_type_preference: { type: String, maxlength: 100 },
  transaction_type: {
    type: String,
    enum: ['sell', 'purchase', 'rent', 'interior'],
  },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  interior_project: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  notes: { type: String, maxlength: 1000 },
  source: {
    type: String,
    enum: ['facebook', 'google', 'instagram', 'website', 'walk_in', 'referral', '99acres', 'magicbricks', 'housing', 'other', 'social_media', 'call', 'ad'],
    default: 'other'
  },
  lead_score: { type: Number, default: 0, min: 0, max: 100 },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['new', 'contacted', 'hot', 'warm', 'cold', 'follow_up', 'site_visit', 'negotiation', 'won', 'lost', 'active', 'inactive', 'blocked'],
    default: 'new'
  },
  converted: { type: Boolean, default: false },
  converted_at: { type: Date },
  notes_timeline: [{
    text: { type: String },
    createdAt: { type: Date, default: Date.now },
  }],
  documents: [{
    name: { type: String },
    url: { type: String },
    type: { type: String },
    uploaded_at: { type: Date, default: Date.now },
  }],
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

clientSchema.index({ tenant: 1, client_id: 1 }, { unique: true })
clientSchema.index({ tenant: 1, status: 1 })
clientSchema.index({ tenant: 1, assigned_to: 1 })
clientSchema.index({ tenant: 1, source: 1 })
clientSchema.index({ tenant: 1, lead_score: -1 })
clientSchema.index({ tenant: 1, email: 1 })
clientSchema.index({ tenant: 1, mobile: 1 })

export default mongoose.model('Client', clientSchema)
