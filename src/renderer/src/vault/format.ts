// ── vault/format.ts ────────────────────────────────────────────────────────────
//
// Obsidian-compatible Markdown serializer / deserializer.
//
// Design principles:
//   1. ONE FILE PER PANEL — each logical panel maps to exactly one .md file.
//      Writes are atomic: the entire file is replaced in a single writeFile call.
//   2. STANDARD OBSIDIAN FRONTMATTER — every file starts with a YAML block
//      delimited by `---` containing: tags, aliases, created, modified, cssclass,
//      plus panel-specific metadata. Compatible with Obsidian Dataview plugin.
//   3. HUMAN-READABLE BODY — the Markdown body below the frontmatter is legible
//      when opened in any editor. Tasks render as GFM checkboxes with inline
//      Dataview fields. Notes/Journal/Docs are pure prose.
//   4. MACHINE-READABLE DATA IN FRONTMATTER — full structured data is stored
//      in YAML so the app can round-trip without parsing the body. The body is
//      a derived, read-only view.
//
// Vault directory layout (Obsidian-compatible):
//
//   vault/
//   ├── .planner/
//   │   └── workspace.md        ← UI state: layouts, theme, visibility, streak
//   ├── tasks/
//   │   ├── hoje.md             ← Panel: Tarefas de Hoje
//   │   ├── semana.md           ← Panel: Tarefas da Semana
//   │   ├── mes.md              ← Panel: Tarefas do Mês
//   │   ├── backlog.md          ← Panel: Backlog (Mês/Semana)
//   │   └── arquivo.md          ← Panel: Arquivo
//   ├── notas/
//   │   ├── mes.md              ← Panel: Notas do Mês
//   │   └── semana.md           ← Panel: Notas da Semana
//   ├── diario/
//   │   └── YYYY-MM-DD.md       ← Panel: Diário (one per day)
//   ├── habitos/
//   │   ├── definicoes.md       ← Panel: Hábitos (definitions)
//   │   └── log.md              ← Panel: Hábitos (daily completion log)
//   ├── humor/
//   │   └── log.md              ← Panel: Humor
//   ├── docs/
//   │   └── {id}--{slug}.md     ← Panel: Documentos
//   └── top3/
//       └── YYYY-MM-DD.md       ← Panel: Top 3 do Dia

import type { Task } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// § 1  YAML serializer  (no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function needsQuoting(s: string): boolean {
  if (s === '') return true
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return true
  if (/^\d/.test(s) || /^[-.]/.test(s)) return true
  if (/[:#\[\]{},&*?|<>=!%@`"']/.test(s)) return true
  if (s.startsWith(' ') || s.endsWith(' ')) return true
  return false
}

function yamlScalar(s: string, indent: string): string {
  if (s.includes('\n')) {
    const lines = s.split('\n').map(l => `${indent}  ${l}`)
    return `|\n${lines.join('\n')}`
  }
  if (needsQuoting(s)) return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return s
}

function toYaml(val: unknown, indent = ''): string {
  if (val === null || val === undefined) return '~'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return yamlScalar(val, indent)

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]'
    if (
      val.length <= 5 &&
      val.every(v => typeof v === 'string' && v.length < 32 && !v.includes('\n'))
    ) {
      return `[${val.map(v => yamlScalar(v as string, indent)).join(', ')}]`
    }
    return '\n' + val
      .map(v => `${indent}- ${toYaml(v, indent + '  ')}`)
      .join('\n')
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    )
    if (entries.length === 0) return '{}'
    return '\n' + entries
      .map(([k, v]) => {
        const rendered = toYaml(v, indent + '  ')
        const inline = rendered.startsWith('\n') || rendered.startsWith('|')
        return `${indent}${k}:${inline ? rendered : ' ' + rendered}`
      })
      .join('\n')
  }
  return String(val)
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2  YAML parser  (subset)
// ─────────────────────────────────────────────────────────────────────────────

