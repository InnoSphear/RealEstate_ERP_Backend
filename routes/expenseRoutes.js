import express from 'express'
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  getMonthlyReport,
  getYearlyReport,
} from '../controllers/expenseController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'agent', 'receptionist', 'interior_manager', 'junior_interior_manager'))

router.route('/')
  .post(createExpense)
  .get(getExpenses)

router.route('/:id')
  .get(getExpenseById)
  .put(updateExpense)
  .delete(deleteExpense)

router.put('/:id/approve', approveExpense)
router.put('/:id/reject', rejectExpense)
router.get('/monthly-report', getMonthlyReport)
router.get('/yearly-report', getYearlyReport)

export default router
