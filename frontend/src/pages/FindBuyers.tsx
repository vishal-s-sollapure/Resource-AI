import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, CheckCircle2, FileSearch, Handshake, Mail, Plus, Search, Sparkles,
} from 'lucide-react'
import { PublicLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, EmptyState, Field, Input, PageHeader, Select, Tabs, Textarea } from '../components/ui'
import { AiNotice, SellerMatchItem } from '../components/domain'
import { api } from '../lib/api'
import { canSell } from '../lib/permissions'
import type { Analysis, BuyerMatch, Listing, PriceEstimate, SellerMatch } from '../lib/types'
import { useApp } from '../state/AppContext'

type DiscoveryBucket = {
  ai_prospect: Array<Record<string, unknown>>
  real_business_listing: Array<Record<string, unknown>>
  published_requirement: Array<Record<string, unknown>>
}

const categories = ['coconut', 'sugarcane', 'bamboo', 'jute', 'rice', 'wood', 'food_processing', 'industrial', 'other']
const units = ['kg', 'tonne', 'litre', 'piece', 'other']
const forms = ['raw', 'dried', 'processed', 'fibre', 'powder', 'chips', 'pellet', 'other']
const grades = ['A', 'B', 'C', 'ungraded']

const initial = {
  material_name: 'Coconut husk',
  category: 'coconut',
  quantity: '500',
  unit: 'kg',
  form: 'raw',
  quality_grade: 'B',
  moisture_content: '12',
  processing_level: 'sun-dried',
  location: 'Bengaluru, Karnataka',
  price: '10',
  price_type: 'negotiable',
  description: 'Raw coconut husk suitable for coir fibre extraction and coco peat production.',
}

