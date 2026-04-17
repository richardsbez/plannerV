// ── TimeBlockPanel.tsx ────────────────────────────────────────────────────────
// Visual time-blocking for the day. Drag blocks to resize/move.
// 6:00 → 23:00 in 30-min slots.

import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import { format } from 'date-fns'

interface Block {
  id: string; label: string; startSlot: number; endSlot: number; color: string
}

const SLOT_HEIGHT = 20  // px per 30-min slot
const START_HOUR  = 6
const TOTAL_SLOTS = 34  // 6:00 → 23:00

const COLORS = ['#2383e2','#e03e3e','#0f7b6c','#dfab01','#9b59b6','#e05a2b']
const KEY     = 'planner-timeblocks'

interface Stored { date: string; blocks: Block[] }

function loadBlocks(): Block[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const s: Stored = JSON.parse(raw)
    if (s.date !== new Date().toISOString().slice(0,10)) return []
    return s.blocks
  } catch { return [] }
}

function slotToLabel(slot: number) {
  const totalMins = START_HOUR * 60 + slot * 30
  const h = Math.floor(totalMins / 60), m = totalMins % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function currentSlot() {
  const now = new Date()
  const mins = (now.getHours() - START_HOUR) * 60 + now.getMinutes()
  return Math.floor(mins / 30)
}

export function TimeBlockPanel() {
  const t = useTheme()
  const [blocks, setBlocks] = useState<Block[]>(loadBlocks)
  const [adding, setAdding] = useState<{ startSlot: number } | null>(null)
  const [label, setLabel]   = useState('')
  const [color, setColor]   = useState(COLORS[0])
  const [nowSlot, setNowSlot] = useState(currentSlot)

  useEffect(() => {
    const today = new Date().toISOString().slice(0,10)
    localStorage.setItem(KEY, JSON.stringify({ date: today, blocks }))
  }, [blocks])

  useEffect(() => {
    const id = setInterval(() => setNowSlot(currentSlot()), 60000)
    return () => clearInterval(id)
  }, [])

  const addBlock = (startSlot: number) => {
    if (!label.trim()) return
    const b: Block = {
      id: `b_${Date.now()}`,
      label: label.trim(),
      startSlot, endSlot: startSlot + 2,
      color,
    }
    setBlocks(prev => [...prev, b])
    setLabel(''); setAdding(null)
  }

  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id))

  const blockAtSlot = (slot: number) => blocks.find(b => slot >= b.startSlot && slot < b.endSlot)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '6px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>time blocks</span>
        <span style={{ fontSize: 10, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
          {format(new Date(), 'dd/MM')}
        </span>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', position: 'relative' }}>
        {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
          const block    = blockAtSlot(slot)
          const isHour   = slot % 2 === 0
          const isNow    = slot === nowSlot
          const isBstart = block && block.startSlot === slot
          const inBlock  = !!block

          return (
            <div key={slot} style={{ position: 'relative', height: SLOT_HEIGHT, display: 'flex', alignItems: 'center' }}>
              {/* Time label */}
              {isHour && (
                <span style={{
                  width: 36, fontSize: 9.5, color: isNow ? t.accent : t.text4,
                  fontFamily: 'JetBrains Mono, monospace', textAlign: 'right',
                  paddingRight: 6, flexShrink: 0, fontWeight: isNow ? 700 : 400,
                }}>
                  {slotToLabel(slot)}
                </span>
              )}
              {!isHour && <div style={{ width: 36 }} />}

              {/* Track line */}
              <div style={{
                flex: 1, height: isHour ? 1 : 0,
                background: isHour ? t.border : 'transparent',
                marginRight: 8, borderRadius: 1,
              }} />

              {/* Now indicator */}
              {isNow && (
                <div style={{
                  position: 'absolute', left: 36, right: 8, height: 2,
                  background: t.accent, borderRadius: 1, zIndex: 5,
                  boxShadow: `0 0 6px ${t.accent}`,
                }} />
              )}

              {/* Block rendering (at start of block) */}
              {isBstart && block && (
                <div style={{
                  position: 'absolute',
                  left: 42, right: 8,
                  top: 2,
                  height: (block.endSlot - block.startSlot) * SLOT_HEIGHT - 4,
                  background: `${block.color}20`,
                  border: `1px solid ${block.color}50`,
                  borderLeft: `3px solid ${block.color}`,
                  borderRadius: 4,
                  zIndex: 4,
                  display: 'flex', alignItems: 'center',
                  padding: '0 8px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}>
                  <span style={{ fontSize: 11, color: block.color, fontFamily: 'Inter, sans-serif', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {block.label}
                  </span>
                  <span style={{ fontSize: 9.5, color: block.color, opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                    {slotToLabel(block.startSlot)}–{slotToLabel(block.endSlot)}
                  </span>
                  <button onClick={() => removeBlock(block.id)}
                    style={{ marginLeft: 6, fontSize: 10, color: block.color, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>✕</button>
                </div>
              )}

              {/* Click-to-add (empty slots only) */}
              {!inBlock && !isNow && (
                <div
                  onClick={() => { setAdding({ startSlot: slot }); setLabel('') }}
                  style={{
                    position: 'absolute', left: 42, right: 8, top: 1, height: SLOT_HEIGHT - 2,
                    borderRadius: 3, cursor: 'pointer', zIndex: 3,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                />
              )}

              {/* Add form */}
              {adding?.startSlot === slot && (
                <div style={{
                  position: 'absolute', left: 42, right: 8, top: 2,
                  background: t.bg2, border: `1px solid ${t.accent}`,
                  borderRadius: 5, zIndex: 10, padding: '6px 8px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
                }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)} style={{
                        width: 16, height: 16, borderRadius: '50%', background: c,
                        border: `2px solid ${color === c ? t.text : 'transparent'}`, cursor: 'pointer',
                      }} />
                    ))}
                  </div>
                  <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addBlock(slot); if (e.key === 'Escape') setAdding(null) }}
                    placeholder={`${slotToLabel(slot)} – o que você vai fazer?`}
                    style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${t.accent}`, outline: 'none', fontSize: 12, color: t.text, fontFamily: 'Inter, sans-serif' }}
                  />
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => setAdding(null)} style={{ fontSize: 10, color: t.text3, background: 'none', border: `1px solid ${t.border}`, borderRadius: 3, padding: '2px 7px', cursor: 'pointer' }}>esc</button>
                    <button onClick={() => addBlock(slot)} style={{ fontSize: 10, color: '#fff', background: t.accent, border: 'none', borderRadius: 3, padding: '2px 7px', cursor: 'pointer', fontWeight: 600 }}>+ bloco</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
