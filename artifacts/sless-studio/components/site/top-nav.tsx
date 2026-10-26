"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  CreditCard,
  FolderOpen,
  Gem,
  LogOut,
  Menu,
  Shield,
  Sparkle,
  UserRound,
  X,
} from "lucide-react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { signOutAction } from "@/app/actions/auth"
import { useApp } from "@/components/providers/app-providers"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { Logo } from "./logo"
import { navLinks } from "./nav-links"
import { appPath } from "@/lib/paths"

/**
 * The site header: logo · Explore · Image · Video · (Audio) · Effects ·
 * Community · Pricing, then the credit pill, Upgrade and the avatar menu
 * (or Login / Sign up). `compact` is the 36 px app-page variant.
 */
export function TopNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const links = navLinks()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex w-full shrink-0 items-center gap-6 border-b border-hairline bg-[#0d0d0c]/95 px-4 backdrop-blur-sm md:px-6",
        compact ? "h-14" : "h-[72px]"
      )}
    >
      <Logo compact={compact} />
      <nav
        aria-label="Main"
        className="hidden min-w-0 flex-1 items-stretch gap-1 self-stretch md:flex lg:gap-3"
      >
        {links.map((link) => {
          const active = link.match(pathname)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "font-label relative flex items-center px-2 text-[12px] whitespace-nowrap transition-colors duration-200 lg:text-[13px]",
                "after:absolute after:inset-x-2 after:bottom-[22%] after:h-[3px] after:bg-brand after:transition-transform after:duration-200",
                active
                  ? "text-paper after:scale-x-100"
                  : "text-paper/85 after:scale-x-0 hover:text-brand"
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <AccountControls compact={compact} />
        <button
          type="button"
          aria-label="Open menu"
          className="flex size-10 items-center justify-center border border-hairline text-foreground md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </button>
      </div>
      <MobileSheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        pathname={pathname}
      />
    </header>
  )
}

function AccountControls({ compact }: { compact: boolean }) {
  const { user, credits, openAuth, openUpgrade } = useApp()
  const height = compact ? "h-8" : "h-9"
  if (!user)
    return (
      <>
        <button
          type="button"
          onClick={() => openAuth({ mode: "login" })}
          className={cn("btn-outline hidden px-4 text-[12px] sm:block", height)}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => openAuth({ mode: "signup" })}
          className={cn("btn-keycap px-4 text-[12px]", height)}
        >
          Sign up
        </button>
      </>
    )
  return (
    <>
      <Link
        href="/account"
        aria-label={`${credits ?? 0} credits — account`}
        className={cn(
          "flex items-center gap-1.5 border border-hairline bg-white/[0.03] px-3 font-mono text-sm text-foreground tabular-nums transition-colors hover:border-brand/60",
          height
        )}
      >
        <Sparkle className="size-3.5 fill-brand text-brand" aria-hidden />
        {credits === null ? "—" : credits.toLocaleString("en-US")}
      </Link>
      <button
        type="button"
        onClick={() => openUpgrade()}
        className={cn(
          "btn-keycap hidden items-center gap-1.5 px-4 text-[12px] sm:flex",
          height
        )}
      >
        <Gem className="size-3.5" aria-hidden /> Upgrade
      </button>
      <UserMenu />
    </>
  )
}

function UserMenu() {
  const { user } = useApp()
  if (!user) return null
  const initial = (user.name || user.email).slice(0, 1).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="font-display flex size-9 items-center justify-center overflow-hidden bg-raised text-base text-foreground ring-1 ring-white/10 transition hover:ring-brand"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar from the auth provider
          <img src={appPath(user.image)} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {user.email}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/assets" />}>
          <FolderOpen /> Assets
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound /> Account
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/billing" />}>
          <CreditCard /> Billing
        </DropdownMenuItem>
        {user.role === "admin" ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <Shield /> Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOutAction()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileSheet({
  open,
  onOpenChange,
  pathname,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathname: string
}) {
  const { user, openAuth, openUpgrade } = useApp()
  const close = () => onOpenChange(false)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="bg-stripes fixed inset-y-0 right-0 z-50 flex w-[min(330px,88vw)] flex-col gap-2 border-l border-hairline bg-panel p-4 duration-200 outline-none data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right">
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="sr-only">
              Menu
            </DialogPrimitive.Title>
            <Logo compact />
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="flex size-10 items-center justify-center border border-hairline"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="Mobile" className="mt-4 flex flex-col gap-1">
            {navLinks().map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={link.match(pathname) ? "page" : undefined}
                className={cn(
                  "font-display border-b border-hairline px-1 py-3 text-[28px]",
                  link.match(pathname)
                    ? "text-brand"
                    : "text-foreground hover:text-brand"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/assets"
                  onClick={close}
                  className="font-display border-b border-hairline px-1 py-3 text-[28px] hover:text-brand"
                >
                  Assets
                </Link>
                <Link
                  href="/account"
                  onClick={close}
                  className="font-display border-b border-hairline px-1 py-3 text-[28px] hover:text-brand"
                >
                  Account
                </Link>
              </>
            ) : null}
          </nav>
          <div className="mt-auto flex flex-col gap-2">
            {user ? (
              <button
                type="button"
                className="btn-keycap h-12 text-sm"
                onClick={() => {
                  close()
                  openUpgrade()
                }}
              >
                Upgrade
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-keycap h-12 text-sm"
                  onClick={() => {
                    close()
                    openAuth({ mode: "signup" })
                  }}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  className="btn-outline h-12 text-sm"
                  onClick={() => {
                    close()
                    openAuth({ mode: "login" })
                  }}
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
