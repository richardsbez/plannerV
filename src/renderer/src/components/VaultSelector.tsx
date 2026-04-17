// ── components/VaultSelector.tsx ──────────────────────────────────────────────
// Shows the vault status in the top-bar and orchestrates:
//   1. First-run prompt to pick a vault.
//   2. Live FS-watch dispatch (external changes → store + panel state).

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../theme'
import { vaultAPI, vaultStore } from '../vault/api'
import { parseExternalChange, loadVaultSnapshot, flushAllPending } from '../vault/persistence'
import { useStore } from '../store'

// External-change event bus — panels subscribe to this for their specific files
type ExternalChangeHandler = (payload: ReturnType<typeof parseExternalChange>) => void
const externalChangeHandlers = new Set<ExternalChangeHandler>()

export function subscribeToExternalChanges(fn: ExternalChangeHandler) {
  externalChangeHandlers.add(fn)
  return () => externalChangeHandlers.delete(fn)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onVaultReady?: (path: string) => void
}

export function VaultStatusBadge({ onVaultReady }: Props) {
  const t = useTheme()
  const [vaultPath, setVaultPath] = useState<string | null>(vaultStore.getPath())
  const [selecting, setSelecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const store = useStore()

  // Subscribe to vault path changes
  useEffect(() => {
    return vaultStore.subscribe(setVaultPath)
  }, [])

  // Install FS-watch dispatcher once, re-run when vault changes
  useEffect(() => {
    if (!vaultPath) return

    const handler = (data: { path: string; content: string }) => {
      const parsed = parseExternalChange(data.path, data.content)
      if (!parsed) return

      setSyncing(true)
      setTimeout(() => setSyncing(false), 800)

      // Dispatch to store for task / notes / archive changes
      switch (parsed.type) {
        case 'tasks':
          store.mergeTasksSection(parsed.section, parsed.tasks)
          break
        case 'notes':
          if (parsed.scope === 'month') store.mergeNotes('month', parsed.content)
          else store.mergeNotes('week', parsed.content)
          break
        case 'archive':
          store.mergeArchive(parsed.tasks)
          break
        default:
          // For journal / habits / mood / docs — dispatch to panel subscribers
          externalChangeHandlers.forEach(fn => fn(parsed))
      }
    }

    vaultAPI.onFileChanged(handler)
    vaultAPI.onFileAdded(handler)

    return () => {
      vaultAPI.offAll()
    }
  }, [vaultPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectVault = useCallback(async () => {
    if (selecting) return
    setSelecting(true)
    try {
      // Flush any debounced writes for the CURRENT vault before switching.
      // Without this, timers from the old vault would fire after currentVaultPath
      // changes in the main process, silently writing old data into the new vault.
      await flushAllPending()

      const path = await vaultAPI.select()
      if (!path) return
      vaultStore.setPath(path)
      // Reload all data from the new vault
      const { state } = await loadVaultSnapshot()
      useStore.getState().loadState(state)
      onVaultReady?.(path)
    } finally {
      setSelecting(false)
    }
  }, [selecting, onVaultReady])

  const shortPath = vaultPath
    ? vaultPath.split(/[/\\]/).slice(-2).join('/')
    : null

  return (
    <button
      onClick={selectVault}
      title={vaultPath ? `Cofre: ${vaultPath}\nClique para trocar` : 'Selecionar Cofre'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 4,
        border: `1px solid ${vaultPath ? t.border : t.accent}`,
        background: vaultPath ? 'transparent' : `${t.accent}18`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = t.accent
        e.currentTarget.style.background  = `${t.accent}18`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = vaultPath ? t.border : t.accent
        e.currentTarget.style.background  = vaultPath ? 'transparent' : `${t.accent}18`
      }}
    >
      {/* Vault icon */}
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="11" rx="2" stroke={syncing ? t.green : vaultPath ? t.accent : t.text4} strokeWidth="1.5"/>
        <path d="M5 3V2a3 3 0 0 1 6 0v1" stroke={syncing ? t.green : vaultPath ? t.accent : t.text4} strokeWidth="1.5"/>
        <circle cx="8" cy="8.5" r="1.5" fill={syncing ? t.green : vaultPath ? t.accent : t.text4}
          style={{ transition: 'fill 0.3s' }}/>
      </svg>

      <span style={{
        fontSize: 9.5,
        fontFamily: 'JetBrains Mono, monospace',
        color: syncing ? t.green : vaultPath ? t.text3 : t.accent,
        letterSpacing: '0.03em',
        transition: 'color 0.3s',
      }}>
        {selecting ? 'abrindo…' : syncing ? 'sync' : shortPath ?? 'cofre'}
      </span>

      {/* Sync pulse */}
      {syncing && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: t.green,
          animation: 'pulse 0.8s ease-in-out',
        }} />
      )}
    </button>
  )
}

