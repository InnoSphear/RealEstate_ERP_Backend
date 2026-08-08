import mongoose from 'mongoose'

const propertyListingSchema = new mongoose.Schema({
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  listed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  listing_code: { type: String, unique: true, maxlength: 30 },
  title: { type: String, required: true, maxlength: 150 },
  property_type: {
    type: String,
    enum: ['apartment', 'villa', 'plot', 'commercial', 'office', 'warehouse'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'under_negotiation', 'sold', 'withdrawn'],
    default: 'active'
  },
  address: { type: String },
  city: { type: String, maxlength: 80 },
  area_sqft: { type: Number },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  asking_price: { type: Number },
  final_price: { type: Number },
  listed_date: { type: Date },
  sold_date: { type: Date },
  description: { type: String },
  notes: { type: String },
}, { timestamps: true })

propertyListingSchema.index({ client_id: 1 })
propertyListingSchema.index({ branch_id: 1 })
propertyListingSchema.index({ listed_by: 1 })
propertyListingSchema.index({ status: 1 })
propertyListingSchema.index({ city: 1, property_type: 1 })

export default mongoose.model('PropertyListing', propertyListingSchema)
