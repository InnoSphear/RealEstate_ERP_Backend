import express from 'express'
import {
  createVisitor,
  getVisitors,
  getVisitorById,
  updateVisitor,
  checkOutVisitor,
  convertToLead,
} from '../controllers/visitorController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'receptionist'))

router.route('/')
  .post(checkPermission('visitors', 'create'), createVisitor)
  .get(getVisitors)

router.route('/:id')
  .get(getVisitorById)
  .put(checkPermission('visitors', 'update'), updateVisitor)

router.put('/:id/checkout', checkOutVisitor)
router.post('/:id/convert-to-lead', convertToLead)

export default router
