import express from 'express'
import { createRevenueSummary, getRevenueSummaries, updateRevenueSummary, deleteRevenueSummary } from '../controllers/revenueSummaryController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, authorize('admin', 'accounts'), createRevenueSummary)
  .get(protect, getRevenueSummaries)

router.route('/:id')
  .put(protect, authorize('admin', 'accounts'), updateRevenueSummary)
  .delete(protect, authorize('admin'), deleteRevenueSummary)

export default router
