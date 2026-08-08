import RevenueSummary from '../models/RevenueSummary.js'

export const createRevenueSummary = async (req, res) => {
  try {
    const data = req.body
    data.net_revenue = (data.total_collected || 0) - (data.total_expenses || 0) - (data.total_material_cost || 0)
    const summary = await RevenueSummary.create(data)
    res.status(201).json(summary)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const getRevenueSummaries = async (req, res) => {
  try {
    const filter = {}
    if (req.query.branch_id) filter.branch_id = req.query.branch_id
    if (req.query.period_month) filter.period_month = parseInt(req.query.period_month)
    if (req.query.period_year) filter.period_year = parseInt(req.query.period_year)
    if (req.query.source_type) filter.source_type = req.query.source_type
    const summaries = await RevenueSummary.find(filter).populate('branch_id', 'name')
    res.json(summaries)
  } catch (err) { res.status(500).json({ message: err.message }) }
}

export const updateRevenueSummary = async (req, res) => {
  try {
    const data = req.body
    data.net_revenue = (data.total_collected || 0) - (data.total_expenses || 0) - (data.total_material_cost || 0)
    const summary = await RevenueSummary.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    if (!summary) return res.status(404).json({ message: 'Revenue summary not found' })
    res.json(summary)
  } catch (err) { res.status(400).json({ message: err.message }) }
}

export const deleteRevenueSummary = async (req, res) => {
  try { const summary = await RevenueSummary.findByIdAndDelete(req.params.id); if (!summary) return res.status(404).json({ message: 'Revenue summary not found' }); res.json({ message: 'Revenue summary deleted' }) }
  catch (err) { res.status(500).json({ message: err.message }) }
}
