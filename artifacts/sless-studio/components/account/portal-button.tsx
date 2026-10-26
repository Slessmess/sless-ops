"use client"

import { useState } from "react"
import { ExternalLink, Loader2 } from "lucide-react"

import { portalAction } from "@/app/actions/billing"
import { useToast } from "@/components/providers/app-providers"

/** Opens the Stripe Customer Portal (plan changes, cancellations, invoices). */
export function PortalButton() {
  const [pending, setPending] = useState(false)
  const toast = useToast()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const result = await portalAction()
        if (result.ok) {
          window.location.assign(result.data.url)
          return
        }
        setPending(false)
        toast.error("Couldn't open billing portal", result.error)
      }}
      className="flex h-11 items-center gap-2 rounded-xl bg-white/5 px-5 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ExternalLink className="size-4" />
      )}
      Manage billing
    </button>
  )
}
