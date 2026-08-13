import { Sparkles } from 'lucide-react'

export default function AdjustPrompt({ open, onYes, onNo }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-[var(--bg-secondary)] p-6 shadow-xl md:rounded-2xl">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-600/15">
          <Sparkles size={20} />
        </div>
        <h2 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">
          Adjust the rest of today?
        </h2>
        <p className="mb-5 text-sm text-[var(--text-secondary)]">
          Since things changed, should the AI re-plan your remaining tasks around the new
          timing?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 rounded-lg border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            No, leave it
          </button>
          <button
            onClick={onYes}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Yes, re-plan
          </button>
        </div>
      </div>
    </div>
  )
}
