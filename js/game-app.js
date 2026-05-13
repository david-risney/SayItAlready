import './components/game-screen.js';
import './components/round-summary.js';
import { loadAllDecks } from './services/deck-store.js';
import { getSettings } from './services/settings.js';
import { probeTiltAvailable } from './services/tilt-detector.js';

const app = document.getElementById('app');

/* ---- Read launch params ---- */
const params = new URLSearchParams(location.search);
const deckId = params.get('deck');
const launchDifficulty = Number(params.get('difficulty') ?? 2);
const tiltHint = params.get('tilt') === '1';

/* ---- Game config (preserved across Play Again) ---- */
let gameConfig = {
  deck: null,
  difficulty: launchDifficulty,
  controlMode: getSettings().controlMode,
  tiltGranted: false,
};

/* ---- Orientation helpers ---- */
function lockLandscape() {
  try { screen.orientation?.lock('landscape').catch(() => {}); } catch {}
}
function unlockOrientation() {
  try { screen.orientation?.unlock(); } catch {}
}

/* ---- Views ---- */
function showGame() {
  lockLandscape();
  app.innerHTML = '';
  const game = document.createElement('game-screen');
  game.deck = gameConfig.deck;
  game.duration = getSettings().timerDuration;
  game.tiltGranted = gameConfig.tiltGranted;
  game.controlMode = gameConfig.controlMode;
  game.difficulty = gameConfig.difficulty;
  app.appendChild(game);
}

function showSummary(deck, results) {
  unlockOrientation();
  app.innerHTML = '';
  const summary = document.createElement('round-summary');
  summary.data = { deck, results };
  app.appendChild(summary);
}

/* ---- Event handlers ---- */
app.addEventListener('round-end', (e) => {
  const { deck, results } = e.detail;
  history.replaceState({ view: 'results' }, '', location.pathname + location.search);
  showSummary(deck, results);
});

app.addEventListener('start-game', () => {
  // "Play Again" from round-summary — reuse same config
  history.replaceState({ view: 'game' }, '', location.pathname + location.search);
  showGame();
});

app.addEventListener('go-home', () => {
  unlockOrientation();
  location.replace('./');
});

app.addEventListener('game-paused', () => {
  history.pushState({ view: 'game-paused' }, '');
});

app.addEventListener('game-resumed', () => {
  if (history.state?.view === 'game-paused') history.back();
});

/* ---- Back button ---- */
window.addEventListener('popstate', () => {
  const state = history.state;
  switch (state?.view) {
    case 'game-paused': {
      const game = app.querySelector('game-screen');
      if (game) game.showPause();
      break;
    }
    case 'game': {
      const game = app.querySelector('game-screen');
      if (game) game.hidePause();
      else showGame();
      break;
    }
    default: {
      // Back from game with no state → go home
      unlockOrientation();
      location.replace('./');
    }
  }
});

/* ---- Boot ---- */
(async () => {
  if (!deckId) {
    location.replace('./');
    return;
  }

  // Load deck
  const allDecks = await loadAllDecks();
  const deck = allDecks.find(d => d.id === deckId || d.name === deckId);
  if (!deck) {
    location.replace('./');
    return;
  }
  gameConfig.deck = deck;

  // Verify tilt availability if hinted
  if (gameConfig.controlMode === 'gyro' && tiltHint) {
    gameConfig.tiltGranted = await probeTiltAvailable(1500);
  }

  history.replaceState({ view: 'game' }, '', location.pathname + location.search);
  showGame();
})();

/* ---- Service Worker registration ---- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('SW registration failed:', err);
  });
}
