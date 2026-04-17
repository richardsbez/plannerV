import { useTheme } from '../theme'
import { useState } from 'react'
import { Task } from '../types'
import { useStore } from '../store'
import { SmartInput } from './SmartInput'
import { tagColor, heatColor } from './SmartInput'
import { CountdownTimer } from './CountdownTimer'
import { Trash2, X } from 'lucide-react'

interface Props {
  onFocusTask?: (task: Task) => void
  expanded: boolean
  onClose: () => void
}

const Q_CONFIG = {
  Q1: { label: 'Fazer Agora', color: '#e03e3e', icon: '⚡' },
  Q2: { label: 'Agendar', color: '#2383e2', icon: '📅' },
  Q3: { label: 'Delegar', color: '#dfab01', icon: '→' },
  Q4: { label: 'Eliminar', color: '#5e5e5e', icon: '✕' },
}

export function CompactMatrix({ onFocusTask, expanded, onClose }: Props) {
  const thm = useTheme()
  const { tasks, moveTaskToMatrix, toggleTask, deleteTask } = useStore()
  const [over, setOver] = useState<string | null>(null)

  const q = (id: Task['matrixQuadrant']) =>
    tasks.filter(t => t.matrixQuadrant === id)

  const handleDrop = (quadrant: Task['matrixQuadrant'], e: React.DragEvent) => {
    e.preventDefault()
    setOver(null)
    const tid = e.dataTransfer.getData('taskId')
    if (tid) moveTaskToMatrix(tid, quadrant)
  }

  if (!expanded) {
    // Ultra-compact: just Top 3 from Q1
    const top3 = q('Q1').filter(t => !t.completed).slice(0, 3)
    const completedQ1 = q('Q1').filter(t => t.completed).length
    const total = (['Q1','Q2','Q3','Q4'] as Task['matrixQuadrant'][]).reduce((a, id) => a + q(id).filter(t=>!t.completed).length, 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, color: thm.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            top tier
          </span>
          <span style={{ fontSize: 9, color: thm.border2, fontFamily: 'JetBrains Mono, monospace' }}>
            {total} pendentes
          </span>
        </div>

        {top3.length === 0 && (
          <div style={{ fontSize: 11, color: '#2e2e2e', fontStyle: 'italic', fontFamily: 'Inter, sans-serif', padding: '4px 0' }}>
            nenhuma tarefa crítica ✓
          </div>
        )}

        {top3.map((tk, i) => (
          <div key={tk.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 0',
            borderBottom: i < top3.length - 1 ? '1px solid #1a1a1a' : 'none',
          }}>
            <span style={{ fontSize: 9, color: '#e03e3e', fontFamily: 'JetBrains Mono, monospace', minWidth: 14 }}>{i + 1}.</span>
            <input type="checkbox" checked={tk.completed} onChange={() => toggleTask(tk.id)}
              className="task-cb" style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span style={{
              fontSize: 12, color: thm.text2, fontFamily: 'Inter, sans-serif',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{tk.title}</span>
            {tk.timerMinutes && <CountdownTimer minutes={tk.timerMinutes} compact />}
          </div>
        ))}

        {completedQ1 > 0 && (
          <div style={{ fontSize: 9.5, color: thm.border2, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
            +{completedQ1} concluídas
          </div>
        )}
      </div>
    )
  }

  // Full matrix modal
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '70vw', maxWidth: 820, height: '70vh',
        background: thm.bg1, border: `1px solid ${thm.border2}`,
        borderRadius: 8, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid #1e1e1e',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: thm.text2, letterSpacing: '0.02em' }}>
            ⊞ Matriz de Eisenhower
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: thm.text4, fontFamily: 'JetBrains Mono, monospace' }}>
              arraste para reorganizar · ESC para fechar
            </span>
            <button onClick={onClose} style={{ color: thm.text4, background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e03e3e')}
              onMouseLeave={e => (e.currentTarget.style.color = thm.text4)}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, background: thm.border, overflow: 'hidden' }}>
          {(['Q1','Q2','Q3','Q4'] as Task['matrixQuadrant'][]).map(id => {
            const cfg = Q_CONFIG[id!]
            const qtasks = q(id)
            return (
              <div key={id}
                onDragOver={e => { e.preventDefault(); setOver(id!) }}
                onDragLeave={() => setOver(null)}
                onDrop={e => handleDrop(id, e)}
                style={{
                  background: over === id ? 'rgba(35,131,226,0.05)' : thm.bg1,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  transition: 'background 0.15s',
                  borderLeft: `2px solid ${cfg.color}22`,
                }}
              >
                <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: cfg.color }}>{cfg.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: thm.text2 }}>{cfg.label}</span>
                  <span style={{ fontSize: 9.5, color: thm.border2, marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
                    {qtasks.filter(t=>!t.completed).length}
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                  {qtasks.map(tk => {
                    const heat = heatColor(tk.createdAt, t.completed)
                    return (
                      <div key={tk.id} draggable onDragStart={e => e.dataTransfer.setData('taskId', tk.id)}
                        className="group"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '4px 12px', opacity: tk.completed ? 0.3 : 1,
                          transition: 'opacity 0.4s, background 0.1s', cursor: 'grab',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <input type="checkbox" checked={tk.completed} onChange={() => toggleTask(t.id)}
                          className="task-cb" style={{ width: 12, height: 12 }} />
                        <span style={{
                          flex: 1, fontSize: 12.5, color: heat ?? (tk.completed ? thm.text4 : thm.text),
                          fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: tk.completed ? 'line-through' : 'none',
                        }}>{t.title}</span>
                        {t.tags?.map(tag => (
                          <span key={tag} style={{ fontSize: 9, color: tagColor(tag), fontFamily: 'JetBrains Mono, monospace' }}>#{tag}</span>
                        ))}
                        {t.timerMinutes && !t.completed && <CountdownTimer minutes={t.timerMinutes} compact />}
                        <button onClick={() => onFocusTask?.(t)}
                          style={{ color: '#2e2e2e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, opacity: 0 }}
                          className="group-hover:opacity-100"
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = thm.text2 }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
                          ⊙
                        </button>
                        <button onClick={() => deleteTask(t.id)}
                          style={{ color: '#2e2e2e', background: 'none', border: 'none', cursor: 'pointer', opacity: 0 }}
                          className="group-hover:opacity-100"
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#e03e3e' }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <SmartInput section="month-week" matrixQuadrant={id}
                  placeholder={`[] tarefa → ${cfg.label.toLowerCase()}`} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
