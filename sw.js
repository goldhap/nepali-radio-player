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
  '/nepali-radio-player/icons/android-chrome-512x512.png'
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
        }).filter(Boolean) // Remove undefined values
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
    url.origin !== location.origin // external resources
  ) {
    return; // Let browser handle these requests natively
  }

  // Network-first strategy for HTML documents
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseClone))
              .catch(err => console.log('Cache put failed:', err));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/nepali-radio-player/') || caches.match('/nepali-radio-player/index.html');
        })
    );
    return;
  }

  // Cache-first strategy for all other assets
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Return cached version
        }
        
        return fetch(event.request)
          .then((fetchResponse) => {
            // Only cache successful responses
            if (fetchResponse.status === 200 && !event.request.url.includes('stream')) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseClone))
                .catch(err => console.log('Cache put failed:', err));
            }
            return fetchResponse;
          })
          .catch(() => {
            // Return offline image for failed image requests
            if (event.request.destination === 'image') {
              return caches.match('/nepali-radio-player/logo/default.jpg');
            }
            // Return null for other failed requests
            return null;
          });
      })
  );
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