import { useEffect, useRef, useCallback, useState } from 'react'

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const scheduledTimers = useRef(new Map())

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  // Robust fire: waits for an ACTIVE service worker (not just registered), and
  // falls back to a plain Notification if the SW path fails for any reason.
  // The previous version silently no-op'd if reg.active wasn't ready yet -
  // that was the root cause of "notifications not coming".
  const fire = useCallback(async (title, body, tag) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        if (reg?.active) {
          reg.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options: { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', renotify: true },
          })
          return
        }
      }
      new Notification(title, { body, tag, icon: '/icon-192.png' })
    } catch {
      try {
        new Notification(title, { body, tag, icon: '/icon-192.png' })
      } catch {
        // Notifications genuinely unavailable, nothing more we can do
      }
    }
  }, [])

  const scheduleTaskReminders = useCallback(
    (tasks) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      for (const task of tasks) {
        if (task.status === 'done' || !task.scheduled_start) continue
        const key = task.id + '-start'
        if (scheduledTimers.current.has(key)) continue

        const startTime = new Date(task.scheduled_start).getTime()
        const reminderTime = startTime - 5 * 60000
        const delay = reminderTime - Date.now()

        if (delay > 0 && delay < 24 * 60 * 60000) {
          const timeoutId = setTimeout(() => {
            fire('Starting soon', `"${task.title}" starts in 5 minutes`, key)
            scheduledTimers.current.delete(key)
          }, delay)
          scheduledTimers.current.set(key, timeoutId)
        }
      }
    },
    [fire]
  )

  useEffect(() => {
    return () => {
      for (const id of scheduledTimers.current.values()) clearTimeout(id)
    }
  }, [])

  return { permission, requestPermission, fire, scheduleTaskReminders }
}
