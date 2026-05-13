import { shuffle, wordText, wordDifficulty, filterByDifficulty } from '../models/deck.js';
import { Timer } from '../services/timer.js';
import { TiltDetector } from '../services/tilt-detector.js';
import { AudioManager } from '../services/audio-manager.js';
import { getSettings } from '../services/settings.js';

const template = document.createElement('template');
template.innerHTML = `
<link rel="stylesheet" href="./css/game-screen.css">
<div class="game">
  <div class="timer-bg"></div>
  <div class="timer-text"></div>
  <div class="word"></div>

  <div class="tap-zones">
    <button class="tap-zone tap-skip">⏭ Skip</button>
    <div class="tap-divider"></div>
    <button class="tap-zone tap-correct">✅ Correct</button>
  </div>

  <button class="menu-btn" aria-label="Pause">
    <span></span><span></span><span></span>
  </button>

  <div class="flash correct">✅</div>
  <div class="flash skip">⏭️</div>

  <div class="pause-overlay">
    <div class="pause-title">PAUSED</div>
    <button class="btn-resume">▶ Resume</button>
    <button class="btn-quit">🚪 Quit</button>
  </div>

  <div class="swipe-hint">⟵ Skip · Correct ⟶</div>
  <div class="debug-overlay"></div>
  <div class="countdown-overlay"><span class="countdown-num">3</span></div>
</div>
`;

export class GameScreen extends HTMLElement {
  #deck = null;
  #words = [];
  #index = 0;
  #results = []; // { word, result: 'correct' | 'skipped' }
  #timer = null;
  #tilt = null;
  #audio = new AudioManager();
  #duration = 60;
  #controlMode = 'touch'; // 'gyro' | 'touch' | 'swipe'
  #paused = false;
  #wakeLock = null;
  #difficulty = 2;
  #swipeStartX = 0;
  #swipeStartY = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  /** Set deck before inserting into DOM, or via attribute. */
  set deck(d) {
    this.#deck = d;
  }

  get deck() {
    return this.#deck;
  }

  set duration(val) {
    this.#duration = val;
  }

  set tiltGranted(val) {
    if (val) this.#controlMode = 'gyro';
  }

  set controlMode(val) {
    this.#controlMode = val;
  }

  set difficulty(val) {
    this.#difficulty = val;
  }

