// ── vault/persistence.ts ──────────────────────────────────────────────────────
// Central write manager. Each logical "slot" (tasks.day, notes.month, …)
// gets its own 400ms debounce timer so unrelated sections never block each
// other and we never write the same file twice in quick succession.

import { vaultAPI } from './api'
import {
  serializeTasksSection, deserializeTasksSection,
  serializeNotes,        deserializeNotes,
  serializeArchive,      deserializeArchive,
  serializeJournalEntry, deserializeJournalEntry,
  serializeHabits,       deserializeHabits,
  serializeHabitLog,     deserializeHabitLog,
  serializeMoodLog,      deserializeMoodLog,
  serializeMarkdownDoc,  deserializeMarkdownDoc,
  serializeWorkspace,    deserializeWorkspace,
  serializeTop3,         deserializeTop3,
  defaultWorkspace,
} from './format'
import type {
  JournalEntry, Habit, HabitLog, MoodStore, MarkdownDoc,
  PlannerWorkspace, Top3Objective,
} from './format'
import type { Task, AppState } from '../types'

// ── File path map ─────────────────────────────────────────────────────────────

// ── File path map — one key per panel, one .md file per panel ───────────────
export const VAULT_PATHS = {
  tasksDay:    'tasks/hoje.md',
  tasksMonth:  'tasks/mes.md',
  tasksWeek:   'tasks/semana.md',
  tasksBacklog:'tasks/backlog.md',
  archive:     'tasks/arquivo.md',
  notesMonth:  'notas/mes.md',
  notesWeek:   'notas/semana.md',
  habits:      'habitos/definicoes.md',
  habitLog:    'habitos/log.md',
  moodLog:     'humor/log.md',
  config:      '.planner/config.json',
  workspace:   '.planner/workspace.md',
  journalDir:  'diario',
  docsDir:     'docs',
  top3Dir:     'top3',
} as const

// ── Save-state event bus (ultralearn pattern) ─────────────────────────────────
// Components subscribe to know when writes are in-flight vs. settled.
// This mirrors ultralearn's `setSaveState('saving') / setSaveState('saved')` but
// as a shared bus so any debounceWrite call from any panel updates the badge.

export type SaveState = 'idle' | 'saving' | 'saved'
type SaveStateListener = (s: SaveState) => void
const saveStateListeners = new Set<SaveStateListener>()
let savedClearTimer: ReturnType<typeof setTimeout> | null = null

function emitSaveState(s: SaveState) {
  saveStateListeners.forEach(fn => fn(s))
}

export function subscribeSaveState(fn: SaveStateListener): () => void {
  saveStateListeners.add(fn)
  return () => saveStateListeners.delete(fn)
}

// ── Debounced write engine ────────────────────────────────────────────────────

interface PendingWrite { timer: ReturnType<typeof setTimeout>; content: string }
const timers: Map<string, PendingWrite> = new Map()

export function debounceWrite(path: string, content: string, delay = 400) {
  const prev = timers.get(path)
  if (prev) clearTimeout(prev.timer)

  // Signal "saving" immediately so the UI shows feedback before the write fires
  if (savedClearTimer) { clearTimeout(savedClearTimer); savedClearTimer = null }
  emitSaveState('saving')

  timers.set(path, {
    timer: setTimeout(async () => {
      timers.delete(path)
      await vaultAPI.writeFile(path, content)
      // If no more pending writes → transition to 'saved' then back to 'idle'
      if (timers.size === 0) {
        emitSaveState('saved')
        savedClearTimer = setTimeout(() => { emitSaveState('idle'); savedClearTimer = null }, 1800)
      }
    }, delay),
    content,
  })
}

/** Flush all pending writes immediately (async — call on vault switch). */
export async function flushAllPending(): Promise<void> {
  const writes: Array<Promise<boolean>> = []
  timers.forEach(({ timer, content }, path) => {
    clearTimeout(timer)
    timers.delete(path)
    writes.push(vaultAPI.writeFile(path, content))
  })
  await Promise.all(writes)
}

/**
 * Synchronous flush via sendSync IPC — safe to call inside `beforeunload`
 * where async operations are not guaranteed to complete before the page unloads.
 */
export function syncFlushAllPending(): void {
  const entries: Array<{ path: string; content: string }> = []
  timers.forEach(({ timer, content }, path) => {
    clearTimeout(timer)
    timers.delete(path)
    entries.push({ path, content })
  })
  if (entries.length > 0) {
    vaultAPI.syncFlush(entries)
  }
}

// ── Typed write helpers ───────────────────────────────────────────────────────

export function writeTasksSection(section: Task['section'], tasks: Task[]) {
  const path = sectionToPath(section)
  debounceWrite(path, serializeTasksSection(tasks, section))
}

export function writeNotes(scope: 'month' | 'week', content: string) {
  const path = scope === 'month' ? VAULT_PATHS.notesMonth : VAULT_PATHS.notesWeek
  debounceWrite(path, serializeNotes(content, scope))
}

export function writeArchive(tasks: Task[]) {
  debounceWrite(VAULT_PATHS.archive, serializeArchive(tasks))
}

