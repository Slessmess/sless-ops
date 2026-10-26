import { findModel } from "@/generation/catalog"

/** "aspectRatio" → "Aspect ratio", "generate_audio" → "Generate audio". */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

/** Readable key/value rows for a generation's settings, using the model's own labels. */
export function settingRows(
  modelId: string,
  settings: Record<string, unknown>
): { id: string; label: string; value: string }[] {
  const fields = findModel(modelId)?.settings ?? {}
  const rows: { id: string; label: string; value: string }[] = []
  for (const [key, raw] of Object.entries(settings)) {
    if (raw === undefined || raw === null || raw === "") continue
    if (typeof raw === "object") continue
    const field = fields[key]
    let value: string
    if (typeof raw === "boolean") value = raw ? "On" : "Off"
    else if (field?.type === "enum" && field.labels?.[String(raw)])
      value = field.labels[String(raw)]!
    else if (field?.type === "range" && field.unit)
      value = `${String(raw)}${field.unit}`
    else value = String(raw)
    rows.push({ id: key, label: field?.label ?? humanizeKey(key), value })
  }
  return rows
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? "V").toUpperCase()
}
