import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from './useNotifications'

export function useGlobalNotifier() {
  const { user } = useAuth()
  const { fire } = useNotifications()
  const notifiedOverdueIds = useRef(new Set())

  // New Needs-Input conflicts -> notify immediately
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('global-conflict-notify')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'schedule_conflicts', filter: `user_id=eq.${user.id}` },
        (payload) => {
          fire('Needs your input', payload.new.ai_suggestion || 'A scheduling decision needs your input', 'conflict-' + payload.new.id)
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fire])

  // High-priority tasks that just became overdue -> notify as "Important"
  useEffect(() => {
    if (!user) return

    const check = async () => {
      const todayStr = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('tasks')
        .select('id, title, scheduled_end, status, priority')
        .eq('user_id', user.id)
        .eq('target_date', todayStr)
        .eq('priority', 'high')
        .in('status', ['pending', 'in_progress'])

      const now = Date.now()
      for (const task of data || []) {
        if (!task.scheduled_end) continue
        const overdueBy = now - new Date(task.scheduled_end).getTime()
        // more than 10 min overdue and not yet notified this session
        if (overdueBy > 10 * 60000 && !notifiedOverdueIds.current.has(task.id)) {
          notifiedOverdueIds.current.add(task.id)
          fire('⚠️ Important: overdue', `High-priority task "${task.title}" is overdue`, 'overdue-' + task.id)
        }
      }
    }

    check()
    const interval = setInterval(check, 5 * 60000) // every 5 min
    return () => clearInterval(interval)
  }, [user, fire])
}
