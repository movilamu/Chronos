import { useState, useEffect, useMemo, useRef } from 'react'
import { Sparkles, Loader2, Plus } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useCategories } from '../hooks/useCategories'
import { useProjects } from '../hooks/useProjects'
import { useScheduler } from '../hooks/useScheduler'
import { useNotifications } from '../hooks/useNotifications'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import TaskCard from '../components/TaskCard'
import TaskFormModal from '../components/TaskFormModal'
import CheckInModal from '../components/CheckInModal'
import AdjustPrompt from '../components/AdjustPrompt'
import HoursWorkedModal from '../components/HoursWorkedModal'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Today() {
  const { user } = useAuth()
  const date = todayStr()
  const { tasks, updateTask, addTask, deleteTask } = useTasks(date)
  const { categories } = useCategories()
  const { projects } = useProjects()
  const { planDay, planning } = useScheduler()
  const { permission, requestPermission, fire, scheduleTaskReminders } = useNotifications()

  const [now, setNow] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [checkInTask, setCheckInTask] = useState(null)
  const [adjustPromptOpen, setAdjustPromptOpen] = useState(false)
  const [hoursModalTask, setHoursModalTask] = useState(null)
  const notifiedIds = useRef(new Set())

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  )
  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  useEffect(() => {
    if (permission === 'default') requestPermission()
  }, [permission, requestPermission])

  useEffect(() => {
    scheduleTaskReminders(tasks)
  }, [tasks, scheduleTaskReminders])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (checkInTask) return
    const overdue = tasks.find(
      (t) =>
        t.status === 'pending' &&
        t.scheduled_end &&
        new Date(t.scheduled_end) <= now &&
        !notifiedIds.current.has(t.id)
    )
    if (overdue) {
      notifiedIds.current.add(overdue.id)
      setCheckInTask(overdue)
      fire('Time check', `Did you finish "${overdue.title}"?`, 'checkin-' + overdue.id)
    }
  }, [tasks, now, checkInTask])

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.scheduled_start || '').localeCompare(b.scheduled_start || '')),
    [tasks]
  )

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  const currentTask = sortedTasks.find(
    (t) =>
      t.scheduled_start &&
      t.scheduled_end &&
      new Date(t.scheduled_start) <= now &&
      new Date(t.scheduled_end) > now &&
      t.status !== 'done'
  )

  const handlePlanDay = () => planDay(date)

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
      result = await addTask({ ...formData, target_date: date, status: 'pending', source: 'manual' })
    }
    if (!result.error) planDay(formData.target_date)
    return result
  }

  const handleDelete = async (task) => {
    if (confirm('Delete "' + task.title + '"?')) await deleteTask(task.id)
  }

  // Every "mark done" action now asks for actual hours worked (feeds Reports accurately)
  const requestDone = (task) => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'pending' })
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

  const handleCheckInDone = async () => {
    setHoursModalTask(checkInTask)
    setCheckInTask(null)
  }

  const handleCheckInExtend = async () => {
    const newEnd = new Date(new Date(checkInTask.scheduled_end).getTime() + 10 * 60000)
    await updateTask(checkInTask.id, { scheduled_end: newEnd.toISOString(), status: 'in_progress' })
    notifiedIds.current.delete(checkInTask.id)
    setCheckInTask(null)
    setAdjustPromptOpen(true)
  }

  const handleCheckInSomethingElse = async () => {
    await updateTask(checkInTask.id, { status: 'moved' })
    setCheckInTask(null)
    setAdjustPromptOpen(true)
  }

  const handleAdjustYes = () => {
    setAdjustPromptOpen(false)
    planDay(date)
  }

  const handleAdjustNo = () => setAdjustPromptOpen(false)

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Today</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePlanDay}
            disabled={planning}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3.5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
          >
            {planning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {planning ? 'Planning...' : 'Re-plan day'}
          </button>
          <button
            onClick={openNewTask}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {permission === 'denied' && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          Notifications are blocked. Enable them in your browser's site settings to get task reminders.
        </div>
      )}

      <div className="mb-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-[var(--text-primary)]">
            {doneCount} of {tasks.length} tasks done
          </span>
          <span className="text-[var(--text-secondary)]">{progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: progressPct + '%' }} />
        </div>
      </div>

      {currentTask && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Happening now
          </p>
          <TaskCard
            task={currentTask}
            category={categoryById[currentTask.category_id]}
            project={projectById[currentTask.project_id]}
            onEdit={openEditTask}
            onDelete={handleDelete}
            onToggleDone={requestDone}
          />
        </div>
      )}

      {sortedTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No tasks planned for today yet. Add a few, then hit "Re-plan day."
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTasks
            .filter((t) => t.id !== currentTask?.id)
            .map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                category={categoryById[task.category_id]}
                project={projectById[task.project_id]}
                onEdit={openEditTask}
                onDelete={handleDelete}
                onToggleDone={requestDone}
              />
            ))}
        </div>
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        categories={categories}
        initialTask={editingTask}
        projects={projects}
      />

      <CheckInModal
        open={!!checkInTask}
        task={checkInTask}
        onDone={handleCheckInDone}
        onExtend={handleCheckInExtend}
        onSomethingElse={handleCheckInSomethingElse}
        onClose={() => setCheckInTask(null)}
      />

      <AdjustPrompt open={adjustPromptOpen} onYes={handleAdjustYes} onNo={handleAdjustNo} />

      <HoursWorkedModal
        open={!!hoursModalTask}
        task={hoursModalTask}
        onConfirm={confirmHoursAndComplete}
        onClose={() => setHoursModalTask(null)}
      />
    </div>
  )
}
