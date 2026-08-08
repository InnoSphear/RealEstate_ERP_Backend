import express from 'express'
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  bulkImport,
  bulkTransferLeads,
  bulkDeleteLeads,
  transferToSales,
  getLeadsByScore,
  convertToClient,
  addCallNote,
  getLeadHistory,
  exportLeads,
} from '../controllers/leadController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'receptionist', 'interior_manager', 'junior_interior_manager'))

router.get('/export', exportLeads)
router.get('/by-score', getLeadsByScore)
router.post('/import', upload.single('file'), bulkImport)
router.post('/bulk-import', upload.single('file'), bulkImport)
router.put('/bulk-transfer', checkPermission('leads', 'update'), bulkTransferLeads)
router.post('/bulk-delete', authorize('admin'), bulkDeleteLeads)

router.route('/')
  .post(checkPermission('leads', 'create'), createLead)
  .get(getLeads)

router.route('/:id')
  .get(getLeadById)
  .put(checkPermission('leads', 'update'), updateLead)
  .delete(checkPermission('leads', 'delete'), deleteLead)

router.put('/:id/transfer', checkPermission('leads', 'update'), transferToSales)
router.put('/:id/transfer-to-sales', checkPermission('leads', 'update'), transferToSales)
router.put('/:id/convert-to-client', checkPermission('leads', 'update'), convertToClient)
router.post('/:id/call-notes', checkPermission('leads', 'update'), addCallNote)
router.get('/:id/history', getLeadHistory)

export default router