function parseScalar(raw: string): unknown {
  const s = raw.trim()
  if (s === '~' || s === 'null') return null
  if (s === 'true'  || s === 'yes' || s === 'on')  return true
  if (s === 'false' || s === 'no'  || s === 'off') return false
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s)
  if ((s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'")) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }
  return s
}

function indentOf(line: string): number {
  let i = 0
  while (i < line.length && line[i] === ' ') i++
  return i
}

function parseYamlBlock(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue }

    const indent = indentOf(line)
    const colonAt = line.indexOf(': ', indent)
    const endsColon = line.trimEnd().endsWith(':')

    if (colonAt === -1 && !endsColon) { i++; continue }

    const keyEnd = endsColon && colonAt === -1 ? line.trimEnd().length - 1 : colonAt
    const key = line.slice(indent, keyEnd).trim()
    const inlineVal = colonAt !== -1 ? line.slice(colonAt + 2).trim() : ''
    i++

    if (inlineVal === '|' || inlineVal === '>') {
      const blockLines: string[] = []
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > indent)) {
        blockLines.push(lines[i].slice(indent + 2))
        i++
      }
      result[key] = blockLines.join('\n').replace(/\n$/, '')
      continue
    }

    if (inlineVal !== '' && inlineVal !== '[]' && inlineVal !== '{}') {
      if (inlineVal.startsWith('[')) {
        const inner = inlineVal.slice(1, inlineVal.lastIndexOf(']'))
        result[key] = inner === ''
          ? []
          : inner.split(',').map(s => parseScalar(s.trim()))
        continue
      }
      result[key] = parseScalar(inlineVal)
      continue
    }
    if (inlineVal === '[]') { result[key] = []; continue }
    if (inlineVal === '{}') { result[key] = {}; continue }

    const childLines: string[] = []
    while (i < lines.length) {
      const cl = lines[i]
      if (cl.trim() === '') { childLines.push(cl); i++; continue }
      if (indentOf(cl) <= indent) break
      childLines.push(cl)
      i++
    }
    // Detect list: if ANY non-empty child line starts with '- ', it's a list.
    // Using every() was wrong — multi-line list items have nested object lines
    // that don't start with '- ', causing the block to be parsed as an object.
    if (childLines.some(l => l.trim() !== '' && l.trimStart().startsWith('- '))) {
      result[key] = parseList(childLines)
    } else {
      result[key] = parseYamlBlock(childLines.join('\n'))
    }
  }
  return result
}

function parseList(lines: string[]): unknown[] {
  const items: unknown[] = []
  const base = lines.find(l => l.trim() !== '')
  if (!base) return items
  const baseIndent = indentOf(base)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }
    if (indentOf(line) < baseIndent) break
    const stripped = line.trimStart()
    if (!stripped.startsWith('- ')) { i++; continue }
    const rest = stripped.slice(2).trim()
    i++

    if (rest === '' || rest === '|') {
      const subLines: string[] = []
      while (i < lines.length) {
        const sl = lines[i]
        if (sl.trim() === '') { i++; continue }
        if (indentOf(sl) <= baseIndent) break
        subLines.push(sl)
        i++
      }
      if (subLines.some(l => l.trimStart().startsWith('- '))) {
        items.push(parseList(subLines))
      } else {
        items.push(parseYamlBlock(subLines.join('\n')))
      }
    } else if (rest.includes(': ') || rest.trimEnd().endsWith(':')) {
      const subLines = [' '.repeat(baseIndent + 2) + rest]
      while (i < lines.length) {
        const sl = lines[i]
        if (sl.trim() === '') { i++; continue }
        if (indentOf(sl) <= baseIndent) break
        subLines.push(sl)
        i++
      }
      items.push(parseYamlBlock(subLines.join('\n')))
    } else {
      items.push(parseScalar(rest))
    }
  }
  return items
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  Frontmatter helpers
// ─────────────────────────────────────────────────────────────────────────────

