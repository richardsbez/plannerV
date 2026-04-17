// ── HabitPanel.tsx ─────────────────────────────────────────────────────────
// Daily habit tracker — habits.md + log.md saved in vault/habits/.

import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import { format, subDays } from 'date-fns'
import { vaultStore } from '../vault/api'
import { loadHabitsAndLog, writeHabits, writeHabitLog } from '../vault/persistence'
import type { Habit, HabitLog } from '../vault/format'
import { subscribeToExternalChanges } from './VaultSelector'

const PRESET_COLORS  = ['#2383e2','#e03e3e','#0f7b6c','#dfab01','#9b59b6','#e05a2b','#2b9e6c']
const PRESET_SYMBOLS = ['○','△','□','◇','◉','↑','↻','◌','≡','∿']

export function HabitPanel() {
  const t         = useTheme()
  const vaultPath = vaultStore.getPath()

  const [habits,    setHabits]    = useState<Habit[]>([])
  const [log,       setLog]       = useState<HabitLog>({})
  const [adding,    setAdding]    = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newSymbol, setNewSymbol] = useState(PRESET_SYMBOLS[0])
  const [newColor,  setNewColor]  = useState(PRESET_COLORS[0])
  const [confirmDel,setConfirmDel]= useState<string | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  // ── Load from vault ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vaultPath) return
    loadHabitsAndLog().then(({ habits: h, log: l }) => {
      setHabits(h); setLog(l)
    })
  }, [vaultPath])

  // ── External FS watch ──────────────────────────────────────────────────────
  useEffect(() => {
    return subscribeToExternalChanges(parsed => {
      if (!parsed) return
      if (parsed.type === 'habits')    setHabits(parsed.habits)
      if (parsed.type === 'habit-log') setLog(parsed.log)
    })
  }, [])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const toggle = (habitId: string) => {
    setLog(prev => {
      const todayIds = prev[today] ?? []
      const next = todayIds.includes(habitId)
        ? todayIds.filter(id => id !== habitId)
        : [...todayIds, habitId]
      const updated = { ...prev, [today]: next }
      writeHabitLog(updated)
      return updated
    })
  }

  const isDone = (habitId: string, date = today) => (log[date] ?? []).includes(habitId)

  const getStreak = (habitId: string): number => {
    let streak = 0
    const d = new Date()
    while (streak < 365) {
      const ds = format(d, 'yyyy-MM-dd')
      if ((log[ds] ?? []).includes(habitId)) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  }

  const addHabit = () => {
    if (!newName.trim()) return
    const h: Habit = { id: `h_${Date.now()}`, name: newName.trim(), color: newColor, symbol: newSymbol }
    const updated = [...habits, h]
    setHabits(updated)
    writeHabits(updated)
    setNewName(''); setAdding(false)
  }

  const removeHabit = (id: string) => {
    const updated = habits.filter(h => h.id !== id)
    setHabits(updated)
    writeHabits(updated)
    setConfirmDel(null)
  }

  const last14        = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'))
  const todayDoneCount= habits.filter(h => isDone(h.id)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>hábitos</span>
          {habits.length > 0 && (
            <span style={{ fontSize: 10, color: todayDoneCount === habits.length ? t.green : t.text3, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {todayDoneCount}/{habits.length}
            </span>
          )}
        </div>
        <button onClick={() => setAdding(true)}
          style={{ fontSize: 11, color: t.text4, background: 'none', border: `1px solid ${t.border}`, borderRadius: 4, padding: '1px 8px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
          onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>
          + hábito
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {habits.length === 0 && !adding && (
          <div style={{ padding: '20px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: t.text4, fontStyle: 'italic', fontFamily: '"Crimson Pro", Georgia, serif' }}>
              Adicione hábitos para rastrear diariamente.
            </p>
          </div>
        )}

        {habits.map(h => {
          const done      = isDone(h.id)
          const streak    = getStreak(h.id)
          const pendingDel= confirmDel === h.id

          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', transition: 'background 0.1s',
              background: pendingDel ? `${t.red}11` : 'transparent',
            }}
              onMouseEnter={e => { if (!pendingDel) e.currentTarget.style.background = t.hoverBg }}
              onMouseLeave={e => { if (!pendingDel) e.currentTarget.style.background = 'transparent' }}>

              <button onClick={() => toggle(h.id)} style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `2px solid ${done ? h.color : t.border2}`,
                background: done ? h.color : 'transparent',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 13 : 12, color: done ? '#fff' : h.color,
                fontWeight: 700, transition: 'all 0.2s', fontFamily: 'JetBrains Mono, monospace',
              }}>
                {done ? '✓' : h.symbol}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: done ? t.text3 : t.text, fontFamily: 'Inter, sans-serif', textDecoration: done ? 'line-through' : 'none', transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {h.name}
                </div>
                {streak > 0 && (
                  <div style={{ fontSize: 9.5, color: h.color, fontFamily: 'JetBrains Mono, monospace', marginTop: 1, opacity: 0.8 }}>
                    {streak}d streak
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {last14.map(ds => (
                  <div key={ds} style={{
                    width: 5, height: 5, borderRadius: 1,
                    background: (log[ds] ?? []).includes(h.id) ? h.color : t.border2,
                    opacity: ds === today ? 1 : 0.65, transition: 'background 0.2s',
                  }} title={ds} />
                ))}
              </div>

              {!pendingDel ? (
                <button onClick={() => setConfirmDel(h.id)} style={{
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: t.text4, background: 'none', border: `1px solid transparent`,
                  borderRadius: 4, cursor: 'pointer', fontSize: 12, flexShrink: 0, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = t.red; e.currentTarget.style.borderColor = `${t.red}55`; e.currentTarget.style.background = `${t.red}11` }}
                  onMouseLeave={e => { e.currentTarget.style.color = t.text4; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none' }}
                  title="Excluir hábito">
                  ×
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setConfirmDel(null)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: `1px solid ${t.border}`, background: 'none', color: t.text3, cursor: 'pointer' }}>não</button>
                  <button onClick={() => removeHabit(h.id)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: `1px solid ${t.red}`, background: `${t.red}22`, color: t.red, cursor: 'pointer', fontWeight: 600 }}>excluir</button>
                </div>
              )}
            </div>
          )
        })}

        {adding && (
          <div style={{ margin: '6px 12px', padding: '10px 12px', background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {PRESET_SYMBOLS.map(s => (
                <button key={s} onClick={() => setNewSymbol(s)} style={{
                  width: 28, height: 28, fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
                  background: newSymbol === s ? t.accentBg : 'transparent',
                  border: `1px solid ${newSymbol === s ? t.accent : t.border}`,
                  borderRadius: 4, cursor: 'pointer', color: newSymbol === s ? t.accent : t.text3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} style={{
                  width: 18, height: 18, borderRadius: '50%', background: c,
                  border: `2px solid ${newColor === c ? t.text : 'transparent'}`, cursor: 'pointer',
                }} />
              ))}
            </div>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addHabit(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Nome do hábito..."
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${t.accent}`, outline: 'none', fontSize: 13, color: t.text, fontFamily: 'Inter, sans-serif', padding: '4px 0', marginBottom: 8, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdding(false)} style={{ fontSize: 11, color: t.text3, background: 'none', border: `1px solid ${t.border}`, borderRadius: 3, padding: '3px 10px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={addHabit} style={{ fontSize: 11, color: '#fff', background: t.accent, border: 'none', borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>Adicionar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
