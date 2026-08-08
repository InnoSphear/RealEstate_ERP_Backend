import express from 'express'
import {
  markAttendance,
  getAttendance,
  getAttendanceByEmployee,
  getMonthlyReport,
  updateAttendance,
  deleteAttendance,
  checkIn,
  checkOut,
  getMyAttendance,
  approveAttendance,
  rejectAttendance,
  getPayrollSummary,
  processEndOfDay,
  getAttendanceSettings,
  updateAttendanceSettings,
  exportAttendanceSummary,
} from '../controllers/attendanceController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect)

router.post('/check-in', checkIn)
router.post('/check-out', checkOut)
router.get('/my', getMyAttendance)
router.get('/payroll-summary', authorize('admin', 'manager'), getPayrollSummary)
router.post('/process-end-of-day', authorize('admin'), processEndOfDay)

router.route('/')
  .post(authorize('admin', 'manager'), markAttendance)
  .get(authorize('admin', 'manager', 'interior_manager', 'junior_interior_manager'), getAttendance)

router.put('/:id/approve', authorize('admin'), approveAttendance)
router.put('/:id/reject', authorize('admin'), rejectAttendance)

router.get('/export-summary', authorize('admin', 'manager'), exportAttendanceSummary)
router.get('/settings', authorize('admin', 'manager'), getAttendanceSettings)
router.put('/settings', authorize('admin'), updateAttendanceSettings)

router.get('/employee/:employeeId', getAttendanceByEmployee)
router.get('/monthly-report', authorize('admin', 'manager'), getMonthlyReport)

router.route('/:id')
  .put(authorize('admin', 'manager'), updateAttendance)
  .delete(authorize('admin'), deleteAttendance)

export default router
