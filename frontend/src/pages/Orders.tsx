import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote, CheckCircle2, CircleDollarSign, Clock, PackagePlus, PackageSearch, Plus, RefreshCw,
  ShieldCheck, Tag, Truck, XCircle,
} from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import {
  Alert, Badge, Button, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingGrid, Modal,
  PageHeader, Select, StatusBadge, Tabs, Textarea,
} from '../components/ui'
import { PriceBreakdown, SHIPMENT_STEPS, TrackingTimeline } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import { canBuy, canSell } from '../lib/permissions'
import type { Listing, Order, Payment, Refund, Shipment } from '../lib/types'
import { dateTime, inr, newestFirst, num, titleCase } from '../lib/utils'
import { useApp } from '../state/AppContext'

interface OrderDetail {
  order: Order
  listing: Listing | null
  payments: Payment[]
  refunds: Refund[]
  shipment: Shipment | null
  seller_bank: null
  fee_policy: { seller_fee: number; note: string }
}

interface BankDetails {
  account_holder?: string | null
  bank_name?: string | null
  account_number_masked?: string | null
  ifsc?: string | null
  upi?: string | null
  note: string
}

interface FeePolicy {
  cancellation_policy: Array<{ stage: string; terms: string }>
  advance: string
  balance: string
  note: string
}

interface Transporter {
  id: string
  name: string
  vehicle_type?: string
  location?: string
}

interface BuyerOption {
  id: string
  full_name: string
  role: string
  business_name: string
  location: string
}

