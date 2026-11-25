import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Filter, Mail, Search, ShoppingBag, Sparkles, Tag } from 'lucide-react'
import { PublicLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '../components/ui'
import { BuyerMatchItem } from '../components/domain'
import { api } from '../lib/api'
import { canBuy } from '../lib/permissions'
import type { BuyerMatch, Order, Requirement } from '../lib/types'
import { convertQuantity, inr, num } from '../lib/utils'
import { useApp } from '../state/AppContext'

interface ExtractedFields {
  material_name: string
  quantity: number | null
  unit: string
  required_quality: string
  application: string
  location: string
  max_price: number | null
  delivery_date: string | null
  alternatives_allowed: boolean
  confidence?: string
  source?: string
  is_ai_generated?: boolean
}

const emptyFields: ExtractedFields = {
  material_name: '', quantity: null, unit: 'kg', required_quality: 'ungraded',
  application: '', location: '', max_price: null, delivery_date: null, alternatives_allowed: false,
}

export default function FindMaterials() {
  const [text, setText] = useState('I need 2 tonnes of raw coconut husk in Karnataka for coco peat production.')
  const [fields, setFields] = useState<ExtractedFields>(emptyFields)
  const [source, setSource] = useState('')
  const [matches, setMatches] = useState<BuyerMatch[]>([])
  const [requirement, setRequirement] = useState<Requirement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'assistant' | 'results'>('assistant')
  const [filter, setFilter] = useState({ material: '', location: '', max_price: '', available_only: true })
  const [offerFor, setOfferFor] = useState<BuyerMatch | null>(null)
  const [offer, setOffer] = useState({ price: '', quantity: '', delivery_location: '', message: '' })
  const [buyFor, setBuyFor] = useState<BuyerMatch | null>(null)
  const [buyOrder, setBuyOrder] = useState({ quantity: '', delivery_location: '' })
  const { user, notify } = useApp()
  const navigate = useNavigate()
  const maySaveRequirement = canBuy(user?.role)
  const mayOffer = canBuy(user?.role)

  const setField = (key: keyof ExtractedFields, value: unknown) => setFields((current) => ({ ...current, [key]: value }))

  async function extract() {
    setBusy(true)
    setError('')
    try {
      const result = await api.post<{ fields: ExtractedFields }>('/requirements/extract', { text })
      setFields({ ...emptyFields, ...result.fields })
      setSource(result.fields.source || '')
      notify('Requirements extracted. Review and edit before searching.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function search(saveFirst = false) {
    if (saveFirst && !maySaveRequirement) {
      notify('Your account cannot publish buyer requirements. Switch to a buyer demo account.', 'error')
      return
    }
    setBusy(true)
    setError('')
    try {
      let requirementId: string | undefined
      if (saveFirst) {
        const saved = await api.post<{ item: Requirement }>('/requirements', {
          material_name: fields.material_name,
          quantity: Number(fields.quantity || 0),
          unit: fields.unit,
          required_quality: fields.required_quality,
          application: fields.application,
          location: fields.location,
          max_price: fields.max_price,
          delivery_date: fields.delivery_date,
          alternatives_allowed: fields.alternatives_allowed,
        })
        requirementId = saved.item.id
        setRequirement(saved.item)
        notify('Requirement saved as a published requirement (not confirmed demand).')
      }
      const result = await api.post<{ items: BuyerMatch[]; requirement: ExtractedFields }>('/matching/buyer', {
        requirement_id: requirementId,
        material_name: fields.material_name,
        quantity: Number(fields.quantity || 0),
        unit: fields.unit,
        required_quality: fields.required_quality,
        application: fields.application,
        location: fields.location,
        max_price: fields.max_price,
        material_filter: filter.material,
        location_filter: filter.location,
        max_price_filter: filter.max_price ? Number(filter.max_price) : undefined,
        available_only: filter.available_only,
      })
      setMatches(result.items)
      setTab('results')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function requestQuote(match: BuyerMatch) {
    if (!mayOffer) {
      notify('Your account cannot send buyer enquiries. Switch to a buyer demo account.', 'error')
      return
    }
    if (user && match.listing.seller_id === user.id) {
      notify('This is your own listing. Ask a buyer through published requirements instead.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/enquiries', {
        listing_id: match.listing.id,
        requirement_id: requirement?.id,
        message: `Demo RFQ: please quote for ${fields.quantity} ${fields.unit} of ${fields.material_name} for ${fields.application || 'our production process'}.`,
      })
      notify(`RFQ sent to ${match.supplier_name}.`)
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
      // Offers are priced in the listing's unit. Convert the buyer's requested
      // quantity (e.g. 2 tonnes) into that unit (e.g. 2000 kg).
      quantity: String(convertQuantity(fields.quantity, fields.unit, match.listing.unit) || match.listing.quantity),
      delivery_location: fields.location,
      message: '',
    })
  }

  async function submitOffer() {
    if (!offerFor) return
    if (!mayOffer) {
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
      notify('Offer sent. The seller can accept, reject or counter it on their Seller Dashboard.')
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
      quantity: String(Math.min(convertQuantity(fields.quantity, fields.unit, match.listing.unit) || match.listing.quantity, match.listing.quantity)),
      delivery_location: fields.location,
    })
  }

  async function submitBuy() {
    if (!buyFor) return
    if (!mayOffer) {
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
    <PublicLayout>
      <div className="container-page py-10">
        <PageHeader
          eyebrow="Buyer workflow"
          title="Find Materials with AI assistance"
          description="Describe what you need in plain language, review the structured fields, then compare suppliers with explainable match scores."
          actions={<DemoBadge />}
        />

        {error && <div className="mb-5"><Alert tone="error">{error}</Alert></div>}

        <Tabs
          active={tab}
          onChange={(value) => setTab(value as 'assistant' | 'results')}
          items={[{ id: 'assistant', label: 'Requirement assistant' }, { id: 'results', label: 'Supplier matches', count: matches.length }]}
        />

        <div className="mt-6">
          {tab === 'assistant' && (
            <div className="card p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-ink-900"><Sparkles size={18} className="text-purple-600" /> AI Material Requirement Assistant</h2>
                  <p className="mt-1 text-sm text-slate-600">Example: “I need 2 tonnes of raw coconut husk in Karnataka for coco peat production.”</p>
                  <Textarea className="mt-4 min-h-[150px]" value={text} onChange={(event) => setText(event.target.value)} />
                  <Button className="mt-3" onClick={extract} loading={busy} disabled={busy}><Sparkles size={15} /> Extract structured requirements</Button>
                  {source && <p className="mt-3 text-[11px] text-slate-500">Extraction source: {source}</p>}
                  <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4 text-xs leading-relaxed text-purple-900">
                    Extracted fields are editable. AI never commits a requirement or sends an enquiry without your action.
                  </div>
                </div>
                <div>
                  <h3 className="mb-4 font-bold text-ink-900">Structured requirement <span className="text-xs font-medium text-slate-500">(editable)</span></h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Required material" required><Input value={fields.material_name} onChange={(e) => setField('material_name', e.target.value)} /></Field>
                    <Field label="Quantity" required><Input type="number" min="0" value={fields.quantity ?? ''} onChange={(e) => setField('quantity', e.target.value ? Number(e.target.value) : null)} /></Field>
                    <Field label="Unit"><Select value={fields.unit} onChange={(e) => setField('unit', e.target.value)}>{['kg', 'tonne', 'litre', 'piece', 'other'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
                    <Field label="Required quality"><Select value={fields.required_quality} onChange={(e) => setField('required_quality', e.target.value)}>{['ungraded', 'raw', 'dried', 'processed', 'A', 'B', 'C'].map((q) => <option key={q}>{q}</option>)}</Select></Field>
                    <Field label="Intended application"><Input value={fields.application} onChange={(e) => setField('application', e.target.value)} /></Field>
                    <Field label="Location"><Input value={fields.location} onChange={(e) => setField('location', e.target.value)} /></Field>
                    <Field label="Maximum acceptable price (₹/unit)"><Input type="number" min="0" value={fields.max_price ?? ''} onChange={(e) => setField('max_price', e.target.value ? Number(e.target.value) : null)} /></Field>
                    <Field label="Required delivery date"><Input type="date" value={fields.delivery_date ?? ''} onChange={(e) => setField('delivery_date', e.target.value || null)} /></Field>
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm text-ink-800">
                    <input type="checkbox" className="h-4 w-4 accent-forest-600" checked={fields.alternatives_allowed} onChange={(e) => setField('alternatives_allowed', e.target.checked)} />
                    Alternative materials allowed
                  </label>
                  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                    <Button size="lg" onClick={() => search(false)} loading={busy} disabled={busy}><Search size={16} /> Find matching suppliers</Button>
                    {maySaveRequirement && <Button size="lg" variant="secondary" onClick={() => search(true)} loading={busy} disabled={busy}><FileText size={16} /> Save requirement & search</Button>}
                    <Link to="/requirements" className="btn-ghost btn-lg">{maySaveRequirement ? 'My requirements' : 'Browse requirements'}</Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'results' && (
            <>
              <div className="card mb-5 flex flex-wrap items-end gap-4 p-5">
                <div className="min-w-[180px] flex-1"><Field label="Material"><Input value={filter.material} onChange={(e) => setFilter({ ...filter, material: e.target.value })} placeholder="Filter by material" /></Field></div>
                <div className="min-w-[180px] flex-1"><Field label="Location"><Input value={filter.location} onChange={(e) => setFilter({ ...filter, location: e.target.value })} placeholder="Filter by location" /></Field></div>
                <div className="min-w-[150px]"><Field label="Max price / unit"><Input type="number" min="0" value={filter.max_price} onChange={(e) => setFilter({ ...filter, max_price: e.target.value })} /></Field></div>
                <label className="flex items-center gap-2 pb-2 text-sm text-ink-800"><input type="checkbox" className="h-4 w-4 accent-forest-600" checked={filter.available_only} onChange={(e) => setFilter({ ...filter, available_only: e.target.checked })} /> Available only</label>
                <Button variant="secondary" onClick={() => search(false)} loading={busy} disabled={busy}><Filter size={15} /> Apply filters</Button>
              </div>
              {requirement && <div className="mb-4"><Alert tone="success" title="Requirement published">Saved as “Published requirement” — it is not marked as confirmed demand until you confirm it.</Alert></div>}
              {matches.length ? (
                <div className="space-y-5">
                  {matches.map((item) => (
                    <BuyerMatchItem key={item.listing.id} item={item}>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => requestQuote(item)} loading={busy} disabled={busy}><Mail size={14} /> Request quotation</Button>
                        {mayOffer && <Button size="sm" variant="secondary" onClick={() => openOffer(item)} disabled={busy}><Tag size={14} /> Negotiate</Button>}
                        {mayOffer && <Button size="sm" onClick={() => openBuy(item)} disabled={busy}><ShoppingBag size={14} /> Buy now</Button>}
                      </div>
                    </BuyerMatchItem>
                  ))}
                </div>
              ) : (
                <div className="card p-10 text-center">
                  <Search size={28} className="mx-auto mb-3 text-forest-600" />
                  <p className="font-bold text-ink-900">No supplier matches yet</p>
                  <p className="mt-1 text-sm text-slate-500">Adjust your filters or save and search again.</p>
                  <Button className="mt-4" onClick={() => setTab('assistant')}>Edit requirements <ArrowRight size={14} /></Button>
                </div>
              )}
            </>
          )}
        </div>

        <Modal
          open={Boolean(offerFor)}
          onClose={() => setOfferFor(null)}
          title="Make an offer"
          description={offerFor ? `${offerFor.listing.material_name} · listed at ₹${offerFor.listing.price}/${offerFor.listing.unit}` : ''}
          dismissible={!busy}
          footer={<><Button variant="secondary" onClick={() => setOfferFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitOffer} loading={busy} disabled={busy}>Send offer</Button></>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Proposed price (₹ per ${offerFor?.listing.unit || 'unit'})`} required><Input type="number" min="0" value={offer.price} onChange={(e) => setOffer({ ...offer, price: e.target.value })} /></Field>
            <Field label={`Required quantity (${offerFor?.listing.unit || 'units'})`} required><Input type="number" min="0" value={offer.quantity} onChange={(e) => setOffer({ ...offer, quantity: e.target.value })} /></Field>
            <Field label="Delivery location"><Input value={offer.delivery_location} onChange={(e) => setOffer({ ...offer, delivery_location: e.target.value })} /></Field>
            <Field label="Optional message"><Input value={offer.message} onChange={(e) => setOffer({ ...offer, message: e.target.value })} /></Field>
          </div>
          <div className="mt-4"><Alert tone="info">You control this offer. The seller may accept, reject or counter it — AI never decides for you.</Alert></div>
        </Modal>

        <Modal
          open={Boolean(buyFor)}
          onClose={() => setBuyFor(null)}
          title="Buy at listed price"
          description={buyFor ? `${buyFor.listing.material_name} · ${inr(buyFor.listing.price, 2)}/${buyFor.listing.unit} · available ${num(buyFor.listing.quantity)} ${buyFor.listing.unit}` : ''}
          dismissible={!busy}
          footer={<><Button variant="secondary" onClick={() => setBuyFor(null)} disabled={busy}>Cancel</Button><Button onClick={submitBuy} loading={busy} disabled={busy}>Place order</Button></>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Quantity (${buyFor?.listing.unit || 'units'})`} required><Input type="number" min="1" max={buyFor?.listing.quantity || undefined} value={buyOrder.quantity} onChange={(e) => setBuyOrder({ ...buyOrder, quantity: e.target.value })} /></Field>
            <Field label="Listed price / unit"><Input value={buyFor ? `${inr(buyFor.listing.price, 2)} / ${buyFor.listing.unit}` : ''} readOnly /></Field>
            <Field label="Delivery location" className="sm:col-span-2"><Input value={buyOrder.delivery_location} onChange={(e) => setBuyOrder({ ...buyOrder, delivery_location: e.target.value })} /></Field>
          </div>
        </Modal>
      </div>
    </PublicLayout>
  )
}
