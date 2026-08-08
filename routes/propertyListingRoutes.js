import express from 'express'
import { createListing, getListings, getListingById, updateListing, deleteListing } from '../controllers/propertyListingController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.route('/')
  .post(protect, createListing)
  .get(protect, getListings)

router.route('/:id')
  .get(protect, getListingById)
  .put(protect, updateListing)
  .delete(protect, deleteListing)

export default router
