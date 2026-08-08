import express from 'express'
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  uploadImages,
  uploadBrochure,
  addDailyUpdate,
  getProjectUnits,
} from '../controllers/projectController.js'
import { protect, authorize, checkPermission } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.use(protect, authorize('admin', 'manager', 'sales_executive', 'interior_manager'))

router.route('/')
  .post(upload.array('images', 10), checkPermission('projects', 'create'), createProject)
  .get(getProjects)

router.route('/:id')
  .get(getProjectById)
  .put(upload.array('images', 10), checkPermission('projects', 'update'), updateProject)
  .delete(checkPermission('projects', 'delete'), deleteProject)

router.post('/:id/images', upload.array('images', 10), uploadImages)
router.post('/:id/brochure', upload.single('file'), uploadBrochure)
router.post('/:id/daily-update', upload.array('images', 10), addDailyUpdate)
router.get('/:id/units', getProjectUnits)

export default router
