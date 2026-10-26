"use client"

import { create } from "zustand"

import { deleteUploadAction } from "@/app/actions/uploads"
import type { MediaKind } from "@/generation/catalog/types"
import { uploadMedia } from "@/generation/upload"
import { mediaKindFromMime } from "@/generation/upload-contract"
import type { UploadView } from "@/lib/generations/view"
import { appPath } from "@/lib/paths"

export type AssetKind = MediaKind

/** A durable, submit-ready media reference: `src` is a URL our server can resolve. */
export interface AssetSelection {
  id: string
  src: string
  kind: AssetKind
  name?: string
  durationSec?: number
}

export interface AssetLibraryItem extends AssetSelection {
  source: "upload" | "generation"
  createdAt: number
}

export function uploadToLibraryItem(upload: UploadView): AssetLibraryItem {
  return {
    id: upload.url,
    src: upload.url,
    kind: upload.kind,
    name: upload.name,
    source: "upload",
    createdAt: upload.createdAt,
    ...(upload.durationSec ? { durationSec: upload.durationSec } : {}),
  }
}

type UploadsState = {
  uploads: UploadView[]
  loaded: boolean
  loading: boolean
  load: (force?: boolean) => Promise<void>
  add: (upload: UploadView) => void
  remove: (id: string) => Promise<void>
}

/** The signed-in user's uploads (server-backed; loaded on first use). */
export const useUploads = create<UploadsState>((set, get) => ({
  uploads: [],
  loaded: false,
  loading: false,
  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return
    set({ loading: true })
    try {
      const response = await fetch(appPath("/api/uploads"), { cache: "no-store" })
      if (response.ok) {
        const data = (await response.json()) as { items: UploadView[] }
        set({ uploads: data.items, loaded: true })
      }
    } finally {
      set({ loading: false })
    }
  },
  add: (upload) =>
    set((state) => ({
      uploads: [
        upload,
        ...state.uploads.filter((item) => item.id !== upload.id),
      ],
    })),
  remove: async (id) => {
    const result = await deleteUploadAction(id)
    if (!result.ok) throw new Error(result.error)
    set((state) => ({
      uploads: state.uploads.filter((item) => item.id !== id),
    }))
  },
}))

export function kindOf(file: File): AssetKind {
  return mediaKindFromMime(file.type)
}

/** Upload a file and record it; resolves to a library item ready to attach. */
export async function uploadAsset(file: File): Promise<AssetLibraryItem> {
  const upload = await uploadMedia(file)
  useUploads.getState().add(upload)
  return uploadToLibraryItem(upload)
}
