// ── store/index.ts ────────────────────────────────────────────────────────────
// Zustand store — in-memory state + vault-backed persistence.
// Each mutation writes only the affected section file, not the whole snapshot.

import { create } from 'zustand'
import { Task, AppState, Section, Priority } from '../types'
import {
  writeTasksSection,
  writeNotes,
  writeArchive,
  loadVaultSnapshot,
} from '../vault/persistence'
import { vaultAPI, vaultStore } from '../vault/api'

const genId = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// ── Workspace save notification ───────────────────────────────────────────────
// App.tsx registers this so streak/selectedDate changes trigger a vault write.
type WorkspaceSaveFn = (streakHistory: unknown[], currentStreak: number, selectedDate: string) => void
let _workspaceSaveFn: WorkspaceSaveFn | null = null
export function registerWorkspaceSaver(fn: WorkspaceSaveFn) { _workspaceSaveFn = fn }
function notifyWorkspaceSave(streakHistory: unknown[], currentStreak: number, selectedDate: string) {
  _workspaceSaveFn?.(streakHistory, currentStreak, selectedDate)
}

// ── Store interface ───────────────────────────────────────────────────────────

interface Store extends AppState {
  addTask: (p: {
    title: string; notes?: string; note?: string; section: Section
    matrixQuadrant?: Task['matrixQuadrant']; priority?: Priority; dueDate?: string
    tags?: string[]; scheduledTime?: string; timerMinutes?: number; completed?: boolean
    pinned?: boolean; energy?: Task['energy']
  }) => void
  updateTask:         (id: string, updates: Partial<Task>) => void
  deleteTask:         (id: string) => void
  toggleTask:         (id: string) => void
  boomSection:        (section: Section, matrixQuadrant?: Task['matrixQuadrant']) => string[]
  archiveOldCompleted:() => void
  restoreTask:        (id: string) => void
  clearHistory:       () => void
  setMonthNotes:      (n: string) => void
  setWeekNotes:       (n: string) => void
  setSelectedDate:    (d: string) => void
  loadState:          (s: AppState) => void
  reorderTasks:       (section: Section, from: number, to: number) => void
  moveTaskToMatrix:   (id: string, q: Task['matrixQuadrant']) => void
  pinTask:            (id: string) => void
  updateStreak:       () => void
  // Vault-specific: merge tasks for a section (from external FS change)
  mergeTasksSection:  (section: Section, tasks: Task[]) => void
  mergeNotes:         (scope: 'month' | 'week', content: string) => void
  mergeArchive:       (tasks: Task[]) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tasksForSection(allTasks: Task[], section: Section): Task[] {
  return allTasks.filter(t => t.section === section)
}

/** Write every section that is affected by a task change. */
function persistSections(tasks: Task[], changedSections: Set<Section>) {
  changedSections.forEach(section => {
    writeTasksSection(section, tasksForSection(tasks, section))
  })
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<Store>((set, get) => ({
  tasks: [],
  archivedTasks: [],
  monthNotes: '',
  weekNotes: '',
  selectedDate: new Date().toISOString().split('T')[0],
  streakHistory: [],
  currentStreak: 0,

  addTask: ({ title, notes = '', note, section, matrixQuadrant, priority = 'normal',
              dueDate, tags = [], scheduledTime, timerMinutes, completed = false,
              pinned = false, energy }) => {
    const now  = new Date().toISOString()
    const task: Task = {
      id: genId(), title, notes, note, completed, priority, section,
      matrixQuadrant, dueDate, tags, scheduledTime, timerMinutes,
      completedAt: completed ? now : undefined,
      pinned, energy, createdAt: now, updatedAt: now,
    }
    set(s => {
      const tasks = [...s.tasks, task]
      writeTasksSection(section, tasksForSection(tasks, section))
      return { ...s, tasks }
    })
  },

  updateTask: (id, updates) =>
    set(s => {
      const original = s.tasks.find(t => t.id === id)
      const tasks = s.tasks.map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      )
      const sections = new Set<Section>()
      if (original) sections.add(original.section)
      if (updates.section) sections.add(updates.section)
      persistSections(tasks, sections)
      return { ...s, tasks }
    }),

  deleteTask: (id) =>
    set(s => {
      const task = s.tasks.find(t => t.id === id)
      const tasks = s.tasks.filter(t => t.id !== id)
      if (task) writeTasksSection(task.section, tasksForSection(tasks, task.section))
      return { ...s, tasks }
    }),

  toggleTask: (id) =>
    set(s => {
      const now = new Date().toISOString()
      const tasks = s.tasks.map(t =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : undefined, updatedAt: now }
          : t
      )
      const section = s.tasks.find(t => t.id === id)?.section
      if (section) writeTasksSection(section, tasksForSection(tasks, section))
      return { ...s, tasks }
    }),

  boomSection: (section, matrixQuadrant) => {
    const { tasks } = get()
    const toDelete = matrixQuadrant
      ? tasks.filter(t => t.matrixQuadrant === matrixQuadrant && t.completed)
      : tasks.filter(t => t.section === section && t.completed)
    const ids = toDelete.map(t => t.id)
    set(s => {
      const next = s.tasks.filter(t => !ids.includes(t.id))
      writeTasksSection(section, tasksForSection(next, section))
      return { ...s, tasks: next }
    })
    return ids
  },

  archiveOldCompleted: () =>
    set(s => {
      const cutoff    = Date.now() - 24 * 60 * 60 * 1000
      const toArchive = s.tasks.filter(
        t => t.completed && t.completedAt && new Date(t.completedAt).getTime() < cutoff
      )
      if (toArchive.length === 0) return s
      const ids          = new Set(toArchive.map(t => t.id))
      const tasks        = s.tasks.filter(t => !ids.has(t.id))
      const archivedTasks = [
        ...s.archivedTasks,
        ...toArchive.map(t => ({ ...t, archived: true })),
      ]
      // Write changed sections
      const sections = new Set(toArchive.map(t => t.section))
      persistSections(tasks, sections)
      writeArchive(archivedTasks)
      return { ...s, tasks, archivedTasks }
    }),

  restoreTask: (id) =>
    set(s => {
      const task = s.archivedTasks.find(t => t.id === id)
      if (!task) return s
      const archivedTasks = s.archivedTasks.filter(t => t.id !== id)
      const tasks = [...s.tasks, { ...task, archived: false, completed: false, completedAt: undefined }]
      writeTasksSection(task.section, tasksForSection(tasks, task.section))
      writeArchive(archivedTasks)
      return { ...s, tasks, archivedTasks }
    }),

  clearHistory: () =>
    set(s => {
      writeArchive([])
      return { ...s, archivedTasks: [] }
    }),

  setMonthNotes: (monthNotes) =>
    set(s => { writeNotes('month', monthNotes); return { ...s, monthNotes } }),

  setWeekNotes: (weekNotes) =>
    set(s => { writeNotes('week', weekNotes); return { ...s, weekNotes } }),

  setSelectedDate: (selectedDate) => set(s => {
    notifyWorkspaceSave(s.streakHistory ?? [], s.currentStreak ?? 0, selectedDate)
    return { ...s, selectedDate }
  }),

  loadState: (loadedState) => set({
    ...loadedState,
    archivedTasks: loadedState.archivedTasks || [],
    streakHistory: loadedState.streakHistory || [],
    currentStreak: loadedState.currentStreak || 0,
  }),

  reorderTasks: (section, from, to) =>
    set(s => {
      const sec  = s.tasks.filter(t => t.section === section)
      const rest = s.tasks.filter(t => t.section !== section)
      const [moved] = sec.splice(from, 1)
      sec.splice(to, 0, moved)
      const tasks = [...rest, ...sec]
      writeTasksSection(section, sec)
      return { ...s, tasks }
    }),

  moveTaskToMatrix: (id, q) =>
    set(s => {
      const tasks = s.tasks.map(t =>
        t.id === id ? { ...t, matrixQuadrant: q, updatedAt: new Date().toISOString() } : t
      )
      const section = s.tasks.find(t => t.id === id)?.section
      if (section) writeTasksSection(section, tasksForSection(tasks, section))
      return { ...s, tasks }
    }),

  pinTask: (id) =>
    set(s => {
      const tasks = s.tasks.map(t =>
        t.id === id ? { ...t, pinned: !t.pinned, updatedAt: new Date().toISOString() } : t
      )
      const section = s.tasks.find(t => t.id === id)?.section
      if (section) writeTasksSection(section, tasksForSection(tasks, section))
      return { ...s, tasks }
    }),

  updateStreak: () =>
    set(s => {
      const today    = new Date().toISOString().split('T')[0]
      const dayTasks = s.tasks.filter(t => t.section === 'day' && t.completed)
      const completedToday = dayTasks.filter(t => t.completedAt?.startsWith(today)).length

      const existing   = s.streakHistory?.find(r => r.date === today)
      let newHistory   = [...(s.streakHistory || [])]

      if (!existing) {
        newHistory.push({ date: today, top3Completed: completedToday >= 3 })
      } else {
        newHistory = newHistory.map(r =>
          r.date === today ? { ...r, top3Completed: completedToday >= 3 } : r
        )
      }

      let streak = 0
      const checkDate = new Date()
      while (streak < 365) {
        const ds  = checkDate.toISOString().split('T')[0]
        const rec = newHistory.find(r => r.date === ds)
        if (rec?.top3Completed) { streak++; checkDate.setDate(checkDate.getDate() - 1) }
        else break
      }

      notifyWorkspaceSave(newHistory, streak, s.selectedDate)
      return { ...s, streakHistory: newHistory, currentStreak: streak }
    }),

  // ── Vault-specific merges (from external FS watch) ────────────────────────

  mergeTasksSection: (section, incomingTasks) =>
    set(s => {
      // Replace all tasks of this section, keep others untouched
      const otherTasks = s.tasks.filter(t => t.section !== section)
      return { ...s, tasks: [...otherTasks, ...incomingTasks] }
    }),

  mergeNotes: (scope, content) =>
    set(s => scope === 'month' ? { ...s, monthNotes: content } : { ...s, weekNotes: content }),

  mergeArchive: (tasks) =>
    set(s => ({ ...s, archivedTasks: tasks })),
}))

// ── Startup: load vault snapshot ──────────────────────────────────────────────

export const loadInitialData = async () => {
  try {
    // Only load from vault if one is selected
    const vaultPath = vaultStore.getPath() ?? await vaultAPI.get()
    if (vaultPath) {
      vaultStore.setPath(vaultPath)
      const { state } = await loadVaultSnapshot()
      useStore.getState().loadState(state)
    }
  } catch (e) {
    console.error('loadInitialData:', e)
  }
}
