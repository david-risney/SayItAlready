/**
 * Manages sound effects and haptic feedback using the Web Audio API.
 * Generates tones programmatically — no audio files needed.
 */
export class AudioManager {
  #ctx = null;

  #ensureContext() {
    if (!this.#ctx) {
      this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.#ctx.state === 'suspended') {
      this.#ctx.resume();
    }
    return this.#ctx;
  }

  /** Play a short tone. */
  #playTone(frequency, duration = 0.15, type = 'sine', gain = 0.3) {
    const ctx = this.#ensureContext();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    vol.gain.value = gain;
    // Quick fade out to avoid clicks
    vol.gain.setTargetAtTime(0, ctx.currentTime + duration * 0.8, 0.02);
    osc.connect(vol).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  #vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  /** Correct guess: happy rising tone + short buzz. */
  correct() {
    this.#playTone(523, 0.1, 'sine');  // C5
    setTimeout(() => this.#playTone(659, 0.1, 'sine'), 100); // E5
    setTimeout(() => this.#playTone(784, 0.15, 'sine'), 200); // G5
    this.#vibrate(100);
  }

  /** Skip: descending tone + double buzz. */
  skip() {
    this.#playTone(400, 0.12, 'triangle');
    setTimeout(() => this.#playTone(300, 0.15, 'triangle'), 120);
    this.#vibrate([50, 50, 50]);
  }

  /** Warning: urgent beeps. */
  warning() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.#playTone(880, 0.08, 'square', 0.2), i * 180);
    }
    this.#vibrate([100, 80, 100, 80, 100]);
  }

  /** Time's up: long low buzz. */
  timesUp() {
    this.#playTone(220, 0.5, 'sawtooth', 0.25);
    this.#vibrate(500);
  }

  /** Call once on a user gesture to unlock audio context. */
  unlock() {
    this.#ensureContext();
  }
}
