// ── PriorityMatrix.tsx ────────────────────────────────────────────────────────
// Full Eisenhower matrix — always visible inside its widget, no modal needed.

import { useState, useCallback } from 'react'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { Task } from '../types'
import { tagColor, heatColor } from './SmartInput'
import { parseSmartLine } from './SmartInput'
import { Trash2 } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'

const QUADS: { id: Task['matrixQuadrant']; label: string; sub: string; color: string; icon: string }[] = [
  { id: 'Q1', label: 'Fazer Agora',  sub: 'urgente + importante',      color: '#e03e3e', icon: '⚡' },
  { id: 'Q2', label: 'Agendar',      sub: 'importante, não urgente',   color: '#2383e2', icon: '📅' },
  { id: 'Q3', label: 'Delegar',      sub: 'urgente, não importante',   color: '#dfab01', icon: '→'  },
  { id: 'Q4', label: 'Eliminar',     sub: 'nem urgente, nem import.', color: '#5e5e5e', icon: '✕'  },
]

export function PriorityMatrix({ onFocusTask }: { onFocusTask?: (t: Task) => void }) {
  const { tasks, moveTaskToMatrix, toggleTask, deleteTask, addTask } = useStore()
  const t = useTheme()
  const [over, setOver] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const q = (id: Task['matrixQuadrant']) => tasks.filter(tk => tk.matrixQuadrant === id)

  const handleDrop = (quadrant: Task['matrixQuadrant'], e: React.DragEvent) => {
    e.preventDefault(); setOver(null)
    const tid = e.dataTransfer.getData('taskId')
    if (tid) moveTaskToMatrix(tid, quadrant)
  }

  const submitInput = useCallback((quadrant: Task['matrixQuadrant']) => {
    const raw = (inputs[quadrant!] || '').trim()
    if (!raw) return
    const p = parseSmartLine(raw.startsWith('[') ? raw : `[] ${raw}`)
    if (p?.type === 'task' && p.title) {
      addTask({
        title: p.title, note: p.note, notes: '',
        section: 'month-week', matrixQuadrant: quadrant,
        tags: p.tags, scheduledTime: p.scheduledTime,
        timerMinutes: p.timerMinutes, completed: p.completed,
      } as any)
    }
    setInputs(prev => ({ ...prev, [quadrant!]: '' }))
  }, [inputs, addTask])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100%', gap: 1, background: t.border }}>
      {QUADS.map(cfg => {
        const qtasks = q(cfg.id)
        const active = qtasks.filter(tk => !tk.completed)
        const done   = qtasks.filter(tk => tk.completed)
        const isOver = over === cfg.id

        return (
          <div key={cfg.id}
            onDragOver={e => { e.preventDefault(); setOver(cfg.id!) }}
            onDragLeave={() => setOver(null)}
            onDrop={e => handleDrop(cfg.id, e)}
            style={{
              background: isOver ? `${cfg.color}08` : t.bg1,
              display: 'flex', flexDirection: 'column',
              borderLeft: `2px solid ${cfg.color}30`,
              transition: 'background 0.15s',
              overflow: 'hidden',
            }}
          >
            {/* Quad header */}
            <div style={{
              padding: '6px 10px 4px',
              borderBottom: `1px solid ${t.border}`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 11, color: cfg.color }}>{cfg.icon}</span>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: cfg.color, letterSpacing: '-0.01em' }}>{cfg.label}</div>
                <div style={{ fontSize: 9, color: t.text4, marginTop: 1 }}>{cfg.sub}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: t.border2, fontFamily: 'JetBrains Mono, monospace' }}>
                {active.length}
              </span>
            </div>

            {/* Tasks */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '3px 0' }}>
              {active.map(tk => {
                const heat = heatColor(tk.createdAt, tk.completed)
                return (
                  <div key={tk.id} draggable
                    onDragStart={e => e.dataTransfer.setData('taskId', tk.id)}
                    className="group"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px',
                      cursor: 'grab',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={tk.completed} onChange={() => toggleTask(tk.id)}
                      className="task-cb" style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span style={{
                      flex: 1, fontSize: 12, color: heat ?? t.text,
                      fontFamily: 'Inter, sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={tk.title}>{tk.title}</span>
                    {tk.tags?.map(tag => (
                      <span key={tag} style={{ fontSize: 9, color: tagColor(tag), fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>#{tag}</span>
                    ))}
                    {tk.timerMinutes && !tk.completed && <CountdownTimer minutes={tk.timerMinutes} compact />}
                    <button onClick={() => onFocusTask?.(tk)}
                      style={{ color: t.text4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, flexShrink: 0, opacity: 0, transition: 'opacity 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = t.text2 }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>⊙</button>
                    <button onClick={() => deleteTask(tk.id)}
                      style={{ color: t.text4, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: 0, transition: 'opacity 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = t.red }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                )
              })}

              {/* Done tasks (collapsed) */}
              {done.length > 0 && (
                <div style={{ padding: '2px 10px', fontSize: 9.5, color: t.border2, fontFamily: 'JetBrains Mono, monospace' }}>
                  +{done.length} feitas
                </div>
              )}
            </div>

            {/* Inline input */}
            <div style={{ padding: '4px 8px 5px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 4, background: t.inputBg }}>
                <span style={{ fontSize: 10, color: cfg.color, opacity: 0.5 }}>+</span>
                <input
                  value={inputs[cfg.id!] || ''}
                  onChange={e => setInputs(prev => ({ ...prev, [cfg.id!]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') submitInput(cfg.id) }}
                  placeholder={`tarefa para ${cfg.label.toLowerCase()}...`}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: t.text2,
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
