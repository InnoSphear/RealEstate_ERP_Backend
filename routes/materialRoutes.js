import express from 'express'
import { createMaterial, getMaterials, getLowStockMaterials, getMaterialById, updateMaterial, deleteMaterial, bulkUpdateMaterials } from '../controllers/materialController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createMaterial)
  .get(protect, getMaterials)

router.get('/low-stock', protect, getLowStockMaterials)
router.post('/bulk', protect, bulkUpdateMaterials)

router.route('/:id')
  .get(protect, getMaterialById)
  .put(protect, updateMaterial)
  .delete(protect, deleteMaterial)

export default router