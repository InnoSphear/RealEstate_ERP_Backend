import express from 'express'
import {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  updateSubscription,
  updateLimits,
  getTenantStats,
} from '../controllers/tenantController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin'))

router.route('/')
  .post(createTenant)
  .get(getTenants)

router.route('/:id')
  .get(getTenantById)
  .put(updateTenant)
  .delete(deleteTenant)

router.put('/:id/subscription', updateSubscription)
router.put('/:id/limits', updateLimits)
router.get('/:id/stats', getTenantStats)

export default router
