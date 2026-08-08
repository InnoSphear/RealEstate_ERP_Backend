import express from 'express'
import {
  createPermission,
  getPermissions,
  getPermissionsByModule,
  getPermissionById,
  updatePermission,
  deletePermission,
  seedDefaultPermissions,
} from '../controllers/permissionController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin'))

router.route('/')
  .post(createPermission)
  .get(getPermissions)

router.get('/by-module', getPermissionsByModule)
router.post('/seed', seedDefaultPermissions)

router.route('/:id')
  .get(getPermissionById)
  .put(updatePermission)
  .delete(deletePermission)

export default router
