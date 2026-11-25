import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, CheckCircle2, FileSearch, Leaf, Sparkles } from 'lucide-react'
import { PublicLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, EmptyState, ErrorState, LoadingGrid, PageHeader, Tabs } from '../components/ui'
import { MaterialGuideCard } from '../components/domain'
import { useApiData } from '../lib/hooks'
import { canBuy, canSell } from '../lib/permissions'
import type { MaterialGuide } from '../lib/types'
import { titleCase } from '../lib/utils'
import { useApp } from '../state/AppContext'

// Chips on the homepage use familiar names that are derived from a reference
// guide (for example coir and coco peat come from coconut husk). Keep those
// mappings explicit so an unmatched term never silently opens another guide.
const GUIDE_ALIASES: Record<string, string[]> = {
  mat_coconut: ['coconut coir', 'coir', 'coco peat', 'coir pith', 'coconut fibre'],
  mat_bamboo: ['bamboo fibre', 'bamboo fiber'],
}

function findGuide(materials: MaterialGuide[], term: string): MaterialGuide | null {
  const needle = term.trim().toLowerCase()
  if (!needle) return null
  return materials.find((material) => [
    material.id,
    material.name,
    ...material.aliases,
    ...material.common_byproducts,
    ...(GUIDE_ALIASES[material.id] || []),
  ].some((value) => {
    const candidate = value.trim().toLowerCase()
    return candidate === needle || candidate.includes(needle) || needle.includes(candidate)
  })) || null
}

export default function Knowledge() {
  const { user } = useApp()
  const showSeller = canSell(user?.role)
  const showBuyer = canBuy(user?.role)
  const query = useApiData<{ items: MaterialGuide[] }>('/materials')
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const requestedLabel = searchParams.get('material')?.trim() || ''
  const materialParam = requestedLabel.toLowerCase()

  const materials = query.data?.items || []
  const categories = Array.from(new Set(materials.map((material) => material.category)))
  const filtered = category === 'all' ? materials : materials.filter((material) => material.category === category)
  const requestedMatch = materialParam ? findGuide(materials, materialParam) : null
  const unmatchedRequest = materialParam && !requestedMatch && !selectedId ? requestedLabel : ''
  const selected = materials.find((material) => material.id === selectedId)
    || requestedMatch
    || (!materialParam || selectedId ? filtered[0] || materials[0] || null : null)

  useEffect(() => {
    if (!materialParam || !materials.length) return
    const match = findGuide(materials, materialParam)
    if (match) {
      setSelectedId(match.id)
      setCategory('all')
    }
  }, [materialParam, query.data])

  return (
    <PublicLayout>
      <div className="container-page py-10">
        <PageHeader
          eyebrow="Knowledge Hub"
          title="Material intelligence, without invented claims"
          description="Explore documented possibilities for common industrial and agricultural by-products. Applications depend on quality, contamination and processing — always verify with the buyer."
          actions={<><Badge tone="green"><BookOpen size={12} /> Reference library</Badge><DemoBadge /></>}
        />

        <Alert tone="info" title="Knowledge is not a transaction">
          A material guide describes possibilities. It is not a listing, a price quote, a buyer commitment or a guarantee that every lot is suitable.
        </Alert>
        {unmatchedRequest && (
          <div className="mt-4">
            <Alert tone="warning" title="No reference guide yet">
              There is no dedicated guide for “{unmatchedRequest}”. Browse the available guides below or use AI material analysis instead.
            </Alert>
          </div>
        )}

        <div className="mt-6">
          <Tabs
            active={category}
            onChange={setCategory}
            items={[{ id: 'all', label: 'All materials', count: materials.length }, ...categories.map((item) => ({ id: item, label: titleCase(item) }))]}
          />
        </div>

        {query.error && <div className="mt-5"><ErrorState message={query.error} onRetry={query.reload} /></div>}
        {query.loading ? <div className="mt-6"><LoadingGrid count={4} /></div> : filtered.length ? (
          <div className="mt-6 grid-auto">
            {filtered.map((material) => (
              <div key={material.id}>
                <MaterialGuideCard
                  material={material}
                  onClick={() => setSelectedId(material.id)}
                  action={selected?.id === material.id ? <Badge tone="green">Viewing</Badge> : undefined}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<BookOpen size={22} />}
              title={materials.length ? 'No guides in this category' : 'No material guides available'}
              description={materials.length ? 'Choose another category to browse the reference library.' : 'The reference library is currently empty. Try again or use AI material analysis instead.'}
              action={materials.length ? <Button variant="secondary" onClick={() => setCategory('all')}>Show all materials</Button> : undefined}
            />
          </div>
        )}

        {selected && (
          <section className="card mt-8 p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Material guide</p>
                <h2 className="mt-1 text-2xl font-bold text-ink-900">{selected.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{selected.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="green"><Leaf size={12} /> {titleCase(selected.category)}</Badge>
                {selected.is_demo && <DemoBadge />}
              </div>
            </div>

            <p className="mb-4 text-sm text-slate-600"><span className="font-semibold text-ink-900">Typical source:</span> {selected.source}</p>

            <div className="grid gap-6 lg:grid-cols-2">
              {[
                { title: 'Possible applications', items: selected.applications, icon: Sparkles },
                { title: 'Possible products', items: selected.possible_products, icon: CheckCircle2 },
                { title: 'Processing methods', items: selected.processing_methods, icon: FileSearch },
                { title: 'Quality considerations', items: selected.quality_requirements, icon: CheckCircle2 },
                { title: 'Buyer industries', items: selected.buyer_industries, icon: Leaf },
                { title: 'Storage & handling', items: selected.storage_handling, icon: CheckCircle2 },
                { title: 'Environmental considerations', items: selected.environmental_considerations, icon: Leaf },
                { title: 'Common by-products and aliases', items: [...selected.common_byproducts, ...selected.aliases], icon: BookOpen },
              ].map((group) => {
                const Icon = group.icon
                return (
                  <div key={group.title} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900"><Icon size={16} className="text-forest-600" /> {group.title}</h3>
                    <ul className="space-y-1.5">
                      {group.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" /> {item}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <Link to={`/analysis?material=${encodeURIComponent(selected.name)}`} className="btn-primary"><Sparkles size={15} /> Analyse this material <ArrowRight size={14} /></Link>
              {showSeller && <Link to="/find-buyers" className="btn-secondary">Find buyers</Link>}
              {showBuyer && <Link to="/find-materials" className="btn-secondary">Find materials</Link>}
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  )
}