export function parseFrontmatter(raw: string): {
  meta: Record<string, unknown>
  body: string
} {
  if (!raw.startsWith('---')) return { meta: {}, body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { meta: {}, body: raw }
  const yamlBlock = raw.slice(4, end)
  const body = raw.slice(end + 4).replace(/^\n/, '')
  try {
    return { meta: parseYamlBlock(yamlBlock), body }
  } catch {
    return { meta: {}, body: raw }
  }
}

export function buildFrontmatter(
  meta: Record<string, unknown>,
  body = '',
): string {
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const rendered = toYaml(v, '  ')
      const inline = rendered.startsWith('\n') || rendered.startsWith('|')
      return `${k}:${inline ? rendered : ' ' + rendered}`
    })
    .join('\n')
  return `---\n${lines}\n---\n\n${body}`
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4  Base Obsidian frontmatter fields
// ─────────────────────────────────────────────────────────────────────────────

interface BaseMeta {
  tags:     string[]
  aliases:  string[]
  cssclass: string
  created:  string
  modified: string
  [key: string]: unknown
}

function baseMeta(
  tags:             string[],
  alias:            string,
  cssclass:         string,
  existingCreated?: string,
): BaseMeta {
  const now = new Date().toISOString()
  return {
    tags,
    aliases:  [alias],
    cssclass,
    created:  existingCreated ?? now,
    modified: now,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5  Tasks  (tasks/hoje.md · semana.md · mes.md · backlog.md)
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_LABEL: Record<string, string> = {
  day:          'Tarefas de Hoje',
  week:         'Tarefas da Semana',
  month:        'Tarefas do Mês',
  'month-week': 'Backlog (Mês / Semana)',
}

const SECTION_TAG: Record<string, string> = {
  day:          'planner/tasks/hoje',
  week:         'planner/tasks/semana',
  month:        'planner/tasks/mes',
  'month-week': 'planner/tasks/backlog',
}

function taskToCheckbox(t: Task): string {
  const check = t.completed ? 'x' : ' '
  const fields: string[] = [`[id:: ${t.id}]`]
  if (t.priority && t.priority !== 'normal') fields.push(`[priority:: ${t.priority}]`)
  if (t.dueDate)        fields.push(`[due:: ${t.dueDate}]`)
  if (t.scheduledTime)  fields.push(`[time:: ${t.scheduledTime}]`)
  if (t.energy)         fields.push(`[energy:: ${t.energy}]`)
  if (t.tags?.length)   fields.push(`[tags:: ${t.tags.join(', ')}]`)
  if (t.matrixQuadrant) fields.push(`[matrix:: ${t.matrixQuadrant}]`)
  if (t.timerMinutes)   fields.push(`[timer:: ${t.timerMinutes}min]`)
  if (t.pinned)         fields.push(`[pinned:: true]`)
  if (t.completed && t.completedAt) fields.push(`[completed:: ${t.completedAt}]`)
  const meta = fields.join(' ')
  const notes = t.notes
    ? `\n  > ${t.notes.replace(/\n/g, '\n  > ')}`
    : ''
  return `- [${check}] ${t.title} ${meta}${notes}`
}

export function serializeTasksSection(tasks: Task[], section: string): string {
  const label = SECTION_LABEL[section] ?? section
  const tag   = SECTION_TAG[section]   ?? `planner/tasks/${section}`

  const pending   = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  const renderGroup = (items: Task[]) =>
    items.length ? items.map(taskToCheckbox).join('\n') : '_Nenhuma tarefa._'

  const body = [
    `# ${label}`,
    '',
    '## ⏳ Pendentes',
    '',
    renderGroup(pending),
    '',
    '## ✅ Concluídas',
    '',
    renderGroup(completed),
    '',
    '---',
    '_Este arquivo é gerenciado automaticamente pelo Planner._',
    '_Edições externas são detectadas e sincronizadas em tempo real._',
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta([tag, 'planner/tasks'], label, 'planner-tasks'),
      type:    'planner-tasks',
      section,
      pending: pending.length,
      done:    completed.length,
      tasks:   tasks as unknown as Record<string, unknown>[],
    },
    body,
  )
}

export function deserializeTasksSection(content: string): Task[] {
  const { meta } = parseFrontmatter(content)
  if (!Array.isArray(meta.tasks)) return []
  return meta.tasks as unknown as Task[]
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6  Archive  (tasks/arquivo.md)
// ─────────────────────────────────────────────────────────────────────────────

export function serializeArchive(tasks: Task[]): string {
  const byMonth: Record<string, Task[]> = {}
  for (const t of tasks) {
    const month = (t.completedAt ?? t.updatedAt ?? '').slice(0, 7) || 'desconhecido'
    ;(byMonth[month] ??= []).push(t)
  }

  const sections = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, ts]) =>
      [
        `## 📅 ${month}`,
        '',
        ...ts.map(t =>
          `- [x] ${t.title} [id:: ${t.id}][archived:: ${t.completedAt?.slice(0, 10) ?? '?'}]`
        ),
      ].join('\n')
    )

  const body = [
    '# 🗄️ Arquivo de Tarefas',
    '',
    tasks.length === 0
      ? '> Nenhuma tarefa arquivada ainda.'
      : sections.join('\n\n'),
    '',
    '---',
    '_Tarefas concluídas há mais de 24h são movidas aqui automaticamente._',
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(['planner/arquivo', 'planner/tasks'], 'Arquivo', 'planner-archive'),
      type:  'planner-archive',
      count: tasks.length,
      tasks: tasks as unknown as Record<string, unknown>[],
    },
    body,
  )
}

