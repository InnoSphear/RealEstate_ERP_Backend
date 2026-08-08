import express from 'express'
import {
  generateLeadReport,
  generateEmployeeReport,
  generateSalesReport,
  generateRevenueReport,
  generatePropertyReport,
  generateCommissionReport,
  generateAttendanceReport,
  generateRentReport,
  generateInteriorProjectReport,
  generateLeadConversionReport,
  generateEmployeePerformanceReport,
  generateEmployeeWiseReport,
  generateUserWiseReport,
  generateInventoryReport,
  getReportHistory,
  saveReportHistory,
  deleteReportHistory,
} from '../controllers/reportController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts'))

router.get('/leads', generateLeadReport)
router.get('/employees', generateEmployeeReport)
router.get('/sales', generateSalesReport)
router.get('/revenue', generateRevenueReport)
router.get('/properties', generatePropertyReport)
router.get('/commissions', generateCommissionReport)
router.get('/attendance', generateAttendanceReport)
router.get('/rent', generateRentReport)
router.get('/interior-projects', generateInteriorProjectReport)
router.get('/lead-conversion', generateLeadConversionReport)
router.get('/employee-performance', generateEmployeePerformanceReport)
router.get('/employee-wise', generateEmployeeWiseReport)
router.get('/user-wise', generateUserWiseReport)
router.get('/inventory', generateInventoryReport)
router.get('/history', getReportHistory)
router.post('/history', saveReportHistory)
router.delete('/history/:id', deleteReportHistory)

export default router
