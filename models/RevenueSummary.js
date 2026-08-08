import mongoose from 'mongoose'

const revenueSummarySchema = new mongoose.Schema({
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  period_month: { type: Number, min: 1, max: 12 },
  period_year: { type: Number },
  source_type: {
    type: String,
    enum: ['interior', 'property_sale', 'combined'],
    required: true
  },
  total_invoiced: { type: Number, default: 0 },
  total_collected: { type: Number, default: 0 },
  total_expenses: { type: Number, default: 0 },
  total_material_cost: { type: Number, default: 0 },
  net_revenue: { type: Number, default: 0 },
  generated_at: { type: Date, default: Date.now },
})

revenueSummarySchema.index({ branch_id: 1 })
revenueSummarySchema.index({ period_year: -1, period_month: -1 })

export default mongoose.model('RevenueSummary', revenueSummarySchema)
