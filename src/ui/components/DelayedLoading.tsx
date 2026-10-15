import { useEffect, useState } from 'react'

/** Kurze lokale Lesevorgänge bleiben ruhig; langsame bekommen eine Rückmeldung. */
export function DelayedLoading({ children }: { children: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 200)
    return () => window.clearTimeout(timer)
  }, [])
  return visible ? <p role="status" className="loading-notice py-4 text-body text-ink-muted">{children}</p> : null
}
