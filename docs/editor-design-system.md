# Editor design system

Light, wide, minimal UI for the Vibe editor (`src/editor/`). Separate from the
Remotion composition themes in `docs/design-system.md` (Signal Flat / Cinematic) —
this doc is **only** the editor chrome.

## Source of truth

| File | Role |
|---|---|
| `src/editor/design-system.css` | CSS variables + reusable primitives (`ds-*`) |
| `src/editor/editor.css` | Layout-specific styles (projects grid, publish sidebar, timeline…) |

**Rule:** New editor UI uses `ds-*` primitives + tokens. Do not add one-off hex
colors or a second accent (the old purple `#9b87f5` is retired).

## Tokens (edit in `design-system.css`)

### Surfaces
- `--bg` — warm cream app background (`#f8f7f4`)
- `--surface` / `--surface-2` / `--surface-3` — white panels, subtle hovers
- `--card` / `--card-deep` — thumbnail cards, input wells

### Soft gradients (selective use only)
- `--grad-soft` — top bar, settings nav, projects header
- `--grad-hero` — projects home intro band
- `--grad-warm` — empty folder cover placeholders
- `--grad-accent` — progress bars, accent fills (coral → peach)

Palette is peach / mist / cream — **no purple**.

### Ink
- `--ink` — primary text (`#1a1a1f`)
- `--ink-2` — secondary emphasis
- `--mute` / `--mute-2` — labels, hints

### Accent
- `--accent` — **single** brand coral (`#e84a6f`)
- `--accent-soft` — selected pills, chips
- Primary CTAs: `ds-btn--primary` (dark ink fill) or `ds-btn--accent` (coral)

### Radii
- `--radius-sm` (8) — inputs, icon buttons
- `--radius-md` (10) — cards, default buttons
- `--radius-lg` (12) — folder/content cards
- `--radius-pill` — topbar pills, progress

### Type scale
- `--text-2xs` … `--text-xl` — use instead of raw `11px` / `13px` scatter

## Primitives

| Class | Use |
|---|---|
| `ds-overlay` + `ds-dialog` | Modal shell |
| `ds-dialog-nav` + `ds-nav-item` | Settings sidebar |
| `ds-field` | Text inputs, selects, textareas |
| `ds-btn` | Default button |
| `ds-btn--primary` | Dark CTA (Render, Upload) |
| `ds-btn--accent` | Coral CTA (Analyze, Publish) |
| `ds-btn--ghost` / `ds-btn--icon` | Tertiary actions |
| `ds-pill-btn[data-active]` | Toggle groups (format, privacy, fps) |
| `ds-card` | Grouped form sections |
| `ds-chip` | Small badges (counts, scores) |
| `ds-tab[data-active]` | Content tabs in folder view |
| `ds-muted` | Helper copy |

## Motion

- **No hover lift** (`translateY`) on cards/buttons — border/background/shadow only.
- Durations: `--dur-fast` (120ms), easing `--ease-out`.

## Video preview

The player letterbox and timeline controls stay **dark** — correct contrast on
video content. Only the surrounding chrome is light.

## Migrated surfaces

- Settings dialog
- Render dialog
- YouTube publish panel (settings + sidebar fields)
- Pipeline / clipper view
- Projects home typography + search
- Folder + content cards (borders/hover)

## Still on legacy `editor.css` classes

Publish sidebar, bulk upload HUD, video toolbar, manual panels — use tokens via
`var(--*)` but not yet full `ds-*` markup. When touching those files, migrate
fields/buttons to primitives.
