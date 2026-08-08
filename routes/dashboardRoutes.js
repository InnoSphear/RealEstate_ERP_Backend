import express from 'express'
import { getStats } from '../controllers/dashboardController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.get('/stats', protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'receptionist', 'agent', 'interior_manager', 'junior_interior_manager'), getStats)

export default router
