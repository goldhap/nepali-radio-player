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
  const url = new URL(event.request.url);

  // ✅ Skip audio streams and proxy URLs
  if (
    event.request.destination === 'audio' ||
    url.href.includes('radio-stream') || // your proxy path
    url.href.includes('.mp3') || 
    url.href.includes('.m3u') ||
    url.href.includes('stream') // generic stream keyword
  ) {
    return; // Let browser handle it natively
  }

  // ✅ Otherwise: Cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
