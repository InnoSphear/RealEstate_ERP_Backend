import express from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import connectDb from './config/db.js'
import configureCloudinary from './config/cloudinary.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ quiet: true })

const app = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

import authRoutes from './routes/authRoutes.js'
import tenantRoutes from './routes/tenantRoutes.js'
import userRoutes from './routes/userRoutes.js'
import roleRoutes from './routes/roleRoutes.js'
import permissionRoutes from './routes/permissionRoutes.js'
import employeeRoutes from './routes/employeeRoutes.js'
import attendanceRoutes from './routes/attendanceRoutes.js'
import leaveRoutes from './routes/leaveRoutes.js'
import clientRoutes from './routes/clientRoutes.js'
import leadRoutes from './routes/leadRoutes.js'
import followUpRoutes from './routes/followUpRoutes.js'
import propertyRoutes from './routes/propertyRoutes.js'
import propertyKeyRoutes from './routes/propertyKeyRoutes.js'
import projectRoutes from './routes/projectRoutes.js'
import siteVisitRoutes from './routes/siteVisitRoutes.js'
import invoiceRoutes from './routes/invoiceRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import commissionRoutes from './routes/commissionRoutes.js'
import incomeRoutes from './routes/incomeRoutes.js'
import expenseRoutes from './routes/expenseRoutes.js'
import visitorRoutes from './routes/visitorRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import branchRoutes from './routes/branchRoutes.js'
import activityLogRoutes from './routes/activityLogRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import interiorProjectRoutes from './routes/interiorProjectRoutes.js'
import rentalApartmentRoutes from './routes/rentalApartmentRoutes.js'
import interiorInvoiceRoutes from './routes/interiorInvoiceRoutes.js'
import vendorRoutes from './routes/vendorRoutes.js'
import documentRoutes from './routes/documentRoutes.js'
import stockRoutes from './routes/stockRoutes.js'
import materialRoutes from './routes/materialRoutes.js'
import estimateRoutes from './routes/estimateRoutes.js'
import clientDueRoutes from './routes/clientDueRoutes.js'
import externalBrokerRoutes from './routes/externalBrokerRoutes.js'

app.use('/api/auth', authRoutes)
app.use('/api/branches', branchRoutes)
app.use('/api/tenants', tenantRoutes)
app.use('/api/users', userRoutes)
app.use('/api/roles', roleRoutes)
app.use('/api/permissions', permissionRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/leads', leadRoutes)
app.use('/api/follow-ups', followUpRoutes)
app.use('/api/properties', propertyRoutes)
app.use('/api/property-keys', propertyKeyRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/site-visits', siteVisitRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/commissions', commissionRoutes)
app.use('/api/income', incomeRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/visitors', visitorRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/activity-logs', activityLogRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/interior-projects', interiorProjectRoutes)
app.use('/api/rental-apartments', rentalApartmentRoutes)
app.use('/api/interior-invoices', interiorInvoiceRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/external-brokers', externalBrokerRoutes)
app.use('/api/estimates', estimateRoutes)
app.use('/api/client-dues', clientDueRoutes)

const frontendDist = path.resolve(process.env.FRONTEND_DIST_PATH || path.join(__dirname, '..', 'frontend', 'dist'))

app.use(express.static(frontendDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      return
    }
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  },
}))

app.get('/', (req, res) => res.json({ message: 'Shivam International ERP + CRM SaaS API all working' }))

app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  if (req.path.startsWith('/api')) return next()
  if (/\.\w+$/.test(req.path)) return next()
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

