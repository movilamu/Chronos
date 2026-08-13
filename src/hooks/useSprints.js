import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useSprints() {
  const { user } = useAuth()
  const [sprints, setSprints] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSprints = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('sprints')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
    setSprints(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSprints()
  }, [fetchSprints])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('sprints-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `user_id=eq.${user.id}` }, () => fetchSprints())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fetchSprints])

  const addSprint = async (data) => {
    const { error } = await supabase.from('sprints').insert({ ...data, user_id: user.id })
    return { error }
  }

  const updateSprint = async (id, updates) => {
    const { error } = await supabase.from('sprints').update(updates).eq('id', id)
    return { error }
  }

  const deleteSprint = async (id) => {
    const { error } = await supabase.from('sprints').delete().eq('id', id)
    return { error }
  }

  return { sprints, loading, addSprint, updateSprint, deleteSprint }
}
