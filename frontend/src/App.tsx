import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Shell from '@/components/layout/Shell'
import Dashboard from '@/pages/Dashboard'
import Pipeline from '@/pages/Pipeline'
import Expiry from '@/pages/Expiry'
import Approvals from '@/pages/Approvals'
import BusinessUnits from '@/pages/BusinessUnits'
import Regions from '@/pages/Regions'
import Opportunities from '@/pages/Opportunities'
import History from '@/pages/History'
import AIAssistant from '@/pages/AIAssistant'
import ExecutiveView from '@/pages/ExecutiveView'
import Upload from '@/pages/Upload'
import LoadingScreen from '@/pages/LoadingScreen'
import DesignSystem from '@/pages/DesignSystem'
import Insights from '@/pages/Insights'
import { useAppStore } from '@/store/appStore'

export default function App() {
  const darkMode = useAppStore(s => s.darkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          },
        }}
      />
      <Routes>
        <Route path="/loading" element={<LoadingScreen />} />
        <Route path="/executive" element={<ExecutiveView />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expiry" element={<Expiry />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/business-units" element={<BusinessUnits />} />
          <Route path="/bu" element={<BusinessUnits />} />
          <Route path="/regions" element={<Regions />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/explore" element={<Opportunities />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/history" element={<History />} />
          <Route path="/assistant" element={<AIAssistant />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/design" element={<DesignSystem />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}


