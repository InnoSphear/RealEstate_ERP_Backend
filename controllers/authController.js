import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'

const getRoleSlug = (user) => user.role?.slug || user.role_slug

const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, tenant: user.tenant, role_slug: getRoleSlug(user) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '15m' })

const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' })

const getClientInfo = (req) => ({
  ip: req.ip || req.connection?.remoteAddress,
  user_agent: req.headers['user-agent'],
  device: req.headers['user-agent']?.substring(0, 100),
  browser: req.headers['user-agent']?.substring(0, 100),
})

export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' })

    const user = await User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .populate('tenant', 'company_name subscription_status')
      .populate({ path: 'role', select: 'name slug permissions', populate: { path: 'permissions', select: 'module action' } })

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    if (user.is_deleted) return res.status(401).json({ message: 'Account not found' })
    if (!user.is_active) return res.status(401).json({ message: 'Account is deactivated. Contact administrator.' })

    const tenant = user.tenant
    if (tenant && tenant.subscription_status === 'expired') {
      return res.status(403).json({ message: 'Company subscription has expired' })
    }

    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    const deviceInfo = {
      token: refreshToken,
      device: req.headers['user-agent']?.substring(0, 100) || 'Unknown',
      ip: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'],
      last_active: new Date(),
      is_active: true,
      login_at: new Date(),
    }

    user.refresh_token = refreshToken
    user.sessions.push(deviceInfo)
    user.last_login = new Date()
    user.last_login_ip = req.ip || req.connection?.remoteAddress
    user.last_login_device = req.headers['user-agent']?.substring(0, 100)
    await user.save()

    await ActivityLog.create({
      tenant: user.tenant?._id || user.tenant,
      user: user._id,
      action: 'login',
      resource: 'User',
      resource_id: user._id,
      description: `${user.full_name} logged in`,
      type: 'login',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.json({
      _id: user._id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      role_slug: getRoleSlug(user),
      tenant: user.tenant,
      profile_photo: user.profile_photo,
      token: accessToken,
      refreshToken,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (refreshToken) {
      user.sessions = user.sessions.filter((s) => s.token !== refreshToken)
      if (user.refresh_token === refreshToken) user.refresh_token = null
    } else {
      user.refresh_token = null
      user.sessions = []
    }
    await user.save()

    await ActivityLog.create({
      tenant: req.tenant?._id || req.user.tenant,
      user: req.user._id,
      action: 'logout',
      resource: 'User',
      resource_id: req.user._id,
      description: `${req.user.full_name} logged out`,
      type: 'logout',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' })

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
    const user = await User.findOne({ _id: decoded.id, refresh_token: refreshToken, is_deleted: false }).populate('role', 'slug')
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' })
    if (!user.is_active) return res.status(401).json({ message: 'Account deactivated' })

    const session = user.sessions.find((s) => s.token === refreshToken && s.is_active)
    if (!session) return res.status(401).json({ message: 'Session expired' })

    const newAccessToken = generateAccessToken(user)
    const newRefreshToken = generateRefreshToken(user)

    session.token = newRefreshToken
    session.last_active = new Date()
    user.refresh_token = newRefreshToken
    await user.save()

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired refresh token' })
    }
    res.status(500).json({ message: err.message })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
    if (!user) return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' })

    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    user.reset_password_token = hashedToken
    user.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000)
    await user.save()

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`

    await ActivityLog.create({
      tenant: user.tenant,
      user: user._id,
      action: 'forgot_password',
      resource: 'User',
      resource_id: user._id,
      description: `Password reset requested for ${user.email}`,
      type: 'auth',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.json({ message: 'If an account with that email exists, a reset link has been sent.', resetUrl })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const user = await User.findOne({
      reset_password_token: hashedToken,
      reset_password_expires: { $gt: new Date() },
      is_deleted: false,
    })
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' })

    user.password_hash = await bcrypt.hash(password, 10)
    user.reset_password_token = null
    user.reset_password_expires = null
    user.password_changed_at = new Date()
    user.sessions = []
    user.refresh_token = null
    await user.save()

    await ActivityLog.create({
      tenant: user.tenant,
      user: user._id,
      action: 'reset_password',
      resource: 'User',
      resource_id: user._id,
      description: `Password reset completed for ${user.email}`,
      type: 'auth',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.json({ message: 'Password reset successful. Please login with your new password.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current password and new password are required' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' })

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    user.password_hash = await bcrypt.hash(newPassword, 10)
    user.password_changed_at = new Date()
    await user.save()

    await ActivityLog.create({
      tenant: req.tenant?._id || req.user.tenant,
      user: req.user._id,
      action: 'change_password',
      resource: 'User',
      resource_id: req.user._id,
      description: `${req.user.full_name} changed their password`,
      type: 'auth',
      severity: 'info',
      ...getClientInfo(req),
    })

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('tenant', 'company_name company_email company_phone company_logo subscription_plan subscription_status company_address')
      .populate({ path: 'role', select: 'name slug permissions', populate: { path: 'permissions', select: 'module action' } })
      .populate('employee', 'employee_id full_name department designation photo')
      .select('-password_hash -refresh_token -reset_password_token -reset_password_expires -sessions')
    if (!user) return res.status(404).json({ message: 'User not found' })
    const userObj = user.toObject()
    userObj.role_slug = getRoleSlug(user)
    res.json(userObj)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateProfile = async (req, res) => {
  try {
    const allowedFields = ['full_name', 'phone', 'profile_photo']
    const updates = {}
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No fields to update' })

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
      .populate('tenant', 'company_name')
      .populate('role', 'name slug')
      .select('-password_hash -refresh_token -sessions')
    if (!user) return res.status(404).json({ message: 'User not found' })

    await ActivityLog.create({
      tenant: req.tenant?._id || req.user.tenant,
      user: req.user._id,
      action: 'update_profile',
      resource: 'User',
      resource_id: req.user._id,
      description: `${req.user.full_name} updated their profile`,
      type: 'crud',
      severity: 'info',
      details: updates,
      ...getClientInfo(req),
    })

    res.json(user)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}
