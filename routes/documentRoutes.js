import express from 'express'
import { getDocuments, uploadDocument, deleteDocument, downloadDocument } from '../controllers/documentController.js'
import { protect } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect)

router.get('/', getDocuments)
router.post('/', upload.single('file'), uploadDocument)
router.get('/:id/download', downloadDocument)
router.delete('/:id', deleteDocument)

export default router
