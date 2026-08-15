import { useEffect, useRef, useCallback, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const isNative = Capacitor.isNativePlatform()

// Local notification IDs must be 32-bit ints. Derive a stable one from a string tag.
function idFromTag(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0
  }
  return Math.abs(hash) || 1
}

export function useNotifications() {
  const [permission, setPermission] = useState(
    isNative ? 'default' : (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  )
  const scheduledTimers = useRef(new Map())

  useEffect(() => {
    if (isNative) {
      LocalNotifications.checkPermissions().then((res) => {
        setPermission(res.display === 'granted' ? 'granted' : res.display === 'denied' ? 'denied' : 'default')
      })
      return
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (isNative) {
      const res = await LocalNotifications.requestPermissions()
      const granted = res.display === 'granted' ? 'granted' : res.display === 'denied' ? 'denied' : 'default'
      setPermission(granted)
      return granted
    }
    if (typeof Notification === 'undefined') return 'unsupported'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  // Fires an immediate notification "now". On native, schedules with no delay
  // (still goes through the OS tray, and works even if the app is backgrounded
  // since it's an OS-level local notification, not a JS timer).
  const fire = useCallback(async (title, body, tag) => {
    if (isNative) {
      if (permission !== 'granted') return
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: idFromTag(tag || title),
              title,
              body,
              schedule: { at: new Date(Date.now() + 500) },
            },
          ],
        })
      } catch {
        // ignore - non-fatal
      }
      return
    }

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
  }, [permission])

  // Schedules "starts in 5 minutes" reminders for upcoming tasks.
  // On native: uses real OS-scheduled local notifications, so they fire
  // even if Chronos is fully closed/backgrounded - not just a JS setTimeout.
  // On web: keeps the original setTimeout approach (only fires while the
  // tab/PWA is open, which is the ceiling of what browsers allow).
  const scheduleTaskReminders = useCallback(
    (tasks) => {
      if (isNative) {
        if (permission !== 'granted') return
        const toSchedule = []
        for (const task of tasks) {
          if (task.status === 'done' || !task.scheduled_start) continue
          const startTime = new Date(task.scheduled_start).getTime()
          const reminderTime = startTime - 5 * 60000
          if (reminderTime > Date.now() && reminderTime < Date.now() + 24 * 60 * 60000) {
            toSchedule.push({
              id: idFromTag(task.id + '-start'),
              title: 'Starting soon',
              body: `"${task.title}" starts in 5 minutes`,
              schedule: { at: new Date(reminderTime) },
            })
          }
        }
        if (toSchedule.length > 0) {
          LocalNotifications.schedule({ notifications: toSchedule }).catch(() => {})
        }
        return
      }

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
    [fire, permission]
  )

  useEffect(() => {
    return () => {
      for (const id of scheduledTimers.current.values()) clearTimeout(id)
    }
  }, [])

  return { permission, requestPermission, fire, scheduleTaskReminders }
}
