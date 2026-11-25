import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { api, getToken, setToken, UNAUTHORIZED_EVENT } from '../lib/api'
import type { Role, User } from '../lib/types'

type ToastType = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  type: ToastType
}
interface ActionResult {
  ok: boolean
  message?: string
  user?: User | null
}

interface AppContextValue {
  user: User | null
  toasts: Toast[]
  notify: (message: string, type?: ToastType) => void
  dismiss: (id: number) => void
  login: (email: string, password: string) => Promise<ActionResult>
  register: (payload: Record<string, unknown>) => Promise<ActionResult>
  demoLogin: (role: Role) => Promise<ActionResult>
  logout: () => void
  setUser: (user: User | null) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const DEMO_ACCOUNTS: Record<Role, { email: string; password: string }> = {
  seller: { email: 'seller@demo.resourceai.in', password: 'demo123' },
  buyer: { email: 'buyer@demo.resourceai.in', password: 'demo123' },
  buyer_seller: { email: 'both@demo.resourceai.in', password: 'demo123' },
  admin: { email: 'admin@demo.resourceai.in', password: 'demo123' },
}

function storedUser(): User | null {
  try {
    const raw = localStorage.getItem('resource_ai_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

let toastId = 0

export function AppProvider({ children }: { children: ReactNode }) {
  // Never render a cached identity before /auth/me validates it. Otherwise a
  // tampered or stale localStorage user could drive owner-filtered displays.
  const [user, setUserState] = useState<User | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Validate persisted sessions on boot. Signed demo tokens can be rotated on
  // the server, so a stale localStorage session must not grant UI access.
  useEffect(() => {
    if (!getToken()) {
      if (storedUser()) {
        localStorage.removeItem('resource_ai_user')
        setUserState(null)
      }
      return
    }
    let alive = true
    api
      .get<{ user: User }>('/auth/me')
      .then((result) => {
        if (!alive) return
        setUserState(result.user)
        localStorage.setItem('resource_ai_user', JSON.stringify(result.user))
      })
      .catch(() => {
        if (!alive) return
        setToken(null)
        localStorage.removeItem('resource_ai_user')
        setUserState(null)
      })
    return () => {
      alive = false
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = ++toastId
      setToasts((current) => [...current, { id, message, type }])
      window.setTimeout(() => dismiss(id), 4800)
    },
    [dismiss],
  )

  useEffect(() => {
    const handleUnauthorized = () => {
      setUserState(null)
      notify('Your session is no longer valid. Please sign in again.', 'error')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [notify])

  const applySession = useCallback((payload: { user: User; token: string }) => {
    setToken(payload.token)
    localStorage.setItem('resource_ai_user', JSON.stringify(payload.user))
    setUserState(payload.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<ActionResult> => {
      try {
        const result = await api.post<{ user: User; token: string }>('/auth/login', { email, password })
        applySession(result)
        notify(`Signed in as ${result.user.full_name}`)
        return { ok: true, user: result.user }
      } catch (error) {
        return { ok: false, message: (error as Error).message }
      }
    },
    [applySession, notify],
  )

  const register = useCallback(
    async (payload: Record<string, unknown>): Promise<ActionResult> => {
      try {
        const result = await api.post<{ user: User; token: string }>('/auth/register', payload)
        applySession(result)
        notify('Account created. Your free trial is active.')
        return { ok: true, user: result.user }
      } catch (error) {
        return { ok: false, message: (error as Error).message }
      }
    },
    [applySession, notify],
  )

  const demoLogin = useCallback(
    async (role: Role) => login(DEMO_ACCOUNTS[role].email, DEMO_ACCOUNTS[role].password),
    [login],
  )

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem('resource_ai_user')
    setUserState(null)
    notify('Signed out.', 'info')
  }, [notify])

  const setUser = useCallback((next: User | null) => {
    setUserState(next)
    if (next) localStorage.setItem('resource_ai_user', JSON.stringify(next))
    else localStorage.removeItem('resource_ai_user')
  }, [])

  const value = useMemo(
    () => ({ user, toasts, notify, dismiss, login, register, demoLogin, logout, setUser }),
    [user, toasts, notify, dismiss, login, register, demoLogin, logout, setUser],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertTriangle : Info
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-soft animate-fade-up ${
                toast.type === 'error' ? 'border-red-200' : toast.type === 'info' ? 'border-blue-200' : 'border-forest-200'
              }`}
            >
              <Icon
                size={18}
                className={`mt-0.5 shrink-0 ${
                  toast.type === 'error' ? 'text-red-600' : toast.type === 'info' ? 'text-blue-600' : 'text-forest-600'
                }`}
              />
              <p className="flex-1 text-sm leading-relaxed text-ink-800">{toast.message}</p>
              <button onClick={() => dismiss(toast.id)} className="text-slate-400 hover:text-ink-900" aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
