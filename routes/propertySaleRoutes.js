import express from 'express'
import { createSale, getSales, getSaleById, updateSale, deleteSale } from '../controllers/propertySaleController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createSale)
  .get(protect, getSales)

router.route('/:id')
  .get(protect, getSaleById)
  .put(protect, updateSale)
  .delete(protect, deleteSale)

export default router
