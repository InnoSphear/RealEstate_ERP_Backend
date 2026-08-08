import express from 'express'
import { addTeamMember, getTeamByProject, removeTeamMember } from '../controllers/projectTeamController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

router.post('/', protect, addTeamMember)
router.get('/project/:projectId', protect, getTeamByProject)
router.delete('/:id', protect, removeTeamMember)

export default router