export function writeJournalEntry(entry: JournalEntry) {
  const path = `${VAULT_PATHS.journalDir}/${entry.date}.md`
  debounceWrite(path, serializeJournalEntry(entry), 600)
}

export function writeHabits(habits: Habit[]) {
  debounceWrite(VAULT_PATHS.habits, serializeHabits(habits))
}

export function writeHabitLog(log: HabitLog) {
  debounceWrite(VAULT_PATHS.habitLog, serializeHabitLog(log))
}

export function writeMoodLog(store: MoodStore) {
  debounceWrite(VAULT_PATHS.moodLog, serializeMoodLog(store))
}

export function writeMarkdownDoc(doc: MarkdownDoc) {
  const safeName = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || doc.id
  const path = `${VAULT_PATHS.docsDir}/${doc.id}--${safeName}.md`
  debounceWrite(path, serializeMarkdownDoc(doc), 400)
}

export async function deleteMarkdownDoc(doc: MarkdownDoc) {
  // List files in docs/ and find the one matching this doc id
  const files = await vaultAPI.listFiles(VAULT_PATHS.docsDir)
  const match = files.find(f => f.name.startsWith(doc.id + '--') || f.name === doc.id + '.md')
  if (match) await vaultAPI.deleteFile(match.path)
}

export function writeTop3(date: string, items: Top3Objective[]) {
  const path = `${VAULT_PATHS.top3Dir}/${date}.md`
  debounceWrite(path, serializeTop3(date, items), 400)
}

export async function loadTop3(date: string): Promise<Top3Objective[]> {
  const DEFAULT: Top3Objective[] = [
    { id: 1, text: '', done: false },
    { id: 2, text: '', done: false },
    { id: 3, text: '', done: false },
  ]
  const path = `${VAULT_PATHS.top3Dir}/${date}.md`
  const raw = await vaultAPI.readFile(path)
  if (!raw) return DEFAULT
  return deserializeTop3(raw)
}

export { type Top3Objective }

export function writeWorkspace(ws: PlannerWorkspace) {
  // Debounced — layouts change rapidly during drag, we don't want to hammer disk
  debounceWrite(VAULT_PATHS.workspace, serializeWorkspace({ ...ws, savedAt: new Date().toISOString() }), 600)
}

/** @deprecated use writeWorkspace instead */
export function writeConfig(cfg: Record<string, unknown>) {
  vaultAPI.writeFile(VAULT_PATHS.config, JSON.stringify(cfg, null, 2))
}

export async function loadWorkspace(): Promise<PlannerWorkspace> {
  const raw = await vaultAPI.readFile(VAULT_PATHS.workspace)
  if (!raw) return defaultWorkspace()
  return deserializeWorkspace(raw)
}

// ── Section path lookup ───────────────────────────────────────────────────────

export function sectionToPath(section: Task['section']): string {
  switch (section) {
    case 'day':        return VAULT_PATHS.tasksDay
    case 'month':      return VAULT_PATHS.tasksMonth
    case 'week':       return VAULT_PATHS.tasksWeek
    case 'month-week': return VAULT_PATHS.tasksBacklog
  }
}

export function pathToSection(path: string): Task['section'] | null {
  switch (path) {
    case VAULT_PATHS.tasksDay:    return 'day'
    case VAULT_PATHS.tasksMonth:  return 'month'
    case VAULT_PATHS.tasksWeek:   return 'week'
    case VAULT_PATHS.tasksBacklog:return 'month-week'
    default: return null
  }
}

// ── Bulk load on startup ──────────────────────────────────────────────────────

export interface VaultSnapshot {
  state: AppState
  workspace: PlannerWorkspace
}

export async function loadVaultSnapshot(): Promise<VaultSnapshot> {
  const [
    rawDay, rawMonth, rawWeek, rawBacklog,
    rawArchive, rawMonthNotes, rawWeekNotes,
    rawWorkspace,
  ] = await Promise.all([
    vaultAPI.readFile(VAULT_PATHS.tasksDay),
    vaultAPI.readFile(VAULT_PATHS.tasksMonth),
    vaultAPI.readFile(VAULT_PATHS.tasksWeek),
    vaultAPI.readFile(VAULT_PATHS.tasksBacklog),
    vaultAPI.readFile(VAULT_PATHS.archive),
    vaultAPI.readFile(VAULT_PATHS.notesMonth),
    vaultAPI.readFile(VAULT_PATHS.notesWeek),
    vaultAPI.readFile(VAULT_PATHS.workspace),
  ])

  const tasks: Task[] = [
    ...(rawDay     ? deserializeTasksSection(rawDay)     : []),
    ...(rawMonth   ? deserializeTasksSection(rawMonth)   : []),
    ...(rawWeek    ? deserializeTasksSection(rawWeek)    : []),
    ...(rawBacklog ? deserializeTasksSection(rawBacklog) : []),
  ]

  const archivedTasks = rawArchive ? deserializeArchive(rawArchive) : []
  const monthNotes    = rawMonthNotes ? deserializeNotes(rawMonthNotes) : ''
  const weekNotes     = rawWeekNotes  ? deserializeNotes(rawWeekNotes)  : ''

  const workspace = rawWorkspace ? deserializeWorkspace(rawWorkspace) : defaultWorkspace()

  const state: AppState = {
    tasks,
    archivedTasks,
    monthNotes,
    weekNotes,
    selectedDate:  workspace.selectedDate,
    streakHistory: workspace.streakHistory,
    currentStreak: workspace.currentStreak,
  }

  return { state, workspace }
}

