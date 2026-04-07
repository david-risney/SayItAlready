/**
 * Detects phone tilt gestures using DeviceOrientationEvent.
 *
 * Portrait: uses beta (range -180..180). Neutral ~90° on forehead.
 * Landscape: uses gamma, but gamma wraps at ±90° (exactly where the
 * forehead position sits). We unwrap gamma using beta as the flip
 * indicator: when |beta| > 90, gamma has crossed the ±90 singularity.
 * The unwrapped value is then normalized so ~90 = neutral in both
 * landscape orientations (angle 90 or 270).
 */

/**
 * Request permission for DeviceOrientationEvent (iOS 13+).
 * Must be called from a user gesture (click/tap handler).
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
 * Listens for a DeviceOrientationEvent with non-null beta for up to `timeoutMs`.
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
  #handler;
  #state = 'fired'; // start as 'fired' so initial position doesn't trigger
  #landscape = null; // locked on first orientation reading

  // Portrait thresholds (beta): neutral is 30..150
  #portraitLow = 30;
  #portraitHigh = 150;
  // Landscape thresholds (normalized unwrapped gamma): neutral is 60..120
  #landscapeLow = 60;
  #landscapeHigh = 120;

  /**
   * @param {object} opts
   * @param {function} opts.onCorrect  – nod forward (face ground)
   * @param {function} opts.onSkip     – nod backward (face sky)
   * @param {function} [opts.onDebug]  – called every event with debug data
   */
  constructor({ onCorrect, onSkip, onDebug }) {
    this.#onCorrect = onCorrect;
    this.#onSkip = onSkip;
    this.#onDebug = onDebug;
    this.#handler = (e) => this.#handleOrientation(e);
  }

  start() {
    if (this.#active) return;
    this.#active = true;
    this.#state = 'fired';
    this.#landscape = null;
    window.addEventListener('deviceorientation', this.#handler);
  }

  stop() {
    this.#active = false;
    window.removeEventListener('deviceorientation', this.#handler);
  }

  #handleOrientation(e) {
    if (!this.#active) return;
    if (e.beta == null || e.gamma == null) return;

    // Always use landscape detection — game screen forces landscape orientation
    if (this.#landscape === null) {
      this.#landscape = true;
    }

    let tiltUp = false;   // nod backward → onSkip
    let tiltDown = false;  // nod forward → onCorrect
    let inNeutral = false;
    let debugExtra = '';

    if (this.#landscape) {
      // Unwrap gamma: when |beta| > 90, gamma has crossed the ±90 singularity
      let g = e.gamma;
      if (Math.abs(e.beta) > 90) {
        g = g >= 0 ? -(180 - g) : (180 + g);
      }

      // |unwrapped gamma| ≈ 90 at neutral regardless of landscape direction
      const n = Math.abs(g);

      inNeutral = n >= this.#landscapeLow && n <= this.#landscapeHigh;
      // Nod backward: gamma toward 0 → n decreases below landscapeLow
      tiltUp = n < this.#landscapeLow;
      // Nod forward: gamma past ±90 → n increases above landscapeHigh
      tiltDown = n > this.#landscapeHigh;

      debugExtra = `g_raw:${e.gamma.toFixed(1)} g_unwrap:${g.toFixed(1)} n:${n.toFixed(1)} lck:gyro`;
    } else {
      // Portrait: beta ~90 on forehead
      const beta = e.beta;
      inNeutral = beta >= this.#portraitLow && beta <= this.#portraitHigh;
      tiltUp = beta > this.#portraitHigh;
      tiltDown = beta < this.#portraitLow;

      debugExtra = `beta:${e.beta.toFixed(1)}`;
    }

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
      beta: e.beta?.toFixed(1),
      gamma: e.gamma?.toFixed(1),
      angle: screen.orientation?.angle ?? '?',
      landscape: this.#landscape,
      state: this.#state,
      tiltUp,
      tiltDown,
      inNeutral,
      extra: debugExtra,
    });
  }
}
