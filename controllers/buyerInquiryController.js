import BuyerInquiry from '../models/BuyerInquiry.js'

export const createInquiry = async (req, res) => {
  try { const inquiry = await BuyerInquiry.create(req.body); res.status(201).json(inquiry) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getInquiries = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.listing_id) filter.listing_id = req.query.listing_id
    const inquiries = await BuyerInquiry.find(filter)
      .populate('listing_id', 'listing_code title asking_price')
      .populate('client_id', 'full_name phone')
      .populate('handled_by', 'full_name')
    res.json(inquiries)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getInquiryById = async (req, res) => {
  try {
    const inquiry = await BuyerInquiry.findById(req.params.id)
      .populate('listing_id', 'listing_code title asking_price')
      .populate('client_id', 'full_name phone email')
      .populate('handled_by', 'full_name email')
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' })
    res.json(inquiry)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateInquiry = async (req, res) => {
  try { const inquiry = await BuyerInquiry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' }); res.json(inquiry) }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteInquiry = async (req, res) => {
  try { const inquiry = await BuyerInquiry.findByIdAndDelete(req.params.id); if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' }); res.json({ message: 'Inquiry deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
