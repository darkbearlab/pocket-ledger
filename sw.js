const CACHE_NAME = 'pocket-ledger-v99'; // 版本號改大一點，強迫更新
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // './icon.png' // 有圖再開
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // 強制接管
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim(); // 強制接管
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // 不快取 Firebase 相關請求，確保資料最新
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
