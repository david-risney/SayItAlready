import './components/home-screen.js';
import './components/game-screen.js';
import './components/round-summary.js';
import './components/deck-picker.js';
import { loadAllDecks } from './services/deck-store.js';
import { getSettings } from './services/settings.js';
import { requestTiltPermission, probeTiltAvailable } from './services/tilt-detector.js';

const app = document.getElementById('app');
let allDecks = null;

async function ensureDecks() {
  if (!allDecks) allDecks = await loadAllDecks();
  return allDecks;
}

function findDeck(decks, id) {
  return decks.find(d => d.id === id || d.name === id);
}

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

/* ---- Simple view router ---- */
function showHome(opts = {}) {
  unlockOrientation();
  app.innerHTML = '';
  const home = document.createElement('home-screen');
  app.appendChild(home);

  if (opts.openDeck) {
    home.addEventListener('decks-loaded', () => home.openDeckById(opts.openDeck), { once: true });
  } else if (opts.openSettings) {
    home.addEventListener('decks-loaded', () => home.openSettings(), { once: true });
  }
}

function showGame(deck, tiltGranted = false, difficulty = 2) {
  lockLandscape();
  app.innerHTML = '';
  const game = document.createElement('game-screen');
  game.deck = deck;
  game.duration = 60;
  game.tiltGranted = tiltGranted;
  game.difficulty = difficulty;
  app.appendChild(game);
}

function showSummary(deck, results) {
  unlockOrientation();
  app.innerHTML = '';
  const summary = document.createElement('round-summary');
  summary.data = { deck, results };
  app.appendChild(summary);
}

async function startGameFromDeckId(deckId) {
  const decks = await ensureDecks();
  const deck = findDeck(decks, deckId);
  if (!deck) { replaceView({ view: 'main' }); showHome(); return; }
  const useGyro = getSettings().controlMode === 'gyro';
  let tiltAvailable = false;
  if (useGyro) {
    const permGranted = await requestTiltPermission();
    tiltAvailable = permGranted ? await probeTiltAvailable(1500) : false;
  }
  showGame(deck, tiltAvailable);
}

/* ---- Event delegation ---- */
app.addEventListener('start-game', (e) => {
  const { deck, tiltGranted, difficulty } = e.detail;
  pushView({ view: 'game', deck: deck.id });
  showGame(deck, tiltGranted, difficulty);
});

app.addEventListener('round-end', (e) => {
  const { deck, results } = e.detail;
  const data = btoa(JSON.stringify(results));
  replaceView({ view: 'results', deck: deck.id, data });
  showSummary(deck, results);
});

app.addEventListener('go-home', () => {
  pushView({ view: 'main' });
  unlockOrientation();
  showHome();
});

// Home-screen dialog events — open pushes URL; close uses history.back()
app.addEventListener('deck-preview-open', (e) => {
  pushView({ view: 'deck', deck: e.detail.deckId });
});

app.addEventListener('settings-open', () => {
  pushView({ view: 'settings' });
});

/* ---- Back button ---- */
window.addEventListener('popstate', async () => {
  const p = getViewParams();
  const home = app.querySelector('home-screen');
  switch (p.view) {
    case 'settings':
      if (home) { home.openSettings(); } else { showHome({ openSettings: true }); }
      break;
    case 'deck':
      if (home) { home.openDeckById(p.deck); } else { showHome({ openDeck: p.deck }); }
      break;
    case 'results': {
      if (p.data && p.deck) {
        const decks = await ensureDecks();
        const deck = findDeck(decks, p.deck);
        if (deck) {
          try {
            const results = JSON.parse(atob(p.data));
            showSummary(deck, results);
            return;
          } catch {}
        }
      }
      if (home) { home.closeDialogs(); } else { showHome(); }
      break;
    }
    case 'game': {
      if (p.deck) { await startGameFromDeckId(p.deck); }
      else if (home) { home.closeDialogs(); } else { showHome(); }
      break;
    }
    default:
      if (home) { home.closeDialogs(); } else { showHome(); }
  }
});

/* ---- Orientation helpers ---- */
function lockLandscape() {
  try { screen.orientation?.lock('landscape').catch(() => {}); } catch {}
}
function unlockOrientation() {
  try { screen.orientation?.unlock(); } catch {}
}

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
    case 'deck':
      replaceView({ view: 'deck', deck: p.deck });
      showHome({ openDeck: p.deck });
      break;
    case 'results': {
      if (p.data && p.deck) {
        const decks = await ensureDecks();
        const deck = findDeck(decks, p.deck);
        if (deck) {
          try {
            const results = JSON.parse(atob(p.data));
            replaceView({ view: 'results', deck: p.deck, data: p.data });
            showSummary(deck, results);
            return;
          } catch {}
        }
      }
      replaceView({ view: 'main' });
      showHome();
      break;
    }
    case 'game':
      if (p.deck) {
        replaceView({ view: 'game', deck: p.deck });
        await startGameFromDeckId(p.deck);
      } else {
        replaceView({ view: 'main' });
        showHome();
      }
      break;
    default:
      replaceView({ view: 'main' });
      showHome();
  }
})();
