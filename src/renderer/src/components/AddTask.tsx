import { useState, useRef } from 'react'
import { Section, Priority, Task } from '../types'
import { useStore } from '../store'
import { Plus } from 'lucide-react'

interface Props { section: Section; matrixQuadrant?: Task['matrixQuadrant']; placeholder?: string; defaultPriority?: Priority }

export function AddTask({ section, matrixQuadrant, placeholder = 'Adicionar tarefa', defaultPriority = 'normal' }: Props) {
  const { addTask } = useStore()
  const [active, setActive] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const submit = () => {
    if (title.trim()) {
      addTask({ title: title.trim(), section, matrixQuadrant, priority: defaultPriority, dueDate: dueDate || undefined })
      setTitle(''); setDueDate('')
      ref.current?.focus()
    } else setActive(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') { setActive(false); setTitle(''); setDueDate('') }
  }

  if (!active) return (
    <button
      onClick={() => { setActive(true); setTimeout(() => ref.current?.focus(), 50) }}
      className="flex items-center gap-2 w-full px-3 py-1.5 transition-colors text-left rounded mx-1"
      style={{
        color: '#5e5e5e', fontSize: 13, fontFamily: 'Inter, sans-serif',
        background: 'transparent', border: 'none', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#9b9a97'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#5e5e5e'; e.currentTarget.style.background = 'transparent' }}
    >
      <Plus size={13} />
      {placeholder}
    </button>
  )

  return (
    <div className="mx-2 my-1 fade-in" style={{ background: '#2a2a2a', border: '1px solid #3e3e3e', borderRadius: 6, padding: '8px 10px' }}>
      <input
        ref={ref} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={onKey}
        onBlur={() => { if (!title.trim()) setActive(false) }}
        placeholder="Nome da tarefa..." className="add-input" autoFocus
      />
      <div className="flex items-center gap-2 mt-2">
        <input
          type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: '#5e5e5e', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
        />
        <div className="flex gap-1.5 ml-auto">
          <button onMouseDown={e => { e.preventDefault(); setActive(false); setTitle(''); setDueDate('') }} className="btn">Cancelar</button>
          <button onMouseDown={e => { e.preventDefault(); submit() }} className="btn primary">Adicionar</button>
        </div>
      </div>
    </div>
  )
}
