# ✦ Northstar Board

A **local-first constellation planner** for solo founders. Turn your goals,
milestones, and dependencies into a night sky you can read at a glance — then
actually steer by.

No accounts. No servers. No build step. Open `index.html`, pick a northstar,
and start plotting.

<p align="center"><em>Zero dependencies · 100% vanilla JS · Data never leaves your browser</em></p>

---

## Why

Most planning tools are lists trying to be maps. Northstar Board is a map on
purpose. A goal's **magnitude** sets how brightly it burns. Its **status**
sets its color. Its **dependencies** are the faint lines that connect stars
into a constellation, so you can squint at the board and see where the work
actually converges.

It's meant for one person with one ambition and too many half-plans — the
founder, the grad student, the person quietly shipping a side project.

## Features

- **Visual constellation** — every goal and milestone is a star, with a glow
  and a halo. Bigger magnitude = brighter star.
- **Status at a glance** — Planned · In flight · Achieved · Blocked, each with
  a distinct tint and ring treatment.
- **Northstar** — designate one star as your guiding light; it gets the full
  pulsing, golden treatment.
- **Dependencies** — link stars with `depends on` (dashed) or `relates to`
  (faint); the editor shows both incoming and outgoing connections in plain
  English ("enables X", "depends on Y").
- **Direct manipulation** — drag stars to reposition, click-and-drag the
  background to pan, scroll to zoom (anchored at the cursor like Figma).
- **Local-first storage** — every change is saved to `localStorage` instantly.
  Refresh, close the tab, come back tomorrow — your board is exactly as you
  left it.
- **Portable** — one click exports the whole board as pretty-printed JSON you
  can commit to a repo, attach to a journal entry, or share. Import brings it
  back.
- **Keyboard-first** — `N` for new, `E` to edit, `F` to fit, `⌘/Ctrl+S` to cycle
  status, `?` for the full cheat sheet.
- **A sample board to start** — first-run loads a thoughtful "Launch the solo
  studio" constellation so the app feels alive before you write a thing.

## Getting started

No install. No toolchain.

```bash
git clone https://github.com/<you>/northstar-board.git
cd northstar-board
open index.html     # or: python -m http.server
```

Opening `index.html` directly with `file://` works too — the embedded sample
loads automatically when the fetch-based path can't reach `data/sample.json`.

Running a tiny server (`python -m http.server`, `npx serve`, etc.) gives the
cleanest experience because `fetch()` succeeds and ES modules load without
CORS quirks.

## Keyboard shortcuts

| Keys            | Action                           |
| --------------- | -------------------------------- |
| `N`             | Create a new star                |
| `E`             | Edit selected star               |
| `Delete`        | Remove selected star             |
| `Esc`           | Deselect / close panel           |
| `F`             | Fit constellation to view        |
| `0`             | Reset zoom                       |
| `⌘/Ctrl + S`    | Cycle status of selected star    |
| `?` / `H`       | Open shortcut help               |

## Data model

Everything is a single JSON document, schema-versioned so old exports are
still importable.

```jsonc
{
  "version": 1,
  "meta": {
    "name": "Launch the solo studio",
    "createdAt": "…",
    "updatedAt": "…",
    "northstar": "n_ship"      // id of the guiding star (nullable)
  },
  "nodes": [
    {
      "id": "n_ship",
      "title": "Ship a product I'm proud of",
      "notes": "The northstar…",
      "type": "north" | "goal" | "milestone",
      "status": "plan" | "active" | "done" | "blocked",
      "x": 0, "y": -220,          // board-space coordinates
      "magnitude": 1..4,          // visual size / importance
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "links": [
    { "id": "l1", "from": "n_mvp", "to": "n_ship", "kind": "depends" }
  ]
}
```

The store uses a tiny pub/sub pattern — every UI view (board, editor, status
bar) subscribes and re-renders on change. That's the whole architecture.

## Project structure

```
northstar-board/
├── index.html          # the whole app mount point
├── css/styles.css      # design system + component styles
├── js/
│   ├── app.js          # entry point — wires views to the store
│   ├── store.js        # data model + localStorage + pub/sub
│   ├── board.js        # SVG constellation renderer + drag/pan/zoom
│   ├── editor.js       # side panel: create/edit stars and their links
│   ├── shortcuts.js    # keyboard bindings + help overlay
│   ├── io.js           # import / export / first-run sample loading
│   └── sample.js       # embedded sample board (fallback for file://)
└── data/sample.json    # same sample, as a standalone file
```

## Design choices worth calling out

- **Vanilla everything.** No React, no bundler, no TypeScript transpile. ES
  modules in the browser, CSS custom properties, the Web Animations
  primitives the platform gives you for free.
- **SVG over Canvas.** At our scale (tens to hundreds of stars), SVG wins on
  accessibility, CSS integration, and pointer-event ergonomics. We reserve
  Canvas for when a board crosses ~1000 animated elements.
- **Coordinates stored in data.** Layouts survive refresh, export, and
  re-import. No magic autolayout — you decide what's near what.
- **Cursor-anchored zoom.** The point under your cursor stays fixed as the
  view scales, so you can dive into dense regions without losing orientation.

## Privacy

Northstar Board is a static site. It does not make network requests. Your
board lives under the `northstar-board:v1` key in `localStorage` for this
origin, and only moves when you export it.

## License

[MIT](LICENSE). Do what you like; a star on the repo is a kind gesture.

---

<p align="center">
  <em>Made for anyone who's ever written a plan in a notebook that deserved a
  map.</em>
</p>
