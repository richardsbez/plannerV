import { useState, useRef, useEffect } from 'react'
import { Section, Task } from '../types'
import { useStore } from '../store'
import { useTheme } from '../theme'

// ── Parser ────────────────────────────────────────────────────────────────────
interface ParsedTask { type:'task'; title:string; note?:string; completed:boolean; toggle:boolean; tags:string[]; scheduledTime?:string; timerMinutes?:number; energy?:'high'|'low'|'medium' }
interface ParsedBoom   { type:'boom' }
interface ParsedClear  { type:'clear' }
interface ParsedFocus  { type:'focus' }
interface ParsedMatrix { type:'matrix' }
interface ParsedPin    { type:'pin'; title:string }
interface ParsedMood   { type:'mood'; level:string }
interface ParsedEdit   { type:'edit' }
interface ParsedSave   { type:'save' }
type Parsed = ParsedTask|ParsedBoom|ParsedClear|ParsedFocus|ParsedMatrix|ParsedPin|ParsedMood|ParsedEdit|ParsedSave|null

function parseDuration(s: string): number|undefined {
  const m = s.trim().match(/^(?:(\d+)h)?(?:(\d+)m)?$/)
  if (!m || (!m[1] && !m[2])) return undefined
  return (parseInt(m[1]||'0') * 60) + parseInt(m[2]||'0')
}

