import { useTheme } from '../theme'

interface Props { onSave: ()=>void; onReset: ()=>void; showGrid: boolean; onToggleGrid: ()=>void }

export function EditModeBar({ onSave, onReset, showGrid, onToggleGrid }: Props) {
  const t = useTheme()
  return (
    <div style={{
      position: 'fixed', top: 36, left: 0, right: 0, zIndex: 9000,
      background: t.accentBg,
      backdropFilter: 'blur(8px)',
      borderBottom: `1px solid rgba(35,131,226,0.25)`,
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'editBarIn 0.2s ease-out',
    }}>
      <span style={{ fontSize:10, color:t.accent, fontFamily:'JetBrains Mono, monospace', letterSpacing:'0.06em', fontWeight:600 }}>◈ MODO EDIÇÃO</span>
      <span style={{ fontSize:9.5, color:t.text3, fontFamily:'JetBrains Mono, monospace' }}>arraste cabeçalhos · alças de resize nas bordas</span>
      <div style={{ flex:1 }} />
      <button onClick={onToggleGrid} style={{
        fontSize:9.5, fontFamily:'JetBrains Mono, monospace', padding:'2px 8px', borderRadius:3,
        border:`1px solid ${showGrid ? t.accent : t.border2}`,
        background: showGrid ? t.accentBg : 'transparent',
        color: showGrid ? t.accent : t.text3, cursor:'pointer', transition:'all 0.15s',
      }}>{showGrid ? '⊞ grade on' : '⊟ grade off'}</button>
      <button onClick={onReset} style={{ fontSize:9.5, fontFamily:'JetBrains Mono, monospace', padding:'2px 8px', borderRadius:3, border:`1px solid ${t.border2}`, background:'transparent', color:t.text3, cursor:'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.color=t.red; e.currentTarget.style.borderColor=t.red }}
        onMouseLeave={e => { e.currentTarget.style.color=t.text3; e.currentTarget.style.borderColor=t.border2 }}>
        ↺ reset
      </button>
      <button onClick={onSave} style={{
        fontSize:9.5, fontFamily:'JetBrains Mono, monospace', padding:'3px 12px', borderRadius:3,
        border:`1px solid rgba(35,131,226,0.5)`, background:t.accentBg, color:t.accent, cursor:'pointer', fontWeight:600,
      }}
        onMouseEnter={e => (e.currentTarget.style.opacity='0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity='1')}>
        /save · salvar
      </button>
      <span style={{ fontSize:9, color:t.text4, fontFamily:'JetBrains Mono, monospace' }}>ESC para sair</span>
    </div>
  )
}
