// ── PomodoroPanel.tsx ─────────────────────────────────────────────────────────
// Pomodoro timer with session tracking. No emojis — clean minimal design.

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../theme'

const STORAGE_KEY = 'planner-pomodoro-sessions'

type Mode = 'work' | 'short' | 'long'

const DURATIONS: Record<Mode, number> = {
  work:  25 * 60,
  short:  5 * 60,
  long:  15 * 60,
}

const LABELS: Record<Mode, string> = {
  work:  'foco',
  short: 'pausa',
  long:  'pausa longa',
}

interface SessionLog { date: string; count: number }

function loadSessions(): SessionLog {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') ?? { date: '', count: 0 } } catch { return { date: '', count: 0 } }
}
function saveSessions(s: SessionLog) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

export function PomodoroPanel() {
  const t = useTheme()
  const today = new Date().toISOString().slice(0, 10)

  const [mode, setMode]       = useState<Mode>('work')
  const [secs, setSecs]       = useState(DURATIONS.work)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState<SessionLog>(() => {
    const s = loadSessions()
    return s.date === today ? s : { date: today, count: 0 }
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            if (mode === 'work') {
              setSessions(prev => {
                const next = { date: today, count: prev.count + 1 }
                saveSessions(next)
                return next
              })
            }
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, mode, today])

  const switchMode = (m: Mode) => {
    setMode(m); setSecs(DURATIONS[m]); setRunning(false)
  }
  const reset = () => { setSecs(DURATIONS[mode]); setRunning(false) }
  const toggle = () => { if (secs === 0) { setSecs(DURATIONS[mode]); setRunning(true) } else setRunning(r => !r) }

  const total   = DURATIONS[mode]
  const pct     = (total - secs) / total
  const mins    = Math.floor(secs / 60)
  const secStr  = String(secs % 60).padStart(2, '0')

  // SVG circle
  const R   = 52
  const circ = 2 * Math.PI * R
  const dash = pct * circ

  const modeColor = mode === 'work' ? t.accent : t.green

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', padding: '12px 16px 10px' }}>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: t.bg2, borderRadius: 6, padding: 3 }}>
        {(['work','short','long'] as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)} style={{
            fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace',
            padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: mode === m ? t.bg1 : 'transparent',
            color: mode === m ? t.text : t.text4,
            fontWeight: mode === m ? 600 : 400,
            boxShadow: mode === m ? `0 1px 3px rgba(0,0,0,0.15)` : 'none',
            transition: 'all 0.15s',
          }}>{LABELS[m]}</button>
        ))}
      </div>

      {/* Circular timer */}
      <div style={{ position: 'relative', width: 130, height: 130, marginBottom: 14 }}>
        <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r={R} fill="none" stroke={t.border2} strokeWidth="5" />
          <circle cx="65" cy="65" r={R} fill="none" stroke={modeColor} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: running ? 'stroke-dasharray 0.5s linear' : 'none' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: t.text, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-2px', lineHeight: 1 }}>
            {mins}:{secStr}
          </span>
          <span style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {LABELS[mode]}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={reset} style={{
          width: 34, height: 34, borderRadius: '50%', border: `1px solid ${t.border2}`,
          background: 'transparent', cursor: 'pointer', color: t.text4,
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text3 }}
          onMouseLeave={e => { e.currentTarget.style.color = t.text4; e.currentTarget.style.borderColor = t.border2 }}>
          ↺
        </button>

        <button onClick={toggle} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: running ? t.bg3 : modeColor, cursor: 'pointer',
          color: running ? t.text2 : '#fff',
          fontSize: running ? 16 : 14,
          fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: running ? 'none' : `0 4px 14px ${modeColor}55`,
          transition: 'all 0.2s',
        }}>
          {running ? '⏸' : secs === 0 ? '↺' : '▶'}
        </button>

        {/* Skip */}
        <button onClick={() => switchMode(mode === 'work' ? 'short' : 'work')} style={{
          width: 34, height: 34, borderRadius: '50%', border: `1px solid ${t.border2}`,
          background: 'transparent', cursor: 'pointer', color: t.text4,
          fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text3 }}
          onMouseLeave={e => { e.currentTarget.style.color = t.text4; e.currentTarget.style.borderColor = t.border2 }}>
          ⇥
        </button>
      </div>

      {/* Sessions today */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 4 }}>
          {Array.from({ length: Math.max(sessions.count, 4) }, (_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 2,
              background: i < sessions.count ? modeColor : t.border2,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <span style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
          {sessions.count} {sessions.count === 1 ? 'sessão' : 'sessões'} hoje
        </span>
      </div>

      {/* Daily goal suggestion */}
      {sessions.count >= 4 && (
        <div style={{
          fontSize: 10, color: t.green, fontFamily: 'JetBrains Mono, monospace',
          padding: '3px 10px', borderRadius: 4, border: `1px solid ${t.green}33`,
          background: `${t.green}11`,
        }}>
          meta diária atingida
        </div>
      )}
    </div>
  )
}
