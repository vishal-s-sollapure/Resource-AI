// Same-origin by default in dev, preview and same-origin deployments. Set
// VITE_API_BASE_URL to the deployed API URL when frontend and backend are on
// different origins (for example Vercel frontend + Render backend).
const DEFAULT_BASE = '/api'
const BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '')
const TOKEN_KEY = 'resource_ai_token'
export const UNAUTHORIZED_EVENT = 'resource-ai:unauthorized'

let token = localStorage.getItem(TOKEN_KEY) || ''

export function setToken(value: string | null) {
  token = value || ''
  if (value) localStorage.setItem(TOKEN_KEY, value)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return token
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new Error('Cannot reach the ReSource AI API. Start the backend with uvicorn (see README).')
  }
  if (response.status === 401 && token) {
    // A stale signed token must never fall back to another demo identity.
    setToken(null)
    localStorage.removeItem('resource_ai_user')
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.detail || body.message || message
    } catch {
      /* keep the generic message */
    }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return response.json() as Promise<T>
}

const body = (data: unknown): RequestInit => ({ body: JSON.stringify(data) })

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown = {}) => request<T>(path, { method: 'POST', ...body(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', ...body(data) }),
  patch: <T>(path: string, data: unknown = {}) => request<T>(path, { method: 'PATCH', ...body(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