export default function FindBuyers() {
  const [form, setForm] = useState(initial)
  const [step, setStep] = useState<'form' | 'results'>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null)
  const [matches, setMatches] = useState<SellerMatch[]>([])
  const [buckets, setBuckets] = useState<DiscoveryBucket | null>(null)
  const [tab, setTab] = useState('matches')
  const [enquiryText, setEnquiryText] = useState('')
  const [sellerListing, setSellerListing] = useState<Listing | null>(null)
  const { user, notify } = useApp()

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const maySaveListing = canSell(user?.role)
  const listingPath = maySaveListing
    ? (user && user.role !== 'admin' ? '/listings/mine' : '/listings?status=active')
    : null

  async function run() {
    setBusy(true)
    setError('')
    try {
      const params = {
        material_name: form.material_name,
        category: form.category,
        quantity: Number(form.quantity),
        unit: form.unit,
        form: form.form,
        quality_grade: form.quality_grade,
        moisture_content: form.moisture_content ? Number(form.moisture_content) : null,
        processing_level: form.processing_level,
        location: form.location,
        price: Number(form.price),
        price_type: form.price_type,
        description: form.description,
      }
      const listingRequest = listingPath
        ? api.get<{ items: Listing[] }>(listingPath)
        : Promise.resolve({ items: [] as Listing[] })
      const [analysisResult, priceResult, discoveryResult, matchResult, listingResult] = await Promise.all([
        api.post<{ analysis: Analysis }>('/materials/analyze', params),
        api.post<{ estimate: PriceEstimate }>('/pricing/estimate', params),
        api.post<{ buckets: DiscoveryBucket }>('/discovery/search', { ...params, material: form.material_name }),
        api.post<{ items: SellerMatch[] }>('/matching/seller', params),
        listingRequest,
      ])
      setAnalysis(analysisResult.analysis)
      setEstimate(priceResult.estimate)
      setBuckets(discoveryResult.buckets)
      setMatches(matchResult.items)
      const needle = form.material_name.trim().toLowerCase()
      const matchingListing = listingResult.items.find((item) => {
        const material = item.material_name.toLowerCase()
        return Boolean(needle) && (material.includes(needle) || needle.includes(material))
      })
      setSellerListing(matchingListing || null)
      setStep('results')
      notify('Analysis, discovery and matching complete.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveListing() {
    if (!maySaveListing) {
      notify('Your account cannot publish seller listings. Switch to a seller demo account.', 'error')
      return
    }
    setBusy(true)
    try {
      const saved = await api.post<{ item: Listing }>('/listings', {
        material_name: form.material_name,
        category: form.category,
        quantity: Number(form.quantity),
        unit: form.unit,
        form: form.form,
        quality_grade: form.quality_grade,
        moisture_content: form.moisture_content ? Number(form.moisture_content) : null,
        processing_level: form.processing_level,
        location: form.location,
        price: Number(form.price),
        price_type: form.price_type,
        description: form.description,
      })
      setSellerListing(saved.item)
      notify('Listing saved. You can now receive enquiries and offers.')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function sendEnquiry(requirementId: string) {
    if (!sellerListing) {
      notify('Save this material as a listing first, then send an enquiry.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/enquiries', {
        listing_id: sellerListing.id,
        requirement_id: requirementId,
        message: enquiryText || `Demo enquiry about ${form.quantity} ${form.unit} of ${form.material_name} in ${form.location}.`,
      })
      notify('Enquiry sent to the buyer.')
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
          eyebrow={`Seller workflow · Step ${step === 'form' ? '1' : '2'} of 2`}
          title="Find Buyers for your by-product"
          description="Describe your material. AI suggests possible applications, a transparent price reference, prospect categories and matches with published buyer requirements."
          actions={<><Badge tone="green"><Sparkles size={12} /> AI assisted</Badge><DemoBadge /></>}
        />

        {error && <div className="mb-5"><Alert tone="error" title="Could not complete the workflow">{error}</Alert></div>}

        {step === 'form' ? (
          <div className="card p-6 sm:p-8">
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Material name" required>
                <Input value={form.material_name} onChange={(event) => set('material_name', event.target.value)} />
              </Field>
              <Field label="Material category">
                <Select value={form.category} onChange={(event) => set('category', event.target.value)}>
                  {categories.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
                </Select>
              </Field>
              <Field label="Quantity available" required>
                <Input type="number" min="0" value={form.quantity} onChange={(event) => set('quantity', event.target.value)} />
              </Field>
              <Field label="Unit">
                <Select value={form.unit} onChange={(event) => set('unit', event.target.value)}>{units.map((item) => <option key={item}>{item}</option>)}</Select>
              </Field>
              <Field label="Material form">
                <Select value={form.form} onChange={(event) => set('form', event.target.value)}>{forms.map((item) => <option key={item}>{item}</option>)}</Select>
              </Field>
              <Field label="Quality grade">
                <Select value={form.quality_grade} onChange={(event) => set('quality_grade', event.target.value)}>{grades.map((item) => <option key={item}>{item}</option>)}</Select>
              </Field>
              <Field label="Moisture content (%)" hint="Leave blank if unknown">
                <Input type="number" min="0" max="100" value={form.moisture_content} onChange={(event) => set('moisture_content', event.target.value)} />
              </Field>
              <Field label="Processing level">
                <Input value={form.processing_level} onChange={(event) => set('processing_level', event.target.value)} />
              </Field>
              <Field label="Location" required>
                <Input value={form.location} onChange={(event) => set('location', event.target.value)} />
              </Field>
              <Field label="Selling price (₹ per unit)" hint="You always set your own price">
                <Input type="number" min="0" value={form.price} onChange={(event) => set('price', event.target.value)} />
              </Field>
              <Field label="Pricing">
                <Select value={form.price_type} onChange={(event) => set('price_type', event.target.value)}>
                  <option value="negotiable">Negotiable</option>
                  <option value="fixed">Fixed price</option>
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={form.description} onChange={(event) => set('description', event.target.value)} />
            </Field>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <Button size="lg" onClick={run} loading={busy} disabled={busy}><Sparkles size={17} /> Analyse & find buyers <ArrowRight size={16} /></Button>
              {maySaveListing && <Button size="lg" variant="secondary" onClick={saveListing} loading={busy} disabled={busy}><Plus size={16} /> Save as listing only</Button>}
              <Link to="/listings" className="btn-ghost btn-lg">{maySaveListing ? 'Manage my listings' : 'Browse listings'}</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest-200 bg-forest-50 p-4">
              <div>
                <p className="font-bold text-forest-900">{form.quantity} {form.unit} of {form.material_name} · {form.location}</p>
                <p className="text-xs text-forest-800/80">Price set by you: ₹{form.price}/{form.unit} · {form.price_type}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setStep('form')} disabled={busy}>Edit details</Button>
                {maySaveListing && <Button size="sm" onClick={saveListing} loading={busy} disabled={busy}><Plus size={14} /> Save listing</Button>}
              </div>
            </div>

            <Tabs
              active={tab}
              onChange={setTab}
              items={[
                { id: 'matches', label: 'Buyer matches', count: matches.length },
                { id: 'analysis', label: 'AI analysis' },
                { id: 'price', label: 'Price estimation' },
                { id: 'prospects', label: 'Business discovery', count: buckets ? Object.values(buckets).flat().length : 0 },
              ]}
            />

            <div className="mt-6">
              {tab === 'matches' && (
                <div className="space-y-5">
                  <div className="card p-5">
                    <p className="label">Enquiry message used for matched buyers</p>
                    <Textarea value={enquiryText} onChange={(event) => setEnquiryText(event.target.value)} placeholder="Introduce your material and ask for interest…" />
                  </div>
                  {matches.length ? matches.slice(0, 6).map((item) => (
                    <SellerMatchItem key={item.requirement.id} item={item}>
                      <Button size="sm" onClick={() => sendEnquiry(item.requirement.id)} loading={busy} disabled={busy}><Mail size={14} /> Send enquiry</Button>
                    </SellerMatchItem>
                  )) : <EmptyState icon={<Handshake size={22} />} title="No matching published requirements" description="Try a different material, quantity or location. AI prospects and sample business listings remain in their own labelled buckets." />}
                </div>
              )}

              {tab === 'analysis' && analysis && (
                <div className="card p-6">
                  <AiNotice source={analysis.source}>
                    Analysis is interpretive only. {analysis.disclaimer}
                  </AiNotice>
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><FileSearch size={17} className="text-forest-600" /> Possible applications</h3>
                      <div className="space-y-2">
                        {analysis.possible_applications.map((item) => (
                          <div key={item.name} className="rounded-xl border border-slate-200 p-3.5">
                            <p className="font-semibold text-ink-900">{item.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{item.rationale} · {item.feasibility}</p>
                          </div>
                        ))}
                        {!analysis.possible_applications.length && <p className="text-sm text-slate-500">No verified applications available. Verify with an expert.</p>}
                      </div>
                    </div>
                    <div className="space-y-5">
                      {[
                        { title: 'Potential products', items: analysis.potential_products },
                        { title: 'Industries that may use it', items: analysis.target_industries },
                        { title: 'Processing requirements', items: analysis.processing_requirements },
                        { title: 'Quality considerations', items: analysis.quality_considerations },
                        { title: 'Storage & handling', items: analysis.storage_handling },
                        { title: 'Environmental benefits', items: analysis.environmental_benefits },
                      ].map((group) => (
                        <div key={group.title}>
                          <h4 className="mb-2 text-sm font-bold text-ink-900">{group.title}</h4>
                          <div className="flex flex-wrap gap-1.5">{group.items.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6"><Link to="/analysis" className="btn-secondary btn-sm">Open full analysis workspace <ArrowRight size={14} /></Link></div>
                </div>
              )}

              {tab === 'price' && estimate && (
                <div className="card p-6">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-ink-900"><BarChart3 size={19} className="text-forest-600" /> Indicative price estimate</h3>
                  {estimate.insufficient_data ? (
                    <div className="mt-4"><Alert tone="warning" title="Insufficient market data.">
                      No reliable comparable prices are available. Keep your own price, allow quotations and negotiate with buyers. No price has been invented.
                    </Alert></div>
                  ) : (
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      {[
                        { label: 'Suggested low', value: estimate.suggested_low_per_kg },
                        { label: 'Suggested typical', value: estimate.suggested_typical_per_kg },
                        { label: 'Suggested high', value: estimate.suggested_high_per_kg },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-forest-200 bg-forest-50 p-4">
                          <p className="text-xs font-semibold text-forest-800">{item.label}</p>
                          <p className="mt-2 text-2xl font-bold text-forest-700">₹{item.value}/kg</p>
                          <p className="mt-1 text-[11px] text-forest-800/70">≈ ₹{Number(item.value || 0) * 1000}/tonne</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {estimate.is_demo_estimate && <div className="mt-4"><DemoBadge>Prices derived from demo comparables — demo estimates only</DemoBadge></div>}
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <p className="label">How this estimate was calculated</p>
                      <ul className="space-y-1.5">{estimate.factors.map((factor) => <li key={factor} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 size={15} className="mt-0.5 text-forest-500" /> {factor}</li>)}</ul>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-sm">
                      <p><span className="font-semibold">Data source:</span> {estimate.data_source}</p>
                      <p className="mt-1"><span className="font-semibold">Confidence:</span> {estimate.confidence}</p>
                      <p className="mt-1"><span className="font-semibold">Comparables:</span> {estimate.comparable_count}</p>
                      <p className="mt-2 text-xs text-slate-600">{estimate.seller_control}</p>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'prospects' && buckets && (
                <div className="space-y-6">
                  <Alert tone="info" title="Three distinct result types">
                    AI-suggested prospects are industry categories, not real companies. Sample business data is not verified. Published requirements are platform records; only confirmed ones indicate stated demand.
                  </Alert>
                  {([
                    { key: 'ai_prospect', title: 'A · AI-suggested prospects', icon: Sparkles },
                    { key: 'real_business_listing', title: 'B · Business listings', icon: Search },
                    { key: 'published_requirement', title: 'C · Published requirements', icon: Handshake },
                  ] as const).map((bucket) => (
                    <div key={bucket.key}>
                      <h3 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><bucket.icon size={17} className="text-forest-600" /> {bucket.title}</h3>
                      <div className="grid-auto">
                        {buckets[bucket.key].length ? buckets[bucket.key].map((result, index) => (
                          <div key={String(result.id || index)} className="card p-4">
                            <Badge tone={bucket.key === 'ai_prospect' ? 'purple' : bucket.key === 'real_business_listing' ? 'blue' : 'green'}>{String(result.label)}</Badge>
                            <p className="mt-2 font-bold text-ink-900">{String(result.business_name || result.category || 'Prospect')}</p>
                            <p className="mt-1 text-xs text-slate-500">{String(result.address || result.note || '')}</p>
                            {result.search_query ? <p className="mt-2 text-xs font-medium text-purple-700">Search: “{String(result.search_query)}”</p> : null}
                          </div>
                        )) : <p className="text-sm text-slate-500">No results in this bucket.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  )
}
