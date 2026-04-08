const CACHE_NAME = 'sayitalready-v1.17.0';

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
  './js/services/settings.js',
  './js/services/install.js',
  './js/services/compress.js',
  './js/vendor/qrcode.js',
  './js/version.js',
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
  './packs/brooklyn-99.json',
  './packs/portal.json',
  './packs/video-game-characters.json',
  './packs/mario.json',
  './packs/brands-and-logos.json',
  './packs/tv-shows.json',
  './packs/amphibia.json',
  './packs/lilo-and-stitch.json',
  './packs/roblox.json',
  './packs/80s.json',
  './icons/icon.svg',
  './icons/icon-nobg.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/og-image.png',
  './favicon.ico',
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
  // Skip cache for requests with cache=off (used for version checks)
  const url = new URL(event.request.url);
  if (url.searchParams.get('cache') === 'off') {
    return; // fall through to default browser fetch
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
