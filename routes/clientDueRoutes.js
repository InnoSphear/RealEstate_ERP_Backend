import express from 'express'
import {
  createClientDue,
  getClientDues,
  getAllClientDues,
  updateClientDue,
  deleteClientDue,
} from '../controllers/clientDueController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts'))

router.route('/')
  .post(createClientDue)
  .get(getAllClientDues)

router.route('/:id')
  .put(updateClientDue)
  .delete(deleteClientDue)

router.get('/by-client/:clientId', getClientDues)

export default router
