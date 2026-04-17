import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Trash2, ChevronDown, ChevronUp, Check, X, Pin } from 'lucide-react'
import { Task } from '../types'
import { useStore } from '../store'
import { tagColor, heatColor } from './SmartInput'
import { CountdownTimer } from './CountdownTimer'
import { useTheme } from '../theme'

interface Props {
  task: Task
  onDragStart?: () => void
  onDragEnd?: () => void
  onFocus?: (task: Task) => void
  exploding?: boolean
}

const ENERGY_LABELS: Record<string, { label: string; cls: string }> = {
  high:   { label: '⚡ alta',   cls: 'energy-high' },
  medium: { label: '◎ média',  cls: 'energy-medium' },
  low:    { label: '○ baixa',  cls: 'energy-low' },
}

export function TaskItem({ task, onDragStart, onDragEnd, onFocus, exploding }: Props) {
  const { toggleTask, deleteTask, updateTask, pinTask } = useStore()
  const thm = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [editNotes, setEditNotes] = useState(false)
  const [titleVal, setTitleVal] = useState(task.title)
  const [notesVal, setNotesVal] = useState(task.notes)
  const [timeAlert, setTimeAlert] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveTitle = () => { if (titleVal.trim()) updateTask(task.id, { title: titleVal.trim() }); setEditTitle(false) }
  const saveNotes = () => { updateTask(task.id, { notes: notesVal }); setEditNotes(false) }

  // Scheduled time alert: warn 5 min before
  useEffect(() => {
    if (!task.scheduledTime || task.completed) return
    const check = () => {
      const now = new Date()
      const [h, m] = task.scheduledTime!.split(':').map(Number)
      const diff = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes())
      setTimeAlert(diff >= 0 && diff <= 5)
    }
    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  }, [task.scheduledTime, task.completed])

  const heat = heatColor(task.createdAt, task.completed)
  const ghostOpacity = task.completed ? 0.25 : 1

  const handleToggle = () => {
    if (!task.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 500)
    }
    toggleTask(task.id)
  }

  const handleMouseDown = () => {
    holdRef.current = setTimeout(() => { onFocus?.(task) }, 600)
  }
  const handleMouseUp = () => { if (holdRef.current) clearTimeout(holdRef.current) }

  const energy = task.energy ? ENERGY_LABELS[task.energy] : null

  return (
    <div
      className={`group task-row fade-in ${exploding ? 'boom-exploding' : ''} ${justCompleted ? 'task-just-completed' : ''} ${task.pinned ? 'task-pinned' : ''}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        opacity: ghostOpacity,
        transition: 'opacity 0.4s ease, background 0.12s',
        borderLeft: task.pinned
          ? '2px solid rgba(35,131,226,0.4)'
          : timeAlert
          ? '2px solid rgba(223,171,1,0.6)'
          : '2px solid transparent',
        background: timeAlert ? 'rgba(223,171,1,0.03)' : undefined,
      }}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={handleToggle}
        className="task-cb"
        style={{ marginTop: 3 }}
      />

      <div className="flex-1 min-w-0" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
        {editTitle ? (
          <div className="flex items-center gap-1.5">
            <input autoFocus value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') { setEditTitle(false); setTitleVal(task.title) }
              }}
              onBlur={saveTitle}
              className="flex-1 bg-transparent outline-none"
              style={{ borderBottom: '1px solid #2383e2', color: thm.text, fontFamily: 'Inter, sans-serif', fontSize: 13.5 }}
            />
            <button onClick={saveTitle}><Check size={11} style={{ color: thm.accent }} /></button>
            <button onClick={() => { setEditTitle(false); setTitleVal(task.title) }}><X size={11} style={{ color: thm.text3 }} /></button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
            {/* Pin indicator */}
            {task.pinned && (
              <span style={{ fontSize: 9, color: 'rgba(35,131,226,0.5)', marginTop: 1 }} title="Fixada">📌</span>
            )}

            <span
              className={task.completed ? 'line-through' : ''}
              style={{
                fontSize: 13.5,
                color: heat ?? (task.completed ? '#3e3e3e' : '#e0e0e0'),
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
                lineHeight: 1.4,
                transition: 'color 0.3s ease',
                fontWeight: task.pinned ? 500 : 400,
              }}
              onDoubleClick={() => setEditTitle(true)}
              title="Duplo-clique para editar · segure para foco"
            >
              {task.title}
            </span>

            {/* Tags */}
            {task.tags?.length > 0 && task.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, color: tagColor(tag), fontFamily: 'JetBrains Mono, monospace',
                background: `${tagColor(tag)}12`, padding: '1px 5px', borderRadius: 3,
              }}>
                #{tag}
              </span>
            ))}

            {/* Scheduled time */}
            {task.scheduledTime && (
              <span style={{
                fontSize: 10,
                color: timeAlert ? '#dfab01' : '#333',
                fontFamily: 'JetBrains Mono, monospace',
                animation: timeAlert ? 'pulse-amber 1s ease infinite' : 'none',
              }}>
                @{task.scheduledTime}{timeAlert ? ' ⚡' : ''}
              </span>
            )}

            {/* Energy badge */}
            {energy && !task.completed && (
              <span className={energy.cls} style={{
                fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace',
                padding: '1px 5px', borderRadius: 3,
              }}>
                {energy.label}
              </span>
            )}
          </div>
        )}

        {/* Inline note — italic, 50% opacity */}
        {task.note && (
          <div style={{
            fontSize: 11.5,
            color: thm.text3,
            marginTop: 2,
            lineHeight: 1.45,
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'italic',
            paddingLeft: 1,
          }}>
            {task.note}
          </div>
        )}

        {/* Due date */}
        {task.dueDate && (
          <span style={{ display: 'block', fontSize: 10.5, color: '#3e3e3e', marginTop: 1 }}>
            {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}

        {/* Heat aging indicator */}
        {heat && !task.completed && (
          <div style={{ fontSize: 9.5, color: heat, fontFamily: 'JetBrains Mono, monospace', marginTop: 1, opacity: 0.7 }}>
            ⚠ envelhecendo
          </div>
        )}

        {/* Inline timer */}
        {task.timerMinutes && !task.completed && (
          <div style={{ marginTop: 4 }}>
            <CountdownTimer minutes={task.timerMinutes} compact />
          </div>
        )}

        {/* Expanded notes */}
        {expanded && (
          <div className="mt-2 fade-in">
            {editNotes ? (
              <div style={{ background: thm.bg2, border: `1px solid ${thm.border}`, padding: 10, borderRadius: 4 }}>
                <textarea autoFocus value={notesVal} onChange={e => setNotesVal(e.target.value)}
                  rows={5} placeholder="Notas em markdown..." className="md-area w-full" />
                <div className="flex gap-2 mt-2 justify-end">
                  <button onClick={() => { setEditNotes(false); setNotesVal(task.notes) }} className="btn">Cancelar</button>
                  <button onClick={saveNotes} className="btn primary">Salvar</button>
                </div>
              </div>
            ) : (
              <div
                style={{ background: thm.bg, border: `1px solid ${thm.border}`, borderLeft: `2px solid ${thm.accent}`, padding: '7px 11px', cursor: 'pointer', borderRadius: 4 }}
                onClick={() => setEditNotes(true)}
              >
                {task.notes
                  ? <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{task.notes}</ReactMarkdown></div>
                  : <p style={{ fontSize: 12, color: thm.text4, fontStyle: 'italic' }}>Clique para adicionar notas longas...</p>
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Pin */}
        <button onClick={() => pinTask(task.id)} className="p-0.5 rounded" title="Fixar/desafixar"
          style={{ color: task.pinned ? 'rgba(35,131,226,0.6)' : '#2e2e2e', fontSize: 10 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#2383e2')}
          onMouseLeave={e => (e.currentTarget.style.color = task.pinned ? 'rgba(35,131,226,0.6)' : '#2e2e2e')}>
          <Pin size={11} />
        </button>
        {/* Focus */}
        <button onClick={() => onFocus?.(task)} className="p-0.5 rounded" title="Modo foco"
          style={{ color: thm.text4, fontSize: 10 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9b9a97')}
          onMouseLeave={e => (e.currentTarget.style.color = '#2e2e2e')}>
          ⊙
        </button>
        {/* Expand notes */}
        <button onClick={() => setExpanded(e => !e)} className="p-0.5 rounded" style={{ color: thm.text4 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9b9a97')}
          onMouseLeave={e => (e.currentTarget.style.color = '#2e2e2e')}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {/* Delete */}
        <button onClick={() => deleteTask(task.id)} className="p-0.5 rounded" style={{ color: thm.text4 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e03e3e')}
          onMouseLeave={e => (e.currentTarget.style.color = '#2e2e2e')}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
