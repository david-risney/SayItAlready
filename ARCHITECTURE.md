# Architecture & Technology Reference

A guide to the technologies, patterns, and design decisions in this project — useful as a reference when starting a new web app.

## Overview

Say It Already! is a **zero-build, no-framework PWA** — a progressive web app built entirely with vanilla HTML, CSS, and JavaScript ES modules. There is no bundler, no transpiler, and no framework. The browser loads source files directly.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Vanilla JavaScript (ES2022+) | ES modules, private class fields, top-level await |
| Markup | HTML5 | Minimal shell pages; UI lives in Web Components |
| Styling | CSS (native nesting, logical properties) | Shadow DOM scoped; custom properties for theming |
| Storage | IndexedDB + localStorage | Decks in IDB; settings/history in localStorage |
| Offline | Service Worker (cache-first) | Full offline support with versioned precache |
| Installable | Web App Manifest | Fullscreen, maskable icons, screenshots |
| Dev Server | `npx serve` | Static file server with HTTPS for mobile testing |
| Icons | `sharp` + `png-to-ico` | Node scripts generate all icon sizes from SVG |

---

## Architecture Patterns

### Zero-Build Module System

All JavaScript uses native ES modules (`type="module"` in `<script>` tags). No bundler, no transpiler. Import maps are not needed because all imports use relative paths.

```html
<script type="module" src="js/app.js"></script>
```

```js
import { loadAllDecks } from '../services/deck-store.js';
```

**Trade-off**: Slightly more network requests in development, but greatly simplified tooling. The service worker precache eliminates this in production.

### Multi-Page App with Shared Components

The app uses separate HTML pages for distinct modes rather than a single-page router for everything:

- **`index.html`** → Home screen, settings, deck editor, help dialogs
- **`game.html`** → Active gameplay and round summary

Each page has its own entry-point JS file (`app.js`, `game-app.js`) but shares the same Web Components and services. Navigation between pages uses standard `location.assign()` with URL parameters.

```js
// Navigate from home to game
const params = new URLSearchParams({ deck: deckId, difficulty, tilt: tiltGranted ? 1 : 0 });
location.assign(`game?${params}`);

// Navigate back (replace so dead game isn't in history)
location.replace('./');
```

### URL-Based State Management

Within a page, state is managed through URL parameters and the History API — no state management library:

```js
// Push a modal state
history.pushState({ view: 'deck', deck: id }, '', `?view=deck&deck=${id}`);

// Listen for back navigation
window.addEventListener('popstate', (e) => {
  const view = e.state?.view || 'main';
  // update UI based on view
});
```

**Deep linking**: Any view state encoded in the URL can be shared or bookmarked. The app also supports deep-link import via URL hash: `#import/BASE64_COMPRESSED_JSON`.

---

## Web Components (Shadow DOM)

All UI components are custom elements with Shadow DOM encapsulation:

```js
const template = document.createElement('template');
template.innerHTML = `
<link rel="stylesheet" href="./css/my-component.css">
<div class="root">...</div>
`;

class MyComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }
}
customElements.define('my-component', MyComponent);
```

**Key patterns**:
- **CSS via `<link>` in Shadow DOM** — each component loads its own stylesheet declaratively. No JavaScript CSS loading needed; the browser handles caching.
- **Template cloning** — a single `<template>` element is created at module load time and cloned for each instance.
- **Composed custom events** — components communicate upward by dispatching `CustomEvent` with `bubbles: true, composed: true` so events cross shadow boundaries.

```js
this.dispatchEvent(new CustomEvent('round-end', {
  bubbles: true, composed: true,
  detail: { results, deckName }
}));
```

---

## CSS Approach

### Design Tokens (Custom Properties)

Global design tokens are defined on `:root` in `css/styles.css` and consumed everywhere — including inside Shadow DOM (custom properties pierce shadow boundaries):

```css
:root {
  --color-bg: #1a1a2e;
  --color-primary: #e94560;
  --color-text: #eee;
  --radius: 12px;
  --transition: 200ms ease;
}
```

Components reference tokens with fallbacks: `var(--color-primary, #e94560)`.

### Native CSS Nesting

Selectors are organized using native CSS nesting to group related rules:

```css
.deck-card {
  cursor: pointer;
  transition: transform 200ms ease;

  &:hover {
    transform: scale(1.06);
  }

  &:active {
    transform: scale(0.97);
  }
}
```

### Logical Properties

Physical directions (`top`, `left`, `margin-right`) are replaced with logical equivalents for better internationalization support:

```css
.element {
  inset-block-start: 0.5rem;    /* top */
  inset-inline-end: 0.5rem;     /* right in LTR */
  margin-inline-start: auto;    /* margin-left in LTR */
  padding-block-end: 1rem;      /* padding-bottom */
  text-align: start;            /* left in LTR */
}
```

### Scroll-Driven Animations

The home screen header shrinks on scroll using CSS scroll-driven animations — no JavaScript scroll listeners:

```css
.home {
  scroll-timeline: --home-scroll block;
}

.header-inner {
  animation: shrink-inner linear both;
  animation-timeline: --home-scroll;
  animation-range: 0px 120px;
}
```

### Reduced Motion

A global `prefers-reduced-motion` media query disables all animations and transitions:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Progressive Web App (PWA)

### Service Worker — Cache-First Strategy

The service worker (`sw.js`) uses a versioned cache with a full precache list:

```js
const CACHE_NAME = 'myapp-v1.18.0';
const PRECACHE_URLS = [ './', './index.html', './css/styles.css', /* ... */ ];

// Install: precache everything
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});
```

