import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CreditCard, Sparkle } from "lucide-react"

import { LedgerTable } from "@/components/account/ledger-table"
import { getAccount, listLedger } from "@/lib/account"
import { currentUser } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Account" }

export default async function AccountPage() {
  const user = await currentUser()
  if (!user) redirect("/login?callbackUrl=/account")
  const [account, ledger] = await Promise.all([
    getAccount(user.objectId),
    listLedger(user.objectId),
  ])
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl">Account</h1>
        <p className="text-sm text-muted-foreground">{account.email}</p>
      </header>

      <section aria-labelledby="balance" className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/10 to-transparent p-5">
          <h2 id="balance" className="text-sm text-muted-foreground">
            Total balance
          </h2>
          <p className="flex items-center gap-2 font-mono text-4xl font-semibold tabular-nums">
            <Sparkle className="size-6 fill-brand text-brand" />{" "}
            {account.total.toLocaleString("en-US")}
          </p>
          <p className="text-xs text-muted-foreground">
            Plan credits are spent first, then top-ups.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5">
          <h2 className="text-sm text-muted-foreground">Plan credits</h2>
          <p className="font-mono text-3xl tabular-nums">
            {account.credits.subscription.toLocaleString("en-US")}
          </p>
          <p className="text-xs text-muted-foreground">
            {account.plan === "free"
              ? "Choose a plan to get monthly credits."
              : `Reset to your ${account.planName} allowance each month${
                  account.planRenewsAt
                    ? ` · renews ${new Date(account.planRenewsAt).toLocaleDateString()}`
                    : ""
                }.`}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5">
          <h2 className="text-sm text-muted-foreground">Top-up credits</h2>
          <p className="font-mono text-3xl tabular-nums">
            {account.credits.topup.toLocaleString("en-US")}
          </p>
          <p className="text-xs text-muted-foreground">Never expire.</p>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface p-5">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="font-display text-2xl">{account.planName}</p>
          {account.planStatus === "canceling" ? (
            <p className="text-xs text-hot">
              Cancels at the end of the period.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            href="/account/billing"
            className="flex h-10 items-center gap-2 rounded-lg bg-white/5 px-4 text-sm font-medium hover:bg-white/10"
          >
            <CreditCard className="size-4" /> Billing
          </Link>
          <Link
            href="/pricing"
            className="btn-keycap flex h-10 items-center px-4 text-xs"
          >
            {account.plan === "free" ? "Choose a plan" : "Change plan"}
          </Link>
        </div>
      </section>

      <section aria-labelledby="history" className="flex flex-col gap-3">
        <h2 id="history" className="text-lg font-semibold">
          Credit history
        </h2>
        <LedgerTable initial={ledger.items} initialCursor={ledger.nextCursor} />
      </section>
    </div>
  )
}
