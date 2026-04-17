import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock } from 'lucide-react'

interface Props { onHistory?: () => void }

export function TitleBar({ onHistory }: Props) {
  const isElectron = !!window.electronAPI
  const now = new Date()
  return (
    <div className="titlebar-drag flex items-center px-4 shrink-0 gap-3"
      style={{ height: 36, background: '#141414', borderBottom: '1px solid #242424' }}>

      <div className="titlebar-no-drag flex items-center gap-2.5">
        <div style={{ width: 18, height: 18, borderRadius: 4, background: '#2383e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.9" />
            <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.5" />
            <rect x="1" y="5.5" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.5" />
            <rect x="5.5" y="5.5" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.9" />
          </svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e6e6e6', letterSpacing: '-0.01em' }}>Planner</span>
      </div>

      <span style={{ color: '#242424', fontSize: 12 }}>•</span>
      <span style={{ fontSize: 11.5, color: '#4a4a4a', fontWeight: 400 }}>
        {format(now, "EEE, d 'de' MMM", { locale: ptBR })}
      </span>

      {/* Smart input hint */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, color: '#2e2e2e', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em' }}>
          [] criar · [x] fechar · /boom limpar · @HH:MM agendar · #tag contexto · 25m timer
        </span>
      </div>

      {/* History button */}
      <button className="titlebar-no-drag" onClick={onHistory}
        style={{ color: '#3e3e3e', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'Inter, sans-serif' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#9b9a97')}
        onMouseLeave={e => (e.currentTarget.style.color = '#3e3e3e')}>
        <Clock size={11} /> Histórico
      </button>

      {isElectron && (
        <div className="titlebar-no-drag flex items-center gap-1.5 ml-2">
          {[{ action: 'minimize', color: '#dfab01' }, { action: 'maximize', color: '#0f7b6c' }, { action: 'close', color: '#e03e3e' }].map(({ action, color }) => (
            <button key={action}
              onClick={() => (window.electronAPI as any)[action]()}
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#3e3e3e', border: 'none', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = color)}
              onMouseLeave={e => (e.currentTarget.style.background = '#3e3e3e')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
