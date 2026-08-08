import express from 'express'
import {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  getPaymentsByInvoice,
  getPaymentsByClient,
  uploadReceipt,
  getPaymentReceipt,
  getClientBill,
  getPaymentReasons,
  receivePayment,
} from '../controllers/paymentController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect)

router.route('/')
  .post(authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), createPayment)
  .get(authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getPayments)

router.get('/reasons', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getPaymentReasons)

router.get('/by-invoice/:invoiceId', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getPaymentsByInvoice)
router.get('/by-client/:clientId', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getPaymentsByClient)
router.get('/client-bill/:clientId', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getClientBill)

router.route('/:id')
  .get(authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getPaymentById)
  .put(authorize('admin'), checkPermission('payments', 'update'), updatePayment)
  .delete(authorize('admin'), checkPermission('payments', 'delete'), deletePayment)

router.get('/:id/receipt', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getPaymentReceipt)
router.post('/:id/receive', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), receivePayment)
router.post('/:id/upload-receipt', authorize('admin', 'manager', 'accounts', 'telecaller', 'sales_executive', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), upload.single('receipt'), uploadReceipt)

export default router
