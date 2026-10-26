"use client"

import { useState } from "react"

import { LoginForm } from "@/components/auth/login-form"

/** Full-page sign-in: the modal's form with its own login / sign-up switch. */
export function LoginPanel({
  initialMode,
  callbackUrl,
  reason,
}: {
  initialMode: "login" | "signup"
  callbackUrl: string
  reason?: string
}) {
  const [mode, setMode] = useState(initialMode)
  return (
    <LoginForm
      mode={mode}
      callbackUrl={callbackUrl}
      reason={reason}
      onModeChange={setMode}
    />
  )
}
