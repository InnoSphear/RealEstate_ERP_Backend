import mongoose from 'mongoose'

const leadSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  full_name: { type: String, required: true, maxlength: 100 },
  email: { type: String, maxlength: 100 },
  mobile: { type: String, required: true, maxlength: 20 },
  alternate_mobile: { type: String, maxlength: 20 },
  address: { type: String, maxlength: 500 },
  city: { type: String, maxlength: 100 },
  state: { type: String, maxlength: 100 },
  pincode: { type: String, maxlength: 10 },
  requirement: { type: String, maxlength: 500 },
  budget: { type: Number, default: 0 },
  property_type: { type: String, maxlength: 100 },
  preferred_locations: [{ type: String }],
  society: { type: String, maxlength: 200 },
  flat_number: { type: String, maxlength: 50 },
  tower: { type: String, maxlength: 100 },
  key_available: { type: Boolean, default: false },
  flat_size: { type: Number },
  source: {
    type: String,
    enum: ['facebook', 'google', 'instagram', 'website', 'walk_in', 'referral', '99acres', 'magicbricks', 'housing', 'nobroker', 'justdial', 'indiamart', 'flatdekho', 'olx', 'other', 'social_media', 'call', 'ad'],
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'hot', 'warm', 'cold', 'follow_up', 'site_visit', 'negotiation', 'won', 'lost'],
    default: 'new'
  },
  lead_score: { type: Number, default: 0, min: 0, max: 100 },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_at: { type: Date },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, maxlength: 1000 },
  call_notes: [{
    text: { type: String },
    createdAt: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  lost_reason: { type: String, maxlength: 500 },
  follow_up_reason: { type: String, maxlength: 500 },
  last_contacted: { type: Date },
  next_follow_up: { type: Date },
  converted_to_client: { type: Boolean, default: false },
  converted_to_client_at: { type: Date },
  converted_client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  conversion_details: {
    transaction_type: { type: String, enum: ['sell', 'purchase', 'rent', 'interior'] },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    interior_project: { type: mongoose.Schema.Types.ObjectId, ref: 'InteriorProject' },
    key_taken: { type: Boolean, default: false },
    key: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyKey' },
  },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

leadSchema.index({ tenant: 1, mobile: 1, email: 1 })
leadSchema.index({ tenant: 1, status: 1 })
leadSchema.index({ tenant: 1, assigned_to: 1 })
leadSchema.index({ tenant: 1, source: 1 })
leadSchema.index({ tenant: 1, lead_score: -1 })
leadSchema.index({ tenant: 1, email: 1 })
leadSchema.index({ tenant: 1, mobile: 1 })
leadSchema.index({ tenant: 1, next_follow_up: 1 })

const Lead = mongoose.model('Lead', leadSchema)

// Drop stale indexes that no longer exist in schema (e.g., tenant_1_lead_id_1)
Lead.collection.indexes()
  .then(indexes => {
    indexes.forEach(index => {
      if (index.name === 'tenant_1_lead_id_1') {
        Lead.collection.dropIndex(index.name).catch(() => {})
      }
    })
  })
  .catch(() => {})

export default Lead
