import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useProjects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
        () => fetchProjects()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fetchProjects])

  const addProject = async (project) => {
    const { error } = await supabase.from('projects').insert({ ...project, user_id: user.id })
    return { error }
  }

  const updateProject = async (id, updates) => {
    const { error } = await supabase.from('projects').update(updates).eq('id', id)
    return { error }
  }

  const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    return { error }
  }

  return { projects, loading, addProject, updateProject, deleteProject }
}
