import express from 'express'
import { createBudget, getBudgetsByProject, updateBudget, deleteBudget } from '../controllers/projectBudgetController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.post('/', protect, createBudget)
router.get('/project/:projectId', protect, getBudgetsByProject)
router.route('/:id')
  .put(protect, updateBudget)
  .delete(protect, deleteBudget)

export default router
