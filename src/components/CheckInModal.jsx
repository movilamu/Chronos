import { CheckCircle2, Clock, ShuffleIcon, X } from 'lucide-react'

export default function CheckInModal({ open, task, onDone, onExtend, onSomethingElse, onClose }) {
  if (!open || !task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-[var(--bg-secondary)] p-6 shadow-xl md:rounded-2xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Time check
          </p>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>
        <h2 className="mb-5 text-lg font-semibold text-[var(--text-primary)]">
          Did you finish "{task.title}"?
        </h2>

        <div className="space-y-2">
          <button
            onClick={onDone}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-color)] p-3.5 text-left hover:bg-[var(--bg-tertiary)]"
          >
            <CheckCircle2 size={20} className="text-green-500" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Yes, all done</p>
              <p className="text-xs text-[var(--text-secondary)]">Mark complete and move on</p>
            </div>
          </button>

          <button
            onClick={onExtend}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-color)] p-3.5 text-left hover:bg-[var(--bg-tertiary)]"
          >
            <Clock size={20} className="text-amber-500" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Still working on it</p>
              <p className="text-xs text-[var(--text-secondary)]">Extend by 10 minutes</p>
            </div>
          </button>

          <button
            onClick={onSomethingElse}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-color)] p-3.5 text-left hover:bg-[var(--bg-tertiary)]"
          >
            <ShuffleIcon size={20} className="text-red-500" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">I did something else</p>
              <p className="text-xs text-[var(--text-secondary)]">This task didn't happen as planned</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
