import express from 'express'
import {
  getEstimates,
  getEstimateById,
  createEstimate,
  updateEstimate,
  deleteEstimate,
} from '../controllers/estimateController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'interior_manager', 'junior_interior_manager'))

router.route('/')
  .get(getEstimates)
  .post(createEstimate)

router.route('/:id')
  .get(getEstimateById)
  .put(updateEstimate)
  .delete(deleteEstimate)

export default router
