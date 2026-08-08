import express from 'express'
import {
  createLeave,
  getLeaves,
  getLeavesByEmployee,
  approveLeave,
  rejectLeave,
  updateLeave,
  getLeaveBalance,
  getMyLeaves,
  applyLeave,
} from '../controllers/leaveController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect)

router.post('/apply', applyLeave)
router.get('/my', getMyLeaves)
router.get('/balance', getLeaveBalance)
router.get('/balance/:employeeId', authorize('admin', 'manager'), getLeaveBalance)

router.use(authorize('admin', 'manager'))

router.route('/')
  .post(checkPermission('leaves', 'create'), createLeave)
  .get(getLeaves)

router.get('/employee/:employeeId', getLeavesByEmployee)

router.route('/:id').put(checkPermission('leaves', 'update'), updateLeave)
router.put('/:id/approve', approveLeave)
router.put('/:id/reject', rejectLeave)

export default router