import { useEffect, useRef, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { formatACV, formatCount } from '@/utils/format'
import type { ReactNode } from 'react'

interface KpiTileProps {
  label: string
  value: number | null | undefined
  format?: 'acv' | 'count' | 'pct'
  delta?: number | null
  deltaLabel?: string
  caption?: string
  icon?: ReactNode
  accent?: string
  sparklineData?: number[]
  loading?: boolean
}

function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (target === 0) {
      setCurrent(0)
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCurrent(target * eased)
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return current
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const points = useMemo(() => {
    if (!data || data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const width = 64
    const height = 24

    return data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width
        const y = height - ((val - min) / range) * (height - 6) - 3
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [data])

  if (!points) return null

  return (
    <svg className="w-16 h-6 overflow-visible opacity-70" viewBox="0 0 64 24">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export default function KpiTile({
  label,
  value,
  format = 'acv',
  delta,
  deltaLabel,
  caption,
  icon,
  accent = '#00A3AD',
  sparklineData,
  loading = false,
}: KpiTileProps) {
  const animated = useCountUp(value ?? 0)

  const display = () => {
    if (format === 'acv') return formatACV(animated)
    if (format === 'count') return formatCount(Math.round(animated))
    if (format === 'pct') return `${animated.toFixed(1)}%`
    return '—'
  }

  // Default mock sparkline if none provided
  const sparkData = useMemo(() => {
    if (sparklineData && sparklineData.length >= 2) return sparklineData
    const base = value ?? 50
    return [base * 0.92, base * 0.95, base * 0.91, base * 0.98, base * 0.97, base * 1.0]
  }, [sparklineData, value])

  if (loading) {
    return (
      <div className="card-premium p-5 space-y-3">
        <div className="skeleton-shimmer h-3.5 w-24" />
        <div className="skeleton-shimmer h-9 w-36" />
        <div className="skeleton-shimmer h-3 w-28" />
      </div>
    )
  }

  const isPositive = delta != null && delta >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="card-premium p-5 relative overflow-hidden group"
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${accent} 0%, rgba(128,128,255,0.6) 50%, transparent 100%)`,
        }}
      />

      {/* Header with label, icon & sparkline */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">
          {label}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MiniSparkline data={sparkData} color={accent} />
          {icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity"
              style={{ background: `${accent}18`, color: accent }}
            >
              {icon}
            </div>
          )}
        </div>
      </div>

      {/* Value with display font and tabular numerals */}
      <p className="font-display font-extrabold text-3xl tracking-tight tabular-nums text-[var(--text-primary)]">
        {display()}
      </p>

      {/* Delta chip: Green up / Orange down */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {delta != null && (
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums border ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            <span>{isPositive ? '▲' : '▼'}</span>
            <span>
              {format === 'count'
                ? Math.abs(delta).toLocaleString('en-US')
                : formatACV(Math.abs(delta), false)}
            </span>
          </div>
        )}

        <span className="text-xs text-[var(--text-muted)]">
          {deltaLabel ?? 'vs yesterday'}
        </span>
      </div>

      {caption && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-1.5 leading-snug">
          {caption}
        </p>
      )}
    </motion.div>
  )
}
