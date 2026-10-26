"use client"

import { useState, type FormEvent } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Flag, Loader2, X } from "lucide-react"

import { reportGenerationAction } from "@/app/actions/community"
import { useApp, useToast } from "@/components/providers/app-providers"
import { cn } from "@/lib/utils"

type Reason = "sexual" | "violence" | "hate" | "copyright" | "spam" | "other"

const REASONS: { value: Reason; label: string; hint: string }[] = [
  {
    value: "sexual",
    label: "Sexual or explicit",
    hint: "Nudity or sexual content",
  },
  {
    value: "violence",
    label: "Violence or gore",
    hint: "Graphic harm, weapons used on people",
  },
  {
    value: "hate",
    label: "Hate or harassment",
    hint: "Attacks on people or groups",
  },
  {
    value: "copyright",
    label: "Copyright or likeness",
    hint: "Someone else's work, brand or face",
  },
  {
    value: "spam",
    label: "Spam or misleading",
    hint: "Scams, ads, deceptive content",
  },
  { value: "other", label: "Something else", hint: "Tell us below" },
]

/** Small "Report generation" dialog: a reason plus optional details. Signed-in only. */
export function ReportDialog({
  generationId,
  open,
  onOpenChange,
}: {
  generationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { openAuth } = useApp()
  const toast = useToast()
  const [reason, setReason] = useState<Reason | null>(null)
  const [details, setDetails] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (next: boolean) => {
    if (pending) return
    onOpenChange(next)
    if (!next) {
      setReason(null)
      setDetails("")
      setError(null)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!reason) {
      setError("Choose a reason first.")
      return
    }
    setPending(true)
    setError(null)
    const trimmed = details.trim()
    const result = await reportGenerationAction({
      generationId,
      reason,
      ...(trimmed ? { details: trimmed } : {}),
    })
    setPending(false)
    if (result.ok) {
      toast.success("Thanks — report sent", "Our moderators will take a look.")
      onOpenChange(false)
      setReason(null)
      setDetails("")
      return
    }
    if (result.code === "UNAUTHORIZED") {
      onOpenChange(false)
      openAuth({ mode: "login", reason: "Sign in to report a generation." })
      return
    }
    setError(result.error)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/70 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-3xl border border-hairline bg-panel p-5 duration-150 outline-none md:p-6 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/5">
                <Flag className="size-4" aria-hidden />
              </span>
              <div>
                <DialogPrimitive.Title className="text-lg font-semibold">
                  Report generation
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  What&apos;s wrong with it?
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Reason</legend>
              {REASONS.map((item) => (
                <label
                  key={item.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                    reason === item.value
                      ? "border-brand/40 bg-brand/[0.06]"
                      : "border-white/10 bg-surface hover:bg-raised"
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={item.value}
                    checked={reason === item.value}
                    onChange={() => setReason(item.value)}
                    className="size-4 shrink-0 accent-[#ffd700] focus-visible:outline-none"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Details{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </span>
              <textarea
                value={details}
                onChange={(event) =>
                  setDetails(event.target.value.slice(0, 500))
                }
                rows={3}
                maxLength={500}
                placeholder="Anything that helps us review it"
                className="resize-none rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:outline-none"
              />
              <span className="self-end text-[11px] text-muted-foreground tabular-nums">
                {details.length}/500
              </span>
            </label>
            {error ? (
              <p role="alert" className="text-sm text-[#ff6b6b]">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="h-10 rounded-lg bg-white/5 px-4 text-sm font-medium hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-[#11100d] hover:bg-white/90 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Send report
              </button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Report trigger for pages: gates on sign-in, then opens the dialog. */
export function ReportButton({
  generationId,
  className,
}: {
  generationId: string
  className?: string
}) {
  const { user, openAuth } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!user) {
            openAuth({
              mode: "login",
              reason: "Sign in to report a generation.",
            })
            return
          }
          setOpen(true)
        }}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white/5 px-5 text-base font-medium hover:bg-white/10",
          className
        )}
      >
        <Flag className="size-4" aria-hidden /> Report
      </button>
      <ReportDialog
        generationId={generationId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
