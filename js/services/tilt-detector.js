/**
 * Detects phone tilt gestures using the accelerometer (DeviceMotionEvent).
 * Uses accelerationIncludingGravity.z — the component perpendicular to the
 * screen surface. Works identically in portrait and landscape with no
 * gimbal lock issues.
 *
 * Phone on forehead (screen facing away): z ≈ 0
 * Tilt down (screen faces ground):        z < 0  → correct
 * Tilt up (screen faces sky):             z > 0  → skip
 */

/**
 * Request permission for DeviceMotionEvent (iOS 13+).
 * Must be called from a user gesture (click/tap handler).
 * Returns true if granted or if permission API doesn't exist (Android/desktop).
 */
export async function requestTiltPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceMotionEvent.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }
  // Fallback: try DeviceOrientationEvent permission (older iOS)
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }
  // No permission API needed (Android/desktop) — check if API exists
  return typeof DeviceMotionEvent !== 'undefined';
}

/**
 * Probe whether the device actually has an accelerometer.
 * Listens for a real DeviceMotionEvent with non-null z for up to `timeoutMs`.
 */
export function probeTiltAvailable(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (typeof DeviceMotionEvent === 'undefined') {
      resolve(false);
      return;
    }
    let resolved = false;
    const handler = (e) => {
      const a = e.accelerationIncludingGravity;
      if (a && a.z != null && !resolved) {
        resolved = true;
        window.removeEventListener('devicemotion', handler);
        resolve(true);
      }
    };
    window.addEventListener('devicemotion', handler);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('devicemotion', handler);
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
  #threshold;
  #handler;
  #state = 'fired'; // start as 'fired' so initial position doesn't trigger

  /**
   * @param {object} opts
   * @param {function} opts.onCorrect  – called on tilt-down (face ground)
   * @param {function} opts.onSkip     – called on tilt-up (face sky)
   * @param {function} [opts.onDebug]  – called every motion event with debug data
   * @param {number}   [opts.threshold=4] – z-accel in m/s² to trigger (~25° from vertical)
   */
  constructor({ onCorrect, onSkip, onDebug, threshold = 4 }) {
    this.#onCorrect = onCorrect;
    this.#onSkip = onSkip;
    this.#onDebug = onDebug;
    this.#threshold = threshold;
    this.#handler = (e) => this.#handleMotion(e);
  }

  start() {
    if (this.#active) return;
    this.#active = true;
    this.#state = 'fired';
    window.addEventListener('devicemotion', this.#handler);
  }

  stop() {
    this.#active = false;
    window.removeEventListener('devicemotion', this.#handler);
  }

  #handleMotion(e) {
    if (!this.#active) return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.z == null) return;

    const z = a.z;
    const inNeutral = Math.abs(z) <= this.#threshold;
    const tiltDown = z < -this.#threshold;  // screen faces ground → correct
    const tiltUp = z > this.#threshold;     // screen faces sky → skip

    if (this.#state === 'fired') {
      if (inNeutral) this.#state = 'neutral';
    } else {
      if (tiltDown) {
        this.#state = 'fired';
        this.#onCorrect?.();
      } else if (tiltUp) {
        this.#state = 'fired';
        this.#onSkip?.();
      }
    }

    this.#onDebug?.({
      x: a.x?.toFixed(1),
      y: a.y?.toFixed(1),
      z: a.z?.toFixed(1),
      thresh: this.#threshold,
      state: this.#state,
      tiltUp,
      tiltDown,
      inNeutral,
    });
  }
}
