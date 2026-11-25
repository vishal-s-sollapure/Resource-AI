import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { PublicLayout } from '../components/layout'
import { Alert, Badge, Button, Field, Input, Select } from '../components/ui'
import { useApp } from '../state/AppContext'
import { dashboardPath, safeRedirect } from '../lib/navigation'
import type { Role } from '../lib/types'

const demoRoles: Array<{ role: Role; label: string; detail: string }> = [
  { role: 'seller', label: 'Seller', detail: 'GreenLoop Agro Byproducts' },
  { role: 'buyer', label: 'Buyer', detail: 'Verdant Materials Pvt Ltd' },
  { role: 'buyer_seller', label: 'Buyer & Seller', detail: 'North East Fibre Works' },
  { role: 'admin', label: 'Admin / Demo', detail: 'Marketplace overview' },
]

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('seller@demo.resourceai.in')
  const [password, setPassword] = useState('demo123')
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [role, setRole] = useState<Role>('seller')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const { login, register, demoLogin } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const destination = (nextRole?: Role | null) => safeRedirect(searchParams.get('next'), dashboardPath(nextRole))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const result = mode === 'login'
      ? await login(email, password)
      : await register({ email, password, full_name: fullName || businessName, business_name: businessName, role })
    setBusy(false)
    if (result.ok) navigate(destination(result.user?.role || role))
    else setMessage(result.message || 'Unable to continue.')
  }

  async function quickLogin(nextRole: Role) {
    setBusy(true)
    setMessage('')
    const result = await demoLogin(nextRole)
    setBusy(false)
    if (result.ok) navigate(destination(result.user?.role || nextRole))
    else setMessage(result.message || 'Unable to log in.')
  }

  return (
    <PublicLayout>
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_1.05fr] lg:py-16">
        <div className="flex flex-col justify-center">
          <Badge tone="green" className="mb-4 w-fit">Secure workspace · Demo mode available</Badge>
          <h1 className="text-4xl font-extrabold leading-tight text-ink-900">Join the circular materials marketplace.</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            List by-products, discover buyers, request materials and coordinate delivery. This prototype uses seeded demo accounts and signed demo sessions; no external identity provider is configured.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Create a verified-style business profile',
              'AI material analysis and requirement extraction',
              'Transparent matching, offers and direct payments',
            ].map((item) => (
              <p key={item} className="flex items-center gap-2.5 text-sm text-ink-800"><CheckCircle2 size={17} className="text-forest-600" /> {item}</p>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-forest-200 bg-forest-50 p-5">
            <p className="flex items-center gap-2 font-bold text-forest-900"><ShieldCheck size={18} /> Privacy by design</p>
            <p className="mt-2 text-sm leading-relaxed text-forest-800/80">
              Bank details are private, masked and shown only to the buyer after the seller accepts an order. Secret API keys stay on the server.
            </p>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1">
            <button onClick={() => setMode('login')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-500'}`}>Log in</button>
            <button onClick={() => setMode('register')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-500'}`}>Create account</button>
          </div>

          {message && <div className="mb-4"><Alert tone="error">{message}</Alert></div>}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="Full name" required>
                  <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" required />
                </Field>
                <Field label="Business name">
                  <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Your company" />
                </Field>
                <Field label="Role" required>
                  <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                    <option value="seller">Seller — I have materials</option>
                    <option value="buyer">Buyer — I need materials</option>
                    <option value="buyer_seller">Buyer and Seller</option>
                  </Select>
                </Field>
              </>
            )}
            <Field label="Email address" required>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <Input className="pl-9" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            </Field>
            <Field label="Password" required hint="Demo password: demo123">
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <Input className="pl-9" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === 'login' ? 'Log in' : 'Create account and start free trial'} <ArrowRight size={16} />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or use a demo account <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {demoRoles.map((item) => (
              <button
                key={item.role}
                onClick={() => quickLogin(item.role)}
                disabled={busy}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-forest-400 hover:bg-forest-50 disabled:opacity-50"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-forest-50 text-forest-700">
                  {item.role === 'admin' ? <ShieldCheck size={17} /> : item.role === 'seller' ? <Building2 size={17} /> : <UserRound size={17} />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{item.label}</span>
                  <span className="block text-[11px] text-slate-500">{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">All demo accounts use password <strong>demo123</strong>. No real money or personal data is involved.</p>
        </div>
      </div>
    </PublicLayout>
  )
}
