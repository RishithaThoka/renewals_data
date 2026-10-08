import { motion } from 'framer-motion'
import { Sparkles, ShieldAlert, TrendingDown, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDailyBrief, getPredictiveInsights } from '@/api/client'
import { formatCount } from '@/utils/format'
import AssistantChat from '@/components/assistant/AssistantChat'

export default function AIAssistant() {
  const { data: brief } = useQuery({ queryKey: ['daily-brief'], queryFn: getDailyBrief })
  const { data: insights } = useQuery({ queryKey: ['predictive-insights'], queryFn: getPredictiveInsights })

  const isCollecting = insights?.status === 'collecting_history'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Sparkles className="w-6 h-6 text-[#00A3AD]" />
            Data Assistant
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Full-screen conversational renewals intelligence · Shared conversation history across all pages
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Page Chat Container */}
        <div
          className="lg:col-span-2 rounded-2xl border flex flex-col shadow-sm overflow-hidden"
          style={{
            height: 'calc(100vh - 210px)',
            minHeight: '560px',
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
          id="assistant-full-page-card"
        >
          <AssistantChat isFullPage={true} />
        </div>

        {/* Sidebar: Daily Brief + Predictive Risk Scoring */}
        <div className="space-y-4">
          {/* Daily Brief Card */}
          {brief?.brief && (
            <div
              className="rounded-2xl p-4 border shadow-sm"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
            >
              <h3 className="text-sm font-bold mb-2.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Sparkles size={15} style={{ color: '#00A3AD' }} />
                Executive Daily Brief
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {brief.brief}
              </p>
              {brief.generated_at && (
                <p className="text-[10px] mt-2 opacity-50" style={{ color: 'var(--text-muted)' }}>
                  Generated as of {brief.generated_at}
                </p>
              )}
            </div>
          )}

          {/* Predictive Insights Card */}
          <div
            className="rounded-2xl p-4 border shadow-sm"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
            }}
          >
            <h3 className="text-sm font-bold mb-2.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ShieldAlert size={15} style={{ color: '#F59E0B' }} />
              Predictive Risk Insights
            </h3>

            {isCollecting ? (
              <div className="text-center py-6">
                <TrendingDown size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {insights?.message || 'Collecting history...'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <strong style={{ color: '#EF4444' }}>{formatCount(insights?.at_risk_count ?? 0)}</strong> at-risk opportunities detected
                </p>
                {(insights?.at_risk ?? []).slice(0, 5).map((opp: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl p-2.5 text-xs space-y-1 border"
                    style={{
                      background:
                        opp.risk.level === 'High'
                          ? 'rgba(239,68,68,0.06)'
                          : opp.risk.level === 'Medium'
                          ? 'rgba(245,158,11,0.06)'
                          : 'rgba(34,197,94,0.06)',
                      borderColor:
                        opp.risk.level === 'High'
                          ? 'rgba(239,68,68,0.2)'
                          : opp.risk.level === 'Medium'
                          ? 'rgba(245,158,11,0.2)'
                          : 'rgba(34,197,94,0.2)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold truncate max-w-40" style={{ color: 'var(--text-primary)' }}>
                        {opp.opportunity_name ?? opp.opportunity_id_18}
                      </p>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          background:
                            opp.risk.level === 'High'
                              ? 'rgba(239,68,68,0.15)'
                              : opp.risk.level === 'Medium'
                              ? 'rgba(245,158,11,0.15)'
                              : 'rgba(34,197,94,0.15)',
                          color:
                            opp.risk.level === 'High'
                              ? '#EF4444'
                              : opp.risk.level === 'Medium'
                              ? '#F59E0B'
                              : '#22C55E',
                        }}
                      >
                        {opp.risk.level} · {opp.risk.score}
                      </span>
                    </div>
                    {opp.risk.factors.slice(0, 2).map((f: string, fi: number) => (
                      <p key={fi} className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <AlertTriangle size={10} className="shrink-0" /> {f}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
