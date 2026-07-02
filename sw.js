const CACHE_NAME = 'kosoku-kiroku-v2';
const TILE_CACHE  = 'kosoku-tiles-v1';
const MAX_TILES   = 500;

// アプリシェル：インストール時に先読みキャッシュ
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

// ── インストール ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── アクティベート（古いキャッシュを削除） ────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── フェッチ ──────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 地図タイル → キャッシュ優先・上限付き
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              if (response.ok) {
                // 上限を超えたら古いタイルを1件削除
                cache.keys().then(keys => {
                  if (keys.length >= MAX_TILES) cache.delete(keys[0]);
                });
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // 外部CDN（Leaflet）→ キャッシュ優先
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // HTMLドキュメント → ネットワーク優先・キャッシュ保存・オフライン時はキャッシュから
  if (
    event.request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/')
  ) {
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

  // その他（アイコン等）→ キャッシュ優先
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
