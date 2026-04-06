const CACHE_NAME = 'sayitalready-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/components/home-screen.js',
  './js/components/game-screen.js',
  './js/components/round-summary.js',
  './js/components/deck-picker.js',
  './js/models/deck.js',
  './js/services/tilt-detector.js',
  './js/services/audio-manager.js',
  './js/services/timer.js',
  './js/services/deck-store.js',
  './packs/animals.json',
  './packs/movies.json',
  './packs/food.json',
  './packs/back-to-the-future.json',
  './packs/parks-and-rec.json',
  './packs/community.json',
  './packs/science.json',
  './packs/90s-nostalgia.json',
  './packs/simpsons.json',
  './packs/among-us.json',
  './packs/dog-with-a-blog.json',
  './packs/disney-parks.json',
  './packs/fast-food.json',
  './icons/icon.svg',
  './icons/screenshots/home-screen.png',
  './icons/screenshots/deck-modal.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