export function deserializeArchive(content: string): Task[] {
  const { meta } = parseFrontmatter(content)
  if (!Array.isArray(meta.tasks)) return []
  return meta.tasks as unknown as Task[]
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7  Notes  (notas/mes.md · notas/semana.md)
// ─────────────────────────────────────────────────────────────────────────────

export function serializeNotes(content: string, scope: 'month' | 'week'): string {
  const labels = { month: 'Notas do Mês', week: 'Notas da Semana' }
  const label  = labels[scope]
  return buildFrontmatter(
    {
      ...baseMeta([`planner/notas/${scope}`, 'planner/notas'], label, 'planner-notes'),
      type:  'planner-notes',
      scope,
    },
    content,
  )
}

export function deserializeNotes(content: string): string {
  const { body } = parseFrontmatter(content)
  return body
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8  Journal  (diario/YYYY-MM-DD.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  date:     string
  bem:      string
  melhorar: string
  amanha:   string
}

export function serializeJournalEntry(entry: JournalEntry): string {
  const body = [
    `# 📓 Diário — ${entry.date}`,
    '',
    '## 🌟 O que foi bem',
    '',
    entry.bem || '_Nada registrado._',
    '',
    '## 🔧 O que melhorar',
    '',
    entry.melhorar || '_Nada registrado._',
    '',
    '## 🎯 Prioridade para amanhã',
    '',
    entry.amanha || '_Nada registrado._',
    '',
    '---',
    `_Entrada de ${entry.date} — gerenciada pelo Planner._`,
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(
        ['planner/diario', `planner/diario/${entry.date}`],
        `Diário ${entry.date}`,
        'planner-journal',
      ),
      type:     'planner-journal',
      date:     entry.date,
      bem:      entry.bem      || '',
      melhorar: entry.melhorar || '',
      amanha:   entry.amanha   || '',
    },
    body,
  )
}

export function deserializeJournalEntry(content: string, date: string): JournalEntry {
  const { meta, body } = parseFrontmatter(content)

  if (
    typeof meta.bem      === 'string' ||
    typeof meta.melhorar === 'string' ||
    typeof meta.amanha   === 'string'
  ) {
    return {
      date:     (meta.date as string) || date,
      bem:      String(meta.bem      ?? ''),
      melhorar: String(meta.melhorar ?? ''),
      amanha:   String(meta.amanha   ?? ''),
    }
  }

  // Fallback: parse H2 sections from body (hand-edited files)
  const sections: Record<string, string> = {}
  let current = ''
  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      current = line.slice(3).trim()
      sections[current] = ''
    } else if (current) {
      sections[current] = (sections[current] + '\n' + line).trimStart()
    }
  }

  const clean = (s: string) =>
    s.trim() === '_Nada registrado._' ? '' : s.trim()

  return {
    date,
    bem:      clean(sections['🌟 O que foi bem']          ?? sections['O que foi bem']        ?? ''),
    melhorar: clean(sections['🔧 O que melhorar']         ?? sections['O que melhorar']       ?? ''),
    amanha:   clean(sections['🎯 Prioridade para amanhã'] ?? sections['Prioridade amanhã']    ?? ''),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9  Habits  (habitos/definicoes.md · habitos/log.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface Habit {
  id:     string
  name:   string
  color:  string
  symbol: string
}

export type HabitLog = Record<string, string[]>

export function serializeHabits(habits: Habit[]): string {
  const rows = habits.length
    ? habits.map(h => `| ${h.symbol} | ${h.name} | \`${h.id}\` | ${h.color} |`).join('\n')
    : '| — | Nenhum hábito definido | — | — |'

  const body = [
    '# 🔁 Hábitos',
    '',
    '| Símbolo | Nome | ID | Cor |',
    '|---------|------|----|-----|',
    rows,
    '',
    '---',
    '_Gerencie hábitos pelo painel do Planner._',
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(['planner/habitos'], 'Hábitos', 'planner-habits'),
      type:   'planner-habits',
      count:  habits.length,
      habits: habits as unknown as Record<string, unknown>[],
    },
    body,
  )
}

export function deserializeHabits(content: string): Habit[] {
  const { meta } = parseFrontmatter(content)
  if (!Array.isArray(meta.habits)) return []
  return meta.habits as unknown as Habit[]
}

export function serializeHabitLog(log: HabitLog): string {
  const entries = Object.entries(log).sort(([a], [b]) => b.localeCompare(a))

  const rows = entries.length
    ? entries.map(([date, ids]) => `| ${date} | ${ids.join(', ')} |`).join('\n')
    : '| — | Nenhum registro |'

  const body = [
    '# 📊 Log de Hábitos',
    '',
    '| Data | Hábitos concluídos |',
    '|------|--------------------|',
    rows,
    '',
    '---',
    '_Registro diário gerado automaticamente pelo Planner._',
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(['planner/habitos/log'], 'Log de Hábitos', 'planner-habit-log'),
      type: 'planner-habit-log',
      log:  log as unknown as Record<string, unknown>,
    },
    body,
  )
}

