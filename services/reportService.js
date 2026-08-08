import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

export const generateExcelReport = async (headers, data, filename) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(filename || 'Report')

    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007BFF' },
    }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

    data.forEach((row) => {
      worksheet.addRow(headers.map((h) => row[h] ?? ''))
    })

    worksheet.columns.forEach((column) => {
      column.width = 20
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return buffer
  } catch (error) {
    console.error('Excel generation error:', error)
    throw error
  }
}

export const generateCSVReport = async (headers, data, filename) => {
  try {
    const headerLine = headers.join(',')
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    )
    const csvContent = [headerLine, ...rows].join('\n')
    return Buffer.from(csvContent, 'utf-8')
  } catch (error) {
    console.error('CSV generation error:', error)
    throw error
  }
}

export const generatePDFReport = async (title, headers, data, filename, company) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' })
      const buffers = []

      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      doc.fontSize(18).text(company?.company_name || 'Shivam International', { align: 'center' })
      doc.fontSize(9).text('Real Estate & Interior Solutions', { align: 'center' })
      doc.fontSize(8).text(company?.company_address || 'F-2 G001, Amrapali Terrace Homes, Techzone-4, Greater Noida West, Gautam Buddha Nagar, Uttar Pradesh – 201308, India', { align: 'center' })
      doc.fontSize(8).text(company?.company_phone || '+91 98991 46931 | 9891075835', { align: 'center' })
      doc.moveDown()
      doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke()
      doc.moveDown()

      doc.fontSize(18).text(title, { align: 'center' })
      doc.moveDown()

      const tableTop = doc.y
      const colWidth = (doc.page.width - 60) / headers.length

      doc.fontSize(10).font('Helvetica-Bold')
      headers.forEach((header, i) => {
        doc.text(header, 30 + i * colWidth, tableTop, { width: colWidth, align: 'left' })
      })
      doc.moveDown()

      let currentY = doc.y
      doc.font('Helvetica')

      data.forEach((row) => {
        headers.forEach((header, i) => {
          const val = String(row[header] ?? '')
          doc.text(val, 30 + i * colWidth, currentY, { width: colWidth, align: 'left' })
        })
        currentY += 20
        if (currentY > doc.page.height - 50) {
          doc.addPage()
          currentY = 30
        }
      })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
