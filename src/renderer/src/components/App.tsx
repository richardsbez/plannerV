import { vaultAPI, vaultStore } from '../vault/api'
import { VaultStatusBadge, VaultWelcomeModal } from './VaultSelector'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useStore, registerWorkspaceSaver } from '../store'
import { ThemeContext, DARK, LIGHT, Theme } from '../theme'
import { Task } from '../types'
import { writeWorkspace, loadVaultSnapshot, subscribeSaveState } from '../vault/persistence'
import type { SaveState } from '../vault/persistence'
import type { PlannerWorkspace, WorkspaceLayout } from '../vault/format'

// Panels
import { TaskList }        from './TaskList'
import { TemporalCalendar }from './TemporalCalendar'
import { WeekView }        from './WeekView'
import { PriorityMatrix }  from './PriorityMatrix'
import { NotesPanel }      from './NotesPanel'
import { InsightsPanel }   from './InsightsPanel'
import { MarkdownPanel }   from './MarkdownPanel'
import { Top3Panel }       from './Top3Panel'
import { HabitPanel }      from './HabitPanel'
import { TimeBlockPanel }  from './TimeBlockPanel'
import { CompactMatrix }   from './CompactMatrix'
import { PomodoroPanel }   from './PomodoroPanel'
import { JournalPanel }    from './JournalPanel'
import { MoodPanel }       from './MoodPanel'

// Chrome
import { TopBar }          from './TopBar'
import { StatsBar }        from './StatsBar'
import { EditModeBar }     from './EditModeBar'
import { DeepFocus }       from './DeepFocus'
import { FocusMode }       from './FocusMode'
import { HistoryPanel }    from './HistoryPanel'
import { PanelManager, ALL_PANELS } from './PanelManager'

// Engine
import { Widget, useWidgetLayouts, WidgetLayout, GRID } from './WidgetEngine'

// ── Layout defaults ────────────────────────────────────────────────────────
const SNAP = (v: number) => Math.round(v / GRID) * GRID

function buildDefaults(): WidgetLayout[] {
  const W = window.innerWidth
  const H = window.innerHeight - 36 - 28
  const c1 = SNAP(W * 0.29)
  const c2 = SNAP(W * 0.20)
  const c3 = SNAP(W * 0.22)
  const c4 = W - c1 - c2 - c3
  const r1 = SNAP(H * 0.52)
  const r2 = H - r1

  return [
    { id: 'month-week', x: 0,        y: 0,  w: c1, h: r1,             zIndex: 1 },
    { id: 'today',      x: 0,        y: r1, w: c1, h: r2,             zIndex: 1 },
    { id: 'calendar',   x: c1,       y: 0,  w: c2, h: r1,             zIndex: 1 },
    { id: 'week',       x: c1,       y: r1, w: c2, h: r2,             zIndex: 1 },
    { id: 'matrix',     x: c1+c2,    y: 0,  w: c3, h: H,              zIndex: 1 },
    { id: 'insights',   x: c1+c2+c3, y: 0,  w: c4, h: SNAP(H * 0.5), zIndex: 1 },
    { id: 'notes',      x: c1+c2+c3, y: SNAP(H*0.5), w: c4, h: H - SNAP(H*0.5), zIndex: 1 },
    { id: 'markdown',   x: SNAP(W*0.1), y: SNAP(H*0.05), w: SNAP(W*0.55), h: SNAP(H*0.8), zIndex: 5 },
    { id: 'top3',       x: c1,       y: 0,  w: c2, h: r1,             zIndex: 1 },
    { id: 'habits',     x: c1+c2,    y: 0,  w: c3, h: SNAP(H * 0.6), zIndex: 1 },
    { id: 'timeblock',  x: c1+c2+c3, y: 0,  w: c4, h: H,             zIndex: 1 },
    { id: 'pomodoro',   x: c1,       y: 0,  w: c2, h: SNAP(H * 0.45),zIndex: 1 },
    { id: 'journal',    x: c1+c2,    y: 0,  w: c3, h: SNAP(H * 0.55),zIndex: 1 },
    { id: 'mood',       x: c1+c2+c3, y: 0,  w: c4, h: SNAP(H * 0.55),zIndex: 1 },
  ]
}

const DEFAULT_VISIBLE = ['month-week','today','calendar','week','matrix','insights','notes']

