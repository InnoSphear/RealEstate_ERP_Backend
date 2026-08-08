import express from 'express'
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  uploadDocument,
  getDocument,
  linkUserEmployee,
} from '../controllers/employeeController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'receptionist', 'interior_manager', 'junior_interior_manager'))

router.post('/link-user', linkUserEmployee)

router.route('/')
  .post(upload.single('photo'), checkPermission('employees', 'create'), createEmployee)
  .get(getEmployees)

router.route('/:id')
  .get(getEmployeeById)
  .put(upload.single('photo'), checkPermission('employees', 'update'), updateEmployee)
  .delete(checkPermission('employees', 'delete'), deleteEmployee)

router.post('/:id/documents', upload.single('document'), uploadDocument)
router.get('/:id/documents/:docId', getDocument)

export default router
