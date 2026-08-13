import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#06b6d4', '#eab308', '#ec4899']

export default function ProjectFormModal({ open, onClose, onSave, initialProject }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setName(initialProject?.name || '')
      setDescription(initialProject?.description || '')
      setColor(initialProject?.color_hex || PRESET_COLORS[0])
      setError(null)
    }
  }, [open, initialProject])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Give the project a name.')
      return
    }
    setSaving(true)
    const { error: saveError } = await onSave({ name: name.trim(), description: description.trim() || null, color_hex: color })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-[var(--bg-secondary)] p-6 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {initialProject ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Project name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Final Year Project"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: color === c ? 'var(--text-primary)' : 'transparent' }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
