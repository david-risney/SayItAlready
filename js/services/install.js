/** @type {BeforeInstallPromptEvent|null} */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

export function getInstallPrompt() { return deferredPrompt; }

export function clearInstallPrompt() { deferredPrompt = null; }

export function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || navigator.standalone === true;
}
