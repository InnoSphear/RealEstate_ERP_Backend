import Income from '../models/Income.js'
import ActivityLog from '../models/ActivityLog.js'
import Expense from '../models/Expense.js'
import PurchaseOrder from '../models/PurchaseOrder.js'

export const createIncome = async (req, res) => {
  try {
    const income_number = req.body.income_number || `INC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const data = { ...req.body, income_number, tenant: req.tenant._id }
    if (data.client_id && !data.client) data.client = data.client_id
    delete data.client_id
    if (data.property_id && !data.property) data.property = data.property_id
    delete data.property_id
    if (!data.received_by) data.received_by = req.user._id

    const income = await Income.create(data)
    const populated = await Income.findById(income._id)
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id location')
      .populate('invoice', 'invoice_number')
      .populate('payment', 'payment_number')
      .populate('received_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_income',
      resource: 'Income',
      resource_id: income._id,
      description: `Income ${income.income_number} of ${income.amount} recorded`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getIncomes = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.category) filter.category = req.query.category
    if (req.query.client) filter.client = req.query.client
    if (req.query.payment_mode) filter.payment_mode = req.query.payment_mode
    if (req.query.from_date || req.query.to_date) {
      filter.date = {}
      if (req.query.from_date) filter.date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.date.$lte = new Date(req.query.to_date)
    }
    if (req.query.search) {
      filter.$or = [
        { income_number: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const incomes = await Income.find(filter)
      .populate('client', 'client_id full_name')
      .populate('property', 'property_id location')
      .populate('invoice', 'invoice_number')
      .populate('payment', 'payment_number')
      .populate('received_by', 'full_name')
      .sort({ date: -1 })

    res.json(incomes)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getIncomeById = async (req, res) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('client', 'client_id full_name mobile')
      .populate('property', 'property_id location')
      .populate('invoice', 'invoice_number')
      .populate('payment', 'payment_number')
      .populate('received_by', 'full_name')
    if (!income) return res.status(404).json({ message: 'Income not found' })
    res.json(income)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateIncome = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.income_number
    delete data.is_deleted
    if (data.client_id && !data.client) data.client = data.client_id
    delete data.client_id
    if (data.property_id && !data.property) data.property = data.property_id
    delete data.property_id

    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('client', 'client_id full_name')
      .populate('received_by', 'full_name')
    if (!income) return res.status(404).json({ message: 'Income not found' })

    res.json(income)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteIncome = async (req, res) => {
  try {
    const income = await Income.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!income) return res.status(404).json({ message: 'Income not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_income',
      resource: 'Income',
      resource_id: income._id,
      description: `Income ${income.income_number} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Income deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getMonthlyReport = async (req, res) => {
  try {
    const { year } = req.query
    const queryYear = parseInt(year) || new Date().getFullYear()

    const report = await Income.aggregate([
      {
        $match: {
          tenant: req.tenant._id,
          is_deleted: false,
          date: {
            $gte: new Date(queryYear, 0, 1),
            $lte: new Date(queryYear, 11, 31, 23, 59, 59, 999),
          },
        },
      },
      {
        $group: {
          _id: { $month: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const months = Array.from({ length: 12 }, (_, i) => {
      const monthData = report.find((r) => r._id === i + 1)
      return {
        month: i + 1,
        month_name: new Date(queryYear, i).toLocaleString('default', { month: 'long' }),
        total: monthData?.total || 0,
        count: monthData?.count || 0,
      }
    })

    res.json({ year: queryYear, months, grand_total: months.reduce((s, m) => s + m.total, 0) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getIncomeGrouped = async (req, res) => {
  try {
    const match = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.from_date || req.query.to_date) {
      match.date = {}
      if (req.query.from_date) match.date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) match.date.$lte = new Date(req.query.to_date)
    }

    const incomes = await Income.find(match)
      .populate('client', 'full_name')
      .populate('property', 'title location')
      .sort({ date: -1 })

    const groups = {
      interior: { categories: ['interior_services'], label: 'Interior Services', incomes: [], total: 0 },
      rent: { categories: ['rent'], label: 'Rental Income', incomes: [], total: 0 },
      sale: { categories: ['sale', 'brokerage', 'property_sale', 'commission'], label: 'Property Sale / Brokerage', incomes: [], total: 0 },
      other: { categories: ['service', 'consultation', 'interest', 'other'], label: 'Other Income', incomes: [], total: 0 },
    }

    for (const income of incomes) {
      for (const [, group] of Object.entries(groups)) {
        if (group.categories.includes(income.category)) {
          group.incomes.push(income)
          group.total += income.amount || 0
          break
        }
      }
    }

    const expenseAgg = await Expense.aggregate([
      { $match: { tenant: req.tenant._id, is_deleted: false, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const totalExpenses = expenseAgg[0]?.total || 0

    const purchaseAgg = await PurchaseOrder.aggregate([
      { $match: { status: { $in: ['received', 'partial'] } } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } },
    ])
    const totalPurchases = purchaseAgg[0]?.total || 0

    const totalIncome = Object.values(groups).reduce((s, g) => s + g.total, 0)

    const result = {}
    for (const [key, group] of Object.entries(groups)) {
      const share = totalIncome > 0 ? group.total / totalIncome : 0
      const allocExpenses = Math.round(totalExpenses * share)
      const allocPurchases = Math.round(totalPurchases * share)
      result[key] = {
        label: group.label,
        total_income: Math.round(group.total),
        allocated_expenses: allocExpenses,
        allocated_purchases: allocPurchases,
        net_income: Math.round(group.total) - allocExpenses - allocPurchases,
        count: group.incomes.length,
        incomes: group.incomes,
      }
    }

    res.json({
      groups: result,
      totals: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_purchases: totalPurchases,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getYearlyReport = async (req, res) => {
  try {
    const report = await Income.aggregate([
      {
        $match: { tenant: req.tenant._id, is_deleted: false },
      },
      {
        $group: {
          _id: { $year: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ])

    const byCategory = await Income.aggregate([
      {
        $match: { tenant: req.tenant._id, is_deleted: false },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ])

    res.json({ yearly: report, by_category: byCategory })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
