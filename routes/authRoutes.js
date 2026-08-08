import express from 'express'
import {
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
} from '../controllers/authController.js'
import { protect } from '../middlewares/auth.js'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = express.Router()

router.post('/reset-admin', async (req, res) => {
  try {
    const email = req.body.email || 'admin@realestateerp.com'
    const password = req.body.password || 'Admin@123'
    const adminUser = await User.findOne({ email }).populate('tenant')
    if (!adminUser) return res.status(404).json({ message: 'Admin user not found. Restart server to seed.' })
    adminUser.is_active = true
    adminUser.is_deleted = false
    adminUser.password_hash = await bcrypt.hash(password, 10)
    adminUser.sessions = []
    adminUser.refresh_token = null
    await adminUser.save()
    res.json({ message: 'Admin reset successful', email, password })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/login', login)
router.post('/logout', protect, logout)
router.post('/refresh-token', refreshToken)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)
router.put('/change-password', protect, changePassword)
router.get('/me', protect, getMe)
router.put('/profile', protect, updateProfile)

export default router
