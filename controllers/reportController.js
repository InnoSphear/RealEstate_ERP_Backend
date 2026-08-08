import Lead from '../models/Lead.js'
import Employee from '../models/Employee.js'
import Invoice from '../models/Invoice.js'
import Income from '../models/Income.js'
import Expense from '../models/Expense.js'
import Property from '../models/Property.js'
import Commission from '../models/Commission.js'
import Payment from '../models/Payment.js'
import Attendance from '../models/Attendance.js'
import RentalApartment from '../models/RentalApartment.js'
import InteriorProject from '../models/InteriorProject.js'
import Material from '../models/Material.js'
import MaterialInventory from '../models/MaterialInventory.js'
import PurchaseOrder from '../models/PurchaseOrder.js'
import PurchaseOrderItem from '../models/PurchaseOrderItem.js'
import User from '../models/User.js'
import ReportHistory from '../models/ReportHistory.js'

const getExportFormat = (req) => req.query.format || 'json'

const exportJson = (res, data, filename) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`)
  res.json(data)
}

const exportCsv = (res, data, filename, headers) => {
  const csvRows = []
  csvRows.push(headers.join(','))
  for (const row of data) {
    csvRows.push(headers.map((h) => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','))
  }
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
  res.send(csvRows.join('\n'))
}

const exportExcel = async (res, data, filename, headers, sheetName) => {
  try {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(sheetName || 'Sheet1')
    sheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }))
    data.forEach((row) => sheet.addRow(row))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const exportPdf = async (res, data, filename, title, columns, tenant) => {
  try {
    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ margin: 50 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`)
    doc.pipe(res)

    const company = tenant || {}
    doc.fontSize(18).text(company.company_name || 'Shivam International', { align: 'center' })
    doc.fontSize(9).text('Real Estate & Interior Solutions', { align: 'center' })
    doc.fontSize(8).text(company.company_address || 'F-2 G001, Amrapali Terrace Homes, Techzone-4, Greater Noida West, Gautam Buddha Nagar, Uttar Pradesh – 201308, India', { align: 'center' })
    doc.fontSize(8).text(company.company_phone || '+91 98991 46931 | 9891075835', { align: 'center' })
    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke()
    doc.moveDown()

    doc.fontSize(18).text(title, { align: 'center' })
    doc.moveDown()

    if (data.length > 0 && columns) {
      const tableTop = doc.y
      doc.fontSize(10)
      const colWidth = (doc.page.width - 100) / columns.length
      columns.forEach((col, i) => {
        doc.text(col, 50 + i * colWidth, tableTop, { width: colWidth, bold: true })
      })
      doc.moveDown(0.5)
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke()
      doc.moveDown(0.5)

      data.forEach((row) => {
        if (doc.y > doc.page.height - 100) doc.addPage()
        columns.forEach((col, i) => {
          doc.text(String(row[col] ?? ''), 50 + i * colWidth, doc.y, { width: colWidth })
        })
        doc.moveDown(0.3)
      })
    } else {
      doc.fontSize(12).text(JSON.stringify(data, null, 2))
    }

    doc.end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

const handleExport = async (req, res, data, filename, title, columnMap) => {
  const format = getExportFormat(req)
  switch (format) {
    case 'csv':
      return exportCsv(res, data, filename, Object.keys(columnMap))
    case 'excel':
      return exportExcel(res, data, filename, Object.keys(columnMap), title)
    case 'pdf':
      return exportPdf(res, data, filename, title, Object.keys(columnMap), req.tenant)
    default:
      return exportJson(res, data, filename)
  }
}

