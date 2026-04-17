import { useTheme } from '../theme'
import { useEffect, useState, useRef } from 'react'
import { Task } from '../types'
import { useStore } from '../store'
import { tagColor } from './SmartInput'
import { CountdownTimer } from './CountdownTimer'

interface Props {
  task?: Task | null
  onClose: () => void
}

export function DeepFocus({ task, onClose }: Props) {
  const t = useTheme()
  const { tasks } = useStore()
  const [elapsed, setElapsed] = useState(0)
  const [breathing, setBreathing] = useState(false)
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')
  const startRef = useRef(Date.now())
  const activeTask = task || tasks.find(t => !t.completed && t.section === 'day') || null

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!breathing) return
    const cycle = ['inhale', 'hold', 'exhale'] as const
    const durations = [4000, 4000, 6000]
    let i = 0
    const step = () => {
      setPhase(cycle[i % 3])
      return setTimeout(step, durations[i++ % 3])
    }
    const t = step()
    return () => clearTimeout(t)
  }, [breathing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const breathingLabel = { inhale: 'inspire...', hold: 'segure...', exhale: 'expire...' }

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
      {/* Blurred noise texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.025\'/%3E%3C/svg%3E")',
        pointerEvents: 'none',
      }} />

      {/* Ambient glow */}
      {activeTask && (
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(35,131,226,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 20, left: 24, right: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
          deep work · {elapsedStr}
        </span>
        <span style={{ fontSize: 11, color: '#252525', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
          ESC para sair
        </span>
      </div>

      {/* Breathing */}
      {breathing && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, pointerEvents: 'none',
        }}>
          <div style={{
            width: phase === 'inhale' ? 280 : phase === 'hold' ? 280 : 180,
            height: phase === 'inhale' ? 280 : phase === 'hold' ? 280 : 180,
            borderRadius: '50%',
            border: `1px solid rgba(35,131,226,${phase === 'hold' ? '0.15' : '0.08'})`,
            transition: `all ${phase === 'inhale' ? '4s' : phase === 'hold' ? '0.1s' : '6s'} ease`,
          }} />
          <span style={{
            fontSize: 11, color: '#2383e2', fontFamily: 'JetBrains Mono, monospace',
            opacity: 0.5, letterSpacing: '0.1em',
          }}>
            {breathingLabel[phase]}
          </span>
        </div>
      )}

      {/* Main content */}
      <div style={{
        maxWidth: 560, width: '100%', padding: '0 48px',
        textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        {activeTask ? (
          <>
            {activeTask.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
                {activeTask.tags.map(tag => (
                  <span key={tag} style={{
                    fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                    color: tagColor(tag), background: `${tagColor(tag)}14`,
                    padding: '2px 8px', borderRadius: 3, letterSpacing: '0.04em',
                  }}>#{tag}</span>
                ))}
              </div>
            )}

            <h1 style={{
              fontSize: 34, fontWeight: 300, color: t.text,
              fontFamily: '"Crimson Pro", "Georgia", serif',
              lineHeight: 1.3, marginBottom: 16, letterSpacing: '-0.01em',
            }}>
              {activeTask.title}
            </h1>

            {activeTask.note && (
              <p style={{
                fontSize: 14, color: t.text3, fontFamily: 'Inter, sans-serif',
                lineHeight: 1.7, marginBottom: 28, fontStyle: 'italic',
              }}>
                {activeTask.note}
              </p>
            )}

            <div style={{ width: 32, height: 1, background: '#1e1e1e', margin: '28px auto' }} />

            {activeTask.timerMinutes ? (
              <CountdownTimer minutes={activeTask.timerMinutes} />
            ) : (
              <div style={{
                fontSize: 11, color: '#2e2e2e', fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.08em',
              }}>
                {elapsedStr} em foco
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 20, opacity: 0.3 }}>◎</div>
            <p style={{ fontSize: 16, color: t.text3, fontFamily: 'Inter, sans-serif', fontWeight: 300 }}>
              Sem tarefas ativas
            </p>
            <p style={{ fontSize: 12, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>
              adicione uma tarefa e volte ao foco
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 16, alignItems: 'center',
      }}>
        <button
          onClick={() => setBreathing(b => !b)}
          style={{
            fontSize: 10, color: breathing ? '#2383e2' : '#2e2e2e',
            fontFamily: 'JetBrains Mono, monospace', background: 'none',
            border: 'none', cursor: 'pointer', letterSpacing: '0.06em',
            transition: 'color 0.2s',
          }}
        >
          {breathing ? '◉ respiração ativa' : '○ respirar'}
        </button>
      </div>
    </div>
  )
}
