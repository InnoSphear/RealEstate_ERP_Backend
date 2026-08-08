import mongoose from 'mongoose'

const reportHistorySchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  report_type: { type: String, required: true, maxlength: 50 },
  format: { type: String, enum: ['excel', 'csv', 'pdf', 'json'], default: 'excel' },
  status: {
    type: String, enum: ['pending', 'generating', 'completed', 'failed'], default: 'completed'
  },
  filters: { type: mongoose.Schema.Types.Mixed },
  rows_generated: { type: Number, default: 0 },
  file_size: { type: String, maxlength: 20 },
  download_url: { type: String },
  error_message: { type: String, maxlength: 500 },
}, { timestamps: true })

reportHistorySchema.index({ tenant: 1, createdAt: -1 })
reportHistorySchema.index({ tenant: 1, user: 1 })

export default mongoose.model('ReportHistory', reportHistorySchema)
