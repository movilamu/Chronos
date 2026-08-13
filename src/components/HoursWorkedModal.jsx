import { useState, useEffect } from 'react'
import { Clock, X } from 'lucide-react'

// onConfirm(actualMinutes, completedDateStr) - completedDateStr is "YYYY-MM-DD"
export default function HoursWorkedModal({ open, task, onConfirm, onClose }) {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (open) {
      setHours(0)
      setMinutes(0)
      setCompletedDate(new Date().toISOString().slice(0, 10))
    }
  }, [open, task])

  if (!open || !task) return null

  const plannedH = Math.floor((task.duration_minutes || 0) / 60)
  const plannedM = (task.duration_minutes || 0) % 60

  const handleConfirm = () => {
    const total = Number(hours) * 60 + Number(minutes)
    onConfirm(total > 0 ? total : task.duration_minutes, completedDate)
  }

  const useAsPlanned = () => onConfirm(task.duration_minutes, completedDate)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-[var(--bg-secondary)] p-6 shadow-xl md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Time spent</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          How long did "{task.title}" actually take? (Planned: {plannedH}h {plannedM}m)
        </p>

        <div className="mb-4 flex items-center gap-2">
          <input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)}
            placeholder={String(plannedH)}
            className="w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <span className="text-xs text-[var(--text-secondary)]">hrs</span>
          <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)}
            placeholder={String(plannedM)}
            className="w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <span className="text-xs text-[var(--text-secondary)]">min</span>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Date completed
          </label>
          <input
            type="date"
            value={completedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setCompletedDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Change this if you finished it on a different day.</p>
        </div>

        <div className="flex gap-3">
          <button onClick={useAsPlanned} className="flex-1 rounded-lg border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
            Same as planned
          </button>
          <button onClick={handleConfirm} className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
