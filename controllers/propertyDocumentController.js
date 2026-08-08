import PropertyDocument from '../models/PropertyDocument.js'

export const uploadDocument = async (req, res) => {
  try { const doc = await PropertyDocument.create(req.body); res.status(201).json(doc) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getDocumentsByListing = async (req, res) => {
  try {
    const docs = await PropertyDocument.find({ listing_id: req.params.listingId })
      .populate('uploaded_by', 'full_name')
    res.json(docs)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateDocument = async (req, res) => {
  try { const doc = await PropertyDocument.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!doc) return res.status(404).json({ message: 'Document not found' }); res.json(doc) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteDocument = async (req, res) => {
  try { const doc = await PropertyDocument.findByIdAndDelete(req.params.id); if (!doc) return res.status(404).json({ message: 'Document not found' }); res.json({ message: 'Document deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
