import { MongoDBAdapter } from "@auth/mongodb-adapter"
import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth"
import type { Adapter, AdapterUser } from "next-auth/adapters"
import Resend from "next-auth/providers/resend"
import { ObjectId } from "mongodb"

import MagicLinkEmail, { magicLinkText } from "@/emails/magic-link"
import { isDisposableEmail, normalizeEmail } from "@/lib/auth/disposable"
import { BRAND } from "@/lib/brand"
import { grantCredits } from "@/lib/billing/ledger"
import type { Role } from "@/lib/db/collections"
import { mongoClient } from "@/lib/db/mongo"
import { isE2eAddress, sendEmail } from "@/lib/email/send"
import { env } from "@/lib/env"
import { rateLimit } from "@/lib/rate-limit"
import { appPath } from "@/lib/paths"

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"]
  }
}

const MAGIC_LINK_MAX_AGE = 60 * 60

/** Adapter that creates users with our defaults (role, empty buckets, plan). */
function adapter(): Adapter {
  const base = MongoDBAdapter(() => mongoClient(), {
    databaseName: env().MONGODB_DB,
  })
  return {
    ...base,
    async createUser(user) {
      const email = normalizeEmail(user.email)
      const doc = {
        ...user,
        email,
        role: env().ADMIN_EMAILS.includes(email) ? "admin" : "user",
        credits: { subscription: 0, topup: 0 },
        plan: "free",
        createdAt: new Date(),
      }
      return base.createUser!(doc)
    },
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

function config(): NextAuthConfig {
  const value = env()
  return {
    adapter: adapter(),
    session: { strategy: "database", maxAge: 60 * 60 * 24 * 30 },
    trustHost: true,
    basePath: appPath("/api/auth"),
    providers: [
      Resend({
        apiKey: value.AUTH_RESEND_KEY ?? "dev-console",
        from: value.EMAIL_FROM,
        maxAge: MAGIC_LINK_MAX_AGE,
        normalizeIdentifier: normalizeEmail,
        async sendVerificationRequest({ identifier, url, request }) {
          const email = normalizeEmail(identifier)
          // Backstop for direct calls to /api/auth/signin/resend; the login
          // action applies the user-facing limits with friendly messages.
          if (value.BLOCK_DISPOSABLE_EMAIL && isDisposableEmail(email))
            throw new Error("Disposable email addresses are not supported.")
          const [byEmail, byIp] = await Promise.all([
            rateLimit(`auth:send:${email}`, 8, 60 * 60),
            isE2eAddress(email)
              ? { ok: true }
              : rateLimit(`auth:send-ip:${clientIp(request)}`, 30, 60 * 60),
          ])
          if (!byEmail.ok || !byIp.ok)
            throw new Error("Too many sign-in emails. Try again later.")
          const host = new URL(url).host
          const props = {
            url,
            brand: BRAND.name,
            host,
            expiresInMinutes: MAGIC_LINK_MAX_AGE / 60,
            supportEmail: value.SUPPORT_EMAIL,
          }
          await sendEmail({
            to: email,
            subject: `Sign in to ${BRAND.name}`,
            react: MagicLinkEmail(props),
            text: magicLinkText(props),
            devUrl: url,
          })
        },
      }),
    ],
    pages: {
      signIn: appPath("/login"),
      verifyRequest: appPath("/login/check-email"),
      error: appPath("/login/error"),
    },
    callbacks: {
      redirect({ url, baseUrl }) {
        if (url.startsWith("/") && !url.startsWith("//"))
          return `${new URL(baseUrl).origin}${appPath(url)}`
        try {
          const target = new URL(url)
          if (target.origin === new URL(baseUrl).origin)
            return `${target.origin}${appPath(target.pathname)}${target.search}${target.hash}`
        } catch { /* Fall through to a safe local destination. */ }
        return `${new URL(baseUrl).origin}${appPath("/")}`
      },
      session({ session, user }) {
        const stored = user as AdapterUser & { role?: Role }
        const admin =
          stored.role === "admin" ||
          env().ADMIN_EMAILS.includes(normalizeEmail(stored.email))
        // Only identity and role: balances go stale, so they are read live.
        session.user = {
          ...session.user,
          id: stored.id,
          role: admin ? "admin" : "user",
        }
        return session
      },
    },
    events: {
      async createUser({ user }) {
        const bonus = env().SIGNUP_BONUS_CREDITS
        if (!user.id || bonus <= 0) return
        await grantCredits({
          userId: new ObjectId(user.id),
          bucket: "topup",
          amount: bonus,
          reason: "signup_bonus",
          refType: "user",
          refId: user.id,
          note: "Welcome credits",
        })
      },
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => config())