export function parseSmartLine(raw: string): Parsed {
  const line = raw.trim()
  if (!line) return null
  if (line === '/boom')   return { type:'boom' }
  if (line === '/clear')  return { type:'clear' }
  if (line === '/focus')  return { type:'focus' }
  if (line === '/matrix') return { type:'matrix' }
  if (line === '/edit')   return { type:'edit' }
  if (line === '/save')   return { type:'save' }
  if (line.startsWith('/pin ')) return { type:'pin', title: line.slice(5).trim() }
  const moodMatch = line.match(/^\/mood\s+([\w🔥💪😴🧠]+)$/)
  if (moodMatch) return { type:'mood', level: moodMatch[1] }

  const match = line.match(/^\[(x| |)\]\s*(.*)$/i)
  if (!match) return null

  const isX    = match[1].toLowerCase() === 'x'
  const rest   = match[2].trim()
  const tags:string[] = []
  let cleaned = rest.replace(/#(\w+)/g, (_,t) => { tags.push(t.toLowerCase()); return '' }).trim()

  let energy: 'high'|'low'|'medium'|undefined
  cleaned = cleaned.replace(/!!(high|low|medium)/i, (_,e) => { energy = e.toLowerCase() as any; return '' }).trim()

  let scheduledTime: string|undefined
  cleaned = cleaned.replace(/@(\d{1,2}:\d{2})/, (_,t) => { scheduledTime = t; return '' }).trim()

  let timerMinutes: number|undefined
  cleaned = cleaned.replace(/@(\d+[hm][0-9hm]*)/, (_,d) => {
    const dur = parseDuration(d); if (dur) timerMinutes = dur; return ''
  }).trim()

  const di = cleaned.indexOf(' - ')
  let title = cleaned, note: string|undefined
  if (di !== -1) {
    title = cleaned.slice(0, di).trim()
    const rawNote = cleaned.slice(di+3).trim()
    const dur = parseDuration(rawNote)
    if (dur && dur > 0) return { type:'task', title, completed:isX, toggle:isX||match[1]===' ', tags, scheduledTime, timerMinutes:dur, energy }
    note = rawNote || undefined
  }

  return { type:'task', title, note, completed:isX, toggle:isX||(match[1]===' '), tags, scheduledTime, timerMinutes, energy }
}

// ── Colors ────────────────────────────────────────────────────────────────────
export const TAG_COLORS: Record<string,string> = {
  work:'#2383e2', home:'#0f7b6c', personal:'#9b59b6',
  health:'#e03e3e', learning:'#dfab01', urgent:'#e05a2b', fun:'#2b9e6c',
}
export function tagColor(tag:string) { return TAG_COLORS[tag]||'#5e5e5e' }

export function heatColor(createdAt:string, completed:boolean): string|undefined {
  if (completed) return undefined
  const days = (Date.now()-new Date(createdAt).getTime())/86400000
  if (days<1.5) return undefined
  if (days<2.5) return '#d4c060'
  if (days<3.5) return '#d49040'
  if (days<5)   return '#c86030'
  return '#c04020'
}

function buildHint(p:Parsed): string {
  if (!p) return ''
  if (p.type==='boom')   return '💥 apagar concluídas com fade'
  if (p.type==='clear')  return '🗑 limpar tudo'
  if (p.type==='focus')  return '🎯 modo deep work'
  if (p.type==='matrix') return '⊞ abrir matriz completa'
  if (p.type==='edit')   return '◈ entrar no modo edição de layout'
  if (p.type==='save')   return '✓ salvar e sair da edição'
  if (p.type==='pin')    return `📌 fixar: ${p.title}`
  if (p.type==='mood')   return `🧠 humor: ${p.level}`
  const parts:string[] = []
  if (p.completed)   parts.push('✓ marcar feita')
  if (p.timerMinutes) parts.push(`⏱ ${p.timerMinutes}min`)
  if (p.scheduledTime) parts.push(`🕐 ${p.scheduledTime} → alerta -5min`)
  if (p.tags.length)  parts.push(p.tags.map(x=>`#${x}`).join(' '))
  if (p.note)         parts.push(`📝 "${p.note}"`)
  if (p.energy)       parts.push(`⚡ energia ${p.energy}`)
  return parts.join(' · ')
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  section: Section
  matrixQuadrant?: Task['matrixQuadrant']
  onBoom?: () => void
  onFocusMode?: () => void
  onShowMatrix?: () => void
  onEditMode?: () => void
  onSaveLayout?: () => void
  placeholder?: string
}

export function SmartInput({ section, matrixQuadrant, onBoom, onFocusMode, onShowMatrix, onEditMode, onSaveLayout, placeholder }: Props) {
  const { addTask, tasks, updateTask, pinTask } = useStore()
  const t = useTheme()
  const [value, setValue] = useState('')
  const [hint,  setHint]  = useState('')
  const [preview, setPreview] = useState<ParsedTask|null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const ph = placeholder ?? '[] tarefa  ·  /focus  ·  /edit  ·  /boom  ·  @14:30  ·  @60m'

  useEffect(() => {
    if (!value) { setHint(''); setPreview(null); return }
    const p = parseSmartLine(value)
    setHint(buildHint(p))
    setPreview(p?.type === 'task' && p.title ? p : null)
  }, [value])

  const submit = () => {
    const p = parseSmartLine(value)
    if (!p) return
    setValue(''); setHint(''); setPreview(null)

    if (p.type==='boom')   { onBoom?.(); return }
    if (p.type==='clear')  return
    if (p.type==='focus')  { onFocusMode?.(); return }
    if (p.type==='matrix') { onShowMatrix?.(); return }
    if (p.type==='edit')   { onEditMode?.(); return }
    if (p.type==='save')   { onSaveLayout?.(); return }
    if (p.type==='pin') {
      const found = tasks.find(t => t.section===section && t.title.toLowerCase().includes(p.title.toLowerCase()))
      if (found) pinTask(found.id)
      return
    }
    if (p.type==='mood') return

    if (p.toggle && p.title) {
      const ex = tasks.find(t => t.section===section && t.title.toLowerCase().includes(p.title.toLowerCase()))
      if (ex) { updateTask(ex.id, { completed:p.completed, completedAt: p.completed ? new Date().toISOString() : undefined }); return }
    }

    addTask({ title:p.title, note:p.note, notes:'', section, matrixQuadrant, tags:p.tags, scheduledTime:p.scheduledTime, timerMinutes:p.timerMinutes, completed:p.completed, energy:p.energy } as any)
  }

  return (
    <div style={{ padding: '4px 8px 6px', borderTop: `1px solid ${t.border}` }}>

      {/* Live preview */}
      {preview && (
        <div className="live-preview" style={{
          margin: '0 0 4px', padding: '5px 10px', borderRadius: 4,
          background: t.accentBg, border: `1px solid rgba(35,131,226,0.15)`,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, border: `1.5px solid ${t.border2}`, borderRadius: 3, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: t.text, fontFamily: 'Inter, sans-serif' }}>{preview.title}</span>
            {preview.tags.map(tag => (
              <span key={tag} style={{ fontSize: 9.5, color: tagColor(tag), fontFamily: 'JetBrains Mono, monospace' }}>#{tag}</span>
            ))}
            {preview.timerMinutes && <span style={{ fontSize: 9.5, color: t.accent, fontFamily: 'JetBrains Mono, monospace' }}>⏱{preview.timerMinutes}m</span>}
            {preview.scheduledTime && <span style={{ fontSize: 9.5, color: t.amber, fontFamily: 'JetBrains Mono, monospace' }}>@{preview.scheduledTime}</span>}
          </div>
          {preview.note && (
            <div style={{ fontSize: 11, color: t.text3, fontStyle: 'italic', paddingLeft: 18, fontFamily: 'Inter, sans-serif', opacity: 0.7 }}>
              {preview.note}
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', borderRadius: 5,
        background: t.inputBg,
        border: `1px solid transparent`,
        transition: 'border-color 0.15s',
      }}
        onFocus={e => (e.currentTarget.style.borderColor = `rgba(35,131,226,0.3)`)}
        onBlur={e  => (e.currentTarget.style.borderColor = 'transparent')}>
        <span style={{ color: t.accent, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', userSelect: 'none', opacity: 0.5 }}>›</span>
        <input ref={ref} value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key==='Enter') submit()
            if (e.key==='Escape') { setValue(''); ref.current?.blur() }
            if (e.key==='Tab' && !value.startsWith('[')) { e.preventDefault(); setValue('[] ') }
          }}
          placeholder={ph}
          style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:'JetBrains Mono, monospace', fontSize:11.5, color:t.text2, letterSpacing:'0.01em' }}
        />
      </div>

      {hint && (
        <div style={{ fontSize:10, color:t.text4, paddingLeft:22, marginTop:3, fontFamily:'JetBrains Mono, monospace', animation:'hintFade 0.15s ease-out' }}>
          → {hint}
        </div>
      )}
    </div>
  )
}
