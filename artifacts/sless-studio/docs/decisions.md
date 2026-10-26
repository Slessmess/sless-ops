# Decisions

> **Origin:** Sless Studio was forked on 2026-10-20 from
> `github.com/albertshiney/higgsfieldclone` ("Vireo"), a build of the same brief.
> Everything above the "Sless Studio fork" section was decided for Vireo and
> still applies unless that section overrides it.

Every default the brief left to us, and every place the sources disagree.
Newest decisions go at the bottom of each section.

## Brand values (brief placeholders)

| Placeholder | Value | Why |
|---|---|---|
| `BRAND_NAME` | **Sless Studio** | Owner's brand; the studio sits under Sless Is More. |
| `APP_SLUG` | `sless-studio` | |
| `PRODUCTION_URL` | `https://slessismore.org` | Owner-confirmed; change in env (`APP_URL`, `AUTH_URL`) if the studio moves to a subdomain. |
| `EMAIL_FROM` | `Sless Studio <cs@slessismore.org>` | Owner-confirmed. Verify slessismore.org in Resend before launch. |
| `SUPPORT_EMAIL` | `cs@slessismore.org` | Owner-confirmed. |
| `CREDIT_MARKUP` | `2.0` | Owner-confirmed. Sell at 2× the Higgsfield API cost; with `CREDIT_USD_VALUE=0.01` a $0.094 image costs 19 credits. |

## Sources and precedence

1. **Live docs win for API behavior, template wins for UI** (brief §0.3). Model
   files are written from the docs' per-workflow JSON schemas; the template's
   generic `imageModel()` / `videoModel()` defaults are *not* used for any
   model whose documented schema differs from them (all of them, in practice).
