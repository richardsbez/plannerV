import { useTheme } from '../theme'
import { useMemo } from 'react'
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isToday, parseISO, isSameDay } from 'date-fns'
import { useStore } from '../store'

export function WeekView() {
  const t = useTheme()
  const { tasks, selectedDate, setSelectedDate } = useStore()
  const selected = parseISO(selectedDate)

  const weekDays = useMemo(() => {
    const s = startOfWeek(selected, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: s, end: endOfWeek(selected, { weekStartsOn: 0 }) })
  }, [selectedDate])

  const byDay = useMemo(() => {
    const m = new Map<string, typeof tasks>()
    weekDays.forEach(d => { const k = format(d, 'yyyy-MM-dd'); m.set(k, tasks.filter(t => t.dueDate === k)) })
    return m
  }, [tasks, weekDays])

  const names = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {weekDays.map((day, i) => {
        const ds = format(day, 'yyyy-MM-dd')
        const dt = byDay.get(ds) || []
        const tod = isToday(day)
        const sel = isSameDay(day, selected)
        return (
          <div key={ds} onClick={() => setSelectedDate(ds)}
            className={`week-row ${sel ? 'active' : ''}`}
          >
            <div className="flex items-baseline gap-2" style={{ minWidth: 50 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: tod ? t.accent : t.text3 }}>{names[i]}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: tod ? t.accent : sel ? '#e6e6e6' : t.text4, lineHeight: 1 }}>
                {format(day, 'd')}
              </span>
            </div>
            <div className="flex-1 min-w-0" style={{ paddingTop: 3 }}>
              {dt.length === 0
                ? <div style={{ height: 14, borderBottom: '1px dashed #2e2e2e' }} />
                : <div className="flex flex-col gap-0.5">
                    {dt.slice(0, 2).map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 truncate">
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.completed ? t.text4 : t.accent, flexShrink: 0 }} />
                        <span className="truncate" style={{ fontSize: 11, color: t.completed ? t.text4 : t.text2, textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</span>
                      </div>
                    ))}
                    {dt.length > 2 && <span style={{ fontSize: 10, color: t.text3 }}>+{dt.length - 2} mais</span>}
                  </div>
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
