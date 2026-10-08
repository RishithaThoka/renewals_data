import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Send,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Code2,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Compass,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { streamAIChat, getAIConfig } from '@/api/client'
import { useAppStore, AssistantMessage } from '@/store/appStore'

const SUGGESTED_CHIPS = [
  'What changed since yesterday?',
  'Which region lost the most Commit?',
  'Top 10 opportunities in Middle East',
  'How many deals are Pending Approval?',
  'Show history of 006Qp00000as0WCIAY',
]

interface AssistantChatProps {
  isFullPage?: boolean
}

export default function AssistantChat({ isFullPage = false }: AssistantChatProps) {
  const navigate = useNavigate()
  const messages = useAppStore((s) => s.assistantMessages)
  const setMessages = useAppStore((s) => s.setAssistantMessages)
  const clearMessages = useAppStore((s) => s.clearAssistantMessages)
  const setSelectedOppId = useAppStore((s) => s.setSelectedOppId)

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
  const [aiConfig, setAiConfig] = useState<{ is_demo_mode: boolean; model: string }>({
    is_demo_mode: true,
    model: 'demo-rules',
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAIConfig()
      .then((cfg) => setAiConfig(cfg))
      .catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, statusMessage])

  const toggleToolExpander = (msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  const handleSend = async (userPrompt?: string) => {
    const query = (userPrompt || input).trim()
    if (!query || isStreaming) return

    setInput('')
    const userMsgId = 'u_' + Date.now()
    const aiMsgId = 'ai_' + (Date.now() + 1)

    const userMessage: AssistantMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const initialAiMessage: AssistantMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      toolsCalled: [],
      sources: [],
      chartData: null,
      isDemoMode: aiConfig.is_demo_mode,
    }

    setMessages((prev) => [...prev, userMessage, initialAiMessage])
    setIsStreaming(true)
    setStatusMessage('Querying analytical services...')

    // Format conversation history for context
    const convHistory = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let accumulatedContent = ''
    let toolsAccumulator: any[] = []

    await streamAIChat({
      question: query,
      conversation: convHistory,
      onTextChunk: (chunk) => {
        accumulatedContent += chunk
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulatedContent } : m))
        )
      },
      onToolCall: (tc) => {
        toolsAccumulator.push(tc)
        setStatusMessage(`Executed tool: ${tc.tool}`)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, toolsCalled: [...toolsAccumulator] } : m
          )
        )
      },
      onMeta: (meta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  sources: meta.sources || [],
                  chartData: meta.chart_data || null,
                  toolsCalled: meta.tools_called || toolsAccumulator,
                  isRefusal: meta.is_refusal || false,
                }
              : m
          )
        )
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content:
                    accumulatedContent ||
                    `Sorry, I encountered an issue: ${err}. Please try again.`,
                }
              : m
          )
        )
      },
      onDone: () => {
        setIsStreaming(false)
        setStatusMessage('')
      },
    })
  }

  const renderContentWithOppLinks = (text: string) => {
    // Regular expression matching 18-char opportunity ID e.g. 006Qp00000as0WCIAY
    const oppRegex = /\b(006[A-Za-z0-9]{15})\b/g
    const parts = text.split(oppRegex)

    return parts.map((part, idx) => {
      if (part.match(/^006[A-Za-z0-9]{15}$/)) {
        return (
          <button
            key={idx}
            onClick={() => setSelectedOppId(part)}
            className="inline-flex items-center gap-1 font-mono font-semibold px-1.5 py-0.5 rounded text-xs transition-colors mx-0.5"
            style={{
              background: 'rgba(0,163,173,0.15)',
              color: '#00A3AD',
              border: '1px solid rgba(0,163,173,0.3)',
            }}
            title="Click to view Opportunity details"
          >
            {part}
            <ExternalLink size={10} />
          </button>
        )
      }

      // Convert Markdown bold **text** to strong
      const boldParts = part.split(/(\*\*.*?\*\*)/g)
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return <strong key={`${idx}-${bIdx}`}>{bPart.slice(2, -2)}</strong>
        }
        // Preserve line breaks
        const lines = bPart.split('\n')
        return lines.map((line, lIdx) => (
          <React.Fragment key={`${idx}-${bIdx}-${lIdx}`}>
            {lIdx > 0 && <br />}
            {line}
          </React.Fragment>
        ))
      })
    })
  }

  const navigateToSource = (source: { page: string; params?: Record<string, any> }) => {
    if (!source || !source.page) return
    const searchParams = new URLSearchParams()
    if (source.params) {
      Object.entries(source.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          searchParams.set(k, String(v))
        }
      })
    }
    const target = `${source.page}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    navigate(target)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Info */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #00A3AD22, #8080FF22)' }}
          >
            <Sparkles size={18} style={{ color: '#00A3AD' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                Renewals Intelligence Assistant
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide flex items-center gap-1"
                style={{
                  background: aiConfig.is_demo_mode ? 'rgba(0,163,173,0.12)' : 'rgba(34,197,94,0.12)',
                  color: aiConfig.is_demo_mode ? '#00A3AD' : '#22C55E',
                  border: `1px solid ${aiConfig.is_demo_mode ? 'rgba(0,163,173,0.25)' : 'rgba(34,197,94,0.25)'}`,
                }}
              >
                <ShieldCheck size={11} />
                {aiConfig.is_demo_mode ? 'Demo Mode' : 'AI Connected'}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Verified analytical queries & benchmark truth
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title="Clear conversation"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center max-w-md mx-auto space-y-4">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, #00A3AD18, #12284C25)' }}
            >
              <Compass size={32} style={{ color: '#00A3AD' }} />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Ask anything about your Renewals Pipeline
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                All figures are computed directly from database snapshots. Click a suggestion below or type your own question.
              </p>
            </div>

            {/* Suggested Chips */}
            <div className="flex flex-col gap-2 pt-2">
              {SUGGESTED_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  className="text-left text-xs px-3.5 py-2.5 rounded-xl border transition-all hover:scale-[1.01] flex items-center justify-between group"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>{chip}</span>
                  <ChevronRight
                    size={14}
                    className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    style={{ color: '#00A3AD' }}
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[90%] shadow-sm ${
                  m.role === 'user' ? 'text-white' : ''
                }`}
                style={{
                  background:
                    m.role === 'user'
                      ? 'linear-gradient(135deg, #12284C, #1E3D6B)'
                      : 'var(--bg-card)',
                  color: m.role === 'user' ? '#FFFFFF' : 'var(--text-primary)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                }}
              >
                <div>{renderContentWithOppLinks(m.content)}</div>

                {/* Inline Chart */}
                {m.chartData && m.chartData.items && m.chartData.items.length > 0 && (
                  <div
                    className="mt-3 pt-3 border-t rounded-xl p-2.5"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg-primary)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {m.chartData.type === 'bar' ? <BarChart3 size={14} style={{ color: '#00A3AD' }} /> : <TrendingUp size={14} style={{ color: '#00A3AD' }} />}
                      {m.chartData.title}
                    </div>
                    <div style={{ height: 160, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        {m.chartData.type === 'line' ? (
                          <LineChart data={m.chartData.items} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <YAxis
                              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                              tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                            />
                            <Tooltip
                              formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'ACV']}
                              contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', fontSize: '11px', borderRadius: '8px' }}
                            />
                            <Line type="monotone" dataKey="value" stroke="#00A3AD" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        ) : (
                          <BarChart data={m.chartData.items} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                            <YAxis
                              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                              tickFormatter={(v) => (v > 1000 ? `$${(v / 1_000_000).toFixed(1)}M` : String(v))}
                            />
                            <Tooltip
                              formatter={(v: any) => [typeof v === 'number' && v > 1000 ? `$${Number(v).toLocaleString()}` : v, 'Amount / Count']}
                              contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', fontSize: '11px', borderRadius: '8px' }}
                            />
                            <Bar dataKey="value" fill="#00A3AD" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Source chips linking to matching pages */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t flex flex-wrap items-center gap-1.5" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      Sources:
                    </span>
                    {m.sources.map((src, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => navigateToSource(src.link)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{
                          background: 'rgba(0,163,173,0.1)',
                          color: '#00A3AD',
                          border: '1px solid rgba(0,163,173,0.25)',
                        }}
                      >
                        <span>{src.label}</span>
                        <ExternalLink size={10} />
                      </button>
                    ))}
                  </div>
                )}

                {/* Show how I got this (tool inspector) */}
                {m.toolsCalled && m.toolsCalled.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => toggleToolExpander(m.id)}
                      className="text-[11px] font-medium flex items-center gap-1 transition-colors hover:underline"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Code2 size={12} />
                      <span>Show how I got this ({m.toolsCalled.length} tool{m.toolsCalled.length > 1 ? 's' : ''})</span>
                      {expandedTools[m.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>

                    <AnimatePresence>
                      {expandedTools[m.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 p-2.5 rounded-lg text-xs font-mono overflow-x-auto space-y-2 border"
                          style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {m.toolsCalled.map((t, tIdx) => (
                            <div key={tIdx} className="space-y-1">
                              <div className="font-bold text-[#00A3AD]">
                                Tool: {t.tool}
                              </div>
                              <div>Arguments: {JSON.stringify(t.args || {})}</div>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-[10px] opacity-75">
                                  Raw Tool Output JSON
                                </summary>
                                <pre className="p-1.5 mt-1 rounded bg-black/10 dark:bg-black/30 overflow-x-auto text-[10px]">
                                  {JSON.stringify(t.result, null, 2)}
                                </pre>
                              </details>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] mt-1 px-1 opacity-50" style={{ color: 'var(--text-muted)' }}>
                {m.timestamp}
              </span>
            </motion.div>
          ))
        )}

        {/* Streaming / Typing Indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 p-2 rounded-xl text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#00A3AD' }}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
            <span>{statusMessage || 'Analyzing pipeline data...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Chips Bar when chat has messages */}
      {messages.length > 0 && !isStreaming && (
        <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          {SUGGESTED_CHIPS.slice(0, 3).map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full border transition-all hover:scale-105 shrink-0"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div
        className="p-3 border-t flex items-center gap-2 shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          disabled={isStreaming}
          placeholder="Ask about pipeline totals, movements, top deals..."
          className="flex-1 px-3.5 py-2 rounded-xl text-xs sm:text-sm border outline-none transition-all focus:ring-2 focus:ring-[#00A3AD]"
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border)',
          }}
          id="assistant-chat-input"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isStreaming}
          className="px-3.5 py-2 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-all disabled:opacity-40 hover:scale-105 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, #00A3AD, #12284C)',
            color: '#FFFFFF',
          }}
          id="assistant-chat-send"
        >
          <Send size={14} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  )
}
