import { loadAllDecks, recordPlay, getPlayHistory, sortDecksByRecency, saveDeck, deleteDeck, toggleFavorite, isFavorite } from '../services/deck-store.js';
import { requestTiltPermission, probeTiltAvailable } from '../services/tilt-detector.js';
import { wordText, hasDifficultyTags, filterByDifficulty } from '../models/deck.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { APP_VERSION } from '../version.js';
import { getInstallPrompt, clearInstallPrompt, isInstalledPWA } from '../services/install.js';
import { compressToBase64 } from '../services/compress.js';
import { qrcodeSVG } from '../vendor/qrcode.js';

const template = document.createElement('template');
template.innerHTML = `
<link rel="stylesheet" href="./css/home-screen.css">
<div class="home">
  <div class="header">
    <div class="header-inner">
      <div class="header-title">
        <button class="settings-btn" aria-label="Settings">⚙</button>
        <h1><span class="header-text">Say It<br><span>Already</span></span><img class="header-logo" src="icons/icon-nobg.svg" alt="" width="60" height="60"></h1>
      </div>
    </div>
  </div>
  <div class="filter-wrap">
    <input class="filter-input" type="text" placeholder="Search decks…">
  </div>
  <div class="deck-list" role="listbox" aria-label="Available decks"></div>
</div>

<div class="import-backdrop">
  <div class="import-dialog">
    <button class="edit-close dialog-close" aria-label="Close">✕</button>
    <h2 class="edit-title">Add Deck</h2>

    <div class="edit-tabs">
      <button class="tab-editor active" data-tab="editor">Editor</button>
      <button class="tab-json" data-tab="json">JSON</button>
      <button class="tab-qr" data-tab="qr">QR Code</button>
    </div>

    <div class="edit-pane visible">
      <div class="edit-field-row">
        <div class="edit-field">
          <label>Icon</label>
          <input class="edit-icon" type="text" placeholder="🎲" maxlength="4">
        </div>
        <div class="edit-field" style="flex:3">
          <label>Name</label>
          <input class="edit-name" type="text" placeholder="My Deck">
        </div>
      </div>
      <div class="edit-field">
        <label>Description</label>
        <input class="edit-desc" type="text" placeholder="A fun deck about…">
      </div>
      <div class="edit-field">
        <label>Background</label>
        <div class="edit-color-row">
          <input class="edit-color1" type="color" value="#2d6a4f">
          <input class="edit-color2" type="color" value="#40916c">
          <div class="edit-color-preview"></div>
        </div>
      </div>
      <div class="edit-field">
        <div class="edit-words-header">Words</div>
        <div class="edit-words-list"></div>
        <button class="add-word-btn">＋ Add Word</button>
      </div>
    </div>

    <div class="json-pane">
      <textarea class="json-textarea" placeholder='{"id":"my-deck","name":"My Deck","icon":"🎲","words":[{"text":"Example","tags":["easy"]}]}'></textarea>
    </div>

    <div class="qr-pane">
      <div class="qr-output"></div>
      <div class="qr-url-row">
        <input class="qr-url" type="text" readonly>
        <button class="qr-copy" title="Copy link">📋</button>
      </div>
      <div class="qr-error"></div>
    </div>

    <div class="import-error"></div>
    <div class="import-actions">
      <button class="import-delete">🗑 Delete</button>
      <button class="import-cancel">Cancel</button>
      <button class="import-submit">Save</button>
    </div>
  </div>
</div>

<div class="htp-backdrop">
  <div class="htp-dialog">
    <button class="htp-close dialog-close" aria-label="Close">✕</button>

    <div class="htp-page active" data-page="0">
      <h2>How to Play</h2>
      <p class="htp-intro">A party guessing game to play with a group!</p>
      <div class="htp-steps">
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Pick a Deck</h3>
            <p>Choose a theme your group knows — movies, TV shows, games, and more.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Hold Phone to Forehead</h3>
            <p>Place the phone on your forehead so everyone else can see the word — but you can't!</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Friends Give Clues</h3>
            <p>Your friends describe the word without saying it. They can talk, act, or make sounds.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Tilt to Answer</h3>
            <p>Got it? Tilt the phone down. Too hard? Tilt up to skip. You can also swipe or tap buttons.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Beat the Clock</h3>
            <p>Get as many words as you can before time runs out!</p>
          </div>
        </div>
      </div>
    </div>

    <div class="htp-page" data-page="1">
      <h2>Settings</h2>
      <p class="htp-section-intro">Tap the ⚙️ gear icon to open Settings and customize your experience.</p>
      <div class="htp-steps">
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Controls</h3>
            <p>Choose how to answer: <b>Tilt</b> the phone, <b>Swipe</b> on screen, or use on-screen <b>Buttons</b>. Keyboard controls are also available on desktop.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Timer</h3>
            <p>Set the round length — 30, 60, 90, or 120 seconds. Shorter rounds are faster and more frantic!</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Sound &amp; Vibration</h3>
            <p>Toggle sound effects and haptic feedback on or off.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Install &amp; Update</h3>
            <p>Install the app for offline play. When an update is available, a button appears to refresh.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="htp-page" data-page="2">
      <h2>Custom Decks</h2>
      <p class="htp-section-intro">Create your own decks or import decks shared by friends!</p>
      <div class="htp-steps">
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Tap the ＋ Add Card</h3>
            <p>At the end of the deck list, tap the + card to open the deck editor.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Use the Editor</h3>
            <p>Give your deck a name, pick an icon and colors, then add words with Easy / Medium / Hard difficulty.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Or Paste JSON</h3>
            <p>Switch to the JSON tab to paste a deck shared with you, or export your own deck as JSON to share.</p>
          </div>
        </div>
        <div class="htp-step">
          <div class="htp-step-num"></div>
          <div class="htp-step-body">
            <h3>Edit &amp; Delete</h3>
            <p>Custom decks show a ✏️ button on the card. Tap it to edit or delete the deck anytime.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="htp-nav">
      <button class="htp-nav-btn htp-prev hidden">← Back</button>
      <div class="htp-dots">
        <div class="htp-dot active"></div>
        <div class="htp-dot"></div>
        <div class="htp-dot"></div>
      </div>
      <button class="htp-nav-btn htp-next">Next →</button>
    </div>
    <button class="htp-got-it">Got It!</button>
  </div>
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
    <button class="settings-close dialog-close" aria-label="Close">✕</button>

    <div class="settings-about">
      <a class="about-header" href="https://github.com/david-risney/SayItAlready" target="_blank" rel="noopener">
        <span class="about-text">Say It<br><span class="accent">Already</span></span>
        <img class="about-logo" src="icons/icon-nobg.svg" alt="" width="48" height="48">
      </a>
      <span class="about-version">v${APP_VERSION}</span>
      <div class="about-status">
        <span class="update-check"></span>
        <span class="install-check" style="display:none"></span>
      </div>
    </div>

    <hr class="settings-divider">

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
      <label class="control-row control-kb">
        <input type="radio" name="control-kb" value="keyboard" checked disabled>
        <span class="status">⌨️</span>
        <span class="label">Keyboard</span>
      </label>
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
      <h3>Timer</h3>
      <div class="timer-pills">
        <button data-timer="30">30 s</button>
        <button data-timer="60">60 s</button>
        <button data-timer="90">90 s</button>
        <button data-timer="120">120 s</button>
      </div>
    </div>

  </div>
</div>
`;

