const SETTINGS_KEY = 'sayitalready-settings';

const DEFAULTS = {
  soundEnabled: true,
  vibrationEnabled: true,
  controlMode: 'gyro', // 'gyro' | 'touch'
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function updateSettings(partial) {
  const s = getSettings();
  Object.assign(s, partial);
  cache = s;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function resetAllState() {
  localStorage.clear();
  cache = null;
  const req = indexedDB.deleteDatabase('SayItAlreadyDB');
  req.onsuccess = () => location.reload();
  req.onerror = () => location.reload();
  req.onblocked = () => location.reload();
}
