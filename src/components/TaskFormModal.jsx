import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import TimePicker12h from './TimePicker12h'

const PRIORITIES = [
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#6b7280' },
]

export default function TaskFormModal({ open, onClose, onSave, categories, initialTask, projects = [], sprints = [], defaultProjectId = null, defaultStatus = 'pending' }) {
  const [form, setForm] = useState(emptyForm(defaultProjectId, defaultStatus))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(initialTask ? toFormShape(initialTask) : emptyForm(defaultProjectId, defaultStatus))
      setError(null)
    }
  }, [open, initialTask, defaultProjectId, defaultStatus])

  if (!open) return null

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const totalMinutes = () => {
    const h = Number(form.duration_hours) || 0
    const m = Number(form.duration_extra_minutes) || 0
    return h * 60 + m
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Give the task a name.')
      return
    }
    const minutes = totalMinutes()
    if (!minutes || minutes <= 0) {
      setError('Duration must be more than 0.')
      return
    }
    if (!form.category_id) {
      setError('Pick a category.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSave({
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      duration_minutes: minutes,
      priority: form.priority,
      category_id: form.category_id,
      target_date: form.target_date,
      preferred_time: form.preferred_time || null,
      locked_time: form.preferred_time ? form.locked_time : false,
      project_id: form.project_id || null,
      sprint_id: form.sprint_id || null,
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--bg-secondary)] p-6 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {initialTask ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Task name">
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Clean my room"
              className={inputCls}
            />
          </Field>

          <Field label="Duration">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={form.duration_hours}
                onChange={(e) => update('duration_hours', e.target.value)}
                className={inputCls + ' w-20'}
              />
              <span className="text-xs text-[var(--text-secondary)]">hrs</span>
              <input
                type="number"
                min="0"
                max="59"
                step="5"
                value={form.duration_extra_minutes}
                onChange={(e) => update('duration_extra_minutes', e.target.value)}
                className={inputCls + ' w-20'}
              />
              <span className="text-xs text-[var(--text-secondary)]">min</span>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => update('target_date', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Preferred time (optional)">
              <TimePicker12h value={form.preferred_time} onChange={(v) => update('preferred_time', v)} />
            </Field>
          </div>
          {form.preferred_time && (
            <div className="-mt-2 space-y-1.5">
              <p className="text-xs text-[var(--text-secondary)]">
                The AI will try to schedule this at this time. Leave blank to let it fully decide.
              </p>
              <label className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={form.locked_time}
                  onChange={(e) => update('locked_time', e.target.checked)}
                />
                Lock this time — AI must never move it
              </label>
            </div>
          )}

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => update('category_id', cat.id)}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                  style={{
                    borderColor: form.category_id === cat.id ? cat.color_hex : 'var(--border-color)',
                    backgroundColor: form.category_id === cat.id ? cat.color_hex + '1a' : 'transparent',
                    color: form.category_id === cat.id ? cat.color_hex : 'var(--text-secondary)',
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color_hex }} />
                  {cat.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Priority">
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => update('priority', p.value)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                  style={{
                    borderColor: form.priority === p.value ? p.color : 'var(--border-color)',
                    backgroundColor: form.priority === p.value ? p.color + '1a' : 'transparent',
                    color: form.priority === p.value ? p.color : 'var(--text-secondary)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {projects.length > 0 && (
            <Field label="Project (optional)">
              <select
                value={form.project_id}
                onChange={(e) => update('project_id', e.target.value)}
                className={inputCls}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          )}

          {sprints.length > 0 && (
            <Field label="Sprint (optional)">
              <select
                value={form.sprint_id}
                onChange={(e) => update('sprint_id', e.target.value)}
                className={inputCls}
              >
                <option value="">No sprint</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function emptyForm(defaultProjectId, defaultStatus) {
  return {
    title: '',
    notes: '',
    duration_hours: 0,
    duration_extra_minutes: 30,
    priority: 'medium',
    category_id: '',
    target_date: new Date().toISOString().slice(0, 10),
    preferred_time: '',
    locked_time: false,
    project_id: defaultProjectId || '',
    sprint_id: '',
    _status: defaultStatus,
  }
}

function toFormShape(task) {
  return {
    title: task.title,
    notes: task.notes || '',
    duration_hours: Math.floor((task.duration_minutes || 0) / 60),
    duration_extra_minutes: (task.duration_minutes || 0) % 60,
    priority: task.priority,
    category_id: task.category_id,
    target_date: task.target_date,
    preferred_time: task.preferred_time ? task.preferred_time.slice(0, 5) : '',
    locked_time: !!task.locked_time,
    project_id: task.project_id || '',
    sprint_id: task.sprint_id || '',
  }
}

const inputCls =
  'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
    </div>
  )
}
