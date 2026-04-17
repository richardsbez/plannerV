import { useTheme } from '../theme'
import { useStore } from '../store'
import { Task } from '../types'
import { tagColor } from './SmartInput'
import { RotateCcw, Trash2, Clock } from 'lucide-react'

interface Props { onClose: () => void }

export function HistoryPanel({ onClose }: Props) {
  const thm = useTheme()
  const { archivedTasks, restoreTask, clearHistory } = useStore()

  const byDate = archivedTasks.reduce<Record<string, Task[]>>((acc, t) => {
    const d = t.completedAt ? new Date(t.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Desconhecido'
    if (!acc[d]) acc[d] = []
    acc[d].push(t)
    return acc
  }, {})

  return (
    <div className="fade-in" style={{
      position: 'fixed', inset: 0, zIndex: 8888,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxHeight: '60vh', background: '#1a1a1a',
        borderTop: '1px solid #2e2e2e', padding: '20px 28px 28px',
        overflowY: 'auto', animation: 'slideUp 0.22s ease-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={13} style={{ color: thm.text3 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: thm.text2 }}>Histórico · {archivedTasks.length} tarefas</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {archivedTasks.length > 0 && (
              <button onClick={clearHistory} className="btn" style={{ fontSize: 11, color: '#e03e3e', borderColor: '#3a1a1a' }}>
                Limpar tudo
              </button>
            )}
            <button onClick={onClose} className="btn" style={{ fontSize: 11 }}>Fechar</button>
          </div>
        </div>

        {archivedTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#3e3e3e', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            nenhuma tarefa arquivada ainda
          </div>
        ) : (
          Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, tasks]) => (
            <div key={date} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, color: '#3e3e3e', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>
                {date}
              </div>
              {tasks.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', borderRadius: 4, marginBottom: 2,
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e2e2e', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: thm.text3, textDecoration: 'line-through', fontFamily: 'Inter, sans-serif' }}>{t.title}</span>
                  {t.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, color: tagColor(tag), fontFamily: 'JetBrains Mono, monospace' }}>#{tag}</span>
                  ))}
                  <button onClick={() => restoreTask(t.id)} style={{ color: thm.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.color = thm.accent)}
                    onMouseLeave={e => (e.currentTarget.style.color = thm.text4)}>
                    <RotateCcw size={11} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
