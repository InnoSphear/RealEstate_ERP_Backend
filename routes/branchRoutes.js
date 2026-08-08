import express from 'express'
import { createBranch, getBranches, getBranchById, updateBranch, deleteBranch } from '../controllers/branchController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, authorize('admin'), createBranch)
  .get(protect, getBranches)

router.route('/:id')
  .get(protect, getBranchById)
  .put(protect, authorize('admin'), updateBranch)
  .delete(protect, authorize('admin'), deleteBranch)

export default router
