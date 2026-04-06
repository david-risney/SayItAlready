const DB_NAME = 'SayItAlreadyDB';
const DB_VERSION = 1;
const STORE_NAME = 'decks';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const result = fn(store);
        transaction.oncomplete = () => resolve(result.result ?? result);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

/** Get all custom decks. */
export function getAllDecks() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE_NAME, 'readonly');
        const req = t.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** Save (put) a deck. */
export function saveDeck(deck) {
  return tx('readwrite', (store) => store.put(deck));
}

/** Delete a deck by id. */
export function deleteDeck(id) {
  return tx('readwrite', (store) => store.delete(id));
}

/** Fetch a built-in pack JSON file. */
export async function fetchBuiltInPack(name) {
  const res = await fetch(`./packs/${name}.json`);
  if (!res.ok) throw new Error(`Pack not found: ${name}`);
  return res.json();
}

/** Load all available decks — built-in + custom. */
export async function loadAllDecks() {
  const builtInNames = ['animals', 'movies', 'food', 'back-to-the-future', 'parks-and-rec', 'community', 'science', '90s-nostalgia', 'simpsons', 'among-us', 'dog-with-a-blog', 'disney-parks', 'fast-food'];
  const [builtIn, custom] = await Promise.all([
    Promise.all(builtInNames.map((n) => fetchBuiltInPack(n).catch(() => null))).then((r) =>
      r.filter(Boolean)
    ),
    getAllDecks(),
  ]);
  return [...builtIn, ...custom];
}

const HISTORY_KEY = 'sayitalready-play-history';

/** Get play history as { deckId: timestamp } map. */
export function getPlayHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
  } catch { return {}; }
}

/** Record that a deck was just played. */
export function recordPlay(deckId) {
  const history = getPlayHistory();
  history[deckId] = Date.now();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/** Sort decks: recently played first (most recent first), then unplayed alphabetically. */
export function sortDecksByRecency(decks) {
  const history = getPlayHistory();
  return [...decks].sort((a, b) => {
    const aTime = history[a.id] || 0;
    const bTime = history[b.id] || 0;
    if (aTime && bTime) return bTime - aTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });
}
