import React from 'react'
import { motion } from 'framer-motion'

function acvM(v: number | null | undefined): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatDelta(val: number, isCount: boolean) {
  const sign = val > 0 ? '+' : ''
  const color = val > 0 ? 'text-emerald-600 dark:text-emerald-400' : val < 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-muted)]'
  const text = isCount ? `${sign}${val}` : `${sign}${acvM(val)}`
  return <span className={color}>{text}</span>
}

export interface CellData { count: number; acv: number }

export interface CompactGridProps {
  title: string
  columns: string[]
  rows: {
    id: string
    label: string
    cells: Record<string, CellData>
    total: CellData
  }[]
  totals: {
    category: Record<string, CellData>
    grand: CellData
  }
  deltas?: any
  metricMode: 'Amount' | 'Count' | 'Both'
  onCellClick: (rowId: string | null, colId: string | null, title: string) => void
  rowLabelName?: string
  compareDate?: string | null
}

export default function CompactGrid({
  title, columns, rows, totals, deltas, metricMode, onCellClick, rowLabelName = 'Row', compareDate
}: CompactGridProps) {
  
  // 1. Hide zero columns
  const activeColumns = columns.filter(c => (totals.category[c]?.count || 0) > 0 || (totals.category[c]?.acv || 0) > 0)

  // 2. Max value for heatmap
  let maxVal = 0
  rows.forEach(r => {
    activeColumns.forEach(c => {
      const cell = r.cells[c]
      if (cell) {
        const val = metricMode === 'Count' ? cell.count : cell.acv
        if (val > maxVal) maxVal = val
      }
    })
  })

  const renderVal = (count: number, acv: number) => {
    if (count === 0 && acv === 0) return <span className="text-[var(--text-muted)] opacity-50">–</span>
    if (metricMode === 'Amount') return <span className="font-semibold">{acvM(acv)}</span>
    if (metricMode === 'Count') return <span className="font-semibold">{count}</span>
    return (
      <span className="font-semibold">
        {acvM(acv)} <span className="text-[var(--text-muted)] text-[11px] font-normal">({count})</span>
      </span>
    )
  }

  const renderDeltas = (d: any) => {
    if (!d) return null
    const isCount = metricMode === 'Count'
    const parts = []
    
    // Only show "1d", "7d", or the custom label, not multiple.
    // Actually prompt says: "if the user picks a custom compare date, show that one instead of 1d and label it with its date"
    // And "1d +$316K · 7d +$2.28M" if standard.
    if (d.custom) {
      const v = isCount ? d.custom.count : d.custom.acv
      if (v != null && v !== 0) {
        parts.push(<span key="custom">{compareDate ? compareDate.substring(5,10) : 'vs'} {formatDelta(v, isCount)}</span>)
      }
    } else {
      if (d.yesterday) {
        const v = isCount ? d.yesterday.count : d.yesterday.acv
        if (v != null && v !== 0) parts.push(<span key="1d">1d {formatDelta(v, isCount)}</span>)
      }
      if (d.lastweek) {
        const v = isCount ? d.lastweek.count : d.lastweek.acv
        if (v != null && v !== 0) parts.push(<span key="7d">7d {formatDelta(v, isCount)}</span>)
      }
    }
    
    if (parts.length === 0) return null
    return (
      <div className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight flex justify-center gap-1.5">
        {parts.map((p, i) => <React.Fragment key={i}>{p}{i < parts.length - 1 && '·'}</React.Fragment>)}
      </div>
    )
  }

  return (
    <div className="card-premium overflow-hidden border border-[var(--border)]">
      <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <h3 className="font-display font-semibold text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] whitespace-nowrap">
          <thead>
            <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
              <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">{rowLabelName}</th>
              {activeColumns.map(c => (
                <th key={c} className="px-3 py-2 text-center font-medium text-[var(--text-muted)]">{c}</th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-[var(--text-primary)] border-l border-[var(--border)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0 group">
                <td 
                  className="px-3 py-2 font-medium bg-[var(--bg-secondary)] border-r border-[var(--border)] cursor-pointer hover:text-[var(--primary)] transition-colors h-[36px]"
                  onClick={() => onCellClick(r.id, null, `${r.label} Expiry`)}
                >
                  {r.label}
                </td>
                {activeColumns.map(c => {
                  const cell = r.cells[c] || { count: 0, acv: 0 }
                  const val = metricMode === 'Count' ? cell.count : cell.acv
                  const ratio = maxVal > 0 ? val / maxVal : 0
                  const bgOpacity = Math.min(ratio * 0.15, 0.15) // lighter single hue
                  return (
                    <td
                      key={c}
                      onClick={() => onCellClick(r.id, c, `${r.label} - ${c}`)}
                      className="px-3 py-1 text-center cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-primary)] h-[36px]"
                      style={val > 0 ? { backgroundColor: `rgba(99, 102, 241, ${bgOpacity})` } : {}}
                    >
                      {renderVal(cell.count, cell.acv)}
                    </td>
                  )
                })}
                <td
                  onClick={() => onCellClick(r.id, null, `${r.label} Total`)}
                  className="px-3 py-1 text-center cursor-pointer bg-[var(--bg-secondary)] border-l border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 h-[36px]"
                >
                  <div>{renderVal(r.total.count, r.total.acv)}</div>
                  {renderDeltas({
                    yesterday: deltas?.yesterday?.quarters?.[r.id] || deltas?.yesterday?.rows?.[r.id],
                    lastweek: deltas?.lastweek?.quarters?.[r.id] || deltas?.lastweek?.rows?.[r.id],
                    custom: deltas?.custom?.quarters?.[r.id] || deltas?.custom?.rows?.[r.id]
                  })}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-secondary)]">
              <td 
                className="px-3 py-2 font-semibold border-r border-[var(--border)] cursor-pointer hover:text-[var(--primary)] h-[36px]"
                onClick={() => onCellClick(null, null, `${title} Total`)}
              >
                TOTAL
              </td>
              {activeColumns.map(c => (
                <td
                  key={c}
                  onClick={() => onCellClick(null, c, `Total - ${c}`)}
                  className="px-3 py-1 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 h-[36px]"
                >
                  <div>{renderVal(totals.category[c]?.count || 0, totals.category[c]?.acv || 0)}</div>
                  {renderDeltas({
                    yesterday: deltas?.yesterday?.category?.[c],
                    lastweek: deltas?.lastweek?.category?.[c],
                    custom: deltas?.custom?.category?.[c]
                  })}
                </td>
              ))}
              <td
                onClick={() => onCellClick(null, null, `${title} Grand Total`)}
                className="px-3 py-1 text-center cursor-pointer border-l border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 h-[36px]"
              >
                <div>{renderVal(totals.grand.count, totals.grand.acv)}</div>
                {renderDeltas({
                  yesterday: deltas?.yesterday?.grand,
                  lastweek: deltas?.lastweek?.grand,
                  custom: deltas?.custom?.grand
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
