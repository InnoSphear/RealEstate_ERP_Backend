import express from 'express'
import { createUsage, getUsageByProject, getAllUsage, updateUsage, deleteUsage } from '../controllers/productionUsageController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createUsage)
  .get(protect, getAllUsage)

router.get('/project/:projectId', protect, getUsageByProject)
router.route('/:id')
  .put(protect, updateUsage)
  .delete(protect, deleteUsage)

export default router
