/**
 * Wraps DeviceOrientationEvent to detect phone tilt gestures.
 * - Tilt down (toward ground) → 'correct'
 * - Tilt up (away from player) → 'skip'
 *
 * Expects the phone held screen-facing-away (forehead position).
 *
 * In portrait: uses beta axis (~0° flat, ~90° upright).
 * In landscape: uses gamma axis (±90° range), since the physical
 * axes rotate with screen orientation.
 *
 * We detect deviations from "forehead neutral":
 * Portrait:  beta < thresholdLow → tilt down → correct;  beta > thresholdHigh → tilt up → skip
 * Landscape: |gamma| past threshold → tilt; sign depends on landscape-primary vs secondary.
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
  #onDebug;
  #active = false;
  #thresholdLow;
  #thresholdHigh;
  #gammaThreshold;
  #handler;
  // State: 'neutral' = in normal range, 'fired' = gesture detected, waiting for return to neutral
  #state = 'fired'; // start as 'fired' so initial tilted position doesn't trigger

  /**
   * @param {object} opts
   * @param {function} opts.onCorrect
   * @param {function} opts.onSkip
   * @param {number}   opts.thresholdLow  – beta below this = correct in portrait (default 30)
   * @param {number}   opts.thresholdHigh – beta above this = skip in portrait (default 150)
   * @param {number}   opts.gammaThreshold – |gamma| above this triggers in landscape (default 30)
   */
  constructor({ onCorrect, onSkip, onDebug, thresholdLow = 30, thresholdHigh = 150, gammaThreshold = 30 }) {
    this.#onCorrect = onCorrect;
    this.#onSkip = onSkip;
    this.#onDebug = onDebug;
    this.#thresholdLow = thresholdLow;
    this.#thresholdHigh = thresholdHigh;
    this.#gammaThreshold = gammaThreshold;
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

  #isLandscape() {
    const angle = screen.orientation?.angle ?? 0;
    return angle === 90 || angle === 270;
  }

  #handleOrientation(e) {
    if (!this.#active) return;
    if (e.beta == null) return;

    let tiltDown = false; // toward ground → correct
    let tiltUp = false;   // away from player → skip
    let inNeutral = false;

    if (this.#isLandscape()) {
      // In landscape the physical tilt axis maps to gamma (-90 to 90).
      // orientation.angle 90 = rotated clockwise (left edge up):
      //   tilt phone down → gamma goes negative
      //   tilt phone up   → gamma goes positive
      // orientation.angle 270 = rotated counter-clockwise (right edge up):
      //   signs are inverted
      const gamma = e.gamma;
      if (gamma == null) return;
      const angle = screen.orientation?.angle ?? 90;
      const sign = angle >= 180 ? -1 : 1;
      const g = gamma * sign;

      inNeutral = Math.abs(g) <= this.#gammaThreshold;
      tiltDown = g < -this.#gammaThreshold;
      tiltUp = g > this.#gammaThreshold;
    } else {
      // Portrait: use beta as before
      const beta = e.beta; // -180 to 180
      inNeutral = beta >= this.#thresholdLow && beta <= this.#thresholdHigh;
      tiltDown = beta < this.#thresholdLow;
      tiltUp = beta > this.#thresholdHigh;
    }

    if (this.#state === 'fired') {
      if (inNeutral) this.#state = 'neutral';
    } else {
      if (tiltUp) {
        this.#state = 'fired';
        this.#onCorrect?.();
      } else if (tiltDown) {
        this.#state = 'fired';
        this.#onSkip?.();
      }
    }

    this.#onDebug?.({
      alpha: e.alpha?.toFixed(1),
      beta: e.beta?.toFixed(1),
      gamma: e.gamma?.toFixed(1),
      angle: screen.orientation?.angle ?? '?',
      landscape: this.#isLandscape(),
      state: this.#state,
      tiltUp,
      tiltDown,
      inNeutral,
    });
  }
}
