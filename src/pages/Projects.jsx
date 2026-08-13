import { useState, useMemo } from 'react'
import { Plus, FolderKanban, ChevronDown, ChevronRight, Trash2, Pencil } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useCategories } from '../hooks/useCategories'
import { useScheduler } from '../hooks/useScheduler'
import ProjectFormModal from '../components/ProjectFormModal'
import TaskFormModal from '../components/TaskFormModal'
import TaskCard from '../components/TaskCard'

export default function Projects() {
  const { projects, addProject, updateProject, deleteProject } = useProjects()
  const { tasks, addTask, updateTask, deleteTask } = useTasks(null)
  const { categories } = useCategories()
  const { planDay } = useScheduler()

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [expanded, setExpanded] = useState({})

  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const tasksByProject = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (!t.project_id) continue
      if (!map[t.project_id]) map[t.project_id] = []
      map[t.project_id].push(t)
    }
    return map
  }, [tasks])

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const openNewProject = () => {
    setEditingProject(null)
    setProjectModalOpen(true)
  }

  const openAddSubtask = (projectId) => {
    setActiveProjectId(projectId)
    setTaskModalOpen(true)
  }

  const handleSaveProject = async (data) => {
    if (editingProject) return await updateProject(editingProject.id, data)
    return await addProject(data)
  }

  const handleSaveTask = async (formData) => {
    const result = await addTask({ ...formData, status: 'pending', source: 'manual' })
    if (!result.error) planDay(formData.target_date)
    return result
  }

  const handleDeleteProject = async (project) => {
    if (confirm('Delete project "' + project.name + '"? Subtasks will be unlinked, not deleted.')) {
      await deleteProject(project.id)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Projects</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Big goals broken into tasks
          </p>
        </div>
        <button
          onClick={openNewProject}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-10 text-center">
          <FolderKanban size={28} className="mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            No projects yet. Create one to break a big goal into tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const subtasks = tasksByProject[project.id] || []
            const done = subtasks.filter((t) => t.status === 'done').length
            const pct = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0
            const isOpen = !!expanded[project.id]

            return (
              <div key={project.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]" style={{ borderLeftWidth: 4, borderLeftColor: project.color_hex }}>
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleExpand(project.id)} className="text-[var(--text-secondary)]">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-medium text-[var(--text-primary)]">{project.name}</h3>
                      <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                        {done}/{subtasks.length} done
                      </span>
                    </div>
                    {project.description && (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{project.description}</p>
                    )}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: pct + '%', backgroundColor: project.color_hex }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => { setEditingProject(project); setProjectModalOpen(true) }} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDeleteProject(project)} className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-2 border-t border-[var(--border-color)] p-4">
                    {subtasks.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No subtasks yet.</p>
                    ) : (
                      subtasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          category={categoryById[t.category_id]}
                          onEdit={() => {}}
                          onDelete={(task) => deleteTask(task.id)}
                          onToggleDone={(task) => updateTask(task.id, { status: task.status === 'done' ? 'pending' : 'done' })}
                        />
                      ))
                    )}
                    <button
                      onClick={() => openAddSubtask(project.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      <Plus size={14} /> Add subtask
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ProjectFormModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSave={handleSaveProject}
        initialProject={editingProject}
      />

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTask}
        categories={categories}
        initialTask={null}
        defaultProjectId={activeProjectId}
      />
    </div>
  )
}
