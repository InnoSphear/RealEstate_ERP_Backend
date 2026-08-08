import mongoose from 'mongoose'

const propertySchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  property_id: { type: String, required: true, maxlength: 50 },
  owner_name: { type: String, required: true, maxlength: 100 },
  owner_contact: { type: String, required: true, maxlength: 20 },
  owner_email: { type: String, maxlength: 100 },
  flat_number: { type: String, maxlength: 50 },
  tower: { type: String, maxlength: 100 },
  building_name: { type: String, maxlength: 200 },
  society_name: { type: String, maxlength: 200 },
  location: { type: String, required: true, maxlength: 300 },
  city: { type: String, maxlength: 100 },
  state: { type: String, maxlength: 100 },
  pincode: { type: String, maxlength: 10 },
  property_type: {
    type: String,
    enum: ['apartment', 'villa', 'plot', 'commercial', 'shop', 'office', 'warehouse', 'penthouse', 'other'],
    required: true
  },
  unit_type: {
    type: String,
    enum: ['1RK', '1BHK', '2BHK', '2+1', '3BHK', '3+1', '4BHK', '4+1', '5BHK', 'Penthouse', 'Studio', 'Other'],
    default: 'Other'
  },
  // Predefined project names: Dream Valley, O2 Valley, ACPTH (Ace Parkway Tower H), ACPTG (Ace Parkway Tower G), Low Rise, Verona Heights, Gaurs, ACP (Ace City Parkway), other
  project_name: { type: String, maxlength: 200 },
  size_category: {
    type: String,
    enum: ['small', 'medium', 'large', 'extra_large'],
  },
  carpet_area: { type: Number },
  built_up_area: { type: Number },
  plot_area: { type: Number },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  balconies: { type: Number, default: 0 },
  floors: { type: Number, default: 0 },
  total_floors: { type: Number, default: 0 },
  furnishing_status: {
    type: String,
    enum: ['fully_furnished', 'semi_furnished', 'unfurnished', 'semi-furnished', 'fully-furnished'],
    default: 'unfurnished'
  },
  possession_status: {
    type: String,
    enum: ['ready_to_move', 'under_construction', 'possession_in_6_months', 'possession_in_1_year', 'possession_in_2_years', 'possession_after_6_months', 'possession_after_1_year', 'possession_after_2_years'],
    default: 'ready_to_move'
  },
  availability: {
    type: String,
    enum: ['available', 'sold', 'rented', 'under_offer', 'blocked', 'under_contract', 'off_market'],
    default: 'available'
  },
  listing_type: {
    type: String,
    enum: ['sale', 'rent', 'lease'],
    required: true
  },
  price_sale: { type: Number, default: 0 },
  rent_amount: { type: Number, default: 0 },
  rent_deposit: { type: Number, default: 0 },
  maintenance_amount: { type: Number, default: 0 },
  maintenance_frequency: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
  parking: { type: String, default: '' },
  amenities: [{ type: String }],
  description: { type: String, maxlength: 2000 },
  images: [{
    url: { type: String },
    public_id: { type: String },
    is_primary: { type: Boolean, default: false },
  }],
  videos: [{
    url: { type: String },
    public_id: { type: String },
  }],
  documents: [{
    name: { type: String },
    url: { type: String },
    type: { type: String },
    uploaded_at: { type: Date, default: Date.now },
  }],
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['active', 'inactive', 'sold', 'rented', 'withdrawn'],
    default: 'active'
  },
  featured: { type: Boolean, default: false },
  key_available: { type: Boolean, default: false },
  materials: [{
    item_name: { type: String, required: true },
    cost: { type: Number, required: true },
  }],
  slug: { type: String, unique: true },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

propertySchema.pre('save', async function () {
  if (!this.slug) {
    this.slug = `PR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  }
  if (this.carpet_area != null) {
    if (this.carpet_area < 500) this.size_category = 'small'
    else if (this.carpet_area <= 1000) this.size_category = 'medium'
    else if (this.carpet_area <= 1500) this.size_category = 'large'
    else this.size_category = 'extra_large'
  }
})

propertySchema.index({ tenant: 1, property_id: 1 }, { unique: true })
propertySchema.index({ tenant: 1, property_type: 1 })
propertySchema.index({ tenant: 1, availability: 1 })
propertySchema.index({ tenant: 1, listing_type: 1 })
propertySchema.index({ tenant: 1, location: 1 })
propertySchema.index({ tenant: 1, price_sale: 1 })
propertySchema.index({ tenant: 1, status: 1 })
propertySchema.index({ tenant: 1, featured: 1 })
propertySchema.index({ tenant: 1, city: 1 })
propertySchema.index({ tenant: 1, unit_type: 1 })
propertySchema.index({ tenant: 1, project_name: 1 })
propertySchema.index({ tenant: 1, size_category: 1 })

export default mongoose.model('Property', propertySchema)
