import express from 'express'
import { uploadDocument, getDocumentsByListing, updateDocument, deleteDocument } from '../controllers/propertyDocumentController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.post('/', protect, uploadDocument)
router.get('/listing/:listingId', protect, getDocumentsByListing)
router.route('/:id')
  .put(protect, updateDocument)
  .delete(protect, deleteDocument)

export default router
