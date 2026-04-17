import { useState, useCallback } from 'react'
import { TaskItem } from './TaskItem'
import { SmartInput } from './SmartInput'
import { Task, Section } from '../types'
import { useStore } from '../store'
import { useTheme } from '../theme'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  section:        Section
  tasks:          Task[]
  onFocusTask?:   (task: Task) => void
  matrixQuadrant?: Task['matrixQuadrant']
  boomingIds?:    string[]
  onBoom?:        () => void
  onFocusMode?:   () => void
  onShowMatrix?:  () => void
  onEditMode?:    () => void
  onSaveLayout?:  () => void
}

const BOOM_CHARS = ['*','·','°','✦','•','∘','⊹','×','+']

export function TaskList({ section, tasks, onFocusTask, matrixQuadrant, boomingIds=[], onBoom, onFocusMode, onShowMatrix, onEditMode, onSaveLayout }: Props) {
  const { reorderTasks, boomSection } = useStore()
  const t = useTheme()
  const [dragIdx,      setDragIdx]      = useState<number|null>(null)
  const [overIdx,      setOverIdx]      = useState<number|null>(null)
  const [showDone,     setShowDone]     = useState(false)
  const [boomParticles,setBoomParticles]= useState<{id:number;x:number;y:number;char:string;dx:number;dy:number}[]>([])
  const [explodingIds, setExplodingIds] = useState<Set<string>>(new Set())

  const sorted = [...tasks].sort((a,b) => (a.pinned&&!b.pinned)?-1:(!a.pinned&&b.pinned)?1:0)
  const active = sorted.filter(t => !t.completed)
  const done   = sorted.filter(t =>  t.completed)

  const handleDrop = (to: number) => {
    if (dragIdx!==null && dragIdx!==to) reorderTasks(section, dragIdx, to)
    setDragIdx(null); setOverIdx(null)
  }

  const triggerBoom = useCallback(() => {
    const ids = tasks.filter(t => t.completed).map(t => t.id)
    if (!ids.length) return
    const particles = Array.from({length:18},(_,i) => ({
      id:i, x:20+Math.random()*200, y:10+Math.random()*50,
      char:BOOM_CHARS[Math.floor(Math.random()*BOOM_CHARS.length)],
      dx:(Math.random()-0.5)*100, dy:-(Math.random()*70+20),
    }))
    setBoomParticles(particles)
    setExplodingIds(new Set(ids))
    setTimeout(() => {
      boomSection(section, matrixQuadrant)
      setExplodingIds(new Set()); setBoomParticles([])
      onBoom?.()
    }, 650)
  }, [tasks, boomSection, section, matrixQuadrant, onBoom])

  return (
    <div style={{ position:'relative', display:'flex', flexDirection:'column' }}>
      {/* Particles */}
      {boomParticles.length>0 && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:80, pointerEvents:'none', zIndex:100, overflow:'visible' }}>
          {boomParticles.map(p => (
            <span key={p.id} style={{ position:'absolute', left:p.x, top:p.y, fontFamily:'JetBrains Mono, monospace', fontSize:10, color:t.text3, animation:'boom-particle 0.65s ease-out forwards', '--dx':`${p.dx}px`, '--dy':`${p.dy}px` } as any}>{p.char}</span>
          ))}
        </div>
      )}

      {/* Active */}
      {active.map((task,i) => (
        <div key={task.id}
          onDragOver={e=>{e.preventDefault();setOverIdx(i)}}
          onDrop={()=>handleDrop(i)}
          style={{ borderTop: overIdx===i&&dragIdx!==i ? `1.5px solid ${t.accent}` : '1.5px solid transparent', transition:'border-color 0.1s' }}>
          <TaskItem task={task}
            onDragStart={()=>setDragIdx(i)}
            onDragEnd={()=>{setDragIdx(null);setOverIdx(null)}}
            onFocus={onFocusTask}
            exploding={explodingIds.has(task.id)} />
        </div>
      ))}

      {/* Input */}
      <SmartInput section={section} matrixQuadrant={matrixQuadrant}
        onBoom={triggerBoom} onFocusMode={onFocusMode} onShowMatrix={onShowMatrix}
        onEditMode={onEditMode} onSaveLayout={onSaveLayout} />

      {/* Completed */}
      {done.length>0 && (
        <div style={{ marginTop:2 }}>
          <button onClick={()=>setShowDone(s=>!s)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 12px', width:'100%', textAlign:'left', fontSize:10.5, color:t.text4, fontFamily:'Inter, sans-serif', background:'transparent', border:'none', cursor:'pointer' }}
            onMouseEnter={e=>(e.currentTarget.style.color=t.text3)}
            onMouseLeave={e=>(e.currentTarget.style.color=t.text4)}>
            {showDone ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
            {done.length} concluída{done.length>1?'s':''} · /boom para limpar
          </button>
          {showDone && done.map(t=>(
            <TaskItem key={t.id} task={t} onFocus={onFocusTask} exploding={explodingIds.has(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
