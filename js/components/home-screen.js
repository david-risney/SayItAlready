import { loadAllDecks, recordPlay, sortDecksByRecency } from '../services/deck-store.js';
import { requestTiltPermission, probeTiltAvailable } from '../services/tilt-detector.js';
import { wordText, hasDifficultyTags, filterByDifficulty } from '../models/deck.js';
import { getSettings, updateSettings, resetAllState } from '../services/settings.js';
import { APP_VERSION } from '../version.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .home {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: none;
    scroll-timeline: --home-scroll block;
    animation: bg-shift linear both;
    animation-timeline: --home-scroll;
    animation-range: 0px 300px;
  }
  @keyframes bg-shift {
    from { background: var(--color-bg, #1a1a2e); }
    to   { background: #d4b8e8; }
  }

  /* --- Sticky shrinking header (CSS scroll-driven) --- */
  .header {
    position: sticky;
    top: 0;
    z-index: 5;
    width: 100%;
    /* Fixed height = expanded size. Document flow never changes. */
    height: 7rem;
    flex-shrink: 0;
    overflow: hidden;
    background: transparent;
    display: flex;
    align-items: stretch;
  }
  .header-inner {
    background: linear-gradient(to bottom, var(--color-bg, #1a1a2e) 60%, transparent);
    width: 100%;
    box-sizing: border-box;
    padding: 1.5rem 1rem 1rem;
    padding-top: max(1.5rem, env(titlebar-area-y, 0px));
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    animation: shrink-inner linear both;
    animation-timeline: --home-scroll;
    animation-range: 0px 120px;
    /* WCO: make entire header draggable as titlebar */
    app-region: drag;
    -webkit-app-region: drag;
  }
  .header-title {
    text-align: center;
    flex: 1;
    max-width: 560px;
    padding: 0 1rem;
    box-sizing: border-box;
    position: relative;
  }
  .settings-btn {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255 255 255 / 0.1);
    border: none;
    color: var(--color-text-muted, #aaa);
    font-size: 1.1rem;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease;
    /* WCO: allow clicks on interactive elements */
    app-region: no-drag;
    -webkit-app-region: no-drag;
  }
  .settings-btn:hover { background: rgba(255 255 255 / 0.2); color: #fff; }

  /* When WCO is active, push settings button left to avoid window controls on the right */
  @media (display-mode: window-controls-overlay) {
    .settings-btn {
      left: 1rem;
      right: auto;
    }
  }
  h1 {
    font-size: 2.5em;
    font-weight: 800;
    line-height: 1.1;
    margin: 0;
  }
  h1 span {
    color: var(--color-primary, #e94560);
  }
  .subtitle {
    color: var(--color-text-muted, #aaa);
    font-size: 1em;
    margin-top: 0.35em;
    animation: fade-subtitle linear both;
    animation-timeline: --home-scroll;
    animation-range: 0px 50px;
  }

  @keyframes shrink-inner {
    from { font-size: 1rem; padding: 1.5rem 1rem 1rem; padding-top: max(1.5rem, env(titlebar-area-y, 0px));
           align-items: center; }
    to   { font-size: 0.55rem; padding: 1rem 1rem 0;
           align-items: flex-start; }
  }
  @keyframes fade-subtitle {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  /* --- Filter --- */
  .filter-wrap {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 0.5rem 1rem 0;
    box-sizing: border-box;
  }
  .filter-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.75rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    border-radius: var(--radius, 12px);
    background: var(--color-surface, #16213e);
    color: var(--color-text, #eee);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 200ms ease;
  }
  .filter-input::placeholder { color: var(--color-text-muted, #aaa); }
  .filter-input:focus { border-color: var(--color-primary, #e94560); }

  /* --- Deck list (card grid) --- */
  .deck-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr));
    gap: 0.75rem;
    width: 100%;
    max-width: 560px;
    padding: 0.5rem 1rem 2rem;
    margin: 0 auto;
    box-sizing: border-box;
  }
  .deck-card {
    aspect-ratio: 5 / 7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: var(--color-surface, #16213e);
    border-radius: var(--radius, 12px);
    padding: 0.75rem 0.5rem;
    cursor: pointer;
    border: 2px solid transparent;
    transition: transform 200ms ease, box-shadow 200ms ease;
    text-align: center;
  }
  .deck-card:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    z-index: 1;
  }
  .deck-card:active {
    transform: scale(0.97);
  }
  .deck-icon {
    font-size: 2.4rem;
    line-height: 1;
  }
  .deck-info {
    min-width: 0;
  }
  .deck-name {
    font-weight: 700;
    font-size: 0.85rem;
    line-height: 1.2;
  }
  .deck-meta {
    font-size: 0.7rem;
    color: var(--color-text-muted, #aaa);
    margin-top: 0.15em;
  }

  /* --- Modal backdrop --- */
  .modal-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .modal-backdrop.open {
    display: flex;
  }

  /* --- Modal --- */
  .modal {
    border-radius: var(--radius, 12px);
    max-width: 280px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modal-in 250ms ease;
    border: 1px solid rgba(255 255 255 / 0.12);
    box-shadow:
      0 1px 0 0 rgba(255 255 255 / 0.08) inset,
      0 8px 30px rgba(0, 0, 0, 0.5);
  }
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.9) translateY(12px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  /* Card portion — mirrors the deck card style */
  .modal-card {
    position: relative;
    aspect-ratio: 5 / 7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 1.5rem 1rem;
    background: var(--color-surface, #16213e);
  }
  .modal-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0 0 0 / 0.3);
    border: none;
    color: #fff;
    font-size: 1.2rem;
    line-height: 1;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease;
  }
  .modal-close:hover { background: rgba(0 0 0 / 0.5); }
  .modal-icon {
    font-size: 4rem;
    line-height: 1;
  }
  .modal-name {
    font-size: 1.4rem;
    font-weight: 800;
    line-height: 1.15;
  }
  .modal-desc {
    color: rgba(255 255 255 / 0.7);
    font-size: 0.85rem;
    margin-top: 0.25rem;
  }
  .modal-examples {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .modal-examples span {
    background: rgba(255 255 255 / 0.15);
    border-radius: 6px;
    padding: 0.25em 0.6em;
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
  }
  /* Actions below the card */
  .modal-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1rem 1.5rem 1.25rem;
    background: var(--color-surface, #16213e);
  }
  .difficulty-pills {
    display: none;
    gap: 0.4rem;
    justify-content: center;
  }
  .difficulty-pills.visible { display: flex; }
  .difficulty-pills button {
    font-size: 0.8rem;
    font-weight: 600;
    border: 2px solid rgba(255 255 255 / 0.2);
    border-radius: 999px;
    padding: 0.35em 0.9em;
    cursor: pointer;
    background: transparent;
    color: var(--color-text-muted, #aaa);
    transition: all 150ms ease;
  }
  .difficulty-pills button.selected {
    background: var(--color-primary, #e94560);
    border-color: var(--color-primary, #e94560);
    color: #fff;
  }
  .modal-start {
    background: var(--color-primary, #e94560);
    color: #fff;
    font-size: 1.3rem;
    font-weight: 700;
    border: none;
    border-radius: var(--radius, 12px);
    padding: 0.8em 2em;
    cursor: pointer;
    transition: background 200ms ease, transform 200ms ease;
    margin-top: 0.25rem;
  }
  .modal-start:hover { background: var(--color-primary-hover, #ff6b81); }
  .modal-start:active { transform: scale(0.96); }

  /* Landscape: side-by-side layout */
  @media (orientation: landscape) {
    .modal {
      flex-direction: row;
      max-width: 520px;
      max-height: 90vh;
    }
    .modal-card {
      aspect-ratio: auto;
      flex: 1 1 55%;
      min-height: 0;
      padding: 1rem 0.75rem;
      gap: 0.3rem;
    }
    .modal-icon { font-size: 2.5rem; }
    .modal-name { font-size: 1.1rem; }
    .modal-desc { font-size: 0.75rem; }
    .modal-examples { margin-top: 0.4rem; }
    .modal-actions {
      flex: 1 1 45%;
      justify-content: center;
      padding: 0.75rem 1rem;
    }
    .modal-start {
      font-size: 1.1rem;
      padding: 0.6em 1.5em;
    }
  }

  /* --- Settings modal --- */
  .settings-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .settings-backdrop.open { display: flex; }
  .settings-dialog {
    background: var(--color-surface, #16213e);
    border-radius: var(--radius, 12px);
    padding: 1.5rem;
    position: relative;
    max-width: 340px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: modal-in 250ms ease;
    border: 1px solid rgba(255 255 255 / 0.12);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }
  .settings-dialog h2 {
    font-size: 1.3rem;
    font-weight: 800;
    margin: 0;
    text-align: center;
  }
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .settings-section h3 {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #aaa);
    margin: 0;
  }
  .control-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.9rem;
    padding: 0.3rem 0;
    cursor: pointer;
  }
  .control-row .status {
    font-size: 1rem;
    width: 1.4em;
    text-align: center;
    flex-shrink: 0;
  }
  .control-row .label { flex: 1; }
  .control-row input[type="radio"] {
    accent-color: var(--color-primary, #e94560);
    width: 1.1em;
    height: 1.1em;
    cursor: pointer;
    flex-shrink: 0;
  }
  .control-row.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .control-row.disabled input[type="radio"] {
    cursor: not-allowed;
  }
  .kb-section {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.9rem;
    padding: 0.3rem 0;
  }
  .kb-section .status {
    font-size: 1rem;
    width: 1.4em;
    text-align: center;
    flex-shrink: 0;
  }
  .keybindings {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 2.6rem;
    font-size: 0.85rem;
    color: var(--color-text-muted, #aaa);
  }
  .keybindings .kb-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .keybindings kbd {
    background: rgba(255 255 255 / 0.1);
    border: 1px solid rgba(255 255 255 / 0.2);
    border-radius: 4px;
    padding: 0.1em 0.4em;
    font-size: 0.85em;
    font-family: inherit;
    color: var(--color-text, #eee);
    min-width: 3em;
    text-align: center;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.9rem;
    padding: 0.3rem 0;
  }
  .setting-row label {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  .setting-row input[type="checkbox"] {
    width: 1.1em;
    height: 1.1em;
    accent-color: var(--color-primary, #e94560);
    cursor: pointer;
    flex-shrink: 0;
  }
  .btn-reset {
    background: #c0392b;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    border: none;
    border-radius: var(--radius, 12px);
    padding: 0.6em 1.2em;
    cursor: pointer;
    transition: background 150ms ease;
    width: 100%;
  }
  .btn-reset:hover { background: #e74c3c; }
  .settings-divider {
    border: none;
    border-top: 1px solid rgba(255 255 255 / 0.1);
    margin: 0;
  }
  .settings-about {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .settings-about .app-name {
    font-size: 1.1rem;
    font-weight: 800;
  }
  .settings-about .app-version {
    font-size: 0.75rem;
    color: var(--color-text-muted, #aaa);
  }
  .settings-about .update-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    color: #fff;
    background: var(--color-primary, #e94560);
    border-radius: 6px;
    padding: 0.15em 0.5em;
    margin-left: 0.4em;
    vertical-align: middle;
  }
  .settings-about a {
    color: var(--color-primary, #e94560);
    text-decoration: none;
    font-size: 0.85rem;
  }
  .settings-about a:hover { text-decoration: underline; }
  .settings-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: rgba(255 255 255 / 0.1);
    border: none;
    color: var(--color-text-muted, #aaa);
    font-size: 1.2rem;
    line-height: 1;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease;
  }
  .settings-close:hover { background: rgba(255 255 255 / 0.2); color: var(--color-text, #eee); }
</style>

<div class="home">
  <div class="header">
    <div class="header-inner">
      <div class="header-title">
        <button class="settings-btn" aria-label="Settings">⚙</button>
        <h1>Say It <span>Already!</span></h1>
        <p class="subtitle">Pick a deck and get guessing</p>
      </div>
    </div>
  </div>
  <div class="filter-wrap">
    <input class="filter-input" type="text" placeholder="Search decks…">
  </div>
  <div class="deck-list" role="listbox" aria-label="Available decks"></div>
</div>

<div class="modal-backdrop">
  <div class="modal">
    <div class="modal-card">
      <button class="modal-close" aria-label="Close">✕</button>
      <div class="modal-icon"></div>
      <div class="modal-name"></div>
      <div class="modal-desc"></div>
      <div class="modal-examples"></div>
    </div>
    <div class="modal-actions">
      <div class="difficulty-pills">
        <button data-diff="0">Easy</button>
        <button data-diff="1" class="selected">Normal</button>
        <button data-diff="2">Hard</button>
      </div>
      <button class="modal-start">Start Game</button>
    </div>
  </div>
</div>

<div class="settings-backdrop">
  <div class="settings-dialog">
    <button class="settings-close" aria-label="Close">✕</button>
    <h2>⚙ Settings</h2>

    <div class="settings-section">
      <h3>Controls</h3>
      <label class="control-row control-gyro">
        <input type="radio" name="control-mode" value="gyro">
        <span class="status gyro-status">…</span>
        <span class="label">Tilt</span>
      </label>
      <label class="control-row control-swipe">
        <input type="radio" name="control-mode" value="swipe">
        <span class="status swipe-status">…</span>
        <span class="label">Swipe</span>
      </label>
      <label class="control-row control-touch">
        <input type="radio" name="control-mode" value="touch">
        <span class="status">&#x1F518;</span>
        <span class="label">Buttons</span>
      </label>
      <div class="kb-section">
        <span class="status">⌨️</span>
        <span class="label">Keyboard</span>
      </div>
      <div class="keybindings">
        <div class="kb-row"><kbd>Space</kbd> <span>Correct</span></div>
        <div class="kb-row"><kbd>Enter</kbd> <span>Skip</span></div>
        <div class="kb-row"><kbd>Esc</kbd> <span>Pause</span></div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Preferences</h3>
      <div class="setting-row">
        <label><input type="checkbox" class="chk-sound" checked> Sound effects</label>
      </div>
      <div class="setting-row">
        <label><input type="checkbox" class="chk-vibration" checked> Vibration</label>
      </div>
      <div class="setting-row">
        <label><input type="checkbox" class="chk-debug"> Debug overlay</label>
      </div>
    </div>

    <div class="settings-section">
      <h3>Data</h3>
      <button class="btn-reset">Reset all data</button>
    </div>

    <hr class="settings-divider">

    <div class="settings-about">
      <div class="app-name">Say It Already!</div>
      <div class="app-version">v${APP_VERSION} <span class="update-check"></span></div>
      <a href="https://github.com/david-risney/SayItAlready" target="_blank" rel="noopener">View on GitHub</a>
    </div>

  </div>
</div>
`;

export class HomeScreen extends HTMLElement {
  #selectedDeck = null;
  #selectedDifficulty = 1;
  #decks = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.#loadDecks();
    this.#bindModal();
    this.#bindFilter();
    this.#bindSettings();
  }

  async #loadDecks() {
    this.#decks = sortDecksByRecency(await loadAllDecks());
    this.#renderDecks();
    this.dispatchEvent(new Event('decks-loaded', { bubbles: true, composed: true }));
  }

  #renderDecks(filter = '') {
    const list = this.shadowRoot.querySelector('.deck-list');
    list.innerHTML = '';
    const q = filter.toLowerCase();
    const filtered = q ? this.#decks.filter(d => JSON.stringify(d).toLowerCase().includes(q)) : this.#decks;
    for (const deck of filtered) {
      const card = document.createElement('div');
      card.className = 'deck-card';
      card.setAttribute('role', 'option');
      if (deck.background) {
        card.style.background = deck.background;
      }
      card.innerHTML = `
        <span class="deck-icon">${deck.icon ?? '🃏'}</span>
        <div class="deck-info">
          <div class="deck-name">${deck.name}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        this.#openModal(deck);
        this.dispatchEvent(new CustomEvent('deck-preview-open', { bubbles: true, composed: true, detail: { deckId: deck.id } }));
      });
      list.appendChild(card);
    }
  }

  /* --- Modal open/close --- */
  #bindFilter() {
    const input = this.shadowRoot.querySelector('.filter-input');
    input.addEventListener('input', () => this.#renderDecks(input.value));
  }

  #bindSettings() {
    const backdrop = this.shadowRoot.querySelector('.settings-backdrop');
    const chkSound = this.shadowRoot.querySelector('.chk-sound');
    const chkVibration = this.shadowRoot.querySelector('.chk-vibration');
    const chkDebug = this.shadowRoot.querySelector('.chk-debug');
    const radioGyro = this.shadowRoot.querySelector('input[value="gyro"]');
    const radioTouch = this.shadowRoot.querySelector('input[value="touch"]');
    const radioSwipe = this.shadowRoot.querySelector('input[value="swipe"]');
    const gyroRow = this.shadowRoot.querySelector('.control-gyro');
    const swipeRow = this.shadowRoot.querySelector('.control-swipe');

    // Load saved settings
    const settings = getSettings();
    chkSound.checked = settings.soundEnabled;
    chkVibration.checked = settings.vibrationEnabled;
    chkDebug.checked = settings.debugOverlay;
    if (settings.controlMode === 'touch') {
      radioTouch.checked = true;
    } else if (settings.controlMode === 'swipe') {
      radioSwipe.checked = true;
    } else {
      radioGyro.checked = true;
    }

    this.shadowRoot.querySelector('.settings-btn').addEventListener('click', async () => {
      this.#openSettingsUI();
      this.dispatchEvent(new Event('settings-open', { bubbles: true, composed: true }));
    });
    this.shadowRoot.querySelector('.settings-close').addEventListener('click', () => {
      backdrop.classList.remove('open');
      history.back();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('open');
        history.back();
      }
    });

    radioGyro.addEventListener('change', () => { if (radioGyro.checked) updateSettings({ controlMode: 'gyro' }); });
    radioTouch.addEventListener('change', () => { if (radioTouch.checked) updateSettings({ controlMode: 'touch' }); });
    radioSwipe.addEventListener('change', () => { if (radioSwipe.checked) updateSettings({ controlMode: 'swipe' }); });
    chkSound.addEventListener('change', () => updateSettings({ soundEnabled: chkSound.checked }));
    chkVibration.addEventListener('change', () => updateSettings({ vibrationEnabled: chkVibration.checked }));
    chkDebug.addEventListener('change', () => updateSettings({ debugOverlay: chkDebug.checked }));
    this.shadowRoot.querySelector('.btn-reset').addEventListener('click', () => {
      if (confirm('This will erase all play history and custom decks. Continue?')) {
        resetAllState();
      }
    });
  }

  async #openSettingsUI() {
    const backdrop = this.shadowRoot.querySelector('.settings-backdrop');
    const radioGyro = this.shadowRoot.querySelector('input[value="gyro"]');
    const radioTouch = this.shadowRoot.querySelector('input[value="touch"]');
    const radioSwipe = this.shadowRoot.querySelector('input[value="swipe"]');
    const gyroRow = this.shadowRoot.querySelector('.control-gyro');
    const swipeRow = this.shadowRoot.querySelector('.control-swipe');
    backdrop.classList.add('open');

    // Probe touch support for swipe
    const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const swipeStatus = this.shadowRoot.querySelector('.swipe-status');
    swipeStatus.textContent = touchSupported ? '👆' : '❌';
    if (!touchSupported) {
      radioSwipe.disabled = true;
      swipeRow.classList.add('disabled');
      if (getSettings().controlMode === 'swipe') {
        radioTouch.checked = true;
        updateSettings({ controlMode: 'touch' });
      }
    } else {
      radioSwipe.disabled = false;
      swipeRow.classList.remove('disabled');
    }

    const gyroAvailable = await this.#probeGyro();
    if (!gyroAvailable) {
      radioGyro.disabled = true;
      gyroRow.classList.add('disabled');
      if (getSettings().controlMode === 'gyro') {
        radioTouch.checked = true;
        updateSettings({ controlMode: 'touch' });
      }
    } else {
      radioGyro.disabled = false;
      gyroRow.classList.remove('disabled');
    }

    // Check for newer version
    this.#checkForUpdate();
  }

  async #checkForUpdate() {
    const el = this.shadowRoot.querySelector('.update-check');
    el.textContent = '';
    try {
      const url = `./js/version.js?cache=off&uid=${Date.now()}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const text = await resp.text();
      const match = text.match(/APP_VERSION\s*=\s*'([^']+)'/);
      if (!match) return;
      const remote = match[1];
      if (remote !== APP_VERSION) {
        el.innerHTML = `<span class="update-badge">v${remote} available \u2014 update</span>`;
        el.style.cursor = 'pointer';
        el.addEventListener('click', async () => {
          el.textContent = 'Updating\u2026';
          // Clear all SW caches and unregister, then hard reload
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          const regs = await navigator.serviceWorker?.getRegistrations() ?? [];
          await Promise.all(regs.map(r => r.unregister()));
          location.reload();
        }, { once: true });
      }
    } catch { /* offline or fetch failed \u2014 silently skip */ }
  }

  async #probeGyro() {
    const el = this.shadowRoot.querySelector('.gyro-status');
    el.textContent = '…';
    const permGranted = await requestTiltPermission();
    if (!permGranted) { el.textContent = '❌'; return false; }
    const available = await probeTiltAvailable(1500);
    el.textContent = available ? '✅' : '❌';
    return available;
  }

  #bindModal() {
    const backdrop = this.shadowRoot.querySelector('.modal-backdrop');
    this.shadowRoot.querySelector('.modal-close').addEventListener('click', () => {
      this.#closeModal();
      history.back();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.#closeModal();
        history.back();
      }
    });
    this.shadowRoot.querySelector('.modal-start').addEventListener('click', () => this.#startGame());
    // Difficulty pill selection
    const pills = this.shadowRoot.querySelector('.difficulty-pills');
    pills.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-diff]');
      if (!btn) return;
      this.#selectedDifficulty = parseInt(btn.dataset.diff, 10);
      pills.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === btn));
      this.#updateExamples();
    });
  }

  #openModal(deck) {
    this.#selectedDeck = deck;
    this.#selectedDifficulty = 1;
    const backdrop = this.shadowRoot.querySelector('.modal-backdrop');
    const modalCard = this.shadowRoot.querySelector('.modal-card');
    this.shadowRoot.querySelector('.modal-icon').textContent = deck.icon ?? '\u{1F0CF}';
    this.shadowRoot.querySelector('.modal-name').textContent = deck.name;
    this.shadowRoot.querySelector('.modal-desc').textContent = deck.description || '';
    // Show 3 random example words
    this.#updateExamples();
    // Apply deck background to card portion
    modalCard.style.background = deck.background || '';
    // Show difficulty pills if deck has difficulty tags
    const pills = this.shadowRoot.querySelector('.difficulty-pills');
    if (hasDifficultyTags(deck)) {
      pills.classList.add('visible');
      pills.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.diff === '1'));
    } else {
      pills.classList.remove('visible');
    }
    backdrop.classList.add('open');
  }

  #closeModal() {
    this.#selectedDeck = null;
    this.shadowRoot.querySelector('.modal-backdrop').classList.remove('open');
  }

  #updateExamples() {
    const examples = this.shadowRoot.querySelector('.modal-examples');
    const pool = hasDifficultyTags(this.#selectedDeck)
      ? filterByDifficulty(this.#selectedDeck.words, this.#selectedDifficulty)
      : this.#selectedDeck.words;
    const sample = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    examples.innerHTML = sample.map(w => `<span>${wordText(w)}</span>`).join('');
  }

  /* ---- Public API for router ---- */
  openDeckById(id) {
    const deck = this.#decks?.find(d => d.id === id || d.name === id);
    if (deck) this.#openModal(deck);
  }

  openSettings() {
    this.#openSettingsUI();
  }

  closeDialogs() {
    this.#closeModal();
    this.shadowRoot.querySelector('.settings-backdrop')?.classList.remove('open');
  }

  async #startGame() {
    if (!this.#selectedDeck) return;
    recordPlay(this.#selectedDeck.id);
    const controlMode = getSettings().controlMode;
    let tiltAvailable = false;
    if (controlMode === 'gyro') {
      const permGranted = await requestTiltPermission();
      tiltAvailable = permGranted ? await probeTiltAvailable(1500) : false;
    }
    this.dispatchEvent(
      new CustomEvent('start-game', {
        bubbles: true,
        composed: true,
        detail: {
          deck: this.#selectedDeck,
          tiltGranted: tiltAvailable,
          controlMode,
          difficulty: this.#selectedDifficulty,
        },
      })
    );
  }
}

customElements.define('home-screen', HomeScreen);