export default function Orders() {
  const { user, notify } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { orderId } = useParams<{ orderId?: string }>()
  const selectedId = orderId || null
  const [tab, setTab] = useState('all')
  const [busy, setBusy] = useState(false)
  const [bank, setBank] = useState<BankDetails | null>(null)
  const [utr, setUtr] = useState('')
  const [balanceUtr, setBalanceUtr] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', order_stage: 'Before preparation' })
  const [refundResponse, setRefundResponse] = useState<Refund | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [newOrder, setNewOrder] = useState({ listing_id: '', buyer_id: '', quantity: '', agreed_price: '', delivery_location: '', pickup_location: '' })
  const [negotiateOpen, setNegotiateOpen] = useState(false)
  const [negForm, setNegForm] = useState({ price: '', quantity: '', delivery_location: '', message: '' })
  const [transportForm, setTransportForm] = useState({ vehicle_type: '', transport_payer: 'buyer', transporter_id: '', agreed: false })
  const [shipmentStatus, setShipmentStatus] = useState('preparing_material')

  const isSellerAccount = user?.role === 'seller'
  const maySendSellerOrder = canSell(user?.role)
  const mayPlaceOrder = canBuy(user?.role) || isSellerAccount
  const ordersQuery = useApiData<{ items: Order[] }>('/orders')
  const listingsQuery = useApiData<{ items: Listing[] }>(isSellerAccount ? '/listings/mine?status=active' : '/listings?status=active', [isSellerAccount])
  const buyersQuery = useApiData<{ items: BuyerOption[] }>(maySendSellerOrder ? '/buyers' : null, [maySendSellerOrder])
  const transportersQuery = useApiData<{ items: Transporter[] }>('/transporters')
  const feeQuery = useApiData<FeePolicy>('/fee-policy')
  const detail = useApiData<OrderDetail>(selectedId ? `/orders/${selectedId}` : null, [selectedId])

  const orders = newestFirst(ordersQuery.data?.items || [])
  const selectedOrder = orders.find((order) => order.id === selectedId) || detail.data?.order || null
  const isAdmin = user?.role === 'admin'
  // Side is determined by order ownership, not just the account role: a
  // buyer+seller demo account can sit on either side of a given order.
  const isOrderSeller = Boolean(selectedOrder && (isAdmin || (user && selectedOrder.seller_id === user.id)))
  const isOrderBuyer = Boolean(selectedOrder && (isAdmin || (user && selectedOrder.buyer_id === user.id)))
  const orderStatus = detail.data?.order.status || selectedOrder?.status
  const isClosedOrder = orderStatus === 'cancelled' || orderStatus === 'completed'
  const isAwaitingAcceptance = orderStatus === 'awaiting_seller_acceptance' || orderStatus === 'awaiting_buyer_confirmation'
  const payments = detail.data?.payments || []
  const balancePayment = payments.find((payment) => payment.type === 'balance')
  const balanceSubmitted = balancePayment?.status === 'submitted' && Boolean(balancePayment.utr)
  const refundableAdvance = ['submitted', 'confirmed', 'refund_requested'].includes(
    detail.data?.order.advance_status || selectedOrder?.advance_status || '',
  )
  const currentMilestone = detail.data?.shipment?.status || orderStatus || 'order_confirmed'
  const currentMilestoneIndex = SHIPMENT_STEPS.findIndex((step) => step.id === currentMilestone)

  const filtered = orders.filter((order) => {
    if (tab === 'all') return true
    if (tab === 'awaiting') return ['awaiting_seller_acceptance', 'awaiting_buyer_confirmation', 'advance_pending', 'advance_submitted'].includes(order.status)
    if (tab === 'active') return ['advance_paid', 'preparing', 'shipment_scheduled', 'shipped', 'in_transit', 'out_for_delivery'].includes(order.status)
    return ['delivered', 'completed', 'cancelled'].includes(order.status)
  })

  function refresh() {
    detail.reload()
    ordersQuery.reload()
  }

  // URL-driven detail views must reset transient state when the selected
  // order changes, including browser back/forward navigation.
  useEffect(() => {
    setBank(null)
    setUtr('')
    setBalanceUtr('')
    setCancelOpen(false)
    setRefundOpen(false)
    setRefundResponse(null)
    setTransportForm({ vehicle_type: '', transport_payer: 'buyer', transporter_id: '', agreed: false })
    setShipmentStatus('preparing_material')
  }, [selectedId])

  useEffect(() => {
    const status = detail.data?.shipment?.status || detail.data?.order.status
    if (!status) return
    const index = SHIPMENT_STEPS.findIndex((step) => step.id === status)
    setShipmentStatus(SHIPMENT_STEPS[index + 1]?.id || status)
  }, [detail.data?.order.id, detail.data?.order.status])

  function select(order: Order) {
    navigate(`/orders/${order.id}`)
  }

  async function run(action: () => Promise<unknown>, message: string): Promise<boolean> {
    setBusy(true)
    try {
      await action()
      notify(message)
      refresh()
      return true
    } catch (err) {
      notify((err as Error).message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function loadBank() {
    if (!selectedId) return
    try {
      const result = await api.get<BankDetails>(`/orders/${selectedId}/bank-details`)
      setBank(result)
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  async function submitUtr() {
    if (!selectedId) return
    if (utr.trim().length < 6) {
      notify('Enter a valid UTR / payment reference (at least 6 characters).', 'error')
      return
    }
    const ok = await run(
      () => api.post(`/orders/${selectedId}/submit-utr`, { utr, type: 'advance' }),
      'Reference submitted. The order is not marked paid until the seller confirms receipt.',
    )
    if (ok) setUtr('')
  }

  async function submitBalance() {
    if (!selectedId) return
    if (balanceUtr.trim().length < 6) {
      notify('Enter a valid balance reference (at least 6 characters).', 'error')
      return
    }
    const ok = await run(
      () => api.post(`/orders/${selectedId}/submit-utr`, { utr: balanceUtr, type: 'balance' }),
      'Balance reference submitted. The seller must confirm receipt; no real transfer occurred.',
    )
    if (ok) setBalanceUtr('')
  }

  async function confirmAdvance() {
    if (!selectedId) return
    await run(
      () => api.post(`/orders/${selectedId}/confirm-advance`, { confirmed: true }),
      'Advance confirmed by seller. Do not transfer real money.',
    )
  }

  async function confirmBalance() {
    if (!selectedId) return
    await run(() => api.post(`/orders/${selectedId}/confirm-balance`), 'Balance confirmed in demo mode.')
  }

  async function cancelOrder() {
    if (!selectedId || !cancelReason.trim()) {
      notify('A cancellation reason is required.', 'error')
      return
    }
    const ok = await run(() => api.post(`/orders/${selectedId}/cancel`, { reason: cancelReason }), 'Cancellation recorded. Submit a refund request if applicable.')
    if (ok) {
      setCancelOpen(false)
      setCancelReason('')
    }
  }

  async function requestRefund() {
    if (!selectedId || !refundForm.reason.trim()) {
      notify('A refund reason is required.', 'error')
      return
    }
    const ok = await run(
      () => api.post(`/orders/${selectedId}/refund-request`, {
        amount: Number(refundForm.amount || detail.data?.order.advance_amount || 0),
        reason: refundForm.reason,
        order_stage: refundForm.order_stage,
      }),
      'Refund request sent to the seller for review.',
    )
    if (ok) {
      setRefundOpen(false)
      setRefundForm({ amount: '', reason: '', order_stage: 'Before preparation' })
    }
  }

  async function respondRefund() {
    if (!refundResponse) return
    const ok = await run(
      () => api.patch(`/refunds/${refundResponse.id}`, {
        status: refundResponse.status,
        seller_response: refundResponse.seller_response,
      }),
      `Refund marked ${refundResponse.status.replace('_', ' ')}.`,
    )
    if (ok) setRefundResponse(null)
  }

  async function agreeTransport() {
    if (!selectedId) return
    if (!transportForm.agreed) {
      notify('Tick “Terms agreed” before saving the transport arrangement.', 'error')
      return
    }
    await run(
      () => api.post(`/orders/${selectedId}/transport`, {
        pickup_location: detail.data?.order.pickup_location,
        delivery_location: detail.data?.order.delivery_location,
        vehicle_type: transportForm.vehicle_type || undefined,
        transport_payer: transportForm.transport_payer,
        transporter_id: transportForm.transporter_id || undefined,
        agreed: transportForm.agreed,
      }),
      'Transport details agreed. The estimate is indicative; ReSource AI does not own vehicles.',
    )
  }

  async function updateShipment() {
    if (!selectedId) return
    await run(
      () => api.post(`/orders/${selectedId}/shipment-status`, { status: shipmentStatus, note: 'Manual status update by seller or transporter (demo).' }),
      'Shipment status updated manually. No real-time GPS tracking is integrated.',
    )
  }

  function openNewOrder() {
    const first = listingsQuery.data?.items[0]
    const firstBuyer = buyersQuery.data?.items[0]
    setNewOrder({
      listing_id: first?.id || '',
      buyer_id: firstBuyer?.id || '',
      quantity: String(first?.quantity || ''),
      agreed_price: String(first?.price || ''),
      delivery_location: firstBuyer?.location || '',
      pickup_location: first?.location || '',
    })
    setOrderOpen(true)
  }

  useEffect(() => {
    if (searchParams.get('new') !== '1' || selectedId || !mayPlaceOrder) return
    if (!listingsQuery.loading && (!maySendSellerOrder || !buyersQuery.loading)) {
      openNewOrder()
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, selectedId, listingsQuery.loading, buyersQuery.loading])

  async function createOrder() {
    if (!mayPlaceOrder) {
      notify('Your account cannot create orders.', 'error')
      return
    }
    if (!newOrder.listing_id || !newOrder.quantity || !newOrder.agreed_price) {
      notify('Choose a listing, quantity and agreed price.', 'error')
      return
    }
    if (isSellerAccount && !newOrder.buyer_id) {
      notify('Choose a buyer to receive this order.', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await api.post<{ order: Order; message?: string }>('/orders', {
        ...newOrder,
        buyer_id: isSellerAccount ? newOrder.buyer_id : undefined,
        quantity: Number(newOrder.quantity),
        agreed_price: Number(newOrder.agreed_price),
        transport_agreed: false,
      })
      notify(result.message || 'Order created.')
      setOrderOpen(false)
      ordersQuery.reload()
      navigate(`/orders/${result.order.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitOrderNegotiation() {
    if (!detail.data) return
    setBusy(true)
    try {
      const result = await api.post<{ negotiation: { id: string } }>('/offers', {
        listing_id: detail.data.order.listing_id,
        price: Number(negForm.price),
        quantity: Number(negForm.quantity),
        delivery_location: negForm.delivery_location,
        message: negForm.message,
      })
      notify('Negotiation offer sent to the seller.')
      setNegotiateOpen(false)
      navigate(`/negotiations/${result.negotiation.id}`)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Order workspace"
        title="Orders, Payments & Tracking"
        description="A 20% advance is paid directly to the seller and never marked as received until the seller explicitly confirms it."
        actions={<>{mayPlaceOrder && <Button onClick={openNewOrder}><Plus size={16} /> {isSellerAccount ? 'Send order to buyer' : 'New order'}</Button>}<DemoBadge /></>}
      />

      <Alert tone="warning" title="Demo payment workflow">
        No real money is transferred. Submitting a UTR only records a reference; the seller must verify receipt manually. Bank details are masked and visible only to the order's buyer after acceptance.
      </Alert>

      {ordersQuery.error && <div className="mt-5"><ErrorState message={ordersQuery.error} onRetry={ordersQuery.reload} /></div>}

      {!selectedId ? (
        <>
          <div className="mt-6">
            <Tabs active={tab} onChange={setTab} items={[
              { id: 'all', label: 'All orders', count: orders.length },
              { id: 'awaiting', label: 'Awaiting advance' },
              { id: 'active', label: 'In progress' },
              { id: 'completed', label: 'Closed' },
            ]} />
          </div>
          <div className="mt-5">
            {ordersQuery.loading ? <LoadingGrid count={3} /> : filtered.length ? (
              <div className="grid-auto">
                {filtered.map((order) => (
                  <button key={order.id} onClick={() => select(order)} className="card card-hover p-5 text-left">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-ink-900"><PackageSearch size={17} className="text-forest-600" /> {order.material_name}</div>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-slate-500">{order.id} · {num(order.quantity)} {order.unit} · {inr(order.agreed_price, 2)}/unit</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-[11px] uppercase text-slate-500">Material value</p><p className="font-semibold">{inr(order.total_value)}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-500">Advance (20%)</p><p className="font-semibold text-forest-700">{inr(order.advance_amount)}</p></div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <Badge tone={order.advance_status === 'confirmed' ? 'green' : 'amber'}>Advance {titleCase(order.advance_status)}</Badge>
                      <DemoBadge>Prototype order · no real transaction</DemoBadge>
                    </div>
                  </button>
                ))}
              </div>
            ) : <EmptyState icon={<PackageSearch size={22} />} title="No orders in this view" description={isSellerAccount ? 'Send an order to a buyer from one of your active listings, or wait for a buyer purchase.' : 'Create an order from an agreed negotiation or an active listing.'} action={mayPlaceOrder ? <Button onClick={openNewOrder}>{isSellerAccount ? 'Send order to buyer' : 'New order'}</Button> : undefined} />}
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate('/orders')}>← All orders</Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>
              {selectedOrder && <StatusBadge status={selectedOrder.status} />}
            </div>
          </div>

          {detail.loading ? <LoadingGrid count={2} /> : detail.data ? (
            <>
              <div className="card p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">Order {detail.data.order.id}</p>
                    <h3 className="mt-1 text-xl font-bold text-ink-900">{detail.data.order.material_name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {num(detail.data.order.quantity)} {detail.data.order.unit} · {inr(detail.data.order.agreed_price, 2)} / unit
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue"><Truck size={12} /> {titleCase(detail.data.order.transport_payer)} pays transport</Badge>
                    <DemoBadge>Prototype order · no real transaction</DemoBadge>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <PriceBreakdown order={detail.data.order} />
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="label">Order terms</p>
                    <p className="text-sm leading-relaxed text-slate-700">{detail.data.order.terms || 'Terms to be agreed between buyer and seller.'}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p><span className="text-slate-500">Pickup:</span> <strong>{detail.data.order.pickup_location || '—'}</strong></p>
                      <p><span className="text-slate-500">Delivery:</span> <strong>{detail.data.order.delivery_location || '—'}</strong></p>
                      <p><span className="text-slate-500">Estimated delivery:</span> <strong>{detail.data.order.estimated_delivery || 'To be agreed'}</strong></p>
                      <p><span className="text-slate-500">Balance:</span> <strong>{titleCase(detail.data.order.balance_status)}</strong></p>
                      <p><span className="text-slate-500">Buyer confirmed terms:</span> <strong>{dateTime(detail.data.order.buyer_confirmed_at)}</strong></p>
                      <p><span className="text-slate-500">Seller accepted:</span> <strong>{dateTime(detail.data.order.seller_accepted_at)}</strong></p>
                    </div>
                    {detail.data.order.cancellation_reason && (
                      <div className="mt-4"><Alert tone="error" title="Cancelled">Reason: {detail.data.order.cancellation_reason}</Alert></div>
                    )}
                  </div>
                </div>
              </div>

              {detail.data.order.status === 'awaiting_buyer_confirmation' && isOrderBuyer && (
                <div className="card border-forest-200 bg-forest-50/50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-forest-900">Order received from seller</p>
                      <p className="mt-1 text-sm text-forest-800/80">Review the quantity and price above. Confirm to buy now, or send a counteroffer to negotiate.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => run(() => api.post(`/orders/${detail.data!.order.id}/buyer-accept`), 'Order confirmed. Demo bank details are now available.')} loading={busy}>
                        <CheckCircle2 size={14} /> Accept & Buy
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setNegForm({
                            price: String(detail.data!.order.agreed_price),
                            quantity: String(detail.data!.order.quantity),
                            delivery_location: detail.data!.order.delivery_location,
                            message: `Negotiating order ${detail.data!.order.id}`,
                          })
                          setNegotiateOpen(true)
                        }}
                        disabled={busy}
                      >
                        <Tag size={14} /> Negotiate price
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className={`grid gap-5 ${isOrderSeller ? 'lg:grid-cols-2' : ''}`}>
                <section className="card p-5">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><CircleDollarSign size={17} className="text-forest-600" /> Payment evidence</h4>
                  {detail.data.payments.length ? (
                    <div className="space-y-3">
                      {detail.data.payments.map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-slate-200 p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{titleCase(payment.type)} · {inr(payment.amount, 2)}</p>
                            <StatusBadge status={payment.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Method: {titleCase(payment.method)} · {payment.utr ? `Reference ${payment.utr}` : 'No reference submitted'}</p>
                          <p className="mt-1 text-[11px] text-slate-500">Submitted {dateTime(payment.submitted_at)} · Confirmed {dateTime(payment.confirmed_at)}</p>
                          {payment.note && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{payment.note}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No payment record yet.</p>}
                  {isOrderBuyer && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="label">Direct bank transfer reference (buyer)</p>
                      {detail.data.order.status === 'awaiting_buyer_confirmation' ? (
                        <Alert tone="info">Accept this order first before submitting a payment reference.</Alert>
                      ) : detail.data.order.status === 'awaiting_seller_acceptance' ? (
                        <Alert tone="info">Wait for the seller to accept the order before submitting a payment reference.</Alert>
                      ) : isClosedOrder ? (
                        <Alert tone="info">This order is closed. Payment references cannot be submitted anymore.</Alert>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Input className="max-w-xs" value={utr} onChange={(event) => setUtr(event.target.value)} placeholder="Demo UTR / reference" />
                          <Button size="sm" onClick={submitUtr} loading={busy}>Submit reference</Button>
                        </div>
                      )}
                      {!isClosedOrder && detail.data.order.advance_status === 'confirmed' && detail.data.order.balance_status !== 'confirmed' && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="label">Balance transfer reference (buyer)</p>
                          {balanceSubmitted ? (
                            <p className="text-xs text-forest-700">Balance reference submitted. Waiting for the seller to confirm receipt.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Input className="max-w-xs" value={balanceUtr} onChange={(event) => setBalanceUtr(event.target.value)} placeholder="Demo balance reference" />
                              <Button size="sm" onClick={submitBalance} loading={busy}>Submit balance reference</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {isOrderBuyer && !isAwaitingAcceptance && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <Button size="sm" variant="secondary" onClick={loadBank}><Banknote size={14} /> View demo bank details</Button>
                      {bank && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
                          <p><span className="text-slate-500">Account holder:</span> <strong>{bank.account_holder || '—'}</strong></p>
                          <p><span className="text-slate-500">Bank:</span> <strong>{bank.bank_name || '—'}</strong></p>
                          <p><span className="text-slate-500">Account:</span> <strong>{bank.account_number_masked || '—'}</strong></p>
                          <p><span className="text-slate-500">IFSC:</span> <strong>{bank.ifsc || '—'}</strong></p>
                          {bank.upi && <p><span className="text-slate-500">UPI:</span> <strong>{bank.upi}</strong></p>}
                          <p className="mt-2 text-[11px] text-amber-700">{bank.note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {isOrderSeller && (
                  <section className="card p-5">
                    <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><ShieldCheck size={17} className="text-forest-600" /> Seller actions</h4>
                    {isClosedOrder ? (
                      <p className="text-sm text-slate-500">This order is closed. Seller confirmations are locked.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.data.order.status === 'awaiting_buyer_confirmation' && (
                          <Alert tone="info">Order sent to the buyer. Waiting for the buyer to accept & buy or negotiate.</Alert>
                        )}
                        {detail.data.order.status === 'awaiting_seller_acceptance' && (
                          <Button size="sm" onClick={() => run(() => api.post(`/orders/${detail.data!.order.id}/accept`), 'Order accepted. Bank details are now visible to the buyer.')} loading={busy}>
                            <CheckCircle2 size={14} /> Accept order
                          </Button>
                        )}
                        {detail.data.order.status === 'advance_submitted' && (
                          <Button size="sm" onClick={confirmAdvance} loading={busy}><CheckCircle2 size={14} /> Confirm advance received</Button>
                        )}
                        {detail.data.order.advance_status === 'confirmed' && detail.data.order.balance_status !== 'confirmed' && (
                          balanceSubmitted ? (
                            <Button size="sm" variant="secondary" onClick={confirmBalance} loading={busy}>Confirm balance received</Button>
                          ) : <p className="text-sm text-slate-500">Waiting for the buyer to submit a balance reference.</p>
                        )}
                        {detail.data.order.status === 'awaiting_seller_acceptance' && <Alert tone="info">Review terms, then accept. No payment status changes until you explicitly confirm receipt.</Alert>}
                        {!['awaiting_seller_acceptance', 'awaiting_buyer_confirmation', 'advance_submitted'].includes(detail.data.order.status) && detail.data.order.advance_status !== 'confirmed' && (
                          <p className="text-sm text-slate-500">No seller confirmation is available at this stage.</p>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card p-5">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><Truck size={17} className="text-forest-600" /> Transport coordination</h4>
                  <p className="mb-4 text-xs leading-relaxed text-slate-600">
                    ReSource AI coordinates estimates and transporter details. Sellers or independent transporters handle delivery — the platform does not own vehicles or provide GPS.
                  </p>
                  {isClosedOrder ? (
                    <Alert tone="info">Transport details are locked for a closed order.</Alert>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Vehicle type"><Input value={transportForm.vehicle_type} onChange={(event) => setTransportForm({ ...transportForm, vehicle_type: event.target.value })} placeholder="Mini truck" /></Field>
                        <Field label="Transport payer"><Select value={transportForm.transport_payer} onChange={(event) => setTransportForm({ ...transportForm, transport_payer: event.target.value })}><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="shared">Shared</option></Select></Field>
                        <Field label="Transporter (optional)">
                          <Select value={transportForm.transporter_id} onChange={(event) => setTransportForm({ ...transportForm, transporter_id: event.target.value })}>
                            <option value="">Auto / to be arranged</option>
                            {(transportersQuery.data?.items || []).map((transporter) => <option key={transporter.id} value={transporter.id}>{transporter.name}</option>)}
                          </Select>
                          {transportersQuery.error && <p className="mt-1 text-[11px] text-red-600">Transporter list unavailable: {transportersQuery.error}</p>}
                        </Field>
                        <label className="flex items-end gap-2 pb-2.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-forest-600" checked={transportForm.agreed} onChange={(event) => setTransportForm({ ...transportForm, agreed: event.target.checked })} /> Terms agreed</label>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={agreeTransport} loading={busy}>Save transport agreement</Button>
                        {detail.data.order.transport_cost && <Badge tone="green">Estimate {inr(detail.data.order.transport_cost, 2)}</Badge>}
                      </div>
                      {detail.data.order.transport_agreed && <p className="mt-3 text-xs text-forest-700"><CheckCircle2 size={13} className="inline" /> Transport terms recorded.</p>}
                    </>
                  )}
                </section>

                <section className="card p-5">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><Clock size={17} className="text-forest-600" /> Shipment status</h4>
                  <TrackingTimeline shipment={detail.data.shipment} />
                  {!isClosedOrder && isOrderSeller && detail.data.order.advance_status === 'confirmed' && detail.data.order.transport_agreed && ['advance_paid', 'preparing', 'shipment_scheduled', 'shipped', 'in_transit', 'out_for_delivery'].includes(detail.data.order.status) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Select className="max-w-xs" value={shipmentStatus} onChange={(event) => setShipmentStatus(event.target.value)}>
                        {SHIPMENT_STEPS.filter((step) => !['order_confirmed', 'advance_paid'].includes(step.id)).map((step) => (
                          <option key={step.id} value={step.id} disabled={SHIPMENT_STEPS.indexOf(step) <= currentMilestoneIndex}>{step.label}</option>
                        ))}
                      </Select>
                      <Button size="sm" onClick={updateShipment} loading={busy} disabled={busy}>Update milestone</Button>
                    </div>
                  )}
                  {isOrderSeller && !detail.data.order.transport_agreed && (
                    <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">Confirm advance receipt and agree transport terms before updating milestones.</p>
                  )}
                  {isOrderSeller && detail.data.order.transport_agreed && detail.data.order.advance_status !== 'confirmed' && (
                    <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">The seller must confirm advance receipt before milestones can be updated.</p>
                  )}
                </section>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card p-5">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><XCircle size={17} className="text-red-600" /> Cancellation & refund</h4>
                  {feeQuery.error ? (
                    <div className="mb-4"><ErrorState message={feeQuery.error} onRetry={feeQuery.reload} /></div>
                  ) : feeQuery.data ? (
                    <div className="mb-4 space-y-2">
                      {feeQuery.data.cancellation_policy.map((policy) => (
                        <p key={policy.stage} className="text-xs leading-relaxed text-slate-600"><strong>{policy.stage}:</strong> {policy.terms}</p>
                      ))}
                    </div>
                  ) : <div className="mb-4"><LoadingGrid count={1} /></div>}
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {!isClosedOrder && <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>Request cancellation</Button>}
                    {isOrderBuyer && orderStatus !== 'completed' && refundableAdvance && detail.data.order.advance_amount > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => { setRefundForm({ ...refundForm, amount: String(detail.data!.order.advance_amount) }); setRefundOpen(true) }}>
                        Request refund
                      </Button>
                    )}
                  </div>
                  {detail.data.refunds.length ? (
                    <div className="mt-4 space-y-2">
                      {detail.data.refunds.map((refund) => (
                        <div key={refund.id} className="rounded-xl border border-slate-200 p-3.5 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{inr(refund.amount, 2)} · {titleCase(refund.status)}</p>
                            <StatusBadge status={refund.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{refund.reason}</p>
                          <p className="mt-1 text-[11px] text-slate-500">Stage: {refund.order_stage}{refund.seller_response ? ` · Seller: ${refund.seller_response}` : ''}</p>
                          {isOrderSeller && refund.status !== 'completed' && (
                            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setRefundResponse(refund)}>Respond to refund</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-xs text-slate-500">No refund requests recorded.</p>}
                </section>

                <section className="card p-5">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><PackagePlus size={17} className="text-forest-600" /> Payment policy</h4>
                  {feeQuery.error ? (
                    <ErrorState message={feeQuery.error} onRetry={feeQuery.reload} />
                  ) : feeQuery.data ? (
                    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                      <p>{feeQuery.data.advance}</p>
                      <p>{feeQuery.data.balance}</p>
                      <p className="text-xs text-slate-500">{feeQuery.data.note}</p>
                    </div>
                  ) : <LoadingGrid count={1} />}
                  <div className="mt-4"><Alert tone="info">Seller service fee is separate from the material payment and shown before order confirmation.</Alert></div>
                  <Link to="/negotiations" className="btn-ghost btn-sm mt-4">Back to negotiation</Link>
                </section>
              </div>
            </>
          ) : <ErrorState message={detail.error || 'Order not found.'} onRetry={detail.reload} />}
        </div>
      )}

      <Modal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title={isSellerAccount ? 'Send order to buyer' : 'Create a demo order'}
        description={isSellerAccount ? 'Select one of your active listings and the buyer who should receive this order. They can accept & buy or negotiate.' : 'The order starts as awaiting seller acceptance. No payment is collected.'}
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setOrderOpen(false)} disabled={busy}>Cancel</Button><Button onClick={createOrder} loading={busy}>{isSellerAccount ? 'Send order' : 'Create order'}</Button></>}
      >
        {listingsQuery.error && <div className="mb-4"><ErrorState message={listingsQuery.error} onRetry={listingsQuery.reload} /></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isSellerAccount ? 'Your listing' : 'Listing'} required className="sm:col-span-2">
            <Select value={newOrder.listing_id} onChange={(event) => {
              const listing = listingsQuery.data?.items.find((item) => item.id === event.target.value)
              setNewOrder({ ...newOrder, listing_id: event.target.value, quantity: String(listing?.quantity || ''), agreed_price: String(listing?.price || ''), pickup_location: listing?.location || '' })
            }}>
              {(listingsQuery.data?.items || []).map((listing) => <option key={listing.id} value={listing.id}>{listing.material_name} · {listing.quantity} {listing.unit} · {inr(listing.price, 2)}/{listing.unit}</option>)}
            </Select>
          </Field>
          {isSellerAccount && (
            <Field label="Receiver (Buyer)" required className="sm:col-span-2">
              <Select value={newOrder.buyer_id} onChange={(event) => {
                const chosen = buyersQuery.data?.items.find((b) => b.id === event.target.value)
                setNewOrder({ ...newOrder, buyer_id: event.target.value, delivery_location: chosen?.location || newOrder.delivery_location })
              }}>
                {(buyersQuery.data?.items || []).map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>{buyer.business_name} ({buyer.full_name}){buyer.location ? ` · ${buyer.location}` : ''}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Quantity (listed unit)" required><Input type="number" min="0" max={listingsQuery.data?.items.find((item) => item.id === newOrder.listing_id)?.quantity || undefined} value={newOrder.quantity} onChange={(event) => setNewOrder({ ...newOrder, quantity: event.target.value })} /></Field>
          <Field label="Listed price / unit" required><Input type="number" min="0" value={newOrder.agreed_price} readOnly /></Field>
          <Field label="Pickup location"><Input value={newOrder.pickup_location} onChange={(event) => setNewOrder({ ...newOrder, pickup_location: event.target.value })} /></Field>
          <Field label="Delivery location"><Input value={newOrder.delivery_location} onChange={(event) => setNewOrder({ ...newOrder, delivery_location: event.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={negotiateOpen}
        onClose={() => setNegotiateOpen(false)}
        title="Negotiate terms with seller"
        description={detail.data ? `${detail.data.order.material_name} · current ${inr(detail.data.order.agreed_price, 2)}/${detail.data.order.unit}` : ''}
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setNegotiateOpen(false)} disabled={busy}>Cancel</Button><Button onClick={submitOrderNegotiation} loading={busy}>Send offer</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proposed price / unit" required><Input type="number" min="0" step="0.01" value={negForm.price} onChange={(e) => setNegForm({ ...negForm, price: e.target.value })} /></Field>
          <Field label="Quantity" required><Input type="number" min="0" value={negForm.quantity} onChange={(e) => setNegForm({ ...negForm, quantity: e.target.value })} /></Field>
          <Field label="Delivery location"><Input value={negForm.delivery_location} onChange={(e) => setNegForm({ ...negForm, delivery_location: e.target.value })} /></Field>
          <Field label="Message"><Input value={negForm.message} onChange={(e) => setNegForm({ ...negForm, message: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Request cancellation"
        size="sm"
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={busy}>Keep order</Button><Button variant="danger" onClick={cancelOrder} loading={busy}>Record cancellation</Button></>}
      >
        <Field label="Reason" required><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></Field>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Request refund"
        description="Refunds are reviewed by the seller according to the agreed cancellation terms."
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setRefundOpen(false)} disabled={busy}>Cancel</Button><Button onClick={requestRefund} loading={busy}>Submit request</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" required hint={`Maximum ₹${Number(detail.data?.order.advance_amount || 0).toLocaleString('en-IN')}`}><Input type="number" min="0" max={detail.data?.order.advance_amount || undefined} value={refundForm.amount} onChange={(event) => setRefundForm({ ...refundForm, amount: event.target.value })} /></Field>
          <Field label="Order stage">
            <Select value={refundForm.order_stage} onChange={(event) => setRefundForm({ ...refundForm, order_stage: event.target.value })}>
              {['Before seller acceptance', 'After acceptance but before preparation', 'After material preparation', 'After shipment'].map((stage) => <option key={stage}>{stage}</option>)}
            </Select>
          </Field>
          <Field label="Reason" required className="sm:col-span-2"><Textarea value={refundForm.reason} onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(refundResponse)}
        onClose={() => setRefundResponse(null)}
        title="Respond to refund request"
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setRefundResponse(null)} disabled={busy}>Cancel</Button><Button onClick={respondRefund} loading={busy}>Save response</Button></>}
      >
        <div className="space-y-4">
          <Field label="Status">
            <Select value={refundResponse?.status || 'seller_review'} onChange={(event) => setRefundResponse(refundResponse ? { ...refundResponse, status: event.target.value } : null)}>
              {['requested', 'seller_review', 'approved', 'rejected', 'completed'].map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
            </Select>
          </Field>
          <Field label="Seller response"><Textarea value={refundResponse?.seller_response || ''} onChange={(event) => setRefundResponse(refundResponse ? { ...refundResponse, seller_response: event.target.value } : null)} /></Field>
          <Alert tone="warning">Approving or completing a refund updates the demo order's advance status. No real money is returned.</Alert>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
