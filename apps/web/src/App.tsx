import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Metadata from './pages/Metadata'
import Quality from './pages/Quality'
import RemoveBg from './pages/RemoveBg'
import Upscale from './pages/Upscale'
import Converters from './pages/Converters'
import History from './pages/History'
import Subscription from './pages/Subscription'
import Settings from './pages/Settings'
import { getAuthSession } from './lib/session'
import type { JSX } from 'react'

function RequireAuth({ children }: { children: JSX.Element }) {
  return getAuthSession() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="metadata" element={<Metadata />} />
          <Route path="quality" element={<Quality />} />
          <Route path="remove-bg" element={<RemoveBg />} />
          <Route path="upscale" element={<Upscale />} />
          <Route path="converters" element={<Converters />} />
          <Route path="history" element={<History />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
