import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor, Loader2, Check, Plus, Trash2, Download, FileText, Table } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useCategories } from '../hooks/useCategories'
import { useRecurringTemplates } from '../hooks/useRecurringTemplates'
import { exportTasksToCSV, exportTasksToPDF } from '../lib/exportData'
import TimePicker12h from '../components/TimePicker12h'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#06b6d4', '#eab308', '#ec4899']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Settings() {
  const { user, profile } = useAuth()
  const { theme, setTheme } = useTheme()
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories()
  const { templates, addTemplate, deleteTemplate, toggleActive } = useRecurringTemplates()

  const [form, setForm] = useState(null)
  const [fixedBlocks, setFixedBlocks] = useState([])
  const [collegeBlocks, setCollegeBlocks] = useState([])
  const [sleepBlocks, setSleepBlocks] = useState([])
  const [focusBlocks, setFocusBlocks] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({ buffer_minutes: data.buffer_minutes ?? 10 })
          setFixedBlocks(data.meal_times || [])
          setCollegeBlocks(
            data.college_blocks?.length ? data.college_blocks
            : data.college_start ? [{ start: data.college_start.slice(0, 5), end: data.college_end.slice(0, 5), days: data.college_days || [] }]
            : []
          )
          setSleepBlocks(
            data.sleep_blocks?.length ? data.sleep_blocks
            : data.sleep_start ? [{ start: data.sleep_start.slice(0, 5), end: data.sleep_end.slice(0, 5) }]
            : []
          )
          setFocusBlocks(
            data.focus_blocks?.length ? data.focus_blocks
            : data.ideal_study_start ? [{ start: data.ideal_study_start.slice(0, 5), end: data.ideal_study_end.slice(0, 5) }]
            : []
          )
        }
      })
  }, [user])

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await supabase
      .from('user_settings')
      .update({
        ...form,
        meal_times: fixedBlocks,
        college_blocks: collegeBlocks,
        sleep_blocks: sleepBlocks,
        focus_blocks: focusBlocks,
        // keep legacy singular fields in sync with the first block, for any old code path
        college_start: collegeBlocks[0]?.start || null,
        college_end: collegeBlocks[0]?.end || null,
        sleep_start: sleepBlocks[0]?.start || null,
        sleep_end: sleepBlocks[0]?.end || null,
        ideal_study_start: focusBlocks[0]?.start || null,
        ideal_study_end: focusBlocks[0]?.end || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // --- Fixed daily blocks (meals, gym, etc.) ---
  const addBlock = () => setFixedBlocks((b) => [...b, { label: 'New block', start: '18:00', end: '19:00' }])
  const updateBlock = (i, key, val) => setFixedBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, [key]: val } : blk)))
  const removeBlock = (i) => setFixedBlocks((b) => b.filter((_, idx) => idx !== i))

  // --- Multi-block schedule sections (College/Work, Sleep, Focus) ---
  const makeBlockHandlers = (setter) => ({
    add: () => setter((b) => [...b, { start: '09:00', end: '10:00' }]),
    update: (i, key, val) => setter((b) => b.map((blk, idx) => (idx === i ? { ...blk, [key]: val } : blk))),
    remove: (i) => setter((b) => b.filter((_, idx) => idx !== i)),
  })
  const collegeHandlers = makeBlockHandlers(setCollegeBlocks)
  const sleepHandlers = makeBlockHandlers(setSleepBlocks)
  const focusHandlers = makeBlockHandlers(setFocusBlocks)

  // --- Categories ---
  const [newCatName, setNewCatName] = useState('')
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await addCategory({ name: newCatName.trim(), color_hex: PRESET_COLORS[categories.length % PRESET_COLORS.length] })
    setNewCatName('')
  }

  // --- Recurring templates ---
  const [newTemplate, setNewTemplate] = useState({ title: '', hours: 0, minutes: 30, priority: 'medium', category_id: '', preferred_time: '', days: [] })
  const toggleTemplateDay = (day) =>
    setNewTemplate((t) => ({ ...t, days: t.days.includes(day) ? t.days.filter((d) => d !== day) : [...t.days, day] }))
  const handleAddTemplate = async () => {
    if (!newTemplate.title.trim() || newTemplate.days.length === 0) return
    await addTemplate({
      title: newTemplate.title.trim(),
      duration_minutes: Number(newTemplate.hours) * 60 + Number(newTemplate.minutes),
      priority: newTemplate.priority,
      category_id: newTemplate.category_id || null,
      preferred_time: newTemplate.preferred_time || null,
      days: newTemplate.days,
    })
    setNewTemplate({ title: '', hours: 0, minutes: 30, priority: 'medium', category_id: '', preferred_time: '', days: [] })
  }

  // --- Export ---
  const handleExport = async (format) => {
    setExporting(true)
    const [{ data: tasks }, { data: projects }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id),
      supabase.from('projects').select('*').eq('user_id', user.id),
    ])
    const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))
    const projectById = Object.fromEntries((projects || []).map((p) => [p.id, p]))
    if (format === 'csv') exportTasksToCSV(tasks || [], categoryById, projectById)
    else exportTasksToPDF(tasks || [], categoryById, projectById, profile?.full_name)
    setExporting(false)
  }

  if (!form) return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading...</div>

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-5 text-2xl font-semibold text-[var(--text-primary)]">Settings</h1>

      <div className="max-w-2xl space-y-6">
        <Section title="Account">
          <div className="flex items-center gap-3">
            {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full" />}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{profile?.full_name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{user?.email}</p>
            </div>
          </div>
        </Section>

        <Section title="Appearance">
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition ' +
                  (theme === value
                    ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-500'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)]')
                }
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="College / Work hours">
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            The AI will never schedule anything during these — add one block per class/shift if your hours vary by day.
          </p>
          <MultiBlockEditor blocks={collegeBlocks} handlers={collegeHandlers} withDays />
        </Section>

        <Section title="Sleep">
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            Your day's planning window ends at the start of your first sleep block.
          </p>
          <MultiBlockEditor blocks={sleepBlocks} handlers={sleepHandlers} />
        </Section>

        <Section title="Ideal focus window(s)">
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            Reserved for deep-focus study/work tasks when you have any that day.
          </p>
          <MultiBlockEditor blocks={focusBlocks} handlers={focusHandlers} />

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Buffer between tasks (minutes)</label>
            <input
              type="number" min="0" step="5" value={form.buffer_minutes}
              onChange={(e) => update('buffer_minutes', Number(e.target.value))}
              className="w-24 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </Section>

        <Section title="Fixed daily blocks">
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            Meals, gym, commute — anything that happens at the same time every day.
          </p>
          <div className="space-y-2">
            {fixedBlocks.map((blk, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <input
                  value={blk.label}
                  onChange={(e) => updateBlock(i, 'label', e.target.value)}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <TimePicker12h value={blk.start} onChange={(v) => updateBlock(i, 'start', v)} />
                <TimePicker12h value={blk.end} onChange={(v) => updateBlock(i, 'end', v)} />
                <button onClick={() => removeBlock(i)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addBlock} className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
            <Plus size={13} /> Add block
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saved && <Check size={16} />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save all schedule changes'}
          </button>
        </Section>

        <Section title="Categories">
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] p-2.5">
                <span className="text-sm font-medium text-[var(--text-primary)]">{cat.name}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={!!cat.is_focus_category}
                      onChange={(e) => updateCategory(cat.id, { is_focus_category: e.target.checked })}
                    />
                    Deep-focus type
                  </label>
                  <div className="flex gap-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateCategory(cat.id, { color_hex: color })}
                        className="h-5 w-5 rounded-full border-2"
                        style={{ backgroundColor: color, borderColor: cat.color_hex === color ? 'var(--text-primary)' : 'transparent' }}
                      />
                    ))}
                  </div>
                  <button onClick={() => deleteCategory(cat.id)} className="text-[var(--text-secondary)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name"
              className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={handleAddCategory} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus size={14} /> Add
            </button>
          </div>
        </Section>

        <Section title="Recurring weekly tasks">
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            Auto-creates a task on the days you pick, every week (e.g. "Gym" every Mon/Wed/Fri).
          </p>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={t.active} onChange={(e) => toggleActive(t.id, e.target.checked)} />
                  <span className={t.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] line-through'}>{t.title}</span>
                  <span className="text-xs text-[var(--text-secondary)]">({t.days.join(', ')})</span>
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="text-[var(--text-secondary)] hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-dashed border-[var(--border-color)] p-3">
            <input
              value={newTemplate.title}
              onChange={(e) => setNewTemplate((t) => ({ ...t, title: e.target.value }))}
              placeholder="Task name (e.g. Gym)"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleTemplateDay(d)}
                  className={'rounded-lg px-2.5 py-1 text-xs font-medium ' + (newTemplate.days.includes(d) ? 'bg-brand-600 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]')}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="number" min="0" placeholder="hrs" value={newTemplate.hours}
                onChange={(e) => setNewTemplate((t) => ({ ...t, hours: e.target.value }))}
                className="w-16 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]" />
              <input type="number" min="0" max="59" placeholder="min" value={newTemplate.minutes}
                onChange={(e) => setNewTemplate((t) => ({ ...t, minutes: e.target.value }))}
                className="w-16 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]" />
              <select value={newTemplate.category_id} onChange={(e) => setNewTemplate((t) => ({ ...t, category_id: e.target.value }))}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]">
                <option value="">Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="time" value={newTemplate.preferred_time}
                onChange={(e) => setNewTemplate((t) => ({ ...t, preferred_time: e.target.value }))}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]" />
            </div>
            <button onClick={handleAddTemplate} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              <Plus size={14} /> Add recurring task
            </button>
          </div>
        </Section>

        <Section title="Export your data">
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            Download all your tasks to share or keep a backup.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
              <Table size={15} /> Export CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
              <FileText size={15} /> Export PDF
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {children}
    </div>
  )
}

