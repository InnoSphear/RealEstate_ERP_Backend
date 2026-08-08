import mongoose from 'mongoose'

const rentalApartmentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  unit_number: { type: String, required: true, maxlength: 50 },
  building_name: { type: String, maxlength: 200 },
  floor: { type: String, maxlength: 50 },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  area_sqft: { type: Number },
  rent_amount: { type: Number, required: true },
  security_deposit: { type: Number, default: 0 },
  maintenance_charge: { type: Number, default: 0 },
  furnishing: {
    type: String,
    enum: ['fully_furnished', 'semi_furnished', 'unfurnished'],
    default: 'unfurnished'
  },
  status: {
    type: String,
    enum: ['vacant', 'occupied', 'under_maintenance'],
    default: 'vacant'
  },
  owner: {
    name: { type: String, required: true, maxlength: 100 },
    contact: { type: String, required: true, maxlength: 20 },
    email: { type: String, maxlength: 100 },
    address: { type: String, maxlength: 300 },
  },
  tenant_info: {
    name: { type: String, maxlength: 100 },
    contact: { type: String, maxlength: 20 },
    email: { type: String, maxlength: 100 },
    aadhar: { type: String, maxlength: 20 },
    move_in_date: { type: Date },
    move_out_date: { type: Date },
    emergency_contact: { type: String, maxlength: 20 },
  },
  rental_start_date: { type: Date },
  rental_end_date: { type: Date },
  agreement_period_months: { type: Number, default: 11 },
  rent_due_day: { type: Number, default: 5, min: 1, max: 31 },
  notice_period_days: { type: Number, default: 30 },
  amenities: [{ type: String }],
  documents: [{
    name: { type: String },
    url: { type: String },
    type: { type: String, enum: ['agreement', 'receipt', 'id_proof', 'other'] },
    uploaded_at: { type: Date, default: Date.now },
  }],
  notes: { type: String, maxlength: 1000 },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

rentalApartmentSchema.index({ tenant: 1, unit_number: 1 })
rentalApartmentSchema.index({ tenant: 1, status: 1 })
rentalApartmentSchema.index({ tenant: 1, property: 1 })

export default mongoose.model('RentalApartment', rentalApartmentSchema)
