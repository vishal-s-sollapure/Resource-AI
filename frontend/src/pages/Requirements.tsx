import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, FileText, Plus, Sparkles, Trash2 } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingGrid, Modal, PageHeader, Select, Tabs, Textarea } from '../components/ui'
import { RequirementCard } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import { canBuy } from '../lib/permissions'
import type { Requirement } from '../lib/types'
import { useApp } from '../state/AppContext'

const blank = {
  material_name: '', quantity: '', unit: 'kg', required_quality: 'ungraded', application: '',
  location: '', max_price: '', delivery_date: '', alternatives_allowed: false, description: '',
}

export default function Requirements() {
  const { user, notify } = useApp()
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Requirement | 'new' | null>(null)
  const [form, setForm] = useState(blank)
  const [deleting, setDeleting] = useState<Requirement | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  // Owner-scoped reads come from the token actor; admins and sellers use the
  // public browse view instead of requesting a 403 owner scope.
  const mayManage = canBuy(user?.role)
  const basePath = user && (user.role === 'admin' || !mayManage) ? '/requirements' : '/requirements/mine'
  const path = status === 'all' ? basePath : `${basePath}?status=${status}`
  const query = useApiData<{ items: Requirement[] }>(path)
  const set = (key: keyof typeof blank, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  function openForm(item?: Requirement) {
    if (item) setForm({
      material_name: item.material_name, quantity: String(item.quantity), unit: item.unit,
      required_quality: item.required_quality, application: item.application, location: item.location,
      max_price: item.max_price ? String(item.max_price) : '', delivery_date: item.delivery_date || '',
      alternatives_allowed: item.alternatives_allowed, description: item.description || '',
    })
    else setForm(blank)
    setEditing(item || 'new')
  }

  async function save() {
    if (!form.material_name || !form.quantity) {
      notify('Material and quantity are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form, quantity: Number(form.quantity),
        max_price: form.max_price ? Number(form.max_price) : null,
        delivery_date: form.delivery_date || null,
      }
      if (editing === 'new') await api.post('/requirements', payload)
      else await api.put(`/requirements/${(editing as Requirement).id}`, payload)
      notify(editing === 'new' ? 'Requirement published. Confirm it to signal confirmed demand.' : 'Requirement updated.')
      setEditing(null)
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDemand(item: Requirement) {
    if (confirming) return
    setConfirming(item.id)
    try {
      await api.patch(`/requirements/${item.id}/confirm`)
      notify('Requirement confirmed. It is now labelled as confirmed demand.')
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setConfirming(null)
    }
  }

  async function remove() {
    if (!deleting) return
    setRemoving(true)
    try {
      await api.delete(`/requirements/${deleting.id}`)
      notify('Requirement deleted.')
      setDeleting(null)
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Demand management"
        title="My Requirements"
        description="A published requirement is not confirmed demand until you explicitly confirm it."
        actions={<>
          <Link to="/find-materials" className="btn-secondary"><Sparkles size={15} /> AI assistant</Link>
          {mayManage && <Button onClick={() => openForm()}><Plus size={16} /> New requirement</Button>}
          {!mayManage && <p className="self-center text-sm text-slate-500">Browsing only. Switch to a buyer demo account to publish requirements.</p>}
        </>}
      />

      <div className="card mb-5 p-5">
        <Tabs active={status} onChange={setStatus} items={[{ id: 'all', label: 'All' }, { id: 'open', label: 'Open' }, { id: 'matched', label: 'Matched' }, { id: 'confirmed', label: 'Confirmed' }, { id: 'closed', label: 'Closed' }]} />
      </div>

      {query.error && <div className="mb-5"><ErrorState message={query.error} onRetry={query.reload} /></div>}
      {query.loading ? <LoadingGrid /> : query.data?.items.length ? (
        <div className="grid-auto">
          {query.data.items.map((item) => (
            <div key={item.id}>
              <RequirementCard requirement={item} />
              {mayManage && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!item.confirmed && <Button size="sm" onClick={() => confirmDemand(item)} loading={confirming === item.id} disabled={Boolean(confirming)}><BadgeCheck size={13} /> Confirm demand</Button>}
                  <Button size="sm" variant="secondary" onClick={() => openForm(item)} disabled={Boolean(confirming)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(item)} disabled={Boolean(confirming)}><Trash2 size={13} /> Delete</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : <EmptyState icon={<FileText size={22} />} title="No requirements yet" description="Describe what you need with the AI assistant or enter it manually." action={mayManage ? <Button onClick={() => openForm()}>New requirement</Button> : undefined} />}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New buyer requirement' : 'Edit requirement'}
        size="lg"
        dismissible={!saving}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={save} loading={saving}>Save requirement</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required material" required><Input value={form.material_name} onChange={(e) => set('material_name', e.target.value)} /></Field>
          <Field label="Quantity" required><Input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
          <Field label="Unit"><Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>{['kg', 'tonne', 'litre', 'piece', 'other'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label="Required quality"><Select value={form.required_quality} onChange={(e) => set('required_quality', e.target.value)}>{['ungraded', 'raw', 'dried', 'processed', 'A', 'B', 'C'].map((q) => <option key={q}>{q}</option>)}</Select></Field>
          <Field label="Intended application"><Input value={form.application} onChange={(e) => set('application', e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Maximum acceptable price (₹/unit)"><Input type="number" min="0" value={form.max_price} onChange={(e) => set('max_price', e.target.value)} /></Field>
          <Field label="Required delivery date"><Input type="date" value={form.delivery_date} onChange={(e) => set('delivery_date', e.target.value)} /></Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-forest-600" checked={form.alternatives_allowed} onChange={(e) => set('alternatives_allowed', e.target.checked)} /> Alternative materials allowed</label>
        <Field label="Notes" className="mt-4"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="mt-4"><Alert tone="info">Saving creates a published requirement. Confirm separately when demand is real.</Alert></div>
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete requirement?" message={`Delete “${deleting?.material_name || ''}”? This demo action cannot be undone.`} confirmLabel="Delete" danger loading={removing} />
    </DashboardLayout>
  )
}
