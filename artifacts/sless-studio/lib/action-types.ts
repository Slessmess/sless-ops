/** Result of every server action (shared with client components). */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; code: string }
