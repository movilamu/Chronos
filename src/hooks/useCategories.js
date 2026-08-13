import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let active = true
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data }) => {
        if (active) {
          setCategories(data || [])
          setLoading(false)
        }
      })

    const channel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setCategories((prev) => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new]
            if (payload.eventType === 'UPDATE')
              return prev.map((c) => (c.id === payload.new.id ? payload.new : c))
            if (payload.eventType === 'DELETE')
              return prev.filter((c) => c.id !== payload.old.id)
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [user])

  const addCategory = async (data) => {
    const { error } = await supabase.from('categories').insert({ ...data, user_id: user.id })
    return { error }
  }

  const updateCategory = async (id, updates) => {
    const { error } = await supabase.from('categories').update(updates).eq('id', id)
    return { error }
  }

  const deleteCategory = async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    return { error }
  }

  return { categories, loading, addCategory, updateCategory, deleteCategory }
}
