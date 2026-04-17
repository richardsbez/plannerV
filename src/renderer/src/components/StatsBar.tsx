import { useStore } from '../store'
import { useTheme } from '../theme'
import { Archive } from 'lucide-react'

interface Props { onHistory?: () => void }

export function StatsBar({ onHistory }: Props) {
  const { tasks, archivedTasks } = useStore()
  const t = useTheme()
  const total   = tasks.length
  const done    = tasks.filter(t => t.completed).length
  const pct     = total > 0 ? Math.round((done/total)*100) : 0
  const todayStr = new Date().toISOString().slice(0,10)
  const todayDue = tasks.filter(t => t.dueDate===todayStr && !t.completed).length
  const heating  = tasks.filter(t => !t.completed && (Date.now()-new Date(t.createdAt).getTime()) > 3*86400000).length
  const pinned   = tasks.filter(t => t.pinned && !t.completed).length

  const barColor = pct >= 100 ? t.green : pct > 50 ? t.accent : t.border2

  return (
    <div className="flex items-center gap-4 px-4 shrink-0"
      style={{ height: 28, background: t.bg, borderTop: `1px solid ${t.border}`, transition: 'background 0.3s' }}>

      {/* Progress bar */}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:56, height:2, background:t.border2, borderRadius:99, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background:barColor, borderRadius:99, transition:'width 0.5s ease, background 0.5s' }} />
        </div>
        <span style={{ fontSize:10, color:t.text4, fontFamily:'JetBrains Mono, monospace', minWidth:22 }}>{pct}%</span>
      </div>

      <span style={{ fontSize:10, color:t.text4, fontFamily:'JetBrains Mono, monospace' }}>
        <span style={{ color:t.text3 }}>{done}</span>/{total}
      </span>

      {todayDue > 0 && <span style={{ fontSize:10, color:t.amber, fontFamily:'JetBrains Mono, monospace' }}>▲ {todayDue} hoje</span>}
      {heating  > 0 && <span style={{ fontSize:10, color:'#c86030', fontFamily:'JetBrains Mono, monospace' }}>◆ {heating}</span>}
      {pinned   > 0 && <span style={{ fontSize:10, color:t.accent, fontFamily:'JetBrains Mono, monospace', opacity:0.6 }}>📌 {pinned}</span>}

      <span className="ml-auto flex items-center gap-3">
        {archivedTasks.length > 0 && (
          <button onClick={onHistory}
            style={{ fontSize:10, color:t.text4, fontFamily:'JetBrains Mono, monospace', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}
            onMouseEnter={e => (e.currentTarget.style.color=t.text2)}
            onMouseLeave={e => (e.currentTarget.style.color=t.text4)}>
            <Archive size={9} /> {archivedTasks.length} arq.
          </button>
        )}
        <span style={{ fontSize:9.5, color:t.border2, fontFamily:'JetBrains Mono, monospace' }}>v4.0</span>
      </span>
    </div>
  )
}
