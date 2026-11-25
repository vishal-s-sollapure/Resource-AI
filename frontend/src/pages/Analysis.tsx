import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CircleDollarSign, FileText, Search, Sparkles } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, DemoBadge, ErrorState, Field, Input, LoadingGrid, PageHeader, Select, Tabs } from '../components/ui'
import { AiNotice, PassportCard } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import { canSell } from '../lib/permissions'
import type { Analysis, MaterialPassport, PriceEstimate } from '../lib/types'
import { useApp } from '../state/AppContext'

export default function Analysis() {
  const { user, notify } = useApp()
  const [searchParams] = useSearchParams()
  const mayCreatePassport = canSell(user?.role)
  const [form, setForm] = useState({
    material_name: searchParams.get('material') || 'Coconut husk', quantity: '500', unit: 'kg', form: 'raw',
    quality_grade: 'B', moisture_content: '12', location: 'Bengaluru, Karnataka',
    processing_level: 'sun-dried', source: 'Coconut processing units in Karnataka',
  })
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null)
  const [busy, setBusy] = useState<'analysis' | 'price' | 'passport' | null>(null)
  const [tab, setTab] = useState('analysis')
  const passports = useApiData<{ items: MaterialPassport[] }>('/passports')
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const payload = {
    material_name: form.material_name,
    quantity: Number(form.quantity),
    unit: form.unit,
    form: form.form,
    quality_grade: form.quality_grade,
    moisture_content: form.moisture_content ? Number(form.moisture_content) : null,
    processing_level: form.processing_level,
    location: form.location,
  }

  async function runAnalysis() {
    setBusy('analysis')
    try {
      const result = await api.post<{ analysis: Analysis }>('/materials/analyze', payload)
      setAnalysis(result.analysis)
      notify('Material analysis ready.')
    } catch (err) { notify((err as Error).message, 'error') }
    finally { setBusy(null) }
  }

  async function runPrice() {
    setBusy('price')
    try {
      const result = await api.post<{ estimate: PriceEstimate }>('/pricing/estimate', payload)
      setEstimate(result.estimate)
      setTab('pricing')
      notify('Price estimation ready.')
    } catch (err) { notify((err as Error).message, 'error') }
    finally { setBusy(null) }
  }

  async function createPassport() {
    if (!mayCreatePassport) {
      notify('Your account cannot create Material Passports. Switch to a seller demo account.', 'error')
      return
    }
    setBusy('passport')
    try {
      await api.post('/passports', {
        material_name: form.material_name,
        source: form.source,
        quantity: `${form.quantity} ${form.unit}`,
        quality: `Grade ${form.quality_grade}${form.moisture_content ? `, ${form.moisture_content}% moisture` : ''}`,
        processing_history: form.processing_level,
        intended_applications: (analysis?.possible_applications || []).map((item) => item.name),
        storage_conditions: analysis?.storage_handling || [],
        specifications: { origin: form.location, form: form.form, moisture_pct: form.moisture_content ? Number(form.moisture_content) : null },
      })
      passports.reload()
      setTab('passport')
      notify('Material Passport created.')
    } catch (err) { notify((err as Error).message, 'error') }
    finally { setBusy(null) }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Material intelligence"
        title="AI Material Intelligence"
        description="Applications are possibilities, not guarantees. Numerals come from transparent algorithms, not invented market prices."
        actions={<><Badge tone="purple"><Sparkles size={12} /> AI assisted</Badge><DemoBadge /></>}
      />

      <div className="card mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Material" required><Input value={form.material_name} onChange={(e) => set('material_name', e.target.value)} /></Field>
          <Field label="Quantity"><Input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
          <Field label="Unit"><Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>{['kg', 'tonne', 'litre', 'piece', 'other'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label="Form"><Select value={form.form} onChange={(e) => set('form', e.target.value)}>{['raw', 'dried', 'processed', 'fibre', 'powder', 'chips', 'other'].map((f) => <option key={f}>{f}</option>)}</Select></Field>
          <Field label="Quality grade"><Select value={form.quality_grade} onChange={(e) => set('quality_grade', e.target.value)}>{['A', 'B', 'C', 'ungraded'].map((g) => <option key={g}>{g}</option>)}</Select></Field>
          <Field label="Moisture (%)"><Input type="number" min="0" max="100" value={form.moisture_content} onChange={(e) => set('moisture_content', e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Processing level"><Input value={form.processing_level} onChange={(e) => set('processing_level', e.target.value)} /></Field>
          {mayCreatePassport && (
            <Field label="Source (for passport)" className="lg:col-span-2"><Input value={form.source} onChange={(e) => set('source', e.target.value)} /></Field>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
          <Button onClick={runAnalysis} loading={busy === 'analysis'} disabled={Boolean(busy)}><Search size={15} /> Analyse material</Button>
          <Button variant="secondary" onClick={runPrice} loading={busy === 'price'} disabled={Boolean(busy)}>Estimate price</Button>
          {mayCreatePassport && <Button variant="secondary" onClick={createPassport} loading={busy === 'passport'} disabled={Boolean(busy)}><FileText size={15} /> Create Material Passport</Button>}
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} items={[
        { id: 'analysis', label: 'Material analysis' },
        { id: 'pricing', label: 'Price estimation' },
        { id: 'passport', label: 'Material Passports', count: passports.data?.items.length },
      ]} />

      <div className="mt-6">
        {tab === 'analysis' && (
          analysis ? (
            <div className="card p-6">
              <AiNotice source={analysis.source}>{analysis.disclaimer}</AiNotice>
              <h3 className="mt-6 text-lg font-bold text-ink-900">Possible applications</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {analysis.possible_applications.map((item) => (
                  <div key={item.name} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-ink-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.rationale}</p>
                    <p className="mt-1 text-[11px] font-medium text-amber-700">{item.feasibility}</p>
                  </div>
                ))}
                {!analysis.possible_applications.length && <p className="text-sm text-slate-500">No verified applications found for this material. Add specifications and consult an expert.</p>}
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {[
                  ['Potential products', analysis.potential_products],
                  ['Industries that may use it', analysis.target_industries],
                  ['Processing requirements', analysis.processing_requirements],
                  ['Quality considerations', analysis.quality_considerations],
                  ['Storage & handling', analysis.storage_handling],
                  ['Environmental benefits', analysis.environmental_benefits],
                  ['Potential buyer categories', analysis.buyer_categories],
                ].map(([title, items]) => (
                  <div key={String(title)}>
                    <h4 className="mb-2 text-sm font-bold text-ink-900">{String(title)}</h4>
                    <div className="flex flex-wrap gap-1.5">{(items as string[]).map((item) => <span key={item} className="chip">{item}</span>)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={runPrice}>Estimate price <CircleDollarSign size={13} /></Button></div>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <Sparkles size={28} className="mx-auto mb-3 text-purple-500" />
              <p className="font-bold text-ink-900">Run an analysis to explore possibilities</p>
              <p className="mt-1 text-sm text-slate-500">The knowledge hub covers coconut husk, sugarcane bagasse, bamboo, jute and rice husk.</p>
              <Button className="mt-4" onClick={runAnalysis}>Analyse {form.material_name}</Button>
            </div>
          )
        )}

        {tab === 'pricing' && (
          estimate ? (
            <div className="card p-6">
              <h3 className="text-lg font-bold text-ink-900">Indicative price range</h3>
              {estimate.insufficient_data ? (
                <div className="mt-4"><Alert tone="warning" title="Insufficient market data.">
                  No reliable comparable listing or completed-transaction prices are available. The seller sets their own price, buyers request quotations and both parties negotiate.
                </Alert></div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    ['Low', estimate.suggested_low_per_kg], ['Typical', estimate.suggested_typical_per_kg], ['High', estimate.suggested_high_per_kg],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-forest-200 bg-forest-50 p-4">
                      <p className="text-xs font-semibold text-forest-800">Suggested {String(label).toLowerCase()} / kg</p>
                      <p className="mt-2 text-2xl font-bold text-forest-700">₹{value}</p>
                      <p className="mt-1 text-[11px] text-forest-800/70">≈ ₹{Number(value || 0) * 1000} / tonne</p>
                    </div>
                  ))}
                </div>
              )}
              {estimate.is_demo_estimate && <div className="mt-4"><DemoBadge>Demo estimates from comparable demo listings</DemoBadge></div>}
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="label">Factors affecting price (explanation only)</p>
                  <ul className="space-y-1.5">{estimate.factors.map((factor) => <li key={factor} className="text-sm text-slate-700">• {factor}</li>)}</ul>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p><strong>Data source:</strong> {estimate.data_source}</p>
                  <p className="mt-1"><strong>Confidence:</strong> {estimate.confidence} · {estimate.comparable_count} comparables</p>
                  <p className="mt-2 text-xs text-slate-600">{estimate.seller_control}</p>
                </div>
              </div>
            </div>
          ) : <div className="card p-10 text-center text-sm text-slate-500">Click “Estimate price” to see a transparent reference range.</div>
        )}

        {tab === 'passport' && (
          <div className="space-y-4">
            {passports.error && <ErrorState message={passports.error} onRetry={passports.reload} />}
            {passports.loading && <LoadingGrid count={1} />}
            {passports.data?.items.map((passport) => <PassportCard key={passport.id} passport={passport} />)}
            {!passports.loading && !passports.error && !passports.data?.items.length && (
              <div className="card p-10 text-center">
                <FileText size={26} className="mx-auto mb-3 text-forest-600" />
                <p className="font-bold">No Material Passports yet</p>
                <p className="mt-1 text-sm text-slate-500">Create one from the analysis above to record source, quality and intended applications.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
