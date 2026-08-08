import PropertySale from '../models/PropertySale.js'
import PropertyListing from '../models/PropertyListing.js'
import Commission from '../models/Commission.js'

export const createSale = async (req, res) => {
  try {
    const { commissions, ...saleData } = req.body
    if (saleData.sale_price && saleData.commission_pct) {
      saleData.commission_amt = (saleData.sale_price * saleData.commission_pct) / 100
    }
    const sale = await PropertySale.create(saleData)
    if (saleData.listing_id) {
      await PropertyListing.findByIdAndUpdate(saleData.listing_id, { status: 'sold', final_price: saleData.sale_price, sold_date: saleData.agreement_date || new Date() })
    }
    if (commissions && commissions.length) {
      const commissionDocs = commissions.map(c => ({ ...c, sale_id: sale._id }))
      await Commission.insertMany(commissionDocs)
    }
    res.status(201).json(sale)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const getSales = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const sales = await PropertySale.find(filter)
      .populate('listing_id', 'listing_code title property_type')
      .populate('buyer_client_id', 'full_name phone')
      .populate('handled_by', 'full_name')
    res.json(sales)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const getSaleById = async (req, res) => {
  try {
    const sale = await PropertySale.findById(req.params.id)
      .populate('listing_id', 'listing_code title property_type address city')
      .populate('buyer_client_id', 'full_name phone email')
      .populate('handled_by', 'full_name email')
    if (!sale) return res.status(404).json({ message: 'Sale not found' })
    const commissions = await Commission.find({ sale_id: sale._id }).populate('user_id', 'full_name')
    res.json({ ...sale.toObject(), commissions })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateSale = async (req, res) => {
  try {
    if (req.body.sale_price && req.body.commission_pct) {
      req.body.commission_amt = (req.body.sale_price * req.body.commission_pct) / 100
    }
    const sale = await PropertySale.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!sale) return res.status(404).json({ message: 'Sale not found' })
    res.json(sale)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteSale = async (req, res) => {
  try {
    const sale = await PropertySale.findByIdAndDelete(req.params.id)
    if (!sale) return res.status(404).json({ message: 'Sale not found' })
    if (sale.listing_id) {
      await PropertyListing.findByIdAndUpdate(sale.listing_id, { status: 'active', $unset: { final_price: '', sold_date: '' } })
    }
    await Commission.deleteMany({ sale_id: req.params.id })
    res.json({ message: 'Sale deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
}
