import { useTheme } from '../theme'
// ── InsightsPanel.tsx ─────────────────────────────────────────────────────────
// Productivity insights: GitHub-style heatmap, focus time counter, daily quote.

import { useMemo, useState, useEffect } from 'react'
import { useStore } from '../store'
import { format, subDays, parseISO, isSameDay } from 'date-fns'

// ── Quotes rotation ──────────────────────────────────────────────────────────
const QUOTES = [
  { text: 'Feito é melhor do que perfeito.', author: 'Mark Zuckerberg' },
  { text: 'A disciplina é a ponte entre metas e realizações.', author: 'Jim Rohn' },
  { text: 'O segredo de avançar é começar.', author: 'Mark Twain' },
  { text: 'Foco. Faça o que importa. Ignore o resto.', author: 'Cal Newport' },
  { text: 'Um passo por vez ainda te leva ao destino.', author: 'Emily Brontë' },
  { text: 'A clareza vem da ação, não do pensamento.', author: 'Marie Forleo' },
  { text: 'Simplicidade é a sofisticação máxima.', author: 'Leonardo da Vinci' },
  { text: 'Esforce-se pelo progresso, não pela perfeição.', author: '' },
  { text: 'O tempo que você aprecia desperdiçar não é desperdiçado.', author: 'Bertrand Russell' },
  { text: 'Profundidade antes de amplitude.', author: 'Cal Newport' },
  { text: 'Cada dia é uma nova chance de melhorar.', author: '' },
  { text: 'Comece onde você está. Use o que você tem. Faça o que pode.', author: 'Arthur Ashe' },
]

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return QUOTES[dayOfYear % QUOTES.length]
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
interface DayActivity {
  date: string
  count: number
  completed: number
}

function getHeatColor(count: number, completed: number, border: string, accent: string): string {
  if (count === 0) return border
  const ratio = completed / count
  if (ratio === 1) {
    // All done - green spectrum
    if (count >= 5) return '#0f7b6c'
    if (count >= 3) return '#1a9a8a'
    return '#2ab5a0'
  }
  // Partial - blue spectrum
  if (count >= 5) return '#1a5da8'
  if (count >= 3) return accent
  return '#4a9ade'
}

// ── Focus time tracking ───────────────────────────────────────────────────────
// We track focus sessions in localStorage
const FOCUS_KEY = 'planner-focus-sessions'
interface FocusSession { date: string; minutes: number }

export function recordFocusSession(minutes: number) {
  try {
    const raw = localStorage.getItem(FOCUS_KEY)
    const sessions: FocusSession[] = raw ? JSON.parse(raw) : []
    sessions.push({ date: new Date().toISOString().split('T')[0], minutes })
    // Keep only last 30 days
    const cutoff = subDays(new Date(), 30).toISOString().split('T')[0]
    const trimmed = sessions.filter(s => s.date >= cutoff)
    localStorage.setItem(FOCUS_KEY, JSON.stringify(trimmed))
  } catch {}
}

