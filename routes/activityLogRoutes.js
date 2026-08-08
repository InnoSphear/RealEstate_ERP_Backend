import express from 'express'
import {
  getActivityLogs,
  getActivityLogById,
  getActivityLogsByUser,
  getSystemLogs,
  getMyActivityLogs,
} from '../controllers/activityLogController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect)

router.get('/', authorize('admin', 'manager'), getActivityLogs)
router.get('/my', getMyActivityLogs)
router.get('/system', authorize('admin', 'manager'), getSystemLogs)
router.get('/:id', getActivityLogById)
router.get('/user/:userId', authorize('admin', 'manager'), getActivityLogsByUser)

export default router
