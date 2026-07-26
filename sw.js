// ── バージョンをここだけ変えれば全ユーザーに更新が届く ──
const CACHE_NAME = 'kosoku-kiroku-v4';
const TILE_CACHE = 'kosoku-tiles-v1';
const MAX_TILES  = 500;

// アプリシェル：インストール時に先読みキャッシュ
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

// ── インストール：アプリシェルを先読みキャッシュ ──────
// ※ skipWaiting しない → ユーザーが「今すぐ更新」を押したときだけ切り替わる
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

// アプリからの「今すぐ更新」メッセージを受け取ったら切り替え
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── アクティベート：旧キャッシュを削除 ──────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())  // 開いているページに即適用
  );
});

// ── フェッチ ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 地図タイル → 閲覧分をキャッシュ（最大500枚）
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              if (response.ok) {
                cache.keys().then(keys => {
                  if (keys.length >= MAX_TILES) cache.delete(keys[0]);
                });
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // それ以外（アプリ本体・CDN・アイコンなど）→ キャッシュ優先
  // キャッシュになければネットワークから取得してキャッシュに保存
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
