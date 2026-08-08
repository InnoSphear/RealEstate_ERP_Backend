import express from 'express'
import {
  createSiteVisit,
  getSiteVisits,
  getSiteVisitById,
  updateSiteVisit,
  confirmSiteVisit,
  completeSiteVisit,
  cancelSiteVisit,
  rescheduleSiteVisit,
  convertSiteVisit,
  bulkDeleteSiteVisits,
} from '../controllers/siteVisitController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'sales_executive'))

router.post('/bulk-delete', checkPermission('site_visits', 'delete'), bulkDeleteSiteVisits)

router.route('/')
  .post(checkPermission('site_visits', 'create'), createSiteVisit)
  .get(getSiteVisits)

router.route('/:id')
  .get(getSiteVisitById)
  .put(checkPermission('site_visits', 'update'), updateSiteVisit)

router.put('/:id/confirm', confirmSiteVisit)
router.put('/:id/complete', completeSiteVisit)
router.put('/:id/cancel', cancelSiteVisit)
router.put('/:id/reschedule', rescheduleSiteVisit)

export default router
