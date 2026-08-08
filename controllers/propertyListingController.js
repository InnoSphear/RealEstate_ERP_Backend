import PropertyListing from '../models/PropertyListing.js'

export const createListing = async (req, res) => {
  try {
    const listing = await PropertyListing.create(req.body);
    const populated = await PropertyListing.findById(listing._id).populate('client_id', 'full_name phone').populate('branch_id', 'name');
    res.status(201).json(populated)
  }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const getListings = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.property_type) filter.property_type = req.query.property_type
    if (req.query.branch_id) filter.branch_id = req.query.branch_id
    if (req.query.city) filter.city = req.query.city
    const listings = await PropertyListing.find(filter)
      .populate('client_id', 'full_name phone')
      .populate('listed_by', 'full_name')
      .populate('branch_id', 'name')
      .sort({ createdAt: -1 })
    res.json(listings)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getListingById = async (req, res) => {
  try {
    const listing = await PropertyListing.findById(req.params.id)
      .populate('client_id', 'full_name phone email')
      .populate('listed_by', 'full_name email')
      .populate('branch_id', 'name city')
    if (!listing) return res.status(404).json({ message: 'Listing not found' })
    res.json(listing)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateListing = async (req, res) => {
  try {
    const listing = await PropertyListing.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    const populated = await PropertyListing.findById(listing._id).populate('client_id', 'full_name phone').populate('branch_id', 'name');
    res.json(populated)
  }
  catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteListing = async (req, res) => {
  try { const listing = await PropertyListing.findByIdAndDelete(req.params.id); if (!listing) return res.status(404).json({ message: 'Listing not found' }); res.json({ message: 'Listing deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
