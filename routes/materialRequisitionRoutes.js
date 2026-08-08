import express from 'express'
import { createRequisition, getRequisitions, getRequisitionById, updateRequisition, deleteRequisition } from '../controllers/materialRequisitionController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createRequisition)
  .get(protect, getRequisitions)

router.route('/:id')
  .get(protect, getRequisitionById)
  .put(protect, updateRequisition)
  .delete(protect, deleteRequisition)

export default router
