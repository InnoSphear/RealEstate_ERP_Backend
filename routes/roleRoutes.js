import express from 'express'
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from '../controllers/roleController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin'))

router.route('/')
  .post(createRole)
  .get(getRoles)

router.route('/:id')
  .get(getRoleById)
  .put(updateRole)
  .delete(deleteRole)

export default router
