import { useEffect, type ReactElement } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PublicLayout } from './components/layout'
import { EmptyState } from './components/ui'
import { dashboardPath } from './lib/navigation'
import { canBuy, canSell } from './lib/permissions'
import type { Role } from './lib/types'
import { useApp } from './state/AppContext'
import Home from './pages/Home'
import Auth from './pages/Auth'
import FindBuyers from './pages/FindBuyers'
import FindMaterials from './pages/FindMaterials'
import Knowledge from './pages/Knowledge'
import SellerDashboard from './pages/SellerDashboard'
import BuyerDashboard from './pages/BuyerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Listings from './pages/Listings'
import Requirements from './pages/Requirements'
import Analysis from './pages/Analysis'
import Discovery from './pages/Discovery'
import Matches from './pages/Matches'
import Enquiries from './pages/Enquiries'
import Negotiations from './pages/Negotiations'
import Orders from './pages/Orders'
import Profile from './pages/Profile'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <PublicLayout>
      <div className="container-page py-16">
        <EmptyState
          icon={<ArrowLeft size={22} />}
          title="404 · This page is not in the circular loop"
          description="The link may be incorrect or the page may have moved. Return to the homepage to explore the marketplace."
          action={<Link to="/" className="btn-primary"><ArrowLeft size={15} /> Back to homepage</Link>}
        />
      </div>
    </PublicLayout>
  )
}

function RoleGuard({ allow, children }: { allow: (role?: Role | null) => boolean; children: ReactElement }) {
  const { user } = useApp()
  if (user && !allow(user.role)) {
    return <Navigate to={dashboardPath(user.role)} replace />
  }
  return children
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/find-buyers" element={<RoleGuard allow={canSell}><FindBuyers /></RoleGuard>} />
        <Route path="/find-materials" element={<RoleGuard allow={canBuy}><FindMaterials /></RoleGuard>} />
        <Route path="/knowledge" element={<Knowledge />} />

        <Route path="/seller" element={<RoleGuard allow={canSell}><SellerDashboard /></RoleGuard>} />
        <Route path="/buyer" element={<RoleGuard allow={canBuy}><BuyerDashboard /></RoleGuard>} />
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="/listings" element={<RoleGuard allow={canSell}><Listings /></RoleGuard>} />
        <Route path="/requirements" element={<RoleGuard allow={canBuy}><Requirements /></RoleGuard>} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/discovery" element={<Discovery />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/enquiries" element={<Enquiries />} />
        <Route path="/negotiations" element={<Negotiations />} />
        <Route path="/negotiations/:negotiationId" element={<Negotiations />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:orderId" element={<Orders />} />
        <Route path="/profile" element={<Profile />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
