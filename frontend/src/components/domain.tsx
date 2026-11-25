import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BadgeCheck, Box, Building2, CalendarDays, CheckCircle2, CircleDollarSign,
  Droplets, FileText, Layers3, Leaf, MapPin, Package, Recycle, Scale, Sparkles, Sprout,
  Trees, Truck, UserRound, Wheat,
} from 'lucide-react'
import { Badge, DemoBadge, ProgressBar, StatusBadge } from './ui'
import type {
  BuyerMatch, DiscoveryResult, Listing, MaterialGuide, MaterialPassport, MatchResult,
  Offer, Order, Requirement, SellerMatch, Shipment,
} from '../lib/types'
import { cn, dateTime, inr, num, shortDate, titleCase, totalValue } from '../lib/utils'

type MaterialArt = { keys: string[]; icon: typeof Leaf; bg: string; fg: string }

const MATERIAL_ART: MaterialArt[] = [
  { keys: ['coconut', 'coir'], icon: Leaf, bg: 'from-amber-100 to-lime-100', fg: 'text-amber-800' },
  { keys: ['sugarcane', 'bagasse'], icon: Sprout, bg: 'from-lime-100 to-emerald-100', fg: 'text-emerald-800' },
  { keys: ['bamboo', 'wood', 'sawdust', 'timber'], icon: Trees, bg: 'from-emerald-100 to-teal-100', fg: 'text-teal-800' },
  { keys: ['rice', 'wheat', 'straw', 'husk'], icon: Wheat, bg: 'from-yellow-100 to-amber-100', fg: 'text-yellow-800' },
  { keys: ['jute', 'fibre', 'fiber', 'textile', 'cotton'], icon: Layers3, bg: 'from-sky-100 to-indigo-100', fg: 'text-indigo-800' },
  { keys: ['plastic', 'rubber', 'metal', 'industrial'], icon: Recycle, bg: 'from-slate-100 to-blue-100', fg: 'text-blue-800' },
]

function artFor(category: string): MaterialArt {
  const value = category.toLowerCase()
  return MATERIAL_ART.find((art) => art.keys.some((key) => value.includes(key)))
    || { keys: [], icon: Package, bg: 'from-forest-100 to-slate-100', fg: 'text-forest-800' }
}

