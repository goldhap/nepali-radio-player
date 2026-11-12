const CACHE_NAME = 'nepali-radio-cache-v14';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/radios.json',
  '/logo/default.jpg',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  OFFLINE_URL
];

// Install event - cache files.
// Each URL is cached independently: cache.addAll() is all-or-nothing,
// so a single missing file (this once shipped with /offline.html in
// the list before the file existed) silently killed the WHOLE install
// — no offline shell, no caching, every visit a cold network load.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        urlsToCache.map(url => cache.add(url))
      ))
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
      fetch('/radios.json')
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch radios.json');
          return response.json();
        })
        .then(data =>
          caches.open(CACHE_NAME).then(cache =>
            cache.put('/radios.json', new Response(JSON.stringify(data)))
          )
        )
        .catch(err => console.log('Background sync failed:', err))
    );
  }
});
