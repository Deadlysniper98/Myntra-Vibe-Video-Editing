# Myntra Vibe Video Editing

A clean, Myntra-only distribution of the Vibe video editor. The repository ships one built-in project: **MynnovAIte**, with landscape, vertical, and ultrawide variants.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

For Remotion composition authoring:

```bash
npm run studio
```

## Included compositions

- `MyComp` — 16:9 landscape
- `MyCompVertical` — 9:16 vertical
- `MyCompUltrawide` — 21:9 ultrawide

Generated renders are written to `out/` and are not tracked by Git. Local environment files and API keys are also excluded from version control.
