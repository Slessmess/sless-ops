/** Common throwaway-inbox domains; blocked when BLOCK_DISPOSABLE_EMAIL is on. */
const DISPOSABLE = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "mailinator.com",
  "maildrop.cc",
  "yopmail.com",
  "yopmail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmailo.com",
  "tempr.email",
  "throwawaymail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "mintemail.com",
  "mohmal.com",
  "fakeinbox.com",
  "emailondeck.com",
  "moakt.com",
  "mail.tm",
  "burnermail.io",
  "spamgourmet.com",
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@").pop()?.toLowerCase() ?? ""
  return DISPOSABLE.has(domain)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
