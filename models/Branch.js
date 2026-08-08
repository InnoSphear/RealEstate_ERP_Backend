import mongoose from 'mongoose'

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  address: { type: String },
  city: { type: String, maxlength: 50 },
  phone: { type: String, maxlength: 20 },
  is_active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Branch', branchSchema)
