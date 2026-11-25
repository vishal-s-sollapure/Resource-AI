import type { Role } from './types'

// A missing role means an unauthenticated public demo request. The backend
// supplies a clearly-labelled demo identity for those requests, so public
// workflows remain usable. Authenticated users are gated by their real role.
export function canSell(role?: Role | null): boolean {
  return !role || role === 'seller' || role === 'buyer_seller' || role === 'admin'
}

export function canBuy(role?: Role | null): boolean {
  return !role || role === 'buyer' || role === 'buyer_seller' || role === 'admin'
}
