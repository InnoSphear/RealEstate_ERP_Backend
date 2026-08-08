import Lead from '../models/Lead.js'
import Client from '../models/Client.js'
import Property from '../models/Property.js'
import Project from '../models/Project.js'
import Invoice from '../models/Invoice.js'
import Payment from '../models/Payment.js'
import Expense from '../models/Expense.js'
import Income from '../models/Income.js'
import Commission from '../models/Commission.js'
import Employee from '../models/Employee.js'
import FollowUp from '../models/FollowUp.js'
import ActivityLog from '../models/ActivityLog.js'
import Attendance from '../models/Attendance.js'
import InteriorProject from '../models/InteriorProject.js'

const NON_PROFIT_REASONS = ['security_deposit', 'police_verification', 'rent_agreement_cost', 'advance_rent', 'welcome_charge']

export const getStats = async (req, res) => {
  try {
    const tenantId = req.tenant._id
    const userId = req.user._id
    const roleSlug = req.user.role_slug
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const isAdminOrManager = ['admin', 'manager'].includes(roleSlug)

    if (isAdminOrManager) {
      return getAdminStats(req, res, tenantId, today, tomorrow)
    } else {
      return getEmployeeStats(req, res, tenantId, userId, today, tomorrow)
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getAdminStats(req, res, tenantId, today, tomorrow) {
  const [
    totalLeads, hotLeads, warmLeads, coldLeads,
    totalClients, totalProperties, totalProjects,
    totalCommissions,
    pendingPayments, pendingCommissions,
    todayFollowUps, recentActivities, employeePerformance,
    interiorTotalRevenue, interiorTotalExpenses,
    interiorProfits,
    brokerageFromPropertyDeals,
    standaloneBrokeragePayments,
  ] = await Promise.all([
    Lead.countDocuments({ tenant: tenantId, is_deleted: false }),
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, status: 'hot' }),
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, status: 'warm' }),
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, status: 'cold' }),
    Client.countDocuments({ tenant: tenantId, is_deleted: false }),
    Property.countDocuments({ tenant: tenantId, is_deleted: false }),
    Project.countDocuments({ tenant: tenantId, is_deleted: false }),
    Commission.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, status: { $in: ['approved', 'paid'] } } },
      { $group: { _id: null, total: { $sum: '$commission_amount' } } },
    ]),
    Payment.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Commission.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$commission_amount' }, count: { $sum: 1 } } },
    ]),
    FollowUp.find({
      tenant: tenantId,
      status: 'pending',
      is_deleted: false,
      follow_up_date: { $gte: today, $lt: tomorrow },
    })
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name')
      .sort({ follow_up_date: 1 })
      .limit(10),
    ActivityLog.find({ tenant: tenantId })
      .populate('user', 'full_name')
      .sort({ createdAt: -1 })
      .limit(10),
    Employee.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, is_active: true } },
      { $lookup: {
        from: 'commissions',
        let: { empId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$employee', '$$empId'] }, is_deleted: false } },
          { $group: { _id: null, total: { $sum: '$commission_amount' } } },
        ],
        as: 'commissions',
      } },
      { $addFields: { total_commission: { $ifNull: [{ $arrayElemAt: ['$commissions.total', 0] }, 0] } } },
      { $sort: { total_commission: -1 } },
      { $limit: 10 },
      { $project: { employee_id: 1, full_name: 1, department: 1, total_commission: 1 } },
    ]),
    InteriorProject.aggregate([
      { $match: { tenant: tenantId, is_deleted: false } },
      { $group: { _id: null, total: { $sum: '$received_amount' } } },
    ]),
    InteriorProject.aggregate([
      { $match: { tenant: tenantId, is_deleted: false } },
      {
        $project: {
          totalExpenses: {
            $add: [
              { $reduce: { input: { $ifNull: ['$direct_expenses', []] }, initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] } } },
              { $ifNull: ['$material_cost', 0] },
              { $ifNull: ['$other_cost', 0] },
            ]
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalExpenses' } } },
    ]),
    InteriorProject.aggregate([
      { $match: { tenant: tenantId, is_deleted: false } },
      {
        $project: {
          interiorProfit: {
            $subtract: [
              { $ifNull: ['$contract_amount', 0] },
              {
                $add: [
                  { $ifNull: ['$material_cost', 0] },
                  { $ifNull: ['$other_cost', 0] },
                  {
                    $reduce: {
                      input: { $ifNull: ['$direct_expenses', []] },
                      initialValue: 0,
                      in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
                    }
                  }
                ]
              }
            ]
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$interiorProfit' } } },
    ]),
    Payment.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, brokerage: { $gt: 0 }, $or: [{ reason: { $nin: ['Brokerage'] } }, { payment_reason: { $nin: ['Brokerage'] } }] } },
      { $group: { _id: null, total: { $sum: '$brokerage' } } },
    ]),
    Payment.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, $or: [{ reason: 'Brokerage' }, { payment_reason: 'Brokerage' }] } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ])

  const totalCommissionsVal = totalCommissions[0]?.total || 0
  const intRevenueVal = interiorTotalRevenue[0]?.total || 0
  const intExpensesVal = interiorTotalExpenses[0]?.total || 0
  const interiorProfitVal = interiorProfits[0]?.total || 0
  const brokerageFromDealsVal = brokerageFromPropertyDeals[0]?.total || 0
  const standaloneBrokerageVal = standaloneBrokeragePayments[0]?.total || 0
  const brokerageProfit = brokerageFromDealsVal + standaloneBrokerageVal
  const realProfit = brokerageProfit + interiorProfitVal

  res.json({
    role: 'admin',
    leads: { total: totalLeads, hot: hotLeads, warm: warmLeads, cold: coldLeads },
    totalClients,
    totalProperties,
    totalProjects,
    revenue: intRevenueVal + brokerageProfit,
    expenses: intExpensesVal,
    profit: realProfit,
    brokerageProfit,
    brokerageFromDeals: brokerageFromDealsVal,
    standaloneBrokerage: standaloneBrokerageVal,
    interiorRevenue: intRevenueVal,
    interiorExpenses: intExpensesVal,
    interiorProfit: interiorProfitVal,
    commissions: totalCommissionsVal,
    realProfit,
    pendingPayments: { total: pendingPayments[0]?.total || 0, count: pendingPayments[0]?.count || 0 },
    pendingCommissions: { total: pendingCommissions[0]?.total || 0, count: pendingCommissions[0]?.count || 0 },
    todayFollowUps,
    recentActivities,
    topEmployees: employeePerformance,
  })
}

