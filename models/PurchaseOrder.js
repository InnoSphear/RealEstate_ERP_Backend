import mongoose from 'mongoose'

const purchaseOrderSchema = new mongoose.Schema({
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  requisition_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequisition' },
  raised_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  po_number: { type: String, unique: true, maxlength: 30 },
  supplier_name: { type: String, maxlength: 100 },
  supplier_contact: { type: String, maxlength: 100 },
  order_date: { type: Date },
  expected_delivery: { type: Date },
  actual_delivery: { type: Date },
  total_amount: { type: Number },
  status: {
    type: String,
    enum: ['draft', 'sent', 'received', 'partial', 'cancelled'],
    default: 'draft'
  },
  payment_status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  invoice_url: { type: String },
  invoice_public_id: { type: String },
  invoice_number: { type: String, maxlength: 100 },
  purchaser_name: { type: String, maxlength: 200 },
  payment_reference: { type: String, maxlength: 200 },
  bill_photos: [{ url: String, public_id: String, name: String, uploaded_at: { type: Date, default: Date.now } }],
  notes: { type: String },
}, { timestamps: true })

purchaseOrderSchema.index({ branch_id: 1 })
purchaseOrderSchema.index({ requisition_id: 1 })
purchaseOrderSchema.index({ raised_by: 1 })
purchaseOrderSchema.index({ status: 1 })

export default mongoose.model('PurchaseOrder', purchaseOrderSchema)
