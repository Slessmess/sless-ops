"use client"

import type { ReactNode } from "react"
import { Popover } from "@base-ui/react/popover"
import {
  AudioLines,
  Clock3,
  Gem,
  RectangleHorizontal,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react"

import {
  SettingsDialog,
  settingLabel,
} from "@/components/studio/settings-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { ModelEntry, SettingField } from "@/generation/catalog/types"
import { cn } from "@/lib/utils"

/** Settings shown inline as tiles; everything else lives behind "More". */
export const INLINE_KEYS = [
  "cleanup",
  "duration",
  "aspectRatio",
  "resolution",
  "quality",
] as const

const ICONS: Record<string, ReactNode> = {
  cleanup: <AudioLines className="size-4" />,
  duration: <Clock3 className="size-4" />,
  aspectRatio: <RectangleHorizontal className="size-4" />,
  resolution: <Gem className="size-4" />,
  quality: <Sparkles className="size-4" />,
}

export function displaySetting(field: SettingField, value: unknown): string {
  if (field.type === "enum") {
    const raw = typeof value === "string" ? value : field.default
    return field.labels?.[raw] ?? raw
  }
  if (field.type === "range") {
    const raw = typeof value === "number" ? value : field.default
    return `${raw}${field.unit ?? ""}`
  }
  return (typeof value === "boolean" ? value : field.default) ? "On" : "Off"
}

function AspectGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number)
  if (!w || !h)
    return (
      <span
        className="size-3 rounded-[2px] border border-current opacity-60"
        aria-hidden
      />
    )
  const scale = 12 / Math.max(w, h)
  return (
    <span
      className="inline-block rounded-[2px] border border-current"
      style={{ width: Math.max(4, w * scale), height: Math.max(4, h * scale) }}
      aria-hidden
    />
  )
}

export function SettingTile({
  name,
  field,
  value,
  onChange,
  className,
  hidden,
}: {
  name: string
  field: SettingField
  value: unknown
  onChange: (value: unknown) => void
  className?: string
  /** Values this deployment can't run (kept if already selected). */
  hidden?: readonly string[]
}) {
  const label = field.label ?? settingLabel(name)
  const icon = ICONS[name] ?? <SlidersHorizontal className="size-4" />
  const tileClass = cn(
    "flex h-10 min-w-0 items-center gap-2 rounded-lg bg-surface px-3 text-left text-[15px] text-foreground transition-colors hover:bg-raised data-[popup-open]:bg-raised",
    className
  )

  if (field.type === "enum") {
    const current = typeof value === "string" ? value : field.default
    return (
      <Select
        value={current}
        onValueChange={(next) => next != null && onChange(String(next))}
      >
        <SelectTrigger
          bare
          aria-label={label}
          render={<button type="button" className={tileClass} />}
        >
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <SelectValue className="truncate">
            {() => displaySetting(field, current)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          variant="picker"
          surface="solid"
          side="top"
          align="start"
          sideOffset={8}
        >
          {field.values
            .filter((option) => option === current || !hidden?.includes(option))
            .map((option) => (
              <SelectItem key={option} value={option}>
                {name === "aspectRatio" ? <AspectGlyph ratio={option} /> : null}
                <SelectItemText>
                  {field.labels?.[option] ?? option}
                </SelectItemText>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === "range") {
    const current = typeof value === "number" ? value : field.default
    return (
      <Popover.Root>
        <Popover.Trigger
          aria-label={`${label}: ${displaySetting(field, current)}`}
          className={tileClass}
        >
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="truncate">{displaySetting(field, current)}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="top"
            align="start"
            sideOffset={8}
            className="z-50"
          >
            <Popover.Popup className="flex w-72 flex-col gap-3 rounded-2xl border border-white/5 bg-page p-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)] outline-none">
              <div className="flex items-center justify-between text-sm">
                <Popover.Title className="font-medium">
                  Choose {label.toLowerCase()}
                </Popover.Title>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {displaySetting(field, current)}
                </span>
              </div>
              <Slider
                aria-label={label}
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                value={[current]}
                onValueChange={(next) =>
                  onChange(Array.isArray(next) ? next[0] : next)
                }
              />
              <div className="flex justify-between font-mono text-xs text-muted-foreground">
                <span>
                  {field.min}
                  {field.unit}
                </span>
                <span>
                  {field.max}
                  {field.unit}
                </span>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  const current = typeof value === "boolean" ? value : field.default
  return (
    <button
      type="button"
      role="switch"
      aria-checked={current}
      onClick={() => onChange(!current)}
      className={tileClass}
    >
      <span className="text-muted-foreground">
        {current ? (
          <Volume2 className="size-4" />
        ) : (
          <VolumeX className="size-4" />
        )}
      </span>
      <span className="sr-only">{label}: </span>
      {displaySetting(field, current)}
    </button>
  )
}

/** The settings row: headline tiles plus "More" for every other catalog setting. */
export function SettingsRow({
  model,
  values,
  onChange,
  hidden,
}: {
  model: ModelEntry
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  hidden?: Record<string, readonly string[]>
}) {
  const inline = INLINE_KEYS.filter((key) => model.settings[key]).slice(0, 3)
  const rest = Object.keys(model.settings).filter(
    (key) =>
      !(inline as readonly string[]).includes(key) &&
      key !== model.enhanceSetting &&
      key !== "generateAudio"
  )
  return (
    <div className="flex flex-wrap gap-2">
      {inline.map((key) => (
        <SettingTile
          key={key}
          name={key}
          field={model.settings[key]!}
          value={values[key]}
          onChange={(value) => onChange(key, value)}
          className="flex-1 basis-[84px]"
          hidden={hidden?.[key]}
        />
      ))}
      {rest.length ? (
        <SettingsDialog
          model={model}
          values={values}
          onChange={onChange}
          hidden={hidden}
          trigger={
            <button
              type="button"
              aria-label="More settings"
              title="More settings"
              className="flex h-10 items-center gap-2 rounded-lg bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
            >
              <SlidersHorizontal className="size-4" /> More
            </button>
          }
        />
      ) : null}
    </div>
  )
}
