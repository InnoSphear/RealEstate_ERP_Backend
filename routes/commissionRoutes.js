import express from 'express'
import {
  createCommission,
  getCommissions,
  getCommissionById,
  updateCommission,
  deleteCommission,
  getCommissionsByEmployee,
  getPendingCommissions,
  approveCommission,
  payCommission,
  cancelCommission,
  calculateCommission,
  getMyCommissions,
  requestCommission,
} from '../controllers/commissionController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.get('/my', protect, getMyCommissions)
router.post('/request', protect, requestCommission)

router.use(protect)

router.route('/')
  .post(authorize('admin', 'manager', 'accounts', 'sales_executive', 'telecaller', 'interior_manager', 'junior_interior_manager'), createCommission)
  .get(authorize('admin', 'manager', 'accounts', 'sales_executive', 'telecaller', 'interior_manager', 'junior_interior_manager'), getCommissions)

router.get('/pending', authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'), getPendingCommissions)
router.post('/calculate', authorize('admin', 'manager', 'accounts', 'sales_executive', 'telecaller', 'interior_manager', 'junior_interior_manager'), calculateCommission)
router.get('/employee/:employeeId', authorize('admin', 'manager', 'accounts', 'sales_executive', 'telecaller', 'interior_manager', 'junior_interior_manager'), getCommissionsByEmployee)

router.route('/:id')
  .get(authorize('admin', 'manager', 'accounts', 'sales_executive', 'telecaller', 'interior_manager', 'junior_interior_manager'), getCommissionById)
  .put(authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'), updateCommission)
  .delete(authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'), deleteCommission)

router.put('/:id/approve', authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'), approveCommission)
router.put('/:id/pay', authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'), payCommission)
router.put('/:id/cancel', authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'), cancelCommission)

export default router
