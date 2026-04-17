// ── JournalPanel.tsx ──────────────────────────────────────────────────────────
// Daily reflection journal — each day saved as journal/YYYY-MM-DD.md in vault.

import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { vaultStore } from '../vault/api'
import {
  loadJournalEntry, loadAllJournalEntries, writeJournalEntry
} from '../vault/persistence'
import type { JournalEntry } from '../vault/format'
import { subscribeToExternalChanges } from './VaultSelector'

const PROMPTS = [
  { key: 'bem',      label: 'o que foi bem',    placeholder: 'O que deu certo hoje...' },
  { key: 'melhorar', label: 'o que melhorar',   placeholder: 'O que posso aprimorar...' },
  { key: 'amanha',   label: 'prioridade amanhã', placeholder: 'O que mais importa amanhã...' },
] as const

export function JournalPanel() {
  const t = useTheme()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const vaultPath = vaultStore.getPath()

  const [entry, setEntry]     = useState<JournalEntry>({ date: today, bem: '', melhorar: '', amanha: '' })
  const [pastEntries, setPastEntries] = useState<Record<string, JournalEntry>>({})
  const [showPast, setShowPast] = useState(false)
  const [loaded, setLoaded]   = useState(false)

  // No local timer needed — writeJournalEntry routes through the shared
  // debounceWrite Map in persistence.ts, so syncFlushAllPending captures it on close.

  // ── Load from vault on mount / vault change ────────────────────────────────
  useEffect(() => {
    if (!vaultPath) return
    setLoaded(false)
    Promise.all([
      loadJournalEntry(today),
      loadAllJournalEntries(),
    ]).then(([todayEntry, all]) => {
      setEntry(todayEntry)
      setPastEntries(all)
      setLoaded(true)
    })
  }, [vaultPath, today])

  // ── External FS watch ──────────────────────────────────────────────────────
  useEffect(() => {
    return subscribeToExternalChanges(parsed => {
      if (!parsed || parsed.type !== 'journal') return
      if (parsed.entry.date === today) {
        setEntry(parsed.entry)
      } else {
        setPastEntries(prev => ({ ...prev, [parsed.entry.date]: parsed.entry }))
      }
    })
  }, [today])

  // ── Write ────────────────────────────────────────────────────────────────
  // writeJournalEntry calls debounceWrite(600ms) internally — registered in the
  // shared timers Map so syncFlushAllPending() captures it correctly on app close.
  const update = (field: keyof JournalEntry, val: string) => {
    setEntry(prev => {
      const next = { ...prev, [field]: val }
      writeJournalEntry(next)
      return next
    })
  }

  const past = Array.from({ length: 6 }, (_, i) => format(subDays(new Date(), i + 1), 'yyyy-MM-dd'))
    .filter(d => pastEntries[d] && (pastEntries[d].bem || pastEntries[d].melhorar || pastEntries[d].amanha))
    .slice(0, 5)

  const filled = [entry.bem, entry.melhorar, entry.amanha].filter(Boolean).length

  if (!vaultPath && !loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.text4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
        cofre não selecionado
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
          {format(new Date(), "EEEE, d 'de' MMM", { locale: ptBR }).toLowerCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i < filled ? t.accent : t.border2,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Prompts */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {PROMPTS.map(p => (
          <div key={p.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em', display: 'block', marginBottom: 4, textTransform: 'lowercase' }}>
              {p.label}
            </label>
            <textarea
              value={entry[p.key]}
              onChange={e => update(p.key as keyof JournalEntry, e.target.value)}
              placeholder={p.placeholder}
              rows={2}
              style={{
                width: '100%', resize: 'none', background: t.bg2,
                border: `1px solid ${t.border}`, borderRadius: 5,
                padding: '7px 9px', fontSize: 12,
                color: t.text, fontFamily: '"Crimson Pro", Georgia, serif',
                lineHeight: 1.5, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = t.accent)}
              onBlur={e  => (e.currentTarget.style.borderColor = t.border)}
            />
          </div>
        ))}

        {/* Past entries */}
        {past.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button onClick={() => setShowPast(s => !s)} style={{
              fontSize: 9.5, color: t.text4, background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
              onMouseEnter={e => (e.currentTarget.style.color = t.text2)}
              onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>
              {showPast ? '▾' : '▸'} entradas anteriores ({past.length})
            </button>

            {showPast && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map(d => {
                  const e = pastEntries[d]
                  if (!e) return null
                  return (
                    <div key={d} style={{ padding: '8px 10px', background: t.bg2, borderRadius: 5, borderLeft: `2px solid ${t.border2}` }}>
                      <div style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>
                        {format(new Date(d + 'T12:00'), "EEEE, d MMM", { locale: ptBR }).toLowerCase()}
                      </div>
                      {e.bem    && <p style={{ margin: '0 0 2px', fontSize: 11, color: t.text3, fontFamily: '"Crimson Pro", Georgia, serif', lineHeight: 1.4 }}>{e.bem}</p>}
                      {e.amanha && <p style={{ margin: 0, fontSize: 10, color: t.text4, fontFamily: '"Crimson Pro", Georgia, serif', lineHeight: 1.4, fontStyle: 'italic' }}>{e.amanha}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
