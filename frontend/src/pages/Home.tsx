import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, BarChart3, Boxes, Building2, CheckCircle2, CircleDollarSign,
  Factory, FileSearch, Handshake, Leaf, MapPin, PackageSearch, Recycle, Search, Sparkles,
  Truck, Users,
} from 'lucide-react'
import { PublicLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, EmptyState, LoadingGrid, Section, Tabs } from '../components/ui'
import { ListingCard, RequirementCard } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import { canBuy, canSell } from '../lib/permissions'
import type { Analysis, Listing, Requirement } from '../lib/types'
import { cn } from '../lib/utils'
import { useApp } from '../state/AppContext'

const previewListings: Listing[] = [
  {
    id: 'preview_1', seller_id: 'preview_seller_1', material_name: 'Coconut husk', category: 'coconut',
    quantity: 500, unit: 'kg', form: 'raw', quality_grade: 'B', moisture_content: 12,
    processing_level: 'sun-dried', location: 'Bengaluru, Karnataka', price: 10, price_type: 'negotiable',
    images: [], description: 'Sun-dried coconut husk for coir fibre extraction or coco peat production.',
    status: 'active', is_demo: true, available_date: null, created_at: '', updated_at: '',
  },
  {
    id: 'preview_2', seller_id: 'preview_seller_2', material_name: 'Sugarcane bagasse', category: 'sugarcane',
    quantity: 2000, unit: 'kg', form: 'dried', quality_grade: 'A', moisture_content: 9,
    processing_level: 'baled', location: 'Lucknow, Uttar Pradesh', price: 4.5, price_type: 'fixed',
    images: [], description: 'Dried bagasse bales for pulp, moulded packaging and board trials.',
    status: 'active', is_demo: true, available_date: null, created_at: '', updated_at: '',
  },
  {
    id: 'preview_3', seller_id: 'preview_seller_3', material_name: 'Bamboo waste', category: 'bamboo',
    quantity: 1000, unit: 'kg', form: 'raw', quality_grade: 'B', moisture_content: 11,
    processing_level: 'sorted offcuts', location: 'Guwahati, Assam', price: 8, price_type: 'negotiable',
    images: [], description: 'Sorted bamboo offcuts for fibre extraction and composite panels.',
    status: 'active', is_demo: true, available_date: null, created_at: '', updated_at: '',
  },
]

const steps = [
  { icon: FileSearch, title: 'Describe your material or need', text: 'List a by-product or tell us what raw material you are looking for in plain language.' },
  { icon: Sparkles, title: 'Get AI material intelligence', text: 'Explore possible applications, buyer industries, quality factors and indicative pricing.' },
  { icon: Handshake, title: 'Match, enquire and negotiate', text: 'Compare real platform requirements and listings, then negotiate terms directly.' },
  { icon: Truck, title: 'Coordinate delivery', text: 'Agree transport, pay an advance directly to the seller and track manual shipment updates.' },
]

const audiences = [
  { icon: Factory, title: 'By-product generators', text: 'Farmers, mills and factories with reusable residues.' },
  { icon: Search, title: 'Raw material buyers', text: 'Manufacturers looking for sustainable inputs.' },
  { icon: Recycle, title: 'Processors & recyclers', text: 'Firms that convert residues into useful products.' },
  { icon: Truck, title: 'Transporters', text: 'Independent logistics providers coordinating delivery.' },
]

