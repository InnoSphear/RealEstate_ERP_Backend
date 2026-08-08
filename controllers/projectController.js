import Project from '../models/Project.js'
import ActivityLog from '../models/ActivityLog.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

export const createProject = async (req, res) => {
  try {
    const { project_name } = req.body
    if (!project_name) return res.status(400).json({ message: 'Project name is required' })

    const bodyData = { ...req.body }
    const uploadedImages = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, { folder: 'project_images' })
          uploadedImages.push({ url: result.url, public_id: result.public_id, is_primary: uploadedImages.length === 0 })
        } catch { /* skip failed uploads */ }
      }
    }
    bodyData.images = [...(bodyData.images || []), ...uploadedImages]

    const project = await Project.create({ ...bodyData, tenant: req.tenant._id })
    const populated = await Project.findById(project._id)

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_project',
      resource: 'Project',
      resource_id: project._id,
      description: `Project ${project.project_name} created`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getProjects = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.city) filter.city = req.query.city
    if (req.query.featured !== undefined) filter.featured = req.query.featured === 'true'
    if (req.query.search) {
      filter.$or = [
        { project_name: { $regex: req.query.search, $options: 'i' } },
        { builder_name: { $regex: req.query.search, $options: 'i' } },
        { location: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 })
    res.json(projects)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!project) return res.status(404).json({ message: 'Project not found' })
    res.json(project)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateProject = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.is_deleted

    if (req.files && req.files.length > 0) {
      const uploadedImages = []
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, { folder: 'project_images' })
          uploadedImages.push({ url: result.url, public_id: result.public_id, is_primary: false })
        } catch { /* skip failed uploads */ }
      }
      data.images = [...(data.images || []), ...uploadedImages]
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
    if (!project) return res.status(404).json({ message: 'Project not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'update_project',
      resource: 'Project',
      resource_id: project._id,
      description: `Project ${project.project_name} updated`,
      type: 'crud',
      severity: 'info',
    })

    res.json(project)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_project',
      resource: 'Project',
      resource_id: project._id,
      description: `Project ${project.project_name} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Project deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadImages = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { images } = req.body
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: 'Images array is required' })
    }

    images.forEach((img) => {
      project.images.push({
        url: img.url,
        public_id: img.public_id || '',
        is_primary: project.images.length === 0 && !project.images.some((i) => i.is_primary),
      })
    })
    await project.save()

    res.json(project)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const uploadBrochure = async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      { brochure: req.body.url },
      { new: true }
    )
    if (!project) return res.status(404).json({ message: 'Project not found' })

    res.json({ brochure: project.brochure })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const addDailyUpdate = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { title, description } = req.body
    if (!title || !description) return res.status(400).json({ message: 'Title and description are required' })

    const imageUrls = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, { folder: 'project_daily_updates' })
          imageUrls.push(result.url)
        } catch { /* skip failed uploads */ }
      }
    }

    project.daily_updates.push({
      date: new Date(),
      title,
      description,
      images: imageUrls,
      updated_by: req.user._id,
    })
    await project.save()

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'add_daily_update',
      resource: 'Project',
      resource_id: project._id,
      description: `Daily update added to ${project.project_name}`,
      type: 'crud',
      severity: 'info',
    })

    res.json(project)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getProjectUnits = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    res.json({
      total_units: project.total_units,
      available_units: project.available_units,
      sold_units: project.total_units - project.available_units,
      unit_types: project.unit_types,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
