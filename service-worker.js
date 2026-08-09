/* service-worker.js
   App shell (HTML/CSS/JS/icons) cache karta hai taaki app bina internet ke bhi
   khule aur kaam kare. Google Apps Script API calls kabhi cache nahi hoti -
   wo hamesha network se hi jaati hain (sync data hamesha fresh hona chahiye).
*/

- const CACHE_NAME = 'gomati-mart-v1';
+ const CACHE_NAME = 'gomati-mart-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/sync.js',
  './js/scanner.js',
  './js/escpos.js',
  './js/billing.js',
  './js/products.js',
  './js/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Google Apps Script / kisi bhi external API call ko cache mat karo
  if (url.origin !== self.location.origin) {
    return; // browser default network fetch karega
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // App shell mein naya file mile to usko bhi cache kar lo
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
