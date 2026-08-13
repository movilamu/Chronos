import { Clock, Trash2, Pencil, CheckCircle2, Check, FolderKanban } from 'lucide-react'

const STATUS_STYLE = {
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  waiting_for: { label: 'Waiting For', color: '#f59e0b' },
  skipped: { label: 'Skipped', color: '#94a3b8' },
  moved: { label: 'Moved', color: '#94a3b8' },
}

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' }

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function formatTime12h(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function TaskCard({ task, category, project, onEdit, onDelete, onToggleDone }) {
  const catColor = category?.color_hex || '#6366f1'
  const isDone = task.status === 'done'
  const statusStyle = STATUS_STYLE[task.status]

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: catColor }}
    >
      <button onClick={() => onToggleDone(task)} className="shrink-0" title={isDone ? 'Mark as pending' : 'Mark as done'}>
        <CheckCircle2 size={22} className={isDone ? 'text-green-500' : 'text-[var(--border-color)]'} fill={isDone ? 'currentColor' : 'none'} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`truncate text-sm font-medium ${isDone ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
            {task.title}
          </p>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} title={`${task.priority} priority`} />
          {project && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: project.color_hex + '1a', color: project.color_hex }}
            >
              <FolderKanban size={10} /> {project.name}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1 font-medium text-[var(--text-primary)]">
            <Clock size={12} /> {formatDuration(task.duration_minutes)}
            {task.actual_hours ? ` (actual: ${task.actual_hours}h)` : ''}
          </span>
          <span style={{ color: catColor }}>{category?.name || 'Uncategorized'}</span>
          {task.scheduled_start && (
            <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[var(--text-primary)]">
              {formatTime12h(task.scheduled_start)}
              {task.scheduled_end ? ` – ${formatTime12h(task.scheduled_end)}` : ''}
            </span>
          )}
          {statusStyle && (
            <span
              className="rounded-full px-1.5 py-0.5 font-medium"
              style={{ backgroundColor: statusStyle.color + '1a', color: statusStyle.color }}
            >
              {statusStyle.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!isDone && (
          <button
            onClick={() => onToggleDone(task)}
            className="flex items-center gap-1 rounded-lg border border-green-500/30 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-500/10"
          >
            <Check size={13} /> Done
          </button>
        )}
        <button onClick={() => onEdit(task)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]">
          <Pencil size={15} />
        </button>
        <button onClick={() => onDelete(task)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
