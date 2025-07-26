const CACHE_NAME = 'nepali-radio-cache-v2';
const OFFLINE_URL = '/nepali-radio-player/offline.html';

const urlsToCache = [
  '/nepali-radio-player/',
  '/nepali-radio-player/index.html',
  '/nepali-radio-player/style.css',
  '/nepali-radio-player/script.js',
  '/nepali-radio-player/radios.json',
  '/nepali-radio-player/logo/default.jpg',
  '/nepali-radio-player/icons/android-chrome-192x192.png',
  '/nepali-radio-player/icons/android-chrome-512x512.png',
  OFFLINE_URL
];

// Install event - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event - Cache-first strategy except for audio streams & proxy URLs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.destination === 'audio' ||
    url.href.includes('radio-stream') ||
    url.href.includes('.mp3') ||
    url.href.includes('.m3u') ||
    url.href.includes('stream')
  ) {
    // Bypass SW for streaming audio URLs
    return;
  }

  // For navigation requests, fallback to offline page if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // For other requests, use a network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If the request is successful, cache the new response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request).then(cachedResponse => {
          // If no cached response and it's a navigation request, serve offline page
          if (!cachedResponse && event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return cachedResponse;
        });
      })
  );
});

// Background Sync for updating radios.json
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-radio-data') {
    event.waitUntil(
      fetch('/nepali-radio-player/radios.json')
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch radios.json');
          return response.json();
        })
        .then(data =>
          caches.open(CACHE_NAME).then(cache =>
            cache.put('/nepali-radio-player/radios.json', new Response(JSON.stringify(data)))
          )
        )
        .catch(err => console.log('Background sync failed:', err))
    );
  }
});
