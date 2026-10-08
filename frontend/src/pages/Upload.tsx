import React, { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  Info,
  Calendar,
  ShieldCheck,
  RefreshCw,
  FileCheck2,
} from 'lucide-react'
import { validateUpload, commitUpload, getUploadHistory } from '@/api/client'
import { formatCurrency, formatNumber, formatDate } from '@/utils/format'
import { showToast } from '@/components/ui/Toast'

type FileSlot = 'comparison_tool' | 'fiscal_2026' | 'fiscal_2027' | 'fiscal_q4'

interface UploadSlotState {
  file: File | null
  name: string
  size: number
}

// Format a Date using LOCAL calendar fields. (toISOString() converts to UTC, which shifts
// the date back by one day in time zones ahead of UTC such as India.)
function formatLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function getAutoYesterdayDate(asOfStr: string): string {
  if (!asOfStr) return ''
  const d = new Date(asOfStr + 'T00:00:00')
  const day = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  let daysBack = 1
  if (day === 1) {
    daysBack = 3 // Monday -> Friday
  } else if (day === 0) {
    daysBack = 2 // Sunday -> Friday
  } else if (day === 6) {
    daysBack = 1 // Saturday -> Friday
  }
  const y = new Date(d)
  y.setDate(d.getDate() - daysBack)
  return formatLocalDate(y)
}