export function ListingCard({ listing, footer, onClick }: { listing: Listing; footer?: ReactNode; onClick?: () => void }) {
  const art = artFor(listing.category || listing.material_name)
  const ArtIcon = art.icon
  const image = listing.images?.[0]
  return (
    <article className="card card-hover flex flex-col overflow-hidden">
      <div className={cn('relative h-24 w-full shrink-0 overflow-hidden bg-gradient-to-br', art.bg)}>
        <div className="absolute inset-0 grid place-items-center">
          <ArtIcon size={38} strokeWidth={1.4} className={cn('opacity-40', art.fg)} />
        </div>
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <StatusBadge status={listing.status} />
          {listing.is_demo && <DemoBadge>Preview</DemoBadge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold">{listing.material_name}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{titleCase(listing.category)} · {titleCase(listing.form)}</p>
          </div>
          <span className="rounded-lg bg-forest-50 px-2.5 py-1 text-sm font-extrabold text-forest-800">{inr(listing.price, 2)}<span className="text-[10px] font-semibold text-forest-600">/{listing.unit}</span></span>
        </div>
        <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-relaxed text-slate-600">{listing.description || 'No description provided.'}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="flex items-start gap-2"><Package size={15} className="mt-0.5 shrink-0 text-slate-400" /><div><dt className="text-[11px] font-medium text-slate-500">Available</dt><dd className="font-semibold">{num(listing.quantity)} {listing.unit}</dd></div></div>
          <div className="flex items-start gap-2"><BadgeCheck size={15} className="mt-0.5 shrink-0 text-slate-400" /><div><dt className="text-[11px] font-medium text-slate-500">Grade</dt><dd className="font-semibold">{titleCase(listing.quality_grade)}</dd></div></div>
          <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0"><dt className="text-[11px] font-medium text-slate-500">Location</dt><dd className="truncate font-semibold">{listing.location || '—'}</dd></div></div>
          <div className="flex items-start gap-2"><Droplets size={15} className="mt-0.5 shrink-0 text-slate-400" /><div><dt className="text-[11px] font-medium text-slate-500">Moisture</dt><dd className="font-semibold">{listing.moisture_content !== null && listing.moisture_content !== undefined ? `${listing.moisture_content}%` : '—'}</dd></div></div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={listing.price_type === 'negotiable' ? 'amber' : 'blue'}>
              {listing.price_type === 'negotiable' ? 'Negotiable' : 'Fixed price'}
            </Badge>
            <span className="text-xs text-slate-500">Lot {inr(totalValue(listing.quantity, listing.price))}</span>
          </div>
          {onClick && (
            <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-bold text-forest-700 transition hover:gap-2 hover:text-forest-900">
              View details <ArrowRight size={13} />
            </button>
          )}
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </article>
  )
}

export function RequirementCard({ requirement, footer, onClick }: { requirement: Requirement; footer?: ReactNode; onClick?: () => void }) {
  return (
    <article className="card card-hover flex flex-col overflow-hidden">
      <div className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-r from-blue-50 via-sky-50 to-white px-5 py-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"><FileText size={20} /></span>
        <div className="min-w-0">
          <p className="eyebrow !text-blue-700">Published requirement</p>
          <h3 className="truncate text-base font-bold">{requirement.material_name}</h3>
          <p className="truncate text-xs text-slate-500">{requirement.application || 'Application not specified'}</p>
        </div>
        {requirement.is_demo && <DemoBadge>Preview</DemoBadge>}
      </div>
      <div className="flex flex-1 flex-col p-5 pt-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-[11px] font-medium text-slate-500">Needed</dt><dd className="font-semibold">{num(requirement.quantity)} {requirement.unit}</dd></div>
          <div><dt className="text-[11px] font-medium text-slate-500">Quality</dt><dd className="font-semibold">{titleCase(requirement.required_quality)}</dd></div>
          <div><dt className="text-[11px] font-medium text-slate-500">Location</dt><dd className="truncate font-semibold">{requirement.location || '—'}</dd></div>
          <div><dt className="text-[11px] font-medium text-slate-500">Budget</dt><dd className="font-semibold text-forest-800">{requirement.max_price ? `${inr(requirement.max_price, 2)} / unit` : 'On request'}</dd></div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <StatusBadge status={requirement.status} />
          {requirement.confirmed ? <Badge tone="green"><BadgeCheck size={12} /> Confirmed demand</Badge> : <Badge tone="gray">Not confirmed</Badge>}
          {onClick && (
            <button onClick={onClick} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-forest-700 transition hover:gap-2 hover:text-forest-900">
              View details <ArrowRight size={13} />
            </button>
          )}
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </article>
  )
}

export function MatchFactors({ match, compact = false }: { match: MatchResult; compact?: boolean }) {
  const factors: Array<[string, number]> = [
    ['Material', match.factors.material],
    ['Quantity', match.factors.quantity],
    ['Location', match.factors.location],
    ['Quality', match.factors.quality],
  ]
  return (
    <div className={cn('grid gap-2.5', compact ? 'grid-cols-2' : 'sm:grid-cols-2')}>
      {factors.map(([label, value]) => <ProgressBar key={label} label={label} value={value} />)}
    </div>
  )
}

export function MatchCard({ match, kind, children }: { match: MatchResult; kind: 'seller' | 'buyer'; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <Badge tone={kind === 'seller' ? 'blue' : 'green'}>
          {kind === 'seller' ? 'Buyer requirement match' : 'Supplier match'}
        </Badge>
        <div className="text-right">
          <p className={cn('text-xl font-extrabold', match.score >= 80 ? 'text-forest-700' : match.score >= 60 ? 'text-amber-600' : 'text-slate-500')}>
            {num(match.score, 1)}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Match score</p>
        </div>
      </div>
      <MatchFactors match={match} compact />
      <p className="mt-3 text-sm font-medium text-ink-800">{match.summary}</p>
      <ul className="mt-3 space-y-1.5">
        {match.reasons.map((reason, index) => (
          <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-600">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-forest-500" /> {reason}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <AlertTriangle size={13} className="shrink-0" /> {match.note}
      </p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function SellerMatchItem({ item, children }: { item: SellerMatch; children?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Building2 size={17} className="text-forest-600" />
            <h3 className="font-bold text-ink-900">{item.buyer_name}</h3>
            {item.confirmed_demand && <Badge tone="green"><BadgeCheck size={12} /> Confirmed demand</Badge>}
            {item.requirement.is_demo && <DemoBadge />}
          </div>
          <RequirementCard requirement={item.requirement} />
        </div>
        <MatchCard match={item.match} kind="seller">{children}</MatchCard>
      </div>
    </div>
  )
}

export function BuyerMatchItem({ item, children }: { item: BuyerMatch; children?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <UserRound size={17} className="text-forest-600" />
            <h3 className="font-bold text-ink-900">{item.supplier_name}</h3>
          </div>
          <ListingCard listing={item.listing} />
        </div>
        <MatchCard match={item.match} kind="buyer">{children}</MatchCard>
      </div>
    </div>
  )
}

export function ProspectCard({ result }: { result: DiscoveryResult }) {
  const isAI = result.source_type === 'ai_prospect'
  const isReal = result.source_type === 'real_business_listing'
  return (
    <div className={cn('card flex h-full flex-col p-4', isAI && 'border-purple-200 bg-purple-50/40')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={isAI ? 'purple' : isReal ? 'blue' : 'green'}>{result.label}</Badge>
        {result.is_confirmed_demand && <Badge tone="green"><BadgeCheck size={12} /> Confirmed demand</Badge>}
      </div>
      <h3 className="font-bold text-ink-900">{result.business_name || result.category || 'Prospect category'}</h3>
      {result.business_name && result.category && <p className="mt-0.5 text-xs text-slate-500">{result.category}</p>}
      <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600"><MapPin size={14} className="mt-0.5 shrink-0" /> {result.address || 'No address available'}</p>
      {result.distance_km !== null && result.distance_km !== undefined && (
        <p className="mt-1 text-xs text-slate-500">Approx. {num(result.distance_km, 0)} km away</p>
      )}
      {result.search_query && <p className="mt-2 text-xs font-medium text-purple-700">Suggested search: “{result.search_query}”</p>}
      <p className="mt-auto pt-3 text-[11px] leading-relaxed text-slate-500">{result.note}</p>
    </div>
  )
}

export function MaterialGuideCard({ material, onClick, action }: { material: MaterialGuide; onClick?: () => void; action?: ReactNode }) {
  return (
    <button onClick={onClick} className="card card-hover w-full p-5 text-left">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-700"><Leaf size={20} /></span>
        <Badge tone="gray">{titleCase(material.category)}</Badge>
      </div>
      <h3 className="text-lg font-bold text-ink-900">{material.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{material.description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {material.applications.slice(0, 3).map((application) => <span key={application} className="chip">{application}</span>)}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-forest-700">
        <span>{material.applications.length} possible applications</span>
        {action || <ArrowRight size={15} />}
      </div>
    </button>
  )
}

export function PassportCard({ passport }: { passport: MaterialPassport }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-ink-900">{passport.material_name}</h3>
        <Badge tone="green"><FileText size={12} /> Material Passport</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-sm"><span className="text-slate-500">Source: </span>{passport.source || '—'}</p>
        <p className="text-sm"><span className="text-slate-500">Quantity: </span>{passport.quantity || '—'}</p>
        <p className="text-sm"><span className="text-slate-500">Quality: </span>{passport.quality || '—'}</p>
        <p className="text-sm"><span className="text-slate-500">Processing: </span>{passport.processing_history || '—'}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Intended applications</p>
          <div className="flex flex-wrap gap-1.5">{passport.intended_applications.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
        </div>
        <div>
          <p className="label">Storage conditions</p>
          <div className="flex flex-wrap gap-1.5">{passport.storage_conditions.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
        </div>
      </div>
    </div>
  )
}

export function OfferThread({ offers, currentUserId }: { offers: Offer[]; currentUserId?: string }) {
  const chronological = [...offers].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  return (
    <div className="space-y-3">
      {chronological.map((offer) => {
        const mine = Boolean(
          currentUserId &&
          (offer.made_by === 'seller' ? offer.seller_id === currentUserId : offer.buyer_id === currentUserId),
        )
        return (
          <div key={offer.id} className={cn('rounded-xl border p-4', mine ? 'border-forest-200 bg-forest-50/50' : 'border-slate-200 bg-white')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{titleCase(offer.made_by)}</span>
                <StatusBadge status={offer.status} />
              </div>
              <span className="text-xs text-slate-500">{dateTime(offer.created_at)}</span>
            </div>
            <p className="mt-2 text-xl font-bold text-forest-700">
              {inr(offer.price, 2)} <span className="text-xs font-medium text-slate-500">/ {offer.unit}</span>
              <span className="ml-2 text-sm font-semibold text-ink-900">· {inr(totalValue(offer.quantity, offer.price))} total</span>
            </p>
            <p className="mt-1 text-xs text-slate-600">{num(offer.quantity)} {offer.unit} · Delivery: {offer.delivery_location || 'To be agreed'}</p>
            {offer.message && <p className="mt-2 text-sm text-slate-700">“{offer.message}”</p>}
          </div>
        )
      })}
      {chronological.length === 0 && <p className="text-sm text-slate-500">No offers yet. Start the negotiation by making an offer.</p>}
    </div>
  )
}

export const SHIPMENT_STEPS = [
  { id: 'order_confirmed', label: 'Order Confirmed' },
  { id: 'advance_paid', label: 'Advance Paid' },
  { id: 'preparing_material', label: 'Preparing Material' },
  { id: 'shipment_scheduled', label: 'Shipment Scheduled' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'in_transit', label: 'In Transit' },
  { id: 'out_for_delivery', label: 'Out for Delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'completed', label: 'Completed' },
]

export function TrackingTimeline({ shipment }: { shipment: Shipment | null }) {
  if (!shipment) return <p className="text-sm text-slate-500">No shipment record yet.</p>
  const currentIndex = SHIPMENT_STEPS.findIndex((step) => step.id === shipment.status)
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="blue"><Truck size={12} /> {titleCase(shipment.status)}</Badge>
        {shipment.vehicle_type && <Badge tone="gray">{shipment.vehicle_type}</Badge>}
        {shipment.distance_km && <Badge tone="gray">~{num(shipment.distance_km, 0)} km</Badge>}
      </div>
      <div className="relative space-y-3 border-l-2 border-slate-200 pl-5">
        {SHIPMENT_STEPS.map((step, index) => {
          const done = currentIndex >= index
          return (
            <div key={step.id} className="relative">
              <span className={cn('absolute -left-[27px] grid h-4 w-4 place-items-center rounded-full border-2', done ? 'border-forest-600 bg-forest-600 text-white' : 'border-slate-300 bg-white')}>
                {done && <CheckCircle2 size={10} />}
              </span>
              <p className={cn('text-sm font-semibold', done ? 'text-ink-900' : 'text-slate-400')}>{step.label}</p>
            </div>
          )
        })}
      </div>
      <div className="mt-5 space-y-2">
        {[...shipment.tracking_events].reverse().map((event, index) => (
          <div key={index} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold text-ink-800">{titleCase(event.status)}</span>
              <span className="text-slate-500">{dateTime(event.timestamp)}</span>
            </div>
            <p className="mt-0.5 text-slate-600">{event.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Manual status updates only. No real-time GPS tracking is integrated.</p>
    </div>
  )
}

export function PriceBreakdown({ order }: { order: Order }) {
  const rows = [
    { label: 'Agreed material price', value: inr(order.agreed_price, 2), note: `per ${order.unit}` },
    { label: 'Quantity', value: `${num(order.quantity)} ${order.unit}`, note: '' },
    { label: 'Material order value', value: inr(order.total_value, 2), note: 'locked after agreement' },
    { label: 'Advance (20%)', value: inr(order.advance_amount, 2), note: titleCase(order.advance_status) },
    { label: 'Remaining (80%)', value: inr(order.balance_amount, 2), note: 'per agreed terms' },
    { label: 'Seller service fee', value: inr(order.seller_fee, 2), note: 'illustrative demo fee, not collected; separate from material payment' },
    { label: 'Transport cost', value: order.transport_cost !== null && order.transport_cost !== undefined ? inr(order.transport_cost, 2) : 'To be agreed', note: `Paid by ${order.transport_payer}` },
  ]
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3 border-b border-slate-200 py-2 last:border-0">
          <div>
            <p className="text-sm font-medium text-ink-900">{row.label}</p>
            {row.note && <p className="text-[11px] text-slate-500">{row.note}</p>}
          </div>
          <span className="whitespace-nowrap text-sm font-bold text-ink-900">{row.value}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between rounded-lg bg-forest-50 px-3 py-2.5 text-sm font-bold text-forest-800">
        <span>Estimated delivered cost</span>
        <span>{inr(order.total_value + Number(order.transport_cost || 0), 2)}</span>
      </div>
    </div>
  )
}

export function FactsRow({ items }: { items: Array<{ icon?: ReactNode; label: string; value: ReactNode }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.icon} {item.label}
          </p>
          <p className="mt-1.5 text-sm font-bold text-ink-900">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

export function AiNotice({ children, source }: { children: ReactNode; source?: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-purple-200 bg-purple-50/60 p-3.5 text-sm">
      <Sparkles size={17} className="mt-0.5 shrink-0 text-purple-600" />
      <div className="text-purple-900">
        {children}
        {source && <p className="mt-1 text-[11px] font-medium text-purple-700">Source: {source}</p>}
      </div>
    </div>
  )
}

export function EmptyListingIcon() { return <Box size={24} /> }
export function CalendarIcon() { return <CalendarDays size={14} /> }
export function RupeeIcon() { return <CircleDollarSign size={14} /> }
export function ScaleIcon() { return <Scale size={14} /> }
