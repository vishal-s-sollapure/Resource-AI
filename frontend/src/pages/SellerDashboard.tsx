import { Link } from 'react-router-dom'
import {
  ArrowRight, Boxes, CircleDollarSign, FileSearch, Handshake, Mail, PackagePlus, PackageSearch,
  Plus, Search, Sparkles, Tag, TrendingUp, Truck,
} from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, ErrorState, LoadingGrid, PageHeader, StatCard, StatusBadge } from '../components/ui'
import { ListingCard, RequirementCard } from '../components/domain'
import { useApiData } from '../lib/hooks'
import type { Listing, Negotiation, Offer, Order, Requirement } from '../lib/types'
import { inr, newestFirst, num } from '../lib/utils'
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

export default function SellerDashboard() {
  const { user } = useApp()
  const userId = user?.id || ''
  const listingsPath = user?.role === 'admin' ? '/listings?status=active' : '/listings/mine?status=active'
  const listings = useApiData<{ items: Listing[] }>(listingsPath)
  const requirements = useApiData<{ items: Requirement[] }>('/requirements?status=confirmed')
  const orders = useApiData<{ items: Order[] }>('/orders')
  const offers = useApiData<{ items: Offer[] }>('/offers')
  const negotiations = useApiData<{ items: Negotiation[] }>('/negotiations')
  const enquiries = useApiData<{ items: EnquiryItem[] }>('/enquiries')

  const sellerListings = newestFirst(listings.data?.items || [])
  const sellerOrders = newestFirst((orders.data?.items || []).filter((order) => !userId || order.seller_id === userId))
  const pendingOffers = newestFirst((offers.data?.items || []).filter((offer) => (!userId || offer.seller_id === userId) && offer.status === 'pending'))
  const sellerNegotiations = newestFirst((negotiations.data?.items || []).filter((neg) => !userId || neg.seller_id === userId))
  const sellerEnquiries = newestFirst((enquiries.data?.items || []).filter((enq) => !userId || enq.seller_id === userId))
  const listingName = (listingId: string) => sellerListings.find((item) => item.id === listingId)?.material_name || listingId

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Seller workspace"
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'seller'}`}
        description="List by-products, send orders to buyers, and review buyer negotiations and purchases in one place."
        actions={<>
          <Link to="/find-buyers" className="btn-primary"><Search size={16} /> Find buyers</Link>
          <Link to="/listings" className="btn-secondary"><Plus size={16} /> Add material</Link>
          <Link to="/orders?new=1" className="btn-secondary"><PackagePlus size={16} /> Send order to buyer</Link>
        </>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active listings" value={sellerListings.length} hint="Your live material lots" icon={<Boxes size={19} />} />
        <StatCard label="Buyer enquiries" value={sellerEnquiries.length} hint="Enquiries you are part of" icon={<Mail size={19} />} tone="blue" />
        <StatCard label="Pending offers" value={pendingOffers.length} hint="Awaiting your decision" icon={<Handshake size={19} />} tone="amber" />
        <StatCard label="Your orders" value={sellerOrders.length} hint="Buyer & seller orders" icon={<PackageSearch size={19} />} tone="ink" />
      </div>

      {listings.error && <div className="mb-5"><ErrorState message={listings.error} onRetry={listings.reload} /></div>}
      {requirements.error && <div className="mb-5"><ErrorState message={requirements.error} onRetry={requirements.reload} /></div>}
      {orders.error && <div className="mb-5"><ErrorState message={orders.error} onRetry={orders.reload} /></div>}
      {offers.error && <div className="mb-5"><ErrorState message={offers.error} onRetry={offers.reload} /></div>}
      {enquiries.error && <div className="mb-5"><ErrorState message={enquiries.error} onRetry={enquiries.reload} /></div>}

      <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">Your active listings</h3>
            <Link to="/listings" className="text-xs font-semibold text-forest-700 hover:underline">Manage all <ArrowRight size={12} className="inline" /></Link>
          </div>
          {listings.loading ? <LoadingGrid count={2} /> : sellerListings.length ? (
            <div className="grid-auto">{sellerListings.slice(0, 3).map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
          ) : <p className="text-sm text-slate-500">No active listings yet. Add a material to get started.</p>}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-ink-900">Seller workflow</h3>
            <ol className="space-y-3">
              {[
                { label: 'Add a material listing', to: '/listings', icon: Plus },
                { label: 'Analyse material & applications', to: '/analysis', icon: FileSearch },
                { label: 'Discover buyers', to: '/discovery', icon: Search },
                { label: 'Negotiate offers', to: '/negotiations', icon: Handshake },
                { label: 'Manage orders & delivery', to: '/orders', icon: Truck },
              ].map((step, index) => (
                <li key={step.label}>
                  <Link to={step.to} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-50 text-xs font-bold text-forest-700">{index + 1}</span>
                    <step.icon size={15} className="text-slate-500" />
                    <span className="text-sm font-medium text-ink-800">{step.label}</span>
                    <ArrowRight size={13} className="ml-auto text-slate-400" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="card p-5">
            <p className="flex items-center gap-2 font-bold text-ink-900"><TrendingUp size={17} className="text-forest-600" /> Service fees</p>
            <p className="mt-2 text-xs text-slate-600">Illustrative fee schedule shown in order summaries. Nothing is charged in this demo.</p>
            <div className="mt-3 space-y-1.5 text-xs">
              {[['Up to ₹10,000', '₹499'], ['₹10,001–₹20,000', '₹999'], ['₹20,001–₹50,000', '₹1,599'], ['Above ₹50,000', '₹2,599']].map(([range, fee]) => (
                <div key={range} className="flex justify-between"><span className="text-slate-600">{range}</span><span className="font-semibold">{fee}</span></div>
              ))}
            </div>
            <Link to="/profile" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-forest-700">Subscription: {user?.subscription_tier || 'basic'} <ArrowRight size={12} /></Link>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-ink-900"><Tag size={17} className="text-forest-600" /> Buyer negotiations & offers</h3>
            <Link to="/negotiations" className="text-xs font-semibold text-forest-700 hover:underline">All threads <ArrowRight size={12} className="inline" /></Link>
          </div>
          {pendingOffers.length ? (
            <div className="space-y-3">
              {pendingOffers.slice(0, 4).map((offer) => (
                <Link
                  key={offer.id}
                  to={`/negotiations/${offer.negotiation_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 transition hover:border-forest-300 hover:bg-forest-50/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{listingName(offer.listing_id)} · {inr(offer.price, 2)}/{offer.unit}</p>
                    <p className="text-xs text-slate-600">{num(offer.quantity)} {offer.unit} {offer.delivery_location ? `· ${offer.delivery_location}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={offer.status} />
                    <span className="text-xs font-semibold text-forest-700">Respond →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : sellerNegotiations.length ? (
            <div className="space-y-3">
              {sellerNegotiations.slice(0, 4).map((neg) => (
                <Link
                  key={neg.id}
                  to={`/negotiations/${neg.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5 transition hover:border-forest-300"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{listingName(neg.listing_id)}</p>
                    <p className="text-xs text-slate-500">{neg.buyer_name || 'Buyer'} {neg.agreed_price ? `· ${inr(neg.agreed_price, 2)}/unit` : ''}</p>
                  </div>
                  <StatusBadge status={neg.status} />
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">No buyer offers or negotiations yet. When a buyer negotiates a listing, it appears here.</p>}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-ink-900"><CircleDollarSign size={17} className="text-forest-600" /> Buyer orders & requests</h3>
            <Link to="/orders" className="text-xs font-semibold text-forest-700 hover:underline">All orders <ArrowRight size={12} className="inline" /></Link>
          </div>
          {sellerOrders.length ? sellerOrders.slice(0, 4).map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5 transition hover:border-forest-300 hover:bg-forest-50/30"
            >
              <div>
                <p className="text-sm font-semibold text-ink-900">{order.material_name} · {num(order.quantity)} {order.unit} · {inr(order.agreed_price, 2)}/{order.unit}</p>
                <p className="text-xs text-slate-500">{order.id} · Advance {inr(order.advance_amount)} · Total {inr(order.total_value)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
                <span className="text-xs font-semibold text-forest-700">{order.status === 'awaiting_seller_acceptance' ? 'Accept →' : 'View →'}</span>
              </div>
            </Link>
          )) : <p className="text-sm text-slate-500">No orders yet. When a buyer buys a listing, it appears here.</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/orders?new=1" className="btn-secondary btn-sm"><PackagePlus size={14} /> Send order to buyer</Link>
            <Link to="/orders" className="btn-ghost btn-sm">Open orders workspace</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-ink-900">Published buyer requirements</h3>
          {requirements.loading ? <LoadingGrid count={1} /> : requirements.data?.items.length ? (
            <div className="space-y-3">{requirements.data.items.slice(0, 2).map((requirement) => <RequirementCard key={requirement.id} requirement={requirement} />)}</div>
          ) : <p className="text-sm text-slate-500">No buyer requirements are published right now.</p>}
          <p className="mt-2 text-[11px] text-slate-500">Published requirements are not confirmed demand until the buyer confirms them.</p>
          <Link to="/find-buyers" className="btn-secondary btn-sm mt-4">Run full matching <Sparkles size={14} /></Link>
        </div>
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-ink-900"><Mail size={17} className="text-forest-600" /> Recent buyer enquiries</h3>
            <Link to="/enquiries" className="text-xs font-semibold text-forest-700 hover:underline">All enquiries <ArrowRight size={12} className="inline" /></Link>
          </div>
          {sellerEnquiries.length ? sellerEnquiries.slice(0, 3).map((enq) => (
            <Link key={enq.id} to="/enquiries" className="mb-3 block rounded-xl border border-slate-200 p-3.5 transition hover:border-forest-300">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{listingName(enq.listing_id)}</p>
                <StatusBadge status={enq.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{enq.message}</p>
            </Link>
          )) : <p className="text-sm text-slate-500">No buyer enquiries yet.</p>}
        </div>
      </div>
      <div className="mt-6"><Alert tone="info">All figures here are demo data. Matches are indicative and do not guarantee a transaction.</Alert></div>
    </DashboardLayout>
  )
}