// ── Journal helpers (per-day files) ───────────────────────────────────────────

export async function loadJournalEntry(date: string): Promise<JournalEntry> {
  const path = `${VAULT_PATHS.journalDir}/${date}.md`
  const raw = await vaultAPI.readFile(path)
  if (!raw) return { date, bem: '', melhorar: '', amanha: '' }
  return deserializeJournalEntry(raw, date)
}

export async function loadAllJournalEntries(): Promise<Record<string, JournalEntry>> {
  const files = await vaultAPI.listFiles(VAULT_PATHS.journalDir)
  const entries: Record<string, JournalEntry> = {}
  await Promise.all(
    files
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f.name))
      .map(async f => {
        const date = f.name.replace('.md', '')
        const raw  = await vaultAPI.readFile(f.path)
        if (raw) entries[date] = deserializeJournalEntry(raw, date)
      })
  )
  return entries
}

// ── Habits / Mood / Docs helpers ─────────────────────────────────────────────

export async function loadHabitsAndLog(): Promise<{ habits: Habit[]; log: HabitLog }> {
  const [rawHabits, rawLog] = await Promise.all([
    vaultAPI.readFile(VAULT_PATHS.habits),
    vaultAPI.readFile(VAULT_PATHS.habitLog),
  ])
  return {
    habits: rawHabits ? deserializeHabits(rawHabits) : [],
    log:    rawLog    ? deserializeHabitLog(rawLog)   : {},
  }
}

export async function loadMoodLog(): Promise<MoodStore> {
  const raw = await vaultAPI.readFile(VAULT_PATHS.moodLog)
  return raw ? deserializeMoodLog(raw) : {}
}

export async function loadMarkdownDocs(): Promise<MarkdownDoc[]> {
  const files = await vaultAPI.listFiles(VAULT_PATHS.docsDir)
  const docs: MarkdownDoc[] = []
  await Promise.all(
    files.map(async f => {
      const raw = await vaultAPI.readFile(f.path)
      if (!raw) return
      // id embedded in filename before '--', or derive from name
      const idMatch = f.name.match(/^([^-]+(?:-[^-]+)?)--/)
      const fallbackId = f.name.replace('.md', '')
      const id = idMatch ? idMatch[1] : fallbackId
      docs.push(deserializeMarkdownDoc(raw, id))
    })
  )
  // sort by updatedAt desc
  return docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// ── FS change → section parser ────────────────────────────────────────────────

/** Given a vault-relative path and raw content, return a parsed update payload. */
export function parseExternalChange(
  relPath: string,
  content: string,
): { type: 'tasks'; section: Task['section']; tasks: Task[] }
  | { type: 'notes'; scope: 'month' | 'week'; content: string }
  | { type: 'archive'; tasks: Task[] }
  | { type: 'journal'; entry: JournalEntry }
  | { type: 'habits'; habits: Habit[] }
  | { type: 'habit-log'; log: HabitLog }
  | { type: 'mood-log'; store: MoodStore }
  | { type: 'doc'; doc: MarkdownDoc }
  | null
{
  const section = pathToSection(relPath)
  if (section) return { type: 'tasks', section, tasks: deserializeTasksSection(content) }
  if (relPath === VAULT_PATHS.notesMonth) return { type: 'notes', scope: 'month', content: deserializeNotes(content) }
  if (relPath === VAULT_PATHS.notesWeek)  return { type: 'notes', scope: 'week',  content: deserializeNotes(content) }
  if (relPath === VAULT_PATHS.archive)    return { type: 'archive', tasks: deserializeArchive(content) }
  if (relPath === VAULT_PATHS.habits)     return { type: 'habits', habits: deserializeHabits(content) }
  if (relPath === VAULT_PATHS.habitLog)   return { type: 'habit-log', log: deserializeHabitLog(content) }
  if (relPath === VAULT_PATHS.moodLog)    return { type: 'mood-log', store: deserializeMoodLog(content) }

  const journalMatch = relPath.match(/^diario\/(\d{4}-\d{2}-\d{2})\.md$/)
  if (journalMatch) {
    return { type: 'journal', entry: deserializeJournalEntry(content, journalMatch[1]) }
  }

  const docMatch = relPath.match(/^docs\//)
  if (docMatch) {
    const fileName = relPath.replace('docs/', '').replace('.md', '')
    const idMatch  = fileName.match(/^([^-]+(?:-[^-]+)?)--/)
    const id       = idMatch ? idMatch[1] : fileName
    return { type: 'doc', doc: deserializeMarkdownDoc(content, id) }
  }

  return null
}
