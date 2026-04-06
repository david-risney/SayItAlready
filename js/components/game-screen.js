import { shuffle, wordText, filterByDifficulty } from '../models/deck.js';
import { Timer } from '../services/timer.js';
import { TiltDetector } from '../services/tilt-detector.js';
import { AudioManager } from '../services/audio-manager.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* --- Background timer fill --- */
  .game {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1.5rem;
    gap: 1rem;
    position: relative;
    overflow: hidden;
    background: var(--color-bg, #1a1a2e);
  }
  .timer-bg {
    position: absolute;
    inset: 0;
    background: var(--color-primary, #e94560);
    transform-origin: bottom center;
    transform: scaleY(1);
    opacity: 0.18;
    transition: transform 100ms linear;
    pointer-events: none;
  }
  .timer-bg.warning {
    background: var(--color-skip, #f39c12);
    animation: pulse-bg 0.5s infinite;
  }
  @keyframes pulse-bg {
    0%, 100% { opacity: 0.25; }
    50%      { opacity: 0.10; }
  }
  .timer-text {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--color-text-muted, #aaa);
    min-height: 2rem;
    z-index: 1;
  }

  /* --- Word --- */
  .word {
    font-size: 3rem;
    font-weight: 800;
    text-align: center;
    line-height: 1.15;
    padding: 0 0.5rem;
    z-index: 1;
  }
  .word.pop {
    animation: pop 200ms ease;
  }
  @keyframes pop {
    0%   { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1);   opacity: 1; }
  }

  /* --- Flash overlays --- */
  .flash {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 5rem;
    font-weight: 900;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
    z-index: 5;
  }
  .flash.show { opacity: 1; }
  .flash.correct { background: rgba(46, 204, 113, 0.25); color: var(--color-success, #2ecc71); }
  .flash.skip    { background: rgba(243, 156, 18, 0.25); color: var(--color-skip, #f39c12); }

  /* --- Hamburger button --- */
  .menu-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 10;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .menu-btn span {
    display: block;
    width: 24px;
    height: 3px;
    background: var(--color-text, #eee);
    border-radius: 2px;
    transition: transform 200ms ease, opacity 200ms ease;
  }
  .menu-btn.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .menu-btn.open span:nth-child(2) { opacity: 0; }
  .menu-btn.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* --- Controls panel (hidden by default) --- */
  .controls {
    display: none;
    flex-direction: column;
    gap: 0.6rem;
    z-index: 8;
    width: 100%;
    max-width: 280px;
  }
  .controls.visible {
    display: flex;
  }
  .controls button {
    font-size: 1rem;
    font-weight: 700;
    border: none;
    border-radius: var(--radius, 12px);
    padding: 0.7em 1.5em;
    cursor: pointer;
    color: #fff;
    width: 100%;
    transition: transform 200ms ease;
  }
  .controls button:active { transform: scale(0.96); }
  .btn-correct { background: var(--color-success, #2ecc71); }
  .btn-skip    { background: var(--color-skip, #f39c12); }
  .btn-pause   { background: #5b6abf; }
  .btn-quit    { background: var(--color-surface, #16213e); border: 1px solid #444 !important; }

  /* --- Pause overlay --- */
  .pause-overlay {
    display: none;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    align-items: center;
    justify-content: center;
    z-index: 6;
    font-size: 2rem;
    font-weight: 800;
    color: var(--color-text, #eee);
  }
  .pause-overlay.visible {
    display: flex;
  }
</style>

<div class="game">
  <div class="timer-bg"></div>
  <div class="timer-text"></div>
  <div class="word"></div>

  <button class="menu-btn" aria-label="Toggle controls">
    <span></span><span></span><span></span>
  </button>

  <div class="controls">
    <button class="btn-correct">✅ Correct</button>
    <button class="btn-skip">⏭️ Skip</button>
    <button class="btn-pause">⏸ Pause</button>
    <button class="btn-quit">🚪 Quit</button>
  </div>

  <div class="flash correct">✅</div>
  <div class="flash skip">⏭️</div>
  <div class="pause-overlay">PAUSED</div>
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
  #tiltGranted = false;
  #paused = false;
  #wakeLock = null;
  #difficulty = 2;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  /** Set deck before inserting into DOM, or via attribute. */
  set deck(d) {
    this.#deck = d;
  }

  set duration(val) {
    this.#duration = val;
  }

  set tiltGranted(val) {
    this.#tiltGranted = val;
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
    this.#startTimer();
    this.#startTilt();
    this.#bindControls();
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
    if (!this.#tiltGranted) return; // no permission or no sensor
    this.#tilt = new TiltDetector({
      onCorrect: () => this.#handleCorrect(),
      onSkip: () => this.#handleSkip(),
    });
    this.#tilt.start();
  }

  #bindControls() {
    const menuBtn = this.shadowRoot.querySelector('.menu-btn');
    const controls = this.shadowRoot.querySelector('.controls');

    // If tilt is unavailable, show controls by default
    if (!this.#tiltGranted) {
      controls.classList.add('visible');
      menuBtn.classList.add('open');
    }

    // Hamburger toggle
    menuBtn.addEventListener('click', () => {
      const open = controls.classList.toggle('visible');
      menuBtn.classList.toggle('open', open);
    });

    // Action buttons
    this.shadowRoot.querySelector('.btn-correct').addEventListener('click', () => this.#handleCorrect());
    this.shadowRoot.querySelector('.btn-skip').addEventListener('click', () => this.#handleSkip());
    this.shadowRoot.querySelector('.btn-pause').addEventListener('click', () => this.#togglePause());
    this.shadowRoot.querySelector('.btn-quit').addEventListener('click', () => this.#quit());
  }

  #togglePause() {
    this.#paused = !this.#paused;
    const pauseBtn = this.shadowRoot.querySelector('.btn-pause');
    const pauseOverlay = this.shadowRoot.querySelector('.pause-overlay');
    const wordEl = this.shadowRoot.querySelector('.word');

    if (this.#paused) {
      this.#timer?.stop();
      this.#tilt?.stop();
      pauseBtn.textContent = '▶ Resume';
      pauseOverlay.classList.add('visible');
      wordEl.style.visibility = 'hidden';
    } else {
      this.#timer?.start();
      if (this.#tiltGranted) this.#tilt?.start();
      pauseBtn.textContent = '⏸ Pause';
      pauseOverlay.classList.remove('visible');
      wordEl.style.visibility = '';
    }
  }

  #quit() {
    this.#timer?.stop();
    this.#tilt?.stop();
    this.dispatchEvent(new CustomEvent('go-home', { bubbles: true, composed: true }));
  }

  /* ---- Game logic ---- */
  #showWord() {
    const wordEl = this.shadowRoot.querySelector('.word');
    if (this.#index >= this.#words.length) {
      this.#endRound();
      return;
    }
    wordEl.textContent = wordText(this.#words[this.#index]);
    wordEl.classList.remove('pop');
    // force reflow for animation restart
    void wordEl.offsetWidth;
    wordEl.classList.add('pop');
  }

  #handleCorrect() {
    if (this.#index >= this.#words.length) return;
    this.#results.push({ word: wordText(this.#words[this.#index]), result: 'correct' });
    this.#audio.correct();
    this.#flashFeedback('correct');
    this.#index++;
    this.#showWord();
  }

  #handleSkip() {
    if (this.#index >= this.#words.length) return;
    this.#results.push({ word: wordText(this.#words[this.#index]), result: 'skipped' });
    this.#audio.skip();
    this.#flashFeedback('skip');
    this.#index++;
    this.#showWord();
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
      this.#results.push({ word: wordText(this.#words[this.#index]), result: 'skipped' });
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
