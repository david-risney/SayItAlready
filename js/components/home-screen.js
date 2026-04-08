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
    animation-range: 0px 2880px;
  }
  @keyframes bg-shift {
    0%     { background: #1a1a2e; }
    12.5%  { background: #d4b8e8; }
    25%    { background: #f5e6a3; }
    37.5%  { background: #a8d8ea; }
    50%    { background: #f5c6cb; }
    62.5%  { background: #b5ead7; }
    75%    { background: #ffd3b6; }
    87.5%  { background: #c3b1e1; }
    100%   { background: #b8e0d2; }
  }

  /* --- Sticky shrinking header (CSS scroll-driven) --- */
  .header {
    position: sticky;
    top: 0;
    z-index: 5;
    width: 100%;
    /* Fixed height = expanded size. Document flow never changes. */
    height: 11rem;
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
    padding: 3rem 1rem 2rem;
    padding-top: max(3rem, env(titlebar-area-y, 0px));
    font-size: 1rem;
    display: flex;
    align-items: flex-start;
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    color: #fff;
  }
  .header-text {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .header-logo {
    width: 2.2em;
    height: 2.2em;
    flex-shrink: 0;
  }
  h1 .header-text span {
    color: var(--color-primary, #e94560);
  }


  @keyframes shrink-inner {
    from { font-size: 1rem; padding: 3rem 1rem 2rem; padding-top: max(3rem, env(titlebar-area-y, 0px));
           max-height: 11rem; }
    to   { font-size: 0.55rem; padding: 0.5rem 1rem 0;
           max-height: 7rem; }
  }


  /* --- Filter --- */
  .filter-wrap {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 1rem 1rem 0;
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
    position: relative;
  }
  .deck-fav {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.3;
    transition: opacity 150ms ease, transform 150ms ease;
    z-index: 2;
  }
  .deck-fav.active {
    opacity: 1;
  }
  .deck-fav:hover {
    transform: scale(1.2);
  }
  .deck-card:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    z-index: 1;
  }
  .deck-card:active {
    transform: scale(0.97);
  }
  @keyframes card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
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
  .control-row.control-kb {
    cursor: default;
  }
  .control-row.control-kb input[type="radio"] {
    cursor: default;
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
  .timer-pills {
    display: flex;
    gap: 0.4rem;
    justify-content: center;
  }
  .timer-pills button {
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
  .timer-pills button.selected {
    background: var(--color-primary, #e94560);
    border-color: var(--color-primary, #e94560);
    color: #fff;
  }
  .settings-divider {
    border: none;
    border-top: 1px solid rgba(255 255 255 / 0.1);
    margin: 0;
  }
  .settings-about {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .settings-about .about-header {
    display: flex;
    align-items: center;
    gap: 0.4em;
    text-decoration: none;
    color: inherit;
    font-size: 1.4rem;
    font-weight: 800;
    line-height: 1.1;
    flex-shrink: 0;
  }
  .settings-about .about-header:hover .about-text { text-decoration: underline; }
  .settings-about .about-text {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .settings-about .about-text .accent {
    color: var(--color-primary, #e94560);
  }
  .settings-about .about-logo {
    width: 2.2em;
    height: 2.2em;
    flex-shrink: 0;
  }
  .about-version {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--color-text-muted, #aaa);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .about-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
    flex-shrink: 0;
  }
  .status-pill {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    border-radius: 6px;
    padding: 0.2em 0.55em;
  }
  .status-pill.ok {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }
  .status-pill.action {
    background: var(--color-primary, #e94560);
    color: #fff;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .status-pill.action:hover {
    background: var(--color-primary-hover, #ff6b81);
  }

  /* --- Shared dialog close button --- */
  .dialog-close {
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
  .dialog-close:hover { background: rgba(255 255 255 / 0.2); color: var(--color-text, #eee); }

  /* --- How to Play card --- */
  .deck-card-htp {
    aspect-ratio: 5 / 7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    background: linear-gradient(135deg, #0a1628, #1a2744);
    border: 2px solid rgba(255 255 255 / 0.15);
    border-radius: var(--radius, 12px);
    padding: 0.75rem 0.5rem;
    cursor: pointer;
    transition: transform 200ms ease, border-color 200ms ease;
    text-align: center;
    color: #fff;
  }
  .deck-card-htp:hover {
    transform: scale(1.06);
    border-color: rgba(255 255 255 / 0.35);
  }
  .deck-card-htp:active { transform: scale(0.97); }
  .deck-card-htp .htp-icon { font-size: 2.4rem; line-height: 1; }
  .deck-card-htp .htp-label { font-weight: 700; font-size: 0.8rem; }

  /* --- How to Play dialog --- */
  .htp-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .htp-backdrop.open { display: flex; }
  .htp-dialog {
    background: var(--color-surface, #16213e);
    border-radius: var(--radius, 12px);
    max-width: 340px;
    width: 100%;
    padding: 1.5rem;
    position: relative;
    animation: modal-in 250ms ease;
    border: 1px solid rgba(255 255 255 / 0.12);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    max-height: 85vh;
    overflow-y: auto;
  }
  .htp-dialog h2 {
    margin: 0 0 1rem;
    font-size: 1.3rem;
    font-weight: 800;
    text-align: center;
  }
  .htp-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    counter-reset: step;
  }
  .htp-step {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .htp-step-num {
    counter-increment: step;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--color-primary, #e94560);
    color: #fff;
    font-weight: 800;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .htp-step-num::before { content: counter(step); }
  .htp-step-body h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 2rem;
  }
  .htp-step-body p {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    color: rgba(255 255 255 / 0.7);
    line-height: 1.4;
  }
  .htp-got-it {
    display: block;
    margin: 1.25rem auto 0;
    background: var(--color-primary, #e94560);
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    border: none;
    border-radius: var(--radius, 12px);
    padding: 0.6em 2em;
    cursor: pointer;
    transition: background 200ms ease;
  }
  .htp-got-it:hover { background: var(--color-primary-hover, #ff6b81); }

  .htp-page { display: none; }
  .htp-page.active { display: block; }
  .htp-page h2 {
    margin: 0 0 0.5rem;
    font-size: 1.3rem;
    font-weight: 800;
    text-align: center;
  }
  .htp-page .htp-intro {
    text-align: center;
    font-size: 0.85rem;
    color: rgba(255 255 255 / 0.7);
    margin: 0 0 1rem;
  }
  .htp-page .htp-section-intro {
    font-size: 0.85rem;
    color: rgba(255 255 255 / 0.7);
    margin: 0 0 1rem;
    line-height: 1.4;
  }
  .htp-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.25rem;
    gap: 0.5rem;
  }
  .htp-nav-btn {
    background: rgba(255 255 255 / 0.1);
    border: none;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    border-radius: var(--radius, 12px);
    padding: 0.5em 1.2em;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .htp-nav-btn:hover { background: rgba(255 255 255 / 0.2); }
  .htp-nav-btn.hidden { visibility: hidden; }
  .htp-dots {
    display: flex;
    gap: 0.4rem;
  }
  .htp-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: rgba(255 255 255 / 0.25);
    transition: background 150ms ease;
  }
  .htp-dot.active { background: var(--color-primary, #e94560); }

  /* --- Import (add) card --- */
  .deck-card-add {
    aspect-ratio: 5 / 7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    background: transparent;
    border: 2px dashed rgba(255 255 255 / 0.2);
    border-radius: var(--radius, 12px);
    padding: 0.75rem 0.5rem;
    cursor: pointer;
    transition: transform 200ms ease, background 200ms ease, border-color 200ms ease;
    text-align: center;
    color: var(--color-text-muted, #aaa);
  }
  .deck-card-add:hover {
    transform: scale(1.06);
    background: rgba(255 255 255 / 0.06);
    border-color: rgba(255 255 255 / 0.35);
    color: #fff;
  }
  .deck-card-add:active {
    transform: scale(0.97);
  }
  .deck-card-add .add-icon {
    font-size: 2.4rem;
    line-height: 1;
  }
  .deck-card-add .add-label {
    font-weight: 700;
    font-size: 0.8rem;
  }

  /* Import dialog */
  .import-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .import-backdrop.open { display: flex; }
  .import-dialog {
    background: var(--color-surface, #16213e);
    border-radius: var(--radius, 12px);
    padding: 1.5rem;
    position: relative;
    max-width: 420px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: modal-in 250ms ease;
    border: 1px solid rgba(255 255 255 / 0.12);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }
  .import-dialog h2 {
    font-size: 1.2rem;
    font-weight: 800;
    margin: 0;
    text-align: center;
  }
  /* Mode tabs */
  .edit-tabs {
    display: flex;
    gap: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255 255 255 / 0.15);
  }
  .edit-tabs button {
    flex: 1;
    padding: 0.45em 0;
    font-size: 0.8rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    background: transparent;
    color: var(--color-text-muted, #aaa);
    transition: background 150ms ease, color 150ms ease;
  }
  .edit-tabs button.active {
    background: var(--color-primary, #e94560);
    color: #fff;
  }
  /* Editor pane */
  .edit-pane { display: none; flex-direction: column; gap: 0.6rem; }
  .edit-pane.visible { display: flex; }
  .edit-field { display: flex; flex-direction: column; gap: 0.2rem; }
  .edit-field label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted, #aaa);
  }
  .edit-field input,
  .edit-field textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.45rem 0.6rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    border-radius: 6px;
    background: rgba(0 0 0 / 0.25);
    color: var(--color-text, #eee);
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    transition: border-color 200ms ease;
  }
  .edit-field input:focus,
  .edit-field textarea:focus { border-color: var(--color-primary, #e94560); }
  .edit-field input::placeholder,
  .edit-field textarea::placeholder { color: rgba(255 255 255 / 0.3); }
  .edit-field-row {
    display: flex;
    gap: 0.5rem;
  }
  .edit-field-row .edit-field { flex: 1; min-width: 0; }
  .edit-color-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .edit-color-row input[type="color"] {
    width: 2.5rem;
    height: 2.2rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    border-radius: 6px;
    background: rgba(0 0 0 / 0.25);
    cursor: pointer;
    padding: 2px;
  }
  .edit-color-preview {
    flex: 1;
    height: 2.2rem;
    border-radius: 6px;
    border: 1px solid rgba(255 255 255 / 0.12);
  }
  .edit-words-header {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted, #aaa);
  }
  .add-word-btn {
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(255 255 255 / 0.1);
    border: 1px dashed rgba(255 255 255 / 0.2);
    border-radius: 6px;
    color: var(--color-text-muted, #aaa);
    padding: 0.35em 0;
    width: 100%;
    cursor: pointer;
    transition: background 150ms ease;
    margin-top: 0.15rem;
  }
  .add-word-btn:hover { background: rgba(255 255 255 / 0.18); color: #fff; }
  .edit-words-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-height: 200px;
    overflow-y: auto;
  }
  .edit-word-row {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .edit-word-row input {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: 1px solid rgba(255 255 255 / 0.12);
    border-radius: 5px;
    background: rgba(0 0 0 / 0.2);
    color: var(--color-text, #eee);
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
  }
  .edit-word-row input:focus { border-color: var(--color-primary, #e94560); }
  .edit-word-row select {
    padding: 0.3rem;
    border: 1px solid rgba(255 255 255 / 0.12);
    border-radius: 5px;
    background: rgba(0 0 0 / 0.3);
    color: var(--color-text, #eee);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .edit-word-row .remove-word {
    background: none;
    border: none;
    color: rgba(255 255 255 / 0.3);
    font-size: 1rem;
    cursor: pointer;
    padding: 0 0.2em;
    line-height: 1;
    transition: color 150ms ease;
  }
  .edit-word-row .remove-word:hover { color: #f44; }
  /* JSON pane */
  .json-pane { display: none; flex-direction: column; gap: 0.5rem; }
  .json-pane.visible { display: flex; }
  /* QR pane */
  .qr-pane { display: none; flex-direction: column; gap: 0.6rem; align-items: center; padding: 0.5rem 0; }
  .qr-pane.visible { display: flex; }
  .qr-output { width: 100%; max-width: 220px; }
  .qr-output svg { width: 100%; height: auto; border-radius: 8px; }
  .qr-url-row { display: flex; gap: 0.3rem; width: 100%; }
  .qr-url {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    border-radius: 6px;
    background: rgba(0 0 0 / 0.25);
    color: var(--color-text, #eee);
    font-size: 0.75rem;
    outline: none;
    min-width: 0;
  }
  .qr-copy {
    padding: 0.35rem 0.5rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    border-radius: 6px;
    background: rgba(0 0 0 / 0.25);
    color: var(--color-text, #eee);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 150ms ease;
    flex-shrink: 0;
  }
  .qr-copy:hover { background: rgba(255 255 255 / 0.15); }
  .qr-error { color: #f44; font-size: 0.8rem; text-align: center; }
  .import-dialog textarea.json-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 180px;
    padding: 0.6rem;
    border: 1px solid rgba(255 255 255 / 0.15);
    border-radius: 8px;
    background: rgba(0 0 0 / 0.25);
    color: var(--color-text, #eee);
    font-size: 0.8rem;
    font-family: monospace;
    resize: vertical;
  }
  .import-dialog textarea.json-textarea::placeholder { color: var(--color-text-muted, #aaa); }
  .import-error {
    color: #f44;
    font-size: 0.8rem;
    min-height: 1.2em;
  }
  .import-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  .import-actions button {
    font-size: 0.85rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    padding: 0.5em 1.2em;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .import-cancel {
    background: rgba(255 255 255 / 0.1);
    color: var(--color-text-muted, #aaa);
  }
  .import-cancel:hover { background: rgba(255 255 255 / 0.2); }
  .import-delete {
    background: rgba(255 50 50 / 0.15);
    color: #f66;
    display: none;
  }
  .import-delete.visible { display: inline-block; }
  .import-delete:hover { background: rgba(255 50 50 / 0.3); }
  .import-submit {
    background: var(--color-primary, #e94560);
    color: #fff;
    margin-left: auto;
  }
  .import-submit:hover { background: var(--color-primary-hover, #ff6b81); }
  /* Edit overlay on deck card */
  .deck-edit {
    position: absolute;
    bottom: 0.35rem;
    right: 0.35rem;
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 150ms ease, transform 150ms ease;
    z-index: 2;
    background: rgba(0 0 0 / 0.3);
    border: none;
    color: #fff;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .deck-edit:hover { opacity: 1; transform: scale(1.15); }
</style>

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
