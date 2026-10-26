import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

export const EMAIL_COLORS = {
  page: "#0A0A0A",
  card: "#11100D",
  border: "#2D2A24",
  text: "#F6F3EB",
  muted: "#A39E92",
  brand: "#FFD700",
  onBrand: "#11100D",
} as const

const font =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
/** Condensed heavy display stack (web fonts are unreliable in mail clients). */
const display =
  "Anton, Impact, 'Arial Narrow Bold', 'Helvetica Neue Condensed', 'Arial Black', sans-serif"

/** Shared dark frame for every Sless Studio email. */
export function EmailFrame({
  preview,
  brand,
  children,
  footer,
}: {
  preview: string
  brand: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: EMAIL_COLORS.page,
          fontFamily: font,
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: EMAIL_COLORS.card,
            border: `1px solid ${EMAIL_COLORS.border}`,
            borderRadius: 0,
            borderTop: `4px solid ${EMAIL_COLORS.brand}`,
            maxWidth: 520,
            padding: "36px 36px 28px",
          }}
        >
          <Section>
            <Text
              style={{
                color: EMAIL_COLORS.brand,
                fontFamily: display,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.22em",
                margin: "0 0 28px",
                textTransform: "uppercase",
              }}
            >
              {brand}
            </Text>
          </Section>
          {children}
          <Hr
            style={{ borderColor: EMAIL_COLORS.border, margin: "28px 0 16px" }}
          />
          <Text
            style={{
              color: EMAIL_COLORS.muted,
              fontSize: 12,
              lineHeight: "18px",
              margin: 0,
            }}
          >
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const heading = {
  color: EMAIL_COLORS.text,
  fontFamily: display,
  fontSize: 32,
  fontWeight: 400,
  letterSpacing: "0.01em",
  lineHeight: "34px",
  margin: "0 0 12px",
  textTransform: "uppercase" as const,
}

export const paragraph = {
  color: EMAIL_COLORS.muted,
  fontSize: 15,
  lineHeight: "24px",
  margin: "0 0 24px",
}

export const brandButton = {
  backgroundColor: EMAIL_COLORS.brand,
  borderRadius: 0,
  color: EMAIL_COLORS.onBrand,
  display: "block",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "0.14em",
  padding: "18px 24px",
  textTransform: "uppercase" as const,
  textAlign: "center" as const,
  textDecoration: "none",
}
