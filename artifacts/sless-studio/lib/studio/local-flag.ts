"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * A localStorage value as React state without effects: read with
 * useSyncExternalStore (server snapshot = null), written through `set`, and
 * re-read when this tab or another one changes it.
 */
const EVENT = "sless:local-flag"

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

export function useLocalFlag(
  key: string
): [string | null, (value: string | null) => void, boolean] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) localStorage.removeItem(key)
        else localStorage.setItem(key, next)
      } catch {}
      window.dispatchEvent(new Event(EVENT))
    },
    [key]
  )
  return [value, set, hydrated]
}

/** True after hydration (client), false during SSR — without an effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  )
}
