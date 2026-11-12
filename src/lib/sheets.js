/* Excel read/write for attendance, salary and disbursal sheets.
 * ExcelJS is loaded on demand so it never weighs on the first page load. */

const loadExcel = async () => (await import('exceljs')).default

const INK = 'FF1B1D1A'
const HAIRLINE = 'FFE2E2D9'

/**
 * Build and download a workbook.
 * sheets: [{ name, title?, subtitle?, columns: [{ header, key, width?, money?, align? }],
 *            rows: [object], totals?: object (same keys) }]
 */
export async function downloadWorkbook(filename, sheets) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()

  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name.slice(0, 31))
    let headerRow = 1
    if (sh.title) {
      ws.addRow([sh.title]).font = { bold: true, size: 14, color: { argb: INK } }
      if (sh.subtitle) ws.addRow([sh.subtitle]).font = { size: 10, color: { argb: 'FF565A53' } }
      ws.addRow([])
      headerRow = ws.rowCount + 1
    }

    const head = ws.addRow(sh.columns.map((c) => c.header))
    head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    head.alignment = { vertical: 'middle', wrapText: true }
    head.height = 24
    head.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }
    })

    const write = (obj, bold) => {
      const row = ws.addRow(sh.columns.map((c) => obj[c.key] ?? (bold ? '' : null)))
      if (bold) row.font = { bold: true }
      row.eachCell({ includeEmpty: true }, (cell, i) => {
        const col = sh.columns[i - 1]
        if (col?.money) cell.numFmt = '#,##0'
        if (col?.text) cell.numFmt = '@'
        if (col?.align) cell.alignment = { horizontal: col.align }
        cell.border = { bottom: { style: 'thin', color: { argb: HAIRLINE } } }
        if (bold) cell.border = { top: { style: 'thin', color: { argb: INK } } }
      })
    }
    sh.rows.forEach((r) => write(r, false))
    if (sh.totals) write(sh.totals, true)

    sh.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width ?? Math.max(10, Math.min(32, String(c.header).length + 4))
    })
    ws.views = [{ state: 'frozen', ySplit: headerRow, xSplit: sh.freeze ?? 0 }]
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const cellText = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text)
    if (v.result != null) return String(v.result)
    if (v.richText) return v.richText.map((t) => t.text).join('')
    if (v instanceof Date) return v.toISOString().slice(0, 10)
  }
  return String(v)
}

/** Read the first sheet of an .xlsx or .csv file into rows of trimmed strings. */
export async function readSheet(file) {
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text()
    return text
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()))
  }
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []
  const rows = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const out = []
    for (let i = 1; i <= ws.columnCount; i++) out.push(cellText(row.getCell(i).value).trim())
    rows.push(out)
  })
  return rows
}