export function deserializeHabitLog(content: string): HabitLog {
  const { meta } = parseFrontmatter(content)
  if (!meta.log || typeof meta.log !== 'object' || Array.isArray(meta.log)) return {}
  const raw = meta.log as Record<string, unknown>
  const out: HabitLog = {}
  for (const [date, val] of Object.entries(raw)) {
    out[date] = Array.isArray(val) ? (val as string[]) : []
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10  Mood  (humor/log.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface MoodEntry {
  date:   string
  mood:   number
  energy: number
  note:   string
}
export type MoodStore = Record<string, MoodEntry>

const MOOD_EMOJI  = ['😞', '😕', '😐', '🙂', '😄']
const ENERGY_BAR  = (n: number) =>
  '█'.repeat(Math.round(n / 2)) + '░'.repeat(5 - Math.round(n / 2))

export function serializeMoodLog(store: MoodStore): string {
  const entries = Object.entries(store).sort(([a], [b]) => b.localeCompare(a))

  const rows = entries.length
    ? entries
        .map(([date, e]) =>
          `| ${date} | ${MOOD_EMOJI[Math.min(4, Math.max(0, e.mood - 1))]} ${e.mood}/5` +
          ` | ${ENERGY_BAR(e.energy)} ${e.energy}/10 | ${e.note || '—'} |`
        )
        .join('\n')
    : '| — | — | — | — |'

  const body = [
    '# 💭 Log de Humor',
    '',
    '| Data | Humor | Energia | Nota |',
    '|------|-------|---------|------|',
    rows,
    '',
    '---',
    '_Registro diário de bem-estar gerado pelo Planner._',
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(['planner/humor'], 'Log de Humor', 'planner-mood'),
      type: 'planner-mood',
      log:  store as unknown as Record<string, unknown>,
    },
    body,
  )
}

export function deserializeMoodLog(content: string): MoodStore {
  const { meta } = parseFrontmatter(content)
  if (!meta.log || typeof meta.log !== 'object' || Array.isArray(meta.log)) return {}
  return meta.log as unknown as MoodStore
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11  Markdown docs  (docs/{id}--{slug}.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface MarkdownDoc {
  id:        string
  title:     string
  content:   string
  updatedAt: string
}

export function serializeMarkdownDoc(doc: MarkdownDoc): string {
  const slug = doc.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || doc.id

  const body = doc.content.startsWith('# ')
    ? doc.content
    : `# ${doc.title}\n\n${doc.content}`

  return buildFrontmatter(
    {
      ...baseMeta(['planner/docs'], doc.title, 'planner-doc', doc.updatedAt),
      type:  'planner-doc',
      id:    doc.id,
      title: doc.title,
      slug,
    },
    body,
  )
}

export function deserializeMarkdownDoc(content: string, fallbackId: string): MarkdownDoc {
  const { meta, body } = parseFrontmatter(content)
  return {
    id:        (meta.id       as string) || fallbackId,
    title:     (meta.title    as string) || 'Sem título',
    content:   body,
    updatedAt: (meta.modified as string) || (meta.created as string) || new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12  Top 3  (top3/YYYY-MM-DD.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface Top3Objective {
  id:   number
  text: string
  done: boolean
}

export function serializeTop3(date: string, items: Top3Objective[]): string {
  const doneCount = items.filter(o => o.done && o.text).length
  const total     = items.filter(o => o.text).length
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const checkboxes = items
    .map(o => `- [${o.done ? 'x' : ' '}] **${o.id}º** ${o.text || '_em branco_'}`)
    .join('\n')

  const body = [
    `# 🏆 Top 3 — ${date}`,
    '',
    `> Progresso: ${doneCount}/${total} (${pct}%)`,
    '',
    checkboxes,
    '',
    '---',
    `_Objetivos do dia ${date}. Resetado automaticamente à meia-noite._`,
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(
        [`planner/top3/${date}`, 'planner/top3'],
        `Top 3 — ${date}`,
        'planner-top3',
      ),
      type:     'planner-top3',
      date,
      progress: `${doneCount}/${total}`,
      items:    items as unknown as Record<string, unknown>[],
    },
    body,
  )
}

export function deserializeTop3(content: string): Top3Objective[] {
  const DEFAULT: Top3Objective[] = [
    { id: 1, text: '', done: false },
    { id: 2, text: '', done: false },
    { id: 3, text: '', done: false },
  ]
  const { meta } = parseFrontmatter(content)
  if (!Array.isArray(meta.items) || meta.items.length !== 3) return DEFAULT
  return meta.items as unknown as Top3Objective[]
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13  Workspace  (.planner/workspace.md)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceLayout {
  id:     string
  x:      number
  y:      number
  w:      number
  h:      number
  zIndex: number
}

export interface PlannerWorkspace {
  theme:         'dark' | 'light'
  visible:       string[]
  layouts:       Record<string, WorkspaceLayout>
  streakHistory: Array<{ date: string; top3Completed: boolean }>
  currentStreak: number
  selectedDate:  string
  savedAt:       string
}

export function defaultWorkspace(): PlannerWorkspace {
  return {
    theme:         'dark',
    visible:       ['month-week', 'today', 'calendar', 'week', 'matrix', 'insights', 'notes'],
    layouts:       {},
    streakHistory: [],
    currentStreak: 0,
    selectedDate:  new Date().toISOString().split('T')[0],
    savedAt:       new Date().toISOString(),
  }
}

export function serializeWorkspace(ws: PlannerWorkspace): string {
  const layoutRows = Object.keys(ws.layouts).length > 0
    ? Object.entries(ws.layouts)
        .map(([id, l]) =>
          `| ${id.padEnd(22)} | ${String(l.x).padStart(4)} | ${String(l.y).padStart(4)} | ${String(l.w).padStart(4)} | ${String(l.h).padStart(4)} | ${String(l.zIndex).padStart(2)} |`
        )
        .join('\n')
    : '| —                      |    — |    — |    — |    — |  — |'

  const streakRows = ws.streakHistory.length > 0
    ? ws.streakHistory
        .slice(-14)
        .map(r => `| ${r.date} | ${r.top3Completed ? '✅' : '⬜'} |`)
        .join('\n')
    : '| — | — |'

  const body = [
    '# ⚙️ Workspace do Planner',
    '',
    '> ⚠️ Este arquivo é gerenciado automaticamente. Edições manuais serão sobrescritas.',
    '',
    `**Tema:** ${ws.theme}  `,
    `**Sequência atual:** ${ws.currentStreak} dias  `,
    `**Data selecionada:** ${ws.selectedDate}  `,
    `**Salvo em:** ${ws.savedAt}  `,
    '',
    '## Painéis visíveis',
    '',
    ws.visible.map(v => `- \`${v}\``).join('\n'),
    '',
    '## Layout dos painéis',
    '',
    '| Painel                   |    x |    y |    w |    h |  z |',
    '|--------------------------|------|------|------|------|-----|',
    layoutRows,
    '',
    '## Histórico de sequência (últimos 14 dias)',
    '',
    '| Data       | Top 3 |',
    '|------------|-------|',
    streakRows,
  ].join('\n')

  return buildFrontmatter(
    {
      ...baseMeta(
        ['planner/workspace'],
        'Workspace do Planner',
        'planner-workspace',
        ws.savedAt,
      ),
      type:          'planner-workspace',
      theme:         ws.theme,
      visible:       ws.visible,
      currentStreak: ws.currentStreak,
      selectedDate:  ws.selectedDate,
      savedAt:       ws.savedAt,
      layouts:       ws.layouts       as unknown as Record<string, unknown>,
      streakHistory: ws.streakHistory as unknown as Record<string, unknown>[],
    },
    body,
  )
}

export function deserializeWorkspace(content: string): PlannerWorkspace {
  const { meta } = parseFrontmatter(content)
  const def = defaultWorkspace()

  let layouts: Record<string, WorkspaceLayout> = {}
  if (
    meta.layouts &&
    typeof meta.layouts === 'object' &&
    !Array.isArray(meta.layouts)
  ) {
    for (const [id, raw] of Object.entries(
      meta.layouts as Record<string, unknown>,
    )) {
      const r = raw as Record<string, unknown>
      if (r && typeof r.x === 'number') {
        layouts[id] = {
          id,
          x:      r.x      as number,
          y:      r.y      as number,
          w:      r.w      as number,
          h:      r.h      as number,
          zIndex: (r.zIndex as number) ?? 1,
        }
      }
    }
  }

  return {
    theme:         (meta.theme as 'dark' | 'light') ?? def.theme,
    visible:       Array.isArray(meta.visible) ? (meta.visible as string[]) : def.visible,
    layouts,
    streakHistory: Array.isArray(meta.streakHistory)
      ? (meta.streakHistory as Array<{ date: string; top3Completed: boolean }>)
      : [],
    currentStreak: (meta.currentStreak as number) ?? 0,
    selectedDate:  (meta.selectedDate  as string) ?? def.selectedDate,
    savedAt:       (meta.savedAt       as string) ?? def.savedAt,
  }
}
