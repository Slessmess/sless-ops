"use client"

/* eslint-disable @next/next/no-img-element */
import {
  AtSign,
  ChevronRight,
  Loader2,
  Pencil,
  Sparkle,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react"

import { LoopVideo } from "@/components/media/loop-video"
import { settingLabel } from "@/components/studio/settings-dialog"
import type { GeneratorTab, ModelEntry } from "@/generation/catalog/types"
import { FAMILY_LOOPS, familyCover } from "@/lib/showcase"
import { cn } from "@/lib/utils"

import { Badge, ModelIcon, ModelPicker } from "./model-picker"
import { MediaZone } from "./media-zone"
import { SettingsRow } from "./setting-tiles"
import type { Generator } from "./use-generator"
import { appPath } from "@/lib/paths"

export const TAB_LABEL: Record<
  "image" | "video" | "audio",
  Record<GeneratorTab, string>
> = {
  video: {
    create: "Create Video",
    edit: "Edit Video",
    motion: "Motion Control",
  },
  image: { create: "Create", edit: "Edit", motion: "Motion" },
  audio: { create: "Create Audio", edit: "Edit Audio", motion: "Voice" },
}

export function ModelCard({ generator }: { generator: Generator }) {
  const { model, preset } = generator
  if (!model) return null
  const loop = FAMILY_LOOPS[model.family]
  const cover = preset?.coverUrl ?? familyCover(model.family, model.surface)
  return (
    <div className="relative h-[131px] shrink-0 overflow-hidden rounded-xl bg-surface">
      {(preset?.coverVideoUrl ?? (!preset ? loop : undefined)) ? (
        <LoopVideo
          src={appPath((preset?.coverVideoUrl ?? loop)!)}
          poster={appPath(cover)}
          className="absolute inset-0 size-full"
        />
      ) : (
        <img
          src={appPath(cover)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
      <div className="absolute right-3 bottom-3 left-3">
        <p className="font-display text-xl text-brand">
          {preset ? preset.title : (model.category ?? "GENERAL")}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
          <ModelIcon model={model} className="size-3" /> {model.label}
        </p>
      </div>
      <ModelPicker
        models={generator.models}
        value={model.id}
        onChange={generator.chooseModel}
        trigger={
          <button
            type="button"
            className="absolute top-2 right-2 flex h-6 items-center gap-1 rounded-lg border border-white/5 bg-[#1b1a16]/40 px-2 text-xs text-white backdrop-blur-md hover:bg-[#1b1a16]/70"
          >
            <Pencil className="size-3" /> Change
          </button>
        }
      />
      {preset ? (
        <button
          type="button"
          aria-label="Remove effect"
          onClick={generator.clearPreset}
          className="absolute top-2 left-2 flex h-6 items-center gap-1 rounded-lg bg-black/40 px-2 text-xs text-white backdrop-blur-md"
        >
          Effect <X className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

const PLACEHOLDER: Record<GeneratorTab, string> = {
  create: "Describe the scene you imagine — subject, action, camera, light…",
  edit: "Describe the change — e.g. “make it snow”, “swap the jacket for red leather”…",
  motion: "Optional: describe the scene or style for the result…",
}

export function PromptCard({ generator }: { generator: Generator }) {
  const { model, prompt, setPrompt, settings, preset } = generator
  if (!model || model.noPrompt) return null
  const max = model.maxPromptLength
  const enhanceKey = model.enhanceSetting
  const enhance = enhanceKey ? model.settings[enhanceKey] : undefined
  const audio = model.settings.generateAudio
  const audioOn =
    typeof settings.generateAudio === "boolean"
      ? settings.generateAudio
      : audio?.default === true
  const enhanceOn = enhanceKey
    ? typeof settings[enhanceKey] === "boolean"
      ? (settings[enhanceKey] as boolean)
      : enhance?.default === true
    : false
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <label
        htmlFor={`prompt-${generator.surface}`}
        className="text-sm text-muted-foreground"
      >
        {preset ? "Your subject" : "Prompt"}
        {model.requirePrompt ? "" : preset ? "" : " (optional)"}
      </label>
      <textarea
        id={`prompt-${generator.surface}`}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey) &&
            generator.canGenerate
          ) {
            event.preventDefault()
            void generator.generate()
          }
        }}
        rows={4}
        placeholder={
          preset
            ? `e.g. “a fox in a red scarf” — ${preset.title} adds the look`
            : PLACEHOLDER[generator.tab]
        }
        className="min-h-24 resize-none bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {enhanceKey && enhance?.type === "boolean" ? (
          <button
            type="button"
            role="switch"
            aria-checked={enhanceOn}
            onClick={() => generator.setSetting(enhanceKey, !enhanceOn)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors",
              enhanceOn
                ? "bg-brand/15 text-brand"
                : "bg-panel text-muted-foreground hover:text-foreground"
            )}
          >
            <Wand2 className="size-3.5" />{" "}
            {enhance.label ?? settingLabel(enhanceKey)}
          </button>
        ) : null}
        {audio?.type === "boolean" ? (
          <button
            type="button"
            role="switch"
            aria-checked={audioOn}
            onClick={() => generator.setSetting("generateAudio", !audioOn)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg bg-panel px-2 text-xs font-semibold",
              audioOn ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {audioOn ? (
              <Volume2 className="size-3.5" />
            ) : (
              <VolumeX className="size-3.5" />
            )}
            {/* The accessible name includes the visible text (WCAG 2.5.3). */}
            <span className="sr-only">Generate audio: </span>
            {audioOn ? "On" : "Off"}
          </button>
        ) : null}
        {preset ? (
          <span className="flex h-7 items-center gap-1 rounded-lg bg-panel px-2 text-xs text-muted-foreground">
            <AtSign className="size-3" /> {preset.title} style
          </span>
        ) : null}
        <span
          className={cn(
            "ml-auto font-mono text-[11px] text-muted-foreground tabular-nums",
            max && prompt.length > max && "text-[#ff6b6b]"
          )}
        >
          {prompt.length}
          {max ? `/${max.toLocaleString("en-US")}` : ""}
        </span>
      </div>
    </div>
  )
}

export function ModelRow({ generator }: { generator: Generator }) {
  const { model } = generator
  if (!model) return null
  return (
    <ModelPicker
      models={generator.models}
      value={model.id}
      onChange={generator.chooseModel}
      trigger={
        <button
          type="button"
          className="flex h-12 shrink-0 items-center gap-3 rounded-xl bg-surface px-3 text-left transition-colors hover:bg-raised"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Model</span>
            <span className="flex items-center gap-1.5 text-sm text-foreground">
              <ModelIcon model={model} className="size-3.5" />
              <span className="truncate">{model.label}</span>
              {model.badges?.slice(0, 1).map((badge) => (
                <Badge key={badge} badge={badge} />
              ))}
            </span>
          </span>
          <span className="sr-only">, change model</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      }
    />
  )
}

export function GenerateButton({
  generator,
  className,
}: {
  generator: Generator
  className?: string
}) {
  const { quote, canGenerate, disabledReason, submitting } = generator
  const blocked = !canGenerate
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void generator.generate()}
        disabled={blocked}
        title={blocked ? disabledReason : undefined}
        aria-describedby={
          blocked && disabledReason
            ? `generate-reason-${generator.surface}`
            : undefined
        }
        className="btn-keycap btn-keycap-generate flex h-12 w-full items-center justify-center gap-2 text-sm text-[#161511]"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Generate
        {quote ? (
          <span className="flex items-center gap-1 font-mono">
            <Sparkle className="size-4 fill-current" aria-hidden />
            <span aria-label={`${quote.credits} credits`}>{quote.credits}</span>
            {quote.provisional ? (
              <span className="text-xs opacity-60">max</span>
            ) : null}
          </span>
        ) : null}
      </button>
      {blocked && disabledReason ? (
        <p
          id={`generate-reason-${generator.surface}`}
          className="text-center text-xs text-muted-foreground"
        >
          {disabledReason}
        </p>
      ) : null}
    </div>
  )
}

