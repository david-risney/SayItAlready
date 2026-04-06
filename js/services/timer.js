/**
 * Simple countdown timer using requestAnimationFrame for smooth updates.
 * Fires 'tick', 'warning', and 'done' callbacks.
 */
export class Timer {
  #duration;
  #remaining;
  #startTime;
  #rafId = null;
  #running = false;
  #warningFired = false;
  #warningAt;
  #onTick;
  #onWarning;
  #onDone;

  /**
   * @param {object} opts
   * @param {number} opts.duration  – seconds
   * @param {number} opts.warningAt – seconds remaining to fire warning (default 5)
   * @param {function} opts.onTick  – called each frame with seconds remaining
   * @param {function} opts.onWarning – called once when warning threshold hit
   * @param {function} opts.onDone  – called when timer reaches 0
   */
  constructor({ duration = 60, warningAt = 5, onTick, onWarning, onDone }) {
    this.#duration = duration;
    this.#warningAt = warningAt;
    this.#onTick = onTick;
    this.#onWarning = onWarning;
    this.#onDone = onDone;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    // If remaining is unset (first start), use full duration; otherwise resume.
    if (this.#remaining == null) {
      this.#remaining = this.#duration;
      this.#warningFired = false;
    }
    // Anchor startTime so elapsed calculation resumes from current remaining.
    this.#startTime = performance.now() - (this.#duration - this.#remaining) * 1000;
    this.#loop();
  }

  stop() {
    this.#running = false;
    if (this.#rafId != null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  get remaining() {
    return Math.max(0, this.#remaining);
  }

  #loop = () => {
    if (!this.#running) return;
    const elapsed = (performance.now() - this.#startTime) / 1000;
    this.#remaining = Math.max(0, this.#duration - elapsed);

    this.#onTick?.(this.#remaining);

    if (!this.#warningFired && this.#remaining <= this.#warningAt) {
      this.#warningFired = true;
      this.#onWarning?.(this.#remaining);
    }

    if (this.#remaining <= 0) {
      this.#running = false;
      this.#onDone?.();
      return;
    }

    this.#rafId = requestAnimationFrame(this.#loop);
  };
}
