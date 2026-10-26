"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  cancelGenerationAction,
  deleteGenerationsAction,
  publishGenerationAction,
  refreshGenerationAction,
  submitGenerationAction,
} from "@/app/actions/generations"
import { announceBalanceChange } from "@/components/providers/app-providers"
import type { Surface } from "@/generation/catalog/types"
import type { SubmitInput } from "@/lib/generations/submit"
import { isInFlight, type GenerationView } from "@/lib/generations/view"
import { appPath } from "@/lib/paths"

export const POLL_INTERVAL_MS = 3500
const EMPTY: GenerationView[] = []

export type SubmitOutcome =
  | { ok: true; record: GenerationView }
  | { ok: false; error: string; code: string }

/**
 * The studio's generation controller, backed by MongoDB. Keeps the template's
 * useRuns shape (records / running / submit / cancel / remove) so the feed
 * components don't change. While anything is in flight it polls our own
 * GET /api/generations/status (a plain route, never a server action: Next
 * runs server actions one at a time per client, so a poll there would block
 * the next submit).
 */
export function useRuns(options: {
  surface?: Surface
  projectId?: string
  enabled?: boolean
}) {
  const { surface, projectId, enabled = true } = options
  const [records, setRecords] = useState<GenerationView[]>([])
  // The query whose first page has arrived; `loaded` is derived from it.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const recordsRef = useRef(records)
  useEffect(() => {
    recordsRef.current = records
  }, [records])

  const query = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams(extra)
      if (surface) params.set("surface", surface)
      if (projectId) params.set("projectId", projectId)
      return `/api/generations?${params.toString()}`
    },
    [projectId, surface]
  )

  const merge = useCallback((incoming: GenerationView[]) => {
    if (!incoming.length) return
    setRecords((current) => {
      const byId = new Map(incoming.map((item) => [item.id, item]))
      const merged = current.map((item) => byId.get(item.id) ?? item)
      const known = new Set(current.map((item) => item.id))
      const fresh = incoming.filter((item) => !known.has(item.id))
      return fresh.length
        ? [...fresh, ...merged].sort((a, b) => b.createdAt - a.createdAt)
        : merged
    })
  }, [])

  // Initial page.
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const key = query()
    void fetch(appPath(key), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Could not load generations (${response.status})`)
        return (await response.json()) as {
          items: GenerationView[]
          nextCursor: string | null
        }
      })
      .then((data) => {
        if (!alive) return
        setRecords(data.items)
        setCursor(data.nextCursor)
      })
      .catch((caught: unknown) => {
        if (alive)
          setError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => {
        if (alive) setLoadedFor(key)
      })
    return () => {
      alive = false
    }
  }, [enabled, query])

  const loaded = !enabled || loadedFor === query()
  const running = records.filter((record) => isInFlight(record.status))
  const runningKey = running.map((record) => record.id).join(",")

  // Poll while anything is in flight; stop when nothing is.
  useEffect(() => {
    if (!runningKey) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const response = await fetch(
          appPath(`/api/generations/status?ids=${runningKey}`),
          {
            cache: "no-store",
          }
        )
        if (response.ok) {
          const data = (await response.json()) as { items: GenerationView[] }
          const before = new Map(
            recordsRef.current.map((item) => [item.id, item.status])
          )
          merge(data.items)
          if (
            data.items.some(
              (item) =>
                !isInFlight(item.status) && before.get(item.id) !== item.status
            )
          )
            announceBalanceChange()
        }
      } catch {
        /* transient; next tick retries */
      }
      if (alive) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }
    timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [merge, runningKey])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await fetch(appPath(query({ cursor })), { cache: "no-store" })
      if (response.ok) {
        const data = (await response.json()) as {
          items: GenerationView[]
          nextCursor: string | null
        }
        merge(data.items)
        setCursor(data.nextCursor)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, merge, query])

  const submit = useCallback(
    async (input: SubmitInput): Promise<SubmitOutcome> => {
      setError(null)
      const result = await submitGenerationAction(input)
      if (!result.ok) {
        if (result.code !== "INSUFFICIENT_CREDITS") setError(result.error)
        return result
      }
      merge([result.data])
      announceBalanceChange()
      return { ok: true, record: result.data }
    },
    [merge]
  )

  const cancel = useCallback(
    async (id: string) => {
      const result = await cancelGenerationAction(id)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      merge([result.data])
      announceBalanceChange()
      return true
    },
    [merge]
  )

  const refresh = useCallback(
    async (id: string) => {
      const result = await refreshGenerationAction(id)
      if (result.ok) merge([result.data])
      else setError(result.error)
    },
    [merge]
  )

  const remove = useCallback(async (ids: string[]) => {
    const result = await deleteGenerationsAction(ids)
    if (!result.ok) {
      setError(result.error)
      return false
    }
    const gone = new Set(ids)
    setRecords((current) => current.filter((item) => !gone.has(item.id)))
    return true
  }, [])

  const publish = useCallback(
    async (id: string, isPublic: boolean) => {
      const result = await publishGenerationAction(id, isPublic)
      if (!result.ok) {
        setError(result.error)
        return false
      }
      merge([result.data])
      return true
    },
    [merge]
  )

  const replace = useCallback((view: GenerationView) => merge([view]), [merge])

  return {
    records: enabled ? records : EMPTY,
    running,
    loaded,
    error,
    setError,
    hasMore: cursor !== null,
    loadingMore,
    loadMore,
    submit,
    cancel,
    refresh,
    remove,
    publish,
    replace,
  }
}

export type Runs = ReturnType<typeof useRuns>