const start = async () => {
  await connectDb()

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    configureCloudinary()
  }

  const Tenant = (await import('./models/Tenant.js')).default
  const Role = (await import('./models/Role.js')).default
  const Permission = (await import('./models/Permission.js')).default
  const User = (await import('./models/User.js')).default

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@realestateerp.com'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123'
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator'

  let tenant = await Tenant.findOne({ company_email: ADMIN_EMAIL })
  if (!tenant) {
    tenant = await Tenant.findOne({})
    if (tenant) {
      tenant.company_email = ADMIN_EMAIL
    }
  }
  if (tenant) {
    tenant.is_active = true
    tenant.subscription_status = 'active'
    tenant.company_phone = '+91 98991 46931 | 9891075835'
    tenant.company_address = 'F-2 G001, Amrapali Terrace Homes, Techzone-4, Greater Noida West, Gautam Buddha Nagar, Uttar Pradesh – 201308, India'
    await tenant.save()
  } else {
      tenant = await Tenant.create({
        company_name: 'Shivam International',
        company_email: ADMIN_EMAIL,
        company_phone: '+91 98991 46931 | 9891075835',
        company_address: 'F-2 G001, Amrapali Terrace Homes, Techzone-4, Greater Noida West, Gautam Buddha Nagar, Uttar Pradesh – 201308, India',
        subscription_plan: 'enterprise',
        subscription_status: 'active',
        max_users: 100,
        max_properties: 1000,
        max_projects: 100,
        storage_limit_mb: 10000,
        is_active: true,
      })
    }

  const ALL_MODULES = ['leads','clients','properties','projects','invoices','payments','expenses','income','commissions','employees','attendance','leaves','site_visits','follow_ups','visitors','reports','users','roles','settings','dashboard','activity_logs','notifications','property_keys','tenants','branches','vendors','interior_projects','interior_invoices','external_brokers']
  const ALL_ACTIONS = ['create','read','update','delete','manage','approve','export','send']

  const ensurePermissions = async (modules, actions) => {
    const ids = []
    for (const module of modules) {
      for (const action of actions) {
        const existing = await Permission.findOne({ tenant: tenant._id, module, action })
        if (existing) {
          ids.push(existing._id)
        } else {
          const perm = await Permission.create({ tenant: tenant._id, module, action })
          ids.push(perm._id)
        }
      }
    }
    return ids
  }

  const allPermIds = await ensurePermissions(ALL_MODULES, ALL_ACTIONS)

  let adminRole = await Role.findOne({ tenant: tenant._id, slug: 'admin' })
  if (!adminRole) {
    adminRole = await Role.create({
      tenant: tenant._id,
      name: 'Admin',
      slug: 'admin',
      description: 'Full access admin',
      permissions: allPermIds,
      is_system: true,
    })
  }

  const defaultRoles = [
    { name: 'Manager', slug: 'manager', description: 'Manager with read/write access to most modules', permissions: ['leads','clients','properties','projects','site_visits','follow_ups','employees','attendance','leaves','reports','dashboard','activity_logs','notifications'], actions: ['create','read','update','delete','export','approve'] },
    { name: 'Telecaller', slug: 'telecaller', description: 'Telecaller focused on leads and clients', permissions: ['leads','clients','properties','follow_ups','dashboard','notifications','external_brokers'], actions: ['create','read','update'] },
    { name: 'Sales Executive', slug: 'sales_executive', description: 'Sales executive handling leads, properties, and site visits', permissions: ['leads','clients','properties','projects','site_visits','follow_ups','documents','dashboard','notifications','external_brokers'], actions: ['create','read','update'] },
    { name: 'Accounts', slug: 'accounts', description: 'Accounts team for invoices, payments, commissions, income, expenses', permissions: ['invoices','payments','commissions','income','expenses','reports','dashboard','notifications','clients','properties','external_brokers'], actions: ['create','read','update','delete','export'] },
    { name: 'Receptionist', slug: 'receptionist', description: 'Receptionist managing visitors and leads', permissions: ['visitors','leads','clients','properties','dashboard','notifications'], actions: ['create','read','update'] },
    { name: 'Agent', slug: 'agent', description: 'Real estate agent focused on properties', permissions: ['properties','clients','dashboard','notifications'], actions: ['create','read','update'] },
    { name: 'Interior Manager', slug: 'interior_manager', description: 'Interior manager with employee CRM access plus full interior section, excluding P&L', permissions: ['leads','clients','properties','projects','site_visits','follow_ups','employees','attendance','leaves','activity_logs','notifications','dashboard','interior_projects','interior_invoices','external_brokers'], actions: ['create','read','update','delete','export','approve'] },
    { name: 'Junior Interior Manager', slug: 'junior_interior_manager', description: 'Junior interior manager with lead and interior project management access', permissions: ['leads','clients','properties','site_visits','follow_ups','interior_projects','notifications','dashboard','external_brokers'], actions: ['create','read','update'] },
  ]

  for (const roleDef of defaultRoles) {
    const existing = await Role.findOne({ tenant: tenant._id, slug: roleDef.slug })
    const permIds = []
    for (const module of ALL_MODULES) {
      if (roleDef.permissions.includes(module)) {
        for (const action of roleDef.actions) {
          const perm = await Permission.findOne({ tenant: tenant._id, module, action })
          if (perm) permIds.push(perm._id)
        }
      }
    }
    if (!existing) {
      await Role.create({
        tenant: tenant._id,
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        permissions: permIds,
        is_system: true,
      })
      console.log(`Created system role '${roleDef.slug}'`)
    }
  }

  await User.deleteMany({ role_slug: 'super_admin' })
  await Role.deleteMany({ slug: 'super_admin' })

  let adminUser = await User.findOne({ email: ADMIN_EMAIL })
  if (!adminUser) {
    adminUser = await User.create({
      tenant: tenant._id,
      full_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: '9999999999',
      role: adminRole._id,
      role_slug: 'admin',
      password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      is_active: true,
    })
  } else {
    let needsSave = false
    if (adminUser.tenant?.toString() !== tenant._id.toString()) {
      adminUser.tenant = tenant._id
      needsSave = true
    }
    if (adminUser.role_slug !== 'admin') {
      adminUser.role_slug = 'admin'
      adminUser.role = adminRole._id
      needsSave = true
    }
    if (!adminUser.is_active) {
      adminUser.is_active = true
      needsSave = true
    }
    const pwMatch = await bcrypt.compare(ADMIN_PASSWORD, adminUser.password_hash)
    if (!pwMatch) {
      adminUser.password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10)
      needsSave = true
    }
    adminUser.is_deleted = false
    if (needsSave) await adminUser.save()
  }

  app.listen(process.env.PORT, () => {
    console.log(`Server is running on ${process.env.PORT}`)
  })
}

start()
