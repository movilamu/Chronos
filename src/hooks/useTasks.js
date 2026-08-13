import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useTasks(dateFilter) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    if (!user) return
    let query = supabase.from('tasks').select('*').eq('user_id', user.id)
    if (dateFilter) query = query.eq('target_date', dateFilter)
    query = query.order('scheduled_start', { ascending: true, nullsFirst: false })
    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }, [user, dateFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        () => {
          // Simplest reliable approach across devices: re-fetch on any change
          fetchTasks()
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, fetchTasks])

  const addTask = async (task) => {
    const { error } = await supabase.from('tasks').insert({
      ...task,
      user_id: user.id,
    })
    return { error }
  }

  const updateTask = async (id, updates) => {
    const { error } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    return { error }
  }

  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    return { error }
  }

  return { tasks, loading, addTask, updateTask, deleteTask, refetch: fetchTasks }
}
