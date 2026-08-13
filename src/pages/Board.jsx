import { useState, useMemo } from 'react'
import { Plus, GripVertical } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useCategories } from '../hooks/useCategories'
import { useProjects } from '../hooks/useProjects'
import { useSprints } from '../hooks/useSprints'
import { useScheduler } from '../hooks/useScheduler'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import TaskFormModal from '../components/TaskFormModal'
import HoursWorkedModal from '../components/HoursWorkedModal'

const COLUMNS = [
  { status: 'pending', title: 'To Do', color: '#6b7280' },
  { status: 'in_progress', title: 'In Progress', color: '#3b82f6' },
  { status: 'waiting_for', title: 'Waiting For', color: '#f59e0b' },
  { status: 'done', title: 'Done', color: '#22c55e' },
]

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' }

export default function Board() {
  const { user } = useAuth()
  const { tasks, addTask, updateTask, deleteTask } = useTasks(null)
  const { categories } = useCategories()
  const { projects } = useProjects()
  const { sprints } = useSprints()
  const { planDay } = useScheduler()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [newTaskStatus, setNewTaskStatus] = useState('pending')
  const [dragOverCol, setDragOverCol] = useState(null)
  const [hoursModalTask, setHoursModalTask] = useState(null)

  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])

  const tasksByStatus = useMemo(() => {
    const map = { pending: [], in_progress: [], waiting_for: [], done: [] }
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t)
    }
    return map
  }, [tasks])

  const openNewTask = (status) => {
    setEditingTask(null)
    setNewTaskStatus(status)
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
      result = await addTask({ ...formData, status: newTaskStatus, source: 'manual' })
    }
    if (!result.error) planDay(formData.target_date)
    return result
  }

  const handleDrop = async (status, e) => {
    e.preventDefault()
    setDragOverCol(null)
    const taskId = e.dataTransfer.getData('text/plain')
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return

    if (status === 'done') {
      setHoursModalTask(task)
      return
    }
    await updateTask(taskId, { status })
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
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Board</h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          Drag tasks between columns to update their status
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(col.status, e)}
            className={
              'flex min-h-[400px] flex-col rounded-xl border bg-[var(--bg-tertiary)]/40 p-3 transition ' +
              (dragOverCol === col.status ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/10' : 'border-[var(--border-color)]')
            }
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{col.title}</h2>
                <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
                  {tasksByStatus[col.status].length}
                </span>
              </div>
              <button
                onClick={() => openNewTask(col.status)}
                className="text-[var(--text-secondary)] hover:text-brand-600"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              {tasksByStatus[col.status].map((task) => {
                const cat = categoryById[task.category_id]
                const proj = projectById[task.project_id]
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                    onClick={() => openEditTask(task)}
                    className="cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 shadow-sm hover:shadow-md"
                    style={{ borderLeftWidth: 3, borderLeftColor: cat?.color_hex || '#94a3b8' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={'text-sm font-medium text-[var(--text-primary)]' + (task.status === 'done' ? ' line-through opacity-60' : '')}>
                        {task.title}
                      </p>
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span style={{ color: cat?.color_hex }}>{cat?.name || 'Uncategorized'}</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                      <span>{Math.floor(task.duration_minutes / 60)}h {task.duration_minutes % 60}m</span>
                      {task.scheduled_start && (
                        <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-medium text-[var(--text-primary)]">
                          {new Date(task.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                    </div>
                    {proj && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium" style={{ color: proj.color_hex }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: proj.color_hex }} />
                        {proj.name}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        categories={categories}
        initialTask={editingTask}
        projects={projects}
        sprints={sprints}
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
