import InteriorProject from '../models/InteriorProject.js'
import ProjectBudget from '../models/ProjectBudget.js'
import ProjectMilestone from '../models/ProjectMilestone.js'
import ProjectTeam from '../models/ProjectTeam.js'
import Vendor from '../models/Vendor.js'
import ActivityLog from '../models/ActivityLog.js'
import Income from '../models/Income.js'
import Expense from '../models/Expense.js'
import { uploadToCloudinary } from '../middlewares/upload.js'

const tenantFilter = (req) => ({ tenant: req.tenant._id, is_deleted: false })

const parseMaterials = (body) => {
  if (typeof body.materials === 'string') {
    try { body.materials = JSON.parse(body.materials) } catch (e) { body.materials = [] }
  }
  return body
}

const syncMaterialToVendor = async (material, project, tenantId) => {
  try {
    if (!material.vendor) return
    const vendor = await Vendor.findOne({ _id: material.vendor, tenant: tenantId, is_deleted: false })
    if (!vendor) return

    vendor.purchases.push({
      item_name: material.item_name,
      quantity: 1,
      rate: material.cost,
      amount: material.cost,
      purchase_date: new Date(),
      notes: `Interior Project: ${project.title}`,
    })

    vendor.total_purchased = (vendor.total_purchased || 0) + Number(material.cost)
    vendor.total_due = vendor.total_purchased - (vendor.total_paid || 0)
    vendor.payment_status = vendor.total_due <= 0 ? 'paid' : (vendor.total_paid || 0) > 0 ? 'partial' : 'credit'

    await vendor.save()
  } catch (e) {
    // silent fail
  }
}

