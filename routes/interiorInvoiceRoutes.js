import express from 'express'
import {
  createInteriorInvoice,
  getInteriorInvoices,
  getInteriorInvoiceById,
  updateInteriorInvoice,
  deleteInteriorInvoice,
  markInteriorInvoicePaid,
  sendInteriorInvoice,
  getInteriorInvoicesByProject,
  getInteriorInvoiceStats,
} from '../controllers/interiorInvoiceController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts', 'interior_manager'))

router.route('/')
  .post(createInteriorInvoice)
  .get(getInteriorInvoices)

router.get('/stats', getInteriorInvoiceStats)
router.get('/by-project/:projectId', getInteriorInvoicesByProject)

router.route('/:id')
  .get(getInteriorInvoiceById)
  .put(updateInteriorInvoice)
  .delete(deleteInteriorInvoice)

router.put('/:id/mark-paid', markInteriorInvoicePaid)
router.put('/:id/send', sendInteriorInvoice)

export default router
