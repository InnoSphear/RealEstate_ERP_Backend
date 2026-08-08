import Expense from '../models/Expense.js'
import ActivityLog from '../models/ActivityLog.js'

export const createExpense = async (req, res) => {
  try {
    const expense_number = req.body.expense_number || `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const data = { ...req.body, expense_number, tenant: req.tenant._id }
    if (!data.paid_by) data.paid_by = req.user._id

    const expense = await Expense.create(data)
    const populated = await Expense.findById(expense._id)
      .populate('paid_by', 'full_name')
      .populate('approved_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'create_expense',
      resource: 'Expense',
      resource_id: expense._id,
      description: `Expense ${expense.expense_number} of ${expense.amount} recorded`,
      type: 'crud',
      severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getExpenses = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.category) filter.category = req.query.category
    if (req.query.payment_mode) filter.payment_mode = req.query.payment_mode
    if (req.query.paid_by) filter.paid_by = req.query.paid_by
    if (req.query.approved_by) filter.approved_by = req.query.approved_by
    if (req.query.from_date || req.query.to_date || req.query.date_from || req.query.date_to) {
      filter.date = {}
      const fromDate = req.query.from_date || req.query.date_from
      const toDate = req.query.to_date || req.query.date_to
      if (fromDate) filter.date.$gte = new Date(fromDate)
      if (toDate) filter.date.$lte = new Date(toDate)
    }
    if (req.query.search) {
      filter.$or = [
        { expense_number: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { vendor: { $regex: req.query.search, $options: 'i' } },
        { category: { $regex: req.query.search, $options: 'i' } },
        { payment_mode: { $regex: req.query.search, $options: 'i' } },
        { reference: { $regex: req.query.search, $options: 'i' } },
      ]
    }

    const expenses = await Expense.find(filter)
      .populate('paid_by', 'full_name')
      .populate('approved_by', 'full_name')
      .sort({ date: -1 })

    res.json(expenses)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, tenant: req.tenant._id, is_deleted: false })
      .populate('paid_by', 'full_name')
      .populate('approved_by', 'full_name')
    if (!expense) return res.status(404).json({ message: 'Expense not found' })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateExpense = async (req, res) => {
  try {
    const data = { ...req.body }
    delete data.tenant
    delete data.expense_number
    delete data.is_deleted

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, is_deleted: false },
      data,
      { new: true, runValidators: true }
    )
      .populate('paid_by', 'full_name')
      .populate('approved_by', 'full_name')
    if (!expense) return res.status(404).json({ message: 'Expense not found' })

    res.json(expense)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!expense) return res.status(404).json({ message: 'Expense not found' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'delete_expense',
      resource: 'Expense',
      resource_id: expense._id,
      description: `Expense ${expense.expense_number} deleted`,
      type: 'crud',
      severity: 'warning',
    })

    res.json({ message: 'Expense deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const approveExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: 'pending' },
      { status: 'approved', approved_by: req.user._id, approved_at: new Date() },
      { new: true }
    ).populate('paid_by', 'full_name').populate('approved_by', 'full_name')
    if (!expense) return res.status(404).json({ message: 'Expense not found or already processed' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'approve_expense',
      resource: 'Expense',
      resource_id: expense._id,
      description: `Expense ${expense.expense_number} approved`,
      type: 'crud',
      severity: 'info',
    })

    res.json(expense)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const rejectExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenant._id, status: 'pending' },
      { status: 'rejected', approved_by: req.user._id, approved_at: new Date() },
      { new: true }
    ).populate('paid_by', 'full_name').populate('approved_by', 'full_name')
    if (!expense) return res.status(404).json({ message: 'Expense not found or already processed' })

    await ActivityLog.create({
      tenant: req.tenant._id,
      user: req.user._id,
      action: 'reject_expense',
      resource: 'Expense',
      resource_id: expense._id,
      description: `Expense ${expense.expense_number} rejected`,
      type: 'crud',
      severity: 'info',
    })

    res.json(expense)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getMonthlyReport = async (req, res) => {
  try {
    const { year } = req.query
    const queryYear = parseInt(year) || new Date().getFullYear()

    const report = await Expense.aggregate([
      {
        $match: {
          tenant: req.tenant._id,
          is_deleted: false,
          status: 'approved',
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

export const getYearlyReport = async (req, res) => {
  try {
    const report = await Expense.aggregate([
      {
        $match: { tenant: req.tenant._id, is_deleted: false, status: 'approved' },
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

    const byCategory = await Expense.aggregate([
      {
        $match: { tenant: req.tenant._id, is_deleted: false, status: 'approved' },
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
