import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Boxes, ChevronRight, CircleUserRound, FileSearch, Handshake, LayoutDashboard,
  Leaf, LogOut, Menu, PackageSearch, Recycle, Search, Settings2, ShieldCheck, ShoppingBag, Truck, X,
} from 'lucide-react'
import { useApp } from '../state/AppContext'
import { dashboardPath } from '../lib/navigation'
import { canBuy, canSell } from '../lib/permissions'
import { cn, titleCase } from '../lib/utils'
import { Badge } from './ui'

export function Logo({ compact = false, light = false, onNavigate }: { compact?: boolean; light?: boolean; onNavigate?: () => void }) {
  return (
    <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5">
      <span className={cn('grid h-10 w-10 place-items-center rounded-xl shadow-sm ring-1', light ? 'bg-white/10 text-white ring-white/20' : 'bg-forest-700 text-white ring-forest-800')}>
        <Recycle size={20} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block font-display text-[17px] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink-900')}>
            ReSource<span className="text-forest-500"> AI</span>
          </span>
          <span className={cn('block text-[10px] font-semibold uppercase tracking-[0.16em]', light ? 'text-white/60' : 'text-slate-500')}>
            Circular commerce
          </span>
        </span>
      )}
    </Link>
  )
}

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/find-buyers', label: 'Find Buyers' },
  { to: '/find-materials', label: 'Find Materials' },
  { to: '/knowledge', label: 'Knowledge Hub' },
]

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { user, logout } = useApp()
  const location = useLocation()
  const showSeller = canSell(user?.role)
  const showBuyer = canBuy(user?.role)
  const visiblePublicLinks = publicLinks.filter((link) => {
    if (link.to === '/find-buyers') return showSeller
    if (link.to === '/find-materials') return showBuyer
    return true
  })

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-[72px] items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex">
            {visiblePublicLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3.5 py-2 text-sm font-semibold transition duration-200',
                    isActive || location.pathname.startsWith(link.to) && link.to !== '/'
                      ? 'bg-forest-50 text-forest-800 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-ink-900',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/admin" className="btn-ghost btn-sm">Admin / Demo</Link>
            {user ? (
              <>
                <Link to={dashboardPath(user.role)} className="btn-secondary btn-sm">
                  <CircleUserRound size={15} /> {user.full_name.split(' ')[0]}
                </Link>
                <button onClick={logout} className="btn-ghost btn-sm" title="Log out"><LogOut size={15} /></button>
              </>
            ) : (
              <Link to="/login" className="btn-primary btn-sm">Log in</Link>
            )}
          </div>
          <button onClick={() => setOpen((value) => !value)} className="rounded-lg p-2 text-ink-900 lg:hidden" aria-label="Toggle navigation">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <div className="animate-fade-in border-t border-slate-200 bg-white px-4 py-3 shadow-lg lg:hidden">
            <div className="flex flex-col gap-1">
              {visiblePublicLinks.map((link) => (
                <NavLink key={link.to} to={link.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-forest-50">
                  {link.label}
                </NavLink>
              ))}
              {showSeller && <NavLink to="/seller" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-forest-50">Seller Dashboard</NavLink>}
              {showBuyer && <NavLink to="/buyer" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-forest-50">Buyer Dashboard</NavLink>}
              <NavLink to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-forest-50">Admin / Demo</NavLink>
              {user && (
                <NavLink to="/profile" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-forest-50">Business Profile</NavLink>
              )}
              <NavLink to={user ? dashboardPath(user.role) : '/login'} onClick={() => setOpen(false)} className="mt-1 rounded-lg bg-forest-600 px-3 py-2.5 text-center text-sm font-semibold text-white">
                {user ? `Go to ${titleCase(user.role)} workspace` : 'Log in / Demo login'}
              </NavLink>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-800 bg-ink-950 text-slate-300">
        <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              An AI-powered marketplace for industrial and agricultural by-products. Turning leftovers into raw materials.
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-forest-400">Explore</p>
            <ul className="space-y-2 text-sm">
              {showSeller && <li><Link className="transition hover:text-white" to="/find-buyers">Find Buyers</Link></li>}
              {showBuyer && <li><Link className="transition hover:text-white" to="/find-materials">Find Materials</Link></li>}
              <li><Link className="transition hover:text-white" to="/knowledge">Knowledge Hub</Link></li>
              <li><Link className="transition hover:text-white" to="/analysis">Material Analysis</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-forest-400">Dashboards</p>
            <ul className="space-y-2 text-sm">
              {showSeller && <li><Link className="transition hover:text-white" to="/seller">Seller Dashboard</Link></li>}
              {showBuyer && <li><Link className="transition hover:text-white" to="/buyer">Buyer Dashboard</Link></li>}
              <li><Link className="transition hover:text-white" to="/admin">Admin / Demo</Link></li>
              <li><Link className="transition hover:text-white" to="/profile">Business Profile</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-forest-400">Trust & clarity</p>
            <p className="text-sm leading-relaxed text-slate-400">
              AI prospects are labelled. Demo prices and sample businesses are clearly marked. Payments are direct to sellers and never simulated as received without seller confirmation.
            </p>
          </div>
        </div>
        <div className="border-t border-ink-800 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} ReSource AI — Hackathon MVP. Demo data only. Turn Waste into Business Opportunities.
        </div>
      </footer>
    </div>
  )
}

const sellerNav = [
  { to: '/seller', label: 'Overview', icon: LayoutDashboard },
  { to: '/listings', label: 'My Listings', icon: Boxes },
  { to: '/find-buyers', label: 'Find Buyers', icon: Search },
  { to: '/analysis', label: 'AI Material Analysis', icon: FileSearch },
  { to: '/discovery', label: 'Business Discovery', icon: BarChart3 },
  { to: '/matches', label: 'Buyer Matches', icon: Handshake },
  { to: '/enquiries', label: 'Enquiries', icon: Leaf },
  { to: '/negotiations', label: 'Offers & Negotiation', icon: ShoppingBag },
  { to: '/orders', label: 'Orders & Payments', icon: PackageSearch },
  { to: '/profile', label: 'Profile & Plan', icon: Settings2 },
]

const buyerNav = [
  { to: '/buyer', label: 'Overview', icon: LayoutDashboard },
  { to: '/find-materials', label: 'Find Materials', icon: Search },
  { to: '/requirements', label: 'My Requirements', icon: FileSearch },
  { to: '/matches', label: 'Supplier Matches', icon: Handshake },
  { to: '/discovery', label: 'Business Discovery', icon: BarChart3 },
  { to: '/enquiries', label: 'RFQs', icon: Leaf },
  { to: '/negotiations', label: 'Offers & Negotiation', icon: ShoppingBag },
  { to: '/orders', label: 'Orders & Tracking', icon: Truck },
  { to: '/profile', label: 'Profile & Plan', icon: Settings2 },
]

const adminNav = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/listings', label: 'All Listings', icon: Boxes },
  { to: '/requirements', label: 'All Requirements', icon: FileSearch },
  { to: '/orders', label: 'All Orders', icon: PackageSearch },
  { to: '/discovery', label: 'Discovery Results', icon: BarChart3 },
]

const pageTitles: Record<string, string> = {
  '/seller': 'Seller Dashboard', '/buyer': 'Buyer Dashboard', '/admin': 'Admin / Demo Dashboard',
  '/listings': 'My Listings', '/find-buyers': 'Find Buyers', '/find-materials': 'Find Materials',
  '/analysis': 'AI Material Analysis', '/discovery': 'Business Discovery', '/matches': 'Matches',
  '/enquiries': 'Enquiries & RFQs', '/negotiations': 'Offers & Negotiation', '/orders': 'Orders & Payments',
  '/requirements': 'My Requirements', '/profile': 'Business Profile & Plan', '/knowledge': 'Knowledge Hub',
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useApp()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const role = user?.role || 'buyer'
  const links = role === 'seller' ? sellerNav : role === 'buyer_seller' ? [...sellerNav.slice(0, 3), ...buyerNav.slice(1)] : role === 'admin' ? adminNav : buyerNav
  const pageTitle = pageTitles[location.pathname]
    || (location.pathname.startsWith('/orders/') ? 'Order details'
      : location.pathname.startsWith('/negotiations/') ? 'Negotiation thread' : 'Workspace')

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-sand-50 lg:flex">
      {open && <div className="fixed inset-0 z-30 bg-ink-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900 text-slate-300 shadow-lifted transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-800 px-5">
          <Logo light onNavigate={() => setOpen(false)} />
          <button onClick={() => setOpen(false)} className="text-slate-400 lg:hidden" aria-label="Close sidebar"><X size={20} /></button>
        </div>
        <div className="px-4 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow-inset">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-600 text-white"><CircleUserRound size={18} /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.full_name || 'Demo visitor'}</p>
                <p className="text-[11px] text-slate-400">{user ? titleCase(user.role) : 'Not signed in'}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <Badge tone="green" className="border-forest-700 bg-forest-900/40 text-forest-300">{user?.subscription_tier === 'premium' ? 'Premium' : 'Free trial'}</Badge>
              <Badge tone="gray" className="border-ink-700 bg-ink-800 text-slate-300">Demo mode</Badge>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Workspace</p>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/seller' || to === '/buyer' || to === '/admin'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200',
                  isActive ? 'bg-forest-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <span className="flex items-center gap-2.5"><Icon size={17} /> {label}</span>
              <ChevronRight size={14} className="opacity-50" />
            </NavLink>
          ))}
          <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">General</p>
          <NavLink to="/knowledge" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <Leaf size={17} /> Knowledge Hub
          </NavLink>
          <NavLink to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <ShieldCheck size={17} /> Admin / Demo
          </NavLink>
          <NavLink to="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <LayoutDashboard size={17} /> Public Website
          </NavLink>
        </nav>
        <div className="border-t border-ink-800 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <LogOut size={17} /> Log out
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-900 lg:hidden" aria-label="Open sidebar"><Menu size={20} /></button>
            <div>
              <p className="eyebrow">ReSource AI workspace</p>
              <h1 className="text-base font-bold sm:text-lg">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === 'seller' ? (
              <Link to="/find-buyers" className="btn-secondary btn-sm hidden sm:inline-flex"><Search size={15} /> Find buyers</Link>
            ) : (
              <Link to="/find-materials" className="btn-secondary btn-sm hidden sm:inline-flex"><Search size={15} /> Quick search</Link>
            )}
            <Badge tone="purple" className="hidden sm:inline-flex">Demo environment</Badge>
            {user && (
              <button onClick={() => navigate('/profile')} aria-label="Open profile" className="grid h-9 w-9 place-items-center rounded-full bg-forest-100 text-sm font-bold text-forest-800 ring-2 ring-forest-100 transition hover:bg-forest-200">
                {user.full_name.charAt(0)}
              </button>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 py-6 animate-fade-in sm:px-6 sm:py-8">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-900">
            Prototype workspace: all records, prices, payment references and shipment updates are demo data. No money moves and no real goods are tracked.
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
