import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Realestate ERP'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    }
    const info = await transporter.sendMail(mailOptions)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: error.message }
  }
}

export const sendWelcomeEmail = async (user, password) => {
  const subject = 'Welcome to Realestate ERP - Your Account Credentials'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to Realestate ERP!</h2>
      <p>Dear ${user.full_name},</p>
      <p>Your account has been created successfully. Below are your login credentials:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      <p>Please change your password after your first login.</p>
      <p>Best regards,<br>Realestate ERP Team</p>
    </div>
  `
  return sendEmail({ to: user.email, subject, html })
}

export const sendPasswordResetEmail = async (user, resetLink) => {
  const subject = 'Password Reset - Realestate ERP'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Dear ${user.full_name},</p>
      <p>We received a request to reset your password. Click the link below to reset it:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${resetLink}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </div>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
      <p>Best regards,<br>Realestate ERP Team</p>
    </div>
  `
  return sendEmail({ to: user.email, subject, html })
}

export const sendInvoiceEmail = async (invoice, client, pdfBuffer) => {
  try {
    const subject = `Invoice ${invoice.invoice_number} - Realestate ERP`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice ${invoice.invoice_number}</h2>
        <p>Dear ${client.full_name},</p>
        <p>Please find attached the invoice <strong>${invoice.invoice_number}</strong> for your reference.</p>
        <p><strong>Amount:</strong> $${invoice.total_amount}</p>
        <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
        <p>Best regards,<br>Realestate ERP Team</p>
      </div>
    `
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Realestate ERP'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: client.email,
      subject,
      html,
      attachments: [
        {
          filename: `invoice_${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    }
    const info = await transporter.sendMail(mailOptions)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Invoice email send error:', error)
    return { success: false, error: error.message }
  }
}

export const sendLeadAssignmentEmail = async (lead, assignedTo) => {
  const subject = 'New Lead Assignment - Realestate ERP'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Lead Assigned</h2>
      <p>Dear ${assignedTo.full_name},</p>
      <p>A new lead has been assigned to you:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Lead Name:</strong> ${lead.full_name}</p>
        <p><strong>Mobile:</strong> ${lead.mobile}</p>
        <p><strong>Source:</strong> ${lead.source}</p>
        <p><strong>Budget:</strong> ${lead.budget || 'Not specified'}</p>
      </div>
      <p>Please follow up with the lead at the earliest.</p>
      <p>Best regards,<br>Realestate ERP Team</p>
    </div>
  `
  return sendEmail({ to: assignedTo.email, subject, html })
}
