import express from 'express'
import {
  createRental,
  getRentals,
  getRentalById,
  updateRental,
  deleteRental,
  getPrintableInfo,
} from '../controllers/rentalApartmentController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'receptionist', 'agent', 'interior_manager'))

router.route('/')
  .post(checkPermission('properties', 'create'), createRental)
  .get(getRentals)

router.get('/:id/print', getPrintableInfo)

router.route('/:id')
  .get(getRentalById)
  .put(checkPermission('properties', 'update'), updateRental)
  .delete(checkPermission('properties', 'delete'), deleteRental)

export default router
