import express from 'express'
import { createPO, getPOs, getPOById, updatePO, deletePO, uploadBillPhoto, uploadInvoice } from '../controllers/purchaseOrderController.js'
import { protect } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.route('/')
  .post(protect, createPO)
  .get(protect, getPOs)

router.route('/:id')
  .get(protect, getPOById)
  .put(protect, updatePO)
  .delete(protect, deletePO)

router.post('/:id/upload-bill', protect, upload.single('bill_photo'), uploadBillPhoto)
router.post('/:id/upload-invoice', protect, upload.single('invoice'), uploadInvoice)

export default router
