import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Returns raw logs joined with task title/category_id, for a given day range
export function useTimeLogs(daysBack = 7) {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true

    const since = new Date()
    since.setDate(since.getDate() - daysBack)

    supabase
      .from('time_logs')
      .select('id, actual_start, actual_end, actual_duration_minutes, task_id, tasks(title, category_id, priority)')
      .eq('user_id', user.id)
      .gte('actual_end', since.toISOString())
      .order('actual_end', { ascending: true })
      .then(({ data }) => {
        if (active) {
          setLogs(data || [])
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [user, daysBack])

  return { logs, loading }
}
