export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function inr(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function num(value: number | null | undefined, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: decimals })
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function titleCase(value: string | null | undefined) {
  return String(value || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function statusTone(status: string | null | undefined) {
  const value = String(status || '').toLowerCase()
  if (['active', 'confirmed', 'accepted', 'agreed', 'delivered', 'completed', 'verified', 'open'].includes(value)) return 'green'
  if (['pending', 'submitted', 'sent', 'replied', 'in_progress', 'in_transit', 'shipped', 'preparing', 'shipment_scheduled', 'matched', 'seller_review'].includes(value)) return 'blue'
  if (['negotiable', 'advance_pending', 'awaiting_seller_acceptance', 'awaiting_buyer_confirmation', 'out_for_delivery', 'paused', 'pending_review'].includes(value)) return 'amber'
  if (['rejected', 'cancelled', 'deleted', 'closed', 'failed'].includes(value)) return 'red'
  return 'gray'
}

/** Return a copy sorted newest-first using `created_at` (or `updated_at` fallback). */
export function newestFirst<T extends { created_at?: string; updated_at?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.created_at || b.updated_at || '').localeCompare(a.created_at || a.updated_at || ''))
}

export function totalValue(quantity: number, pricePerUnit: number) {
  return Number(quantity || 0) * Number(pricePerUnit || 0)
}

const UNIT_TO_KG: Record<string, number> = {
  kg: 1,
  kilogram: 1,
  kilograms: 1,
  tonne: 1000,
  tonnes: 1000,
  ton: 1000,
  tons: 1000,
  t: 1000,
  quintal: 100,
  quintals: 100,
}

/** Convert a quantity between units used by listing/offer forms. Unknown units pass through. */
export function convertQuantity(value: number | null | undefined, fromUnit: string, toUnit: string) {
  const amount = Number(value || 0)
  const from = UNIT_TO_KG[String(fromUnit || 'kg').toLowerCase()] || 1
  const to = UNIT_TO_KG[String(toUnit || 'kg').toLowerCase()] || 1
  if (from === 1 && to === 1) return amount
  return Math.round((amount * from / to) * 1000) / 1000
}

export function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${num(value)} ${value === 1 ? singular : pluralForm}`
}