function TimeRow({ label, startKey, endKey, form, update }) {
  return (
    <div className="grid grid-cols-3 items-center gap-3">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <input type="time" value={form[startKey]} onChange={(e) => update(startKey, e.target.value)}
        className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500" />
      <input type="time" value={form[endKey]} onChange={(e) => update(endKey, e.target.value)}
        className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}

function MultiBlockEditor({ blocks, handlers, withDays = false }) {
  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const toggleDay = (i, blk, day) => {
    const days = blk.days || []
    const newDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    handlers.update(i, 'days', newDays)
  }

  return (
    <div className="space-y-3">
      {blocks.map((blk, i) => (
        <div key={i} className="rounded-lg border border-[var(--border-color)] p-2.5">
          <div className="flex items-center gap-2">
            <TimePicker12h value={blk.start} onChange={(v) => handlers.update(i, 'start', v)} />
            <span className="text-xs text-[var(--text-secondary)]">to</span>
            <TimePicker12h value={blk.end} onChange={(v) => handlers.update(i, 'end', v)} />
            <button onClick={() => handlers.remove(i)} className="ml-auto rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
          {withDays && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DAYS_SHORT.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i, blk, d)}
                  className={'rounded-md px-2 py-0.5 text-[11px] font-medium ' + ((blk.days || []).includes(d) ? 'bg-brand-600 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]')}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={handlers.add} className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
        <Plus size={13} /> Add block
      </button>
    </div>
  )
}
