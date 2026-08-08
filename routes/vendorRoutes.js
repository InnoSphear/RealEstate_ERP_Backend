import express from 'express'
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  addPurchase,
  addPayment,
  getVendorStats,
} from '../controllers/vendorController.js'
import { protect, authorize } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'accounts', 'interior_manager', 'junior_interior_manager'))

router.get('/stats', getVendorStats)
router.route('/')
  .post(createVendor)
  .get(getVendors)

router.route('/:id')
  .get(getVendorById)
  .put(updateVendor)
  .delete(authorize('admin'), deleteVendor)

router.post('/:id/purchases', addPurchase)
router.post('/:id/payments', addPayment)

export default router
