import { loadAllDecks } from '../services/deck-store.js';
import { requestTiltPermission, probeTiltAvailable } from '../services/tilt-detector.js';
import { wordText, hasDifficultyTags, filterByDifficulty } from '../models/deck.js';

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
  }
  .header-inner {
    background: var(--color-bg, #1a1a2e);
    text-align: center;
    width: 100%;
    box-sizing: border-box;
    padding: 1.5rem 1rem 1rem;
    font-size: 1rem;
    animation: shrink-inner linear both;
    animation-timeline: --home-scroll;
    animation-range: 0px 80px;
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
    from { font-size: 1rem; padding: 1.5rem 1rem 1rem; }
    to   { font-size: 0.55rem; padding: 0.8em 1rem 0.5em; }
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
</style>

<div class="home">
  <div class="header">
    <div class="header-inner">
      <h1>Say It <span>Already!</span></h1>
      <p class="subtitle">Pick a deck and get guessing</p>
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
  }

  async #loadDecks() {
    this.#decks = await loadAllDecks();
    this.#renderDecks();
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
      card.addEventListener('click', () => this.#openModal(deck));
      list.appendChild(card);
    }
  }

  /* --- Modal open/close --- */
  #bindFilter() {
    const input = this.shadowRoot.querySelector('.filter-input');
    input.addEventListener('input', () => this.#renderDecks(input.value));
  }

  #bindModal() {
    const backdrop = this.shadowRoot.querySelector('.modal-backdrop');
    this.shadowRoot.querySelector('.modal-close').addEventListener('click', () => this.#closeModal());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.#closeModal();
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

  async #startGame() {
    if (!this.#selectedDeck) return;
    const permGranted = await requestTiltPermission();
    const tiltAvailable = permGranted ? await probeTiltAvailable(1500) : false;
    this.dispatchEvent(
      new CustomEvent('start-game', {
        bubbles: true,
        composed: true,
        detail: { deck: this.#selectedDeck, tiltGranted: tiltAvailable, difficulty: this.#selectedDifficulty },
      })
    );
  }
}

customElements.define('home-screen', HomeScreen);
