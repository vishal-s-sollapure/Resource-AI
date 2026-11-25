import { useEffect, useState } from 'react'
import { BadgeCheck, Building2, CheckCircle2, CreditCard, LockKeyhole, RotateCcw, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { DashboardLayout } from '../components/layout'
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Field, Input, LoadingGrid, PageHeader, Textarea } from '../components/ui'
import { api } from '../lib/api'
import { useApiData } from '../lib/hooks'
import type { Profile as BusinessProfile, User } from '../lib/types'
import { shortDate, titleCase } from '../lib/utils'
import { useApp } from '../state/AppContext'

interface SubscriptionInfo {
  tier: string
  monthly_price: number
  subscription: Record<string, unknown> | null
  demo_mode: boolean
  note: string
}

const blank = {
  full_name: '', phone: '', business_name: '', business_type: '', industry: '',
  contact_person: '', email: '', location: '', description: '', logo_url: '',
  bank_account_holder: '', bank_name: '', bank_account_number: '', bank_ifsc: '', bank_upi: '',
}

export default function Profile() {
  const { user, setUser, notify } = useApp()
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const query = useApiData<{ user: User; profile: BusinessProfile | null }>('/profile')
  const subscription = useApiData<SubscriptionInfo>('/subscription')
  const set = (key: keyof typeof blank, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const canSell = user?.role === 'seller' || user?.role === 'buyer_seller' || user?.role === 'admin'

  useEffect(() => {
    if (!query.data) return
    const nextUser = query.data.user
    const profile = query.data.profile
    setForm({
      full_name: nextUser.full_name || '',
      phone: nextUser.phone || '',
      business_name: profile?.business_name || '',
      business_type: profile?.business_type || '',
      industry: profile?.industry || '',
      contact_person: profile?.contact_person || nextUser.full_name || '',
      email: profile?.email || nextUser.email || '',
      location: profile?.location || '',
      description: profile?.description || '',
      logo_url: profile?.logo_url || '',
      bank_account_holder: '', bank_name: '', bank_account_number: '', bank_ifsc: '', bank_upi: '',
    })
  }, [query.data])

  async function save() {
    if (!form.full_name.trim()) {
      notify('Full name is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await api.put<{ user: User; profile: BusinessProfile }>('/profile', form)
      setUser(result.user)
      query.reload()
      notify('Profile saved. Bank details remain private and masked in the UI.')
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function changeSubscription(action: 'upgrade' | 'downgrade') {
    setBusy(true)
    try {
      await api.post(`/subscription/${action}`)
      subscription.reload()
      notify(action === 'upgrade' ? 'Premium demo activated — no payment collected.' : 'Switched to basic demo mode.')
      if (user) setUser({ ...user, subscription_tier: action === 'upgrade' ? 'premium' : 'basic' })
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function resetDemo() {
    setResetting(true)
    try {
      await api.post('/demo/reset')
      notify('Demo data restored to the seeded state. Reload the page to refresh all views.')
      setResetOpen(false)
      window.setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setResetting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Account settings"
        title="Business Profile & Plan"
        description={canSell ? 'Your public business information, private payout details and the demo subscription.' : 'Your public business information and the demo subscription.'}
        actions={<>
          <Badge tone={user?.verification_status === 'verified' ? 'green' : 'amber'}>
            <BadgeCheck size={12} /> {titleCase(user?.verification_status || 'unverified')}
          </Badge>
          <Badge tone={user?.subscription_tier === 'premium' ? 'green' : 'gray'}>{user?.subscription_tier === 'premium' ? 'Premium demo' : 'Basic / trial'}</Badge>
        </>}
      />

      {query.error && <div className="mb-5"><ErrorState message={query.error} onRetry={query.reload} /></div>}
      {query.loading ? <LoadingGrid count={2} /> : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            <section className="card p-6">
              <div className="mb-5 flex items-center gap-2">
                <Building2 size={19} className="text-forest-600" />
                <h3 className="font-bold text-ink-900">Business information</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required><Input value={form.full_name} onChange={(event) => set('full_name', event.target.value)} /></Field>
                <Field label="Contact phone"><Input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></Field>
                <Field label="Business name"><Input value={form.business_name} onChange={(event) => set('business_name', event.target.value)} /></Field>
                <Field label="Business type"><Input value={form.business_type} onChange={(event) => set('business_type', event.target.value)} /></Field>
                <Field label="Industry"><Input value={form.industry} onChange={(event) => set('industry', event.target.value)} /></Field>
                <Field label="Contact person"><Input value={form.contact_person} onChange={(event) => set('contact_person', event.target.value)} /></Field>
                <Field label="Email"><Input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></Field>
                <Field label="Location"><Input value={form.location} onChange={(event) => set('location', event.target.value)} /></Field>
                <Field label="Logo URL" className="sm:col-span-2"><Input value={form.logo_url} onChange={(event) => set('logo_url', event.target.value)} placeholder="https://…" /></Field>
                <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(event) => set('description', event.target.value)} /></Field>
              </div>
              <div className="mt-5 flex justify-end border-t border-slate-100 pt-5"><Button onClick={save} loading={saving}><Save size={15} /> Save profile</Button></div>
            </section>

            {canSell && (
              <section className="card p-6">
                <div className="mb-2 flex items-center gap-2">
                  <LockKeyhole size={19} className="text-forest-600" />
                  <h3 className="font-bold text-ink-900">Private bank details</h3>
                </div>
                <p className="mb-5 text-sm leading-relaxed text-slate-600">
                  Used only as demo payout details for a buyer after seller acceptance. The app masks the account number and never exposes full details in public listings or API responses.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Account holder" hint="Leave blank to keep the saved demo value."><Input value={form.bank_account_holder} onChange={(event) => set('bank_account_holder', event.target.value)} /></Field>
                  <Field label="Bank name" hint="Leave blank to keep the saved demo value."><Input value={form.bank_name} onChange={(event) => set('bank_name', event.target.value)} /></Field>
                  <Field label="Account number" hint="Leave blank to keep the saved demo value."><Input value={form.bank_account_number} onChange={(event) => set('bank_account_number', event.target.value)} placeholder="Demo details only" /></Field>
                  <Field label="IFSC" hint="Leave blank to keep the saved demo value."><Input value={form.bank_ifsc} onChange={(event) => set('bank_ifsc', event.target.value)} /></Field>
                  <Field label="UPI ID (optional)" hint="Leave blank to keep the saved demo value." className="sm:col-span-2"><Input value={form.bank_upi} onChange={(event) => set('bank_upi', event.target.value)} /></Field>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <Alert tone="warning">Do not enter real bank details. This prototype does not collect or transfer money.</Alert>
                  <Button variant="secondary" onClick={save} loading={saving}>Save private details</Button>
                </div>
              </section>
            )}
          </div>

          <div className="space-y-5">
            <section className="card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={19} className="text-purple-600" />
                <h3 className="font-bold text-ink-900">Subscription</h3>
              </div>
              {subscription.error ? (
                <ErrorState message={subscription.error} onRetry={subscription.reload} />
              ) : subscription.loading ? <LoadingGrid count={1} /> : (
                <>
                  <div className="rounded-2xl bg-forest-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-forest-800">Current tier</p>
                    <p className="mt-1 text-2xl font-extrabold text-forest-700">{titleCase(subscription.data?.tier || 'basic')}</p>
                    <p className="mt-1 text-xs text-forest-800/80">Illustrative price only: ₹{subscription.data?.monthly_price || 0} / month · no payment collected</p>
                    <p className="mt-1 text-[11px] text-forest-800/70">Trial ends: {shortDate(user?.trial_ends_at)}</p>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {[
                      'Basic and premium demo tiers are labels only in this prototype.',
                      'All MVP workflows here are available on either tier; no payment is collected.',
                    ].map((item) => <li key={item} className="flex gap-2"><CheckIcon /> {item}</li>)}
                  </ul>
                  <Alert tone="info">{subscription.data?.note || 'Premium is simulated for the hackathon; no payment is collected.'}</Alert>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => changeSubscription('upgrade')} loading={busy} disabled={busy || Boolean(subscription.error) || subscription.data?.tier === 'premium'}>Activate premium demo</Button>
                    <Button size="sm" variant="secondary" onClick={() => changeSubscription('downgrade')} loading={busy} disabled={busy || Boolean(subscription.error) || subscription.data?.tier !== 'premium'}>Switch to basic</Button>
                  </div>
                </>
              )}
            </section>

            <section className="card p-6">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={19} className="text-forest-600" />
                <h3 className="font-bold text-ink-900">Trust & privacy</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2"><CheckIcon /> Secret API keys remain on the server.</li>
                <li className="flex gap-2"><CheckIcon /> Bank details appear only after order acceptance and are masked.</li>
                <li className="flex gap-2"><CheckIcon /> Prices and transactions are clearly labelled demo data.</li>
              </ul>
            </section>

            {user?.role === 'admin' && (
              <section className="card p-6">
                <div className="mb-2 flex items-center gap-2"><CreditCard size={18} className="text-amber-600" /><h3 className="font-bold text-ink-900">Demo reset</h3></div>
                <p className="mb-4 text-sm text-slate-600">Restore all seeded users, listings, orders and messages. Any changes made in this session will be lost.</p>
                <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}><RotateCcw size={14} /> Reset demo data</Button>
              </section>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetDemo}
        title="Reset all demo data?"
        message="This restores the seed dataset. Any listings, requirements, offers, orders or profile changes you created will be removed."
        confirmLabel="Reset demo"
        danger
        loading={resetting}
      />
    </DashboardLayout>
  )
}

function CheckIcon() {
  return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-forest-500" />
}
