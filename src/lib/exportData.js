import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function toCSVValue(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function exportTasksToCSV(tasks, categoryById, projectById) {
  const headers = ['Title', 'Category', 'Project', 'Priority', 'Status', 'Date', 'Duration (min)', 'Actual Hours', 'Scheduled Start', 'Scheduled End']
  const rows = tasks.map((t) => [
    t.title,
    categoryById[t.category_id]?.name || '',
    projectById[t.project_id]?.name || '',
    t.priority,
    t.status,
    t.target_date,
    t.duration_minutes,
    t.actual_hours || '',
    t.scheduled_start || '',
    t.scheduled_end || '',
  ])

  const csv = [headers, ...rows].map((row) => row.map(toCSVValue).join(',')).join('\n')
  downloadBlob(csv, 'text/csv', `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`)
}

export function exportTasksToPDF(tasks, categoryById, projectById, userName) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text('Life Planner - Task Export', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`${userName || ''} · Generated ${new Date().toLocaleDateString()}`, 14, 24)

  const rows = tasks.map((t) => [
    t.title,
    categoryById[t.category_id]?.name || '-',
    projectById[t.project_id]?.name || '-',
    t.priority,
    t.status,
    t.target_date,
    `${Math.floor(t.duration_minutes / 60)}h ${t.duration_minutes % 60}m`,
    t.actual_hours ? `${t.actual_hours}h` : '-',
  ])

  autoTable(doc, {
    startY: 30,
    head: [['Title', 'Category', 'Project', 'Priority', 'Status', 'Date', 'Planned', 'Actual']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  })

  doc.save(`tasks-export-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
