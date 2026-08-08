import express from 'express'
import {
  createFollowUp,
  getFollowUps,
  getFollowUpCounts,
  getFollowUpById,
  updateFollowUp,
  completeFollowUp,
  rescheduleFollowUp,
  getReminders,
  deleteFollowUp,
  bulkDeleteFollowUps,
  backfillNames,
} from '../controllers/followUpController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'interior_manager'))

router.route('/')
  .post(checkPermission('follow_ups', 'create'), createFollowUp)
  .get(getFollowUps)

router.get('/counts', getFollowUpCounts)
router.get('/reminders', getReminders)
router.post('/backfill-names', backfillNames)

router.post('/bulk-delete', checkPermission('follow_ups', 'delete'), bulkDeleteFollowUps)

router.route('/:id')
  .get(getFollowUpById)
  .put(checkPermission('follow_ups', 'update'), updateFollowUp)
  .delete(checkPermission('follow_ups', 'delete'), deleteFollowUp)
router.put('/:id/complete', completeFollowUp)
router.put('/:id/reschedule', rescheduleFollowUp)

export default router
