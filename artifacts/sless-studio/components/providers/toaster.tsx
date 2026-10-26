"use client"

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react"
import { create } from "zustand"

import { cn } from "@/lib/utils"

type Tone = "success" | "error" | "info"
type Toast = { id: number; tone: Tone; title: string; description?: string }

const useToasts = create<{
  toasts: Toast[]
  push: (toast: Omit<Toast, "id">) => void
  dismiss: (id: number) => void
}>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = Date.now() + Math.random()
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id }] }))
    window.setTimeout(
      () =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      toast.tone === "error" ? 7000 : 4000
    )
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative toasts: toast.success("Saved"), toast.error("…"). */
export function useToast() {
  const push = useToasts((state) => state.push)
  return {
    success: (title: string, description?: string) =>
      push({ tone: "success", title, ...(description ? { description } : {}) }),
    error: (title: string, description?: string) =>
      push({ tone: "error", title, ...(description ? { description } : {}) }),
    info: (title: string, description?: string) =>
      push({ tone: "info", title, ...(description ? { description } : {}) }),
  }
}

const ICON = { success: CheckCircle2, error: TriangleAlert, info: Info }

export function Toaster() {
  const toasts = useToasts((state) => state.toasts)
  const dismiss = useToasts((state) => state.dismiss)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = ICON[toast.tone]
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="glass pointer-events-auto flex w-full max-w-sm animate-in items-start gap-3 rounded-2xl p-3 pr-2 shadow-lg duration-200 fade-in-0 slide-in-from-bottom-2"
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                toast.tone === "success" && "text-brand",
                toast.tone === "error" && "text-[#ff5c63]",
                toast.tone === "info" && "text-muted-foreground"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
