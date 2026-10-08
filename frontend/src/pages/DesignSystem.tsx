import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sun,
  Moon,
  DollarSign,
  TrendingUp,
  Percent,
  Search,
  Download,
  Filter,
  Layers,
  Sparkles,
  Info,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import Card from '@/components/ui/Card'
import KpiTile from '@/components/ui/KpiTile'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Badge from '@/components/ui/Badge'
import DataTable, { Column } from '@/components/ui/DataTable'
import Drawer from '@/components/ui/Drawer'
import Skeleton, { SkeletonCard, SkeletonChart } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import InsightCaption from '@/components/ui/InsightCaption'
import { showToast } from '@/components/ui/Toast'

export default function DesignSystem() {
  const { darkMode, toggleDarkMode, setCommandPaletteOpen } = useAppStore()

  // State for interactive controls
  const [activeTab, setActiveTab] = useState<'kpi' | 'table' | 'visuals'>('kpi')
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'lastweek'>('today')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sample table data
  interface SampleRow {
    id: string
    name: string
    account: string
    acv: number
    category: string
    status: string
    quarter: string
  }

  const sampleData: SampleRow[] = [
    {
      id: 'OPP-1001',
      name: 'Global Roaming Optimization 2026',
      account: 'Vodafone Enterprise',
      acv: 4850000,
      category: 'Commit',
      status: 'Approved',
      quarter: 'Q1-2026',
    },
    {
      id: 'OPP-1002',
      name: 'Network Analytics & Fraud Engine',
      account: 'Telefonica Group',
      acv: 2940000,
      category: 'Closed',
      status: 'Approved - 2nd',
      quarter: 'Q2-2026',
    },
    {
      id: 'OPP-1003',
      name: 'Security Shield Telecom Multi-Tenant',
      account: 'Etisalat UAE',
      acv: 1820000,
      category: 'Best Case',
      status: 'Pending Approval',
      quarter: 'Q4-2026',
    },
    {
      id: 'OPP-1004',
      name: 'IoT Roaming Billing Integration',
      account: 'Singtel Singapore',
      acv: 950000,
      category: 'Pipeline',
      status: 'Blank',
      quarter: 'Q3-2026',
    },
    {
      id: 'OPP-1005',
      name: 'Test Factory Automation Suite',
      account: 'Claro Brasil',
      acv: 420000,
      category: 'Commit',
      status: 'Rejected',
      quarter: 'Q1-2027',
    },
  ]

  const columns: Column<SampleRow>[] = [
    {
      key: 'id',
      label: 'Opp ID',
      width: '120px',
      colorAccent: '#00A3AD',
      render: (val) => <span className="font-mono text-xs text-teal-600 dark:text-teal-400">{val}</span>,
    },
    {
      key: 'name',
      label: 'Opportunity Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-semibold text-xs text-[var(--text-primary)]">{val}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{row.account}</div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Forecast',
      sortable: true,
      render: (val) => <Badge label={val} variant="forecast" dot />,
    },
    {
      key: 'status',
      label: 'Approval',
      sortable: true,
      render: (val) => <Badge label={val} variant="approval" />,
    },
    {
      key: 'quarter',
      label: 'Expiry',
      align: 'center',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-medium">
          {val}
        </span>
      ),
    },
    {
      key: 'acv',
      label: 'Forecast ACV',
      align: 'right',
      sortable: true,
      colorAccent: '#8080FF',
      render: (val) => (
        <span className="font-bold text-[var(--text-primary)]">
          ${(val / 1e6).toFixed(2)}M
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-12 max-w-7xl mx-auto pb-16">
      {/* ── Page Header & Theme Toggle Banner ──────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#12284C] via-[#1A3A6B] to-[#0A2A4A] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Living Component Library
            </span>
            <span className="text-xs text-slate-400">• Mobileum Design System 2.0</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-white">
            Design Tokens & UI Showcase
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            A distinctive enterprise visual language featuring brand Navy (#12284C), Teal (#00A3AD), Violet (#8080FF), Plus Jakarta Sans typography, and tabular numerals.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md bg-white/10 hover:bg-white/20 border border-white/20 text-white"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-300" />}
            <span>{darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}</span>
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* ── Section 1: Color Tokens & Brand Gradients ────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            1. Brand Colors & Gradients
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Single Source of Truth (tokens.ts)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#12284C] text-white shadow-sm border border-slate-700">
            <div className="h-10 rounded-lg bg-[#12284C] border border-white/20 mb-2" />
            <p className="text-xs font-bold">Brand Navy</p>
            <p className="text-[10px] text-slate-300 font-mono">#12284C</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#00A3AD] text-white shadow-sm">
            <div className="h-10 rounded-lg bg-[#00A3AD] border border-white/20 mb-2" />
            <p className="text-xs font-bold">Brand Teal</p>
            <p className="text-[10px] text-teal-100 font-mono">#00A3AD</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#8080FF] text-white shadow-sm">
            <div className="h-10 rounded-lg bg-[#8080FF] border border-white/20 mb-2" />
            <p className="text-xs font-bold">Brand Violet</p>
            <p className="text-[10px] text-indigo-100 font-mono">#8080FF</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#00D2DF] text-slate-900 shadow-sm">
            <div className="h-10 rounded-lg bg-[#00D2DF] border border-black/10 mb-2" />
            <p className="text-xs font-bold">Cyan Accent</p>
            <p className="text-[10px] text-slate-800 font-mono">#00D2DF</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#10B981] text-white shadow-sm">
            <div className="h-10 rounded-lg bg-[#10B981] border border-white/20 mb-2" />
            <p className="text-xs font-bold">Success Green</p>
            <p className="text-[10px] text-emerald-100 font-mono">#10B981</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F59E0B] text-white shadow-sm">
            <div className="h-10 rounded-lg bg-[#F59E0B] border border-white/20 mb-2" />
            <p className="text-xs font-bold">Warning Amber</p>
            <p className="text-[10px] text-amber-100 font-mono">#F59E0B</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl border border-[var(--border)] text-white shadow-sm relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0052CC 0%, #00A3AD 50%, #00D2DF 100%)' }}>
            <p className="text-xs font-bold">Logo Gradient</p>
            <p className="text-[10px] opacity-80 font-mono">#0052CC → #00A3AD → #00D2DF</p>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] text-white shadow-sm relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #00A3AD 0%, #8080FF 100%)' }}>
            <p className="text-xs font-bold">Teal-to-Violet Accent</p>
            <p className="text-[10px] opacity-80 font-mono">#00A3AD → #8080FF</p>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] text-white shadow-sm relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #12284C 0%, #00A3AD 60%, #8080FF 100%)' }}>
            <p className="text-xs font-bold">Brand Tri-Color</p>
            <p className="text-[10px] opacity-80 font-mono">#12284C → #00A3AD → #8080FF</p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Card Variants ──────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            2. Card Component Variants
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Subtle glass, gradient, soft elevation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Default Card</span>
              <span className="text-xs text-[var(--text-muted)]">Elevated</span>
            </div>
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">Solid Surface</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Standard content container with 16px radius, subtle border, and soft layered shadow.
            </p>
          </Card>

          <Card variant="glass">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-violet-500 uppercase tracking-wider">Glass Card</span>
              <span className="text-xs text-[var(--text-muted)]">Backdrop Blur</span>
            </div>
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">Frosted Glass</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              14px backdrop filter blur with translucent surface for overlays and modern panels.
            </p>
          </Card>

          <Card variant="gradient">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Gradient Card</span>
              <span className="text-xs text-[var(--text-muted)]">Subtle Wash</span>
            </div>
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">Card Gradient</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Soft diagonal shift between card and secondary surface to draw focus gracefully.
            </p>
          </Card>

          <Card variant="subtle" hover={false}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtle Card</span>
              <span className="text-xs text-[var(--text-muted)]">Flat Inset</span>
            </div>
            <h3 className="font-display font-bold text-base text-[var(--text-primary)]">Bordered Inset</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Flat muted container without hover motion, ideal for secondary groupings.
            </p>
          </Card>
        </div>
      </section>

      {/* ── Section 3: KPI Tiles ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            3. KPI Tiles with Count-Up, Delta Chips & Sparklines
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Tabular Numerals + Green Up / Orange Down</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile
            label="Total Pipeline ACV"
            value={120511647.51}
            format="acv"
            delta={1038157.57}
            deltaLabel="vs yesterday"
            accent="#00A3AD"
            icon={<DollarSign className="w-4 h-4" />}
            caption="Scoped to Expiry Q3 Summary pivot"
            sparklineData={[115, 117, 116, 119, 119.5, 120.5]}
          />

          <KpiTile
            label="Total Opportunities"
            value={1167}
            format="count"
            delta={5}
            deltaLabel="vs yesterday"
            accent="#8080FF"
            icon={<TrendingUp className="w-4 h-4" />}
            caption="8 canonical quarters scope"
            sparklineData={[1140, 1150, 1155, 1162, 1165, 1167]}
          />

          <KpiTile
            label="Negative Delta Example"
            value={18132885.71}
            format="acv"
            delta={-542295.23}
            deltaLabel="vs last week"
            accent="#F59E0B"
            icon={<AlertTriangle className="w-4 h-4" />}
            caption="Demonstrates orange down chip for decrease"
            sparklineData={[18.6, 18.5, 18.4, 18.2, 18.15, 18.13]}
          />

          <KpiTile
            label="Commit Rate"
            value={74.2}
            format="pct"
            delta={2.1}
            deltaLabel="vs last week"
            accent="#10B981"
            icon={<Percent className="w-4 h-4" />}
            caption="High confidence renewal percentage"
            sparklineData={[70, 71.5, 72, 73.1, 73.8, 74.2]}
          />
        </div>
      </section>

      {/* ── Section 4: SegmentedControl & Badges ──────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            4. Segmented Control & Status Badges
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Animated layout pill slider</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Segmented Controls (Size & State)
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">View Switcher (Medium):</p>
                <SegmentedControl
                  value={activeTab}
                  onChange={setActiveTab}
                  options={[
                    { value: 'kpi', label: 'Overview', icon: <Layers className="w-3.5 h-3.5" />, badge: 4 },
                    { value: 'table', label: 'Table View', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, badge: 'New' },
                    { value: 'visuals', label: 'Charts & Flow', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                  ]}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Period Selector (Small):</p>
                <SegmentedControl
                  size="sm"
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: 'today', label: 'Today (Oct 5)' },
                    { value: 'yesterday', label: 'Yesterday (Oct 4)' },
                    { value: 'lastweek', label: 'Last Week (Sep 28)' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Badges (Forecast & Approval Statuses)
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1.5 font-medium">Forecast Categories:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge label="Closed" variant="forecast" dot />
                  <Badge label="Commit" variant="forecast" dot />
                  <Badge label="Best Case" variant="forecast" dot />
                  <Badge label="Pipeline" variant="forecast" dot />
                  <Badge label="Blank" variant="forecast" dot />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-[var(--text-secondary)] mb-1.5 font-medium">Approval Statuses:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge label="Approved" variant="approval" />
                  <Badge label="Approved - 2nd" variant="approval" />
                  <Badge label="Pending Approval" variant="approval" />
                  <Badge label="Rejected" variant="approval" />
                  <Badge label="Blank" variant="approval" />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-[var(--text-secondary)] mb-1.5 font-medium">Semantic Variants:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge label="Brand Navy" variant="brand" />
                  <Badge label="Brand Teal" variant="teal" />
                  <Badge label="Brand Violet" variant="violet" />
                  <Badge label="Success" variant="success" dot />
                  <Badge label="Warning" variant="warning" dot />
                  <Badge label="Danger" variant="danger" dot />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Section 5: DataTable ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            5. DataTable Component
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Sticky Header • Sortable • Sticky First Col • Column Color Accents
          </span>
        </div>

        <DataTable
          columns={columns}
          data={sampleData}
          onRowClick={(row) => showToast.info(`Selected: ${row.id}`, row.name)}
        />
      </section>

      {/* ── Section 6: Interactive Drawer, CommandPalette, Toasts ─────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            6. Drawer, Command Palette & Toast Notifications
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Framer Motion Slide & Dialogs</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">Slide-out Drawer</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Side panel with backdrop blur, smooth spring motion, and ESC key listener.
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-600 text-white transition-all shadow-sm"
            >
              Open Opportunity Drawer
            </button>
          </Card>

          <Card>
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">Command Palette (Ctrl+K)</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Global command bar for quick navigation, page search, and theme switching.
            </p>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-all shadow-sm flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-teal-500" />
              <span>Open Palette</span>
              <kbd className="px-1 py-0.5 rounded text-[10px] bg-[var(--bg-card)] border border-[var(--border)] font-mono">
                ⌘K
              </kbd>
            </button>
          </Card>

          <Card>
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">Toast Notifications</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Branded toasts with icons and sound visual feedback.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => showToast.success('Snapshot Loaded', 'Oct 5 reference data active')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => showToast.warning('Expiry Risk', '3 opportunities expire in Q2-2026')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                Warning
              </button>
              <button
                type="button"
                onClick={() => showToast.error('Upload Error', 'Required column missing')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                Error
              </button>
              <button
                type="button"
                onClick={() => showToast.info('AI Summary', 'Pipeline grew by $1.04M today')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
              >
                Info
              </button>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Section 7: InsightCaptions, EmptyState & Skeletons ─────────── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border)] pb-2 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--text-primary)]">
            7. InsightCaptions, Empty States & Skeletons
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Contextual feedback components</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Insight Captions (AI & Analytics)
            </h3>
            <InsightCaption
              type="ai"
              title="Pipeline Expansion"
              text="Today's total ACV grew by +$1,038,157.57 vs yesterday with 5 net new opportunities entering the commit category."
            />
            <InsightCaption
              type="trend"
              title="Q2-2027 Movement"
              text="One opportunity moved from Best Case to Commit in Q2-2027, reducing Best Case by -$542,295.23 while maintaining count stability."
            />
            <InsightCaption
              type="warning"
              title="Pending Approval Action"
              text="31 opportunities ($14.2M ACV) currently await 2nd level approval prior to month-end close."
            />
            <InsightCaption
              type="success"
              title="Target Quota Progress"
              text="Q3 Commit ACV has reached 102% of quarterly benchmark targets."
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Empty State Component
            </h3>
            <EmptyState
              title="No Opportunities Match Current Filters"
              description="Try adjusting your forecast category, sub-region, or search query to see available renewal contracts."
              action={{
                label: 'Reset All Filters',
                onClick: () => showToast.info('Filters Reset', 'Showing all opportunities'),
              }}
            />
          </div>
        </div>

        <div className="pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Shimmer Skeletons
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />
            <div className="card-premium p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Opportunity Drawer Instance ───────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Vodafone Enterprise — OPP-1001"
        subtitle="Global Roaming Optimization 2026"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                showToast.success('Saved', 'Opportunity flagged for executive review')
                setDrawerOpen(false)
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-colors"
            >
              Flag for Review
            </button>
          </div>
        }
      >
        <div className="space-y-5 text-sm">
          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold uppercase tracking-wider">
              Contract Value
            </span>
            <div className="font-display font-extrabold text-2xl text-[var(--text-primary)] mt-1 tabular-nums">
              $4,850,000.00
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Weighted Booking: $4,365,000.00 (90%)</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Opportunity Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Forecast Category:</span>
                <div className="mt-1">
                  <Badge label="Commit" variant="forecast" dot />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Approval Status:</span>
                <div className="mt-1">
                  <Badge label="Approved" variant="approval" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Service Expiry:</span>
                <div className="font-semibold text-[var(--text-primary)] mt-1">Q1-2026</div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]">
                <span className="text-[var(--text-muted)]">Business Unit:</span>
                <div className="font-semibold text-[var(--text-primary)] mt-1">Roaming Analytics</div>
              </div>
            </div>
          </div>

          <InsightCaption
            type="ai"
            title="Executive Note"
            text="High probability contract scheduled to close before Q1 expiration. Technical Account Manager assigned."
          />
        </div>
      </Drawer>
    </div>
  )
}
