import mongoose from 'mongoose'

const propertySaleSchema = new mongoose.Schema({
  listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyListing', required: true },
  buyer_client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  handled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sale_code: { type: String, unique: true, maxlength: 30 },
  agreement_date: { type: Date },
  possession_date: { type: Date },
  sale_price: { type: Number },
  commission_pct: { type: Number },
  commission_amt: { type: Number },
  payment_mode: { type: String, maxlength: 50 },
  status: {
    type: String,
    enum: ['agreement_signed', 'registered', 'possession_given'],
    default: 'agreement_signed'
  },
  remarks: { type: String },
}, { timestamps: true })

propertySaleSchema.index({ listing_id: 1 })
propertySaleSchema.index({ buyer_client_id: 1 })
propertySaleSchema.index({ handled_by: 1 })
propertySaleSchema.index({ status: 1 })

export default mongoose.model('PropertySale', propertySaleSchema)
