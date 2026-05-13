const template = document.createElement('template');
template.innerHTML = `
<link rel="stylesheet" href="./css/round-summary.css">
<div class="summary">
  <div class="confetti-container"></div>
  <h2>Round Over!</h2>
  <div class="score-row">
    <div class="score-block">
      <div class="score">0</div>
      <div class="score-label">correct</div>
    </div>
    <div class="diff-summary"></div>
  </div>
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

    // Difficulty summary
    const diffLabels = ['Easy', 'Normal', 'Hard'];
    const diffCounts = [0, 0, 0];
    for (const r of this.#results) {
      if (r.result === 'correct' && r.difficulty != null) diffCounts[r.difficulty]++;
    }
    const diffSummary = this.shadowRoot.querySelector('.diff-summary');
    diffSummary.innerHTML = diffCounts
      .map((c, i) => c > 0 ? `<span><span class="diff-badge diff-${i}">${diffLabels[i]}</span>${c}</span>` : '')
      .join('');

    const list = this.shadowRoot.querySelector('.results-list');
    list.innerHTML = '';
    for (const { word, result, difficulty } of this.#results) {
      const li = document.createElement('li');
      const isCorrect = result === 'correct';
      const diffHtml = difficulty != null
        ? `<span class="diff-badge diff-${difficulty}">${diffLabels[difficulty] ?? ''}</span>`
        : '';
      li.innerHTML = `
        <span>${word}${diffHtml}</span>
        <span class="icon ${isCorrect ? 'correct-icon' : 'skipped-icon'}">${isCorrect ? '✅' : '⏭️'}</span>
      `;
      list.appendChild(li);
    }

    // Confetti burst for good scores
    if (correctCount >= 5) this.#spawnConfetti(correctCount);
  }

  #spawnConfetti(count) {
    const container = this.shadowRoot.querySelector('.confetti-container');
    const colors = ['#e94560', '#2ecc71', '#f39c12', '#3498db', '#9b59b6', '#1abc9c', '#ff6b81'];
    const pieces = Math.min(count * 6, 60);
    for (let i = 0; i < pieces; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = `${Math.random() * 100}%`;
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
      el.style.animationDelay = `${Math.random() * 0.6}s`;
      el.style.width = `${6 + Math.random() * 6}px`;
      el.style.height = `${6 + Math.random() * 6}px`;
      container.appendChild(el);
    }
    // Clean up after animation
    setTimeout(() => { container.innerHTML = ''; }, 4000);
  }
}

customElements.define('round-summary', RoundSummary);
