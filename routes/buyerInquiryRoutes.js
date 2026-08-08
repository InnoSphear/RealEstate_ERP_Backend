import express from 'express'
import { createInquiry, getInquiries, getInquiryById, updateInquiry, deleteInquiry } from '../controllers/buyerInquiryController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createInquiry)
  .get(protect, getInquiries)

router.route('/:id')
  .get(protect, getInquiryById)
  .put(protect, updateInquiry)
  .delete(protect, deleteInquiry)

export default router
