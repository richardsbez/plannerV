// ── MoodPanel.tsx ─────────────────────────────────────────────────────────────
// Mood // Mood & energy tracker — saved to vault/mood/log.md energy tracker — saved to vault/humor/log.md

import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { vaultStore } from '../vault/api'
import { loadMoodLog, writeMoodLog } from '../vault/persistence'
import type { MoodStore, MoodEntry } from '../vault/format'
import { subscribeToExternalChanges } from './VaultSelector'

const MOOD_LABELS   = ['péssimo', 'ruim', 'ok', 'bom', 'ótimo']
const ENERGY_LABELS = ['exausto', 'cansado', 'ok', 'disposto', 'energizado']
const MOOD_COLORS   = ['#e05a2b', '#dfab01', '#7a7a7a', '#2383e2', '#0f7b6c']

function ScaleSelector({ value, labels, colors, onChange }: {
  value: number; labels: string[]; colors: string[]; onChange: (v: number) => void
}) {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1,2,3,4,5].map(v => (
        <button key={v} onClick={() => onChange(v)} title={labels[v-1]} style={{
          flex: 1, height: 30, border: `1px solid ${value === v ? colors[v-1] : t.border2}`,
          borderRadius: 4, background: value === v ? `${colors[v-1]}22` : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: value === v ? colors[v-1] : t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
            {v}
          </span>
        </button>
      ))}
    </div>
  )
}

export function MoodPanel() {
  const t         = useTheme()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const vaultPath = vaultStore.getPath()

  const [store, setStore] = useState<MoodStore>({})
  const [note,  setNote]  = useState('')

  // ── Load from vault ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vaultPath) return
    loadMoodLog().then(data => {
      setStore(data)
      setNote(data[today]?.note ?? '')
    })
  }, [vaultPath, today])

  // ── External FS watch ──────────────────────────────────────────────────────
  useEffect(() => {
    return subscribeToExternalChanges(parsed => {
      if (!parsed || parsed.type !== 'mood-log') return
      setStore(parsed.store)
      setNote(parsed.store[today]?.note ?? '')
    })
  }, [today])

  const update = (field: keyof MoodEntry, val: number | string) => {
    setStore(prev => {
      const current = prev[today] ?? { date: today, mood: 0, energy: 0, note: '' }
      const next    = { ...prev, [today]: { ...current, [field]: val } }
      writeMoodLog(next)
      return next
    })
  }

  const entry   = store[today]
  const days14  = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'))
  const moodData   = days14.map(d => store[d]?.mood   ?? 0)
  const energyData = days14.map(d => store[d]?.energy ?? 0)

  const mkPath = (data: number[]) => {
    const w = 200, h = 28, pad = 4
    const pts = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad)
      const y = v === 0 ? h / 2 : h - pad - ((v - 1) / 4) * (h - 2 * pad)
      return `${x},${y}`
    })
    return 'M' + pts.join(' L')
  }

  const weekDays   = days14.slice(-7)
  const weekLabels = weekDays.map(d => format(new Date(d + 'T12:00'), 'EEE', { locale: ptBR }).slice(0,1).toUpperCase())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px', overflowY: 'auto' }}>

      <div style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginBottom: 12, letterSpacing: '0.04em' }}>
        {format(new Date(), "EEEE, d 'de' MMM", { locale: ptBR }).toLowerCase()}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>humor</span>
          {entry?.mood ? <span style={{ color: MOOD_COLORS[entry.mood - 1] }}>{MOOD_LABELS[entry.mood - 1]}</span> : null}
        </div>
        <ScaleSelector value={entry?.mood ?? 0} labels={MOOD_LABELS} colors={MOOD_COLORS} onChange={v => update('mood', v)} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>energia</span>
          {entry?.energy ? <span style={{ color: MOOD_COLORS[entry.energy - 1] }}>{ENERGY_LABELS[entry.energy - 1]}</span> : null}
        </div>
        <ScaleSelector value={entry?.energy ?? 0} labels={ENERGY_LABELS} colors={MOOD_COLORS} onChange={v => update('energy', v)} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={note}
          onChange={e => { setNote(e.target.value); update('note', e.target.value) }}
          placeholder="nota rápida..."
          style={{
            width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`,
            outline: 'none', fontSize: 12, color: t.text, fontFamily: '"Crimson Pro", Georgia, serif',
            padding: '4px 0', boxSizing: 'border-box',
          }}
          onFocus={e => (e.currentTarget.style.borderBottomColor = t.accent)}
          onBlur={e  => (e.currentTarget.style.borderBottomColor = t.border)}
        />
      </div>

      <div style={{ background: t.bg2, borderRadius: 6, padding: '10px 12px' }}>
        <div style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, letterSpacing: '0.04em' }}>últimas 2 semanas</div>
        <svg width="100%" viewBox="0 0 200 40" style={{ display: 'block', overflow: 'visible' }}>
          <line x1="4" y1="20" x2="196" y2="20" stroke={t.border} strokeWidth="0.5" strokeDasharray="3,3" />
          {moodData.some(v => v > 0)   && <path d={mkPath(moodData)}   fill="none" stroke={t.accent} strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />}
          {energyData.some(v => v > 0) && <path d={mkPath(energyData)} fill="none" stroke={t.green}  strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" strokeDasharray="3,2" />}
          {entry?.mood > 0 && <circle cx="196" cy={40 - 4 - ((entry.mood - 1) / 4) * 32} r="3" fill={t.accent} />}
        </svg>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 2, background: t.accent, borderRadius: 1 }} />
            <span style={{ fontSize: 8.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>humor</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 1, background: t.green, borderRadius: 1 }} />
            <span style={{ fontSize: 8.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>energia</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          {weekDays.map((d, i) => {
            const e      = store[d]
            const isToday= d === today
            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: e?.mood ? `${MOOD_COLORS[e.mood - 1]}${isToday ? 'ff' : '77'}` : t.border2,
                  border: isToday ? `1px solid ${t.accent}` : '1px solid transparent',
                  transition: 'background 0.2s',
                }} title={e ? `${MOOD_LABELS[e.mood-1]}, ${ENERGY_LABELS[e.energy-1]}` : ''} />
                <span style={{ fontSize: 8, color: isToday ? t.accent : t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
                  {weekLabels[i]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
