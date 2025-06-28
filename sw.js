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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip audio streams, proxy URLs, and external resources
  if (
    event.request.destination === 'audio' ||
    url.href.includes('radio-stream') ||
    url.href.includes('.mp3') ||
    url.href.includes('.m3u') ||
    url.href.includes('stream') // generic stream keyword
  ) {
    return; // Let browser handle these requests natively
  }

  // ✅ Otherwise: Cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-radio-data') {
    event.waitUntil(
      fetch('radios.json')
        .then(response => response.json())
        .then(data => {
          caches.open(CACHE_NAME)
            .then(cache => cache.put('radios.json', new Response(JSON.stringify(data))));
        })
    );
  }
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-radio-data') {
    event.waitUntil(
      fetch('/nepali-radio-player/radios.json')
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to fetch radios.json');
        })
        .then(data => {
          return caches.open(CACHE_NAME)
            .then(cache => cache.put('/nepali-radio-player/radios.json', new Response(JSON.stringify(data))));
        })
        .catch(err => {
          console.log('Background sync failed:', err);
        })
    );
  }
});