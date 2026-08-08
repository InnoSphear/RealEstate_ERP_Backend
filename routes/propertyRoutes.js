import express from 'express'
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  bulkDeleteProperties,
  uploadImages,
  uploadVideo,
  uploadDocument,
  setPrimaryImage,
  toggleFeatured,
  getGallery,
  transferProperty,
  removeClientFromProperty,
  syncClientRelations,
} from '../controllers/propertyController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'telecaller', 'sales_executive', 'accounts', 'agent', 'receptionist', 'interior_manager', 'junior_interior_manager'))

router.post('/bulk-delete', authorize('admin'), bulkDeleteProperties)

router.route('/')
  .post(upload.array('images', 10), checkPermission('properties', 'create'), createProperty)
  .get(getProperties)

router.route('/:id')
  .get(getPropertyById)
  .put(upload.array('images', 10), checkPermission('properties', 'update'), updateProperty)
  .delete(authorize('admin'), checkPermission('properties', 'delete'), deleteProperty)

router.post('/:id/images', upload.array('images', 10), uploadImages)
router.post('/:id/videos', upload.single('video'), uploadVideo)
router.post('/:id/documents', upload.single('file'), uploadDocument)
router.put('/:id/primary-image/:imageId', setPrimaryImage)
router.put('/:id/featured', toggleFeatured)
router.put('/:id/transfer', checkPermission('properties', 'update'), transferProperty)
router.put('/:id/remove-client', authorize('admin'), removeClientFromProperty)
router.post('/sync-clients', authorize('admin'), syncClientRelations)
router.get('/:id/gallery', getGallery)

export default router
