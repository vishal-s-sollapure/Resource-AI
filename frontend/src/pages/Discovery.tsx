import { useState } from 'react'
import { Building2, FileText, MapPin, Search, Sparkles } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, Field, Input, LoadingGrid, PageHeader, Tabs } from '../components/ui'
import { ProspectCard } from '../components/domain'
import { api } from '../lib/api'
import type { DiscoveryResult } from '../lib/types'
import { useApp } from '../state/AppContext'

type BucketKey = 'ai_prospect' | 'real_business_listing' | 'published_requirement'
type Buckets = Record<BucketKey, DiscoveryResult[]>

interface DiscoveryResponse {
  query: string
  material: string
  location: string
  buckets: Buckets
  google_places_configured: boolean
  disclaimer: string
}

const emptyBuckets: Buckets = {
  ai_prospect: [],
  real_business_listing: [],
  published_requirement: [],
}

const bucketInfo: Array<{ key: BucketKey; title: string; icon: typeof Sparkles; tone: 'purple' | 'blue' | 'green' }> = [
  { key: 'ai_prospect', title: 'A · AI-suggested prospects', icon: Sparkles, tone: 'purple' },
  { key: 'real_business_listing', title: 'B · Business listings', icon: Building2, tone: 'blue' },
  { key: 'published_requirement', title: 'C · Published requirements', icon: FileText, tone: 'green' },
]

export default function Discovery() {
  const { notify } = useApp()
  const [form, setForm] = useState({ material: 'Coconut husk', location: 'Bengaluru, Karnataka' })
  const [result, setResult] = useState<DiscoveryResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')

  async function search() {
    setBusy(true)
    setError('')
    try {
      const response = await api.post<DiscoveryResponse>('/discovery/search', {
        material: form.material,
        material_name: form.material,
        location: form.location,
      })
      setResult(response)
      notify('Discovery complete. Result types are shown in separate buckets.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const buckets = result?.buckets || emptyBuckets
  const visibleBuckets = tab === 'all' ? bucketInfo : bucketInfo.filter((item) => item.key === tab)

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Market discovery"
        title="Business Discovery"
        description="Hybrid discovery keeps AI suggestions, business listings and platform requirements clearly separate."
        actions={<><Badge tone="purple"><Sparkles size={12} /> AI assisted</Badge><DemoBadge /></>}
      />

      <div className="card mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Material / by-product" required>
            <Input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} placeholder="e.g. Coconut husk" />
          </Field>
          <Field label="Preferred location">
            <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="City or region" />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
          <Button onClick={search} loading={busy}><Search size={16} /> Search prospects</Button>
          <Badge tone={result?.google_places_configured ? 'green' : 'amber'}>
            {result?.google_places_configured ? 'Google Places configured' : 'Google Places demo fallback'}
          </Badge>
        </div>
      </div>

      {error && <div className="mb-5"><Alert tone="error" title="Discovery failed">{error}</Alert></div>}

      <Alert tone="info" title="How to read these results">
        {result?.disclaimer || 'AI prospects are industry categories, not real businesses. Business listings do not prove buying intent. Only confirmed requirements represent stated demand.'}
      </Alert>

      {busy ? (
        <div className="mt-6"><LoadingGrid count={3} /></div>
      ) : result ? (
        <>
          <div className="mt-6">
            <Tabs
              active={tab}
              onChange={setTab}
              items={[
                { id: 'all', label: 'All buckets', count: Object.values(buckets).flat().length },
                ...bucketInfo.map((bucket) => ({ id: bucket.key, label: bucket.title.split('· ')[1], count: buckets[bucket.key].length })),
              ]}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Search query: “{result.query}” {result.location && <span className="ml-1">· Near {result.location}</span>}
          </p>
          <div className="mt-5 space-y-7">
            {visibleBuckets.map((bucket) => {
              const Icon = bucket.icon
              return (
                <section key={bucket.key}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Icon size={18} className="text-forest-600" />
                    <h3 className="font-bold text-ink-900">{bucket.title}</h3>
                    <Badge tone={bucket.tone}>{buckets[bucket.key].length} results</Badge>
                  </div>
                  {buckets[bucket.key].length ? (
                    <div className="grid-auto">
                      {buckets[bucket.key].map((item, index) => <ProspectCard key={item.id || `${bucket.key}-${index}`} result={item} />)}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500">
                      No results in this bucket for the current search.
                    </p>
                  )}
                </section>
              )
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><MapPin size={13} /> Distances are approximate when available.</span>
            <Badge tone="gray">No contact details are auto-collected</Badge>
          </div>
        </>
      ) : (
        <div className="card mt-6 p-10 text-center">
          <Building2 size={28} className="mx-auto mb-3 text-forest-600" />
          <p className="font-bold text-ink-900">Run a discovery search</p>
          <p className="mt-1 text-sm text-slate-500">Results will be grouped into prospects, listings and platform requirements.</p>
          <Button className="mt-4" onClick={search} loading={busy}>Search</Button>
        </div>
      )}
    </DashboardLayout>
  )
}