export const generateLeadReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.source) filter.source = req.query.source
    if (req.query.assigned_to) filter.assigned_to = req.query.assigned_to
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }

    const leads = await Lead.find(filter)
      .populate('assigned_to', 'full_name')
      .populate('converted_client', 'client_id full_name')
      .sort({ createdAt: -1 })

    const reportData = leads.map((l) => ({
      full_name: l.full_name,
      email: l.email || '',
      mobile: l.mobile,
      source: l.source,
      status: l.status,
      lead_score: l.lead_score,
      assigned_to: l.assigned_to?.full_name || '',
      converted: l.converted_to_client ? 'Yes' : 'No',
      created_at: l.createdAt.toISOString(),
    }))

    const summary = {
      total: leads.length,
      by_status: await Lead.aggregate([
        { $match: { tenant: req.tenant._id, is_deleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      by_source: await Lead.aggregate([
        { $match: { tenant: req.tenant._id, is_deleted: false } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
    }

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'lead-report', 'Lead Report', {
        full_name: 'Name', email: 'Email', mobile: 'Mobile',
        source: 'Source', status: 'Status', lead_score: 'Score', assigned_to: 'Assigned To',
        converted: 'Converted', created_at: 'Created',
      })
    }

    res.json({ summary, data: reportData })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateEmployeeReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.department) filter.department = req.query.department
    if (req.query.employee_type) filter.employee_type = req.query.employee_type

    const employees = await Employee.find(filter).sort({ createdAt: -1 })

    const reportData = employees.map((e) => ({
      employee_id: e.employee_id,
      full_name: e.full_name,
      email: e.email,
      mobile: e.mobile,
      department: e.department,
      designation: e.designation || '',
      employee_type: e.employee_type,
      joining_date: e.joining_date.toISOString(),
      salary: e.salary,
      is_active: e.is_active ? 'Yes' : 'No',
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'employee-report', 'Employee Report', {
        employee_id: 'Employee ID', full_name: 'Name', email: 'Email', mobile: 'Mobile',
        department: 'Department', designation: 'Designation', employee_type: 'Type',
        joining_date: 'Joining Date', salary: 'Salary', is_active: 'Active',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateSalesReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.client) filter.client = req.query.client
    if (req.query.from_date || req.query.to_date) {
      filter.issue_date = {}
      if (req.query.from_date) filter.issue_date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.issue_date.$lte = new Date(req.query.to_date)
    }

    const invoices = await Invoice.find(filter)
      .populate('client', 'client_id full_name')
      .sort({ issue_date: -1 })

    const reportData = invoices.map((inv) => ({
      invoice_number: inv.invoice_number,
      client: inv.client?.full_name || '',
      invoice_type: inv.invoice_type,
      issue_date: inv.issue_date.toISOString(),
      due_date: inv.due_date.toISOString(),
      subtotal: inv.subtotal,
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount,
      due_amount: inv.due_amount,
      status: inv.status,
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'sales-report', 'Sales Report', {
        invoice_number: 'Invoice #', client: 'Client', invoice_type: 'Type',
        issue_date: 'Issue Date', due_date: 'Due Date', subtotal: 'Subtotal',
        total_amount: 'Total', paid_amount: 'Paid', due_amount: 'Due', status: 'Status',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateRevenueReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.from_date || req.query.to_date) {
      filter.date = {}
      if (req.query.from_date) filter.date.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.date.$lte = new Date(req.query.to_date)
    }

    const [incomes, expenses] = await Promise.all([
      Income.find(filter).populate('client', 'client_id full_name').sort({ date: -1 }),
      Expense.find({ ...filter, status: 'approved' }).populate('paid_by', 'full_name').sort({ date: -1 }),
    ])

    const incomeData = incomes.map((i) => ({
      income_number: i.income_number,
      category: i.category,
      amount: i.amount,
      date: i.date.toISOString(),
      client: i.client?.full_name || '',
      payment_mode: i.payment_mode || '',
    }))

    const expenseData = expenses.map((e) => ({
      expense_number: e.expense_number,
      category: e.category,
      amount: e.amount,
      date: e.date.toISOString(),
      vendor: e.vendor || '',
      payment_mode: e.payment_mode || '',
    }))

    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalIncome - totalExpenses

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, [
        ...incomeData.map((d) => ({ ...d, type: 'Income' })),
        ...expenseData.map((d) => ({ ...d, type: 'Expense' })),
      ], 'revenue-report', 'Revenue Report', {
        type: 'Type', income_number: 'Number', category: 'Category', amount: 'Amount',
        date: 'Date', client: 'Client/Vendor', payment_mode: 'Payment Mode',
      })
    }

    res.json({
      summary: { total_income: totalIncome, total_expenses: totalExpenses, net_profit: netProfit },
      income: incomeData,
      expenses: expenseData,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generatePropertyReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.property_type) filter.property_type = req.query.property_type
    if (req.query.status) filter.status = req.query.status
    if (req.query.availability) filter.availability = req.query.availability
    if (req.query.listing_type) filter.listing_type = req.query.listing_type

    const properties = await Property.find(filter)
      .populate('assigned_to', 'full_name')
      .sort({ createdAt: -1 })

    const reportData = properties.map((p) => ({
      property_id: p.property_id,
      owner_name: p.owner_name,
      property_type: p.property_type,
      location: p.location,
      city: p.city || '',
      listing_type: p.listing_type,
      price_sale: p.price_sale,
      rent_amount: p.rent_amount,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      availability: p.availability,
      status: p.status,
      featured: p.featured ? 'Yes' : 'No',
      assigned_to: p.assigned_to?.full_name || '',
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'property-report', 'Property Report', {
        property_id: 'Property ID', owner_name: 'Owner', property_type: 'Type',
        location: 'Location', city: 'City', listing_type: 'Listing Type',
        price_sale: 'Sale Price', rent_amount: 'Rent', bedrooms: 'Beds',
        bathrooms: 'Baths', availability: 'Availability', status: 'Status',
        featured: 'Featured', assigned_to: 'Assigned To',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateCommissionReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.employee) filter.employee = req.query.employee
    if (req.query.source) filter.source = req.query.source
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }

    const commissions = await Commission.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('user', 'full_name')
      .populate('client', 'client_id full_name')
      .populate('invoice', 'invoice_number')
      .sort({ createdAt: -1 })

    const reportData = commissions.map((c) => ({
      employee: c.employee?.full_name || '',
      employee_id: c.employee?.employee_id || '',
      department: c.employee?.department || '',
      commission_type: c.commission_type,
      commission_amount: c.commission_amount,
      source: c.source,
      amount_basis: c.amount_basis || 0,
      percentage_rate: c.percentage_rate || 0,
      client: c.client?.full_name || '',
      invoice: c.invoice?.invoice_number || '',
      status: c.status,
      created_at: c.createdAt.toISOString(),
    }))

    const summary = await Commission.aggregate([
      { $match: { tenant: req.tenant._id, is_deleted: false } },
      { $group: {
        _id: '$status',
        total: { $sum: '$commission_amount' },
        count: { $sum: 1 },
      } },
    ])

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'commission-report', 'Commission Report', {
        employee: 'Employee', employee_id: 'Employee ID', department: 'Department',
        commission_type: 'Type', commission_amount: 'Amount', source: 'Source',
        amount_basis: 'Basis Amount', percentage_rate: 'Rate %',
        client: 'Client', invoice: 'Invoice', status: 'Status', created_at: 'Created',
      })
    }

    res.json({ summary, data: reportData })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateAttendanceReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id }
    if (req.query.from_date || req.query.to_date) {
      filter.date = {}
      if (req.query.from_date) filter.date.$gte = new Date(`${req.query.from_date}T00:00:00.000Z`)
      if (req.query.to_date) filter.date.$lte = new Date(`${req.query.to_date}T23:59:59.999Z`)
    }
    if (req.query.status) filter.status = req.query.status
    if (req.query.approval_status) filter.approval_status = req.query.approval_status
    if (req.query.employee) filter.employee = req.query.employee

    const records = await Attendance.find(filter)
      .populate('employee', 'employee_id full_name department')
      .populate('approved_by', 'full_name')
      .sort({ date: -1 })

    const reportData = records.map((a) => ({
      employee: a.employee?.full_name || '',
      employee_id: a.employee?.employee_id || '',
      department: a.employee?.department || '',
      date: a.date.toISOString().split('T')[0],
      check_in: a.check_in ? a.check_in.toISOString().slice(11, 16) : '',
      check_out: a.check_out ? a.check_out.toISOString().slice(11, 16) : '',
      status: a.status,
      approval_status: a.approval_status,
      working_hours: a.working_hours,
      overtime_hours: a.overtime_hours,
      approved_by: a.approved_by?.full_name || '',
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'attendance-report', 'Attendance Report', {
        employee: 'Employee', employee_id: 'Employee ID', department: 'Department',
        date: 'Date', check_in: 'Check In', check_out: 'Check Out', status: 'Status',
        approval_status: 'Approval', working_hours: 'Hours', overtime_hours: 'Overtime',
        approved_by: 'Approved By',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateRentReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.status) filter.status = req.query.status
    if (req.query.furnishing) filter.furnishing = req.query.furnishing
    if (req.query.property) filter.property = req.query.property

    const rentals = await RentalApartment.find(filter)
      .populate('property', 'property_id title')
      .sort({ createdAt: -1 })

    const reportData = rentals.map((r) => ({
      unit_number: r.unit_number,
      building_name: r.building_name || '',
      property: r.property?.title || r.property?.property_id || '',
      floor: r.floor || '',
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      area_sqft: r.area_sqft || '',
      rent_amount: r.rent_amount,
      security_deposit: r.security_deposit,
      maintenance_charge: r.maintenance_charge,
      furnishing: r.furnishing,
      status: r.status,
      owner_name: r.owner.name,
      owner_contact: r.owner.contact,
      tenant_name: r.tenant_info?.name || '',
      tenant_contact: r.tenant_info?.contact || '',
      rental_start: r.rental_start_date ? r.rental_start_date.toISOString().split('T')[0] : '',
      rental_end: r.rental_end_date ? r.rental_end_date.toISOString().split('T')[0] : '',
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'rent-report', 'Rent Report', {
        unit_number: 'Unit', building_name: 'Building', property: 'Property',
        floor: 'Floor', bedrooms: 'Beds', bathrooms: 'Baths', area_sqft: 'Area (sqft)',
        rent_amount: 'Rent', security_deposit: 'Deposit', maintenance_charge: 'Maintenance',
        furnishing: 'Furnishing', status: 'Status', owner_name: 'Owner',
        owner_contact: 'Owner Contact', tenant_name: 'Tenant', tenant_contact: 'Tenant Contact',
        rental_start: 'Start Date', rental_end: 'End Date',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateInteriorProjectReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id }
    if (req.query.status) filter.status = req.query.status
    if (req.query.project_type) filter.project_type = req.query.project_type
    if (req.query.branch) filter.branch_id = req.query.branch

    const projects = await InteriorProject.find(filter)
      .populate('client_id', 'full_name company')
      .populate('assigned_to', 'full_name')
      .populate('branch_id', 'name')
      .sort({ createdAt: -1 })

    const reportData = projects.map((p) => ({
      project_code: p.project_code || '',
      title: p.title,
      client: p.client_id?.full_name || '',
      assigned_to: p.assigned_to?.full_name || '',
      branch: p.branch_id?.name || '',
      status: p.status,
      project_type: p.project_type || '',
      total_area_sqft: p.total_area_sqft || '',
      estimated_budget: p.estimated_budget || 0,
      approved_budget: p.approved_budget || 0,
      start_date: p.start_date ? p.start_date.toISOString().split('T')[0] : '',
      expected_end_date: p.expected_end_date ? p.expected_end_date.toISOString().split('T')[0] : '',
      actual_end_date: p.actual_end_date ? p.actual_end_date.toISOString().split('T')[0] : '',
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'interior-projects-report', 'Interior Projects Report', {
        project_code: 'Code', title: 'Title', client: 'Client', assigned_to: 'Assigned To',
        branch: 'Branch', status: 'Status', project_type: 'Type', total_area_sqft: 'Area (sqft)',
        estimated_budget: 'Est. Budget', approved_budget: 'Approved Budget',
        start_date: 'Start', expected_end_date: 'Expected End', actual_end_date: 'Actual End',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateLeadConversionReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.from_date || req.query.to_date) {
      filter.createdAt = {}
      if (req.query.from_date) filter.createdAt.$gte = new Date(req.query.from_date)
      if (req.query.to_date) filter.createdAt.$lte = new Date(req.query.to_date)
    }

    const leads = await Lead.find(filter)
      .populate('assigned_to', 'full_name')
      .populate('converted_client', 'client_id full_name')
      .sort({ createdAt: -1 })

    const totalLeads = leads.length
    const converted = leads.filter((l) => l.converted_to_client)
    const conversionRate = totalLeads > 0 ? ((converted.length / totalLeads) * 100).toFixed(1) : 0

    const reportData = leads.map((l) => ({
      full_name: l.full_name,
      source: l.source,
      status: l.status,
      lead_score: l.lead_score,
      assigned_to: l.assigned_to?.full_name || '',
      converted: l.converted_to_client ? 'Yes' : 'No',
      converted_client: l.converted_client?.full_name || '',
      conversion_date: l.converted_at ? new Date(l.converted_at).toISOString().split('T')[0] : '',
      created_at: l.createdAt.toISOString().split('T')[0],
    }))

    const summary = {
      total_leads: totalLeads,
      converted: converted.length,
      conversion_rate: `${conversionRate}%`,
      by_source: await Lead.aggregate([
        { $match: { tenant: req.tenant._id, is_deleted: false } },
        { $group: { _id: '$source', total: { $sum: 1 }, converted: { $sum: { $cond: ['$converted_to_client', 1, 0] } } } },
      ]),
    }

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'lead-conversion-report', 'Lead Conversion Report', {
        full_name: 'Name', source: 'Source', status: 'Status',
        lead_score: 'Score', assigned_to: 'Assigned To', converted: 'Converted',
        converted_client: 'Client', conversion_date: 'Conversion Date', created_at: 'Created',
      })
    }

    res.json({ summary, data: reportData })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateEmployeePerformanceReport = async (req, res) => {
  try {
    const filter = { tenant: req.tenant._id, is_deleted: false, is_active: true }
    if (req.query.department) filter.department = req.query.department

    const employees = await Employee.find(filter).sort({ full_name: 1 })

    const reportData = await Promise.all(employees.map(async (e) => {
      const leadCount = await Lead.countDocuments({ tenant: req.tenant._id, assigned_to: e.user, is_deleted: false })
      const convCount = await Lead.countDocuments({ tenant: req.tenant._id, assigned_to: e.user, converted_to_client: true, is_deleted: false })
      const commissionAgg = await Commission.aggregate([
        { $match: { tenant: req.tenant._id, employee: e._id, is_deleted: false, status: { $in: ['approved', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$commission_amount' } } },
      ])
      const attendanceCount = await Attendance.countDocuments({ tenant: req.tenant._id, employee: e._id, status: 'present' })

      return {
        employee_id: e.employee_id,
        full_name: e.full_name,
        department: e.department,
        designation: e.designation || '',
        leads_assigned: leadCount,
        leads_converted: convCount,
        conversion_rate: leadCount > 0 ? ((convCount / leadCount) * 100).toFixed(1) : '0.0',
        total_commission: commissionAgg[0]?.total || 0,
        days_present: attendanceCount,
      }
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'employee-performance-report', 'Employee Performance Report', {
        employee_id: 'ID', full_name: 'Name', department: 'Department', designation: 'Designation',
        leads_assigned: 'Leads', leads_converted: 'Converted', conversion_rate: 'Conv. Rate %',
        total_commission: 'Commission', days_present: 'Days Present',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateEmployeeWiseReport = async (req, res) => {
  try {
    const employees = await Employee.find({ tenant: req.tenant._id, is_deleted: false }).sort({ full_name: 1 })

    const reportData = await Promise.all(employees.map(async (e) => {
      const leadsAgg = await Lead.aggregate([
        { $match: { tenant: req.tenant._id, assigned_to: e.user, is_deleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      const commissionAgg = await Commission.aggregate([
        { $match: { tenant: req.tenant._id, employee: e._id, is_deleted: false } },
        { $group: { _id: '$status', total: { $sum: '$commission_amount' }, count: { $sum: 1 } } },
      ])

      return {
        employee_id: e.employee_id,
        full_name: e.full_name,
        department: e.department,
        designation: e.designation || '',
        email: e.email,
        mobile: e.mobile,
        joining_date: e.joining_date.toISOString().split('T')[0],
        leads_by_status: leadsAgg,
        commissions_by_status: commissionAgg,
      }
    }))

    if (req.query.format && req.query.format !== 'json') {
      const flat = reportData.map((e) => ({
        employee_id: e.employee_id,
        full_name: e.full_name,
        department: e.department,
        designation: e.designation,
        email: e.email,
        mobile: e.mobile,
        joining_date: e.joining_date,
        total_commission: e.commissions_by_status.reduce((s, c) => s + c.total, 0),
        total_leads: e.leads_by_status.reduce((s, l) => s + l.count, 0),
      }))
      return handleExport(req, res, flat, 'employee-wise-report', 'Employee Wise Report', {
        employee_id: 'ID', full_name: 'Name', department: 'Department', designation: 'Designation',
        email: 'Email', mobile: 'Mobile', joining_date: 'Joined',
        total_leads: 'Total Leads', total_commission: 'Total Commission',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateUserWiseReport = async (req, res) => {
  try {
    const users = await User.find({ tenant: req.tenant._id, is_deleted: false })
      .populate('role', 'name slug')
      .sort({ full_name: 1 })

    const reportData = await Promise.all(users.map(async (u) => {
      const leadCount = await Lead.countDocuments({ tenant: req.tenant._id, assigned_to: u._id, is_deleted: false })
      return {
        full_name: u.full_name,
        email: u.email,
        phone: u.phone || '',
        role: u.role?.name || u.role_slug,
        is_active: u.is_active ? 'Yes' : 'No',
        last_login: u.last_login ? new Date(u.last_login).toISOString().split('T')[0] : '',
        leads_assigned: leadCount,
        created_at: u.createdAt.toISOString().split('T')[0],
      }
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'user-wise-report', 'User Wise Report', {
        full_name: 'Name', email: 'Email', phone: 'Phone', role: 'Role',
        is_active: 'Active', last_login: 'Last Login', leads_assigned: 'Leads',
        created_at: 'Created',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const generateInventoryReport = async (req, res) => {
  try {
    const materials = await Material.find().sort({ name: 1 })

    const reportData = await Promise.all(materials.map(async (m) => {
      const inv = await MaterialInventory.aggregate([
        { $match: { material_id: m._id } },
        { $group: { _id: null, qty_on_hand: { $sum: '$qty_on_hand' }, qty_reserved: { $sum: '$qty_reserved' } } },
      ])
      const poAgg = await PurchaseOrderItem.aggregate([
        { $match: { material_id: m._id } },
        { $lookup: { from: 'purchaseorders', localField: 'po_id', foreignField: '_id', as: 'po' } },
        { $unwind: { path: '$po', preserveNullAndEmptyArrays: true } },
        { $match: { 'po.status': { $nin: ['cancelled'] } } },
        { $group: { _id: null, qty_ordered: { $sum: '$qty_ordered' }, qty_received: { $sum: '$qty_received' } } },
      ])
      const qtyOnHand = inv[0]?.qty_on_hand || 0
      const qtyReserved = inv[0]?.qty_reserved || 0
      const qtyOrdered = poAgg[0]?.qty_ordered || 0
      const qtyReceived = poAgg[0]?.qty_received || 0

      return {
        sku: m.sku || '',
        name: m.name,
        category: m.category || '',
        unit: m.unit || '',
        unit_cost: m.unit_cost || 0,
        qty_on_hand: qtyOnHand,
        qty_reserved: qtyReserved,
        qty_available: qtyOnHand - qtyReserved,
        qty_on_order: qtyOrdered - qtyReceived,
        reorder_level: m.reorder_level || 0,
        supplier: m.supplier_name || '',
      }
    }))

    if (req.query.format && req.query.format !== 'json') {
      return handleExport(req, res, reportData, 'inventory-report', 'Inventory Report', {
        sku: 'SKU', name: 'Material', category: 'Category', unit: 'Unit', unit_cost: 'Unit Cost',
        qty_on_hand: 'On Hand', qty_reserved: 'Reserved', qty_available: 'Available',
        qty_on_order: 'On Order', reorder_level: 'Reorder Level', supplier: 'Supplier',
      })
    }

    res.json(reportData)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getReportHistory = async (req, res) => {
  try {
    const history = await ReportHistory.find({ tenant: req.tenant._id })
      .populate('user', 'full_name')
      .sort({ createdAt: -1 })
      .limit(50)
    res.json(history)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const saveReportHistory = async (req, res) => {
  try {
    const { report_type, format, filters, rows_generated, file_size, error_message } = req.body
    const entry = await ReportHistory.create({
      tenant: req.tenant._id,
      user: req.user._id,
      report_type,
      format: format || 'excel',
      status: error_message ? 'failed' : 'completed',
      filters,
      rows_generated: rows_generated || 0,
      file_size,
      error_message,
    })
    res.status(201).json(entry)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const deleteReportHistory = async (req, res) => {
  try {
    const entry = await ReportHistory.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!entry) return res.status(404).json({ message: 'History entry not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
