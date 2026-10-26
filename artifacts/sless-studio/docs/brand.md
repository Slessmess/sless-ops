# Sless Studio brand skin

Sless Studio keeps higgsfield.ai's layout and flows (see `ui-inventory.md`) but
wears the slessismore.org look. Colors were sampled from screenshots of
slessismore.org (October 2026).

## Palette

| Role | Value | Where it lives |
|---|---|---|
| Signal yellow (CTA, active, eyebrows) | `#FFD700` | `--hf-color-lime-500` override → `--color-brand` (`bg-brand`, `text-brand`) |
| Yellow hover | `#FFE14D` | `.btn-keycap:hover` |
| Ink (text on yellow) | `#11100D` | `--color-ink` (`text-ink`) |
| Cream type / paper cards | `#F6F3EB` | `--color-paper`, and Tailwind `white` is remapped to it |
| Cream input fill | `#F3F0E8` | `--color-cream` (login email field) |
| Header | `#0D0D0C` | top nav |
| Page / hero bands | `#11100D` | `--color-page`, `.bg-stripes` sections |
| Panel → raised → hover | `#141310` → `#1B1A16` → `#24221D` → `#2D2A24` | Quanta `cool-*` overrides in `styles/theme.css` |
| Section band | `#141414` | stat strip, footer columns |
| Footer bar | `#0A0A0A` | footer bottom |
| Hairline | `#2D2A24` | `border-hairline` |
| Offset block | `#2A2414` → yellow on hover | `.card-offset` |
| Muted text | `#A8A296` | `--muted-foreground` (≥ 4.5:1 on every surface) |
| Hot accent (badges, warnings, Ultra) | `#FF7A1A` / `#B84300` | `--color-hot`, `--color-hot-strong` |

## Type

| Face | Use | Class |
|---|---|---|
| **Anton** 400, uppercase | Headlines, plan names, numbers ("01") | `.font-display` |
| **Archivo** 800, 112% width, +0.12em tracking, uppercase | Nav, buttons, eyebrows, chips | `.font-label`, `.eyebrow`, `.btn-*` |
| **Inter** | Body and UI text | default |
| **IBM Plex Mono** | Credit balances, costs | `font-mono` |

All four are self-hosted from Fontsource (OFL) in `app/fonts/` — builds never
call Google Fonts.

## Components

- **Buttons are square.** `.btn-keycap` (yellow), `.btn-keycap-white` (cream),
  `.btn-hot` (orange), `.btn-outline` (hairline cream border), `.link-arrow`
  (text + yellow arrow). Hovering a yellow button lifts it onto a cream offset.
- **Eyebrow + headline:** a small yellow wide-tracked kicker over a big cream
  Anton headline, with the second line in yellow ("CREATE WITH / EVERY MODEL.").
- **Paper cards:** cream cards with a yellow number tag and a hard offset block
  (`.card-offset`, `.tag-number`), like the merch drops.
- **Pinstripe bands:** `.bg-stripes` behind heroes and the footer CTA.
- **Radius:** 2 px everywhere (`--radius`, Quanta `--hf-radius-*` overrides);
  only avatars, toggles and dots stay round.

## Voice

Professional, clear and concise. Say what the product does in plain terms
("Create with every model.", "Featured models.", "Plans and pricing."). No puns,
slang or hype words. The footer CTA keeps the parent site's line, "Start where
the action is."

## Logo

`components/site/logo.tsx` (and `app/icon.svg`, `public/icon.svg`) hold a
placeholder mark — a yellow square with an ink "S" — and the SLESS / STUDIO
wordmark. Replace the SVG there when final assets exist.
