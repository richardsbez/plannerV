export type Priority = 'urgent-important' | 'important' | 'urgent' | 'normal'
export type Section = 'month-week' | 'day' | 'month' | 'week'
export type TagColor = 'work' | 'home' | 'personal' | 'health' | 'learning' | 'default'

export interface Task {
  id: string
  title: string
  notes: string
  note?: string
  completed: boolean
  priority: Priority
  section: Section
  matrixQuadrant?: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  dueDate?: string
  tags: string[]
  scheduledTime?: string
  timerMinutes?: number
  completedAt?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
  pinned?: boolean
  energy?: 'high' | 'low' | 'medium'
}

export interface StreakRecord {
  date: string
  top3Completed: boolean
}

export interface AppState {
  tasks: Task[]
  archivedTasks: Task[]
  monthNotes: string
  weekNotes: string
  selectedDate: string
  streakHistory?: StreakRecord[]
  currentStreak?: number
}

// ── Vault API (exposed via Electron preload) ──────────────────────────────────
interface VaultFileEntry { name: string; path: string; mtime: number }

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close:    () => Promise<void>
      vault: {
        get:          () => Promise<string | null>
        select:       () => Promise<string | null>
        readFile:     (path: string) => Promise<string | null>
        writeFile:    (path: string, content: string) => Promise<boolean>
        deleteFile:   (path: string) => Promise<boolean>
        listFiles:    (dir: string) => Promise<VaultFileEntry[]>
        onFileChanged:(cb: (data: { path: string; content: string }) => void) => void
        onFileAdded:  (cb: (data: { path: string; content: string }) => void) => void
        onFileRemoved:(cb: (data: { path: string }) => void) => void
        offAll:       () => void
        /** Synchronous batch write — for use inside `beforeunload` only. */
        syncFlush:    (entries: Array<{ path: string; content: string }>) => void
      }
      /** Called by main process before closing — renderer must flush then ack. */
      onRequestFlush:  (cb: () => void) => void
      /** Acknowledge that all pending writes have been flushed synchronously. */
      notifyFlushDone: () => void
    }
  }
}