**Navigation request handling**: Query parameters are stripped from navigation requests before cache lookup, so `game?deck=X` matches the cached `game.html`.

### Web App Manifest

```json
{
  "display": "fullscreen",
  "display_override": ["window-controls-overlay"],
  "orientation": "any",
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "icon-512.png", "sizes": "512x512", "purpose": "maskable" }
  ],
  "screenshots": [...]
}
```

**Window Controls Overlay (WCO)**: The manifest declares `window-controls-overlay` as a preferred display mode. CSS adapts with `env(titlebar-area-height)` and `@media (display-mode: window-controls-overlay)`.

### Install Prompt

The `beforeinstallprompt` event is captured and surfaced as an install button:

```js
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});
```

---

## Web APIs Used

### Device Orientation (Tilt Controls)

The game supports tilt-based controls (tilt phone forward = correct, back = skip). Permission must be requested from a user gesture on iOS:

```js
// iOS requires explicit permission
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
  const perm = await DeviceOrientationEvent.requestPermission();
  if (perm !== 'granted') return false;
}
window.addEventListener('deviceorientation', handler);
```

A probe function tests if the sensor actually delivers data (some devices grant permission but never fire events).

### Screen Orientation Lock

The game locks to landscape during play:

```js
await screen.orientation.lock('landscape');
// ... on game end:
screen.orientation.unlock();
```

### Wake Lock

Prevents the screen from dimming during gameplay:

```js
const wakeLock = await navigator.wakeLock.request('screen');
// ... on pause/end:
wakeLock.release();
```

### Web Audio API

Sound feedback is generated programmatically — no audio files:

```js
const ctx = new AudioContext();
const osc = ctx.createOscillator();
osc.frequency.value = 880;
osc.connect(ctx.destination);
osc.start();
osc.stop(ctx.currentTime + 0.15);
```

### Compression Streams

Deck data is compressed for URL sharing using the Compression Streams API:

```js
const cs = new CompressionStream('deflate-raw');
// ... pipe data through, then URL-safe base64 encode
```

This enables sharing entire deck packs via QR code or URL hash.

### Vibration API

Haptic feedback on correct/skip actions: `navigator.vibrate(50)`.

---

## Data Architecture

### Deck JSON Schema

Deck packs are JSON files in `packs/`:

```json
{
  "id": "animals",
  "name": "Animals",
  "description": "Guess the animal!",
  "icon": "🐾",
  "background": "linear-gradient(135deg, #2d6a4f, #40916c)",
  "words": [
    { "text": "Dog", "tags": ["difficulty:0"] },
    { "text": "Platypus", "tags": ["difficulty:2"] }
  ]
}
```

Difficulty tags: `0` = easy, `1` = normal, `2` = hard. Words can also be plain strings (normalized on import).

### Storage Strategy

| Data | Store | Why |
|------|-------|-----|
| Deck packs (built-in + user) | IndexedDB | Large structured data, async access |
| Play history | localStorage | Small, synchronous reads for sorting |
| Favorites | localStorage | Quick toggle, small data |
| Settings (timer, control mode) | localStorage | Simple key-value, synchronous |

---

## Development Tooling

### Dev Server (`serve.ps1`)

A PowerShell script that starts two `npx serve` instances:

- **HTTP** on port 3000 — standard development
- **HTTPS** on port 3443 — required for DeviceOrientation API on mobile

Auto-generates a self-signed certificate via `openssl` and prints the LAN URL for mobile testing.

### Icon Generation (`scripts/generate-icons.mjs`)

Node script using `sharp` to generate all icon sizes from SVG source:
- Standard icons (16, 32, 192, 512 PNG)
- Maskable icons (with safe-zone padding)
- Favicon `.ico` via `png-to-ico`
- Apple touch icon (180px)

### Version Bumping (`scripts/bump-version.ps1`)

Updates the version string in both `js/version.js` and the `sw.js` cache name simultaneously, keeping them in sync.

---

## Design Decisions Worth Noting

1. **No build step** — Source files are served directly. This eliminates build tooling complexity and makes the project immediately runnable with any static file server.

2. **Shadow DOM for style isolation** — Each component's CSS cannot leak out or be affected by global styles. Custom properties are used for theming since they pierce shadow boundaries.

3. **CSS in separate files, not JS** — Component styles are in standalone `.css` files loaded via `<link>` tags in Shadow DOM, keeping concerns separated and enabling browser-native caching.

4. **URL as single source of truth** — All navigation state is in the URL. Refreshing or sharing a URL restores the exact view state. The History API manages in-page transitions.

5. **Multi-page over SPA** — Distinct app modes (home vs. game) are separate HTML pages. This gives clean separation, independent loading, and works naturally with browser navigation.

6. **Programmatic audio over files** — Sound effects are synthesized with Web Audio API oscillators instead of shipping audio files. Smaller footprint, no loading latency.

7. **Sensor permission on home page** — Tilt permission is requested before navigating to the game (requires user gesture). The result is passed as a URL parameter so the game page knows what to expect.

8. **Cache versioning** — The service worker cache name includes a version number. Bumping it triggers a full re-cache on next visit, ensuring users get updates.

9. **Compressed data URLs** — Deck sharing uses Compression Streams + URL-safe base64 to encode entire deck packs into shareable URLs and QR codes, with no server needed.

10. **Scroll-driven animations** — The shrinking header uses pure CSS scroll-driven animations, avoiding JavaScript scroll event listeners entirely.
