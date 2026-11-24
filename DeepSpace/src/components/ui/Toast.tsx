/**
 * Toast Notification System
 *
 * Self-contained toast provider with success/error/warning/info variants.
 * Uses the theme's semantic color tokens (success, warning, info, destructive).
 *
 * @example
 * // Wrap your app once:
 * <ToastProvider position="bottom-right">
 *   <App />
 * </ToastProvider>
 *
 * // In any child component:
 * const { success, error, warning, info } = useToast()
 * success('Saved!', 'Your changes have been saved.')
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'

// ============================================================================
// Types
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (options: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

// ============================================================================
// Icons (inline SVGs — no external dependency)
// ============================================================================

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ============================================================================
// ToastProvider
// ============================================================================

interface ToastProviderProps {
  children: ReactNode
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center'
  maxToasts?: number
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
}: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const addToast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      const duration = options.duration ?? 4000

      setToasts((prev) => {
        const next = [...prev, { ...options, id, duration }]
        return next.slice(-maxToasts)
      })
    },
    [maxToasts],
  )

  const toast = useCallback(
    (options: Omit<Toast, 'id'>) => addToast(options),
    [addToast],
  )
  const success = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'success', title, description }),
    [addToast],
  )
  const error = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'error', title, description }),
    [addToast],
  )
  const warning = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'warning', title, description }),
    [addToast],
  )
  const info = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'info', title, description }),
    [addToast],
  )

  const positionClasses: Record<string, string> = {
    'top-right': 'toast-position-top-right',
    'top-left': 'toast-position-top-left',
    'bottom-right': 'toast-position-bottom-right',
    'bottom-left': 'toast-position-bottom-left',
    'top-center': 'toast-position-top-center',
    'bottom-center': 'toast-position-bottom-center',
  }

  return (
    <ToastContext.Provider
      value={{ toasts, toast, success, error, warning, info, dismiss, dismissAll }}
    >
      {children}

      {/* Toast viewport. `pointer-events-none` is load-bearing: this is a
          fixed z-100 layer over one corner of every page, so without it the
          container (and every toast in it) silently eats clicks on whatever
          sits underneath. Each toast re-enables events for itself. */}
      <div className={`toast-viewport ${positionClasses[position]}`} role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ============================================================================
// ToastItem
// ============================================================================

/**
 * Per-type visual config. Body uses the neutral popover surface — the type
 * is conveyed by a thin colored left-edge accent and the icon glyph alone,
 * not by tinting the title text or stamping a chunky colored block behind
 * the icon. Cleaner read; doesn't compete with the page underneath.
 */
const TOAST_CONFIG = {
  success: { Icon: CheckCircleIcon, accent: 'bg-success', icon: 'text-success' },
  error:   { Icon: AlertCircleIcon, accent: 'bg-destructive', icon: 'text-destructive' },
  warning: { Icon: AlertTriangleIcon, accent: 'bg-warning', icon: 'text-warning' },
  info:    { Icon: InfoIcon, accent: 'bg-info', icon: 'text-info' },
} as const

interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactElement {
  const { Icon, accent, icon } = TOAST_CONFIG[toast.type]
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return
    const timer = setTimeout(() => setExiting(true), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration])

  // Animate out before removing.
  useEffect(() => {
    if (exiting) {
      const timer = setTimeout(onDismiss, 150)
      return () => clearTimeout(timer)
    }
  }, [exiting, onDismiss])

  return (
    <div
      className={`toast-item ${exiting ? 'toast-item--exiting' : ''}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      {/* Colored left-edge accent — the only chrome that reflects the type. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} aria-hidden />
      <Icon className={`toast-icon ${icon}`} aria-hidden="true" />
      <div className="toast-copy">
        <p className="toast-title">{toast.title}</p>
        {toast.description && (
          <p className="toast-description">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => setExiting(true)}
        className="toast-dismiss"
        aria-label="Dismiss notification"
      >
        <CloseIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
