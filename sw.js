const CACHE_NAME = 'kosoku-kiroku-v1';

// 外部CDNリソース（変化しないもの）だけキャッシュ対象にする
const STATIC_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // index.html や同一オリジンのHTMLファイル → ネットワーク優先
  // ネットワークで取得できたら最新版をキャッシュにも保存
  // オフラインのときだけキャッシュから返す
  if (event.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 外部CDNリソース → キャッシュ優先（高速・オフライン対応）
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
