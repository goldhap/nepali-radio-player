const CACHE_NAME = 'nepali-radio-cache-v2';
const OFFLINE_URL = '/nepali-radio-player/offline.html';

const urlsToCache = [
  '/nepali-radio-player/',
  '/nepali-radio-player/index.html',
  '/nepali-radio-player/style.css',
  '/nepali-radio-player/index.js',
  '/nepali-radio-player/script.js',
  '/nepali-radio-player/radios.json',
  '/nepali-radio-player/logo/default.jpg',
  '/nepali-radio-player/icons/android-chrome-192x192.png',
  '/nepali-radio-player/icons/android-chrome-512x512.png',
  OFFLINE_URL
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Cache addAll failed:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
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
    url.href.includes('stream') ||
    url.href.includes('render.com') || // your proxy host
    !url.origin.includes(location.origin) // external resources
  ) {
    return; // Let browser handle these requests natively
  }

  // Network-first strategy for HTML documents
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh version
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_URL) || caches.match('/nepali-radio-player/');
        })
    );
    return;
  }

  // Cache-first strategy for all other assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request)
          .then((fetchResponse) => {
            // Cache new assets (except streams)
            if (!event.request.url.includes('stream')) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseClone));
            }
            return fetchResponse;
          })
          .catch(() => {
            // Return offline image for failed image requests
            if (event.request.destination === 'image') {
              return caches.match('/nepali-radio-player/logo/default.jpg');
            }
          });
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
