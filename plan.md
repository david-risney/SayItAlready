# Say It Already! — Project Plan

A Heads Up!–style party game as a **client-side-only PWA** using **Web Components**, **Service Workers**, and the baseline web platform. No frameworks. Hosted on **GitHub Pages**.

---

## Core Concept

Players hold the phone on their forehead. Teammates describe the word shown on screen. The player tilts the phone **down** (toward the ground) for a correct guess, or **up** (away) to skip. The round is timed with audio/haptic cues.

---

## Tech Decisions

| Area | Choice |
|---|---|
| UI | Web Components (custom elements, shadow DOM) |
| State | In-memory + IndexedDB for packs |
| Offline | Service Worker (cache-first) |
| Hosting | GitHub Pages (static files only) |
| Build | None required (vanilla JS modules) — may add a minimal bundler later if needed |
| Styling | CSS custom properties, `@layer`, container queries |

---

## Feature Roadmap

### Phase 1 — Playable MVP
- [ ] **Project scaffolding** — `index.html`, manifest, SW registration, app shell
- [ ] **Home screen** — deck picker, start button
- [ ] **Deck data model** — JSON schema for word packs, bundled default pack
- [ ] **Game screen** — full-screen word display, countdown timer
- [ ] **Tilt detection** — `DeviceOrientationEvent` (with permission request on iOS); tilt-down = correct, tilt-up = skip
- [ ] **Round summary** — list of words with correct/skipped status, score
- [ ] **Audio/haptic feedback** — sounds for correct, skip, 5-second warning, time-up; `navigator.vibrate()` buzz
- [ ] **PWA basics** — `manifest.json`, service worker with offline cache, installable

### Phase 2 — Deck Management
- [ ] **Built-in packs** — ship several themed packs (animals, movies, etc.)
- [ ] **Pack browser** — browse & select packs from a list
- [ ] **Custom pack editor** — create/edit/delete your own packs (stored in IndexedDB)
- [ ] **Import/export** — import packs from JSON file; share packs via file export

### Phase 3 — Polish & Extras
- [ ] **Settings screen** — round time, number of rounds, tilt sensitivity
- [ ] **Animations/transitions** — card flip, slide, countdown pulse
- [ ] **Theming** — light/dark mode, per-pack accent colors
- [ ] **Accessibility** — screen-reader announcements, reduced-motion support
- [ ] **Statistics** — track games played, high scores (IndexedDB)
- [ ] **Share packs via URL** — encode small packs in a share link

---

## Architecture Sketch

```
/
├── index.html              # App shell, router
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│   └── styles.css          # Global styles & custom properties
├── js/
│   ├── app.js              # Entry point, router, SW registration
│   ├── components/
│   │   ├── home-screen.js
│   │   ├── game-screen.js
│   │   ├── round-summary.js
│   │   ├── deck-picker.js
│   │   ├── deck-editor.js
│   │   └── settings-screen.js
│   ├── services/
│   │   ├── tilt-detector.js    # DeviceOrientationEvent wrapper
│   │   ├── audio-manager.js    # Sound effects & vibration
│   │   ├── timer.js            # Countdown timer
│   │   └── deck-store.js       # IndexedDB CRUD for packs
│   └── models/
│       └── deck.js             # Deck/card data types
├── packs/
│   ├── animals.json
│   ├── movies.json
│   └── ...
├── audio/
│   ├── correct.mp3
│   ├── skip.mp3
│   ├── warning.mp3
│   └── times-up.mp3
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## Deck JSON Schema (draft)

```json
{
  "id": "animals",
  "name": "Animals",
  "description": "Guess the animal!",
  "icon": "🐾",
  "words": ["Elephant", "Penguin", "Chameleon", "..."]
}
```

---

## Current Status

| # | Task | Status |
|---|------|--------|
| 1 | Create plan.md | ✅ Done |
| 2 | Project scaffolding (index.html, manifest, SW, app shell) | ✅ Done |
| 3 | Home screen component + deck picker | ✅ Done |
| 4 | Game screen + timer | ✅ Done |
| 5 | Tilt detection service | ✅ Done |
| 6 | Audio/haptic feedback (Web Audio API — no files) | ✅ Done |
| 7 | Round summary screen | ✅ Done |
| 8 | PWA offline support (service worker + manifest) | ✅ Done |
| 9 | 3 built-in packs (animals, movies, food) | ✅ Done |
| 10 | SVG app icon | ✅ Done |

### Phase 1 complete — MVP is playable!

**Next up (Phase 2):**

| # | Task | Status |
|---|------|--------|
| 11 | Add more built-in packs | 🔲 |
| 12 | Pack browser / selection UI improvements | 🔲 |
| 13 | Custom pack editor (create/edit/delete, IndexedDB) | 🔲 |
| 14 | Import/export packs (JSON file) | 🔲 |
| 15 | Settings screen (round time, tilt sensitivity) | 🔲 |

---

## Decisions Made

- **Sound**: Web Audio API generates tones programmatically — no audio files needed.
- **Router**: Simple show/hide via `innerHTML` swap in `#app` — no hash routing yet.
- **Orientation**: Locked to portrait via manifest (`"orientation": "portrait"`).
- **Icons**: SVG icon for now; add raster PNGs later for full iOS/Android support.
- **Manual controls**: Game screen has tap buttons as fallback when tilt/gyro is unavailable (desktop).

## Open Questions

- Should manual tap buttons be hidden when tilt is available, or always shown?
- Add a "get ready" countdown (3-2-1) before the round starts?
- Persist high scores and game history?
