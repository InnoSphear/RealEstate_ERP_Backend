import Document from '../models/Document.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

export const getDocuments = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.module) filter.module = req.query.module
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { file_name: { $regex: req.query.search, $options: 'i' } },
      ]
    }
    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
    res.json(docs)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadDocument = async (req, res) => {
  try {
    const { module, module_item_id, name } = req.body
    if (!module || !module_item_id) {
      return res.status(400).json({ message: 'module and module_item_id are required' })
    }
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' })
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(400).json({ message: 'Cloudinary not configured' })
    }
    const result = await uploadToCloudinary(req.file.buffer)
    const doc = await Document.create({
      tenant: req.tenant._id,
      module,
      module_item_id,
      name: name || req.file.originalname,
      file_name: req.file.originalname,
      file_url: result.url,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: req.user._id,
    })
    res.status(201).json(doc)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!doc) return res.status(404).json({ message: 'Document not found' })
    res.json({ message: 'Document deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
    if (!doc) return res.status(404).json({ message: 'Document not found' })
    res.redirect(doc.file_url)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
