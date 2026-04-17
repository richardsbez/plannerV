import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import { loadInitialData } from './store'
import { vaultAPI, vaultStore } from './vault/api'
import { syncFlushAllPending } from './vault/persistence'
import './index.css'

// ── Flush all pending debounced writes before the window/app closes ───────────
// Two-layer safety net:
//
//   Layer 1 (primary): IPC handshake — main sends 'app:request-flush', we call
//   syncFlushAllPending() and reply with 'app:flush-done'. Main waits for the
//   ack before actually closing. This reliably captures all pending timers
//   regardless of timing.
//
//   Layer 2 (fallback): classic beforeunload sync flush — covers edge cases
//   where the IPC round-trip is skipped (e.g. OS-level kill, Cmd+Q on macOS
//   before the handshake fires).
//
// Previous approach used only beforeunload + a 400ms close-guard delay in main.
// The bug: debounce timers also run at 400ms, so the timer would fire first,
// delete its entry from the Map, then beforeunload found timers.size === 0 and
// flushed nothing, silently dropping the write.
window.electronAPI.onRequestFlush(() => {
  syncFlushAllPending()
  window.electronAPI.notifyFlushDone()
})

window.addEventListener('beforeunload', () => {
  syncFlushAllPending()
})

async function boot() {
  // Pre-load vault data before mounting so the UI doesn't flash empty state.
  // The workspace (layouts + visibility + theme) is applied inside App.tsx
  // after mount via the vault subscription effect — here we just load task data.
  try {
    const vaultPath = await vaultAPI.get()
    if (vaultPath) {
      vaultStore.setPath(vaultPath)
      await loadInitialData()
    }
  } catch (e) {
    console.error('Boot error:', e)
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

boot()
