const CACHE_NAME = 'nepali-radio-cache-v1';
const urlsToCache = [
  '/nepali-radio-player/',
  '/nepali-radio-player/index.html',
  '/nepali-radio-player/style.css',
  '/nepali-radio-player/index.js',
  '/nepali-radio-player/script.js',
  '/nepali-radio-player/radios.json',
  '/nepali-radio-player/icons/android-chrome-192x192.png',
  '/nepali-radio-player/icons/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
