import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function useRecurringTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('recurring-templates-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${user.id}` },
        () => fetchTemplates()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fetchTemplates])

  const addTemplate = async (data) => {
    const { error } = await supabase.from('recurring_templates').insert({ ...data, user_id: user.id })
    return { error }
  }

  const deleteTemplate = async (id) => {
    const { error } = await supabase.from('recurring_templates').delete().eq('id', id)
    return { error }
  }

  const toggleActive = async (id, active) => {
    await supabase.from('recurring_templates').update({ active }).eq('id', id)
  }

  return { templates, loading, addTemplate, deleteTemplate, toggleActive }
}

// Call once per app load: creates today's task instance for any active
// recurring template scheduled for today's weekday, if not already created.
export async function materializeTodaysRecurringTasks(userId) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayAbbr = DAY_ABBR[new Date().getDay()]

  const { data: templates } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .contains('days', [todayAbbr])

  if (!templates || templates.length === 0) return

  const { data: existing } = await supabase
    .from('tasks')
    .select('recurrence_template_id')
    .eq('user_id', userId)
    .eq('target_date', todayStr)
    .not('recurrence_template_id', 'is', null)

  const existingIds = new Set((existing || []).map((t) => t.recurrence_template_id))

  const toCreate = templates.filter((t) => !existingIds.has(t.id))
  if (toCreate.length === 0) return

  await supabase.from('tasks').insert(
    toCreate.map((t) => ({
      user_id: userId,
      title: t.title,
      duration_minutes: t.duration_minutes,
      priority: t.priority,
      category_id: t.category_id,
      preferred_time: t.preferred_time,
      target_date: todayStr,
      status: 'pending',
      source: 'ai',
      recurrence_template_id: t.id,
    }))
  )
}
