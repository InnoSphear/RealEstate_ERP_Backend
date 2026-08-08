import mongoose from 'mongoose'

const propertyDocumentSchema = new mongoose.Schema({
  listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyListing', required: true },
  doc_type: { type: String, maxlength: 50 },
  file_url: { type: String, maxlength: 255 },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploaded_at: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
})

propertyDocumentSchema.index({ listing_id: 1 })
propertyDocumentSchema.index({ uploaded_by: 1 })
propertyDocumentSchema.index({ doc_type: 1 })

export default mongoose.model('PropertyDocument', propertyDocumentSchema)
