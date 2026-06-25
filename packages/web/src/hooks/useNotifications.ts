import { useCallback, useEffect, useRef } from 'react'

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      permissionRef.current = Notification.permission
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false
    if (permissionRef.current === 'granted') return true
    if (permissionRef.current === 'denied') return false

    const permission = await Notification.requestPermission()
    permissionRef.current = permission
    return permission === 'granted'
  }, [])

  const notify = useCallback((
    title: string,
    options?: NotificationOptions & { onClick?: () => void },
  ) => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return

    const { onClick, ...notifOptions } = options ?? {}
    const n = new Notification(title, notifOptions)

    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
  }, [])

  return { requestPermission, notify }
}
