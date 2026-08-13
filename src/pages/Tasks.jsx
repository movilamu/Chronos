import { useState, useMemo } from 'react'
import { Plus, Filter } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useCategories } from '../hooks/useCategories'
import { useProjects } from '../hooks/useProjects'
import { useSprints } from '../hooks/useSprints'
import { useScheduler } from '../hooks/useScheduler'
import TaskCard from '../components/TaskCard'
import TaskFormModal from '../components/TaskFormModal'
import HoursWorkedModal from '../components/HoursWorkedModal'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Done' },
]

export default function Tasks() {
  const { user } = useAuth()
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks(null)
  const { categories } = useCategories()
  const { projects } = useProjects()
  const { sprints } = useSprints()
  const { planDay, planning } = useScheduler()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [statusFilter, setStatusFilter] = useState('today')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [hoursModalTask, setHoursModalTask] = useState(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    if (statusFilter === 'today') {
      result = result.filter((t) => t.target_date === todayStr && t.status !== 'done')
    } else if (statusFilter === 'upcoming') {
      result = result.filter((t) => t.target_date > todayStr && t.status !== 'done')
    } else if (statusFilter === 'overdue') {
      result = result.filter((t) => t.target_date < todayStr && t.status !== 'done')
    } else if (statusFilter === 'done') {
      result = result.filter((t) => t.status === 'done')
    } else if (statusFilter === 'all') {
      // "All" still means all active tasks, not a dump including completed ones
      result = result.filter((t) => t.status !== 'done')
    }

    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category_id === categoryFilter)
    }

    return result.sort((a, b) => {
      if (a.target_date !== b.target_date) return a.target_date.localeCompare(b.target_date)
      return (a.scheduled_start || '').localeCompare(b.scheduled_start || '')
    })
  }, [tasks, statusFilter, categoryFilter, todayStr])

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  )
  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  const openNewTask = () => {
    setEditingTask(null)
    setModalOpen(true)
  }

  const openEditTask = (task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleSave = async (formData) => {
    let result
    if (editingTask) {
      result = await updateTask(editingTask.id, formData)
    } else {
      result = await addTask({ ...formData, status: 'pending', source: 'manual' })
    }
    if (!result.error) {
      // Re-plan only the affected date, only touching remaining/unfinished tasks
      planDay(formData.target_date)
    }
    return result
  }

  const handleDelete = async (task) => {
    if (confirm('Delete "' + task.title + '"?')) {
      await deleteTask(task.id)
    }
  }

  const handleToggleDone = async (task) => {
    if (task.status === 'done') {
      await updateTask(task.id, { status: 'pending' })
      return
    }
    setHoursModalTask(task)
  }

  const confirmHoursAndComplete = async (actualMinutes, completedDate) => {
    const task = hoursModalTask
    setHoursModalTask(null)
    const dateStr = completedDate || new Date().toISOString().slice(0, 10)
    const completedAt = new Date(dateStr + 'T' + new Date().toTimeString().slice(0, 8)).toISOString()
    await updateTask(task.id, { status: 'done', actual_hours: (actualMinutes / 60).toFixed(2) })
    await supabase.from('time_logs').insert({
      task_id: task.id,
      user_id: user.id,
      actual_start: task.scheduled_start || completedAt,
      actual_end: completedAt,
      actual_duration_minutes: actualMinutes,
    })
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Tasks</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            {planning && <span className="ml-2 text-brand-600">• AI planning your day...</span>}
          </p>
        </div>
        <button
          onClick={openNewTask}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              statusFilter === f.value
                ? 'bg-brand-600 text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-[var(--text-secondary)]" />
        <button
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            categoryFilter === 'all'
              ? 'border-brand-600 text-brand-600'
              : 'border-[var(--border-color)] text-[var(--text-secondary)]'
          }`}
        >
          All categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{
              borderColor: categoryFilter === cat.id ? cat.color_hex : 'var(--border-color)',
              color: categoryFilter === cat.id ? cat.color_hex : 'var(--text-secondary)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color_hex }} />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No tasks here. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              category={categoryById[task.category_id]}
              project={projectById[task.project_id]}
              onEdit={openEditTask}
              onDelete={handleDelete}
              onToggleDone={handleToggleDone}
            />
          ))}
        </div>
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        categories={categories}
        projects={projects}
        sprints={sprints}
        initialTask={editingTask}
      />

      <HoursWorkedModal
        open={!!hoursModalTask}
        task={hoursModalTask}
        onConfirm={confirmHoursAndComplete}
        onClose={() => setHoursModalTask(null)}
      />
    </div>
  )
}
