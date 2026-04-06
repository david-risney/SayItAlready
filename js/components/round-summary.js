const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    width: 100%;
    padding: 1.5rem;
    padding-top: max(1.5rem, env(titlebar-area-height, 0px));
    gap: 1rem;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }
  h2 {
    font-size: 1.8rem;
    font-weight: 800;
  }
  .score {
    font-size: 3rem;
    font-weight: 900;
    color: var(--color-primary, #e94560);
  }
  .score-label {
    color: var(--color-text-muted, #aaa);
    font-size: 0.9rem;
    margin-top: -0.5rem;
  }
  .results-list {
    list-style: none;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .results-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-surface, #16213e);
    padding: 0.6rem 0.9rem;
    border-radius: 8px;
    font-size: 0.95rem;
    min-width: 0;
    word-break: break-word;
  }
  .results-list .icon { font-size: 1.2rem; }
  .correct-icon { color: var(--color-success, #2ecc71); }
  .skipped-icon { color: var(--color-skip, #f39c12); }
  .actions {
    display: flex;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
  }
  .actions button {
    font-size: 1.05rem;
    font-weight: 700;
    border: none;
    border-radius: var(--radius, 12px);
    padding: 0.7em 1.5em;
    cursor: pointer;
    color: #fff;
  }
  .btn-home { background: var(--color-surface, #16213e); }
  .btn-replay { background: var(--color-primary, #e94560); }
  .btn-replay:hover { background: var(--color-primary-hover, #ff6b81); }
</style>

<div class="summary">
  <h2>Round Over!</h2>
  <div class="score">0</div>
  <div class="score-label">correct</div>
  <div class="actions">
    <button class="btn-home">🏠 Home</button>
    <button class="btn-replay">🔄 Play Again</button>
  </div>
  <ul class="results-list"></ul>
</div>
`;

export class RoundSummary extends HTMLElement {
  #results = [];
  #deck = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  set data({ deck, results }) {
    this.#deck = deck;
    this.#results = results;
  }

  connectedCallback() {
    this.#render();
    this.shadowRoot.querySelector('.btn-home').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('go-home', { bubbles: true, composed: true }));
    });
    this.shadowRoot.querySelector('.btn-replay').addEventListener('click', () => {
      this.dispatchEvent(
        new CustomEvent('start-game', {
          bubbles: true,
          composed: true,
          detail: { deck: this.#deck },
        })
      );
    });
  }

  #render() {
    const correctCount = this.#results.filter((r) => r.result === 'correct').length;
    this.shadowRoot.querySelector('.score').textContent = correctCount;

    const list = this.shadowRoot.querySelector('.results-list');
    list.innerHTML = '';
    for (const { word, result } of this.#results) {
      const li = document.createElement('li');
      const isCorrect = result === 'correct';
      li.innerHTML = `
        <span>${word}</span>
        <span class="icon ${isCorrect ? 'correct-icon' : 'skipped-icon'}">${isCorrect ? '✅' : '⏭️'}</span>
      `;
      list.appendChild(li);
    }
  }
}

customElements.define('round-summary', RoundSummary);
