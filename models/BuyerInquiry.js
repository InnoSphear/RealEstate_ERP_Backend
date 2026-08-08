import mongoose from 'mongoose'

const buyerInquirySchema = new mongoose.Schema({
  listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyListing', required: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  handled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inquiry_date: { type: Date },
  offered_price: { type: Number },
  status: {
    type: String,
    enum: ['new', 'follow_up', 'negotiating', 'closed_won', 'closed_lost'],
    default: 'new'
  },
  notes: { type: String },
}, { timestamps: true })

buyerInquirySchema.index({ listing_id: 1 })
buyerInquirySchema.index({ client_id: 1 })
buyerInquirySchema.index({ handled_by: 1 })

export default mongoose.model('BuyerInquiry', buyerInquirySchema)