// ── First-run modal (shown when no vault is configured) ───────────────────────

export function VaultWelcomeModal({ onDone }: { onDone: (path: string) => void }) {
  const t = useTheme()
  const [selecting, setSelecting] = useState(false)

  const pick = async () => {
    if (selecting) return
    setSelecting(true)
    try {
      await flushAllPending()
      const path = await vaultAPI.select()
      if (path) {
        vaultStore.setPath(path)
        const { state } = await loadVaultSnapshot()
        useStore.getState().loadState(state)
        onDone(path)
      }
    } finally {
      setSelecting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: t.bg1, border: `1px solid ${t.border}`,
        borderRadius: 12, padding: '36px 40px', maxWidth: 420, width: '90%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        {/* Icon */}
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ marginBottom: 18 }}>
          <rect x="3" y="11" width="38" height="28" rx="5" stroke={t.accent} strokeWidth="2"/>
          <path d="M14 11V8a8 8 0 0 1 16 0v3" stroke={t.accent} strokeWidth="2"/>
          <circle cx="22" cy="25" r="4" fill={t.accent} opacity="0.85"/>
          <line x1="22" y1="29" x2="22" y2="33" stroke={t.accent} strokeWidth="2" strokeLinecap="round"/>
        </svg>

        <h2 style={{
          margin: '0 0 8px', fontSize: 18, fontWeight: 700,
          color: t.text, fontFamily: 'Inter, sans-serif', textAlign: 'center',
        }}>
          Bem-vindo ao Planner
        </h2>

        <p style={{
          margin: '0 0 6px', fontSize: 12.5, color: t.text3,
          fontFamily: 'Inter, sans-serif', lineHeight: 1.6, textAlign: 'center',
        }}>
          Selecione um <strong style={{ color: t.text2 }}>Cofre</strong> — uma pasta no seu disco
          onde todos os seus dados serão salvos como arquivos <code style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            background: t.bg2, padding: '1px 4px', borderRadius: 3, color: t.accent,
          }}>.md</code> compatíveis com o Obsidian.
        </p>

        <p style={{
          margin: '0 0 24px', fontSize: 11, color: t.text4,
          fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', lineHeight: 1.5,
        }}>
          tarefas · notas · diário · hábitos · humor · documentos
        </p>

        <button onClick={pick} disabled={selecting} style={{
          padding: '10px 28px', borderRadius: 6,
          background: t.accent, border: 'none',
          color: '#fff', fontSize: 13, fontWeight: 600,
          fontFamily: 'Inter, sans-serif', cursor: selecting ? 'wait' : 'pointer',
          opacity: selecting ? 0.7 : 1,
          transition: 'opacity 0.15s',
          letterSpacing: '0.01em',
        }}>
          {selecting ? 'Abrindo…' : '↗ Escolher pasta do Cofre'}
        </button>

        <p style={{
          margin: '14px 0 0', fontSize: 10, color: t.text4,
          fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
        }}>
          A estrutura de pastas será criada automaticamente.
        </p>
      </div>
    </div>
  )
}
