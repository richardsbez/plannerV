import { useTheme } from '../theme'
// ── TemporalCalendar.tsx ──────────────────────────────────────────────────────
// Multi-scale calendar: Month [M], Week [S], Year [Y]
// Clicking any day updates selectedDate in store → filters "Hoje" panel.

import { useState, useMemo } from 'react'
import { useStore } from '../store'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, startOfWeek, endOfWeek,
  parseISO, getWeek, addWeeks, startOfYear, endOfYear,
  eachMonthOfInterval, getDaysInMonth, startOfDay,
  addMonths, subMonths, addYears, subYears,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Scale = 'M' | 'S' | 'Y'

const WEEK_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export function TemporalCalendar() {
  const t = useTheme()
  const { tasks, selectedDate, setSelectedDate } = useStore()
  const [scale, setScale] = useState<Scale>('M')
  const [viewDate, setViewDate] = useState(new Date())
  const selected = parseISO(selectedDate)

  // Task dots by date
  const dotsByDate = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>()
    tasks.forEach(t => {
      const key = t.dueDate ?? (t.completedAt ? t.completedAt.split('T')[0] : null)
      if (!key) return
      const cur = m.get(key) ?? { total: 0, done: 0 }
      m.set(key, { total: cur.total + 1, done: cur.done + (t.completed ? 1 : 0) })
    })
    return m
  }, [tasks])

  const getDayData = (ds: string) => dotsByDate.get(ds)

  // Navigation
  const navPrev = () => {
    if (scale === 'M') setViewDate(d => subMonths(d, 1))
    else if (scale === 'S') setViewDate(d => addWeeks(d, -1))
    else setViewDate(d => subYears(d, 1))
  }
  const navNext = () => {
    if (scale === 'M') setViewDate(d => addMonths(d, 1))
    else if (scale === 'S') setViewDate(d => addWeeks(d, 1))
    else setViewDate(d => addYears(d, 1))
  }

  // Header label
  const headerLabel = useMemo(() => {
    if (scale === 'M') return format(viewDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase()
    if (scale === 'S') {
      const ws = startOfWeek(viewDate, { weekStartsOn: 0 })
      const we = endOfWeek(viewDate, { weekStartsOn: 0 })
      if (isSameMonth(ws, we)) return `${format(ws, 'd')}–${format(we, 'd MMM yyyy', { locale: ptBR })}`.toUpperCase()
      return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, 'd MMM yyyy', { locale: ptBR })}`.toUpperCase()
    }
    return format(viewDate, 'yyyy')
  }, [scale, viewDate])

  // ── MONTH VIEW ───────────────────────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const ms = startOfMonth(viewDate)
    const me = endOfMonth(viewDate)
    return eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 0 }), end: endOfWeek(me, { weekStartsOn: 0 }) })
  }, [viewDate])

  // ── WEEK VIEW ────────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const ws = startOfWeek(viewDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: ws, end: endOfWeek(viewDate, { weekStartsOn: 0 }) })
  }, [viewDate])

  // ── YEAR VIEW ────────────────────────────────────────────────────────────────
  const yearMonths = useMemo(() => {
    return eachMonthOfInterval({ start: startOfYear(viewDate), end: endOfYear(viewDate) })
  }, [viewDate])

  // Day button renderer
  const DayBtn = ({ day, small = false }: { day: Date; small?: boolean }) => {
    const ds = format(day, 'yyyy-MM-dd')
    const data = getDayData(ds)
    const sel = isSameDay(day, selected)
    const tod = isToday(day)
    const inMonth = scale === 'M' ? isSameMonth(day, viewDate) : true

    return (
      <button
        onClick={() => setSelectedDate(ds)}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '1',
          border: 'none',
          borderRadius: small ? 2 : 4,
          background: sel ? '#2383e2' : 'transparent',
          color: !inMonth ? t.border2 : sel ? '#fff' : tod ? '#2383e2' : t.text3,
          fontSize: small ? 9 : 11,
          fontWeight: (sel || tod) ? 600 : 400,
          cursor: 'pointer',
          transition: 'all 0.1s',
          fontFamily: 'Inter, sans-serif',
          padding: small ? 1 : 2,
        }}
        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
      >
        {format(day, 'd')}
        {data && !sel && (
          <div style={{
            position: 'absolute',
            bottom: small ? 1 : 2,
            width: small ? 3 : 4,
            height: small ? 3 : 4,
            borderRadius: '50%',
            background: data.done === data.total ? '#0f7b6c' : '#2383e2',
            opacity: 0.7,
          }} />
        )}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px 8px 8px' }}>

      {/* Scale selector + nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0 }}>
        <button onClick={navPrev}
          style={{ color: t.text4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = t.text2)}
          onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>
          <ChevronLeft size={12} />
        </button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#7a7a7a', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>
          {headerLabel}
        </div>

        <button onClick={navNext}
          style={{ color: t.text4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = t.text2)}
          onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>
          <ChevronRight size={12} />
        </button>

        {/* Scale pills */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          {(['M', 'S', 'Y'] as Scale[]).map(s => (
            <button key={s} onClick={() => setScale(s)} style={{
              fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 5px', borderRadius: 3,
              border: `1px solid ${scale === s ? '#2383e2' : t.border2}`,
              background: scale === s ? 'rgba(35,131,226,0.12)' : 'transparent',
              color: scale === s ? '#2383e2' : t.text4,
              cursor: 'pointer', transition: 'all 0.15s', fontWeight: scale === s ? 600 : 400,
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── MONTH VIEW ── */}
      {scale === 'M' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 9.5, color: '#2e2e2e', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: 1 }}>
            {monthDays.map(day => <DayBtn key={format(day, 'yyyy-MM-dd')} day={day} />)}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {scale === 'S' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {weekDays.map((day, i) => {
            const ds = format(day, 'yyyy-MM-dd')
            const data = getDayData(ds)
            const sel = isSameDay(day, selected)
            const tod = isToday(day)
            return (
              <div key={ds}
                onClick={() => setSelectedDate(ds)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 8px', borderRadius: 4,
                  background: sel ? 'rgba(35,131,226,0.08)' : 'transparent',
                  borderLeft: sel ? '2px solid #2383e2' : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 10, color: t.text4, fontFamily: 'JetBrains Mono, monospace', minWidth: 26 }}>{WEEK_NAMES[i]}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: tod ? '#2383e2' : sel ? t.text : t.text3, lineHeight: 1, minWidth: 28 }}>
                  {format(day, 'd')}
                </span>
                <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                  {data ? (
                    <>
                      <div style={{ width: 28, height: 3, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${(data.done / data.total) * 100}%`,
                          background: data.done === data.total ? '#0f7b6c' : '#2383e2',
                          borderRadius: 2, transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: 9.5, color: '#2e2e2e', fontFamily: 'JetBrains Mono, monospace' }}>{data.done}/{data.total}</span>
                    </>
                  ) : (
                    <div style={{ height: 1, flex: 1, background: t.border, borderRadius: 1 }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── YEAR VIEW ── */}
      {scale === 'Y' && (
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, overflowY: 'auto',
        }}>
          {yearMonths.map(monthStart => {
            const days = eachDayOfInterval({
              start: startOfWeek(startOfMonth(monthStart), { weekStartsOn: 0 }),
              end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
            })
            const isCurrentMonth = isSameMonth(monthStart, new Date())
            return (
              <div key={format(monthStart, 'yyyy-MM')} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{
                  fontSize: 9, fontWeight: 600, color: isCurrentMonth ? '#2383e2' : t.text4,
                  fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em', marginBottom: 2,
                  textAlign: 'center',
                }}>
                  {MONTH_NAMES_SHORT[monthStart.getMonth()].toUpperCase()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
                  {days.map(day => (
                    <DayBtn key={format(day, 'yyyy-MM-dd')} day={day} small />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