export default function Upload() {
  const qc = useQueryClient()

  // Dates
  const [dataAsOf, setDataAsOf] = useState(formatLocalDate(new Date()))
  const [yesterdayDate, setYesterdayDate] = useState(getAutoYesterdayDate(formatLocalDate(new Date())))
  const [manualYesterdayEdited, setManualYesterdayEdited] = useState(false)

  // 4 Slots
  const [slots, setSlots] = useState<Record<FileSlot, UploadSlotState>>({
    comparison_tool: { file: null, name: '', size: 0 },
    fiscal_2026: { file: null, name: '', size: 0 },
    fiscal_2027: { file: null, name: '', size: 0 },
    fiscal_q4: { file: null, name: '', size: 0 },
  })

  // Validation / Preview state
  const [isValidating, setIsValidating] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [isCommitting, setIsCommitting] = useState(false)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)

  // Auto-fill yesterday date when dataAsOf changes (unless user manually modified)
  useEffect(() => {
    if (!manualYesterdayEdited) {
      setYesterdayDate(getAutoYesterdayDate(dataAsOf))
    }
  }, [dataAsOf, manualYesterdayEdited])

  // Weekend warning
  const asOfDateObj = new Date(dataAsOf + 'T00:00:00')
  const isWeekend = asOfDateObj.getDay() === 0 || asOfDateObj.getDay() === 6
  const isMonday = asOfDateObj.getDay() === 1

  // Last 10 uploads query
  const { data: uploadHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['uploadHistory'],
    queryFn: getUploadHistory,
  })

  // Content / Name based auto-assignment for multi-file drop
  const assignFileToSlot = (file: File) => {
    const fn = file.name.toLowerCase()
    let targetSlot: FileSlot = 'comparison_tool'

    if (fn.includes('comparison')) {
      targetSlot = 'comparison_tool'
    } else if (fn.includes('q4') || fn.includes('fiscal q4')) {
      targetSlot = 'fiscal_q4'
    } else if (fn.includes('2027') || fn.includes('fiscal 2027')) {
      targetSlot = 'fiscal_2027'
    } else if (fn.includes('2026') || fn.includes('fiscal 2026')) {
      targetSlot = 'fiscal_2026'
    }

    setSlots((prev) => ({
      ...prev,
      [targetSlot]: { file, name: file.name, size: file.size },
    }))
  }

  // Multi-dropzone for entire batch
  const { getRootProps: getBatchRootProps, getInputProps: getBatchInputProps, isDragActive: isBatchDragActive } =
    useDropzone({
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      onDrop: (acceptedFiles) => {
        acceptedFiles.forEach((f) => assignFileToSlot(f))
        setPreviewData(null)
      },
    })

  // Handle single slot drop
  const handleSlotDrop = (slot: FileSlot, file: File) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: { file, name: file.name, size: file.size },
    }))
    setPreviewData(null)
  }

  const handleClearSlot = (slot: FileSlot) => {
    setSlots((prev) => ({
      ...prev,
      [slot]: { file: null, name: '', size: 0 },
    }))
    setPreviewData(null)
  }

  // Validation Call
  const handleValidate = async () => {
    if (!slots.comparison_tool.file) {
      showToast.error('Validation error', 'Renewal Comparison Tool is required.')
      return
    }

    setIsValidating(true)
    setPreviewData(null)

    try {
      const formData = new FormData()
      formData.append('data_as_of_date', dataAsOf)
      formData.append('yesterday_date', yesterdayDate)
      formData.append('comparison_tool', slots.comparison_tool.file)

      if (slots.fiscal_2026.file) {
        formData.append('fiscal_2026', slots.fiscal_2026.file)
      }
      if (slots.fiscal_2027.file) {
        formData.append('fiscal_2027', slots.fiscal_2027.file)
      }
      if (slots.fiscal_q4.file) {
        formData.append('fiscal_q4', slots.fiscal_q4.file)
      }

      const res = await validateUpload(formData)
      setPreviewData(res)

      if (res.can_commit) {
        showToast.success('Validation complete', 'Files parsed cleanly. Review the preview below.')
      } else {
        showToast.error('Validation failed', 'One or more blocking errors were found.')
      }
    } catch (err: any) {
      showToast.error('Validation error', err?.response?.data?.detail || err.message)
    } finally {
      setIsValidating(false)
    }
  }

  // Commit Call
  const handleCommit = async (replace = false) => {
    if (!previewData?.session_id) return
    setIsCommitting(true)
    try {
      const res = await commitUpload(previewData.session_id, replace)
      showToast.success('Snapshot committed', `Saved ${res.row_count} total (${res.active_row_count} active) opportunities.`)
      setReplaceConfirmOpen(false)
      setPreviewData(null)
      // Reset slots
      setSlots({
        comparison_tool: { file: null, name: '', size: 0 },
        fiscal_2026: { file: null, name: '', size: 0 },
        fiscal_2027: { file: null, name: '', size: 0 },
        fiscal_q4: { file: null, name: '', size: 0 },
      })
      qc.invalidateQueries()
      refetchHistory()
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.response?.data?.detail?.includes('replace=True')) {
        setReplaceConfirmOpen(true)
      } else {
        showToast.error('Commit failed', err?.response?.data?.detail || err.message)
      }
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <UploadIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Daily 4-File Upload & Ingestion
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Multi-scope ingestion pipeline with atomic commit, pre-validation preview, and duplicate detection.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Date Configuration Strip */}
      <div className="card p-5 border border-[var(--border)] shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-500" />
          Snapshot Dates & Previous Working Day Configuration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Data as of Date</label>
            <input
              type="date"
              value={dataAsOf}
              onChange={(e) => {
                setDataAsOf(e.target.value)
                setManualYesterdayEdited(false)
              }}
              className="mt-1.5 w-full px-3 py-2 rounded-xl text-sm border outline-none bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] focus:ring-2 focus:ring-teal-500"
              id="upload-data-as-of"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Yesterday Date (Prev Working Day)</label>
              {manualYesterdayEdited && (
                <button
                  type="button"
                  onClick={() => {
                    setManualYesterdayEdited(false)
                    setYesterdayDate(getAutoYesterdayDate(dataAsOf))
                  }}
                  className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Reset Auto
                </button>
              )}
            </div>
            <input
              type="date"
              value={yesterdayDate}
              onChange={(e) => {
                setYesterdayDate(e.target.value)
                setManualYesterdayEdited(true)
              }}
              className="mt-1.5 w-full px-3 py-2 rounded-xl text-sm border outline-none bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] focus:ring-2 focus:ring-teal-500"
              id="upload-yesterday-date"
            />
          </div>

          <div className="text-xs text-[var(--text-muted)] p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            {isMonday && (
              <span className="font-semibold text-teal-600 dark:text-teal-400 block mb-0.5">
                ⚡ Monday rule: auto-set to Friday 3 days earlier
              </span>
            )}
            {isWeekend && (
              <span className="font-semibold text-amber-500 block mb-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Weekend date selected (warning will be flagged)
              </span>
            )}
            {!isMonday && !isWeekend && (
              <span>Previous calendar business day auto-computed. Editable for public holidays.</span>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Drop Zone Banner */}
      <div
        {...getBatchRootProps()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isBatchDragActive
            ? 'border-teal-500 bg-teal-500/5 scale-[1.01]'
            : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-teal-400 hover:bg-[var(--bg-secondary)]/50'
        }`}
      >
        <input {...getBatchInputProps()} id="upload-batch-input" />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <UploadIcon className="w-6 h-6" />
          </div>
          <p className="font-bold text-sm text-[var(--text-primary)]">
            Drag & drop all 4 Excel files here at once
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-md">
            Our content signature detection automatically classifies each file into its matching scope slot (Fiscal Q4, Fiscal 2027, Fiscal 2026, or Comparison Tool).
          </p>
        </div>
      </div>

      {/* 4 Dedicated File Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Slot 1: Comparison Tool */}
        <SlotCard
          title="Comparison Tool"
          subtitle="Mandatory · All sales types"
          expected="today & yesterday sheets"
          required
          state={slots.comparison_tool}
          onDrop={(f) => handleSlotDrop('comparison_tool', f)}
          onClear={() => handleClearSlot('comparison_tool')}
          badgeColor="teal"
          id="slot-comparison-tool"
        />

        {/* Slot 2: Fiscal 2026 */}
        <SlotCard
          title="Fiscal 2026 Summary"
          subtitle="Optional · Renewals only"
          expected="Today_Data, Yesterday, Lastweek"
          state={slots.fiscal_2026}
          onDrop={(f) => handleSlotDrop('fiscal_2026', f)}
          onClear={() => handleClearSlot('fiscal_2026')}
          badgeColor="blue"
          id="slot-fiscal-2026"
        />

        {/* Slot 3: Fiscal 2027 */}
        <SlotCard
          title="Fiscal 2027 Summary"
          subtitle="Optional · Renewals only"
          expected="Closing Year = 2027"
          state={slots.fiscal_2027}
          onDrop={(f) => handleSlotDrop('fiscal_2027', f)}
          onClear={() => handleClearSlot('fiscal_2027')}
          badgeColor="purple"
          id="slot-fiscal-2027"
        />

        {/* Slot 4: Fiscal Q4 */}
        <SlotCard
          title="Fiscal Q4 Summary"
          subtitle="Optional · Renewals only"
          expected="Fiscal Period = Q4-2026"
          state={slots.fiscal_q4}
          onDrop={(f) => handleSlotDrop('fiscal_q4', f)}
          onClear={() => handleClearSlot('fiscal_q4')}
          badgeColor="amber"
          id="slot-fiscal-q4"
        />
      </div>

      {/* Validate & Preview Action Button */}
      <div className="flex items-center justify-between card p-4 border border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Info className="w-4 h-4 text-teal-500 flex-shrink-0" />
          <span>
            Validation reads and verifies all sheets without writing to the database. You will see active vs raw rows and reconciliation reports before confirming.
          </span>
        </div>
        <button
          type="button"
          onClick={handleValidate}
          disabled={!slots.comparison_tool.file || isValidating || isCommitting}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0 transition-all"
          id="validate-preview-btn"
        >
          {isValidating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Validating Files...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Validate & Preview
            </>
          )}
        </button>
      </div>

      {/* Preview Section */}
      <AnimatePresence>
        {previewData && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card p-6 border-2 border-teal-500/30 space-y-6 bg-[var(--bg-card)] shadow-lg"
            id="upload-preview-container"
          >
            {/* Preview Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-teal-500" />
                  Pre-Commit Validation Preview
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Comparison against previous snapshot ({previewData.previous_snapshot?.snapshot_date ?? 'Baseline'}), excluding Deleted &amp; Lost by default.
                </p>
              </div>

              {/* Commit button — only enabled when preview loaded successfully with no blocking errors */}
              <button
                type="button"
                onClick={() => handleCommit(false)}
                disabled={
                  isCommitting ||
                  !previewData.can_commit ||
                  (previewData.errors && previewData.errors.length > 0)
                }
                title={
                  !previewData.can_commit
                    ? 'Cannot commit: validation errors present. Fix errors and re-validate.'
                    : 'Confirm and save this snapshot to the database'
                }
                className="px-6 py-2.5 rounded-xl font-black text-xs shadow-md flex items-center gap-2 transition-all
                  bg-emerald-600 hover:bg-emerald-700 text-white
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-500"
                id="confirm-commit-btn"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Committing Transaction...
                  </>
                ) : !previewData.can_commit ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    Blocked — Fix Errors First
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Confirm &amp; Commit to Database
                  </>
                )}
              </button>
            </div>

            {/* Warnings & Reconciliation Alerts */}
            {previewData.warnings && previewData.warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1.5 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Reconciliation & Advisory Notices:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  {previewData.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errors */}
            {previewData.errors && previewData.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 space-y-1.5 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Blocking Errors:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  {previewData.errors.map((e: string, idx: number) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scope Cards Matrix */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Scope Summary Matrix (Active vs Raw)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <ScopePreviewCard
                  title="Renewals (Default)"
                  scopeKey="renewals"
                  data={previewData.scopes?.renewals}
                  badge="Summary Union"
                  color="teal"
                />
                <ScopePreviewCard
                  title="All Opportunities"
                  scopeKey="all"
                  data={previewData.scopes?.all}
                  badge="Comparison Tool"
                  color="slate"
                />
                <ScopePreviewCard
                  title="Fiscal 2026"
                  scopeKey="fy2026"
                  data={previewData.scopes?.fy2026}
                  badge="Summary File"
                  color="blue"
                />
                <ScopePreviewCard
                  title="Fiscal 2027"
                  scopeKey="fy2027"
                  data={previewData.scopes?.fy2027}
                  badge="Summary File"
                  color="purple"
                />
                <ScopePreviewCard
                  title="Fiscal Q4"
                  scopeKey="q4_2026"
                  data={previewData.scopes?.q4_2026}
                  badge="Summary File"
                  color="amber"
                />
              </div>
            </div>

            {/* Delta vs Previous Snapshot Table */}
            {previewData.delta_vs_previous && (
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs">
                <div className="flex items-center justify-between font-bold text-[var(--text-primary)] mb-2">
                  <span>Delta vs Previous Snapshot ({previewData.previous_snapshot?.snapshot_date})</span>
                  <span className="text-[11px] font-normal text-[var(--text-muted)]">
                    Span: {previewData.delta_vs_previous.days_between} day(s) · Rate:{' '}
                    {formatCurrency(previewData.delta_vs_previous.active_daily_acv_rate)}/day
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Active ACV Delta</p>
                    <p
                      className={`font-black text-sm ${
                        previewData.delta_vs_previous.active_acv_delta >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {previewData.delta_vs_previous.active_acv_delta >= 0 ? '+' : ''}
                      {formatCurrency(previewData.delta_vs_previous.active_acv_delta)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Active Deals Delta</p>
                    <p
                      className={`font-black text-sm ${
                        previewData.delta_vs_previous.active_count_delta >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {previewData.delta_vs_previous.active_count_delta >= 0 ? '+' : ''}
                      {formatNumber(previewData.delta_vs_previous.active_count_delta)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Raw ACV Delta</p>
                    <p className="font-black text-sm text-[var(--text-primary)]">
                      {previewData.delta_vs_previous.raw_acv_delta >= 0 ? '+' : ''}
                      {formatCurrency(previewData.delta_vs_previous.raw_acv_delta)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Raw Deals Delta</p>
                    <p className="font-black text-sm text-[var(--text-primary)]">
                      {previewData.delta_vs_previous.raw_count_delta >= 0 ? '+' : ''}
                      {formatNumber(previewData.delta_vs_previous.raw_count_delta)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replace Confirmation Modal */}
      {replaceConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 border border-[var(--border)] shadow-2xl bg-[var(--bg-card)]">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="font-black text-base text-[var(--text-primary)]">Overwrite Existing Snapshot?</h4>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              A snapshot dated <span className="font-bold">{dataAsOf}</span> already exists in the database. Overwriting
              will replace existing opportunities and change logs for this date in a single atomic transaction.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReplaceConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCommit(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                Replace Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload History Table (Last 10 Uploads) */}
      <div className="card p-6 border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-base text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-500" />
              Recent Upload History
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Auditable log of snapshots and source file archives.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetchHistory()}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Refresh history"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] font-semibold border-b border-[var(--border)]">
              <tr>
                <th className="py-2.5 px-3">Snapshot Date</th>
                <th className="py-2.5 px-3">Yesterday Date</th>
                <th className="py-2.5 px-3">Active Deals</th>
                <th className="py-2.5 px-3">Raw Deals</th>
                <th className="py-2.5 px-3">Last Week Source</th>
                <th className="py-2.5 px-3">Uploaded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {uploadHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                    No historical snapshots recorded yet.
                  </td>
                </tr>
              ) : (
                uploadHistory.map((h: any) => (
                  <tr key={h.id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                      {h.snapshot_date}
                      {h.is_active_today && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold">
                          Active Today
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] font-medium">
                      {h.yesterday_date ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-teal-600 dark:text-teal-400">
                      {formatNumber(h.active_row_count ?? h.row_count)}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">
                      {formatNumber(h.row_count)}
                    </td>
                    <td className="py-2.5 px-3">
                      {h.last_week_source === 'real_snapshot' ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Stored Snapshot (-7d)
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          Summary Union (Partial)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">
                      {h.uploaded_at ? new Date(h.uploaded_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SlotCard({
  title,
  subtitle,
  expected,
  required = false,
  state,
  onDrop,
  onClear,
  badgeColor,
  id,
}: {
  title: string
  subtitle: string
  expected: string
  required?: boolean
  state: UploadSlotState
  onDrop: (file: File) => void
  onClear: () => void
  badgeColor: string
  id: string
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    onDrop: ([f]) => f && onDrop(f),
  })

  return (
    <div
      className={`card p-4 border rounded-2xl flex flex-col justify-between transition-all ${
        state.file
          ? 'border-teal-500/50 bg-teal-500/5'
          : isDragActive
          ? 'border-teal-400 bg-teal-500/10'
          : 'border-[var(--border)] hover:border-teal-400/50'
      }`}
      id={id}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              required
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
            }`}
          >
            {required ? 'Required' : 'Optional'}
          </span>
          {state.file && (
            <span className="text-emerald-500 text-xs flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
            </span>
          )}
        </div>

        <h4 className="font-extrabold text-xs text-[var(--text-primary)] leading-tight">{title}</h4>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        <p className="text-[10px] text-[var(--text-muted)] opacity-80 mt-1 italic font-mono">{expected}</p>
      </div>

      <div className="mt-4">
        {state.file ? (
          <div className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
            <div className="overflow-hidden pr-2">
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">{state.name}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{(state.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded-md hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-rose-500 transition-colors"
              title="Remove file"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className="p-3 border border-dashed rounded-xl border-[var(--border)] text-center cursor-pointer hover:border-teal-400 transition-all bg-[var(--bg-secondary)]/50"
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="w-5 h-5 mx-auto text-[var(--text-muted)] mb-1 opacity-70" />
            <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">Click or Drop</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScopePreviewCard({
  title,
  scopeKey,
  data,
  badge,
  color,
}: {
  title: string
  scopeKey: string
  data?: {
    raw_count: number
    raw_acv: number
    active_count: number
    active_acv: number
    deleted_lost_count: number
    available: boolean
  }
  badge: string
  color: string
}) {
  if (!data || !data.available) {
    return (
      <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] opacity-60">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{badge}</p>
        <h5 className="font-bold text-xs text-[var(--text-primary)]">{title}</h5>
        <p className="text-xs text-[var(--text-muted)] mt-2 italic">No summary file uploaded — scope not available</p>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col justify-between">
      <div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{badge}</span>
        <h5 className="font-extrabold text-xs text-[var(--text-primary)] leading-tight">{title}</h5>
      </div>

      <div className="mt-3 space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
        <div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase block">
            Active ACV
          </span>
          <span className="text-sm font-black text-[var(--text-primary)]">
            {formatCurrency(data.active_acv)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block">
            {formatNumber(data.active_count)} active deals
          </span>
        </div>

        <div className="pt-1 text-[10px] text-[var(--text-muted)]">
          <span>Raw: {formatCurrency(data.raw_acv)}</span> ({data.raw_count})
          <span className="block text-rose-500/80">-{data.deleted_lost_count} Del/Lost</span>
        </div>
      </div>
    </div>
  )
}
