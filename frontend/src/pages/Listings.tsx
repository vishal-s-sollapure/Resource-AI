import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingGrid, Modal, PageHeader, Select, Tabs, Textarea } from '../components/ui'
import { ListingCard } from '../components/domain'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import { canSell } from '../lib/permissions'
import type { Listing } from '../lib/types'
import { useApp } from '../state/AppContext'

const blank = {
  material_name: '', category: 'coconut', quantity: '', unit: 'kg', form: 'raw',
  quality_grade: 'ungraded', moisture_content: '', processing_level: 'raw', location: '',
  price: '', price_type: 'negotiable', available_date: '', description: '',
}

export default function Listings() {
  const { user, notify } = useApp()
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Listing | 'new' | null>(null)
  const [form, setForm] = useState(blank)
  const [deleting, setDeleting] = useState<Listing | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  // Owner-scoped reads come from the token actor, never a client-supplied id.
  // Buyers/admins get the intentionally global browse view instead of a 403.
  const mayManage = canSell(user?.role)
  const query = useApiData<{ items: Listing[] }>(
    user && (user.role === 'admin' || !mayManage) ? `/listings?status=${status}` : `/listings/mine?status=${status}`,
  )
  const listings = (query.data?.items || []).filter((item) => item.material_name.toLowerCase().includes(search.toLowerCase()))
  const set = (key: keyof typeof blank, value: string) => setForm((current) => ({ ...current, [key]: value }))

  function openForm(listing?: Listing) {
    if (listing) {
      setForm({
        material_name: listing.material_name, category: listing.category, quantity: String(listing.quantity),
        unit: listing.unit, form: listing.form, quality_grade: listing.quality_grade,
        moisture_content: listing.moisture_content ? String(listing.moisture_content) : '',
        processing_level: listing.processing_level, location: listing.location, price: String(listing.price),
        price_type: listing.price_type, available_date: listing.available_date || '', description: listing.description,
      })
    } else setForm(blank)
    setEditing(listing || 'new')
  }

  async function save() {
    if (!form.material_name || !form.quantity || !form.price) {
      notify('Material name, quantity and price are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        price: Number(form.price),
        moisture_content: form.moisture_content ? Number(form.moisture_content) : null,
        available_date: form.available_date || null,
      }
      if (editing === 'new') await api.post('/listings', payload)
      else await api.put(`/listings/${(editing as Listing).id}`, payload)
      notify(editing === 'new' ? 'Listing created.' : 'Listing updated.')
      setEditing(null)
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(listing: Listing, next: string) {
    if (updating) return
    setUpdating(listing.id)
    try {
      await api.patch(`/listings/${listing.id}/status`, { status: next })
      notify(`Listing ${next}.`)
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setUpdating(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      await api.delete(`/listings/${deleting.id}`)
      notify('Listing deleted (status set to deleted).')
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
        eyebrow="Supply management"
        title="My Listings"
        description="Add, edit, pause or delete your material lots. Demo prices never become real market quotes."
        actions={mayManage ? <Button onClick={() => openForm()}><Plus size={16} /> Add material</Button> : (
          <p className="self-center text-sm text-slate-500">Browsing only. Switch to a seller demo account to manage listings.</p>
        )}
      />

      <div className="card mb-5 space-y-4 p-5">
        <Field label="Search listings"><div className="relative max-w-md"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Material name…" /></div></Field>
        <Tabs active={status} onChange={setStatus} items={[{ id: 'active', label: 'Active' }, { id: 'paused', label: 'Paused' }, { id: 'sold', label: 'Sold' }, { id: 'deleted', label: 'Deleted' }]} />
      </div>

      {query.error && <div className="mb-5"><ErrorState message={query.error} onRetry={query.reload} /></div>}
      {query.loading ? <LoadingGrid /> : listings.length ? (
        <div className="grid-auto">
          {listings.map((listing) => (
            <div key={listing.id}>
              <ListingCard listing={listing} />
              {mayManage && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openForm(listing)} disabled={Boolean(updating)}><Pencil size={13} /> Edit</Button>
                  <Button size="sm" variant={listing.status === 'paused' ? 'primary' : 'secondary'} onClick={() => changeStatus(listing, listing.status === 'paused' ? 'active' : 'paused')} loading={updating === listing.id} disabled={Boolean(updating)}>
                    {listing.status === 'paused' ? 'Activate' : 'Pause'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => changeStatus(listing, 'sold')} loading={updating === listing.id} disabled={Boolean(updating)}>Mark sold</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(listing)} disabled={Boolean(updating)}><Trash2 size={13} /> Delete</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Plus size={22} />} title={search ? 'No matching listings' : `No ${status} listings`} description="Create a listing to start receiving enquiries and offers." action={<Button onClick={() => openForm()}>Add material</Button>} />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a material listing' : 'Edit listing'}
        description="A listing is a specific quantity offered by a seller — separate from material knowledge."
        size="lg"
        dismissible={!saving}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={save} loading={saving}>{editing === 'new' ? 'Create listing' : 'Save changes'}</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Material name" required><Input value={form.material_name} onChange={(e) => set('material_name', e.target.value)} /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => set('category', e.target.value)}>{['coconut', 'sugarcane', 'bamboo', 'jute', 'rice', 'wood', 'food_processing', 'industrial', 'other'].map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</Select></Field>
          <Field label="Quantity" required><Input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
          <Field label="Unit"><Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>{['kg', 'tonne', 'litre', 'piece', 'other'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label="Form"><Select value={form.form} onChange={(e) => set('form', e.target.value)}>{['raw', 'dried', 'processed', 'fibre', 'powder', 'chips', 'pellet', 'other'].map((f) => <option key={f}>{f}</option>)}</Select></Field>
          <Field label="Quality grade"><Select value={form.quality_grade} onChange={(e) => set('quality_grade', e.target.value)}>{['A', 'B', 'C', 'ungraded'].map((g) => <option key={g}>{g}</option>)}</Select></Field>
          <Field label="Moisture (%)"><Input type="number" min="0" max="100" value={form.moisture_content} onChange={(e) => set('moisture_content', e.target.value)} /></Field>
          <Field label="Processing level"><Input value={form.processing_level} onChange={(e) => set('processing_level', e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Price (₹ per unit)" required><Input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label="Pricing"><Select value={form.price_type} onChange={(e) => set('price_type', e.target.value)}><option value="negotiable">Negotiable</option><option value="fixed">Fixed</option></Select></Field>
          <Field label="Available date"><Input type="date" value={form.available_date} onChange={(e) => set('available_date', e.target.value)} /></Field>
        </div>
        <Field label="Description" className="mt-4"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="mt-4"><Alert tone="info">You always set your own price. AI estimates are indicative references only.</Alert></div>
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} title="Delete this listing?" message={`“${deleting?.material_name || ''}” will be marked as deleted and hidden from buyers. This is a demo action.`} confirmLabel="Delete listing" danger loading={removing} />
    </DashboardLayout>
  )
}
