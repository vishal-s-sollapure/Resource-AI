import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Mail, MessageSquareReply, Plus, Search } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Badge, Button, DemoBadge, EmptyState, ErrorState, Field, Input, LoadingGrid, Modal, PageHeader, Select, StatusBadge, Tabs, Textarea } from '../components/ui'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import type { Listing, Requirement, User } from '../lib/types'
import { dateTime, titleCase } from '../lib/utils'
import { useApp } from '../state/AppContext'

interface Enquiry {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  requirement_id?: string | null
  message: string
  status: string
  reply?: string | null
  is_demo?: boolean
  created_at?: string
  updated_at?: string
}

export default function Enquiries() {
  const { user, notify } = useApp()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [replying, setReplying] = useState<Enquiry | null>(null)
  const [form, setForm] = useState({ listing_id: '', requirement_id: '', message: '' })
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const query = useApiData<{ items: Enquiry[] }>('/enquiries')
  const listings = useApiData<{ items: Listing[] }>('/listings?status=active')
  const identity = useApiData<{ user: User }>('/auth/me')
  const effectiveUser = user || identity.data?.user
  const userId = effectiveUser?.id || ''
  const role = effectiveUser?.role
  const isSellerOnly = role === 'seller'
  const isBuyerOnly = role === 'buyer'
  const canRespond = role === 'seller' || role === 'buyer_seller' || role === 'admin'
  const myListings = useApiData<{ items: Listing[] }>(isSellerOnly ? '/listings/mine?status=active' : null, [isSellerOnly])
  const requirements = useApiData<{ items: Requirement[] }>(isBuyerOnly ? null : '/requirements', [isBuyerOnly])
  const modalListings = (isSellerOnly ? myListings.data?.items : listings.data?.items) || []

  const all = query.data?.items || []
  const filtered = all.filter((item) => {
    const side = item.buyer_id === userId ? 'sent' : item.seller_id === userId ? 'received' : 'other'
    const matchesTab = tab === 'all' || (tab === 'sent' && side === 'sent') || (tab === 'received' && side === 'received') || (tab === 'replied' && Boolean(item.reply))
    const matchesSearch = `${item.message} ${listingName(item.listing_id)}`.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  function listingName(listingId: string) {
    return listings.data?.items.find((listing) => listing.id === listingId)?.material_name || listingId
  }

  function openCreate() {
    setForm({ listing_id: modalListings[0]?.id || '', requirement_id: '', message: '' })
    setCreating(true)
  }

  async function create() {
    if (!form.listing_id || !form.message.trim()) {
      notify('Choose a listing and write a message.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/enquiries', {
        listing_id: form.listing_id,
        requirement_id: form.requirement_id || undefined,
        message: form.message,
      })
      notify('Enquiry sent.')
      setCreating(false)
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function openReply(item: Enquiry) {
    setReply(item.reply || '')
    setReplying(item)
  }

  async function saveReply() {
    if (!replying) return
    if (!reply.trim()) {
      notify('Write a reply before sending.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.patch(`/enquiries/${replying.id}`, { reply, status: 'replied' })
      notify('Reply saved.')
      setReplying(null)
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function closeEnquiry(item: Enquiry) {
    setBusy(true)
    try {
      await api.patch(`/enquiries/${item.id}`, { status: 'closed' })
      notify('Enquiry closed.')
      query.reload()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Conversations"
        title={isSellerOnly ? 'Enquiries' : isBuyerOnly ? 'RFQs' : 'Enquiries & RFQs'}
        description="Messages between buyers and sellers. An enquiry is a conversation, not an order or confirmed demand."
        actions={<><Button onClick={openCreate} disabled={busy}><Plus size={16} /> New enquiry</Button><DemoBadge /></>}
      />

      <div className="card mb-5 space-y-4 p-5">
        <Field label="Search enquiries">
          <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Material or message…" /></div>
        </Field>
        <Tabs active={tab} onChange={setTab} items={[
          { id: 'all', label: 'All', count: all.length },
          { id: 'sent', label: 'Sent' },
          { id: 'received', label: 'Received' },
          { id: 'replied', label: 'Replied' },
        ]} />
      </div>

      {query.error && <div className="mb-5"><ErrorState message={query.error} onRetry={query.reload} /></div>}
      {listings.error && <div className="mb-5"><ErrorState message={listings.error} onRetry={listings.reload} /></div>}
      {requirements.error && <div className="mb-5"><ErrorState message={requirements.error} onRetry={requirements.reload} /></div>}
      {query.loading ? <LoadingGrid count={3} /> : filtered.length ? (
        <div className="space-y-4">
          {filtered.map((item) => {
            const sent = item.buyer_id === userId
            return (
              <div key={item.id} className="card p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest-50 text-forest-700"><Mail size={18} /></span>
                    <div>
                      <p className="font-bold text-ink-900">{listingName(item.listing_id)}</p>
                      <p className="text-xs text-slate-500">
                        {sent ? 'Sent by you' : `From ${item.buyer_id.replace('usr_', 'demo user ')}`} · {dateTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={sent ? 'blue' : 'green'}>{sent ? 'Sent' : 'Received'}</Badge>
                    <StatusBadge status={item.status} />
                    {item.is_demo && <DemoBadge />}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="label">Message</p>
                  <p className="text-sm leading-relaxed text-ink-800">{item.message}</p>
                </div>
                {item.reply ? (
                  <div className="mt-3 rounded-xl border border-forest-200 bg-forest-50/50 p-4">
                    <p className="label text-forest-800">Reply</p>
                    <p className="text-sm leading-relaxed text-ink-800">{item.reply}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No reply yet.</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {canRespond && !sent && <Button size="sm" onClick={() => openReply(item)} disabled={busy}><MessageSquareReply size={14} /> Reply</Button>}
                  {item.status !== 'closed' && <Button size="sm" variant="secondary" onClick={() => closeEnquiry(item)} disabled={busy}>Close</Button>}
                  <Link to="/negotiations" className="btn-ghost btn-sm">Open negotiation workspace</Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={<Inbox size={22} />} title="No enquiries found" description="Send an enquiry from a listing or adjust the filters." action={<Button onClick={openCreate}>New enquiry</Button>} />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={isSellerOnly ? 'New seller enquiry' : isBuyerOnly ? 'New RFQ' : 'New enquiry / RFQ'}
        description={
          isSellerOnly
            ? 'Choose one of your listings and a published buyer requirement to respond to that buyer.'
            : isBuyerOnly
              ? 'Choose a listing and ask the seller for a quotation.'
              : 'Buyers: choose a listing and ask the seller for a quotation. Sellers: choose one of your listings and a published requirement to respond to that buyer.'
        }
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button><Button onClick={create} loading={busy}>Send enquiry</Button></>}
      >
        <div className="space-y-4">
          <Field label={isSellerOnly ? 'Your listing' : 'Listing'} required>
            <Select value={form.listing_id} onChange={(event) => setForm({ ...form, listing_id: event.target.value })}>
              {modalListings.map((listing) => (
                <option key={listing.id} value={listing.id}>{listing.material_name} · {listing.quantity} {listing.unit} · {titleCase(listing.location)}</option>
              ))}
            </Select>
          </Field>
          {!isBuyerOnly && (
            <Field label="Related published requirement (optional — for seller responses)">
              <Select value={form.requirement_id} onChange={(event) => setForm({ ...form, requirement_id: event.target.value })}>
                <option value="">None</option>
                {(requirements.data?.items || []).map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>{requirement.material_name} · {requirement.quantity} {requirement.unit}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Message" required><Textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={canRespond && role === 'seller' ? 'Introduce your available material and respond to the published requirement…' : 'Introduce your requirement and ask for a quotation…'} /></Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(replying)}
        onClose={() => setReplying(null)}
        title="Reply to enquiry"
        dismissible={!busy}
        footer={<><Button variant="secondary" onClick={() => setReplying(null)} disabled={busy}>Cancel</Button><Button onClick={saveReply} loading={busy}>Send reply</Button></>}
      >
        <Field label="Your reply" required><Textarea value={reply} onChange={(event) => setReply(event.target.value)} /></Field>
      </Modal>
    </DashboardLayout>
  )
}
