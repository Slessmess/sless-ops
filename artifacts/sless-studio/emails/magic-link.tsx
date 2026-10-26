import { Button, Link, Text } from "@react-email/components"

import {
  EMAIL_COLORS,
  EmailFrame,
  heading,
  brandButton,
  paragraph,
} from "./components"

export interface MagicLinkEmailProps {
  url: string
  brand: string
  host: string
  expiresInMinutes: number
  supportEmail: string
}

export function MagicLinkEmail({
  url,
  brand,
  host,
  expiresInMinutes,
  supportEmail,
}: MagicLinkEmailProps) {
  return (
    <EmailFrame
      brand={brand}
      preview={`Your ${brand} sign-in link`}
      footer={
        <>
          You received this because someone asked to sign in to {host} with this
          address. If that wasn&apos;t you, ignore this email — nothing happens
          until the link is clicked. Questions:{" "}
          <Link
            href={`mailto:${supportEmail}`}
            style={{ color: EMAIL_COLORS.muted }}
          >
            {supportEmail}
          </Link>
        </>
      }
    >
      <Text style={heading}>Sign in to {brand}</Text>
      <Text style={paragraph}>
        Use the button below to sign in. No password needed.
      </Text>
      <Button href={url} style={brandButton}>
        Sign in to {brand}
      </Button>
      <Text style={{ ...paragraph, fontSize: 13, margin: "24px 0 8px" }}>
        Or paste this link into your browser:
      </Text>
      <Text
        style={{
          color: EMAIL_COLORS.text,
          fontSize: 12,
          lineHeight: "18px",
          margin: 0,
          wordBreak: "break-all",
        }}
      >
        <Link href={url} style={{ color: EMAIL_COLORS.brand }}>
          {url}
        </Link>
      </Text>
      <Text style={{ ...paragraph, fontSize: 13, margin: "20px 0 0" }}>
        This link expires in {expiresInMinutes} minutes and works once.
      </Text>
    </EmailFrame>
  )
}

export function magicLinkText({
  url,
  brand,
  host,
  expiresInMinutes,
}: MagicLinkEmailProps): string {
  return [
    `Sign in to ${brand}`,
    "",
    `Open this link to sign in to ${host}:`,
    url,
    "",
    `It expires in ${expiresInMinutes} minutes and works once.`,
    "If you didn't ask for this, ignore this email.",
  ].join("\n")
}

MagicLinkEmail.PreviewProps = {
  url: "https://slessismore.org/api/auth/callback/resend?token=preview",
  brand: "Sless Studio",
  host: "slessismore.org",
  expiresInMinutes: 60,
  supportEmail: "cs@slessismore.org",
} satisfies MagicLinkEmailProps

export default MagicLinkEmail