function calcStreak(tasks: Task[]) {
  const done = tasks.filter(t => t.section === 'day' && t.completed)
  if (!done.length) return 0
  const by: Record<string, number> = {}
  done.forEach(t => { if (t.completedAt) { const d = t.completedAt.slice(0,10); by[d] = (by[d]||0)+1 } })
  let s = 0; const d = new Date()
  while (s < 365) { const k = d.toISOString().slice(0,10); if ((by[k]||0) >= 3) { s++; d.setDate(d.getDate()-1) } else break }
  return s
}

// ─────────────────────────────────────────────────────────────────────────────

export function App() {
  const store = useStore()
  const { tasks, monthNotes, weekNotes, setMonthNotes, setWeekNotes, archiveOldCompleted, boomSection, selectedDate } = store

  // ── 1. Simple state ───────────────────────────────────────────────────────
  const [focusTask,        setFocusTask]        = useState<Task|null>(null)
  const [deepFocusTask,    setDeepFocusTask]    = useState<Task|null|undefined>(undefined)
  const [showHistory,      setShowHistory]      = useState(false)
  const [matrixModal,      setMatrixModal]      = useState(false)
  const [boomingIds,       setBoomingIds]       = useState<string[]>([])
  const [editMode,         setEditMode]         = useState(false)
  const [showGrid,         setShowGrid]         = useState(false)
  const [notesTab,         setNotesTab]         = useState<'month'|'week'>('month')
  const [mwTab,            setMwTab]            = useState<'month'|'week'>('month')
  const [showPanelMgr,     setShowPanelMgr]     = useState(false)
  const [theme,            setTheme]            = useState<Theme>('dark')
  const [visible,          setVisible]          = useState<string[]>(DEFAULT_VISIBLE)
  const [vaultPath,        setVaultPath]        = useState<string | null>(vaultStore.getPath())
  const [showVaultWelcome, setShowVaultWelcome] = useState(false)
  // External layouts loaded from vault — fed into useWidgetLayouts
  const [vaultLayouts,     setVaultLayouts]     = useState<Record<string, WorkspaceLayout>>({})
  // Save state — mirrors ultralearn's 'idle' | 'saving' | 'saved' badge
  const [saveState,        setSaveState]        = useState<SaveState>('idle')

  const tokens = theme === 'dark' ? DARK : LIGHT
  const t = tokens

  // ── 2. Stable defaults + layouts (MUST be before any useEffect using layouts) ──
  const defaults = useMemo(() => buildDefaults(), [])

  // Ref so save callbacks always see latest layouts without stale closure
  const layoutsRef = useRef<Record<string, WorkspaceLayout>>({})

  const { layouts, updateLayout, bringToFront, resetLayouts } = useWidgetLayouts(
    defaults,
    vaultLayouts,
    (newLayouts) => {
      layoutsRef.current = newLayouts as Record<string, WorkspaceLayout>
      if (vaultStore.getPath()) {
        writeWorkspace({
          theme: themeRef.current,
          visible: visibleRef.current,
          layouts: newLayouts as Record<string, WorkspaceLayout>,
          streakHistory: store.streakHistory ?? [],
          currentStreak: store.currentStreak ?? 0,
          selectedDate:  store.selectedDate,
          savedAt: new Date().toISOString(),
        })
      }
    },
  )

  // Keep refs in sync (avoid stale closures in callbacks)
  const themeRef   = useRef(theme);   themeRef.current   = theme
  const visibleRef = useRef(visible); visibleRef.current = visible
  layoutsRef.current = layouts as Record<string, WorkspaceLayout>

  // ── 3. Workspace helpers (after layouts is declared) ─────────────────────
  const buildSnapshot = useCallback((): PlannerWorkspace => ({
    theme:         themeRef.current,
    visible:       visibleRef.current,
    layouts:       layoutsRef.current,
    streakHistory: store.streakHistory ?? [],
    currentStreak: store.currentStreak ?? 0,
    selectedDate:  store.selectedDate,
    savedAt:       new Date().toISOString(),
  }), [store.streakHistory, store.currentStreak, store.selectedDate])

  const applyWorkspace = useCallback((ws: PlannerWorkspace) => {
    setTheme(ws.theme ?? 'dark')
    if (ws.visible && ws.visible.length > 0) setVisible(ws.visible)
    if (ws.layouts && Object.keys(ws.layouts).length > 0) {
      setVaultLayouts(ws.layouts)
    }
  }, [])

  const loadAndApplyWorkspace = useCallback(async () => {
    try {
      const { workspace } = await loadVaultSnapshot()
      applyWorkspace(workspace)
    } catch (e) {
      console.error('loadAndApplyWorkspace:', e)
    }
  }, [applyWorkspace])

  // ── 4. useEffects ─────────────────────────────────────────────────────────

  // Subscribe to vault save-state events (saving / saved / idle)
  useEffect(() => subscribeSaveState(setSaveState), [])

  // Theme → DOM
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  // Persist visible changes
  useEffect(() => {
    if (!vaultStore.getPath() || Object.keys(layoutsRef.current).length === 0) return
    writeWorkspace(buildSnapshot())
  }, [visible, buildSnapshot])

  // Persist theme changes
  useEffect(() => {
    if (!vaultStore.getPath() || Object.keys(layoutsRef.current).length === 0) return
    writeWorkspace(buildSnapshot())
  }, [theme, buildSnapshot])

  // Vault subscription + initial load
  useEffect(() => {
    const unsub = vaultStore.subscribe(p => setVaultPath(p))
    vaultAPI.get().then(async p => {
      if (p) {
        vaultStore.setPath(p)
        setVaultPath(p)
        await loadAndApplyWorkspace()
      } else {
        setShowVaultWelcome(true)
      }
    })
    return unsub
  }, [loadAndApplyWorkspace])

  // Register streak/date save callback in store
  useEffect(() => {
    registerWorkspaceSaver((streakHistory, currentStreak, selectedDate) => {
      if (!vaultStore.getPath()) return
      writeWorkspace({
        theme:   themeRef.current,
        visible: visibleRef.current,
        layouts: layoutsRef.current,
        streakHistory: streakHistory as Array<{date:string;top3Completed:boolean}>,
        currentStreak,
        selectedDate,
        savedAt: new Date().toISOString(),
      })
    })
  }, []) // intentionally empty — callback always reads from refs

  // Archiving
  useEffect(() => {
    archiveOldCompleted()
    const id = setInterval(archiveOldCompleted, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [archiveOldCompleted])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeepFocusTask(undefined); setMatrixModal(false)
        setFocusTask(null); setEditMode(false); setShowPanelMgr(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── 5. Derived state ──────────────────────────────────────────────────────
  const togglePanel = useCallback((id: string) => {
    setVisible(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (vaultStore.getPath()) writeWorkspace({ ...buildSnapshot(), visible: next })
      return next
    })
  }, [buildSnapshot])

  const cmdHandlers = useMemo(() => ({
    onEditMode:   () => setEditMode(true),
    onSaveLayout: () => setEditMode(false),
    onFocusMode:  () => setDeepFocusTask(tasks.find(t => !t.completed && t.section === 'day') ?? null),
    onShowMatrix: () => setMatrixModal(true),
  }), [tasks])

  const handleBoom = useCallback((section: 'month-week'|'day') => {
    const ids = boomSection(section); setBoomingIds(ids); setTimeout(() => setBoomingIds([]), 700)
  }, [boomSection])

  const today       = new Date().toISOString().slice(0, 10)
  const isFiltering = selectedDate !== today
  const mwTasks  = tasks.filter(t => t.section === 'month-week')
  const dayTasks = useMemo(() =>
    isFiltering
      ? tasks.filter(t => t.section==='day' || t.dueDate===selectedDate || t.completedAt?.startsWith(selectedDate))
      : tasks.filter(t => t.section === 'day'),
    [tasks, selectedDate, isFiltering]
  )
  const mTasks  = tasks.filter(t => t.section === 'month')
  const wTasks  = tasks.filter(t => t.section === 'week')
  const pendMW  = mwTasks.filter(t => !t.completed).length
  const pendDay = dayTasks.filter(t => !t.completed).length
  const streak  = calcStreak(tasks)
  const isDeep  = deepFocusTask !== undefined

  const show = (id: string) => visible.includes(id) && layouts[id]

  const gridBg = showGrid
    ? `repeating-linear-gradient(0deg,transparent,transparent ${GRID-1}px,rgba(35,131,226,0.05) ${GRID}px),repeating-linear-gradient(90deg,transparent,transparent ${GRID-1}px,rgba(35,131,226,0.05) ${GRID}px)`
    : 'none'

  const filterBadge = isFiltering
    ? <button onClick={() => store.setSelectedDate(today)} style={{ fontSize:9, color:t.text3, fontFamily:'JetBrains Mono, monospace', background:'none', border:`1px solid ${t.border}`, borderRadius:3, padding:'1px 5px', cursor:'pointer' }} onMouseEnter={e=>(e.currentTarget.style.color=t.accent)} onMouseLeave={e=>(e.currentTarget.style.color=t.text3)}>hoje ×</button>
    : <span style={{ fontSize:10, color:t.text4 }}>{new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})}</span>

  const mwTabs = (
    <div style={{ display:'flex', gap:2 }}>
      {(['month','week'] as const).map(v => (
        <button key={v} onClick={() => setMwTab(v)} style={{ fontSize:9.5, fontFamily:'JetBrains Mono, monospace', padding:'1px 6px', borderRadius:3, border:`1px solid ${mwTab===v?t.accent:t.border}`, background:mwTab===v?t.accentBg:'transparent', color:mwTab===v?t.accent:t.text4, cursor:'pointer' }}>
          {v==='month'?'Mês':'Sem'}
        </button>
      ))}
    </div>
  )

  const notesTabs = (
    <div style={{ display:'flex', gap:2 }}>
      {(['month','week'] as const).map(v => (
        <button key={v} onClick={() => setNotesTab(v)} style={{ fontSize:9.5, fontFamily:'JetBrains Mono, monospace', padding:'1px 6px', borderRadius:3, border:`1px solid ${notesTab===v?t.accent:t.border}`, background:notesTab===v?t.accentBg:'transparent', color:notesTab===v?t.accent:t.text4, cursor:'pointer' }}>
          {v==='month'?'Mês':'Sem'}
        </button>
      ))}
    </div>
  )

  const panelsBtn = (
    <button
      onClick={() => setShowPanelMgr(true)}
      style={{ position:'fixed', right:12, bottom:36, zIndex:3000, display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, background:t.bg1, border:`1px solid ${t.border}`, color:t.text2, cursor:'pointer', fontSize:11, fontFamily:'JetBrains Mono, monospace', boxShadow:t.panelShadow, transition:'all 0.2s' }}
      onMouseEnter={e=>{ e.currentTarget.style.background=t.accent; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor=t.accent }}
      onMouseLeave={e=>{ e.currentTarget.style.background=t.bg1; e.currentTarget.style.color=t.text2; e.currentTarget.style.borderColor=t.border }}
      title="Gerenciar painéis"
    >
      ⊞ painéis
    </button>
  )

  // ── 6. Render ─────────────────────────────────────────────────────────────
  return (
    <ThemeContext.Provider value={t}>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:t.bg, transition:'background 0.3s' }}>
        <TopBar streak={streak} onHistory={() => setShowHistory(true)} focusMode={isDeep}
          theme={theme} onToggleTheme={() => setTheme(th => th==='dark'?'light':'dark')}
          saveState={saveState}
          editMode={editMode}
          onToggleEdit={() => setEditMode(m => !m)}
          onOpenPanels={() => setShowPanelMgr(true)}
          vaultBadge={<VaultStatusBadge onVaultReady={async p => {
            setVaultPath(p); setShowVaultWelcome(false)
            await loadAndApplyWorkspace()
          }} />} />

        {editMode && <EditModeBar onSave={() => setEditMode(false)} onReset={resetLayouts} showGrid={showGrid} onToggleGrid={() => setShowGrid(g => !g)} />}

        {!isDeep && (
          <div style={{ position:'relative', flex:1, overflow:'hidden', background:t.bg, backgroundImage:gridBg, marginTop:editMode?34:0, transition:'margin-top 0.2s, background 0.3s' }}>

            {show('month-week') && (
              <Widget id="month-week" layout={layouts['month-week']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Mês & Semana" icon="≋" badge={pendMW} headerExtra={mwTabs}>
                <div style={{ height:'100%', overflowY:'auto', padding:'6px 0' }}>
                  <TaskList section={mwTab==='month'?'month-week':'week'} tasks={mwTab==='month'?mwTasks:wTasks} onFocusTask={setFocusTask} boomingIds={boomingIds} onBoom={() => handleBoom('month-week')} {...cmdHandlers} />
                </div>
              </Widget>
            )}

            {show('today') && (
              <Widget id="today" layout={layouts['today']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title={isFiltering?`Tarefas · ${selectedDate}`:'Hoje'} icon="○" badge={pendDay} headerExtra={filterBadge}>
                <div style={{ height:'100%', overflowY:'auto', padding:'6px 0' }}>
                  <TaskList section="day" tasks={dayTasks} onFocusTask={setFocusTask} boomingIds={boomingIds} onBoom={() => handleBoom('day')} {...cmdHandlers} />
                </div>
              </Widget>
            )}

            {show('calendar') && (
              <Widget id="calendar" layout={layouts['calendar']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Calendário" icon="▦">
                <TemporalCalendar />
              </Widget>
            )}

            {show('week') && (
              <Widget id="week" layout={layouts['week']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Semana" icon="≡">
                <div style={{ height:'100%', overflowY:'auto', padding:'4px 0' }}><WeekView /></div>
              </Widget>
            )}

            {show('matrix') && (
              <Widget id="matrix" layout={layouts['matrix']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Prioridades" icon="⊞">
                <PriorityMatrix onFocusTask={setFocusTask} />
              </Widget>
            )}

            {show('insights') && (
              <Widget id="insights" layout={layouts['insights']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Insights" icon="◎">
                <InsightsPanel />
              </Widget>
            )}

            {show('notes') && (
              <Widget id="notes" layout={layouts['notes']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Notas" icon="—" headerExtra={notesTabs}>
                <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:10 }}>
                  <div style={{ flex:1, minHeight:0, overflowY:'auto', marginBottom:8 }}>
                    <TaskList section={notesTab==='month'?'month':'week'} tasks={notesTab==='month'?mTasks:wTasks} onFocusTask={setFocusTask} boomingIds={boomingIds} onBoom={() => {}} {...cmdHandlers} />
                  </div>
                  <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:8 }}>
                    <span style={{ fontSize:10, color:t.text4, fontFamily:'JetBrains Mono, monospace', display:'block', marginBottom:6 }}>notas do {notesTab==='month'?'mês':'semana'}</span>
                    <NotesPanel value={notesTab==='month'?monthNotes:weekNotes} onChange={notesTab==='month'?setMonthNotes:setWeekNotes} placeholder="Notas em markdown..." />
                  </div>
                </div>
              </Widget>
            )}

            {show('markdown') && (
              <Widget id="markdown" layout={layouts['markdown']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Markdown" icon="/">
                <MarkdownPanel />
              </Widget>
            )}

            {show('top3') && (
              <Widget id="top3" layout={layouts['top3']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Top 3 do Dia" icon="◉">
                <Top3Panel />
              </Widget>
            )}

            {show('habits') && (
              <Widget id="habits" layout={layouts['habits']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Hábitos" icon="↻">
                <HabitPanel />
              </Widget>
            )}

            {show('timeblock') && (
              <Widget id="timeblock" layout={layouts['timeblock']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Time Block" icon="◷">
                <TimeBlockPanel />
              </Widget>
            )}

            {show('pomodoro') && (
              <Widget id="pomodoro" layout={layouts['pomodoro']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Pomodoro" icon="◌">
                <PomodoroPanel />
              </Widget>
            )}

            {show('journal') && (
              <Widget id="journal" layout={layouts['journal']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Diário" icon="‖">
                <JournalPanel />
              </Widget>
            )}

            {show('mood') && (
              <Widget id="mood" layout={layouts['mood']} editMode={editMode} onLayoutChange={updateLayout} onBringToFront={bringToFront} title="Humor" icon="∿">
                <MoodPanel />
              </Widget>
            )}

          </div>
        )}

        <StatsBar onHistory={() => setShowHistory(true)} />

        {!isDeep && panelsBtn}

        {matrixModal  && <CompactMatrix onFocusTask={setFocusTask} expanded={true} onClose={() => setMatrixModal(false)} />}
        {focusTask && !isDeep && <FocusMode task={focusTask} onClose={() => setFocusTask(null)} />}
        {isDeep       && <DeepFocus task={deepFocusTask} onClose={() => setDeepFocusTask(undefined)} />}
        {showHistory  && <HistoryPanel onClose={() => setShowHistory(false)} />}
        {showPanelMgr && <PanelManager visible={visible} onToggle={togglePanel} onClose={() => setShowPanelMgr(false)} onResetLayouts={() => { resetLayouts(); setShowPanelMgr(false) }} />}
        {showVaultWelcome && <VaultWelcomeModal onDone={async p => {
          setVaultPath(p); setShowVaultWelcome(false)
          await loadAndApplyWorkspace()
        }} />}
      </div>
    </ThemeContext.Provider>
  )
}
