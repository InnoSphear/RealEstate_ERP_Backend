import mongoose from 'mongoose'

const employeeSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  employee_id: { type: String, required: true, maxlength: 50 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  full_name: { type: String, required: true, maxlength: 100 },
  photo: { type: String },
  email: { type: String, required: true, maxlength: 100 },
  mobile: { type: String, required: true, maxlength: 20 },
  alternate_mobile: { type: String, maxlength: 20 },
  address: { type: String, maxlength: 500 },
  city: { type: String, maxlength: 100 },
  state: { type: String, maxlength: 100 },
  pincode: { type: String, maxlength: 10 },
  joining_date: { type: Date, required: true },
  department: {
    type: String,
    enum: ['telecalling', 'sales', 'accounts', 'agent', 'reception', 'management', 'it'],
    required: true
  },
  designation: { type: String, maxlength: 100 },
  employee_type: {
    type: String,
    enum: ['telecaller', 'sales', 'accounts', 'agent', 'reception'],
    required: true
  },
  salary: { type: Number, default: 0 },
  bank_name: { type: String, maxlength: 100 },
  bank_account_no: { type: String, maxlength: 50 },
  bank_ifsc: { type: String, maxlength: 20 },
  pan_number: { type: String, maxlength: 20 },
  aadhar_number: { type: String, maxlength: 20 },
  documents: [{
    name: { type: String },
    url: { type: String },
    type: { type: String },
    uploaded_at: { type: Date, default: Date.now },
  }],
  leave_balance: {
    sick: { type: Number, default: 12 },
    casual: { type: Number, default: 12 },
    annual: { type: Number, default: 15 },
    personal: { type: Number, default: 6 },
  },
  associated_vendors: [{
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    relationship: { type: String },
  }],
  is_active: { type: Boolean, default: true },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date },
}, { timestamps: true })

employeeSchema.index({ tenant: 1, employee_id: 1 }, { unique: true })
employeeSchema.index({ tenant: 1, department: 1 })
employeeSchema.index({ tenant: 1, employee_type: 1 })
employeeSchema.index({ tenant: 1, email: 1 })
employeeSchema.index({ tenant: 1, user: 1 })

export default mongoose.model('Employee', employeeSchema)