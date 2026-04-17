import { useState, useEffect, useRef } from 'react'

interface Props { minutes: number; compact?: boolean }

export function CountdownTimer({ minutes, compact = false }: Props) {
  const totalSecs = useRef(minutes * 60)
  const [remaining, setRemaining] = useState(totalSecs.current)
  const [done, setDone] = useState(false)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { setDone(true); setRunning(false); clearInterval(intervalRef.current!); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [running])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct = remaining / totalSecs.current
  const circumference = 2 * Math.PI * 6

  if (compact) return (
    <button
      onClick={e => { e.stopPropagation(); setRunning(r => !r) }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        color: done ? '#e03e3e' : running ? '#2383e2' : '#5e5e5e',
        background: done ? 'rgba(224,62,62,0.08)' : running ? 'rgba(35,131,226,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${done ? '#3a1a1a' : running ? '#1a2e4a' : '#2e2e2e'}`,
        borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
        transition: 'all 0.2s',
        animation: done ? 'pulse-red 1s ease infinite' : 'none',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '7px 7px', transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {done ? 'DONE' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="40" cy="40" r="36" fill="none"
          stroke={done ? '#e03e3e' : '#2383e2'} strokeWidth="3"
          strokeDasharray={2 * Math.PI * 36}
          strokeDashoffset={2 * Math.PI * 36 * (1 - pct)}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px', transition: 'stroke-dashoffset 1s linear' }}
        />
        <text x="40" y="44" textAnchor="middle" fill={done ? '#e03e3e' : '#e6e6e6'}
          fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="600">
          {done ? 'DONE' : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
        </text>
      </svg>
      <button onClick={() => setRunning(r => !r)} style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: running ? '#9b9a97' : '#2383e2',
        background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.06em',
      }}>
        {running ? '⏸ pausar' : done ? '↺ reiniciar' : '▶ iniciar'}
      </button>
    </div>
  )
}