function loadFocusSessions(): FocusSession[] {
  try {
    const raw = localStorage.getItem(FOCUS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function InsightsPanel() {
  const t = useTheme()
  const { tasks } = useStore()
  const quote = useMemo(() => getDailyQuote(), [])
  const [focusSessions] = useState<FocusSession[]>(() => loadFocusSessions())

  // Build 30-day activity data
  const activityData = useMemo((): DayActivity[] => {
    const days: DayActivity[] = []
    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const dayTasks = tasks.filter(t => {
        const created = t.createdAt.split('T')[0]
        const completed = t.completedAt?.split('T')[0]
        return created === date || completed === date
      })
      const completedToday = tasks.filter(t => t.completedAt?.split('T')[0] === date)
      days.push({
        date,
        count: dayTasks.length,
        completed: completedToday.length,
      })
    }
    return days
  }, [tasks])

  // Weekly focus time
  const weekFocusMinutes = useMemo(() => {
    const weekAgo = subDays(new Date(), 7).toISOString().split('T')[0]
    return focusSessions
      .filter(s => s.date >= weekAgo)
      .reduce((sum, s) => sum + s.minutes, 0)
  }, [focusSessions])

  // Timer minutes from completed tasks this week
  const weekTimerMinutes = useMemo(() => {
    const weekAgo = subDays(new Date(), 7).toISOString().split('T')[0]
    return tasks
      .filter(t => t.completed && t.completedAt && t.timerMinutes && t.completedAt.split('T')[0] >= weekAgo)
      .reduce((sum, t) => sum + (t.timerMinutes || 0), 0)
  }, [tasks])

  const totalFocusMin = weekFocusMinutes + weekTimerMinutes
  const focusHours = Math.floor(totalFocusMin / 60)
  const focusMins = totalFocusMin % 60

  // Today stats
  const todayStr = new Date().toISOString().split('T')[0]
  const todayDone = tasks.filter(t => t.completedAt?.split('T')[0] === todayStr).length
  const todayTotal = tasks.filter(t => t.createdAt.split('T')[0] === todayStr || t.dueDate === todayStr).length

  // Best streak from activity
  let maxStreak = 0, curStreak = 0
  activityData.forEach(d => {
    if (d.completed > 0) { curStreak++; maxStreak = Math.max(maxStreak, curStreak) }
    else curStreak = 0
  })

  // Group heatmap into weeks (rows) of 7 days
  const heatWeeks: DayActivity[][] = []
  for (let i = 0; i < activityData.length; i += 7) {
    heatWeeks.push(activityData.slice(i, i + 7))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px', gap: 14, overflowY: 'auto' }}>

      {/* ── Heatmap ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Atividade / 30 dias
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>menos</span>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: [t.border,'#4a9ade',t.accent,'#2ab5a0','#0f7b6c'][i] }} />
            ))}
            <span style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>mais</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 3 }}>
          {heatWeeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map(day => {
                const isToday = day.date === todayStr
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.completed} concluídas / ${day.count} tarefas`}
                    style={{
                      width: 12, height: 12,
                      borderRadius: 2,
                      background: getHeatColor(day.count, day.completed, t.border, t.accent),
                      border: isToday ? '1px solid rgba(35,131,226,0.6)' : '1px solid transparent',
                      cursor: 'default',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
              {todayDone}
            </div>
            <div style={{ fontSize: 9, color: '#2e2e2e', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>hoje</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: maxStreak > 0 ? t.amber : t.text4, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
              {maxStreak}d
            </div>
            <div style={{ fontSize: 9, color: '#2e2e2e', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>sequência</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text2, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
              {tasks.filter(t => t.completed).length}
            </div>
            <div style={{ fontSize: 9, color: '#2e2e2e', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>total ✓</div>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: t.border, flexShrink: 0 }} />

      {/* ── Focus time ── */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Tempo de Foco / semana
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          {totalFocusMin > 0 ? (
            <>
              {focusHours > 0 && (
                <span style={{ fontSize: 24, fontWeight: 700, color: t.accent, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                  {focusHours}<span style={{ fontSize: 11, color: '#3e3e3e', marginLeft: 2 }}>h</span>
                </span>
              )}
              <span style={{ fontSize: focusHours > 0 ? 18 : 24, fontWeight: 700, color: focusHours > 0 ? t.text2 : t.accent, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                {focusMins}<span style={{ fontSize: 11, color: '#3e3e3e', marginLeft: 2 }}>min</span>
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: t.text4, fontFamily: 'JetBrains Mono, monospace', fontStyle: 'italic' }}>
              use /focus ou @timer para contar
            </span>
          )}
        </div>

        {/* Mini weekly focus bars */}
        {totalFocusMin > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 8, alignItems: 'flex-end', height: 24 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
              const mins = focusSessions.filter(s => s.date === d).reduce((s, x) => s + x.minutes, 0)
              const maxMins = Math.max(...Array.from({ length: 7 }, (_, j) => {
                const dj = format(subDays(new Date(), 6 - j), 'yyyy-MM-dd')
                return focusSessions.filter(s => s.date === dj).reduce((s, x) => s + x.minutes, 0)
              }), 1)
              const h = Math.max(2, (mins / maxMins) * 22)
              const isToday = d === todayStr
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%', height: h, borderRadius: 2,
                    background: isToday ? t.accent : mins > 0 ? '#1a4a7a' : t.border,
                    transition: 'height 0.3s ease',
                  }} />
                  <span style={{ fontSize: 7.5, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
                    {['D','S','T','Q','Q','S','S'][new Date(d + 'T12:00:00').getDay()]}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: t.border, flexShrink: 0 }} />

      {/* ── Quote ── */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: t.text4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Citação do dia
        </div>
        <blockquote style={{
          margin: 0,
          padding: '0 0 0 10px',
          borderLeft: '2px solid #1e1e1e',
        }}>
          <p style={{
            fontSize: 12.5, color: 'rgba(155,154,151,0.45)',
            fontFamily: '"Crimson Pro", Georgia, serif',
            fontStyle: 'italic', lineHeight: 1.6,
            margin: 0,
          }}>
            "{quote.text}"
          </p>
          {quote.author && (
            <footer style={{ fontSize: 10, color: t.text4, fontFamily: 'JetBrains Mono, monospace', marginTop: 6, letterSpacing: '0.04em' }}>
              — {quote.author}
            </footer>
          )}
        </blockquote>
      </div>
    </div>
  )
}