export class HomeScreen extends HTMLElement {
  #selectedDeck = null;
  #selectedDifficulty = 1;
  #decks = [];
  #editingDeck = null; // deck being edited (null = new deck)

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
    this.#bindImport();
    this.#bindHowToPlay();
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

    const htpSeen = localStorage.getItem('sayitalready-htp-seen') === '1' || Object.keys(getPlayHistory()).length > 0;
    const htpCard = this.#createHtpCard();

    // If not seen, place HTP card first
    if (!htpSeen) {
      htpCard.style.animation = `card-in 300ms ease 0ms both`;
      list.appendChild(htpCard);
    }

    const offset = htpSeen ? 0 : 1;
    for (let i = 0; i < filtered.length; i++) {
      const deck = filtered[i];
      const card = document.createElement('div');
      card.className = 'deck-card';
      card.setAttribute('role', 'option');
      if (deck.background) {
        card.style.background = deck.background;
      }
      const fav = isFavorite(deck.id);
      const favSpan = document.createElement('span');
      favSpan.className = `deck-fav ${fav ? 'active' : ''}`;
      favSpan.dataset.deckId = deck.id;
      favSpan.textContent = fav ? '★' : '☆';
      card.appendChild(favSpan);
      if (deck.custom) {
        const editBtn = document.createElement('button');
        editBtn.className = 'deck-edit';
        editBtn.setAttribute('aria-label', 'Edit deck');
        editBtn.textContent = '✏️';
        card.appendChild(editBtn);
      }
      const iconSpan = document.createElement('span');
      iconSpan.className = 'deck-icon';
      iconSpan.textContent = deck.icon ?? '🃏';
      card.appendChild(iconSpan);
      const info = document.createElement('div');
      info.className = 'deck-info';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'deck-name';
      nameDiv.textContent = deck.name;
      info.appendChild(nameDiv);
      card.appendChild(info);

      const favBtn = card.querySelector('.deck-fav');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(deck.id);
        this.#decks = sortDecksByRecency(this.#decks);
        this.#renderDecks(this.shadowRoot.querySelector('.filter-input').value);
      });
      const editBtn = card.querySelector('.deck-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#openEditDialog(deck);
          this.dispatchEvent(new CustomEvent('edit-deck-open', { bubbles: true, composed: true, detail: { deckId: deck.id } }));
        });
      }
      card.style.animation = `card-in 300ms ease ${(i + offset) * 40}ms both`;
      card.addEventListener('click', () => {
        this.#openModal(deck);
        this.dispatchEvent(new CustomEvent('deck-preview-open', { bubbles: true, composed: true, detail: { deckId: deck.id } }));
      });
      list.appendChild(card);
    }

    // If already seen, place HTP card at end (before Add)
    if (htpSeen) {
      htpCard.style.animation = `card-in 300ms ease ${filtered.length * 40}ms both`;
      list.appendChild(htpCard);
    }

    // Always-last "add" card
    const addCard = document.createElement('div');
    addCard.className = 'deck-card-add';
    addCard.innerHTML = `<span class="add-icon">＋</span><span class="add-label">Add</span>`;
    addCard.addEventListener('click', () => this.#openImportDialog());
    list.appendChild(addCard);
  }

  #createHtpCard() {
    const card = document.createElement('div');
    card.className = 'deck-card-htp';
    card.innerHTML = `<span class="htp-icon">❓</span><span class="htp-label">How to Play</span>`;
    card.addEventListener('click', () => this.#openHowToPlay());
    return card;
  }

  #openHowToPlay() {
    this._htpShowPage?.();
    this.shadowRoot.querySelector('.htp-backdrop').classList.add('open');
    this.dispatchEvent(new CustomEvent('help-open', { bubbles: true, composed: true }));
  }

  #closeHowToPlay() {
    this.shadowRoot.querySelector('.htp-backdrop').classList.remove('open');
    if (localStorage.getItem('sayitalready-htp-seen') !== '1') {
      localStorage.setItem('sayitalready-htp-seen', '1');
      this.#renderDecks(this.shadowRoot.querySelector('.filter-input').value);
    }
    history.back();
  }

  #bindHowToPlay() {
    const backdrop = this.shadowRoot.querySelector('.htp-backdrop');
    this.shadowRoot.querySelector('.htp-close').addEventListener('click', () => this.#closeHowToPlay());
    this.shadowRoot.querySelector('.htp-got-it').addEventListener('click', () => this.#closeHowToPlay());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.#closeHowToPlay();
    });

    const pages = this.shadowRoot.querySelectorAll('.htp-page');
    const dots = this.shadowRoot.querySelectorAll('.htp-dot');
    const prev = this.shadowRoot.querySelector('.htp-prev');
    const next = this.shadowRoot.querySelector('.htp-next');
    const gotIt = this.shadowRoot.querySelector('.htp-got-it');
    let current = 0;
    const total = pages.length;

    const showPage = (i) => {
      current = i;
      pages.forEach((p, idx) => p.classList.toggle('active', idx === i));
      dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
      prev.classList.toggle('hidden', i === 0);
      next.classList.toggle('hidden', i === total - 1);
      gotIt.style.display = i === total - 1 ? '' : 'none';
      this.shadowRoot.querySelector('.htp-dialog').scrollTop = 0;
    };

    prev.addEventListener('click', () => { if (current > 0) showPage(current - 1); });
    next.addEventListener('click', () => { if (current < total - 1) showPage(current + 1); });

    // Reset to first page when opened
    this._htpShowPage = () => showPage(0);
  }

  /* --- Modal open/close --- */
  #bindFilter() {
    const input = this.shadowRoot.querySelector('.filter-input');
    input.addEventListener('input', () => this.#renderDecks(input.value));
  }

  #bindImport() {
    const backdrop = this.shadowRoot.querySelector('.import-backdrop');
    const errorEl = this.shadowRoot.querySelector('.import-error');

    // Close
    this.shadowRoot.querySelector('.edit-close').addEventListener('click', () => {
      this.#closeEditDialog();
    });
    this.shadowRoot.querySelector('.import-cancel').addEventListener('click', () => {
      this.#closeEditDialog();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.#closeEditDialog();
    });

    // Tab switching
    const tabs = this.shadowRoot.querySelector('.edit-tabs');
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      const mode = btn.dataset.tab;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      const editPane = this.shadowRoot.querySelector('.edit-pane');
      const jsonPane = this.shadowRoot.querySelector('.json-pane');
      const qrPane = this.shadowRoot.querySelector('.qr-pane');
      editPane.classList.toggle('visible', mode === 'editor');
      jsonPane.classList.toggle('visible', mode === 'json');
      qrPane.classList.toggle('visible', mode === 'qr');
      // Sync data between panes on switch
      if (mode === 'json') {
        this.shadowRoot.querySelector('.json-textarea').value =
          JSON.stringify(this.#buildDeckFromEditor(), null, 2);
      } else if (mode === 'qr') {
        this.#generateQR();
      } else {
        try {
          const deck = JSON.parse(this.shadowRoot.querySelector('.json-textarea').value);
          this.#populateEditor(deck);
        } catch { /* keep editor as-is if JSON is invalid */ }
      }
    });

    // Copy QR URL
    this.shadowRoot.querySelector('.qr-copy').addEventListener('click', () => {
      const url = this.shadowRoot.querySelector('.qr-url').value;
      if (url) navigator.clipboard.writeText(url).then(() => {
        const btn = this.shadowRoot.querySelector('.qr-copy');
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1500);
      });
    });

    // Color pickers — update preview
    const color1 = this.shadowRoot.querySelector('.edit-color1');
    const color2 = this.shadowRoot.querySelector('.edit-color2');
    const preview = this.shadowRoot.querySelector('.edit-color-preview');
    const updatePreview = () => {
      preview.style.background = `linear-gradient(135deg, ${color1.value}, ${color2.value})`;
    };
    color1.addEventListener('input', updatePreview);
    color2.addEventListener('input', updatePreview);

    // Add word button
    this.shadowRoot.querySelector('.add-word-btn').addEventListener('click', () => {
      const list = this.shadowRoot.querySelector('.edit-words-list');
      const lastSelect = list.querySelector('.edit-word-row:last-child select');
      const prevDiff = lastSelect ? lastSelect.value : '0';
      this.#addWordRow('', prevDiff);
      const last = list.querySelector('.edit-word-row:last-child input');
      if (last) last.focus();
    });

    // Save
    this.shadowRoot.querySelector('.import-submit').addEventListener('click', async () => {
      errorEl.textContent = '';
      try {
        const isJson = this.shadowRoot.querySelector('.json-pane').classList.contains('visible');
        if (isJson) {
          await this.#importDeckJSON(this.shadowRoot.querySelector('.json-textarea').value.trim());
        } else {
          await this.#saveFromEditor();
        }
        this.#closeEditDialog();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });

    // Delete
    this.shadowRoot.querySelector('.import-delete').addEventListener('click', async () => {
      if (!this.#editingDeck) return;
      await deleteDeck(this.#editingDeck.id);
      this.#decks = sortDecksByRecency(await loadAllDecks());
      this.#renderDecks();
      this.#closeEditDialog();
    });
  }

  #closeEditDialog() {
    this.shadowRoot.querySelector('.import-backdrop').classList.remove('open');
    this.#editingDeck = null;
    history.back();
  }

  async #generateQR() {
    const output = this.shadowRoot.querySelector('.qr-output');
    const urlEl = this.shadowRoot.querySelector('.qr-url');
    const errEl = this.shadowRoot.querySelector('.qr-error');
    output.innerHTML = '';
    urlEl.value = '';
    errEl.textContent = '';
    try {
      const deck = this.#buildDeckFromEditor();
      if (!deck.name) throw new Error('Add a name first');
      if (!deck.words.length) throw new Error('Add some words first');
      const json = JSON.stringify(deck);
      const compressed = await compressToBase64(json);
      const base = location.origin + location.pathname;
      const url = `${base}?view=edit&add=${compressed}`;
      urlEl.value = url;
      const svg = qrcodeSVG(url);
      output.innerHTML = svg;
    } catch (err) {
      errEl.textContent = err.message === 'data too large for QR code'
        ? 'Deck has too many words for a QR code'
        : (err.message || 'Could not generate QR code');
    }
  }

  /** Open editor for a new deck */
  #openImportDialog() {
    this.#editingDeck = null;
    this.#resetEditor();
    this.shadowRoot.querySelector('.edit-title').textContent = 'Add Deck';
    this.shadowRoot.querySelector('.import-delete').classList.remove('visible');
    this.shadowRoot.querySelector('.import-submit').textContent = 'Save';
    this.shadowRoot.querySelector('.import-backdrop').classList.add('open');
    this.shadowRoot.querySelector('.edit-name').focus();
    this.dispatchEvent(new CustomEvent('edit-deck-open', { bubbles: true, composed: true, detail: { deckId: null } }));
  }

  /** Open editor pre-populated with an existing custom deck */
  #openEditDialog(deck) {
    this.#editingDeck = deck;
    this.#resetEditor();
    this.#populateEditor(deck);
    this.shadowRoot.querySelector('.json-textarea').value = JSON.stringify(deck, null, 2);
    this.shadowRoot.querySelector('.edit-title').textContent = 'Edit Deck';
    this.shadowRoot.querySelector('.import-delete').classList.add('visible');
    this.shadowRoot.querySelector('.import-submit').textContent = 'Save';
    this.shadowRoot.querySelector('.import-backdrop').classList.add('open');
  }

  static #randomColor() {
    const h = Math.floor(Math.random() * 360);
    const s = 40 + Math.floor(Math.random() * 30);
    const l = 30 + Math.floor(Math.random() * 20);
    // Convert HSL to hex
    const hsl2hex = (h, s, l) => {
      s /= 100; l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
      return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
    };
    return hsl2hex(h, s, l);
  }

  #updateColorPreview() {
    const c1 = this.shadowRoot.querySelector('.edit-color1').value;
    const c2 = this.shadowRoot.querySelector('.edit-color2').value;
    this.shadowRoot.querySelector('.edit-color-preview').style.background =
      `linear-gradient(135deg, ${c1}, ${c2})`;
  }

  #resetEditor() {
    this.shadowRoot.querySelector('.import-error').textContent = '';
    this.shadowRoot.querySelector('.edit-icon').value = '';
    this.shadowRoot.querySelector('.edit-name').value = '';
    this.shadowRoot.querySelector('.edit-desc').value = '';
    const c1 = HomeScreen.#randomColor();
    const c2 = HomeScreen.#randomColor();
    this.shadowRoot.querySelector('.edit-color1').value = c1;
    this.shadowRoot.querySelector('.edit-color2').value = c2;
    this.#updateColorPreview();
    this.shadowRoot.querySelector('.edit-words-list').innerHTML = '';
    this.shadowRoot.querySelector('.json-textarea').value = '';
    // Reset to editor tab
    const tabs = this.shadowRoot.querySelector('.edit-tabs');
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'editor'));
    this.shadowRoot.querySelector('.edit-pane').classList.add('visible');
    this.shadowRoot.querySelector('.json-pane').classList.remove('visible');
    this.shadowRoot.querySelector('.qr-pane').classList.remove('visible');
    this.shadowRoot.querySelector('.qr-output').innerHTML = '';
    this.shadowRoot.querySelector('.qr-url').value = '';
    this.shadowRoot.querySelector('.qr-error').textContent = '';
  }

  #populateEditor(deck) {
    this.shadowRoot.querySelector('.edit-icon').value = deck.icon || '';
    this.shadowRoot.querySelector('.edit-name').value = deck.name || '';
    this.shadowRoot.querySelector('.edit-desc').value = deck.description || '';
    // Parse gradient colors from background string
    const bgMatch = (deck.background || '').match(/#[0-9a-fA-F]{6}/g);
    if (bgMatch && bgMatch.length >= 2) {
      this.shadowRoot.querySelector('.edit-color1').value = bgMatch[0];
      this.shadowRoot.querySelector('.edit-color2').value = bgMatch[1];
    }
    this.#updateColorPreview();
    const wordsList = this.shadowRoot.querySelector('.edit-words-list');
    wordsList.innerHTML = '';
    if (deck.words) {
      for (const w of deck.words) {
        const text = typeof w === 'string' ? w : (w.text || '');
        const diff = typeof w === 'object' && w.tags ? (w.tags.find(t => t.startsWith('difficulty:')) || '') : '';
        const diffVal = diff ? diff.split(':')[1] : '0';
        this.#addWordRow(text, diffVal);
      }
    }
  }

  #addWordRow(text = '', difficulty = '0') {
    const list = this.shadowRoot.querySelector('.edit-words-list');
    const row = document.createElement('div');
    row.className = 'edit-word-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Word or phrase';
    input.value = text;
    const select = document.createElement('select');
    for (const [val, label] of [['0','Easy'],['1','Normal'],['2','Hard']]) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === difficulty) opt.selected = true;
      select.appendChild(opt);
    }
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-word';
    removeBtn.setAttribute('aria-label', 'Remove');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => row.remove());
    row.append(input, select, removeBtn);
    list.appendChild(row);
  }

  #buildDeckFromEditor() {
    const name = this.shadowRoot.querySelector('.edit-name').value.trim();
    const id = this.#editingDeck?.id ||
      (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.floor(Math.random() * 9000 + 1000));
    const icon = this.shadowRoot.querySelector('.edit-icon').value.trim() || undefined;
    const description = this.shadowRoot.querySelector('.edit-desc').value.trim() || undefined;
    const c1 = this.shadowRoot.querySelector('.edit-color1').value;
    const c2 = this.shadowRoot.querySelector('.edit-color2').value;
    const background = `linear-gradient(135deg, ${c1}, ${c2})`;
    const wordRows = this.shadowRoot.querySelectorAll('.edit-words-list .edit-word-row');
    const words = [];
    for (const row of wordRows) {
      const text = row.querySelector('input').value.trim();
      if (!text) continue;
      const diff = row.querySelector('select').value;
      const tags = diff !== '' ? [`difficulty:${diff}`] : [];
      words.push(tags.length ? { text, tags } : { text });
    }
    return { id, name, icon, description, background, words, custom: true };
  }

  async #saveFromEditor() {
    const deck = this.#buildDeckFromEditor();
    if (!deck.name) throw new Error('Name is required');
    if (deck.words.length === 0) throw new Error('Add at least one word');
    await saveDeck(deck);
    this.#decks = sortDecksByRecency(await loadAllDecks());
    this.#renderDecks();
  }

  /** Validate and import a deck from JSON string. */
  async #importDeckJSON(raw) {
    let deck;
    try { deck = JSON.parse(raw); } catch { throw new Error('Invalid JSON'); }
    if (!deck || typeof deck !== 'object') throw new Error('Deck must be a JSON object');
    if (typeof deck.id !== 'string' || !deck.id.trim()) throw new Error('Missing "id" (string)');
    if (typeof deck.name !== 'string' || !deck.name.trim()) throw new Error('Missing "name" (string)');
    if (!Array.isArray(deck.words) || deck.words.length === 0) throw new Error('Missing "words" array');
    for (const w of deck.words) {
      if (typeof w === 'string') continue; // allow plain strings
      if (!w || typeof w !== 'object') throw new Error('Each word must be string or {text, tags?}');
      if (typeof w.text !== 'string' || !w.text.trim()) throw new Error('Each word object needs a "text" property');
    }
    // Normalize: ensure words are objects
    deck.words = deck.words.map(w => typeof w === 'string' ? { text: w } : w);
    // Mark as custom
    deck.custom = true;
    await saveDeck(deck);
    // Reload deck list
    this.#decks = sortDecksByRecency(await loadAllDecks());
    this.#renderDecks();
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

    // Timer duration pills
    const timerPills = this.shadowRoot.querySelector('.timer-pills');
    const timerDuration = settings.timerDuration || 60;
    timerPills.querySelectorAll('button').forEach(b =>
      b.classList.toggle('selected', parseInt(b.dataset.timer, 10) === timerDuration));
    timerPills.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-timer]');
      if (!btn) return;
      const dur = parseInt(btn.dataset.timer, 10);
      updateSettings({ timerDuration: dur });
      timerPills.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === btn));
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

    // Check for newer version + install status
    this.#checkForUpdate();
    this.#updateInstallStatus();
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
        const pill = document.createElement('span');
        pill.className = 'status-pill action';
        pill.textContent = `v${remote} — update`;
        pill.addEventListener('click', async () => {
          pill.textContent = 'Updating\u2026';
          pill.style.pointerEvents = 'none';
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          const regs = await navigator.serviceWorker?.getRegistrations() ?? [];
          await Promise.all(regs.map(r => r.unregister()));
          location.reload();
        }, { once: true });
        el.appendChild(pill);
      } else {
        el.innerHTML = '<span class="status-pill ok">up to date</span>';
      }
    } catch { /* offline — silently skip */ }
  }

  #updateInstallStatus() {
    const el = this.shadowRoot.querySelector('.install-check');
    el.innerHTML = '';

    if (isInstalledPWA()) {
      el.style.display = '';
      el.innerHTML = '<span class="status-pill ok">installed</span>';
      return;
    }

    const prompt = getInstallPrompt();
    if (prompt) {
      el.style.display = '';
      const pill = document.createElement('span');
      pill.className = 'status-pill action';
      pill.textContent = 'install app';
      pill.addEventListener('click', async () => {
        pill.textContent = 'Installing\u2026';
        pill.style.pointerEvents = 'none';
        try {
          await prompt.prompt();
          const result = await prompt.userChoice;
          if (result.outcome === 'accepted') {
            clearInstallPrompt();
            el.innerHTML = '<span class="status-pill ok">installed</span>';
          } else {
            pill.textContent = 'install app';
            pill.style.pointerEvents = '';
          }
        } catch {
          pill.textContent = 'install app';
          pill.style.pointerEvents = '';
        }
      }, { once: true });
      el.appendChild(pill);
    } else {
      el.style.display = 'none';
    }
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
    examples.innerHTML = '';
    for (const w of sample) {
      const span = document.createElement('span');
      span.textContent = wordText(w);
      examples.appendChild(span);
    }
  }

  /* ---- Public API for router ---- */
  openDeckById(id) {
    const deck = this.#decks?.find(d => d.id === id || d.name === id);
    if (deck) this.#openModal(deck);
  }

  openSettings() {
    this.#openSettingsUI();
  }

  openHelp() {
    this._htpShowPage?.();
    this.shadowRoot.querySelector('.htp-backdrop').classList.add('open');
    if (localStorage.getItem('sayitalready-htp-seen') !== '1') {
      localStorage.setItem('sayitalready-htp-seen', '1');
      this.#renderDecks(this.shadowRoot.querySelector('.filter-input').value);
    }
  }

  /** Open the editor for a deck by ID, or blank for new. */
  openEditor(deckId) {
    if (deckId) {
      const deck = this.#decks?.find(d => d.id === deckId);
      if (deck && deck.custom) this.#openEditDialog(deck);
      else this.#openImportDialog();
    } else {
      this.#openImportDialog();
    }
  }

  /** Open editor pre-populated with deck data (used by QR share links). */
  openEditorWithDeck(deckData) {
    this.#openImportDialog();
    this.#populateEditor(deckData);
    this.shadowRoot.querySelector('.json-textarea').value = JSON.stringify(deckData, null, 2);
  }

  /** Import a deck from a JSON string (used by deep-link import). */
  async importFromJSON(json) {
    return this.#importDeckJSON(json);
  }

  closeDialogs() {
    this.#closeModal();
    this.#editingDeck = null;
    this.shadowRoot.querySelector('.settings-backdrop')?.classList.remove('open');
    this.shadowRoot.querySelector('.import-backdrop')?.classList.remove('open');
    this.shadowRoot.querySelector('.htp-backdrop')?.classList.remove('open');
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
    const params = new URLSearchParams({
      deck: this.#selectedDeck.id,
      difficulty: String(this.#selectedDifficulty),
      tilt: tiltAvailable ? '1' : '0',
    });
    location.href = `game?${params}`;
  }
}

customElements.define('home-screen', HomeScreen);
