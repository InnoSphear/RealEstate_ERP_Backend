import Property from '../models/Property.js'
import PropertyKey from '../models/PropertyKey.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'
import Employee from '../models/Employee.js'
import Commission from '../models/Commission.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

export const createProperty = async (req, res) => {
  try {
    const { property_id } = req.body
    const generatedId = property_id || `PR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const existing = await Property.findOne({ tenant: req.tenant._id, property_id: generatedId })
    if (existing) return res.status(400).json({ message: 'Property with this ID already exists' })

    const bodyData = { ...req.body }
    if (typeof bodyData.amenities === 'string') {
      bodyData.amenities = bodyData.amenities.split(',').map(a => a.trim()).filter(Boolean)
    }
    if (typeof bodyData.materials === 'string') {
      try { bodyData.materials = JSON.parse(bodyData.materials) } catch (e) { bodyData.materials = [] }
    }
    if (bodyData.key_available === 'true') bodyData.key_available = true
    if (bodyData.key_available === 'false') bodyData.key_available = false
    if (bodyData.flat_number === '') delete bodyData.flat_number
    if (bodyData.carpet_area != null) {
      const ca = Number(bodyData.carpet_area)
      if (ca < 500) bodyData.size_category = 'small'
      else if (ca <= 1000) bodyData.size_category = 'medium'
      else if (ca <= 1500) bodyData.size_category = 'large'
      else bodyData.size_category = 'extra_large'
    }

    const uploadedImages = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, { folder: 'property_images' })
          uploadedImages.push({ url: result.url, public_id: result.public_id, is_primary: uploadedImages.length === 0 })
        } catch { /* skip failed uploads */ }
      }
    }
    bodyData.images = [...(bodyData.images || []), ...uploadedImages]

    const property = await Property.create({ ...bodyData, property_id: generatedId, tenant: req.tenant._id, created_by: req.user._id })
    const populated = await Property.findById(property._id)
      .populate('assigned_to', 'full_name email')
      .populate('created_by', 'full_name email')

    if (bodyData.key_available === true) {
      const existingKey = await PropertyKey.findOne({ tenant: req.tenant._id, property: property._id, is_deleted: false })
      if (!existingKey) {
        const keyCount = await PropertyKey.countDocuments({ tenant: req.tenant._id, property: property._id })
        await PropertyKey.create({
          tenant: req.tenant._id,
          property: property._id,
          key_number: `${generatedId}-KEY-${keyCount + 1}`,
          status: 'available',
        })
      }
    }

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_property',
      resource: 'Property',
      resource_id: property._id,
      description: `Property ${property.property_id} created at ${property.location}`,
      type: 'crud',
      severity: 'info',
    })

    try {
      const employee = await Employee.findOne({ user: req.user._id, tenant: req.tenant._id })
      if (employee && employee.department === 'telecalling') {
        const requiredFields = ['property_id', 'property_type', 'location', 'price_sale', 'bedrooms', 'bathrooms', 'furnishing_status', 'availability']
        const isComplete = requiredFields.every(f => property[f] != null && property[f] !== '' && property[f] !== 0)
        if (isComplete) {
          await Commission.create({
            tenant: req.tenant._id,
            employee: employee._id,
            user: req.user._id,
            commission_type: 'fixed',
            commission_value: 150,
            commission_amount: 150,
            source: 'sale',
            source_id: property._id,
            source_description: 'Complete inventory entry',
            status: 'pending',
          })
        }
      }
    } catch (e) {
      // silent fail on commission auto-creation
    }

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getProperties = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.property_type) filter.property_type = req.query.property_type
    if (req.query.unit_type) filter.unit_type = req.query.unit_type
    if (req.query.furnishing_status) filter.furnishing_status = req.query.furnishing_status
    if (req.query.project_name) filter.project_name = { $regex: req.query.project_name, $options: 'i' }
    if (req.query.size_category) filter.size_category = req.query.size_category
    if (req.query.carpet_area) filter.carpet_area = Number(req.query.carpet_area)
    if (req.query.status) filter.status = req.query.status
    if (req.query.availability) filter.availability = req.query.availability
    if (req.query.listing_type) filter.listing_type = req.query.listing_type
    if (req.query.city) filter.city = req.query.city
    if (req.query.featured !== undefined) filter.featured = req.query.featured === 'true'
    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to
    if (req.query.price_min || req.query.price_max) {
      const priceMin = req.query.price_min ? parseFloat(req.query.price_min) : 0
      const priceMax = req.query.price_max ? parseFloat(req.query.price_max) : Infinity
      const lt = req.query.listing_type
      if (lt === 'rent' || lt === 'lease') {
        filter.rent_amount = { $gte: priceMin, ...(req.query.price_max ? { $lte: priceMax } : {}) }
      } else if (lt === 'sale') {
        filter.price_sale = { $gte: priceMin, ...(req.query.price_max ? { $lte: priceMax } : {}) }
      } else {
        filter.price_sale = { $gte: priceMin, ...(req.query.price_max ? { $lte: priceMax } : {}) }
      }
    }
    if (req.query.society_name) filter.society_name = { $regex: req.query.society_name, $options: 'i' }
    if (req.query.tower) filter.tower = { $regex: req.query.tower, $options: 'i' }
    if (req.query.built_up_area_min || req.query.built_up_area_max) {
      filter.built_up_area = {}
      if (req.query.built_up_area_min) filter.built_up_area.$gte = parseFloat(req.query.built_up_area_min)
      if (req.query.built_up_area_max) filter.built_up_area.$lte = parseFloat(req.query.built_up_area_max)
    }

    const andConditions = []
    if (req.query.search) {
      const searchTerm = req.query.search
      const orConditions = [
        { property_id: { $regex: searchTerm, $options: 'i' } },
        { owner_name: { $regex: searchTerm, $options: 'i' } },
        { owner_contact: { $regex: searchTerm, $options: 'i' } },
        { owner_email: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } },
        { society_name: { $regex: searchTerm, $options: 'i' } },
        { flat_number: { $regex: searchTerm, $options: 'i' } },
        { tower: { $regex: searchTerm, $options: 'i' } },
        { city: { $regex: searchTerm, $options: 'i' } },
        { building_name: { $regex: searchTerm, $options: 'i' } },
        { property_type: { $regex: searchTerm, $options: 'i' } },
        { project_name: { $regex: searchTerm, $options: 'i' } },
        { unit_type: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { furnishing_status: { $regex: searchTerm, $options: 'i' } },
        { status: { $regex: searchTerm, $options: 'i' } },
      ]
      const numericMatch = String(searchTerm).match(/\d+(?:\.\d+)?/)
      if (numericMatch) {
        const num = Number(numericMatch[0])
        orConditions.push(
          { carpet_area: num },
          { built_up_area: num },
          { plot_area: num },
          { price_sale: num },
          { rent_amount: num },
        )
      }
      andConditions.push({ $or: orConditions })
    }

    if (req.query.created_by_employee) {
      const emp = await Employee.findOne({ _id: req.query.created_by_employee, tenant: req.tenant._id }).select('user')
      if (emp && emp.user) filter.created_by = emp.user
    }
    const dateFrom = req.query.date_from || req.query.from_date
    const dateTo = req.query.date_to || req.query.to_date
    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom)
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    if (req.query.scope !== 'all') {
      const roleSlug = req.user.role_slug || req.user.role?.slug
      if (roleSlug !== 'admin' && roleSlug !== 'manager') {
        andConditions.push({
          $or: [
            { assigned_to: req.user._id },
            { created_by: req.user._id },
          ]
        })
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions
    }

    const properties = await Property.find(filter)
      .populate('assigned_to', 'full_name email')
      .populate('created_by', 'full_name email')
      .populate('client', 'full_name mobile client_id')
      .sort({ createdAt: -1 })

    res.json(properties)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPropertyById = async (req, res) => {
  try {
    const filter = { _id: req.params.id, tenant: req.tenant._id, is_deleted: false }
    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin' && roleSlug !== 'manager') {
      filter.$or = [
        { assigned_to: req.user._id },
        { created_by: req.user._id },
      ]
    }
    const property = await Property.findOne(filter)
      .populate('assigned_to', 'full_name email phone')
      .populate('created_by', 'full_name email')
      .populate('client', 'full_name mobile client_id email')
    if (!property) return res.status(404).json({ message: 'Property not found' })

    const keys = await PropertyKey.find({ property: property._id, tenant: req.tenant._id, is_deleted: false })
      .populate('issued_to', 'full_name')
      .populate('issued_by', 'full_name')
      .populate('key_holder', 'full_name')
      .sort({ createdAt: -1 })

    const visibleKeys = property.status === 'active' ? keys : []

    res.json({ ...property.toObject(), keys: visibleKeys })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateProperty = async (req, res) => {
  try {
    const bodyData = { ...req.body }
    delete bodyData.tenant
    delete bodyData.property_id
    delete bodyData.is_deleted
    if (typeof bodyData.amenities === 'string') {
      bodyData.amenities = bodyData.amenities.split(',').map(a => a.trim()).filter(Boolean)
    }
    if (typeof bodyData.materials === 'string') {
      try { bodyData.materials = JSON.parse(bodyData.materials) } catch (e) { bodyData.materials = [] }
    }
    if (bodyData.key_available === 'true') bodyData.key_available = true
    if (bodyData.key_available === 'false') bodyData.key_available = false
    if (bodyData.carpet_area != null) {
      const ca = Number(bodyData.carpet_area)
      if (ca < 500) bodyData.size_category = 'small'
      else if (ca <= 1000) bodyData.size_category = 'medium'
      else if (ca <= 1500) bodyData.size_category = 'large'
      else bodyData.size_category = 'extra_large'
    }

    if (req.files && req.files.length > 0) {
      const uploadedImages = []
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, { folder: 'property_images' })
          uploadedImages.push({ url: result.url, public_id: result.public_id, is_primary: false })
        } catch { /* skip failed uploads */ }
      }
      bodyData.images = [...(bodyData.images || []), ...uploadedImages]
    }

    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    Object.assign(property, bodyData)
    await property.save()

    if (bodyData.key_available === true) {
      const existingKey = await PropertyKey.findOne({ tenant: req.tenant._id, property: property._id, is_deleted: false })
      if (!existingKey) {
        const keyCount = await PropertyKey.countDocuments({ tenant: req.tenant._id, property: property._id })
        await PropertyKey.create({
          tenant: req.tenant._id,
          property: property._id,
          key_number: `${property.property_id}-KEY-${keyCount + 1}`,
          status: 'available',
        })
      }
    }

    const populated = await Property.findById(property._id).populate('assigned_to', 'full_name email').populate('created_by', 'full_name email').populate('client', 'full_name mobile client_id')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_property',
      resource: 'Property',
      resource_id: property._id,
      description: `Property ${property.property_id} updated`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteProperty = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug === 'interior_manager' || roleSlug === 'junior_interior_manager') {
      return res.status(403).json({ message: 'Interior managers cannot delete properties' })
    }
    const property = await Property.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_property',
      resource: 'Property',
      resource_id: property._id,
      description: `Property ${property.property_id} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Property deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const bulkDeleteProperties = async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' })
    }
    const result = await Property.deleteMany(
      { _id: { $in: ids }, tenant: req.tenant._id }
    )
    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'bulk_delete_properties',
      resource: 'Property',
      resource_id: null,
      description: `${result.deletedCount} properties bulk deleted`,
      type: 'crud',
      severity: 'warning',
    })
    res.json({ message: `${result.deletedCount} properties deleted successfully` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadImages = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    const { images } = req.body
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: 'Images array is required' })
    }

    images.forEach((img) => {
      property.images.push({ url: img.url, public_id: img.public_id || '', is_primary: property.images.length === 0 && !property.images.some((i) => i.is_primary) })
    })
    await property.save()

    res.json(property)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const uploadVideo = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    const { url, public_id } = req.body
    if (!url) return res.status(400).json({ message: 'Video URL is required' })

    property.videos.push({ url, public_id: public_id || '' })
    await property.save()

    res.json(property)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const uploadDocument = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    const { name, url, type } = req.body
    if (!name || !url) return res.status(400).json({ message: 'Document name and url are required' })

    property.documents.push({ name, url, type, uploaded_at: new Date() })
    await property.save()

    res.json(property)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const setPrimaryImage = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    const { imageId } = req.params
    const image = property.images.id(imageId)
    if (!image) return res.status(404).json({ message: 'Image not found' })

    property.images.forEach((img) => { img.is_primary = false })
    image.is_primary = true
    await property.save()

    res.json(property)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const toggleFeatured = async (req, res) => {
  try {
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      [{ $set: { featured: { $not: '$featured' } } }],
      { new: true }
    )
    if (!property) return res.status(404).json({ message: 'Property not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'toggle_featured',
      resource: 'Property',
      resource_id: property._id,
      description: `Property ${property.property_id} featured status: ${property.featured}`,
      type: 'crud',
      severity: 'info',
    })

    res.json({ featured: property.featured })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const transferProperty = async (req, res) => {
  try {
    const { assigned_to } = req.body
    if (!assigned_to) return res.status(400).json({ message: 'Assigned to user is required' })

    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    const targetUser = await User.findById(assigned_to)
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' })

    property.assigned_to = assigned_to
    await property.save()

    const populated = await Property.findById(property._id)
      .populate('assigned_to', 'full_name email')
      .populate('created_by', 'full_name email')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'transfer_property',
      resource: 'Property',
      resource_id: property._id,
      description: `Property ${property.property_id} transferred to ${targetUser.full_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const syncClientRelations = async (req, res) => {
  try {
    const Property = (await import('../models/Property.js')).default
    const Client = (await import('../models/Client.js')).default
    const properties = await Property.find({ tenant: req.tenant._id, is_deleted: false }).lean()
    let updated = 0
    for (const prop of properties) {
      const client = await Client.findOne({ tenant: req.tenant._id, property: prop._id, is_deleted: false }).lean()
      if (client && (!prop.client || prop.client.toString() !== client._id.toString())) {
        await Property.updateOne({ _id: prop._id }, { client: client._id })
        updated++
      }
    }
    res.json({ message: `${updated} properties synced with their clients` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const removeClientFromProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })
    const oldClient = property.client
    property.client = undefined
    await property.save()
    if (oldClient) {
      const Client = (await import('../models/Client.js')).default
      await Client.findOneAndUpdate(
        { _id: oldClient, tenant: req.tenant._id },
        { $unset: { property: '' } }
      )
    }
    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'remove_client_from_property',
      resource: 'Property',
      resource_id: property._id,
      description: `Client removed from property ${property.property_id}`,
      type: 'crud',
      severity: 'warning',
    })
    res.json({ message: 'Client removed from property', property })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getGallery = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!property) return res.status(404).json({ message: 'Property not found' })

    res.json({
      images: property.images,
      videos: property.videos,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
