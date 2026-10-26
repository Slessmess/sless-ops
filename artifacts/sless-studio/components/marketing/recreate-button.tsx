"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import { Sparkles } from "lucide-react"

import { findModel } from "@/generation/catalog"
import type { Surface } from "@/generation/catalog/types"
import { useDock } from "@/generation/stores/dock"
import { useSettings } from "@/generation/stores/settings"
import { useToast } from "@/components/providers/app-providers"
import { cn } from "@/lib/utils"

export interface RecreateSource {
  surface: Surface
  modelId: string
  prompt: string
  settings: Record<string, unknown>
}

/**
 * Load a public generation's recipe into the generator dock (prompt, model,
 * settings) and open that generator. The dock lives in zustand/localStorage,
 * so the prompt survives the navigation without going into the URL.
 */
export function useRecreate() {
  const router = useRouter()
  const toast = useToast()
  return useCallback(
    async (source: RecreateSource) => {
      const model = findModel(source.modelId)
      if (!model || model.surface !== source.surface) {
        toast.error(
          "This model isn't available anymore",
          "Pick another model in the generator."
        )
        router.push(`/${source.surface}`)
        return
      }
      if (!useDock.persist.hasHydrated()) await useDock.persist.rehydrate()
      if (!useSettings.persist.hasHydrated())
        await useSettings.persist.rehydrate()
      const dock = useDock.getState()
      dock.setModel(source.surface, model.id)
      dock.setPreset(source.surface, undefined)
      dock.setPrompt(source.surface, source.prompt)
      if (Object.keys(source.settings).length > 0)
        useSettings.getState().set(model.id, source.settings)
      router.push(`/${source.surface}?model=${encodeURIComponent(model.id)}`)
    },
    [router, toast]
  )
}

export function RecreateButton({
  source,
  className,
  label = "Recreate",
}: {
  source: RecreateSource
  className?: string
  label?: string
}) {
  const recreate = useRecreate()
  return (
    <button
      type="button"
      onClick={() => void recreate(source)}
      className={cn(
        "btn-keycap inline-flex h-12 items-center justify-center gap-2 px-5 text-sm",
        className
      )}
    >
      <Sparkles className="size-4" aria-hidden /> {label}
    </button>
  )
}
