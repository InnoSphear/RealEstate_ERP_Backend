import Tenant from '../models/Tenant.js'

export const resolveTenant = async (req, res, next) => {
  try {
    if (req.user && req.user.tenant) {
      req.tenant = req.user.tenant
      return next()
    }

    const domain = req.headers['x-tenant-domain']
    const tenantId = req.headers['x-tenant-id']

    if (tenantId) {
      const tenant = await Tenant.findById(tenantId)
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' })
      if (!tenant.is_active) return res.status(403).json({ message: 'Tenant account is inactive' })
      req.tenant = tenant
      return next()
    }

    if (domain) {
      const tenant = await Tenant.findOne({ domain, is_active: true })
      if (!tenant) return res.status(404).json({ message: 'Tenant not found for domain' })
      req.tenant = tenant
      return next()
    }

    return res.status(400).json({ message: 'Tenant identification required' })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

export const checkTenantSubscription = (req, res, next) => {
  const tenant = req.tenant
  if (!tenant) return res.status(400).json({ message: 'Tenant context required' })
  if (tenant.subscription_status === 'expired' || tenant.subscription_status === 'suspended') {
    return res.status(403).json({ message: `Subscription ${tenant.subscription_status}. Please renew.` })
  }
  if (tenant.subscription_end && new Date() > tenant.subscription_end) {
    return res.status(403).json({ message: 'Subscription has expired. Please renew.' })
  }
  next()
}
