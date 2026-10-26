import { cn } from "@/lib/utils"

const STRIPES_MASK =
  "radial-gradient(ellipse 80% 70% at 50% 35%, #000 0%, transparent 80%)"

/**
 * The studio's backdrop: the slessismore.org diagonal pinstripe, faded at the
 * edges, under a faint yellow glow. Purely decorative.
 */
export function Atmosphere({
  className,
  glow = "top",
}: {
  className?: string
  glow?: "top" | "bottom" | "center"
}) {
  const at =
    glow === "top" ? "50% 0%" : glow === "bottom" ? "50% 100%" : "50% 50%"
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(60% 55% at ${at}, rgba(255,215,0,0.07) 0%, rgba(255,215,0,0.02) 45%, transparent 75%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(246,243,235,0.035) 0 1px, transparent 1px 26px)",
          maskImage: STRIPES_MASK,
          WebkitMaskImage: STRIPES_MASK,
        }}
      />
    </div>
  )
}
