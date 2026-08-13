import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Check, Pencil, X, HelpCircle, CalendarClock } from 'lucide-react'
import { useConflicts } from '../hooks/useConflicts'
import { useCategories } from '../hooks/useCategories'
import { useTasks } from '../hooks/useTasks'
import { useScheduler } from '../hooks/useScheduler'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import TaskFormModal from '../components/TaskFormModal'

const TYPE_LABEL = {
  overload: "Won't fit before bedtime",
  time_overlap: 'Scheduling overlap',
  ambiguous_category: 'Unclear where this fits',
  voice_ambiguous: 'Unclear voice command',
  focus_classification: 'Is this focus work?',
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function NeedsInput() {
  const { user } = useAuth()
  const { conflicts, loading, resolveConflict } = useConflicts()
  const { categories } = useCategories()
  const { updateTask } = useTasks(null)
  const { planDay } = useScheduler()

  const [taskMap, setTaskMap] = useState({})
  const [editingTask, setEditingTask] = useState(null)

  const allTaskIds = useMemo(
    () => [...new Set(conflicts.flatMap((c) => c.task_ids || []))],
    [conflicts]
  )

  useEffect(() => {
    if (allTaskIds.length === 0) return
    supabase
      .from('tasks')
      .select('*')
      .in('id', allTaskIds)
      .then(({ data }) => {
        setTaskMap(Object.fromEntries((data || []).map((t) => [t.id, t])))
      })
  }, [allTaskIds.join(',')])

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  )

  const handleAcceptSuggestion = async (conflict) => {
    await resolveConflict(conflict.id, 'accepted_ai_suggestion')
    const firstTask = taskMap[conflict.task_ids[0]]
    if (firstTask) planDay(firstTask.target_date)
  }

  // Overflow tasks: "accept" here means push it to tomorrow, not just re-run the same plan
  const handleMoveTomorrow = async (conflict) => {
    const taskId = conflict.task_ids[0]
    const task = taskMap[taskId]
    if (!task) return
    const nextDate = addDays(task.target_date, 1)
    await updateTask(taskId, { target_date: nextDate, scheduled_start: null, scheduled_end: null })
    await resolveConflict(conflict.id, 'moved_to_tomorrow')
    planDay(nextDate)
  }

  const handleFocusAnswer = async (conflict, isFocus) => {
    const taskId = conflict.task_ids[0]
    const task = taskMap[taskId]
    if (!task) return
    await updateTask(taskId, { force_focus: isFocus })
    await resolveConflict(conflict.id, isFocus ? 'marked_focus' : 'marked_not_focus')
    planDay(task.target_date)
  }

  const handleDismiss = async (conflict) => {
    await resolveConflict(conflict.id, 'dismissed')
  }

  const handleEditManually = (taskId) => {
    setEditingTask(taskMap[taskId])
  }

  const handleSaveEdit = async (formData) => {
    const result = await updateTask(editingTask.id, formData)
    if (!result.error) {
      const related = conflicts.find((c) => c.task_ids.includes(editingTask.id))
      if (related) await resolveConflict(related.id, 'manual_edit')
      planDay(formData.target_date)
    }
    return result
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Needs Input</h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          Decisions the AI wasn't confident enough to make on its own
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      ) : conflicts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
          <Check size={28} className="mx-auto mb-2 text-green-500" />
          <p className="text-sm text-[var(--text-secondary)]">
            Nothing needs your attention right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((conflict) => {
            const isFocusQuestion = conflict.conflict_type === 'focus_classification'
            const isOverload = conflict.conflict_type === 'overload'

            return (
              <div
                key={conflict.id}
                className={
                  'rounded-xl border p-4 ' +
                  (isFocusQuestion ? 'border-brand-500/30 bg-brand-500/5' : 'border-amber-500/30 bg-amber-500/5')
                }
              >
                <div className="mb-2 flex items-center gap-2">
                  {isFocusQuestion ? (
                    <HelpCircle size={16} className="text-brand-600" />
                  ) : isOverload ? (
                    <CalendarClock size={16} className="text-amber-500" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-500" />
                  )}
                  <span className={'text-xs font-medium uppercase tracking-wide ' + (isFocusQuestion ? 'text-brand-600' : 'text-amber-600')}>
                    {TYPE_LABEL[conflict.conflict_type] || conflict.conflict_type}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {(conflict.task_ids || []).map((id) => {
                    const t = taskMap[id]
                    if (!t) return null
                    const cat = categoryById[t.category_id]
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                        style={{ borderColor: cat?.color_hex || '#94a3b8', color: cat?.color_hex || '#94a3b8' }}
                      >
                        {t.title}
                      </span>
                    )
                  })}
                </div>

                {conflict.ai_suggestion && (
                  <p className="mb-3 text-sm text-[var(--text-primary)]">
                    {isFocusQuestion ? conflict.ai_suggestion : <><span className="font-medium">AI suggests:</span> {conflict.ai_suggestion}</>}
                  </p>
                )}

                {isFocusQuestion ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleFocusAnswer(conflict, true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      <Check size={14} /> Yes, it's focus work
                    </button>
                    <button onClick={() => handleFocusAnswer(conflict, false)} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
                      <X size={14} /> No
                    </button>
                  </div>
                ) : isOverload ? (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleMoveTomorrow(conflict)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      <CalendarClock size={14} /> Move to tomorrow
                    </button>
                    {conflict.task_ids?.[0] && (
                      <button onClick={() => handleEditManually(conflict.task_ids[0])} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
                        <Pencil size={14} /> Edit manually
                      </button>
                    )}
                    <button onClick={() => handleDismiss(conflict)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                      <X size={14} /> Keep as-is
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleAcceptSuggestion(conflict)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      <Check size={14} /> Accept suggestion
                    </button>
                    {conflict.task_ids?.[0] && (
                      <button onClick={() => handleEditManually(conflict.task_ids[0])} className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
                        <Pencil size={14} /> Edit manually
                      </button>
                    )}
                    <button onClick={() => handleDismiss(conflict)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                      <X size={14} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <TaskFormModal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
        categories={categories}
        initialTask={editingTask}
      />
    </div>
  )
}
