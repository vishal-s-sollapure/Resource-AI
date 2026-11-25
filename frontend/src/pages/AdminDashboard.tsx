import { Link } from 'react-router-dom'
import { Activity, BarChart3, Boxes, CircleDollarSign, FileText, PackageSearch, Users } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, DemoBadge, EmptyState, ErrorState, LoadingGrid, PageHeader, ProgressBar, StatCard } from '../components/ui'
import { useApiData } from '../lib/hooks'
import type { AdminOverview, Listing, Order, Requirement } from '../lib/types'
import { inr, num, titleCase } from '../lib/utils'
import { useApp } from '../state/AppContext'

export default function AdminDashboard() {
  const { user } = useApp()
  const isAdmin = user?.role === 'admin'
  const overview = useApiData<AdminOverview>(isAdmin ? '/admin/overview' : null)
  const listings = useApiData<{ items: Listing[] }>('/listings?status=active')
  const requirements = useApiData<{ items: Requirement[] }>('/requirements')
  const orders = useApiData<{ items: Order[] }>('/orders')
  const counts = overview.data?.counts || {}
  const categories = overview.data?.material_categories || {}

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Admin / demo dashboard"
        title="Marketplace overview"
        description="Operational snapshot with clearly labelled demo figures."
        actions={<DemoBadge />}
      />

      {!isAdmin && (
        <div className="mb-5">
          <Alert tone="warning" title="Admin demo login required">
            Sign in with <strong>admin@demo.resourceai.in</strong> / <strong>demo123</strong> to view platform metrics and reset demo data.
            <Link to="/login?next=%2Fadmin" className="ml-1 font-semibold underline">Go to login</Link>
          </Alert>
        </div>
      )}
      {overview.error && <div className="mb-5"><ErrorState message={overview.error} onRetry={overview.reload} /></div>}
      {listings.error && <div className="mb-5"><ErrorState message={listings.error} onRetry={listings.reload} /></div>}
      {requirements.error && <div className="mb-5"><ErrorState message={requirements.error} onRetry={requirements.reload} /></div>}
      {orders.error && <div className="mb-5"><ErrorState message={orders.error} onRetry={orders.reload} /></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total listings" value={counts.listings ?? '—'} hint="Excluding deleted" icon={<Boxes size={19} />} />
        <StatCard label="Buyer requirements" value={counts.buyer_requirements ?? '—'} hint="Published needs" icon={<FileText size={19} />} tone="blue" />
        <StatCard label="Enquiries" value={counts.enquiries ?? '—'} hint="Buyer–seller contacts" icon={<Activity size={19} />} tone="amber" />
        <StatCard label="Orders" value={counts.orders ?? '—'} hint="Demo transactions" icon={<PackageSearch size={19} />} tone="ink" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900"><BarChart3 size={17} className="text-forest-600" /> Material categories</h3>
          {!isAdmin ? (
            <p className="text-sm text-slate-500">Sign in as the demo admin to view category metrics.</p>
          ) : overview.loading ? <LoadingGrid count={1} /> : Object.entries(categories).length ? (
            Object.entries(categories).map(([category, count]) => (
              <div key={category} className="mb-3">
                <ProgressBar label={titleCase(category)} value={(count / Math.max(Object.values(categories).reduce((a, b) => a + b, 0), 1)) * 100} />
                <p className="mt-0.5 text-right text-[11px] text-slate-500">{count} listings</p>
              </div>
            ))
          ) : <p className="text-sm text-slate-500">No category data available.</p>}
        </div>
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900"><CircleDollarSign size={17} className="text-forest-600" /> Demo revenue overview</h3>
          {!isAdmin ? (
            <p className="text-sm text-slate-500">Sign in as the demo admin to view the revenue snapshot.</p>
          ) : overview.loading ? <LoadingGrid count={1} /> : overview.data ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-forest-50 p-4">
                <p className="text-xs font-semibold text-forest-800">Seller service fees (simulated)</p>
                <p className="mt-1 text-3xl font-extrabold text-forest-700">{inr(overview.data.demo_revenue_overview.service_fees)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-600">Order material value (demo)</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">{inr(overview.data.demo_revenue_overview.order_material_value)}</p>
              </div>
              <Alert tone="warning">{overview.data.demo_revenue_overview.note}</Alert>
            </div>
          ) : <p className="text-sm text-slate-500">No revenue data available.</p>}
          <p className="mt-4 text-xs text-slate-500">Storage backend: {overview.data?.storage_backend || '—'}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-ink-900">Latest listings</h3>
            <Link to="/listings" className="text-xs font-semibold text-forest-700">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {listings.loading ? <LoadingGrid count={3} /> : listings.data?.items.length ? (
              listings.data.items.slice(0, 5).map((listing) => (
                <div key={listing.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{listing.material_name}</p>
                    <p className="text-xs text-slate-500">{listing.location} · {num(listing.quantity)} {listing.unit}</p>
                  </div>
                  <Badge tone="green">{inr(listing.price, 2)}/{listing.unit}</Badge>
                </div>
              ))
            ) : <p className="px-5 py-6 text-center text-sm text-slate-500">No active listings.</p>}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-ink-900">Latest requirements</h3>
            <Link to="/requirements" className="text-xs font-semibold text-forest-700">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {requirements.loading ? <LoadingGrid count={3} /> : requirements.data?.items.length ? (
              requirements.data.items.slice(0, 5).map((requirement) => (
                <div key={requirement.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{requirement.material_name}</p>
                    <p className="text-xs text-slate-500">{requirement.application} · {requirement.location}</p>
                  </div>
                  <Badge tone={requirement.confirmed ? 'green' : 'gray'}>{requirement.confirmed ? 'Confirmed' : 'Published'}</Badge>
                </div>
              ))
            ) : <p className="px-5 py-6 text-center text-sm text-slate-500">No published requirements.</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900"><Users size={17} className="text-forest-600" /> Orders</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="data-table">
            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2">Order</th><th>Material</th><th>Value</th><th>Advance</th><th>Fee</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {orders.loading ? (
                <tr><td colSpan={6}><LoadingGrid count={1} /></td></tr>
              ) : orders.data?.items.length ? (
                orders.data.items.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2.5 font-medium">{order.id}</td>
                    <td>{order.material_name}</td>
                    <td>{inr(order.total_value)}</td>
                    <td>{inr(order.advance_amount)}</td>
                    <td>{inr(order.seller_fee)}</td>
                    <td><Badge tone={order.status === 'completed' ? 'green' : 'blue'}>{order.status.replace(/_/g, ' ')}</Badge></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6}><EmptyState icon={<PackageSearch size={20} />} title="No demo orders yet" description="Orders appear here once a buyer and seller agree terms." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
