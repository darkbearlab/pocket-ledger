const CACHE_NAME = 'pocket-ledger-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // 如果您有上傳 icon.png 就解開下面這行
  // './icon.png' 
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ⚠️ 關鍵：如果是 Firebase 或 Google API 的請求，直接走網路，不要快取！
  // 這樣才能確保資料庫讀到最新的
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') || 
      url.hostname.includes('google')) {
    return; 
  }

  // 其他靜態檔案 (HTML, JS, CSS) 走快取優先
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
