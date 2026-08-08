import express from 'express'
import {
  createPropertyKey,
  getPropertyKeys,
  getPropertyKeyById,
  updatePropertyKey,
  issueKey,
  returnKey,
  deletePropertyKey,
  markKeyAvailable,
  markKeyOutside,
  getHistory,
} from '../controllers/propertyKeyController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager'))

router.route('/')
  .post(checkPermission('property_keys', 'create'), createPropertyKey)
  .get(getPropertyKeys)

router.route('/:id')
  .get(getPropertyKeyById)
  .put(checkPermission('property_keys', 'update'), updatePropertyKey)

router.put('/:id/issue', issueKey)
router.put('/:id/return', returnKey)
router.put('/:id/available', markKeyAvailable)
router.put('/:id/outside', markKeyOutside)
router.delete('/:id', deletePropertyKey)
router.get('/:id/history', getHistory)

export default router
