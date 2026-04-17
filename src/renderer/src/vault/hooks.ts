// ── vault/hooks.ts ────────────────────────────────────────────────────────────
// React hooks that bind vault file I/O to component state.
//
// useVaultFile(path, parse, serialize, defaultValue)
//   – Reads the file on mount, returns [value, setValue].
//   – setValue debounces writes at 400ms (dirty-checking avoids no-op writes).
//   – The global FS watcher pushes external changes back in via the
//     vault:file-changed IPC event.
//
// useVaultWatch(handler)
//   – Subscribes to all FS watch events. Clean up on unmount.

import { useState, useEffect, useRef, useCallback } from 'react'
import { vaultAPI } from './api'
import { debounceWrite } from './persistence'

// ── Generic vault-file hook ──────────────────────────────────────────────────

export function useVaultFile<T>(
  filePath: string | null,         // relative to vault root; null = not ready
  parse:     (raw: string) => T,
  serialize: (val: T) => string,
  defaultValue: T,
  debounceMs = 400,
): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, _setValue]  = useState<T>(defaultValue)
  const [loaded, setLoaded] = useState(false)
  const pendingRef   = useRef<T>(defaultValue)
  const dirtyRef     = useRef(false)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef      = useRef(filePath)
  pathRef.current    = filePath

  // ── Initial read ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!filePath) return
    setLoaded(false)
    vaultAPI.readFile(filePath).then(raw => {
      const parsed = raw !== null ? parse(raw) : defaultValue
      _setValue(parsed)
      pendingRef.current = parsed
      setLoaded(true)
    })
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced write ───────────────────────────────────────────────────────
  // Routes through the shared debounceWrite in persistence.ts so that the
  // central timers Map always reflects all pending writes. This means
  // syncFlushAllPending() (called on close) correctly captures writes
  // initiated by this hook — previously they used vaultAPI.writeFile() directly
  // and were invisible to the flush-on-close mechanism.
  const flush = useCallback(() => {
    if (!dirtyRef.current || !pathRef.current) return
    const content = serialize(pendingRef.current)
    debounceWrite(pathRef.current, content, 400) // 400ms — same as other panels, stays in Map until syncFlushAllPending
    dirtyRef.current = false
  }, [serialize])

  // Flush on unmount
  useEffect(() => () => { flush() }, [flush])

  // ── External FS change ────────────────────────────────────────────────────
  useEffect(() => {
    if (!filePath) return
    const handler = (data: { path: string; content: string }) => {
      if (data.path !== filePath) return
      // Cancel any pending local save (external wins)
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      dirtyRef.current = false
      const parsed = parse(data.content)
      _setValue(parsed)
      pendingRef.current = parsed
    }
    vaultAPI.onFileChanged(handler)
    return () => { /* listeners are cleared globally; per-hook cleanup not needed */ }
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setter ────────────────────────────────────────────────────────────────
  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    _setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      pendingRef.current = resolved
      dirtyRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { flush() }, debounceMs)
      return resolved
    })
  }, [flush, debounceMs])

  return [value, setValue, loaded]
}

// ── Vault FS-watch subscriber ────────────────────────────────────────────────

export type VaultWatchHandler = {
  onChanged?: (data: { path: string; content: string }) => void
  onAdded?:   (data: { path: string; content: string }) => void
  onRemoved?: (data: { path: string }) => void
}

// Central dispatcher — all change events go through one set of listeners
const changeSubscribers  = new Set<(d: { path: string; content: string }) => void>()
const addedSubscribers   = new Set<(d: { path: string; content: string }) => void>()
const removedSubscribers = new Set<(d: { path: string }) => void>()

let watchersInstalled = false

function installWatchers() {
  if (watchersInstalled) return
  watchersInstalled = true
  vaultAPI.onFileChanged(d  => changeSubscribers.forEach(fn => fn(d)))
  vaultAPI.onFileAdded(d    => addedSubscribers.forEach(fn => fn(d)))
  vaultAPI.onFileRemoved(d  => removedSubscribers.forEach(fn => fn(d)))
}

export function useVaultWatch({ onChanged, onAdded, onRemoved }: VaultWatchHandler) {
  useEffect(() => {
    installWatchers()
    if (onChanged) changeSubscribers.add(onChanged)
    if (onAdded)   addedSubscribers.add(onAdded)
    if (onRemoved) removedSubscribers.add(onRemoved)
    return () => {
      if (onChanged) changeSubscribers.delete(onChanged)
      if (onAdded)   addedSubscribers.delete(onAdded)
      if (onRemoved) removedSubscribers.delete(onRemoved)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
