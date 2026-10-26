"use client"

import {
  JustifiedGallery,
  type JustifiedGalleryProps,
} from "./gallery/justified-gallery"

/**
 * UserGenerations — THE component for any browsable feed of the current user's
 * own generations. Everything the feed needs (virtualized justified gallery,
 * hover actions, the detail lightbox, generating/failed tiles, density control,
 * infinite scroll, optional multi-select) lives inside; screens render this,
 * never the gallery folder.
 */
export type UserGenerationsProps = Omit<JustifiedGalleryProps, "grouped">

export function UserGenerations(props: UserGenerationsProps) {
  return <JustifiedGallery grouped={false} {...props} />
}