  connectedCallback() {
    if (!this.#deck) return;
    this.#audio.unlock();
    this.#words = shuffle(filterByDifficulty([...this.#deck.words], this.#difficulty));
    this.#index = 0;
    this.#results = [];
    this.#showWord();
    this.#runCountdown().then(() => {
      this.#startTimer();
      this.#startTilt();
      this.#bindControls();
    });
    this.#acquireWakeLock();
  }

  disconnectedCallback() {
    this.#timer?.stop();
    this.#tilt?.stop();
    this.#releaseWakeLock();
  }

  async #acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.#wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* user denied or not supported */ }
  }

  #releaseWakeLock() {
    this.#wakeLock?.release();
    this.#wakeLock = null;
  }

  /* ---- Countdown ---- */
  #runCountdown() {
    const overlay = this.shadowRoot.querySelector('.countdown-overlay');
    const numEl = overlay.querySelector('.countdown-num');
    overlay.classList.remove('hidden');
    let count = 3;
    numEl.textContent = count;
    return new Promise((resolve) => {
      const tick = () => {
        count--;
        if (count <= 0) {
          overlay.classList.add('hidden');
          resolve();
          return;
        }
        numEl.textContent = count;
        // Re-trigger animation
        numEl.style.animation = 'none';
        numEl.offsetHeight; // force reflow
        numEl.style.animation = '';
        setTimeout(tick, 1000);
      };
      setTimeout(tick, 1000);
    });
  }

  /* ---- Timer ---- */
  #startTimer() {
    const timerBg = this.shadowRoot.querySelector('.timer-bg');
    const timerText = this.shadowRoot.querySelector('.timer-text');
    this.#timer = new Timer({
      duration: this.#duration,
      warningAt: 5,
      onTick: (remaining) => {
        const pct = remaining / this.#duration;
        timerBg.style.transform = `scaleY(${pct})`;
        timerText.textContent = Math.ceil(remaining);
      },
      onWarning: () => {
        timerBg.classList.add('warning');
        this.#audio.warning();
      },
      onDone: () => this.#endRound(),
    });
    this.#timer.start();
  }

  /* ---- Tilt ---- */
  #startTilt() {
    if (this.#controlMode !== 'gyro') return;
    const debugEl = this.shadowRoot.querySelector('.debug-overlay');
    const showDebug = getSettings().debugOverlay;
    if (showDebug) debugEl.classList.add('visible');

    this.#tilt = new TiltDetector({
      onCorrect: () => this.#handleCorrect(),
      onSkip: () => this.#handleSkip(),
      onDebug: showDebug ? (d) => {
        debugEl.textContent =
          `${d.extra}\n` +
          `land:${d.landscape} angle:${d.angle}\n` +
          `state:${d.state}\n` +
          `up:${d.tiltUp} dn:${d.tiltDown} neut:${d.inNeutral}`;
      } : undefined,
    });
    this.#tilt.start();
  }

  #bindControls() {
    const menuBtn = this.shadowRoot.querySelector('.menu-btn');
    const tapZones = this.shadowRoot.querySelector('.tap-zones');

    // Show tap zones when using touch mode
    if (this.#controlMode === 'touch') {
      tapZones.classList.add('visible');
    }

    // Show swipe hint when using swipe mode
    if (this.#controlMode === 'swipe') {
      this.shadowRoot.querySelector('.swipe-hint').classList.add('visible');
      this.#bindSwipe();
    }

    // Tap zone buttons
    this.shadowRoot.querySelector('.tap-correct').addEventListener('click', () => this.#handleCorrect());
    this.shadowRoot.querySelector('.tap-skip').addEventListener('click', () => this.#handleSkip());

    // Hamburger pauses
    menuBtn.addEventListener('click', () => this.#togglePause());

    // Pause overlay buttons
    this.shadowRoot.querySelector('.btn-resume').addEventListener('click', () => this.#togglePause());
    this.shadowRoot.querySelector('.btn-quit').addEventListener('click', () => this.#quit());
  }

  /* ---- Swipe gesture ---- */
  #bindSwipe() {
    const el = this.shadowRoot.querySelector('.game');
    const MIN_DX = 60;   // minimum horizontal travel in px
    const MAX_DY_RATIO = 0.7; // max vertical/horizontal ratio to count as horizontal swipe

    el.addEventListener('touchstart', (e) => {
      if (this.#paused) return;
      const t = e.changedTouches[0];
      this.#swipeStartX = t.clientX;
      this.#swipeStartY = t.clientY;
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      if (this.#paused) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.#swipeStartX;
      const dy = Math.abs(t.clientY - this.#swipeStartY);
      if (Math.abs(dx) < MIN_DX) return;
      if (dy / Math.abs(dx) > MAX_DY_RATIO) return;
      if (dx > 0) {
        this.#handleCorrect();
      } else {
        this.#handleSkip();
      }
    }, { passive: true });
  }

  #togglePause() {
    this.#paused = !this.#paused;
    const pauseOverlay = this.shadowRoot.querySelector('.pause-overlay');
    const wordEl = this.shadowRoot.querySelector('.word');

    if (this.#paused) {
      this.#timer?.stop();
      this.#tilt?.stop();
      pauseOverlay.classList.add('visible');
      wordEl.style.visibility = 'hidden';
      this.dispatchEvent(new CustomEvent('game-paused', { bubbles: true, composed: true }));
    } else {
      this.#timer?.start();
      if (this.#controlMode === 'gyro') this.#tilt?.start();
      pauseOverlay.classList.remove('visible');
      wordEl.style.visibility = '';
      this.dispatchEvent(new CustomEvent('game-resumed', { bubbles: true, composed: true }));
    }
  }

  #quit() {
    this.#timer?.stop();
    this.#tilt?.stop();
    this.dispatchEvent(new CustomEvent('go-home', { bubbles: true, composed: true }));
  }

  /* ---- Public pause API for router ---- */
  showPause() {
    if (!this.#paused) this.#togglePause();
  }

  hidePause() {
    if (this.#paused) this.#togglePause();
  }

  /* ---- Game logic ---- */

  /** Pick the next word index based on recent performance. */
  #pickNext() {
    // Already past the end
    if (this.#index >= this.#words.length - 1) {
      this.#index = this.#words.length;
      return;
    }

    const len = this.#results.length;
    const last = len > 0 ? this.#results[len - 1] : null;
    const prev = len > 1 ? this.#results[len - 2] : null;

    let preferredDir = 0; // 0 = no preference
    if (last?.result === 'skipped') preferredDir = -1;         // skipped → try easier
    if (last?.result === 'correct' && prev?.result === 'correct') preferredDir = 1; // two correct → try harder

    if (preferredDir === 0) {
      this.#index++;
      return;
    }

    const curDiff = wordDifficulty(this.#words[this.#index]);
    const targetDiff = Math.max(0, Math.min(this.#difficulty, curDiff + preferredDir));

    // Search remaining words for one at targetDiff
    let best = -1;
    for (let i = this.#index + 1; i < this.#words.length; i++) {
      if (wordDifficulty(this.#words[i]) === targetDiff) {
        best = i;
        break;
      }
    }

    if (best !== -1 && best !== this.#index + 1) {
      // Swap the found word into the next position
      const tmp = this.#words[this.#index + 1];
      this.#words[this.#index + 1] = this.#words[best];
      this.#words[best] = tmp;
    }
    this.#index++;
  }

  #showWord(anim = 'pop') {
    const wordEl = this.shadowRoot.querySelector('.word');
    if (this.#index >= this.#words.length) {
      this.#endRound();
      return;
    }
    wordEl.textContent = wordText(this.#words[this.#index]);
    wordEl.classList.remove('pop', 'flip-up', 'flip-down');
    // force reflow for animation restart
    void wordEl.offsetWidth;
    wordEl.classList.add(anim);
  }

  #handleCorrect() {
    if (this.#index >= this.#words.length) return;
    this.#results.push({ word: wordText(this.#words[this.#index]), difficulty: wordDifficulty(this.#words[this.#index]), result: 'correct' });
    this.#audio.correct();
    this.#flashFeedback('correct');
    this.#pickNext();
    this.#showWord('flip-up');
  }

  #handleSkip() {
    if (this.#index >= this.#words.length) return;
    this.#results.push({ word: wordText(this.#words[this.#index]), difficulty: wordDifficulty(this.#words[this.#index]), result: 'skipped' });
    this.#audio.skip();
    this.#flashFeedback('skip');
    this.#pickNext();
    this.#showWord('flip-down');
  }

  #flashFeedback(type) {
    const el = this.shadowRoot.querySelector(`.flash.${type}`);
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 350);
  }

  #endRound() {
    this.#timer?.stop();
    this.#tilt?.stop();
    // Record the word that was showing when time ran out as skipped
    if (this.#index < this.#words.length) {
      this.#results.push({ word: wordText(this.#words[this.#index]), difficulty: wordDifficulty(this.#words[this.#index]), result: 'skipped' });
    }
    this.#audio.timesUp();
    this.dispatchEvent(
      new CustomEvent('round-end', {
        bubbles: true,
        composed: true,
        detail: {
          deck: this.#deck,
          results: this.#results,
        },
      })
    );
  }
}

customElements.define('game-screen', GameScreen);
