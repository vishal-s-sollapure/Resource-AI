import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Boxes, CheckCircle2, CircleDollarSign, FileText, Handshake, Mail,
  PackageSearch, Search, ShoppingBag, Sparkles, Tag, Truck,
} from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, ErrorState, Field, Input, LoadingGrid, Modal, PageHeader, StatCard, StatusBadge } from '../components/ui'
import { ListingCard, RequirementCard } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import type { Listing, Offer, Order, Requirement } from '../lib/types'
import { inr, newestFirst, num, titleCase } from '../lib/utils'
import { useApp } from '../state/AppContext'

interface EnquiryItem {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  message: string
  status: string
  created_at?: string
}

export default function BuyerDashboard() {
  const { user, notify } = useApp()
  const navigate = useNavigate()
  const userId = user?.id || ''
  const requirementsPath = user?.role === 'admin' ? '/requirements' : '/requirements/mine'
  const requirements = useApiData<{ items: Requirement[] }>(requirementsPath)
  const listings = useApiData<{ items: Listing[] }>('/listings?status=active')
  const orders = useApiData<{ items: Order[] }>('/orders')
  const offers = useApiData<{ items: Offer[] }>('/offers')
  const enquiries = useApiData<{ items: EnquiryItem[] }>('/enquiries')

  const [negotiateFor, setNegotiateFor] = useState<Listing | null>(null)
  const [offerForm, setOfferForm] = useState({ price: '', quantity: '', delivery_location: '', message: '' })
  const [buyFor, setBuyFor] = useState<Listing | null>(null)
  const [buyForm, setBuyForm] = useState({ quantity: '', delivery_location: '' })
  const [busy, setBusy] = useState(false)

  const activeListings = newestFirst(listings.data?.items || [])
  const buyerOrders = newestFirst((orders.data?.items || []).filter((order) => !userId || order.buyer_id === userId))
  const openOffers = newestFirst((offers.data?.items || []).filter((offer) => (!userId || offer.buyer_id === userId) && offer.status === 'pending'))
  const incomingEnquiries = newestFirst((enquiries.data?.items || []).filter((item) => !userId || (item.buyer_id === userId && item.seller_id !== userId)))
  const premium = user?.subscription_tier === 'premium'

  function openNegotiate(listing: Listing) {
    setNegotiateFor(listing)
    setOfferForm({
      price: String(listing.price),
      quantity: String(listing.quantity),
      delivery_location: '',
      message: '',
    })
  }

  async function submitOffer() {
    if (!negotiateFor) return
    setBusy(true)
    try {
      const result = await api.post<{ negotiation: { id: string } }>('/offers', {
        listing_id: negotiateFor.id,
        price: Number(offerForm.price),
        quantity: Number(offerForm.quantity),
        delivery_location: offerForm.delivery_location,
        message: offerForm.message,
      })
      setNegotiateFor(null)
      notify('Offer sent to the seller. You can follow it in Offers & Negotiation.')
      offers.reload()
      navigate(`/negotiations/${result.negotiation.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openBuy(listing: Listing) {
    setBuyFor(listing)
    setBuyForm({ quantity: String(listing.quantity), delivery_location: '' })
  }

  async function submitBuy() {
    if (!buyFor) return
    setBusy(true)
    try {
      const result = await api.post<{ order: Order }>('/orders', {
        listing_id: buyFor.id,
        quantity: Number(buyForm.quantity),
        agreed_price: buyFor.price,
        pickup_location: buyFor.location,
        delivery_location: buyForm.delivery_location,
        transport_agreed: false,
      })
      setBuyFor(null)
      notify('Order placed and sent to the seller.')
      orders.reload()
      navigate(`/orders/${result.order.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirmSellerOrder(order: Order) {
    setBusy(true)
    try {
      await api.post(`/orders/${order.id}/buyer-accept`)
      notify('Order confirmed. You can now view bank details and submit your advance reference.')
      orders.reload()
      navigate(`/orders/${order.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function negotiateOrder(order: Order) {
    const matched = activeListings.find((item) => item.id === order.listing_id)
    if (matched) {
      openNegotiate(matched)
      return
    }
    setNegotiateFor({
      id: order.listing_id,
      seller_id: order.seller_id,
      material_name: order.material_name,
      category: 'other',
      quantity: order.quantity,
      unit: order.unit,
      form: 'raw',
      quality_grade: 'ungraded',
      processing_level: 'raw',
      location: order.pickup_location,
      price: order.agreed_price,
      price_type: 'negotiable',
      images: [],
      description: '',
      status: 'active',
      is_demo: order.is_demo,
      created_at: order.created_at,
      updated_at: order.created_at,
    })
    setOfferForm({
      price: String(order.agreed_price),
      quantity: String(order.quantity),
      delivery_location: order.delivery_location,
      message: `Countering order ${order.id}`,
    })
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Buyer workspace"
        title={`Source smarter, ${user?.full_name?.split(' ')[0] || 'buyer'}`}
        description="View seller listings, negotiate terms or buy directly, and track incoming seller orders."
        actions={<>
          <Link to="/find-materials" className="btn-primary"><Search size={16} /> Find materials</Link>
          <Link to="/matches" className="btn-secondary"><Sparkles size={16} /> Supplier matches</Link>
        </>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My requirements" value={requirements.data?.items.length ?? '—'} hint="Published needs" icon={<FileText size={19} />} />
        <StatCard label="Available listings" value={activeListings.length} hint="From sellers" icon={<Boxes size={19} />} tone="blue" />
        <StatCard label="Open offers" value={openOffers.length} hint="In negotiation" icon={<Handshake size={19} />} tone="amber" />
        <StatCard label="My orders" value={buyerOrders.length} hint="Demo orders & requests" icon={<PackageSearch size={19} />} tone="ink" />
      </div>

      {requirements.error && <div className="mb-5"><ErrorState message={requirements.error} onRetry={requirements.reload} /></div>}
      {listings.error && <div className="mb-5"><ErrorState message={listings.error} onRetry={listings.reload} /></div>}
      {orders.error && <div className="mb-5"><ErrorState message={orders.error} onRetry={orders.reload} /></div>}
      {offers.error && <div className="mb-5"><ErrorState message={offers.error} onRetry={offers.reload} /></div>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">Available materials from sellers</h3>
            <Link to="/matches" className="text-xs font-semibold text-forest-700 hover:underline">All supplier matches <ArrowRight size={12} className="inline" /></Link>
          </div>
          {listings.loading ? <LoadingGrid count={2} /> : activeListings.length ? (
            <div className="grid-auto">
              {activeListings.slice(0, 6).map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  footer={!userId || listing.seller_id !== userId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openBuy(listing)} disabled={busy}><ShoppingBag size={13} /> Buy</Button>
                      <Button size="sm" variant="secondary" onClick={() => openNegotiate(listing)} disabled={busy}><Tag size={13} /> Negotiate</Button>
                    </div>
                  ) : undefined}
                />
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">No active listings are available right now.</p>}
        </div>
        <div className="space-y-4">
          <div className={`card p-5 ${premium ? 'border-forest-300 bg-forest-50/40' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink-900">Buyer subscription</h3>
              <Badge tone={premium ? 'green' : 'gray'}>{premium ? 'Premium demo' : 'Basic / Free trial'}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Tier labels are illustrative for the hackathon. Every MVP workflow shown here is available in the prototype; only the badge changes. No payment is collected.
            </p>
            <Link to="/profile" className="btn-secondary btn-sm mt-4">Manage plan <ArrowRight size={13} /></Link>
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-ink-900">Incoming enquiries from sellers</h3>
            {enquiries.loading ? <LoadingGrid count={1} /> : incomingEnquiries.length ? incomingEnquiries.slice(0, 3).map((item) => (
              <div key={item.id} className="mb-3 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-900"><Mail size={13} className="text-forest-600" /> {activeListings.find((l) => l.id === item.listing_id)?.material_name || item.listing_id}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.message}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No seller enquiries yet.</p>}
            <Link to="/enquiries" className="btn-secondary btn-sm mt-1"><Mail size={14} /> Open RFQs</Link>
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-ink-900">My requirements</h3>
            {requirements.loading ? <LoadingGrid count={1} /> : requirements.data?.items.length ? requirements.data.items.slice(0, 3).map((requirement) => (
              <div key={requirement.id} className="mb-3"><RequirementCard requirement={requirement} /></div>
            )) : <p className="text-sm text-slate-500">No requirements saved yet. Describe what you need to get started.</p>}
            <Link to="/requirements" className="btn-secondary btn-sm mt-2"><FileText size={14} /> Manage requirements</Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-ink-900">Orders & seller requests</h3>
          {buyerOrders.length ? buyerOrders.slice(0, 5).map((order) => (
            <div key={order.id} className="mb-3 rounded-xl border border-slate-200 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{order.material_name} · {num(order.quantity)} {order.unit} · {inr(order.agreed_price, 2)}/{order.unit}</p>
                  <p className="text-xs text-slate-500">{order.id} · Advance {inr(order.advance_amount)} · Balance {inr(order.balance_amount)}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {order.status === 'awaiting_buyer_confirmation' && (
                  <>
                    <Button size="sm" onClick={() => confirmSellerOrder(order)} loading={busy} disabled={busy}><CheckCircle2 size={13} /> Accept & Buy</Button>
                    <Button size="sm" variant="secondary" onClick={() => negotiateOrder(order)} disabled={busy}><Tag size={13} /> Negotiate</Button>
                  </>
                )}
                <Link to={`/orders/${order.id}`} className="btn-ghost btn-sm">View order <ArrowRight size={12} /></Link>
              </div>
            </div>
          )) : <p className="text-sm text-slate-500">No orders yet.</p>}
          <Link to="/orders" className="btn-secondary btn-sm mt-2"><CircleDollarSign size={14} /> Open orders</Link>
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-ink-900">Delivery tracking</h3>
          <Alert tone="info" title="Manual tracking only">
            Shipment milestones are updated by the seller or transporter. No real-time GPS integration is active.
          </Alert>
          <Link to="/orders" className="btn-secondary btn-sm mt-4"><Truck size={14} /> View tracking timeline</Link>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><BadgeCheck size={14} className="text-forest-600" /> Payments are direct to sellers; seller confirms receipt.</div>
          <div className="mt-2"><DemoBadge>Advance is 20% of material value, not a platform fee</DemoBadge></div>
        </div>
      </div>

      <Modal
        open={Boolean(negotiateFor)}
        onClose={() => setNegotiateFor(null)}
        title="Negotiate — make an offer"
        description={negotiateFor ? `${negotiateFor.material_name} · listed at ${inr(negotiateFor.price, 2)}/${negotiateFor.unit}` : ''}
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setNegotiateFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitOffer} loading={busy}>Send offer</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Proposed price (₹/${negotiateFor?.unit || 'unit'})`} required><Input type="number" min="0" step="0.01" value={offerForm.price} onChange={(e) => setOfferForm({ ...offerForm, price: e.target.value })} /></Field>
          <Field label={`Quantity (${negotiateFor?.unit || 'units'})`} required><Input type="number" min="0" value={offerForm.quantity} onChange={(e) => setOfferForm({ ...offerForm, quantity: e.target.value })} /></Field>
          <Field label="Delivery location"><Input value={offerForm.delivery_location} onChange={(e) => setOfferForm({ ...offerForm, delivery_location: e.target.value })} /></Field>
          <Field label="Message"><Input value={offerForm.message} onChange={(e) => setOfferForm({ ...offerForm, message: e.target.value })} /></Field>
        </div>
        <div className="mt-4"><Alert tone="info">The seller will see your offer on their Seller Dashboard and can accept, reject, or counter it.</Alert></div>
      </Modal>

      <Modal
        open={Boolean(buyFor)}
        onClose={() => setBuyFor(null)}
        title="Buy at listed price"
        description={buyFor ? `${buyFor.material_name} · ${inr(buyFor.price, 2)}/${buyFor.unit} · available ${num(buyFor.quantity)} ${buyFor.unit}` : ''}
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setBuyFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitBuy} loading={busy}>Place order</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Quantity (${buyFor?.unit || 'units'})`} required><Input type="number" min="1" max={buyFor?.quantity || undefined} value={buyForm.quantity} onChange={(e) => setBuyForm({ ...buyForm, quantity: e.target.value })} /></Field>
          <Field label="Price / unit"><Input value={buyFor ? `${inr(buyFor.price, 2)} / ${buyFor.unit}` : ''} readOnly /></Field>
          <Field label="Delivery location" className="sm:col-span-2"><Input value={buyForm.delivery_location} onChange={(e) => setBuyForm({ ...buyForm, delivery_location: e.target.value })} placeholder="City, State" /></Field>
        </div>
        <div className="mt-4"><Alert tone="info">Creates a demo order awaiting seller acceptance. The seller will see it immediately on their Seller Dashboard.</Alert></div>
      </Modal>
    </DashboardLayout>
  )
}
