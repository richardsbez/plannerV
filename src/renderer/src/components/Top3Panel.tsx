// ── Top3Panel.tsx ─────────────────────────────────────────────────────────────
// Three daily objectives — persisted in the vault at top3/<date>.md,
// so data follows the vault (not the browser profile) and survives vault
// migrations. Resets automatically at midnight each day.

import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import { writeTop3, loadTop3 } from '../vault/persistence'
import type { Top3Objective } from '../vault/persistence'

const DEFAULT: Top3Objective[] = [
  { id: 1, text: '', done: false },
  { id: 2, text: '', done: false },
  { id: 3, text: '', done: false },
]

function todayStr() { return new Date().toISOString().slice(0, 10) }

// Persist with writeTop3 from persistence.ts (routes through shared debounceWrite
// so syncFlushAllPending captures it on close).
// Load with loadTop3 which reads vault/top3/YYYY-MM-DD.md.

export function Top3Panel() {
  const t = useTheme()
  const [items, setItems] = useState<Top3Objective[]>(DEFAULT)
  const [editing, setEditing] = useState<number | null>(null)
  const today = todayStr()

  // Load from vault on mount (async — vault read is async IPC)
  useEffect(() => {
    loadTop3(today).then(setItems)
  }, [today])

  // Persist whenever items change
  useEffect(() => { writeTop3(today, items) }, [items, today])

  // Reset at midnight
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date()
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0)
      return midnight.getTime() - now.getTime()
    }
    const id = setTimeout(() => { setItems(DEFAULT) }, msUntilMidnight())
    return () => clearTimeout(id)
  }, [])

  const toggle = (id: number) => setItems(prev => prev.map(o => o.id === id ? { ...o, done: !o.done } : o))
  const setText = (id: number, text: string) => setItems(prev => prev.map(o => o.id === id ? { ...o, text } : o))

  const allDone = items.every(o => o.done || !o.text)
  const doneCount = items.filter(o => o.done && o.text).length
  const totalSet  = items.filter(o => o.text).length
  const pct = totalSet > 0 ? Math.round((doneCount / totalSet) * 100) : 0

  const RANK_COLORS = ['#e03e3e', '#dfab01', '#2383e2']
  const RANK_LABELS = ['1º', '2º', '3º']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px', gap: 6 }}>
      {/* Header stat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          objetivos de hoje
        </span>
        <div style={{ flex: 1, height: 2, background: t.border, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? t.green : t.accent, borderRadius: 99, transition: 'width 0.4s ease, background 0.4s' }} />
        </div>
        <span style={{ fontSize: 9.5, color: pct === 100 ? t.green : t.text4, fontFamily: 'JetBrains Mono, monospace', fontWeight: pct === 100 ? 700 : 400 }}>
          {pct === 100 ? '✓ dia completo' : `${doneCount}/${totalSet}`}
        </span>
      </div>

      {/* Objectives */}
      {items.map((obj, i) => (
        <div key={obj.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          borderRadius: 6,
          background: obj.done ? `${RANK_COLORS[i]}06` : t.bg2,
          border: `1px solid ${obj.done ? `${RANK_COLORS[i]}20` : t.border}`,
          transition: 'all 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Rank tag */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 3, background: obj.text ? RANK_COLORS[i] : t.border,
            borderRadius: '6px 0 0 6px', transition: 'background 0.3s',
          }} />

          <span style={{
            fontSize: 10, fontWeight: 700, color: obj.text ? RANK_COLORS[i] : t.text4,
            fontFamily: 'JetBrains Mono, monospace', minWidth: 18, textAlign: 'center',
            transition: 'color 0.3s',
          }}>{RANK_LABELS[i]}</span>

          <input
            type="checkbox"
            checked={obj.done}
            onChange={() => toggle(obj.id)}
            disabled={!obj.text}
            className="task-cb"
            style={{ width: 15, height: 15, flexShrink: 0, cursor: obj.text ? 'pointer' : 'default', opacity: obj.text ? 1 : 0.3 }}
          />

          <div style={{ flex: 1 }}>
            {editing === obj.id ? (
              <input
                autoFocus
                value={obj.text}
                onChange={e => setText(obj.id, e.target.value)}
                onBlur={() => setEditing(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Escape') setEditing(null)
                  if (e.key === 'Tab') {
                    e.preventDefault()
                    const nextId = items[(i + 1) % 3]?.id
                    if (nextId !== undefined) setEditing(nextId)
                  }
                }}
                placeholder={`Objetivo ${i + 1}...`}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  borderBottom: `1px solid ${RANK_COLORS[i]}`,
                  outline: 'none', fontSize: 13.5,
                  color: t.text, fontFamily: 'Inter, sans-serif', lineHeight: 1.4,
                }}
              />
            ) : (
              <div
                onClick={() => setEditing(obj.id)}
                style={{
                  fontSize: 13.5, fontFamily: 'Inter, sans-serif',
                  color: obj.text ? (obj.done ? t.text3 : t.text) : t.text4,
                  textDecoration: obj.done ? 'line-through' : 'none',
                  lineHeight: 1.4, cursor: 'text',
                  fontStyle: obj.text ? 'normal' : 'italic',
                  transition: 'all 0.2s',
                }}>
                {obj.text || `Clique para definir o objetivo ${i + 1}...`}
              </div>
            )}
          </div>

          {/* Done flash */}
          {obj.done && obj.text && (
            <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>
          )}
        </div>
      ))}

      {/* Motivational footer */}
      <div style={{ marginTop: 'auto', padding: '8px 0 0', borderTop: `1px solid ${t.border}` }}>
        {allDone && totalSet > 0 ? (
          <p style={{ fontSize: 11, color: t.green, fontFamily: '"Crimson Pro", Georgia, serif', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
            🎉 Todos os objetivos do dia concluídos!
          </p>
        ) : (
          <p style={{ fontSize: 11, color: t.text4, fontFamily: '"Crimson Pro", Georgia, serif', fontStyle: 'italic', textAlign: 'center', margin: 0, opacity: 0.7 }}>
            {totalSet === 0 ? 'Defina seus 3 objetivos do dia.' : `${3 - totalSet > 0 ? `+${3 - totalSet} para completar. ` : ''}Foco no que importa.`}
          </p>
        )}
      </div>
    </div>
  )
}
