import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Role from '../models/Role.js'
import Permission from '../models/Permission.js'

export const protect = async (req, res, next) => {
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password_hash -refresh_token')
      .populate('tenant', 'company_name subscription_status is_active')
      .populate('role', 'name slug permissions')
    if (!req.user) return res.status(401).json({ message: 'User not found' })
    req.tenant = req.user.tenant
    if (!req.user.is_active) return res.status(401).json({ message: 'Account deactivated' })
    if (req.user.tenant && !req.user.tenant.is_active) {
      return res.status(401).json({ message: 'Organization account is inactive' })
    }
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' })
  }
}

export const authorize = (...allowedSlugs) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).populate('role', 'name slug').lean()
      if (!user || !user.role) {
        return res.status(403).json({ message: 'No role assigned to your account. Contact administrator.' })
      }
      req.user.role = user.role
      req.user.role_slug = user.role.slug

      if (!allowedSlugs.includes(user.role.slug)) {
        return res.status(403).json({
          message: `Access denied: Your role '${user.role.slug}' does not have permission for this resource`,
          required_roles: allowedSlugs,
          your_role: user.role.slug,
        })
      }
      next()
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  }
}

export const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      const role = req.user.role
      if (!role) return res.status(403).json({ message: 'No role assigned to your account. Contact administrator.' })

      const roleDoc = await Role.findById(role._id || role).populate('permissions')
      if (!roleDoc) return res.status(403).json({ message: 'Role not found. Contact administrator.' })

      const hasPermission = roleDoc.permissions.some(
        p => p.module === module && p.action === action
      )

      if (!hasPermission) {
        return res.status(403).json({
          message: `Permission denied: ${module}:${action} for your role '${roleDoc.slug}'`,
          required: { module, action },
          your_role: roleDoc.slug,
        })
      }
      next()
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  }
}


