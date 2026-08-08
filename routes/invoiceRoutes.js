import express from 'express'
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  generatePdf,
  sendInvoice,
  markPaid,
  markOverdue,
} from '../controllers/invoiceController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts'))

router.route('/')
  .post(checkPermission('invoices', 'create'), createInvoice)
  .get(getInvoices)

router.route('/:id')
  .get(getInvoiceById)
  .put(checkPermission('invoices', 'update'), updateInvoice)
  .delete(checkPermission('invoices', 'delete'), deleteInvoice)

router.get('/:id/pdf', generatePdf)
router.post('/:id/send', sendInvoice)
router.put('/:id/mark-paid', markPaid)
router.put('/:id/mark-overdue', markOverdue)

export default router
