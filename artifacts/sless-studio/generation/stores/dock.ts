import { create } from "zustand"
import { persist } from "zustand/middleware"

import { defaultModel, findModel } from "../catalog"
import type { GeneratorTab, MediaItem, Surface } from "../catalog/types"
import { browserStorage } from "./browser-storage"

/**
 * One controlled dock per surface: tab, model per tab, prompt and
 * attachments. Persisted in localStorage so the dock survives a reload and
 * the magic-link round trip (sign-in continues the action with this state).
 */
export type SurfaceDock = {
  tab: GeneratorTab
  models: Partial<Record<GeneratorTab, string>>
  prompt: string
  media: MediaItem[]
  presetId?: string
}

type DockState = {
  surfaces: Record<Surface, SurfaceDock>
  setTab: (surface: Surface, tab: GeneratorTab) => void
  setModel: (surface: Surface, modelId: string) => void
  setPrompt: (surface: Surface, prompt: string) => void
  setMedia: (surface: Surface, media: MediaItem[]) => void
  setPreset: (surface: Surface, presetId: string | undefined) => void
  clearMedia: (surface: Surface) => void
}

const EMPTY: SurfaceDock = { tab: "create", models: {}, prompt: "", media: [] }

function update(
  state: DockState,
  surface: Surface,
  patch: Partial<SurfaceDock>
): Pick<DockState, "surfaces"> {
  return {
    surfaces: {
      ...state.surfaces,
      [surface]: { ...state.surfaces[surface], ...patch },
    },
  }
}

export const useDock = create<DockState>()(
  persist(
    (set) => ({
      surfaces: { image: EMPTY, video: EMPTY, audio: EMPTY },
      setTab: (surface, tab) =>
        set((state) =>
          state.surfaces[surface].tab === tab
            ? state
            : update(state, surface, { tab, media: [] })
        ),
      setModel: (surface, modelId) =>
        set((state) => {
          const model = findModel(modelId)
          if (!model || model.surface !== surface) return state
          const tab = model.tab ?? "create"
          const current = state.surfaces[surface]
          return update(state, surface, {
            tab,
            models: { ...current.models, [tab]: model.id },
            // Attachments from another tab's workflow rarely fit; keep same-tab ones.
            media: current.tab === tab ? current.media : [],
          })
        }),
      setPrompt: (surface, prompt) =>
        set((state) =>
          state.surfaces[surface].prompt === prompt
            ? state
            : update(state, surface, { prompt })
        ),
      setMedia: (surface, media) =>
        set((state) => update(state, surface, { media })),
      setPreset: (surface, presetId) =>
        set((state) => update(state, surface, { presetId })),
      clearMedia: (surface) =>
        set((state) => update(state, surface, { media: [] })),
    }),
    {
      name: "sless.dock.v1",
      storage: browserStorage(),
      partialize: (state) => ({
        surfaces: Object.fromEntries(
          Object.entries(state.surfaces).map(([key, dock]) => [
            key,
            {
              ...dock,
              media: dock.media.filter((item) => !item.url.startsWith("blob:")),
            },
          ])
        ) as Record<Surface, SurfaceDock>,
      }),
    }
  )
)

/** The active model for a surface+tab, falling back to the catalog default. */
export function activeModelId(
  surface: Surface,
  dock: SurfaceDock
): string | undefined {
  const chosen = dock.models[dock.tab]
  if (chosen && findModel(chosen)?.surface === surface) return chosen
  return defaultModel(surface, dock.tab)?.id
}
