import express from 'express'
import {
  createIncome,
  getIncomes,
  getIncomeById,
  updateIncome,
  deleteIncome,
  getMonthlyReport,
  getYearlyReport,
  getIncomeGrouped,
} from '../controllers/incomeController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts'))

router.route('/')
  .post(checkPermission('income', 'create'), createIncome)
  .get(getIncomes)

router.get('/grouped', getIncomeGrouped)
router.get('/monthly-report', getMonthlyReport)
router.get('/yearly-report', getYearlyReport)

router.route('/:id')
  .get(getIncomeById)
  .put(checkPermission('income', 'update'), updateIncome)
  .delete(checkPermission('income', 'delete'), deleteIncome)

export default router
