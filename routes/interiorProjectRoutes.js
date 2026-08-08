import express from 'express'
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  createBudget,
  updateBudget,
  deleteBudget,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  addTeamMember,
  removeTeamMember,
  getDashboard,
  addMaterialPayment,
  addMaterial,
  addExpense,
  updateExpense,
  deleteExpense,
  assignVendor,
  removeVendor,
  getProjectVendors,
  assignLabour,
  removeLabour,
  getProjectLabour,
  addProjectPayment,
  deleteProjectPayment,
  deleteMaterial,
  uploadMaterialBill,
  deleteMaterialBill,
  getPurchaseReport,
  getEstimateData,
  getAllProjectPayments,
} from '../controllers/interiorProjectController.js'
import { protect, authorize } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'agent', 'receptionist', 'interior_manager', 'junior_interior_manager'))

router.get('/dashboard', getDashboard)
router.get('/purchase-report', getPurchaseReport)
router.get('/payments/all', getAllProjectPayments)

router.route('/')
  .post(createProject)
  .get(getProjects)

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject)

router.post('/:id/budgets', createBudget)
router.put('/:id/budgets/:budgetId', updateBudget)
router.delete('/:id/budgets/:budgetId', deleteBudget)

router.post('/:id/milestones', createMilestone)
router.put('/:id/milestones/:milestoneId', updateMilestone)
router.delete('/:id/milestones/:milestoneId', deleteMilestone)

router.post('/:id/team', addTeamMember)
router.delete('/:id/team/:teamId', removeTeamMember)

router.post('/:id/materials', addMaterial)
router.post('/:id/materials/:materialId/payments', addMaterialPayment)
router.post('/:id/materials/:materialId/bill', upload.single('file'), uploadMaterialBill)
router.delete('/:id/materials/:materialId/bill/:billId', deleteMaterialBill)

router.post('/:id/expenses', addExpense)
router.put('/:id/expenses/:expenseId', updateExpense)
router.delete('/:id/expenses/:expenseId', deleteExpense)

router.get('/:id/vendors', getProjectVendors)
router.post('/:id/vendors', assignVendor)
router.delete('/:id/vendors/:vendorEntryId', removeVendor)

router.get('/:id/labour', getProjectLabour)
router.post('/:id/labour', assignLabour)
router.delete('/:id/labour/:labourEntryId', removeLabour)

router.get('/:id/estimate', getEstimateData)

router.post('/:id/payments', addProjectPayment)
router.delete('/:id/payments/:paymentId', deleteProjectPayment)

router.delete('/:id/materials/:materialId', deleteMaterial)

export default router
