import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function MonthCalendar() {
  const { tasks, selectedDate, setSelectedDate } = useStore()
  const [viewDate, setViewDate] = useState(new Date())
  const selected = parseISO(selectedDate)

  const days = useMemo(() => {
    const ms = startOfMonth(viewDate), me = endOfMonth(viewDate)
    return eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 0 }), end: endOfWeek(me, { weekStartsOn: 0 }) })
  }, [viewDate])

  const dots = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach(t => { if (t.dueDate && !t.completed) m.set(t.dueDate, (m.get(t.dueDate) || 0) + 1) })
    return m
  }, [tasks])

  return (
    <div className="flex flex-col h-full">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
          style={{ color: '#5e5e5e', background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 3 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6e6e6'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5e5e5e'; e.currentTarget.style.background = 'none' }}
        >
          <ChevronLeft size={13} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9b9a97' }}>
          {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button
          onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
          style={{ color: '#5e5e5e', background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 3 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e6e6e6'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5e5e5e'; e.currentTarget.style.background = 'none' }}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {['D','S','T','Q','Q','S','S'].map((d, i) => (
          <div key={i} className="text-center" style={{ fontSize: 10.5, color: '#5e5e5e', fontWeight: 600, padding: '1px 0' }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 flex-1" style={{ gap: 1 }}>
        {days.map(day => {
          const ds = format(day, 'yyyy-MM-dd')
          const hasDot = (dots.get(ds) || 0) > 0
          const sel = isSameDay(day, selected)
          const cur = isSameMonth(day, viewDate)
          const tod = isToday(day)
          return (
            <button key={ds} onClick={() => setSelectedDate(ds)}
              className={`cal-day ${!cur ? 'other-month' : ''} ${sel ? 'selected' : tod ? 'today' : ''}`}
            >
              <span>{format(day, 'd')}</span>
              {hasDot && !sel && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#2383e2', marginTop: 1, opacity: 0.7 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
