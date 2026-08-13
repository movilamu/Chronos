import { useState, useMemo, useEffect } from 'react'
import { Plus, ChevronDown, ChevronRight, Trash2, Rocket } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useSprints } from '../hooks/useSprints'
import { useTasks } from '../hooks/useTasks'
import { useCategories } from '../hooks/useCategories'
import { useProjects } from '../hooks/useProjects'
import { useScheduler } from '../hooks/useScheduler'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import TaskFormModal from '../components/TaskFormModal'
import TaskCard from '../components/TaskCard'

export default function Sprints() {
  const { user } = useAuth()
  const { sprints, addSprint, deleteSprint } = useSprints()
  const { tasks, addTask, updateTask, deleteTask } = useTasks(null)
  const { categories } = useCategories()
  const { projects } = useProjects()
  const { planDay } = useScheduler()

  const [createOpen, setCreateOpen] = useState(false)
  const [newSprint, setNewSprint] = useState({ name: '', goal: '', project_id: '', start_date: today(), end_date: addDays(today(), 14) })
  const [expanded, setExpanded] = useState({})
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [activeSprintId, setActiveSprintId] = useState(null)
  const [burndownData, setBurndownData] = useState({})

  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])

  const tasksBySprint = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (!t.sprint_id) continue
      if (!map[t.sprint_id]) map[t.sprint_id] = []
      map[t.sprint_id].push(t)
    }
    return map
  }, [tasks])

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const handleCreateSprint = async () => {
    if (!newSprint.name.trim()) return
    await addSprint({
      name: newSprint.name.trim(),
      goal: newSprint.goal.trim() || null,
      project_id: newSprint.project_id || null,
      start_date: newSprint.start_date,
      end_date: newSprint.end_date,
      status: newSprint.start_date <= today() ? 'active' : 'planned',
    })
    setNewSprint({ name: '', goal: '', project_id: '', start_date: today(), end_date: addDays(today(), 14) })
    setCreateOpen(false)
  }

  const handleAddTask = (sprintId) => {
    setActiveSprintId(sprintId)
    setTaskModalOpen(true)
  }

  const handleSaveTask = async (formData) => {
    const result = await addTask({ ...formData, sprint_id: activeSprintId, status: 'pending', source: 'manual' })
    if (!result.error) planDay(formData.target_date)
    return result
  }

  // Burndown: ideal line (linear from total to 0) vs actual remaining (total - cumulative completed)
  const loadBurndown = async (sprint) => {
    const sprintTasks = tasksBySprint[sprint.id] || []
    const totalMinutes = sprintTasks.reduce((s, t) => s + t.duration_minutes, 0)

    const { data: logs } = await supabase
      .from('time_logs')
      .select('actual_duration_minutes, actual_end, tasks!inner(sprint_id)')
      .eq('user_id', user.id)
      .eq('tasks.sprint_id', sprint.id)

    const days = []
    let d = new Date(sprint.start_date + 'T12:00:00')
    const end = new Date(sprint.end_date + 'T12:00:00')
    const totalDays = Math.max(1, Math.round((end - d) / 86400000))
    let dayIndex = 0
    const todayStr = today()

    let cumulativeDone = 0
    while (d <= end) {
      const dayStr = d.toISOString().slice(0, 10)
      const doneToday = (logs || [])
        .filter((l) => (l.actual_end || '').slice(0, 10) === dayStr)
        .reduce((s, l) => s + (l.actual_duration_minutes || 0), 0)
      cumulativeDone += doneToday
      const idealRemaining = Math.max(0, totalMinutes - (totalMinutes / totalDays) * dayIndex)
      days.push({
        day: dayStr.slice(5),
        Ideal: Math.round(idealRemaining / 60 * 10) / 10,
        Actual: dayStr <= todayStr ? Math.round(Math.max(0, totalMinutes - cumulativeDone) / 60 * 10) / 10 : null,
      })
      dayIndex++
      d.setDate(d.getDate() + 1)
    }

    setBurndownData((prev) => ({ ...prev, [sprint.id]: days }))
  }

  useEffect(() => {
    for (const s of sprints) {
      if (expanded[s.id] && !burndownData[s.id]) loadBurndown(s)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, sprints, tasksBySprint])

  const handleDeleteSprint = async (sprint) => {
    if (confirm('Delete sprint "' + sprint.name + '"? Tasks will be unlinked, not deleted.')) {
      await deleteSprint(sprint.id)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Sprints</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Time-boxed goals with burndown tracking</p>
        </div>
        <button onClick={() => setCreateOpen((o) => !o)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus size={16} /> New Sprint
        </button>
      </div>

      {createOpen && (
        <div className="mb-5 space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
          <input value={newSprint.name} onChange={(e) => setNewSprint((s) => ({ ...s, name: e.target.value }))}
            placeholder="Sprint name (e.g. Sprint 1 - Auth)"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" />
          <input value={newSprint.goal} onChange={(e) => setNewSprint((s) => ({ ...s, goal: e.target.value }))}
            placeholder="Goal (optional)"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" />
          <div className="flex flex-wrap gap-2">
            <select value={newSprint.project_id} onChange={(e) => setNewSprint((s) => ({ ...s, project_id: e.target.value }))}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]">
              <option value="">No linked project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={newSprint.start_date} onChange={(e) => setNewSprint((s) => ({ ...s, start_date: e.target.value }))}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]" />
            <input type="date" value={newSprint.end_date} onChange={(e) => setNewSprint((s) => ({ ...s, end_date: e.target.value }))}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]" />
          </div>
          <button onClick={handleCreateSprint} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create Sprint
          </button>
        </div>
      )}

      {sprints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
          <Rocket size={28} className="mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-sm text-[var(--text-secondary)]">No sprints yet. Create one to time-box a goal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const sprintTasks = tasksBySprint[sprint.id] || []
            const done = sprintTasks.filter((t) => t.status === 'done').length
            const pct = sprintTasks.length ? Math.round((done / sprintTasks.length) * 100) : 0
            const isOpen = !!expanded[sprint.id]
            const proj = projectById[sprint.project_id]

            return (
              <div key={sprint.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleExpand(sprint.id)} className="text-[var(--text-secondary)]">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-medium text-[var(--text-primary)]">{sprint.name}</h3>
                      <span className="shrink-0 rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                        {sprint.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {sprint.start_date} → {sprint.end_date} {proj && `· ${proj.name}`} · {done}/{sprintTasks.length} done
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: pct + '%' }} />
                    </div>
                  </div>
                  <button onClick={() => handleDeleteSprint(sprint)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--border-color)] p-4">
                    {sprint.goal && <p className="text-sm text-[var(--text-secondary)]">🎯 {sprint.goal}</p>}

                    {burndownData[sprint.id] && (
                      <div className="rounded-lg border border-[var(--border-color)] p-3">
                        <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">Burndown (hours remaining)</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={burndownData[sprint.id]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="Ideal" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                            <Line type="monotone" dataKey="Actual" stroke="#4f46e5" strokeWidth={2} connectNulls={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {sprintTasks.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No tasks in this sprint yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {sprintTasks.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            category={categoryById[t.category_id]}
                            project={projectById[t.project_id]}
                            onEdit={() => {}}
                            onDelete={(task) => deleteTask(task.id)}
                            onToggleDone={(task) => updateTask(task.id, { status: task.status === 'done' ? 'pending' : 'done' })}
                          />
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleAddTask(sprint.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      <Plus size={14} /> Add task to sprint
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTask}
        categories={categories}
        initialTask={null}
        projects={projects}
      />
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
