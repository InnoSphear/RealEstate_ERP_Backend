import express from 'express'
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleActive,
  bulkCreate,
} from '../controllers/userController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect)

router.route('/')
  .post(authorize('admin'), createUser)
  .get(authorize('admin', 'manager', 'telecaller', 'sales_executive', 'interior_manager', 'junior_interior_manager'), getUsers)

router.post('/bulk', authorize('admin'), bulkCreate)

router.route('/:id')
  .get(authorize('admin', 'manager', 'interior_manager', 'junior_interior_manager'), getUserById)
  .put(authorize('admin'), updateUser)
  .delete(authorize('admin'), deleteUser)

router.put('/:id/toggle-active', authorize('admin'), toggleActive)

export default router
