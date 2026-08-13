import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useConflicts() {
  const { user } = useAuth()
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchConflicts = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('schedule_conflicts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setConflicts(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchConflicts()
  }, [fetchConflicts])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('conflicts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_conflicts', filter: `user_id=eq.${user.id}` },
        () => fetchConflicts()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fetchConflicts])

  const resolveConflict = async (id, decision) => {
    await supabase
      .from('schedule_conflicts')
      .update({ status: 'resolved', user_decision: decision, resolved_at: new Date().toISOString() })
      .eq('id', id)
  }

  return { conflicts, loading, resolveConflict, refetch: fetchConflicts }
}
