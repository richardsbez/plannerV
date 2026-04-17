// ── PanelManager.tsx ──────────────────────────────────────────────────────────
// Slide-in panel that lets users show/hide/reset any widget.

import { useTheme } from '../theme'
import { X } from 'lucide-react'

export interface PanelDef {
  id: string
  icon: string
  label: string
  description: string
}

export const ALL_PANELS: PanelDef[] = [
  { id: 'month-week', icon: '≋',  label: 'Mês & Semana',   description: 'Tarefas de longo prazo' },
  { id: 'today',      icon: '○',  label: 'Hoje',           description: 'Tarefas do dia atual' },
  { id: 'calendar',   icon: '▦',  label: 'Calendário',      description: 'Navegação temporal M/S/A' },
  { id: 'week',       icon: '≡',  label: 'Semana',          description: 'Visão semanal detalhada' },
  { id: 'matrix',     icon: '⊞',  label: 'Prioridades',     description: 'Matriz de Eisenhower 2×2' },
  { id: 'insights',   icon: '◎',  label: 'Insights',        description: 'Heatmap e estatísticas' },
  { id: 'notes',      icon: '—',  label: 'Notas',           description: 'Tarefas e notas mensais/semanais' },
  { id: 'markdown',   icon: '/',  label: 'Markdown',        description: 'Editor com preview e múltiplos docs' },
  { id: 'top3',       icon: '◉',  label: 'Top 3 do Dia',    description: '3 objetivos principais do dia' },
  { id: 'habits',     icon: '↻',  label: 'Hábitos',         description: 'Rastreador diário com streaks' },
  { id: 'timeblock',  icon: '◷',  label: 'Time Block',      description: 'Blocos visuais de tempo (6h–23h)' },
  { id: 'pomodoro',   icon: '◌',  label: 'Pomodoro',        description: 'Timer de foco com sessões' },
  { id: 'journal',    icon: '‖',  label: 'Diário',          description: 'Reflexão diária guiada' },
  { id: 'mood',       icon: '∿',  label: 'Humor',           description: 'Rastreador de humor e energia' },
]

interface Props {
  visible: string[]
  onToggle: (id: string) => void
  onClose: () => void
  onResetLayouts: () => void
}

export function PanelManager({ visible, onToggle, onClose, onResetLayouts }: Props) {
  const t = useTheme()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 36, right: 0, bottom: 28, width: 300, zIndex: 8001,
        background: t.bg1, borderLeft: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Painéis</div>
            <div style={{ fontSize: 10.5, color: t.text4, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {visible.length}/{ALL_PANELS.length} ativos
            </div>
          </div>
          <button onClick={onClose} style={{ color: t.text3, background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = t.text)}
            onMouseLeave={e => (e.currentTarget.style.color = t.text3)}>
            <X size={16} />
          </button>
        </div>

        {/* Panel list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {ALL_PANELS.map(panel => {
            const active = visible.includes(panel.id)
            return (
              <div key={panel.id}
                onClick={() => onToggle(panel.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', cursor: 'pointer',
                  background: 'transparent', transition: 'background 0.1s',
                  borderLeft: `3px solid ${active ? t.accent : 'transparent'}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = t.hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>{panel.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: active ? t.text : t.text3, fontWeight: active ? 600 : 400, transition: 'color 0.15s' }}>
                    {panel.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: t.text4, marginTop: 1 }}>{panel.description}</div>
                </div>

                {/* Toggle pill */}
                <div style={{
                  width: 34, height: 18, borderRadius: 99,
                  background: active ? t.accent : t.border2,
                  position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: active ? 18 : 2,
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={onResetLayouts} style={{
            fontSize: 11, color: t.text3, background: 'none',
            border: `1px solid ${t.border}`, borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
            width: '100%', fontFamily: 'JetBrains Mono, monospace',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = t.red; e.currentTarget.style.borderColor = t.red }}
            onMouseLeave={e => { e.currentTarget.style.color = t.text3; e.currentTarget.style.borderColor = t.border }}>
            ↺ resetar posições
          </button>
          <div style={{ fontSize: 9.5, color: t.text4, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            /edit para arrastar e redimensionar
          </div>
        </div>
      </div>
    </>
  )
}
