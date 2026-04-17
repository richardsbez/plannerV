import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useStore } from '../store'
import { useTheme, Theme } from '../theme'
import { Moon, Sun } from 'lucide-react'

interface Props {
  streak: number
  onHistory?: () => void
  focusMode: boolean
  onCommand?: (cmd: string) => void
  theme: Theme
  onToggleTheme: () => void
  vaultBadge?: React.ReactNode
  saveState?: 'idle' | 'saving' | 'saved'
  editMode?: boolean
  onToggleEdit?: () => void
  onOpenPanels?: () => void
}

let pomodoroInterval: ReturnType<typeof setInterval> | null = null

export function TopBar({ streak, onHistory, focusMode, onCommand, theme, onToggleTheme, vaultBadge, saveState = 'idle', editMode = false, onToggleEdit, onOpenPanels }: Props) {
  const t = useTheme()
  const isElectron = !!window.electronAPI
  const { tasks } = useStore()

  const [pomodoroSecs, setPomodoroSecs] = useState(25 * 60)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroDone, setPomodoroDone] = useState(false)

  useEffect(() => {
    if (pomodoroRunning) {
      pomodoroInterval = setInterval(() => {
        setPomodoroSecs(s => {
          if (s <= 1) { clearInterval(pomodoroInterval!); setPomodoroRunning(false); setPomodoroDone(true); return 0 }
          return s - 1
        })
      }, 1000)
    } else { if (pomodoroInterval) clearInterval(pomodoroInterval) }
    return () => { if (pomodoroInterval) clearInterval(pomodoroInterval) }
  }, [pomodoroRunning])

  const resetPomodoro = () => { setPomodoroSecs(25 * 60); setPomodoroRunning(false); setPomodoroDone(false) }
  const pomMins = Math.floor(pomodoroSecs / 60)
  const pomSecs = pomodoroSecs % 60

  const [upcomingAlert, setUpcomingAlert] = useState<string | null>(null)
  useEffect(() => {
    const check = () => {
      const nowD = new Date()
      const upcoming = tasks.find(t => {
        if (!t.scheduledTime || t.completed) return false
        const [h, m] = t.scheduledTime.split(':').map(Number)
        const diff = (h * 60 + m) - (nowD.getHours() * 60 + nowD.getMinutes())
        return diff >= 0 && diff <= 5
      })
      setUpcomingAlert(upcoming?.title ?? null)
    }
    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  }, [tasks])

  const [clockStr, setClockStr] = useState(format(new Date(), 'HH:mm'))
  useEffect(() => {
    const id = setInterval(() => setClockStr(format(new Date(), 'HH:mm')), 10000)
    return () => clearInterval(id)
  }, [])

  if (focusMode) return null

  const barBg = t.titlebar ?? t.bg
  const subtle = t.text4

  return (
    <div className="titlebar-drag flex items-center px-3 shrink-0 gap-3"
      style={{ height: 36, background: barBg, borderBottom: `1px solid ${t.border}`, transition: 'background 0.3s' }}>

      {/* Logo */}
      <div className="titlebar-no-drag flex items-center gap-2">
        <div style={{ width: 16, height: 16, borderRadius: 3, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.9"/>
            <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.5"/>
            <rect x="1" y="5.5" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.5"/>
            <rect x="5.5" y="5.5" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.9"/>
          </svg>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>Planner</span>
      </div>

      <span style={{ color: t.border2, fontSize: 11 }}>·</span>
      <span style={{ fontSize: 11, color: t.text3 }}>
        {format(new Date(), "EEE, d 'de' MMM", { locale: ptBR })}
      </span>
      <span style={{ fontSize: 11, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>{clockStr}</span>

      {/* 5-min alert */}
      {upcomingAlert && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px',
          background: `rgba(223,171,1,0.1)`, border: `1px solid rgba(223,171,1,0.3)`,
          borderRadius: 4, animation: 'pulse-amber 1.5s ease infinite',
        }} className="alert-banner">
          <span style={{ fontSize: 10, color: t.amber, fontFamily: 'JetBrains Mono, monospace' }}>
            ▲ 5min → {upcomingAlert}
          </span>
        </div>
      )}

      {/* Hints */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontSize: 9.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.03em' }}>
          [] criar · /focus · /boom · /matrix · @14:30 · @60m · #tag · !!high
        </span>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="titlebar-no-drag" style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 99,
          background: streak >= 7 ? 'rgba(224,94,46,0.12)' : `rgba(223,171,1,0.08)`,
          border: `1px solid ${streak >= 7 ? 'rgba(224,94,46,0.25)' : 'rgba(223,171,1,0.15)'}`,
        }} title={`${streak} dias seguidos`}>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: streak >= 7 ? '#e05a2b' : t.text4 }}>◆</span>
          <span style={{ fontSize: 10.5, color: streak >= 7 ? '#e05a2e' : t.amber, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{streak}</span>
        </div>
      )}

      {/* Pomodoro */}
      <div className="titlebar-no-drag flex items-center gap-1">
        <button
          onClick={() => pomodoroRunning ? setPomodoroRunning(false) : (pomodoroSecs === 0 ? resetPomodoro() : setPomodoroRunning(true))}
          style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: pomodoroDone ? t.red : pomodoroRunning ? t.accent : t.text4,
            background: pomodoroRunning ? t.accentBg : 'transparent',
            border: `1px solid ${pomodoroRunning ? 'rgba(35,131,226,0.25)' : t.border}`,
            borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
            animation: pomodoroDone ? 'pulse-red 1s ease infinite' : 'none',
          }} title="Pomodoro 25min">
          🍅 {String(pomMins).padStart(2,'0')}:{String(pomSecs).padStart(2,'0')}
        </button>
        {pomodoroRunning && (
          <button onClick={resetPomodoro} style={{ fontSize: 9, color: t.text4, background: 'none', border: 'none', cursor: 'pointer' }}>↺</button>
        )}
      </div>

      {/* Theme toggle */}
      <button className="titlebar-no-drag" onClick={onToggleTheme}
        style={{ color: t.text3, background: 'none', border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', padding: '2px 5px', display: 'flex', alignItems: 'center' }}
        title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text3 }}
        onMouseLeave={e => { e.currentTarget.style.color = t.text3; e.currentTarget.style.borderColor = t.border }}>
        {theme === 'dark' ? <Sun size={11} /> : <Moon size={11} />}
      </button>

      {/* Vault badge + save state */}
      {(vaultBadge || saveState !== 'idle') && (
        <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {vaultBadge}
          {saveState === 'saving' && (
            <span style={{
              fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
              color: t.text4, letterSpacing: '0.06em',
              animation: 'ul-blink 1s ease infinite',
            }}>salvando…</span>
          )}
          {saveState === 'saved' && (
            <span style={{
              fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
              color: t.green, letterSpacing: '0.06em',
            }}>✓ salvo</span>
          )}
        </div>
      )}

      {/* Edit workspace + panels */}
      <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={onToggleEdit}
          title={editMode ? 'Sair do modo edição (ESC)' : 'Editar layout dos painéis'}
          style={{
            fontSize: 9.5,
            fontFamily: 'JetBrains Mono, monospace',
            padding: '2px 8px',
            borderRadius: 3,
            border: `1px solid ${editMode ? 'rgba(35,131,226,0.5)' : t.border}`,
            background: editMode ? t.accentBg : 'transparent',
            color: editMode ? t.accent : t.text3,
            cursor: 'pointer',
            fontWeight: editMode ? 600 : 400,
            transition: 'all 0.15s',
            letterSpacing: '0.03em',
          }}
          onMouseEnter={e => {
            if (!editMode) {
              e.currentTarget.style.color = t.text
              e.currentTarget.style.borderColor = t.text3
            }
          }}
          onMouseLeave={e => {
            if (!editMode) {
              e.currentTarget.style.color = t.text3
              e.currentTarget.style.borderColor = t.border
            }
          }}
        >
          {editMode ? '◈ editando' : '⊞ editar'}
        </button>

        <button
          onClick={onOpenPanels}
          title="Gerenciar painéis visíveis"
          style={{
            fontSize: 9.5,
            fontFamily: 'JetBrains Mono, monospace',
            padding: '2px 8px',
            borderRadius: 3,
            border: `1px solid ${t.border}`,
            background: 'transparent',
            color: t.text3,
            cursor: 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.03em',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text3 }}
          onMouseLeave={e => { e.currentTarget.style.color = t.text3; e.currentTarget.style.borderColor = t.border }}
        >
          painéis
        </button>
      </div>

      {/* History */}
      <button className="titlebar-no-drag" onClick={onHistory}
        style={{ color: t.text4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}
        onMouseEnter={e => (e.currentTarget.style.color = t.text2)}
        onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>
        hist
      </button>

      {isElectron && (
        <div className="titlebar-no-drag flex items-center gap-1.5 ml-1">
          {[{ action: 'minimize', color: t.amber }, { action: 'maximize', color: t.green }, { action: 'close', color: t.red }].map(({ action, color }) => (
            <button key={action}
              onClick={() => (window.electronAPI as any)[action]()}
              style={{ width: 11, height: 11, borderRadius: '50%', background: t.border2, border: 'none', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = color)}
              onMouseLeave={e => (e.currentTarget.style.background = t.border2)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