2. **Console price list unavailable** (needs the owner's login). We use the
   documented estimate endpoint instead — see Pricing.
3. **`/models` on the API** answers 401 without credentials but is undocumented,
   so we don't depend on it.
4. **CLI `MODELS.md` names are job-set types**, not REST paths (brief §1a). It
   was not used as a source for any REST path.
5. **License:** `higgsfield-ai/app-templates` has no LICENSE file as of
   2026-09-26 (commit `b29cdab`). Higgsfield publishes it as a public shadcn
   registry for scaffolding apps on its API, which is our use. Template
   attribution comments are kept. **Re-check for a LICENSE before launch.**

## Docs vs template (docs win)

| Area | Template | Docs | Resolution |
|---|---|---|---|
| API host | `HF_API_BASE_URL=https://platform.higgsfield.ai` | `https://api.higgsfield.ai` everywhere | Default `https://api.higgsfield.ai`; env-overridable. |
| Flux 2, Flux 3, DoP | model files present | absent from the 82-entry catalog | Listed as **Unverified**, not in the picker. |
| Seedance 2.0 Fast / Mini | `bytedance/seedance-2.0/{fast,mini}` | only base 2.0 workflows | **Unverified**. |
| Seedance 2.5 Edit/Extend video refs | `video: 10` | source video counts toward the 10-video cap → ≤9 extra | `video: 9`; total media ≤ 50 enforced. |
| Grok Imagine Video 1.5 | `{ reference: 8, video: 3 }` via generic mapper | `image_url` **or** `image_urls` ≤7 + `audio_url` ≤1; no `video_urls`; 1080p only without refs | Custom mapper per docs. |
| Wan 2.6 | generic: `aspect_ratio` + duration 4–10 | t2v/i2v have no `aspect_ratio`; duration ∈ {5,10,15}; r2v takes 1–3 **videos** | Custom mapper; three modes. |
| Hailuo 2.3 | generic: sends `aspect_ratio`, `resolution` | neither field exists; duration ∈ {6,10}; `prompt_optimizer` | Custom mapper. |
| Kling 2.5 Turbo | standard i2v only | + Pro t2v and Pro i2v; `cfg_scale`, `negative_prompt`; duration ∈ {5,10} | Two entries (Pro, Standard). |
| Kling 2.6 | duration range 4–10, no sound | duration ∈ {5,10}; `sound` on/off; `cfg_scale` | Custom mapper. |
| Kling 2.6 Motion Control | missing | `kling-video/motion-control/{std,pro}` | Added. |
| Kling O3 / Omni | first-last-frame only | + image-reference, video-edit, video-reference; O3 `mode` std/pro/4k, `sound` default off | Added all workflows. |
| Kling Motion Control | image + video optional | both **required** | `requiredRoles: ["start","source"]` (motion video is the `source` slot, labelled “Motion video”). |
| LTX-2.5 | `t2v()` helper cannot derive the i2v path (path ends in `/fast`) | `…/image-to-video/{fast,pro}` with `end_image_url`; duration ∈ {6,8,10}; fps | Custom mapper with i2v. |
| MiniMax H3, Happy Horse, Wan 2.7, Wan 3.0, PixVerse | text + generic image path only | reference-to-video workflows, end frames, model-specific ranges | Custom mappers per docs. |
| Cinema Studio 4.0, Genjutsu, Marketing Studio Image, Soul (v1) | missing | documented | Added. |
| Seedance 2.5 text-to-video page | — | one page of 81 was not re-read after a tool-permission denial; the endpoint is confirmed by the family page's workflow table and the template mapper | Uses the template mapper (`aspect_ratio`, `duration`, `resolution`, `generate_audio`, `bitrate_mode`), the same fields the sibling i2v/r2v pages document. Re-verify when convenient. |

## Architecture

- **Template scaffold, not a rewrite.** UI components, Quanta tokens, catalog
  contract, polling lessons and upload contract come from the template.
- **Server client:** keep the template's thin `fetch` client
  (`generation/platform.ts`) moved to `lib/higgsfield/client.ts` with
  `server-only`, retries (429/5xx with exponential backoff + full jitter, max 3,
  8 s deadline) for **status/cancel/estimate/upload** only. Submits are **not**
  auto-retried after an ambiguous failure because the docs say submissions do
  not accept an idempotency key; ambiguous submits stay `pending_submit` for the
  reconciler. (Chosen over `@higgsfield/client` v2: fewer moving parts, and the
  template's client already matches the documented contract.)
- **Double-submit guard:** the generation document is created (and credits
  debited) in one transaction *before* the platform call, with a unique
  `submitKey` (client-generated UUID per Generate press). A second press with
  the same key hits the unique index and returns the existing generation.
- **Webhook auth:** docs describe no signature. URL carries
  `gid` + `t = HMAC-SHA256(gid, HF_WEBHOOK_SECRET)` (constant-time compare);
  the payload is never trusted — we re-fetch `GET /requests/{id}/status`.
- **Polling:** the browser polls our `GET /api/generations/status?ids=` (DB
  only) every 3.5 s while anything is in flight — never a server action.
- **Media storage:** Cloudflare R2 via `@aws-sdk/client-s3` + `lib-storage`
  streaming upload. Local dev without R2 credentials falls back to a
  filesystem driver under `.data/media` served by `/api/media/[...key]`
  (development only; production boot fails without R2 env).
- **Email in dev:** without `AUTH_RESEND_KEY` in development, magic links are
  printed to the server log. Production boot fails without it.
- **Env validation:** `lib/env.ts` (zod) validates at boot; production requires
  every service key, development allows the documented fallbacks and prints
  one warning line per fallback.

## Auth

- Auth.js v5, Resend provider (magic link only), MongoDB adapter, database
  sessions, session exposes `user.id` + `user.role` only.
- Rate limits (Mongo TTL collection `rate_limits`): 5 magic-link sends / email /
  hour, 20 / IP / hour; disposable-domain blocklist on (small static list,
  config flag `BLOCK_DISPOSABLE_EMAIL`).
- Signed-out users can browse and open generators; Generate/Upload opens the
  auth modal and the dock state is preserved in localStorage (it already is).

## Credits and pricing

- `credits = ceil(hfUsd × CREDIT_MARKUP / CREDIT_USD_VALUE)`, min 1.
- `priceFor(modelId, settings, media)` is pure, shared by UI and server, unit
  tested. Rules per model: `per_image` (× batch), `per_second` (× duration,
  optional per-resolution multipliers), `flat`, and `per_second_of_source`
  (edit/motion endpoints whose duration follows the source video; billed on a
  declared max — see below).
- **Source-duration models** (Seedance Edit, Kling Motion Control, Genjutsu,
  Kling O3/Omni edit): output length follows the uploaded video, which we can't
  measure before submit without ffprobe. v1 charges for the documented
  **maximum** (e.g. 30 s) up front and **refunds the difference** at finalize
  when the platform reports a shorter output (duration probed from the MP4
  `mvhd` box). Recorded as a `generation_refund` partial with `refType:
  "generation-adjust"`.
- **Three price sources** (`PriceRule.source`): `estimate` (synced from
  `POST /estimate`), `description` (hand-derived from the pricing text that
  token-metered endpoints return instead of numbers — e.g. Seedance 2.5 at
  $0.0214 per 1,000 video tokens, i.e. $0.4622/s at 720p 16:9) and
  `placeholder` (unverified; priced for the local mock only and **not sold on
  the live API** until an admin sets a price). Token-metered models also bill
  input videos: `inputVideo` adds their seconds and applies the 0.6× with-video
  rate; unknown input lengths count as the rule's maximum. MiniMax H3's extra
  reference images use `perItem`.
- **Estimate guard:** before submitting, the server calls
  `POST /estimate/{path}` with the exact body (1.5 s timeout). If the live USD
  would make our price a loss (`liveUsd > credits × CREDIT_USD_VALUE`), the
  submit is refused with "This setting is being repriced — try again shortly"
  and the model is flagged in admin. If the estimate call fails, the submit
  proceeds on the table price (fail-open, logged).
- **Buckets:** `subscription` credits are **reset** on each paid subscription
  invoice; `topup` credits never expire. Spend subscription first. Both are
  flags in `lib/billing/config.ts` (`SUBSCRIPTION_RESETS=true`,
  `SPEND_ORDER=["subscription","topup"]`).
- `SIGNUP_BONUS_CREDITS` default **0** in `.env.example` per the brief; our
  suggested launch value is 50 (enough for ~2 images to try the product).

## Plans (amounts TBD — owner decision)

Structure mirrors higgsfield: Free / Starter / Plus / Ultra, monthly + annual
("20% OFF"), plus three top-up packs. Credit allowances and prices are
`TBD` in `lib/billing/plans.ts` and are the one thing we need from the owner.
Concurrency defaults (parallel generations): Free 1/1, Starter 2 video / 4
image, Plus 6 / 8, Ultra 8 / 12.

## UI

- Dark only, Quanta tokens, lime `#d1fe17` as `--primary`, reserved for the
  Generate CTA and active states.
- Top navigation added (the template's "no app header" rule is overridden by
  the brief: the site's layout is the source of truth for page structure).
- The template's projects-first sidebar moves into `/assets` (Projects rail);
  generator pages use the site's left control panel + right canvas.
- **Audio nav item hidden** while the catalog has no audio models (see
  `model-catalog.md`); appears automatically when one is added.

## Implementation decisions (build)

- **Scaffold:** the shadcn init command was blocked by the tool sandbox, so the
  project was created by copying the cloned template (`b29cdab`) — same files,
  owner-approved.
- **Ledger idempotency key** is `{reason, refType, refId, bucket}` (the brief's
  key plus `bucket`), because one charge can split across the subscription and
  top-up buckets. Refunds return credits to the buckets that paid, top-up first.
- **Signup bonus** goes to the top-up bucket (never expires).
- **Session** exposes `user.id` and `user.role` only; balances are read live
  (`/api/me`, layout). Admins come from `role: "admin"` or `ADMIN_EMAILS`.
- **Submit retries:** only 429/500/503 (answers that prove nothing was created).
  Network errors, timeouts, 502 and 504 are ambiguous → `pending_submit` → the
  reconciler refunds after 2 min; a late webhook still delivers the result.
  400 "concurrency" from the platform is treated as a definite failure + refund.
- **Run timeout** is 30 minutes (`RUN_TIMEOUT_MINUTES`), not the brief's 15:
  30-second Seedance/Wan renders can legitimately exceed 15 minutes, and a
  premature refund would give away paid platform work.
- **Webhook route** replies immediately and finalizes in `after()`; a bad
  token is a 401 (the platform doesn't retry 4xx); a malformed envelope is 400.
- **Source-length pricing:** uploads and outputs are probed server-side
  (MP4 `mvhd`, WAV header), so edit/motion endpoints are priced from the real
  source duration. When unknown, the maximum is charged and the difference is
  refunded at finalize (`generation_adjust`).
- **Price guard:** flags a model at > 1 % drift from the live estimate and
  refuses the submit at > 25 % (break-even stays positive at the cheapest
  effective credit price ≈ $0.007 with a 2× markup). Fails open when the
  estimate call errors.
- **Uploads** use the platform's presigned URL (per the brief), are recorded
  with an HMAC-signed ticket (so the server only fetches URLs the platform
  issued — no SSRF), size-capped per kind (image 20 MB, video 200 MB, audio
  50 MB), and copied to R2 because platform uploads are tagged temporary.
- **Media ownership:** every attachment URL must belong to the caller (their
  upload or their own output); the server swaps in the fetchable URL.
- **Image generator layout** follows the live site (bottom-docked prompt bar,
  the template's `StudioPromptBox`); video/audio use the 320 px left panel.
  The brief described one layout; the site's structure wins.
- **Generate stays available while runs are in flight** (parallel generations
  up to the plan limit); Cancel lives on the queued tile's hover rail.
- **Audio surface** is complete but hidden (nav + `/audio` 404) until an audio
  model exists — the REST API documents none.
- **Local development** runs with no external service: `pnpm db:dev` (MongoDB
  replica set via mongodb-memory-server binaries), `pnpm mock:higgsfield`
  (documented request shapes), dev mailbox for magic links, local media
  storage, in-process reconciler (`instrumentation.ts`).
- **CSP** allows HTTPS in `connect-src` because presigned upload hosts aren't
  pinned by the docs; narrow it with `CSP_CONNECT_SRC` once known.
- **Plan prices** in `lib/billing/plans.ts` are suggested defaults
  (Starter $12 / Plus $35 / Ultra $89 monthly, 20 % off annual; 1,000 / 3,500 /
  9,000 credits; top-ups 500 / 2,200 / 6,000 credits for $5 / $20 / $50) —
  **owner to confirm** before launch.
- **Marketing media** (hero, auth carousel, model covers, preset covers, loops)
  was generated with Soul 2 and Kling 3.0 through the owner's Higgsfield
  account (≈ 56 platform credits), because the app itself needs a platform key
  to generate. Files live in `public/media`.
- **Catalog notes from implementation:** Kling O3/Omni image-reference cap of 7
  images is our choice (the docs set no maximum); Kling Omni duration offers
  5/10 s so both workflows accept it; Happy Horse offers 3–15 s and Wan 2.6
  720p/1080p so every workflow accepts the chosen value; Kling and MiniMax H3
  prompt limits (2,500 / 7,000) are enforced as hard limits although the docs
  say longer prompts are truncated; Ideogram `image_weight` defaults to 50.
- **Webhook signatures:** the JS SDK v2 accepts `webhook.secret` but never
  transmits it — it only appends `hf_webhook=<url>` (`src/v2/client.ts`,
  `subscribe`). The `X-Webhook-Secret-Key` header belongs to the legacy v1
  job-set API. So v2 deliveries carry no signature; we rely on the HMAC token in
  the URL plus re-fetching the status. Revisit if the docs add a signature.
- **Accessibility:** secondary text is `#9a9b9d` (Quanta's `#828282` fails
  4.5:1 on card surfaces). Lighthouse accessibility: 97+ on the generators.


## Sless Studio fork (2026-10-20)

- **Look follows slessismore.org, not higgsfield.ai** (owner request). This
  overrides the brief's "dark UI with a lime accent": warm blacks, cream type,
  signal yellow `#FFD700`, square corners, Anton + wide Archivo. Layout, IA and
  interactions still follow higgsfield.ai. Tokens and rules: `docs/brand.md`.
- **Implemented as overrides, not edits:** the vendored Quanta token files are
  untouched; `styles/theme.css` re-points their primitives (the "lime" ramp now
  holds yellow, the "cool" greys are warm, radii are 2–4 px). App code uses
  `brand`/`hot` Tailwind colors instead of `lime`/`pink`.
- **Fonts are self-hosted** (`app/fonts/`, Fontsource, OFL) via
  `next/font/local`, so builds don't depend on reaching Google Fonts.
- **Copy voice:** professional and plain (owner request): "Create with every
  model.", "Featured models.", "Plans and pricing." The footer carries the
  slessismore.org "Start where the action is." CTA band and links back to the
  parent site.
- **Media removed:** Vireo's songbird hero, the bird illustration used as the
  Recraft cover (Vireo brand motif) and a Soul cover styled like a real
  magazine masthead. Replacements reuse other bundled generations. The rest of
  `public/media` came with the fork and was generated by the original author;
  regenerate it with the owner's account before launch (Phase 7).
- **Logo:** placeholder "S" mark + SLESS / STUDIO wordmark (owner chose a
  placeholder); one component to swap.
- **Mock estimate returns $0:** the mock's flat $0.01 estimate exceeded cheap
  models' price basis (Soul 2 at $0.004) and the price guard refused them, which
  failed 5 E2E specs. The real API is unaffected.
- **Sandbox-friendly tooling:** `PLAYWRIGHT_EXECUTABLE` (E2E) and `CHROME_PATH`
  / `SHOT_DIR` / `FULL` / `ONLY` (screenshots) let the suites run with a bare
  Chromium. Without access to fastdl.mongodb.org, point mongodb-memory-server
  at any `mongod` with `MONGOMS_SYSTEM_BINARY`.
- **Not re-verified in the fork:** the 100 catalog-vs-docs schema tests skip
  without `_reference/docs/digest.md` (a local docs digest the original author
  didn't commit), and the catalog was not re-checked against docs.higgsfield.ai
  for models added since 2026-09-26. Do both before launch.
- **License:** the forked repo has no LICENSE file. Confirm reuse terms with
  its author before launch, as with the Higgsfield template.

## Audio Cleanup (2026-10-21)

Owner request: fix video whose sound distorted because the camera mic was set
too high. Higgsfield's REST API has no audio-repair model, so this is the first
**Sless tool**: a catalog entry with `runner: "local"` whose requests run on our
own servers instead of the platform.

- **Same lifecycle as platform runs.** `lib/tools/jobs.ts` plays the platform's
  part: submit creates a `tool_jobs` document (the generation's `hfRequestId`
  is `sless_<generationId>`), finalize reads its status through
  `lib/generations/platform.ts`, cancel works while queued, refunds and the
  reconciler's timeouts are unchanged. Model paths start with `sless/` and
  never reach Higgsfield; the price guard and `pricing:sync` skip them.
- **Where it runs.** Right after submit (next/server `after`, in the video
  page's function) and from `/api/cron/tools` every minute (Vercel Cron,
  `maxDuration` 800). A worker that dies is retried once after a 12-minute
  lease, then failed and refunded.
- **ffmpeg.** `ffmpeg-static` (FFmpeg 6.0 static build, GPL) is an external
  server package traced into those two functions only (`next.config.ts`).
  Running it on our servers is not distribution. `FFMPEG_PATH` overrides it.
- **The chain** (`lib/tools/audio-filters.ts`) was tuned on synthetic speech
  with known clean references, scored with STOI/ESTOI (intelligibility) and
  SI-SDR:
  - FFmpeg's `adeclip` at its default threshold did nothing; `t=1` helped.
  - Camera audio is AAC, which smears clipped flat tops so no de-clipper finds
    them. We measure the clip level (99.99th-percentile amplitude of the mono
    downmix), square the tops off again at 90 % of it, then de-clip. On AAC
    clips this raised ESTOI 0.686 → 0.726 (6 % of samples clipped, loud crowd)
    and 0.919 → 0.941 (1.3 % clipped). It only runs when ≥ 0.15 % of samples
    sit near the clip level (clean speech: ~0.04 %).
  - Spectral denoise (`afftdn`) didn't raise intelligibility, so only Strong
    uses it, for listening comfort. A compressor lowered STOI (0.962 → 0.883)
    and was dropped. Loudness ends at -16 LUFS / -1.5 dBTP (`loudnorm`).
  - Processing is mono (`rematrix_maxval=1` keeps the clip level at full
    scale), written to both channels. Video is stream-copied.
- **AI voice isolation** sends the de-clipped mono track to ElevenLabs Voice
  Isolator ($0.12/min), then finishes it with the same loudness chain. It is
  hidden (unpriced) when `ELEVENLABS_API_KEY` is unset. Not tested against
  the real ElevenLabs API here (no key); the mock echoes the audio back.
- **Limits and price.** Clips up to 5 minutes: de-clipping heavily clipped
  sound runs at about real time on one CPU. Repair is 1 credit ($0.005 basis);
  isolation is $0.002/s of video + the repair pass (60 s → 25 credits), billed
  on the probed length and trued up when unknown. Source: `internal`.
- **What filters can't do.** Badly overloaded speech loses information that no
  filter restores. A real 30-second wrestling clip (October 2026) showed it:
  the camera had already limited the overload, so there were no flat tops to
  rebuild, yet the voice sat in broadband distortion between its harmonics.
  Repair only made it louder. That is why the AI distortion fix below exists,
  and why the filter mode is now labelled "Quick repair".
- **Fix distorted voices (AI)** (`sless/audio-cleanup/restore`,
  `lib/tools/auphonic.ts`): Auphonic Studio Voice, whose documentation lists
  "distorted or clipped voices from overdriven microphones" as its target
  (https://auphonic.com/help/algorithms/singletrack.html). One production per
  job through the documented REST API — create (algorithms +
  `output_files: [{format: "flac"}]`), upload (`input_file`), start, poll
  `status.json` until 3 / "Done" (2 / "Error" or an `error_message` fails the
  job), read `output_files[].download_url`, download, then DELETE the
  production so no copy of the user's audio stays there. Only documented
  values are sent: `filtermethod: "studiovoice"`, `denoisemethod` `dynamic`
  (Standard) or `speech_isolation` (Strong), amounts `0` (auto), Light without
  denoise; Auphonic's own loudness is off and our -16 LUFS pass finishes it
  (no low-pass, which would undo its rebuilt highs). The model gets the
  original sound (mono FLAC), not our de-clipped version.
- **Its price.** Auphonic bills input length with a 3-minute minimum per
  production, ~$0.0004/s on monthly plans ($13 for 9 h) and more on one-time
  credits; we charge on $0.0006/s + $0.11 per clip (4 s → 23 credits,
  5 min → 58). Free Auphonic accounts add a jingle, so production needs paid
  credits.
- **Its limits.** Not tested against the real Auphonic API here (no key, and
  the sandbox can't reach auphonic.com); the mock and the tests replay the
  documented flow. Without `AUPHONIC_API_KEY` the option is hidden from the
  menu (`optionPaths` in the catalog entry) and unpriced on the server.
- **Test note.** Playwright's bundled Chromium has no H.264/AAC decoder, so
  video tiles look blank in automated screenshots; Chrome and Safari play them.
