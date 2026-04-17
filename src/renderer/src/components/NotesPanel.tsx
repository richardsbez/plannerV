import { useTheme } from '../theme'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props { value: string; onChange: (v: string) => void; placeholder?: string }

export function NotesPanel({ value, onChange, placeholder = 'Escreva notas em markdown...' }: Props) {
  const t = useTheme()
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex justify-end mb-1.5">
        <button onClick={() => setEditing(e => !e)} className="btn" style={{ fontSize: 11 }}>
          {editing ? 'Preview' : 'Editar'}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {editing
          ? <textarea autoFocus value={value} onChange={e => onChange(e.target.value)}
              placeholder={placeholder} className="md-area w-full min-h-[80px]" />
          : <div className="cursor-pointer min-h-[40px]" onClick={() => setEditing(true)}>
              {value
                ? <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown></div>
                : <p style={{ fontSize: 12, color: t.text3, fontStyle: 'italic' }}>{placeholder}</p>
              }
            </div>
        }
      </div>
    </div>
  )
}
