"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { loadLedgerAction } from "@/app/actions/account"
import type { LedgerEntryView } from "@/lib/account"
import { cn } from "@/lib/utils"

/** The user's credit ledger, newest first, with "Load more". */
export function LedgerTable({
  initial,
  initialCursor,
}: {
  initial: LedgerEntryView[]
  initialCursor: string | null
}) {
  const [items, setItems] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  if (!items.length)
    return (
      <p className="rounded-2xl bg-surface p-6 text-sm text-muted-foreground">
        No credit activity yet.
      </p>
    )
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Activity
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3 font-medium sm:table-cell"
            >
              Bucket
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Credits
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3 text-right font-medium sm:table-cell"
            >
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id} className="border-t border-white/5">
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </td>
              <td className="px-4 py-3">
                {entry.label}
                {entry.note ? (
                  <span className="text-muted-foreground"> · {entry.note}</span>
                ) : null}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground capitalize sm:table-cell">
                {entry.bucket === "topup" ? "Top-up" : "Plan"}
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-mono tabular-nums",
                  entry.delta > 0 ? "text-brand" : "text-foreground"
                )}
              >
                {entry.delta > 0 ? "+" : ""}
                {entry.delta.toLocaleString("en-US")}
              </td>
              <td className="hidden px-4 py-3 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
                {entry.balanceAfter.toLocaleString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cursor ? (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            const result = await loadLedgerAction(cursor)
            setLoading(false)
            if (!result.ok) return
            setItems((current) => [...current, ...result.data.items])
            setCursor(result.data.nextCursor)
          }}
          className="flex w-full items-center justify-center gap-2 border-t border-white/5 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null} Load
          more
        </button>
      ) : null}
    </div>
  )
}