export default function Home() {
  const { user } = useApp()
  const showSeller = canSell(user?.role)
  const showBuyer = canBuy(user?.role)
  const listingsQuery = useApiData<{ items: Listing[] }>('/listings?status=active')
  const requirementsQuery = useApiData<{ items: Requirement[] }>('/requirements?status=confirmed')
  const [material, setMaterial] = useState('Coconut husk')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [previewTab, setPreviewTab] = useState<'buyers' | 'suppliers'>('buyers')

  const listings = listingsQuery.data?.items?.length ? listingsQuery.data.items : previewListings
  const requirements = requirementsQuery.data?.items || []
  const liveCounts = [
    { label: 'Listings', value: listingsQuery.data?.items.length ?? '—', icon: Boxes },
    { label: 'Buyer needs', value: requirementsQuery.data?.items.length ?? '—', icon: Users },
    {
      label: 'Categories',
      value: new Set((listingsQuery.data?.items || []).map((listing) => listing.category)).size || '—',
      icon: BarChart3,
    },
  ]

  async function runAnalysis() {
    if (!material.trim()) return
    setAnalysing(true)
    setError('')
    try {
      const result = await api.post<{ analysis: Analysis }>('/materials/analyze', { material_name: material, quantity: 500, unit: 'kg' })
      setAnalysis(result.analysis)
    } catch (err) {
      setError((err as Error).message)
      setAnalysis(null)
    } finally {
      setAnalysing(false)
    }
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, #1e9e60 0, transparent 42%), radial-gradient(circle at 85% 10%, #157e4c 0, transparent 38%)' }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="container-page relative py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-fade-up">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest-500/40 bg-forest-500/10 px-3.5 py-1.5 text-xs font-semibold text-forest-300">
                <Recycle size={14} /> AI-powered circular economy marketplace
              </div>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
                Turn Waste into <span className="text-forest-400">Business Opportunities</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Discover the value of industrial and agricultural by-products. Find buyers, source reusable materials and connect with businesses that believe in a circular economy.
              </p>
              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                {showSeller && (
                  <Link to="/find-buyers" className="group relative overflow-hidden rounded-3xl border border-forest-400/30 bg-gradient-to-br from-forest-600/30 to-forest-900/20 p-6 shadow-lifted transition duration-300 hover:-translate-y-1 hover:border-forest-300 hover:from-forest-500/40">
                    <span className="absolute right-5 top-5 rounded-full border border-forest-400/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-forest-200">For sellers</span>
                    <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-forest-500 text-white shadow-md"><Factory size={22} /></span>
                    <p className="font-display text-xl font-bold">Find Buyers</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">Analyse your by-product, discover applications and match with real published requirements.</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-forest-200">Start selling <ArrowRight size={15} className="transition duration-200 group-hover:translate-x-1" /></span>
                  </Link>
                )}
                {showBuyer && (
                  <Link to="/find-materials" className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] p-6 shadow-lifted transition duration-300 hover:-translate-y-1 hover:border-forest-300 hover:bg-white/10">
                    <span className="absolute right-5 top-5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">For buyers</span>
                    <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white shadow-md"><PackageSearch size={22} /></span>
                    <p className="font-display text-xl font-bold">Find Materials</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">Describe what you need in plain language and let AI structure your search.</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-forest-200">Start sourcing <ArrowRight size={15} className="transition duration-200 group-hover:translate-x-1" /></span>
                  </Link>
                )}
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-400">
                <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-forest-400" /> Labelled AI prospects</span>
                <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-forest-400" /> Transparent pricing</span>
                <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-forest-400" /> Direct seller payments</span>
              </div>
            </div>

            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-forest-500/10 blur-2xl" />
              <div className="relative rounded-3xl border border-white/10 bg-ink-900/90 p-5 shadow-2xl backdrop-blur">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-forest-400">Marketplace snapshot</p>
                    <p className="text-sm text-slate-400">Demo data · refreshed from the API</p>
                  </div>
                  <Badge tone="green" className="border-forest-600 bg-forest-900/50 text-forest-300">Demo preview (API)</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {liveCounts.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                      <item.icon size={17} className="mb-2 text-forest-400" />
                      <p className="text-xl font-bold">{item.value}</p>
                      <p className="text-[11px] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2.5">
                  {listings.slice(0, 3).map((listing) => (
                    <div key={listing.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest-500/20 text-forest-300"><Leaf size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{listing.material_name}</p>
                        <p className="truncate text-[11px] text-slate-400">{listing.quantity} {listing.unit} · {listing.location}</p>
                      </div>
                      <Badge tone="gray" className="border-white/10 bg-white/5 text-slate-300">{listing.status}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-forest-500/30 bg-forest-500/10 p-3 text-xs leading-relaxed text-forest-200">
                  <Sparkles size={14} className="mb-1.5" />
                  All companies, prices and orders in this preview are clearly labelled demo data. No real transactions occur.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page">
        <Section title="Built for the complete circular chain" description="One workspace for everyone who handles reusable by-products.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map((audience) => (
              <div key={audience.title} className="card p-5">
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-forest-50 text-forest-700"><audience.icon size={19} /></span>
                <p className="font-bold text-ink-900">{audience.title}</p>
                <p className="mt-1 text-sm text-slate-600">{audience.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="How ReSource AI works" description="A clear path from leftover material to a negotiated, trackable order.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="card relative p-5">
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-slate-100">0{index + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-900 text-white"><step.icon size={19} /></span>
                <p className="mt-4 font-bold text-ink-900">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Featured materials"
          description="Demo supplier listings from the API. Prices shown below are illustrative demo values, not market quotes."
          action={showBuyer ? (
            <Link to="/find-materials" className="btn-secondary btn-sm">Browse all materials <ArrowRight size={14} /></Link>
          ) : (
            <Link to="/listings" className="btn-secondary btn-sm">Manage my listings <ArrowRight size={14} /></Link>
          )}
        >
          {listingsQuery.loading && <LoadingGrid count={3} />}
          {listingsQuery.error && <p className="mb-3"><Alert tone="warning" title="Demo listings unavailable">Showing clearly labelled preview records. {listingsQuery.error}</Alert></p>}
          <div className="grid-auto">
            {listings.slice(0, 3).map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        </Section>

        <Section title="Popular by-products" description="Material knowledge is kept separate from individual seller listings.">
          <div className="flex flex-wrap gap-2.5">
            {['Coconut husk', 'Coconut coir', 'Coco peat', 'Sugarcane bagasse', 'Rice husk', 'Bamboo waste', 'Bamboo fibre', 'Jute fibre', 'Sawdust', 'Food-processing by-products', 'Agricultural residues', 'Industrial reusable materials'].map((item) => (
              <Link key={item} to={`/knowledge?material=${encodeURIComponent(item)}`} className="chip transition hover:border-forest-400 hover:bg-forest-50 hover:text-forest-700">
                <Leaf size={12} /> {item}
              </Link>
            ))}
          </div>
        </Section>

        <Section title="AI material analysis preview" description="Try it with a by-product. Applications depend on quality, contamination and processing.">
          <div className="card grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <label className="label">Enter a by-product</label>
              <div className="flex gap-2">
                <input className="input" value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="e.g. 500 kg coconut husk" />
                <Button onClick={runAnalysis} loading={analysing}>Analyse</Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Try “Coconut husk”, “Sugarcane bagasse” or “Rice husk”.</p>
              {error && <p className="mt-3"><Alert tone="warning">{error} No offline analysis is shown.</Alert></p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-forest-50 p-3.5">
                  <p className="text-xs font-semibold text-forest-800">Possible applications</p>
                  <p className="mt-1 text-2xl font-bold text-forest-700">{analysis?.possible_applications.length ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3.5">
                  <p className="text-xs font-semibold text-blue-800">Potential buyer industries</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">{analysis?.target_industries.length ?? '—'}</p>
                </div>
              </div>
              {analysis && <p className="mt-3 text-[11px] text-slate-500">Source: {analysis.source}</p>}
            </div>
            <div>
              {analysis ? (
                <div className="space-y-3">
                  {analysis.possible_applications.map((application) => (
                    <div key={application.name} className="flex gap-3 rounded-xl border border-slate-200 p-3.5">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-forest-600" />
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{application.name}</p>
                        <p className="text-xs text-slate-500">{application.rationale} · {application.feasibility}</p>
                      </div>
                    </div>
                  ))}
                  <Alert tone="warning">{analysis.disclaimer}</Alert>
                  <Link to="/analysis" className="btn-secondary btn-sm">Open full material intelligence <ArrowRight size={14} /></Link>
                </div>
              ) : (
                <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-slate-300 text-center">
                  <div>
                    <Sparkles size={26} className="mx-auto mb-2 text-purple-500" />
                    <p className="font-semibold text-ink-900">Run an analysis to see possibilities</p>
                    <p className="mt-1 text-sm text-slate-500">No claim is made that every material suits every product.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Marketplace preview" description="Published buyer requirements and available supplier listings, clearly distinguished.">
          <div className="mb-5 max-w-2xl">
            <Tabs
              active={previewTab}
              onChange={(value) => setPreviewTab(value as 'buyers' | 'suppliers')}
              items={[
                { id: 'buyers', label: 'Published buyer requirements', count: requirements.length },
                { id: 'suppliers', label: 'Supplier listings', count: listings.length },
              ]}
            />
          </div>
          {previewTab === 'buyers' ? (
            requirementsQuery.loading ? <LoadingGrid count={3} /> : requirementsQuery.error ? (
              <Alert tone="warning" title="Published requirements unavailable">
                {requirementsQuery.error} Try again later; no demand is shown until requirements can be loaded.
              </Alert>
            ) : requirements.length ? (
              <div className="grid-auto">
                {requirements.slice(0, 3).map((requirement) => <RequirementCard key={requirement.id} requirement={requirement} />)}
              </div>
            ) : <EmptyState icon={<Users size={22} />} title="No confirmed requirements yet" description="Requirements appear here once a buyer confirms demand." />
          ) : (
            <div className="grid-auto">{listings.slice(0, 3).map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
          )}
        </Section>

        <Section title="Sustainable impact" description="Illustrative impact framing for the circular economy — not audited figures.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Recycle, value: 'Less landfill', label: 'Reuse organic and industrial residues' },
              { icon: Leaf, value: 'Lower virgin input', label: 'Replace some virgin raw materials' },
              { icon: CircleDollarSign, value: 'New revenue', label: 'By-products become tradable lots' },
              { icon: Building2, value: 'Local markets', label: 'Connect nearby sellers and buyers' },
            ].map((item) => (
              <div key={item.value} className="rounded-2xl border border-forest-100 bg-forest-50/60 p-5">
                <item.icon size={20} className="text-forest-700" />
                <p className="mt-3 font-bold text-forest-900">{item.value}</p>
                <p className="mt-1 text-sm text-forest-800/80">{item.label}</p>
              </div>
            ))}
          </div>
        </Section>

        <section className="mb-16 overflow-hidden rounded-3xl bg-forest-800 text-white">
          <div className="grid gap-6 p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-forest-300">Ready to start?</p>
              <h2 className="mt-2 text-3xl font-extrabold">Your leftover material might be someone else's raw material.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-forest-100">
                Create a listing, discover potential applications and connect with businesses in minutes. No real payment is needed to explore the demo.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {showSeller && <Link to="/find-buyers" className="btn-lg bg-white text-forest-800 hover:bg-forest-50">I have material <ArrowRight size={16} /></Link>}
              {showBuyer && <Link to="/find-materials" className="btn-lg border border-white/30 text-white hover:bg-white/10">I need material <ArrowRight size={16} /></Link>}
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}
