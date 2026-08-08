import { Router } from 'express'
import { getStock, createStock, updateStock, deleteStock, adjustStock } from '../controllers/stockController.js'
import { protect } from '../middlewares/auth.js'

const router = Router()
router.use(protect)

router.route('/')
  .get(getStock)
  .post(createStock)

router.route('/:id')
  .put(updateStock)
  .delete(deleteStock)

router.put('/:id/adjust', adjustStock)

export default router