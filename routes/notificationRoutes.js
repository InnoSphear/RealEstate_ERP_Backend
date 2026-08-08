import express from 'express'
import {
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  sendNotification,
} from '../controllers/notificationController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'))

router.get('/', getNotifications)
router.put('/:id/read', markRead)
router.put('/read-all', markAllRead)
router.get('/unread-count', getUnreadCount)

export default router
