import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useScheduler() {
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState(null)

  const planDay = async (targetDate) => {
    setPlanning(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('plan-day', {
        body: { target_date: targetDate },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      return data // { scheduled: [...], conflicts: [...] }
    } catch (err) {
      setError(err.message)
      return { error: err.message }
    } finally {
      setPlanning(false)
    }
  }

  return { planDay, planning, error }
}
