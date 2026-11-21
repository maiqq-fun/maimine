// MAIMINE 同意書離線快取
// 改了 consent.html 之後，把下面的版本號 +1（v1 → v2），平板才會抓到新版
const CACHE = 'mm-consent-v3';
const CORE = ['./consent.html', './apple-touch-icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 字型：有存過就直接用，沒有就上網抓並存起來
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res)))
    );
    return;
  }

  // 同網站的檔案（頁面、圖示）：先上網（最多等 3 秒），失敗就用存好的
  // ignoreSearch：網址後面帶 ?code=...&state=... 也能對到同一份
  if (url.origin === location.origin) {
    e.respondWith(
      new Promise(resolve => {
        let done = false;
        const fallback = () =>
          caches.match(req, { ignoreSearch: true }).then(hit => {
            if (hit) { done = true; resolve(hit); }
            return hit;
          });
        const timer = setTimeout(fallback, 3000);
        fetch(req).then(res => {
          clearTimeout(timer);
          if (!done) { done = true; resolve(put(req, res)); } else put(req, res);
        }).catch(() => {
          clearTimeout(timer);
          fallback().then(hit => { if (!hit && !done) resolve(Response.error()); });
        });
      })
    );
  }
});
