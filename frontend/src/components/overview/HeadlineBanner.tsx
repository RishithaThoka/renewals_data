import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface InsightChip {
  label: string
  value: string
  type?: 'positive' | 'negative' | 'warning' | 'neutral'
}

interface HeadlineBannerProps {
  headlineText?: string
  chips?: InsightChip[]
  compareLabel?: string
  loading?: boolean
}

export default function HeadlineBanner({
  headlineText,
  chips = [],
  compareLabel = 'yesterday',
  loading = false,
}: HeadlineBannerProps) {
  if (loading) {
    return (
      <div className="rounded-3xl p-7 relative overflow-hidden bg-gradient-to-r from-[#12284C] via-[#0D3B66] to-[#00A3AD] animate-pulse h-48 border border-white/10" />
    )
  }

  const defaultText = `ACV is tracking firmly since ${compareLabel}. View category transitions and waterfall breakdown below.`

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative rounded-3xl p-6 md:p-8 overflow-hidden shadow-xl border border-white/15"
      style={{
        background:
          'linear-gradient(135deg, #12284C 0%, #0D3559 38%, #03697A 75%, #00A3AD 100%)',
      }}
    >
      {/* Ambient background glow & glass highlights */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#8080FF]/25 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-5xl">
        {/* Subtle executive badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-100">
            Executive Shift Summary
          </span>
        </div>

        {/* Dynamic hero headline sentence */}
        <h1 className="font-display font-extrabold text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-snug md:leading-tight drop-shadow-sm">
          {headlineText || defaultText}
        </h1>

        {/* Secondary insight chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            {chips.map((chip, idx) => {
              const isPositive = chip.type === 'positive'
              const isWarning = chip.type === 'warning'
              const isNegative = chip.type === 'negative'

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + idx * 0.08 }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all text-xs text-white/95 shadow-sm"
                >
                  {isPositive && <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />}
                  {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />}
                  {isNegative && <TrendingDown className="w-3.5 h-3.5 text-rose-300" />}
                  {!isPositive && !isWarning && !isNegative && (
                    <Info className="w-3.5 h-3.5 text-cyan-200" />
                  )}

                  <span className="text-white/75 font-medium">{chip.label}:</span>
                  <span className="font-bold text-white tabular-nums">{chip.value}</span>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
