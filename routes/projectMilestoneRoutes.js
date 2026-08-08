import express from 'express'
import { createMilestone, getMilestonesByProject, updateMilestone, deleteMilestone } from '../controllers/projectMilestoneController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.post('/', protect, createMilestone)
router.get('/project/:projectId', protect, getMilestonesByProject)
router.route('/:id')
  .put(protect, updateMilestone)
  .delete(protect, deleteMilestone)

export default router
