import './components/home-screen.js';
import './components/game-screen.js';
import './components/round-summary.js';
import './components/deck-picker.js';

const app = document.getElementById('app');

/* ---- Simple view router ---- */
function showHome() {
  app.innerHTML = '';
  const home = document.createElement('home-screen');
  app.appendChild(home);
}

function showGame(deck, tiltGranted = false, difficulty = 2) {
  app.innerHTML = '';
  const game = document.createElement('game-screen');
  game.deck = deck;
  game.duration = 60;
  game.tiltGranted = tiltGranted;
  game.difficulty = difficulty;
  app.appendChild(game);
}

function showSummary(deck, results) {
  app.innerHTML = '';
  const summary = document.createElement('round-summary');
  summary.data = { deck, results };
  app.appendChild(summary);
}

/* ---- Event delegation ---- */
app.addEventListener('start-game', (e) => {
  showGame(e.detail.deck, e.detail.tiltGranted, e.detail.difficulty);
});

app.addEventListener('round-end', (e) => {
  showSummary(e.detail.deck, e.detail.results);
});

app.addEventListener('go-home', () => {
  showHome();
});

/* ---- Service Worker registration ---- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('SW registration failed:', err);
  });
}

/* ---- Boot ---- */
showHome();