export const getDashboard = async (req, res) => {
  try {
    const match = { tenant: req.tenant._id, is_deleted: false }

    const projects = await InteriorProject.find(match)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .sort({ createdAt: -1 })

    let total_contract = 0, total_material = 0, total_other_cost = 0, total_received = 0, total_direct_expenses = 0
    const statusMap = {}

    projects.forEach((p) => {
      total_contract += p.contract_amount || 0
      total_material += p.material_cost || 0
      total_other_cost += p.other_cost || 0
      total_received += p.received_amount || 0
      total_direct_expenses += (p.direct_expenses || []).reduce((s, e) => s + (e.cost || 0), 0)
      const st = p.status || 'not_started'
      statusMap[st] = (statusMap[st] || 0) + 1
    })

    const total_cost = total_material + total_other_cost + total_direct_expenses
    const total_profit_loss = total_contract - total_cost
    const total_balance = total_contract - total_received

    res.json({
      summary: {
        total_contract,
        total_cost,
        total_material,
        total_other_cost,
        total_direct_expenses,
        total_profit_loss,
        total_balance,
        total_received,
        total_projects: projects.length,
      },
      status_counts: statusMap,
      projects,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const createProject = async (req, res) => {
  try {
    parseMaterials(req.body)
    const project = await InteriorProject.create({ ...req.body, tenant: req.tenant._id })

    if (project.materials && project.materials.length) {
      for (const material of project.materials) {
        if (material.vendor) {
          await syncMaterialToVendor(material, project, req.tenant._id)
        }
      }
    }

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'create_interior_project', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Interior project "${project.title}" created`,
      type: 'crud', severity: 'info',
    })
    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const getProjects = async (req, res) => {
  try {
    const filter = { ...tenantFilter(req) }
    if (req.query.status) filter.status = req.query.status
    if (req.query.branch_id) filter.branch_id = req.query.branch_id
    if (req.query.client_id) filter.client_id = req.query.client_id
    const projects = await InteriorProject.find(filter)
      .populate('client_id', 'full_name phone')
      .populate('assigned_to', 'full_name')
      .populate('branch_id', 'name')
      .sort({ createdAt: -1 })
    res.json(projects)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getProjectById = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('client_id', 'full_name phone email')
      .populate('assigned_to', 'full_name email')
      .populate('branch_id', 'name city')
      .populate('materials.vendor', 'name phone')
      .populate('materials.created_by', 'full_name email')
      .populate('vendors.vendor', 'name phone email')
      .populate('labour.employee_id', 'full_name mobile photo')
      .populate('payments.received_by', 'full_name')
    if (!project) return res.status(404).json({ message: 'Project not found' })
    const budgets = await ProjectBudget.find({ project_id: project._id })
    const milestones = await ProjectMilestone.find({ project_id: project._id }).sort({ due_date: 1 })
    const team = await ProjectTeam.find({ project_id: project._id }).populate('user_id', 'full_name')
    res.json({ ...project.toObject(), budgets, milestones, team })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const updateProject = async (req, res) => {
  try {
    parseMaterials(req.body)
    const existing = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!existing) return res.status(404).json({ message: 'Project not found' })

    const oldMaterialIds = new Set((existing.materials || []).map(m => m._id?.toString()).filter(Boolean))

    const project = await InteriorProject.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter(req) },
      req.body,
      { new: true, runValidators: true }
    )

    for (const material of project.materials || []) {
      if (material.vendor && !oldMaterialIds.has(material._id?.toString())) {
        await syncMaterialToVendor(material, project, req.tenant._id)
      }
    }

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'update_interior_project', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Interior project "${project.title}" updated`,
      type: 'crud', severity: 'info',
    })
    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteProject = async (req, res) => {
  try {
    const project = await InteriorProject.findOneAndDelete({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })
    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_interior_project', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Interior project "${project.title}" deleted`,
      type: 'crud', severity: 'warning',
    })
    res.json({ message: 'Project deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const createBudget = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })
    const budget = await ProjectBudget.create({ ...req.body, project_id: project._id })
    res.status(201).json(budget)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const updateBudget = async (req, res) => {
  try {
    const budget = await ProjectBudget.findOneAndUpdate(
      { _id: req.params.budgetId, project_id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    )
    if (!budget) return res.status(404).json({ message: 'Budget not found' })
    res.json(budget)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteBudget = async (req, res) => {
  try {
    const budget = await ProjectBudget.findOneAndDelete({ _id: req.params.budgetId, project_id: req.params.id })
    if (!budget) return res.status(404).json({ message: 'Budget not found' })
    res.json({ message: 'Budget deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const createMilestone = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })
    const milestone = await ProjectMilestone.create({ ...req.body, project_id: project._id })
    res.status(201).json(milestone)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const updateMilestone = async (req, res) => {
  try {
    const milestone = await ProjectMilestone.findOneAndUpdate(
      { _id: req.params.milestoneId, project_id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    )
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' })
    res.json(milestone)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteMilestone = async (req, res) => {
  try {
    const milestone = await ProjectMilestone.findOneAndDelete({ _id: req.params.milestoneId, project_id: req.params.id })
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' })
    res.json({ message: 'Milestone deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addTeamMember = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })
    const member = await ProjectTeam.create({ ...req.body, project_id: project._id })
    const populated = await ProjectTeam.findById(member._id).populate('user_id', 'full_name')
    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const removeTeamMember = async (req, res) => {
  try {
    const member = await ProjectTeam.findOneAndDelete({ _id: req.params.teamId, project_id: req.params.id })
    if (!member) return res.status(404).json({ message: 'Team member not found' })
    res.json({ message: 'Team member removed' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addMaterialPayment = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const material = project.materials.id(req.params.materialId)
    if (!material) return res.status(404).json({ message: 'Material not found' })

    const { amount, payment_date, notes } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid payment amount is required' })

    material.payments.push({ amount, payment_date, notes })
    material.paid_amount = (material.paid_amount || 0) + Number(amount)
    material.payment_status = material.paid_amount >= material.cost ? 'paid' : material.paid_amount > 0 ? 'partial' : 'credit'

    await project.save()

    if (material.vendor) {
      try {
        const vendor = await Vendor.findOne({ _id: material.vendor, tenant: req.tenant._id, is_deleted: false })
        if (vendor) {
          vendor.payments.push({
            amount,
            payment_date: payment_date || new Date(),
            notes: notes || `Payment for ${material.item_name} - Project: ${project.title}`,
          })
          vendor.total_paid = (vendor.total_paid || 0) + Number(amount)
          vendor.total_due = (vendor.total_purchased || 0) - vendor.total_paid
          vendor.payment_status = vendor.total_due <= 0 ? 'paid' : vendor.total_paid > 0 ? 'partial' : 'credit'
          await vendor.save()
        }
      } catch (e) {
        // silent fail on vendor sync
      }
    }

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'material_payment', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Payment of ₹${amount} for ${material.item_name} in project ${project.title}`,
      type: 'crud', severity: 'info',
    })

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name phone')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const addMaterial = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { item_name, cost, vendor, from_stock, stock_item, purchaser_name } = req.body
    if (!item_name || cost == null) {
      return res.status(400).json({ message: 'Item name and cost are required' })
    }

    if (from_stock && stock_item) {
      const Stock = (await import('../models/Stock.js')).default
      const stockRecord = await Stock.findOne({ _id: stock_item, tenant: req.tenant._id, is_deleted: false })
      if (stockRecord) {
        stockRecord.current_quantity = Math.max(0, (stockRecord.current_quantity || 1) - 1)
        stockRecord.last_updated = new Date()
        stockRecord.transactions.push({
          type: 'remove',
          quantity: 1,
          previous_quantity: (stockRecord.current_quantity || 1) + 1,
          new_quantity: Math.max(0, (stockRecord.current_quantity || 1)),
          reason: `Used in interior project: ${project.title}`,
          done_by: req.user._id,
        })
        await stockRecord.save()
      }
    }

    project.materials.push({
      item_name,
      cost: Number(cost),
      vendor: vendor || undefined,
      from_stock: !!from_stock,
      stock_item: stock_item || undefined,
      purchaser_name: purchaser_name || undefined,
      created_by: req.user._id,
    })
    await project.save()

    const newMaterial = project.materials[project.materials.length - 1]
    if (newMaterial.vendor) {
      await syncMaterialToVendor(newMaterial, project, req.tenant._id)
    }

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'add_material', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Material "${item_name}" (₹${cost}) added to project "${project.title}" by ${req.user.full_name || 'Unknown'}`,
      type: 'crud', severity: 'info',
    })

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name phone')
      .populate('materials.created_by', 'full_name email')

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const assignVendor = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { vendor, role, notes } = req.body
    if (!vendor) return res.status(400).json({ message: 'Vendor is required' })

    const vendorExists = await Vendor.findOne({ _id: vendor, tenant: req.tenant._id, is_deleted: false })
    if (!vendorExists) return res.status(404).json({ message: 'Vendor not found' })

    const alreadyAssigned = project.vendors.some(v => v.vendor?.toString() === vendor)
    if (alreadyAssigned) return res.status(400).json({ message: 'Vendor already assigned to this project' })

    project.vendors.push({ vendor, role: role || '', notes: notes || '' })
    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('vendors.vendor', 'name phone email')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'assign_vendor', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Vendor "${vendorExists.name}" assigned to project "${project.title}"`,
      type: 'crud', severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const removeVendor = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const vendorEntry = project.vendors.id(req.params.vendorEntryId)
    if (!vendorEntry) return res.status(404).json({ message: 'Vendor assignment not found' })

    vendorEntry.deleteOne()
    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('vendors.vendor', 'name phone email')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'remove_vendor', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Vendor removed from project "${project.title}"`,
      type: 'crud', severity: 'warning',
    })

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getProjectVendors = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('vendors.vendor', 'name phone email company_name')
    if (!project) return res.status(404).json({ message: 'Project not found' })

    res.json(project.vendors || [])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const assignLabour = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { name, employee_id, role, phone, daily_wage, notes } = req.body
    if (!name && !employee_id) return res.status(400).json({ message: 'Labour name or employee is required' })

    let labourName = name
    let labourPhone = phone || ''
    if (employee_id) {
      const Employee = (await import('../models/Employee.js')).default
      const employee = await Employee.findOne({ _id: employee_id, tenant: req.tenant._id, is_deleted: false })
      if (employee) {
        labourName = employee.full_name
        if (!labourPhone) labourPhone = employee.mobile || ''
      }
    }
    if (!labourName) return res.status(400).json({ message: 'Labour name is required' })

    project.labour.push({
      name: labourName,
      employee_id: employee_id || undefined,
      role: role || '',
      phone: labourPhone,
      daily_wage: daily_wage ? Number(daily_wage) : undefined,
      notes: notes || '',
    })
    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('labour.employee_id', 'full_name mobile photo')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'assign_labour', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Labour "${labourName}" assigned to project "${project.title}"`,
      type: 'crud', severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const removeLabour = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const labourEntry = project.labour.id(req.params.labourEntryId)
    if (!labourEntry) return res.status(404).json({ message: 'Labour assignment not found' })

    labourEntry.deleteOne()
    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'remove_labour', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Labour "${labourEntry.name}" removed from project "${project.title}"`,
      type: 'crud', severity: 'warning',
    })

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getProjectLabour = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('labour.employee_id', 'full_name mobile photo designation')
    if (!project) return res.status(404).json({ message: 'Project not found' })

    res.json(project.labour || [])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addExpense = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { expense_name, category, cost, paid_amount, payment_date, vendor, notes } = req.body
    if (!expense_name || cost == null) {
      return res.status(400).json({ message: 'Expense name and cost are required' })
    }

    project.direct_expenses.push({ expense_name, category, cost, paid_amount, payment_date, vendor, notes })
    await project.save()

    const expenseCategoryMap = {
      labour: 'salary', transport: 'travel', permit: 'legal', utility: 'utilities', equipment: 'other', other: 'miscellaneous',
    }

    await Expense.create({
      tenant: req.tenant._id,
      expense_number: `EXP-INT-${Date.now()}`,
      category: expenseCategoryMap[category] || 'miscellaneous',
      amount: Number(cost),
      date: payment_date || new Date(),
      description: `Interior expense: ${expense_name} for project "${project.title}"`,
      vendor: vendor || '',
      status: 'approved',
    })

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'add_expense', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Expense "${expense_name}" (₹${cost}) added to project "${project.title}"`,
      type: 'crud', severity: 'info',
    })

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name phone')

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const updateExpense = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const expense = project.direct_expenses.id(req.params.expenseId)
    if (!expense) return res.status(404).json({ message: 'Expense not found' })

    const { expense_name, category, cost, paid_amount, payment_date, vendor, notes } = req.body
    if (expense_name !== undefined) expense.expense_name = expense_name
    if (category !== undefined) expense.category = category
    if (cost !== undefined) expense.cost = cost
    if (paid_amount !== undefined) expense.paid_amount = paid_amount
    if (payment_date !== undefined) expense.payment_date = payment_date
    if (vendor !== undefined) expense.vendor = vendor
    if (notes !== undefined) expense.notes = notes

    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name phone')

    res.json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteExpense = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const expense = project.direct_expenses.id(req.params.expenseId)
    if (!expense) return res.status(404).json({ message: 'Expense not found' })

    await Expense.findOneAndUpdate(
      { tenant: req.tenant._id, description: { $regex: expense.expense_name, $options: 'i' }, is_deleted: false },
      { is_deleted: true, deleted_at: new Date() }
    )

    expense.deleteOne()
    await project.save()

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_expense', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Expense "${expense.expense_name}" removed from project "${project.title}"`,
      type: 'crud', severity: 'warning',
    })

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name phone')

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addProjectPayment = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const { amount, payment_date, payment_mode, transaction_id, notes, payment_receiver_name } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount is required' })

    project.payments.push({
      amount: Number(amount),
      payment_date: payment_date || new Date(),
      payment_mode: payment_mode || 'cash',
      transaction_id: transaction_id || '',
      notes: notes || '',
      received_by: req.user._id,
      payment_receiver_name: payment_receiver_name || undefined,
    })
    await project.save()

    await Income.create({
      tenant: req.tenant._id,
      income_number: `INC-INT-${Date.now()}`,
      category: 'interior_services',
      amount: Number(amount),
      date: payment_date || new Date(),
      description: `Interior payment for project "${project.title}"`,
      client: project.client_id,
      payment_mode: payment_mode || 'cash',
      reference: transaction_id || '',
      received_by: req.user._id,
    })

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('payments.received_by', 'full_name')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'add_project_payment', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Payment of ₹${amount} received for project "${project.title}"`,
      type: 'crud', severity: 'info',
    })

    res.status(201).json(populated)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
}

export const deleteProjectPayment = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const payment = project.payments.id(req.params.paymentId)
    if (!payment) return res.status(404).json({ message: 'Payment not found' })

    await Income.findOneAndUpdate(
      { tenant: req.tenant._id, description: `Interior payment for project "${project.title}"`, amount: payment.amount, is_deleted: false },
      { is_deleted: true, deleted_at: new Date() }
    )

    payment.deleteOne()
    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('payments.received_by', 'full_name')

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const deleteMaterial = async (req, res) => {
  try {
    const roleSlug = req.user.role_slug || req.user.role?.slug
    if (roleSlug !== 'admin') return res.status(403).json({ message: 'Only admins can delete materials' })

    const project = await InteriorProject.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const material = project.materials.id(req.params.materialId)
    if (!material) return res.status(404).json({ message: 'Material not found' })

    const itemName = material.item_name
    material.deleteOne()
    await project.save()

    const populated = await InteriorProject.findById(project._id)
      .populate('client_id', 'full_name phone')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name phone')

    await ActivityLog.create({
      tenant: req.tenant._id, user: req.user._id,
      action: 'delete_material', resource: 'InteriorProject',
      resource_id: project._id,
      description: `Material "${itemName}" deleted from project "${project.title}"`,
      type: 'crud', severity: 'warning',
    })

    res.json(populated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const uploadMaterialBill = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    const project = await InteriorProject.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const material = project.materials.id(req.params.materialId)
    if (!material) return res.status(404).json({ message: 'Material not found' })

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'interior_material_bills',
      public_id: `bill_${req.params.id}_${req.params.materialId}_${Date.now()}`,
    })

    material.bill_photos.push({
      url: result.url,
      public_id: result.public_id,
      name: req.file.originalname || 'bill_photo',
    })
    await project.save()

    res.json(material)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const deleteMaterialBill = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, tenant: req.tenant._id })
    if (!project) return res.status(404).json({ message: 'Project not found' })

    const material = project.materials.id(req.params.materialId)
    if (!material) return res.status(404).json({ message: 'Material not found' })

    const bill = material.bill_photos.id(req.params.billId)
    if (!bill) return res.status(404).json({ message: 'Bill photo not found' })

    const cloudinary = (await import('cloudinary')).v2
    await cloudinary.uploader.destroy(bill.public_id)

    bill.deleteOne()
    await project.save()

    res.json({ message: 'Bill photo removed' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getPurchaseReport = async (req, res) => {
  try {
    const projects = await InteriorProject.find(tenantFilter(req))
      .populate('client_id', 'full_name')
      .populate('branch_id', 'name')
      .populate('materials.vendor', 'name')

    const report = []
    projects.forEach((p) => {
      (p.materials || []).forEach((m) => {
        report.push({
          project_title: p.title,
          project_code: p.project_code || '-',
          client_name: p.client_id?.full_name || '-',
          branch: p.branch_id?.name || '-',
          item_name: m.item_name,
          cost: m.cost || 0,
          paid_amount: m.paid_amount || 0,
          due_amount: (m.cost || 0) - (m.paid_amount || 0),
          payment_status: m.payment_status || 'credit',
          vendor_name: m.vendor?.name || '-',
          from_stock: m.from_stock ? 'Yes' : 'No',
        })
      })
    })

    if (req.query.format === 'csv') {
      const headers = ['Project', 'Code', 'Client', 'Branch', 'Item', 'Cost', 'Paid', 'Due', 'Status', 'Vendor', 'From Stock']
      const csvRows = [headers.join(',')]
      report.forEach((r) => {
        csvRows.push([
          `"${r.project_title}"`, `"${r.project_code}"`, `"${r.client_name}"`, `"${r.branch}"`,
          `"${r.item_name}"`, r.cost, r.paid_amount, r.due_amount, `"${r.payment_status}"`, `"${r.vendor_name}"`, r.from_stock,
        ].join(','))
      })
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=purchase_report.csv')
      return res.send(csvRows.join('\n'))
    }

    const totals = report.reduce((s, r) => ({
      total_cost: s.total_cost + r.cost,
      total_paid: s.total_paid + r.paid_amount,
      total_due: s.total_due + r.due_amount,
    }), { total_cost: 0, total_paid: 0, total_due: 0 })

    res.json({ report, totals, count: report.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getAllProjectPayments = async (req, res) => {
  try {
    const match = { tenant: req.tenant._id, is_deleted: false }
    if (req.query.project_id) match._id = req.query.project_id
    if (req.query.status) match.status = req.query.status

    const projects = await InteriorProject.find(match)
      .populate('client_id', 'full_name phone')
      .populate('payments.received_by', 'full_name')
      .select('title flat_id project_code client_id payments contract_amount received_amount')
      .sort({ createdAt: -1 })

    const allPayments = []
    for (const project of projects) {
      const balance = (project.contract_amount || 0) - (project.received_amount || 0)
      for (const p of project.payments || []) {
        allPayments.push({
          _id: p._id,
          project_id: project._id,
          project_title: project.title,
          flat_id: project.flat_id || project.project_code || '',
          client: project.client_id,
          amount: p.amount,
          payment_date: p.payment_date,
          payment_mode: p.payment_mode,
          transaction_id: p.transaction_id,
          notes: p.notes,
          received_by: p.received_by,
          payment_receiver_name: p.payment_receiver_name,
          createdAt: p.createdAt,
          contract_amount: project.contract_amount,
          received_amount: project.received_amount,
          balance,
        })
      }
    }

    allPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    if (req.query.from_date || req.query.to_date) {
      return res.json(allPayments.filter(p => {
        const d = new Date(p.payment_date)
        if (req.query.from_date && d < new Date(req.query.from_date)) return false
        if (req.query.to_date && d > new Date(req.query.to_date)) return false
        return true
      }))
    }

    res.json(allPayments)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getEstimateData = async (req, res) => {
  try {
    const project = await InteriorProject.findOne({ _id: req.params.id, ...tenantFilter(req) })
      .populate('client_id', 'full_name phone email address')
      .populate('branch_id', 'name city address')
    if (!project) return res.status(404).json({ message: 'Project not found' })
    res.json(project)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
