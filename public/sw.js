const CACHE_NAME = "mc-shell-v2";
const SHELL_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only cache GET requests for navigation and static assets
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache static assets (JS, CSS, fonts, images)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // For navigation requests: network-first, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MarkdownCollab - Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#31302e;color:#fff}div{text-align:center;max-width:400px;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:rgba(255,255,255,.6);margin:0 0 1.5rem;line-height:1.5}button{background:#0075de;color:#fff;border:none;padding:.75rem 1.5rem;border-radius:8px;font-size:.875rem;cursor:pointer}button:hover{background:#005bab}</style></head><body><div><div class="icon">&#9986;</div><h1>You\'re offline</h1><p>MarkdownCollab needs an internet connection to load your documents. Check your connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>',
              { status: 200, headers: { "Content-Type": "text/html" } }
            )
        )
      )
    );
    return;
  }
});