async function getEmployeeStats(req, res, tenantId, userId, today, tomorrow) {
  const employee = await Employee.findOne({ tenant: tenantId, user: userId })

  const [
    assignedLeads,
    hotLeads,
    warmLeads,
    coldLeads,
    todayAttendance,
    pendingLeaves,
    approvedLeaves,
    todayFollowUps,
    recentActivities,
    totalCommissions,
    totalPaidCommissions,
  ] = await Promise.all([
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, $or: [{ assigned_to: userId }, { created_by: userId }] }),
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, $or: [{ assigned_to: userId }, { created_by: userId }], status: 'hot' }),
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, $or: [{ assigned_to: userId }, { created_by: userId }], status: 'warm' }),
    Lead.countDocuments({ tenant: tenantId, is_deleted: false, $or: [{ assigned_to: userId }, { created_by: userId }], status: 'cold' }),
    employee ? Attendance.findOne({ tenant: tenantId, employee: employee._id, date: { $gte: today, $lt: tomorrow } }) : null,
    employee ? (await import('../models/Leave.js')).default.countDocuments({ tenant: tenantId, employee: employee._id, status: 'pending' }) : 0,
    employee ? (await import('../models/Leave.js')).default.countDocuments({ tenant: tenantId, employee: employee._id, status: 'approved' }) : 0,
    FollowUp.find({
      tenant: tenantId,
      $or: [{ assigned_to: userId }, { assigned_by: userId }],
      status: 'pending',
      is_deleted: false,
      follow_up_date: { $gte: today, $lt: tomorrow },
    })
      .populate('lead', 'full_name mobile')
      .populate('client', 'client_id full_name mobile')
      .populate('assigned_to', 'full_name')
      .sort({ follow_up_date: 1 })
      .limit(10),
    ActivityLog.find({ tenant: tenantId, user: userId })
      .populate('user', 'full_name')
      .sort({ createdAt: -1 })
      .limit(10),
    Commission.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, status: { $in: ['pending', 'approved'] }, $or: [{ user: userId }, { employee: employee?._id }].filter(Boolean) } },
      { $group: { _id: null, total: { $sum: '$commission_amount' } } },
    ]),
    Commission.aggregate([
      { $match: { tenant: tenantId, is_deleted: false, status: 'paid', $or: [{ user: userId }, { employee: employee?._id }].filter(Boolean) } },
      { $group: { _id: null, total: { $sum: '$commission_amount' } } },
    ]),
  ])

  res.json({
    role: 'employee',
    leads: {
      total: assignedLeads,
      hot: hotLeads,
      warm: warmLeads,
      cold: coldLeads,
    },
    todayAttendance: todayAttendance || null,
    pendingLeaves,
    approvedLeaves,
    todayFollowUps,
    recentActivities,
    commission: totalCommissions[0]?.total || 0,
    commission_paid: totalPaidCommissions[0]?.total || 0,
    employee: employee || null,
  })
}