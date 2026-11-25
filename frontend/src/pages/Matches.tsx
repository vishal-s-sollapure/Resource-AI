import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Handshake, Mail, Search, ShoppingBag, Sparkles, Tag } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, Field, Input, Modal, PageHeader, Select, Tabs } from '../components/ui'
import { BuyerMatchItem, SellerMatchItem } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import { canBuy, canSell } from '../lib/permissions'
import type { BuyerMatch, Listing, Order, PriceEstimate, SellerMatch, User } from '../lib/types'
import { convertQuantity, inr, num } from '../lib/utils'
import { useApp } from '../state/AppContext'

const sellerInitial = {
  material_name: 'Coconut husk', quantity: '500', unit: 'kg', location: 'Bengaluru, Karnataka',
  quality_grade: 'B', price: '10',
}
const buyerInitial = {
  material_name: 'Coconut husk', quantity: '500', unit: 'kg', location: 'Karnataka',
  required_quality: 'B', application: 'Coco peat production', max_price: '',
}

export default function Matches() {
  const { user, notify } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState(user?.role === 'buyer' ? 'buyer' : 'seller')
  const [sellerForm, setSellerForm] = useState(sellerInitial)
  const [buyerForm, setBuyerForm] = useState(buyerInitial)
  const [sellerMatches, setSellerMatches] = useState<SellerMatch[]>([])
  const [buyerMatches, setBuyerMatches] = useState<BuyerMatch[]>([])
  const [weights, setWeights] = useState<Record<string, number> | null>(null)
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null)
  const [sellerListings, setSellerListings] = useState<Listing[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [offerFor, setOfferFor] = useState<BuyerMatch | null>(null)
  const [offer, setOffer] = useState({ price: '', quantity: '', delivery_location: '', message: '' })
  const [buyFor, setBuyFor] = useState<BuyerMatch | null>(null)
  const [buyOrder, setBuyOrder] = useState({ quantity: '', delivery_location: '' })
  const [ranSeller, setRanSeller] = useState(false)
  const [ranBuyer, setRanBuyer] = useState(false)
  const identity = useApiData<{ user: User }>('/auth/me')
  const identityUser = identity.data?.user
  const canUseSellerIdentity = Boolean(
    identityUser && ['seller', 'buyer_seller', 'admin'].includes(identityUser.role),
  )
  const sellerId = user?.id || (canUseSellerIdentity ? identityUser?.id : '') || ''
  const showSeller = canSell(user?.role)
  const showBuyer = canBuy(user?.role)
  const activeTab = tab === 'seller' && !showSeller ? 'buyer' : tab === 'buyer' && !showBuyer ? 'seller' : tab

  async function runSeller() {
    setBusy(true)
    setError('')
    try {
      const params = {
        material_name: sellerForm.material_name,
        quantity: Number(sellerForm.quantity),
        unit: sellerForm.unit,
        location: sellerForm.location,
        quality_grade: sellerForm.quality_grade,
        price: Number(sellerForm.price),
      }
      const [matches, pricing, listings] = await Promise.all([
        api.post<{ items: SellerMatch[]; weights: Record<string, number> }>('/matching/seller', params),
        api.post<{ estimate: PriceEstimate }>('/pricing/estimate', params),
        api.get<{ items: Listing[] }>(`/listings?status=active&seller_id=${sellerId}`),
      ])
      setSellerMatches(matches.items)
      setWeights(matches.weights)
      setEstimate(pricing.estimate)
      setSellerListings(listings.items)
      setRanSeller(true)
      notify('Buyer requirements matched to your material.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function runBuyer() {
    setBusy(true)
    setError('')
    try {
      const result = await api.post<{ items: BuyerMatch[] }>('/matching/buyer', {
        material_name: buyerForm.material_name,
        quantity: Number(buyerForm.quantity),
        unit: buyerForm.unit,
        required_quality: buyerForm.required_quality,
        application: buyerForm.application,
        location: buyerForm.location,
        max_price: buyerForm.max_price ? Number(buyerForm.max_price) : undefined,
      })
      setBuyerMatches(result.items)
      setRanBuyer(true)
      notify('Suppliers matched to your requirement.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function sendEnquiry(requirementId: string) {
    if (!showSeller) {
      notify('Your account cannot send seller enquiries. Switch to a seller demo account.', 'error')
      return
    }
    const listing = sellerListings[0]
    if (!listing) {
      notify('Save this material as a listing first, then send an enquiry.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/enquiries', {
        listing_id: listing.id,
        requirement_id: requirementId,
        message: `Demo enquiry about ${sellerForm.quantity} ${sellerForm.unit} of ${sellerForm.material_name} from ${sellerForm.location}.`,
      })
      notify('Enquiry sent to the buyer.')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function sendRfq(match: BuyerMatch) {
    if (!showBuyer) {
      notify('Your account cannot send buyer enquiries. Switch to a buyer demo account.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/enquiries', {
        listing_id: match.listing.id,
        message: `Demo RFQ: please quote for ${buyerForm.quantity} ${buyerForm.unit} of ${buyerForm.material_name} for ${buyerForm.application || 'our process'}.`,
      })
      notify(`RFQ sent for ${match.listing.material_name}.`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openOffer(match: BuyerMatch) {
    setOfferFor(match)
    setOffer({
      price: String(match.listing.price),
      quantity: String(convertQuantity(Number(buyerForm.quantity), buyerForm.unit, match.listing.unit) || match.listing.quantity),
      delivery_location: buyerForm.location,
      message: '',
    })
  }

  async function submitOffer() {
    if (!offerFor) return
    if (!showBuyer) {
      notify('Your account cannot make buyer offers. Switch to a buyer demo account.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await api.post<{ negotiation: { id: string } }>('/offers', {
        listing_id: offerFor.listing.id,
        price: Number(offer.price),
        quantity: Number(offer.quantity),
        delivery_location: offer.delivery_location,
        message: offer.message,
      })
      setOfferFor(null)
      notify('Offer sent. The seller decides whether to accept, reject or counter.')
      navigate(`/negotiations/${result.negotiation.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openBuy(match: BuyerMatch) {
    setBuyFor(match)
    setBuyOrder({
      quantity: String(Math.min(convertQuantity(Number(buyerForm.quantity), buyerForm.unit, match.listing.unit) || match.listing.quantity, match.listing.quantity)),
      delivery_location: buyerForm.location,
    })
  }

  async function submitBuy() {
    if (!buyFor) return
    if (!showBuyer) {
      notify('Your account cannot place buyer orders. Switch to a buyer demo account.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await api.post<{ order: Order }>('/orders', {
        listing_id: buyFor.listing.id,
        quantity: Number(buyOrder.quantity),
        agreed_price: buyFor.listing.price,
        pickup_location: buyFor.listing.location,
        delivery_location: buyOrder.delivery_location,
        transport_agreed: false,
      })
      setBuyFor(null)
      notify('Order placed. The seller can see and accept it on their Seller Dashboard.')
      navigate(`/orders/${result.order.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Match engine"
        title="Explainable Matches"
        description="Weighted scoring uses material, quantity, location and quality. Scores indicate fit — they do not guarantee a deal."
        actions={<><Badge tone="purple"><Sparkles size={12} /> AI assisted</Badge><DemoBadge /></>}
      />

      {error && <div className="mb-5"><Alert tone="error" title="Matching failed">{error}</Alert></div>}

      <Tabs
        active={activeTab}
        onChange={setTab}
        items={[
          ...(showSeller ? [{ id: 'seller', label: 'Buyer requirement matches', count: sellerMatches.length || undefined }] : []),
          ...(showBuyer ? [{ id: 'buyer', label: 'Supplier matches', count: buyerMatches.length || undefined }] : []),
        ]}
      />

      {weights && (
        <div className="card mt-5 flex flex-wrap items-center gap-3 p-4 text-xs text-slate-600">
          <span className="font-semibold text-ink-900">Demo matching weights:</span>
          {Object.entries(weights).map(([key, value]) => <Badge key={key} tone="blue">{key} {Math.round(value * 100)}%</Badge>)}
          <span>Configurable on the server via environment variables.</span>
        </div>
      )}

      <div className="mt-6">
        {activeTab === 'seller' && (
          <>
            <div className="card mb-5 p-5">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900"><Handshake size={17} className="text-forest-600" /> Your material supply</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Material" required><Input value={sellerForm.material_name} onChange={(event) => setSellerForm({ ...sellerForm, material_name: event.target.value })} /></Field>
                <Field label="Quantity"><Input type="number" min="0" value={sellerForm.quantity} onChange={(event) => setSellerForm({ ...sellerForm, quantity: event.target.value })} /></Field>
                <Field label="Unit"><Select value={sellerForm.unit} onChange={(event) => setSellerForm({ ...sellerForm, unit: event.target.value })}>{['kg', 'tonne', 'litre', 'piece', 'other'].map((unit) => <option key={unit}>{unit}</option>)}</Select></Field>
                <Field label="Location"><Input value={sellerForm.location} onChange={(event) => setSellerForm({ ...sellerForm, location: event.target.value })} /></Field>
                <Field label="Quality grade"><Select value={sellerForm.quality_grade} onChange={(event) => setSellerForm({ ...sellerForm, quality_grade: event.target.value })}>{['A', 'B', 'C', 'ungraded'].map((grade) => <option key={grade}>{grade}</option>)}</Select></Field>
                <Field label="Your price / unit"><Input type="number" min="0" value={sellerForm.price} onChange={(event) => setSellerForm({ ...sellerForm, price: event.target.value })} /></Field>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                <Button onClick={runSeller} loading={busy}><Search size={15} /> Match with buyers</Button>
                <span className="self-center text-xs text-slate-500">You always set your own price.</span>
              </div>
            </div>

            {estimate && (
              <div className="mb-5"><Alert tone={estimate.insufficient_data ? 'warning' : 'info'} title={estimate.insufficient_data ? 'Insufficient market data.' : `Indicative reference: ${inr(estimate.suggested_typical_per_kg, 2)} / kg`}>
                {estimate.message || estimate.seller_control}
              </Alert></div>
            )}

            {ranSeller ? (
              sellerMatches.length ? (
                <div className="space-y-5">
                  {sellerMatches.slice(0, 8).map((item) => (
                    <SellerMatchItem key={item.requirement.id} item={item}>
                      <Button size="sm" onClick={() => sendEnquiry(item.requirement.id)} disabled={busy}><Mail size={14} /> Send enquiry</Button>
                    </SellerMatchItem>
                  ))}
                </div>
              ) : <Empty text="No buyer requirements matched this material yet." />
            ) : <Empty text="Run matching to see buyer requirements ranked by fit." />}
          </>
        )}

        {activeTab === 'buyer' && (
          <>
            <div className="card mb-5 p-5">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900"><Search size={17} className="text-forest-600" /> What you need</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Required material" required><Input value={buyerForm.material_name} onChange={(event) => setBuyerForm({ ...buyerForm, material_name: event.target.value })} /></Field>
                <Field label="Quantity"><Input type="number" min="0" value={buyerForm.quantity} onChange={(event) => setBuyerForm({ ...buyerForm, quantity: event.target.value })} /></Field>
                <Field label="Unit"><Select value={buyerForm.unit} onChange={(event) => setBuyerForm({ ...buyerForm, unit: event.target.value })}>{['kg', 'tonne', 'litre', 'piece', 'other'].map((unit) => <option key={unit}>{unit}</option>)}</Select></Field>
                <Field label="Required quality"><Select value={buyerForm.required_quality} onChange={(event) => setBuyerForm({ ...buyerForm, required_quality: event.target.value })}>{['A', 'B', 'C', 'ungraded', 'raw', 'dried', 'processed'].map((grade) => <option key={grade}>{grade}</option>)}</Select></Field>
                <Field label="Location"><Input value={buyerForm.location} onChange={(event) => setBuyerForm({ ...buyerForm, location: event.target.value })} /></Field>
                <Field label="Maximum price / unit"><Input type="number" min="0" value={buyerForm.max_price} onChange={(event) => setBuyerForm({ ...buyerForm, max_price: event.target.value })} /></Field>
                <Field label="Application" className="sm:col-span-2 lg:col-span-3"><Input value={buyerForm.application} onChange={(event) => setBuyerForm({ ...buyerForm, application: event.target.value })} /></Field>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-5"><Button onClick={runBuyer} loading={busy}><Handshake size={15} /> Match with suppliers</Button></div>
            </div>

            {ranBuyer ? (
              buyerMatches.length ? (
                <div className="space-y-5">
                  {buyerMatches.slice(0, 8).map((item) => (
                    <BuyerMatchItem key={item.listing.id} item={item}>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => sendRfq(item)} disabled={busy}><Mail size={14} /> Request quote</Button>
                        <Button size="sm" variant="secondary" onClick={() => openOffer(item)} disabled={busy}><Tag size={14} /> Negotiate</Button>
                        <Button size="sm" onClick={() => openBuy(item)} disabled={busy}><ShoppingBag size={14} /> Buy now</Button>
                      </div>
                    </BuyerMatchItem>
                  ))}
                </div>
              ) : <Empty text="No supplier listings matched this requirement yet." />
            ) : <Empty text="Run matching to see supplier listings ranked by fit." />}
          </>
        )}
      </div>

      <Modal
        open={Boolean(offerFor)}
        onClose={() => setOfferFor(null)}
        title="Make an offer"
        description={offerFor ? `${offerFor.listing.material_name} · listed at ${inr(offerFor.listing.price, 2)}/${offerFor.listing.unit}` : ''}
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setOfferFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitOffer} loading={busy}>Send offer</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Proposed price / ${offerFor?.listing.unit || 'unit'}`} required><Input type="number" min="0" value={offer.price} onChange={(event) => setOffer({ ...offer, price: event.target.value })} /></Field>
          <Field label={`Quantity (${offerFor?.listing.unit || 'units'})`} required><Input type="number" min="0" value={offer.quantity} onChange={(event) => setOffer({ ...offer, quantity: event.target.value })} /></Field>
          <Field label="Delivery location"><Input value={offer.delivery_location} onChange={(event) => setOffer({ ...offer, delivery_location: event.target.value })} /></Field>
          <Field label="Message"><Input value={offer.message} onChange={(event) => setOffer({ ...offer, message: event.target.value })} /></Field>
        </div>
        <div className="mt-4"><Alert tone="info">You control the offer. AI never accepts or rejects automatically.</Alert></div>
      </Modal>

      <Modal
        open={Boolean(buyFor)}
        onClose={() => setBuyFor(null)}
        title="Buy at listed price"
        description={buyFor ? `${buyFor.listing.material_name} · ${inr(buyFor.listing.price, 2)}/${buyFor.listing.unit} · available ${num(buyFor.listing.quantity)} ${buyFor.listing.unit}` : ''}
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setBuyFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitBuy} loading={busy}>Place order</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Quantity (${buyFor?.listing.unit || 'units'})`} required><Input type="number" min="1" max={buyFor?.listing.quantity || undefined} value={buyOrder.quantity} onChange={(e) => setBuyOrder({ ...buyOrder, quantity: e.target.value })} /></Field>
          <Field label="Listed price / unit"><Input value={buyFor ? `${inr(buyFor.listing.price, 2)} / ${buyFor.listing.unit}` : ''} readOnly /></Field>
          <Field label="Delivery location" className="sm:col-span-2"><Input value={buyOrder.delivery_location} onChange={(e) => setBuyOrder({ ...buyOrder, delivery_location: e.target.value })} /></Field>
        </div>
      </Modal>
    </DashboardLayout>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card p-10 text-center">
      <Handshake size={27} className="mx-auto mb-3 text-forest-600" />
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )
}
