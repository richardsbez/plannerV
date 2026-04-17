// ── WidgetEngine.tsx ──────────────────────────────────────────────────────────
// Snap-to-grid drag & resize. STORAGE_KEY is versioned — changing it clears
// stale saved layouts from older builds.

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { useTheme } from '../theme'

export const GRID   = 8
export const MIN_W  = 180
export const MIN_H  = 120
export interface WidgetLayout {
  id: string
  x: number
  y: number
  w: number
  h: number
  zIndex: number
}

function snap(v: number) { return Math.round(v / GRID) * GRID }

// ── Hook ─────────────────────────────────────────────────────────────────────
// externalLayouts: pre-loaded layouts from vault (may arrive async after mount)
// onSave: called with the full layout map on every change (debounce upstream)

export function useWidgetLayouts(
  defaults: WidgetLayout[],
  externalLayouts: Record<string, WidgetLayout> = {},
  onSave?: (layouts: Record<string, WidgetLayout>) => void,
) {
  // Seed from defaults; external layouts (from vault) override once they arrive
  const [layouts, setLayouts] = useState<Record<string, WidgetLayout>>(() => {
    const result: Record<string, WidgetLayout> = {}
    defaults.forEach(d => { result[d.id] = d })
    return result
  })

  // Merge external layouts when they load from vault (async after mount)
  useEffect(() => {
    if (!externalLayouts || Object.keys(externalLayouts).length === 0) return
    setLayouts(prev => {
      const result: Record<string, WidgetLayout> = {}
      // Use external layout where it matches a known panel, else default
      defaults.forEach(d => {
        result[d.id] = externalLayouts[d.id] ?? prev[d.id] ?? d
      })
      return result
    })
  }, [externalLayouts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-seed if window was resized significantly (>5% width deviation from defaults)
  useEffect(() => {
    if (Object.keys(externalLayouts).length > 0) return // vault overrides this check
    const defaultTotal = defaults.reduce((s, d) => s + d.w, 0)
    const currentTotal = Object.values(layouts).reduce((s, l) => s + l.w, 0)
    if (currentTotal > 0 && Math.abs(currentTotal - defaultTotal) / defaultTotal > 0.05) {
      const result: Record<string, WidgetLayout> = {}
      defaults.forEach(d => { result[d.id] = d })
      setLayouts(result)
      onSave?.(result)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateLayout = useCallback((id: string, updates: Partial<WidgetLayout>) => {
    setLayouts(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...updates } }
      onSave?.(next)
      return next
    })
  }, [onSave])

  const bringToFront = useCallback((id: string) => {
    setLayouts(prev => {
      const maxZ = Math.max(...Object.values(prev).map(l => l.zIndex), 0)
      if (prev[id]?.zIndex === maxZ) return prev
      const next = { ...prev, [id]: { ...prev[id], zIndex: maxZ + 1 } }
      onSave?.(next)
      return next
    })
  }, [onSave])

  const resetLayouts = useCallback(() => {
    const result: Record<string, WidgetLayout> = {}
    defaults.forEach(d => { result[d.id] = d })
    setLayouts(result)
    onSave?.(result)
  }, [defaults, onSave])

  return { layouts, updateLayout, bringToFront, resetLayouts }
}

// ── Widget ────────────────────────────────────────────────────────────────────
type Dir = 'e'|'s'|'se'|'sw'|'ne'|'nw'|'n'|'w'

interface WidgetProps {
  id: string
  layout: WidgetLayout
  editMode: boolean
  onLayoutChange: (id: string, u: Partial<WidgetLayout>) => void
  onBringToFront: (id: string) => void
  children: ReactNode
  title: string
  icon: string
  badge?: number
  headerExtra?: ReactNode
}

export function Widget({ id, layout, editMode, onLayoutChange, onBringToFront, children, title, icon, badge, headerExtra }: WidgetProps) {
  const t = useTheme()
  const dragRef  = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number; ox: number; oy: number; dir: Dir } | null>(null)

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode) return
    e.preventDefault()
    onBringToFront(id)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: layout.x, oy: layout.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      onLayoutChange(id, {
        x: Math.max(0, snap(dragRef.current.ox + ev.clientX - dragRef.current.sx)),
        y: Math.max(0, snap(dragRef.current.oy + ev.clientY - dragRef.current.sy)),
      })
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [editMode, id, layout.x, layout.y, onLayoutChange, onBringToFront])

  const onHandleMouseDown = useCallback((e: React.MouseEvent, dir: Dir) => {
    if (!editMode) return
    e.preventDefault(); e.stopPropagation()
    onBringToFront(id)
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: layout.w, oh: layout.h, ox: layout.x, oy: layout.y, dir }
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const { sx, sy, ow, oh, ox, oy, dir } = resizeRef.current
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      let nw = ow, nh = oh, nx = ox, ny = oy
      if (dir.includes('e'))  nw = Math.max(MIN_W, snap(ow + dx))
      if (dir.includes('s'))  nh = Math.max(MIN_H, snap(oh + dy))
      if (dir.includes('w')) { nw = Math.max(MIN_W, snap(ow - dx)); nx = snap(ox + ow - nw) }
      if (dir.includes('n')) { nh = Math.max(MIN_H, snap(oh - dy)); ny = snap(oy + oh - nh) }
      onLayoutChange(id, { x: Math.max(0, nx), y: Math.max(0, ny), w: nw, h: nh })
    }
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [editMode, id, layout, onLayoutChange, onBringToFront])

  const HS = 10 // handle size

  const handles: { dir: Dir; style: React.CSSProperties }[] = editMode ? [
    { dir: 'e',  style: { right: -(HS/2), top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize',   width: HS+4, height: 40 } },
    { dir: 's',  style: { bottom: -(HS/2), left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize', height: HS+4, width: 40 } },
    { dir: 'se', style: { bottom: -(HS/2), right: -(HS/2), cursor: 'nwse-resize', width: HS+4, height: HS+4 } },
    { dir: 'sw', style: { bottom: -(HS/2), left:  -(HS/2), cursor: 'nesw-resize', width: HS+4, height: HS+4 } },
    { dir: 'ne', style: { top:    -(HS/2), right: -(HS/2), cursor: 'nesw-resize', width: HS+4, height: HS+4 } },
    { dir: 'nw', style: { top:    -(HS/2), left:  -(HS/2), cursor: 'nwse-resize', width: HS+4, height: HS+4 } },
    { dir: 'n',  style: { top: -(HS/2), left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize',   height: HS+4, width: 40 } },
    { dir: 'w',  style: { left: -(HS/2), top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize',   width: HS+4, height: 40 } },
  ] : []

  return (
    <div
      onMouseDown={() => onBringToFront(id)}
      style={{
        position: 'absolute',
        left: layout.x, top: layout.y, width: layout.w, height: layout.h,
        zIndex: layout.zIndex,
        display: 'flex', flexDirection: 'column',
        background: t.bg1,
        border: editMode ? `1px dashed rgba(35,131,226,0.55)` : `1px solid ${t.border}`,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: editMode ? `0 0 0 1px rgba(35,131,226,0.12), ${t.panelShadow}` : t.panelShadow,
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.3s',
        userSelect: editMode ? 'none' : 'auto',
      }}
    >
      {/* Header — draggable in edit mode */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0,
          cursor: editMode ? 'grab' : 'default',
          background: editMode ? `rgba(35,131,226,0.04)` : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {editMode && <span style={{ fontSize: 11, color: 'rgba(35,131,226,0.45)', marginRight: 2 }}>⠿</span>}
          <span style={{ fontSize: 10, opacity: 0.3 }}>{icon}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: t.text2, letterSpacing: '-0.01em' }}>{title}</span>
          {badge !== undefined && badge > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: t.bg3, color: t.text3 }}>{badge}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {headerExtra}
          {editMode && (
            <span style={{ fontSize: 8.5, color: 'rgba(35,131,226,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
              {layout.w}×{layout.h}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', pointerEvents: editMode ? 'none' : 'auto' }}>
        {children}
      </div>

      {/* Resize handles */}
      {handles.map(({ dir, style }) => (
        <div key={dir} onMouseDown={e => onHandleMouseDown(e, dir)}
          style={{ position: 'absolute', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
          <div style={{ width: HS, height: HS, borderRadius: 2, background: '#2383e2', opacity: 0.85, border: '1px solid rgba(255,255,255,0.3)' }} />
        </div>
      ))}
    </div>
  )
}
