/** Public brand constants, safe for client and server. */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Sless Studio",
  /** Parent brand: the studio lives under slessismore.org. */
  parent: "Sless Is More",
  parentUrl: "https://slessismore.org",
  tagline: "Every leading AI model. One studio.",
  description:
    "Sless Studio is the AI image and video studio from Sless Is More. Seedance, Kling, Soul and 40+ more models — one credit balance, one library.",
  productionUrl: "https://slessismore.org",
  supportEmail: "cs@slessismore.org",
  /** Dismissible promo bar above the nav; empty string hides it. */
  promo: process.env.NEXT_PUBLIC_PROMO_BAR ?? "",
  promoHref: process.env.NEXT_PUBLIC_PROMO_HREF ?? "/pricing",
} as const
