"use client"

import { useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { useApp } from "@/components/providers/app-providers"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BillingInterval } from "@/lib/billing/plans"

import { IntervalToggle, PlanGrid, TopupGrid } from "./plan-cards"

/** Opened on "not enough credits" and from the nav's Upgrade button. */
export function UpgradeModal() {
  const { upgrade, closeUpgrade, credits } = useApp()
  const [tab, setTab] = useState<"plans" | "credits">("plans")
  const [interval, setInterval] = useState<BillingInterval>("year")
  return (
    <DialogPrimitive.Root
      open={upgrade.open}
      onOpenChange={(open) => !open && closeUpgrade()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(1100px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-3xl border border-hairline bg-panel p-6 duration-200 outline-none md:p-8 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="font-display text-[40px] text-paper md:text-[52px]">
                {upgrade.reason ? "Get more credits" : "Upgrade your plan"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
                {upgrade.reason ??
                  `You have ✦ ${credits ?? 0} credits. Plans refill every month; top-ups never expire.`}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as "plans" | "credits")}
              variant="segmented"
            >
              <TabsList>
                <TabsTrigger value="plans">Plans</TabsTrigger>
                <TabsTrigger value="credits">Top up credits</TabsTrigger>
              </TabsList>
            </Tabs>
            {tab === "plans" ? (
              <IntervalToggle value={interval} onChange={setInterval} />
            ) : null}
          </div>
          {tab === "plans" ? (
            <PlanGrid interval={interval} compact />
          ) : (
            <TopupGrid />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
