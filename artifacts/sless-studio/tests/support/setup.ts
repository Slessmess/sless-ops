import { vi } from "vitest"

// Tests price from the checked-in rules (placeholders + description-derived),
// not from whatever `pnpm pricing:sync` last fetched from the live platform.
vi.mock("@/lib/billing/pricing.generated.json", () => ({ default: {} }))
