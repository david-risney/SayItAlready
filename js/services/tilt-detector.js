/**
 * Wraps DeviceOrientationEvent to detect phone tilt gestures.
 * - Tilt down (toward ground) → 'correct'
 * - Tilt up (away from player) → 'skip'
 *
 * Expects the phone to be held in portrait, screen facing away from the player
 * (like holding it on your forehead).
 *
 * Beta axis: ~0° when flat, ~90° when upright/forehead position.
 * We detect deviations from the "forehead neutral" (~70-110°).
 * - beta < threshold-low  → tilted down → correct
 * - beta > threshold-high → tilted up   → skip
 */
/**
 * Request permission for DeviceOrientationEvent (iOS 13+).
 * Must be called from a user gesture (click/tap handler).
 * Returns true if granted or if permission API doesn't exist (Android/desktop).
 */
export async function requestTiltPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return false;

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Probe whether the device actually has a gyroscope / orientation sensor.
 * Listens for a real DeviceOrientationEvent with non-null beta for up to `timeoutMs`.
 * Returns a Promise<boolean>.
 */
export function probeTiltAvailable(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      resolve(false);
      return;
    }
    let resolved = false;
    const handler = (e) => {
      if (e.beta != null && !resolved) {
        resolved = true;
        window.removeEventListener('deviceorientation', handler);
        resolve(true);
      }
    };
    window.addEventListener('deviceorientation', handler);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('deviceorientation', handler);
        resolve(false);
      }
    }, timeoutMs);
  });
}

export class TiltDetector {
  #onCorrect;
  #onSkip;
  #active = false;
  #thresholdLow;
  #thresholdHigh;
  #handler;
  // State: 'neutral' = in normal range, 'fired' = gesture detected, waiting for return to neutral
  #state = 'fired'; // start as 'fired' so initial tilted position doesn't trigger

  /**
   * @param {object} opts
   * @param {function} opts.onCorrect
   * @param {function} opts.onSkip
   * @param {number}   opts.thresholdLow  – beta below this = correct (default 30)
   * @param {number}   opts.thresholdHigh – beta above this = skip (default 150)
   */
  constructor({ onCorrect, onSkip, thresholdLow = 30, thresholdHigh = 150 }) {
    this.#onCorrect = onCorrect;
    this.#onSkip = onSkip;
    this.#thresholdLow = thresholdLow;
    this.#thresholdHigh = thresholdHigh;
    this.#handler = (e) => this.#handleOrientation(e);
  }

  /** Start listening. Permission should already be granted via requestTiltPermission(). */
  start() {
    if (this.#active) return;
    this.#active = true;
    this.#state = 'fired'; // require neutral first after (re)start
    window.addEventListener('deviceorientation', this.#handler);
  }

  stop() {
    this.#active = false;
    window.removeEventListener('deviceorientation', this.#handler);
  }

  #handleOrientation(e) {
    if (!this.#active) return;
    const beta = e.beta; // -180 to 180
    if (beta == null) return;

    const inNeutral = beta >= this.#thresholdLow && beta <= this.#thresholdHigh;

    if (this.#state === 'fired') {
      // Wait until user returns to neutral position
      if (inNeutral) this.#state = 'neutral';
    } else {
      // state === 'neutral' — check for tilt gesture
      if (beta > this.#thresholdHigh) {
        this.#state = 'fired';
        this.#onCorrect?.();
      } else if (beta < this.#thresholdLow) {
        this.#state = 'fired';
        this.#onSkip?.();
      }
    }
  }
}
