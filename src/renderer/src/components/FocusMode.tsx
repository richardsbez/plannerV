import { useTheme } from '../theme'
import { useEffect, useState, useRef } from 'react'
import { Task } from '../types'
import { tagColor } from './SmartInput'
import { CountdownTimer } from './CountdownTimer'

interface Props { task: Task; onClose: () => void }

export function FocusMode({ task, onClose }: Props) {
  const t = useTheme()
  const [elapsed, setElapsed] = useState(0)
  const [breathing, setBreathing] = useState(false)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  return (
    <div
      className="focus-overlay fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: t.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'default',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Ambient noise */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E")', pointerEvents: 'none', opacity: 0.6 }} />

      {/* Close hint */}
      <div style={{ position: 'absolute', top: 20, right: 24, fontSize: 11, color: '#3e3e3e', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
        ESC para sair
      </div>

      {/* Elapsed timer */}
      <div style={{ position: 'absolute', top: 20, left: 24, fontSize: 11, color: '#3e3e3e', fontFamily: 'JetBrains Mono, monospace' }}>
        foco · {elapsedStr}
      </div>

      {/* Breathing button */}
      <div style={{ position: 'absolute', bottom: 28, right: 24 }}>
        <button onClick={() => setBreathing(b => !b)}
          style={{ fontSize: 10, color: '#3e3e3e', fontFamily: 'JetBrains Mono, monospace', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>
          {breathing ? '⬤ respira...' : '○ respirar'}
        </button>
      </div>

      {/* Breathing animation */}
      {breathing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(35,131,226,0.1)', animation: 'breathe 4s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: '1px solid rgba(35,131,226,0.06)', animation: 'breathe 4s ease-in-out infinite 0.5s' }} />
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: 520, width: '100%', padding: '0 40px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Tags */}
        {task.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
            {task.tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: tagColor(tag), background: `${tagColor(tag)}18`, padding: '2px 8px', borderRadius: 3, letterSpacing: '0.04em' }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e6e6e6', fontFamily: '"Crimson Pro", "Georgia", serif', lineHeight: 1.3, marginBottom: 16, letterSpacing: '-0.01em' }}>
          {task.title}
        </h1>

        {/* Note */}
        {task.note && (
          <p style={{ fontSize: 15, color: '#5e5e5e', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, marginBottom: 24 }}>
            {task.note}
          </p>
        )}

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: '#2e2e2e', margin: '24px auto' }} />

        {/* Timer */}
        {task.timerMinutes ? (
          <CountdownTimer minutes={task.timerMinutes} />
        ) : (
          <div style={{ fontSize: 11, color: '#3e3e3e', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
            sem timer · {elapsedStr} focado
          </div>
        )}

        {/* Scheduled time */}
        {task.scheduledTime && (
          <div style={{ marginTop: 16, fontSize: 11, color: '#2383e2', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', opacity: 0.7 }}>
            agendado para {task.scheduledTime}
          </div>
        )}
      </div>
    </div>
  )
}
