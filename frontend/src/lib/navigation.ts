import type { Role } from './types'

/** The workspace each role should land on after authentication. */
export function dashboardPath(role?: Role | null): string {
  switch (role) {
    case 'seller':
      return '/seller'
    case 'admin':
      return '/admin'
    case 'buyer':
    case 'buyer_seller':
    default:
      return '/buyer'
  }
}

/** Only allow same-origin absolute paths from the `next` query parameter. */
export function safeRedirect(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  return next
}
