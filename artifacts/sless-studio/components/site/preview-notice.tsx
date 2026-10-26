/** Small banner shown only in the Replit preview (NEXT_PUBLIC_STUDIO_PREVIEW=true). */
export function PreviewNotice() {
  if (process.env.NEXT_PUBLIC_STUDIO_PREVIEW !== "true") return null
  return (
    <div
      role="note"
      className="font-label relative z-[90] border-b border-brand/40 bg-ink px-3 py-1.5 text-center text-[11px] tracking-wide text-foreground"
    >
      <span className="text-brand">Preview</span> · Local test data. Paid
      image/video generation and payments are disabled here. Quick repair runs
      for real.
    </div>
  )
}
