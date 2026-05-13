import './components/home-screen.js';
import { decompressFromBase64 } from './services/compress.js';

const app = document.getElementById('app');
let routing = false; // true while handling popstate, suppresses URL side-effects

/* ---- URL state helpers ---- */
function buildQuery(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) sp.set(k, v);
  }
  return '?' + sp.toString();
}

function pushView(params) {
  history.pushState(params, '', buildQuery(params));
}

function replaceView(params) {
  history.replaceState(params, '', buildQuery(params));
}

function getViewParams() {
  const sp = new URLSearchParams(location.search);
  const obj = {};
  for (const [k, v] of sp) obj[k] = v;
  return obj;
}

/* ---- Redirect legacy game URLs to game.html ---- */
function redirectToGame(deckId) {
  if (!deckId) return false;
  const params = new URLSearchParams({ deck: deckId });
  location.replace(`game?${params}`);
  return true;
}

/* ---- Simple view router ---- */
function showHome(opts = {}) {
  app.innerHTML = '';
  const home = document.createElement('home-screen');
  app.appendChild(home);

  if (opts.openDeck) {
    home.addEventListener('decks-loaded', () => home.openDeckById(opts.openDeck), { once: true });
  } else if (opts.openEditor) {
    const deckId = opts.openEditor === true ? null : opts.openEditor;
    home.addEventListener('decks-loaded', () => home.openEditor(deckId), { once: true });
  } else if (opts.openEditorWithDeck) {
    home.addEventListener('decks-loaded', () => home.openEditorWithDeck(opts.openEditorWithDeck), { once: true });
  } else if (opts.openSettings) {
    home.addEventListener('decks-loaded', () => home.openSettings(), { once: true });
  } else if (opts.openHelp) {
    home.addEventListener('decks-loaded', () => home.openHelp(), { once: true });
  }
}

/* ---- Event delegation ---- */
app.addEventListener('go-home', () => {
  pushView({ view: 'main' });
  showHome();
});

// Home-screen dialog events — open pushes URL; close uses history.back()
app.addEventListener('deck-preview-open', (e) => {
  pushView({ view: 'deck', deck: e.detail.deckId });
});

app.addEventListener('settings-open', () => {
  pushView({ view: 'settings' });
});

app.addEventListener('help-open', () => {
  if (routing) return;
  pushView({ view: 'help' });
});

app.addEventListener('edit-deck-open', (e) => {
  if (routing) return;
  const deckId = e.detail?.deckId;
  pushView(deckId ? { view: 'edit', deck: deckId } : { view: 'edit' });
});

/* ---- Back button ---- */
window.addEventListener('popstate', async () => {
  routing = true;
  try {
  const p = getViewParams();
  const home = app.querySelector('home-screen');
  switch (p.view) {
    case 'settings':
      if (home) { home.openSettings(); } else { showHome({ openSettings: true }); }
      break;
    case 'help':
      if (home) { home.openHelp(); } else { showHome({ openHelp: true }); }
      break;
    case 'edit':
      if (home) { home.openEditor(p.deck); } else { showHome({ openEditor: p.deck || true }); }
      break;
    case 'deck':
      if (home) { home.openDeckById(p.deck); } else { showHome({ openDeck: p.deck }); }
      break;
    // Legacy game URLs — redirect to game.html
    case 'game':
    case 'game-paused':
      if (p.deck) { redirectToGame(p.deck); return; }
      if (home) { home.closeDialogs(); } else { showHome(); }
      break;
    case 'results':
      // Results can't be replayed from a URL — just go home
      if (home) { home.closeDialogs(); } else { showHome(); }
      break;
    default:
      if (home) { home.closeDialogs(); } else { showHome(); }
  }
  } finally { routing = false; }
});

/* ---- PWA install prompt ---- */
import './services/install.js';

/* ---- Service Worker registration ---- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('SW registration failed:', err);
  });
}

/* ---- Boot from URL ---- */
(async () => {
  const p = getViewParams();
  switch (p.view) {
    case 'settings':
      replaceView({ view: 'settings' });
      showHome({ openSettings: true });
      break;
    case 'edit':
      if (p.add) {
        try {
          const json = await decompressFromBase64(p.add);
          const deck = JSON.parse(json);
          replaceView({ view: 'edit' });
          showHome({ openEditorWithDeck: deck });
        } catch (err) {
          console.warn('Invalid add data:', err);
          replaceView({ view: 'edit' });
          showHome({ openEditor: true });
        }
      } else {
        replaceView(p.deck ? { view: 'edit', deck: p.deck } : { view: 'edit' });
        showHome({ openEditor: p.deck || true });
      }
      break;
    case 'help':
      replaceView({ view: 'help' });
      showHome({ openHelp: true });
      break;
    case 'deck':
      replaceView({ view: 'deck', deck: p.deck });
      showHome({ openDeck: p.deck });
      break;
    // Legacy game URLs — redirect to game.html
    case 'game':
    case 'game-paused':
      if (p.deck && redirectToGame(p.deck)) return;
      replaceView({ view: 'main' });
      showHome();
      break;
    case 'results':
      replaceView({ view: 'main' });
      showHome();
      break;
    default:
      replaceView({ view: 'main' });
      showHome();
  }

  // Deep-link import via hash: #import/BASE64_JSON
  const hash = location.hash;
  if (hash.startsWith('#import/')) {
    const encoded = hash.slice('#import/'.length);
    try {
      const json = atob(encoded);
      // Wait for home-screen to finish loading decks
      const home = app.querySelector('home-screen');
      if (home) {
        const doImport = () => home.importFromJSON(json).catch(err => console.warn('Import failed:', err));
        home.addEventListener('decks-loaded', doImport, { once: true });
      }
    } catch (err) {
      console.warn('Invalid import link:', err);
    }
    // Strip the hash so it doesn't re-trigger
    history.replaceState(history.state, '', location.pathname + location.search);
  }
})();
