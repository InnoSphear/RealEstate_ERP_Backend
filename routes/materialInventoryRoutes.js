import express from 'express'
import { createInventory, getInventory, getInventoryById, updateInventory, deleteInventory } from '../controllers/materialInventoryController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createInventory)
  .get(protect, getInventory)

router.route('/:id')
  .get(protect, getInventoryById)
  .put(protect, updateInventory)
  .delete(protect, deleteInventory)

export default router