/** The left control panel (video/audio): tabs → model card → media → prompt → model → settings → Generate. */
export function ControlPanel({ generator }: { generator: Generator }) {
  const { model, tabs, tab, surface } = generator
  if (!model) return null
  return (
    <aside
      aria-label="Generation settings"
      className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-hairline bg-panel md:w-[320px]"
    >
      {tabs.length > 1 ? (
        <div
          className="flex shrink-0 justify-between gap-3 border-b border-hairline px-4"
          role="tablist"
          aria-label="Mode"
        >
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => generator.setTab(value)}
              className={cn(
                "font-label relative h-12 text-[10.5px] !tracking-[0.05em] whitespace-nowrap [font-stretch:100%] transition-colors",
                tab === value
                  ? "text-paper after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-brand"
                  : "text-muted-foreground hover:text-brand"
              )}
            >
              {TAB_LABEL[surface][value]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2 pb-4">
        <ModelCard generator={generator} />
        <MediaZone generator={generator} />
        <PromptCard generator={generator} />
        <ModelRow generator={generator} />
        <SettingsRow
          model={model as ModelEntry}
          values={generator.settings}
          onChange={generator.setSetting}
          hidden={generator.hiddenOptions}
        />
        {generator.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-[#ff7a1a]/10 p-3 text-xs text-[#ffb27a]"
          >
            <span className="flex-1">{generator.error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={generator.clearError}
            >
              <X className="size-3.5" />
            </button>
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 shrink-0 border-t border-white/5 bg-panel p-2">
        <GenerateButton generator={generator} />
      </div>
    </aside>
  )
}
