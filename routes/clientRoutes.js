import express from 'express'
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  uploadDocument,
  getTimeline,
  getCommunicationHistory,
  convertFromLead,
  getClientRequirements,
  getClientFollowUps,
  addClientNote,
  getClientNotes,
} from '../controllers/clientController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'agent', 'receptionist', 'interior_manager', 'junior_interior_manager'))

router.route('/')
  .post(checkPermission('clients', 'create'), createClient)
  .get(getClients)

router.route('/:id')
  .get(getClientById)
  .put(checkPermission('clients', 'update'), updateClient)
  .delete(checkPermission('clients', 'delete'), deleteClient)

router.post('/:id/documents', upload.single('file'), uploadDocument)
router.get('/:id/timeline', getTimeline)
router.get('/:id/communications', getCommunicationHistory)
router.get('/:id/requirements', getClientRequirements)
router.get('/:id/follow-ups', getClientFollowUps)
router.post('/:id/notes', addClientNote)
router.get('/:id/notes', getClientNotes)
router.post('/convert-from-lead/:leadId', convertFromLead)

export default router
