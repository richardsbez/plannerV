// ── MarkdownPanel.tsx ─────────────────────────────────────────────────────────
// Full markdown editor — each document saved as docs/{id}--{slug}.md in vault.

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from '../theme'
import { vaultStore } from '../vault/api'
import {
  loadMarkdownDocs, writeMarkdownDoc, deleteMarkdownDoc,
} from '../vault/persistence'
import type { MarkdownDoc } from '../vault/format'
import { subscribeToExternalChanges } from './VaultSelector'

function newDoc(): MarkdownDoc {
  return { id: `doc_${Date.now()}`, title: 'Sem título', content: '', updatedAt: new Date().toISOString() }
}

type ViewMode = 'write' | 'preview' | 'split'

export function MarkdownPanel() {
  const t         = useTheme()
  const vaultPath = vaultStore.getPath()

  const [docs,         setDocs]         = useState<MarkdownDoc[]>([])
  const [activeId,     setActiveId]     = useState<string>('')
  const [mode,         setMode]         = useState<ViewMode>('write')
  const [editingTitle, setEditingTitle] = useState(false)
  const titleRef    = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load docs from vault ───────────────────────────────────────────────────
  useEffect(() => {
    if (!vaultPath) return
    loadMarkdownDocs().then(loaded => {
      if (loaded.length === 0) {
        const d = newDoc()
        setDocs([d])
        setActiveId(d.id)
        writeMarkdownDoc(d)
      } else {
        setDocs(loaded)
        setActiveId(loaded[0].id)
      }
    })
  }, [vaultPath])

  // ── External FS watch ──────────────────────────────────────────────────────
  useEffect(() => {
    return subscribeToExternalChanges(parsed => {
      if (!parsed || parsed.type !== 'doc') return
      const { doc } = parsed
      setDocs(prev => {
        const exists = prev.find(d => d.id === doc.id)
        return exists
          ? prev.map(d => d.id === doc.id ? doc : d)
          : [doc, ...prev]
      })
    })
  }, [])

  // Ensure activeId stays valid
  useEffect(() => {
    if (docs.length && !docs.find(d => d.id === activeId)) {
      setActiveId(docs[0].id)
    }
  }, [docs, activeId])

  const active = docs.find(d => d.id === activeId) ?? docs[0]

  // ── Mutations (debounced via persistence layer) ────────────────────────────
  const update = (patch: Partial<MarkdownDoc>) => {
    setDocs(prev => {
      const next = prev.map(d => {
        if (d.id !== activeId) return d
        const updated = { ...d, ...patch, updatedAt: new Date().toISOString() }
        writeMarkdownDoc(updated)
        return updated
      })
      return next
    })
  }

  const addDoc = () => {
    const d = newDoc()
    setDocs(prev => [...prev, d])
    setActiveId(d.id)
    setMode('write')
    writeMarkdownDoc(d)
    setTimeout(() => setEditingTitle(true), 50)
  }

  const deleteDoc = async (id: string) => {
    const doc = docs.find(d => d.id === id)
    if (doc) await deleteMarkdownDoc(doc)
    setDocs(prev => {
      const next = prev.filter(d => d.id !== id)
      if (next.length === 0) { const d = newDoc(); writeMarkdownDoc(d); return [d] }
      return next
    })
    if (activeId === id) {
      setActiveId(docs.find(d => d.id !== id)?.id ?? '')
    }
  }

  const wordCount = active?.content.trim().split(/\s+/).filter(Boolean).length ?? 0
  const lineCount = active?.content.split('\n').length ?? 0

  const ModeBtn = ({ m, label }: { m: ViewMode; label: string }) => (
    <button onClick={() => setMode(m)} style={{
      fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace',
      padding: '1px 7px', borderRadius: 3,
      border: `1px solid ${mode === m ? t.accent : t.border}`,
      background: mode === m ? t.accentBg : 'transparent',
      color: mode === m ? t.accent : t.text4,
      cursor: 'pointer', transition: 'all 0.12s',
    }}>{label}</button>
  )

  if (!active) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Doc tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 1,
        padding: '4px 8px 0', borderBottom: `1px solid ${t.border}`,
        overflowX: 'auto', flexShrink: 0, background: t.bg,
      }}>
        {docs.map(d => (
          <div key={d.id}
            onClick={() => setActiveId(d.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: '4px 4px 0 0', cursor: 'pointer',
              background: d.id === activeId ? t.bg1 : 'transparent',
              border: d.id === activeId ? `1px solid ${t.border}` : '1px solid transparent',
              borderBottom: d.id === activeId ? `1px solid ${t.bg1}` : `1px solid transparent`,
              marginBottom: d.id === activeId ? -1 : 0,
              transition: 'all 0.1s',
            }}>
            <span style={{ fontSize: 11, color: d.id === activeId ? t.text : t.text4, whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.title}
            </span>
            {docs.length > 1 && (
              <span onClick={e => { e.stopPropagation(); deleteDoc(d.id) }}
                style={{ fontSize: 10, color: t.text4, cursor: 'pointer', lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = t.red)}
                onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>×</span>
            )}
          </div>
        ))}
        <button onClick={addDoc} style={{
          fontSize: 13, color: t.text4, background: 'none', border: 'none',
          cursor: 'pointer', padding: '2px 8px', lineHeight: 1, borderRadius: 4,
          transition: 'color 0.1s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = t.accent)}
          onMouseLeave={e => (e.currentTarget.style.color = t.text4)}>+</button>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderBottom: `1px solid ${t.border}`,
        flexShrink: 0, background: t.bg1,
      }}>
        {editingTitle ? (
          <input ref={titleRef} autoFocus
            value={active.title}
            onChange={e => update({ title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              borderBottom: `1px solid ${t.accent}`, outline: 'none',
              fontSize: 12, fontWeight: 600, color: t.text, fontFamily: 'Inter, sans-serif',
            }}
          />
        ) : (
          <span onDoubleClick={() => setEditingTitle(true)}
            style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.text2, cursor: 'text' }}
            title="Duplo-clique para renomear">
            {active.title}
          </span>
        )}

        <div style={{ display: 'flex', gap: 2 }}>
          <ModeBtn m="write"   label="✏" />
          <ModeBtn m="split"   label="⊟" />
          <ModeBtn m="preview" label="👁" />
        </div>

        <span style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
          {wordCount}w · {lineCount}l
        </span>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {(mode === 'write' || mode === 'split') && (
          <textarea
            ref={textareaRef}
            value={active.content}
            onChange={e => update({ content: e.target.value })}
            placeholder={'# Título\n\nComece a escrever em **markdown**...\n\n- item 1\n- item 2\n\n> citação'}
            style={{
              flex: 1, height: '100%', padding: '12px 14px',
              background: t.bg1, border: 'none',
              borderRight: mode === 'split' ? `1px solid ${t.border}` : 'none',
              outline: 'none', resize: 'none',
              fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, lineHeight: 1.75,
              color: t.text2, transition: 'background 0.3s',
            }}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const el = e.currentTarget
                const s = el.selectionStart, en = el.selectionEnd
                const next = el.value.slice(0, s) + '  ' + el.value.slice(en)
                update({ content: next })
                setTimeout(() => { el.selectionStart = el.selectionEnd = s + 2 }, 0)
              }
            }}
          />
        )}

        {(mode === 'preview' || mode === 'split') && (
          <div style={{
            flex: 1, height: '100%', overflowY: 'auto',
            padding: '14px 16px', background: t.bg1,
          }}>
            {active.content ? (
              <div className="markdown-content md-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content}</ReactMarkdown>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: t.text4, fontStyle: 'italic', fontFamily: 'Inter, sans-serif' }}>
                Nada para visualizar ainda...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '3px 10px', borderTop: `1px solid ${t.border}`,
        background: t.bg, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
          {new Date(active.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ fontSize: 9, color: t.border2, fontFamily: 'JetBrains Mono, monospace' }}>
          {active.content.length} chars
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: vaultPath ? t.green : t.text4, fontFamily: 'JetBrains Mono, monospace' }}>
          {vaultPath ? '⬤ vault' : '⬤ sem cofre'}
        </span>
      </div>
    </div>
  )
}
