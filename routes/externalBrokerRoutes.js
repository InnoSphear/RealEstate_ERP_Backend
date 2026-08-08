import express from 'express'
import {
  createExternalBroker,
  getExternalBrokers,
  getExternalBrokerById,
  updateExternalBroker,
  deleteExternalBroker,
  getExternalBrokerStats,
} from '../controllers/externalBrokerController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts', 'sales_executive', 'telecaller', 'interior_manager', 'junior_interior_manager'))

router.get('/stats', getExternalBrokerStats)
router.route('/')
  .post(createExternalBroker)
  .get(getExternalBrokers)

router.route('/:id')
  .get(getExternalBrokerById)
  .put(updateExternalBroker)
  .delete(authorize('admin'), deleteExternalBroker)

export default router
