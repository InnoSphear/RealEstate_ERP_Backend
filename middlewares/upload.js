import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xlsx|csv/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)
  if (extname || mimetype) {
    cb(null, true)
  } else {
    cb(new Error('Only images, PDFs, docs, and spreadsheets are allowed'), false)
  }
}

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
})

export const uploadToCloudinary = async (input, options = {}) => {
  try {
    const cloudinary = (await import('cloudinary')).v2
    const folder = options.folder || 'realestate_erp'
    if (Buffer.isBuffer(input)) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: 'auto' },
          (err, result) => {
            if (err) reject(new Error('Cloudinary upload failed: ' + err.message))
            else resolve({ url: result.secure_url, public_id: result.public_id })
          }
        )
        stream.end(input)
      })
    }
    const result = await cloudinary.uploader.upload(input, {
      folder,
      resource_type: 'auto',
    })
    return { url: result.secure_url, public_id: result.public_id }
  } catch (err) {
    throw new Error('Cloudinary upload failed: ' + err.message)
  }
}

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' })
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(400).json({ message: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET env vars.' })
    }
    const result = await uploadToCloudinary(req.file.buffer)
    res.json({ url: result.url, public_id: result.public_id, originalname: req.file.originalname, mimetype: req.file.mimetype })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
