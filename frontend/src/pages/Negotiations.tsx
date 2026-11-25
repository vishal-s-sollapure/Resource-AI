import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, FileText, Handshake, PackagePlus, Sparkles, Tag, X } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingGrid, Modal, PageHeader, StatusBadge, Textarea } from '../components/ui'
import { OfferThread } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import type { Listing, Offer, PriceEstimate } from '../lib/types'
import { inr, newestFirst, num } from '../lib/utils'
import { useApp } from '../state/AppContext'

interface Negotiation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  status: string
  agreed_price?: number | null
  agreed_quantity?: number | null
  order_id?: string | null
  is_demo?: boolean
  created_at?: string
  updated_at?: string
}

interface NegotiationDetail {
  negotiation: Negotiation
  offers: Offer[]
  listing: Listing | null
}

interface AssistResult {
  suggestion: {
    suggested_price_per_unit: number | null
    suggested_total: number | null
    rationale: string
    source: string
    note: string
  }
  price_estimate: PriceEstimate
}

export default function Negotiations() {
  const { user, notify } = useApp()
  const navigate = useNavigate()
  const { negotiationId } = useParams<{ negotiationId?: string }>()
  const selectedId = negotiationId || null
  const [counterFor, setCounterFor] = useState<Offer | null>(null)
  const [counter, setCounter] = useState({ price: '', quantity: '', delivery_location: '', message: '' })
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderForm, setOrderForm] = useState({ agreed_price: '', quantity: '', delivery_location: '', pickup_location: '' })
  const [assist, setAssist] = useState<AssistResult | null>(null)
  const [busy, setBusy] = useState(false)

  const list = useApiData<{ items: Negotiation[] }>('/negotiations')
  const listings = useApiData<{ items: Listing[] }>('/listings?status=active')
  const detail = useApiData<NegotiationDetail>(selectedId ? `/negotiations/${selectedId}` : null, [selectedId])

  const rows = newestFirst(list.data?.items || [])
  const selected = detail.data
  const openOffers = [...(selected?.offers || [])].filter((offer) => offer.status === 'pending')
  const latestOpen = openOffers.length ? openOffers[openOffers.length - 1] : null

  function canAct(offer: Offer) {
    if (!user) return false
    if (user.role === 'admin') return true
    // Only the intended counter-party may accept, counter or reject an offer.
    const expectedUserId = offer.made_by === 'buyer' ? offer.seller_id : offer.buyer_id
    return user.id === expectedUserId
  }

  function canCreateOrder() {
    if (!user || !selected) return false
    if (user.role === 'admin') return true
    return user.id === selected.negotiation.buyer_id
  }

  function listingName(listingId: string) {
    return listings.data?.items.find((listing) => listing.id === listingId)?.material_name || selected?.listing?.material_name || listingId
  }

  function select(id: string) {
    navigate(`/negotiations/${id}`)
  }

  useEffect(() => {
    setAssist(null)
    setCounterFor(null)
    setOrderOpen(false)
  }, [selectedId])

  async function act(action: 'accept' | 'reject', offer: Offer) {
    if (busy) return
    setBusy(true)
    try {
      await api.post(`/offers/${offer.id}/${action}`)
      notify(action === 'accept' ? 'Offer accepted. Create an order to lock the terms.' : 'Offer rejected. The other party can send a new offer.')
      detail.reload()
      list.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openCounter(offer: Offer) {
    setCounterFor(offer)
    setCounter({ price: String(offer.price), quantity: String(offer.quantity), delivery_location: offer.delivery_location, message: '' })
  }

  async function submitCounter() {
    if (!counterFor || busy) return
    setBusy(true)
    try {
      await api.post(`/offers/${counterFor.id}/counter`, {
        price: Number(counter.price),
        quantity: Number(counter.quantity),
        delivery_location: counter.delivery_location,
        message: counter.message,
      })
      notify('Counteroffer sent. The other party decides.')
      setCounterFor(null)
      detail.reload()
      list.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openOrderModal() {
    if (!selected) return
    setOrderForm({
      agreed_price: String(selected.negotiation.agreed_price ?? selected.listing?.price ?? ''),
      quantity: String(selected.negotiation.agreed_quantity ?? selected.listing?.quantity ?? ''),
      delivery_location: '',
      pickup_location: selected.listing?.location || '',
    })
    setOrderOpen(true)
  }

  async function createOrder() {
    if (!selected || busy) return
    if (!orderForm.agreed_price || !orderForm.quantity) {
      notify('Agreed price and quantity are required.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await api.post<{ order: { id: string }; message: string }>('/orders', {
        listing_id: selected.negotiation.listing_id,
        negotiation_id: selected.negotiation.id,
        agreed_price: Number(orderForm.agreed_price),
        quantity: Number(orderForm.quantity),
        delivery_location: orderForm.delivery_location,
        pickup_location: orderForm.pickup_location,
      })
      notify('Order created. It awaits seller acceptance before any advance is paid.')
      setOrderOpen(false)
      list.reload()
      navigate(`/orders/${result.order.id}`)
      return result
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function runAssist() {
    if (!selectedId || busy) return
    setBusy(true)
    try {
      const result = await api.post<AssistResult>(`/negotiations/${selectedId}/assist`)
      setAssist(result)
      notify('Offer assistance ready. You remain in control.')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Commercial terms"
        title="Offers & Negotiation"
        description="Buyers propose, sellers accept or counter. AI assists with suggestions but never decides for either party."
        actions={<><Badge tone="purple"><Sparkles size={12} /> AI assisted</Badge><DemoBadge /></>}
      />

      {list.error && <div className="mb-5"><ErrorState message={list.error} onRetry={list.reload} /></div>}
      {!selectedId && (
        list.loading ? <LoadingGrid count={3} /> : rows.length ? (
          <div className="grid-auto">
            {rows.map((item) => (
              <button key={item.id} onClick={() => select(item.id)} className="card card-hover p-5 text-left">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone="blue"><Handshake size={12} /> Negotiation</Badge>
                  <StatusBadge status={item.status} />
                </div>
                <p className="font-bold text-ink-900">{listingName(item.listing_id)}</p>
                <p className="mt-1 text-xs text-slate-500">{item.id} · {item.buyer_id.replace('usr_', 'demo buyer ')} ↔ {item.seller_id.replace('usr_', 'demo seller ')}</p>
                {item.agreed_price && <p className="mt-3 text-sm font-semibold text-forest-700">Agreed {inr(item.agreed_price, 2)} / unit · {num(item.agreed_quantity)} units</p>}
                {item.is_demo && <div className="mt-3"><DemoBadge /></div>}
                <p className="mt-4 text-xs font-semibold text-forest-700">Open thread →</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Handshake size={22} />}
            title="No negotiations yet"
            description={user?.role === 'seller' ? 'Negotiations appear here once a buyer sends an offer on your listings.' : 'Make an offer from a supplier match to start one.'}
            action={<Link to={user?.role === 'seller' ? '/find-buyers' : '/matches'} className="btn-primary">{user?.role === 'seller' ? 'Find buyers' : 'Find suppliers'}</Link>}
          />
        )
      )}

      {selectedId && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/negotiations')}>← All negotiations</Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={runAssist} loading={busy} disabled={busy}><Sparkles size={14} /> AI assist</Button>
              {selected?.negotiation.status === 'agreed' && !selected?.negotiation.order_id && canCreateOrder() && (
                <Button size="sm" onClick={openOrderModal} disabled={busy}><PackagePlus size={14} /> Create order</Button>
              )}
              {selected?.negotiation.order_id && <Link to={`/orders/${selected.negotiation.order_id}`} className="btn-primary btn-sm"><FileText size={14} /> View order</Link>}
            </div>
          </div>

          {detail.loading ? <LoadingGrid count={1} /> : selected ? (
            <>
              <div className="card p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Negotiation {selected.negotiation.id}</p>
                    <h3 className="mt-1 text-xl font-bold text-ink-900">{selected.listing?.material_name || listingName(selected.negotiation.listing_id)}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Buyer {selected.negotiation.buyer_id.replace('usr_', 'demo ')} · Seller {selected.negotiation.seller_id.replace('usr_', 'demo ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selected.negotiation.status} />
                    {selected.listing?.is_demo && <DemoBadge />}
                  </div>
                </div>
                {selected.negotiation.agreed_price && (
                  <div className="rounded-xl border border-forest-200 bg-forest-50 p-4 text-sm text-forest-900">
                    Agreed terms: {inr(selected.negotiation.agreed_price, 2)} per unit for {num(selected.negotiation.agreed_quantity)} {selected.listing?.unit || 'units'}.
                    Payment is not automatic — an order must be created and accepted.
                  </div>
                )}
              </div>

              {assist && (
                <div className="card border-purple-200 bg-purple-50/40 p-5">
                  <h4 className="flex items-center gap-2 font-bold text-purple-900"><Sparkles size={16} /> Negotiation assistance</h4>
                  <p className="mt-2 text-sm text-purple-900">
                    {assist.suggestion.suggested_price_per_unit
                      ? `Indicative suggestion: ${inr(assist.suggestion.suggested_price_per_unit, 2)} / unit · ${inr(assist.suggestion.suggested_total, 2)} total.`
                      : 'Insufficient market data for an offer suggestion. Request a quotation and negotiate directly.'}
                  </p>
                  <p className="mt-2 text-xs text-purple-800">{assist.suggestion.rationale}</p>
                  <p className="mt-1 text-[11px] text-purple-700">Source: {assist.suggestion.source} · {assist.suggestion.note}</p>
                </div>
              )}

              <div className="card p-5">
                <h4 className="mb-4 flex items-center gap-2 font-bold text-ink-900"><Tag size={17} className="text-forest-600" /> Offer thread</h4>
                <OfferThread offers={selected.offers} currentUserId={user?.id} />
                {latestOpen && canAct(latestOpen) ? (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <Button size="sm" onClick={() => act('accept', latestOpen)} loading={busy} disabled={busy}><Check size={14} /> Accept latest pending offer</Button>
                    <Button size="sm" variant="secondary" onClick={() => openCounter(latestOpen)} disabled={busy}><Tag size={14} /> Counter</Button>
                    <Button size="sm" variant="secondary" onClick={() => act('reject', latestOpen)} loading={busy} disabled={busy}><X size={14} /> Reject</Button>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    {latestOpen ? 'This offer is awaiting the counter-party’s decision.' : 'No open offer in this thread.'}
                  </p>
                )}
              </div>
            </>
          ) : <ErrorState message={detail.error || 'Negotiation not found.'} onRetry={detail.reload} />}
        </div>
      )}

      <Modal
        open={Boolean(counterFor)}
        onClose={() => setCounterFor(null)}
        title="Send a counteroffer"
        description="The other party can accept, reject or counter again."
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setCounterFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitCounter} loading={busy}>Send counteroffer</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Counter price / unit" required><Input type="number" min="0" value={counter.price} onChange={(event) => setCounter({ ...counter, price: event.target.value })} /></Field>
          <Field label="Quantity" required><Input type="number" min="0" value={counter.quantity} onChange={(event) => setCounter({ ...counter, quantity: event.target.value })} /></Field>
          <Field label="Delivery location"><Input value={counter.delivery_location} onChange={(event) => setCounter({ ...counter, delivery_location: event.target.value })} /></Field>
          <Field label="Message"><Input value={counter.message} onChange={(event) => setCounter({ ...counter, message: event.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title="Create order from agreed terms"
        description="The order starts as awaiting seller acceptance. No payment is collected automatically."
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setOrderOpen(false)} disabled={busy}>Cancel</Button><Button onClick={createOrder} loading={busy}>Create order</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Agreed price / unit" required><Input type="number" min="0" readOnly={selected?.negotiation.agreed_price != null} value={orderForm.agreed_price} onChange={(event) => setOrderForm({ ...orderForm, agreed_price: event.target.value })} /></Field>
          <Field label="Quantity" required><Input type="number" min="0" readOnly={selected?.negotiation.agreed_quantity != null} value={orderForm.quantity} onChange={(event) => setOrderForm({ ...orderForm, quantity: event.target.value })} /></Field>
          <Field label="Pickup location"><Input value={orderForm.pickup_location} onChange={(event) => setOrderForm({ ...orderForm, pickup_location: event.target.value })} /></Field>
          <Field label="Delivery location"><Input value={orderForm.delivery_location} onChange={(event) => setOrderForm({ ...orderForm, delivery_location: event.target.value })} /></Field>
        </div>
        <div className="mt-4 space-y-2">
          <Alert tone="info">Agreed price and quantity are locked. Delivery details may still be added.</Alert>
          <Alert tone="warning">20% advance is paid directly to the seller and confirmed manually by the seller. The remaining 80% follows the agreed terms.</Alert>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
