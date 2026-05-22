// DreamTalez Service Worker
// Offline shell caching, push notifications, keepsake offline storage.

const SW_VERSION   = '20260521b';
const OFFLINE_URL  = '/offline.html';
const INDEX_URL    = '/index.html';
const OFFLINE_SCRIPT = '/offline.js';
const OFFLINE_CACHE = `dt-offline-${SW_VERSION}`;
const RUNTIME_CACHE = `dt-runtime-${SW_VERSION}`;
const CACHEABLE_RESOURCE_TYPES = new Set(['script', 'style', 'image', 'font', 'manifest']);
const KEEPSAKE_CACHE = `dt-keepsakes-v1`;
const SELF_SCRIPT_URL = self.location.origin + '/sw.js';
const OFFLINE_SCRIPT_URL = self.location.origin + OFFLINE_SCRIPT;

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.addAll([OFFLINE_URL, INDEX_URL, OFFLINE_SCRIPT]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== OFFLINE_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

async function fetchWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (request.method === 'GET' && CACHEABLE_RESOURCE_TYPES.has(request.destination) && response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.destination === 'document') {
      const cache = await caches.open(OFFLINE_CACHE);
      return (
        await cache.match(INDEX_URL)
        || await cache.match(OFFLINE_URL)
        || new Response('<!doctype html><title>Offline</title><body>Offline</body>', {
          headers: { 'Content-Type': 'text/html' },
          status: 200,
        })
      );
    }

    return new Response('', { status: 204, statusText: 'No Content' });
  }
}

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Schedule a local bedtime notification after a delay
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { delayMs, title, body, tag } = event.data;
    if (!delayMs || delayMs <= 0) return;
    setTimeout(() => {
      self.registration.showNotification(title || 'DreamTalez ✨', {
        body: body || 'A magical bedtime story is waiting 🌙',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        tag: tag || 'dt-bedtime',
        renotify: true,
        data: { url: '/' },
        vibrate: [100, 50, 100],
      });
    }, Math.min(delayMs, 86400000)); // cap at 24h
    return;
  }

  // Cache a keepsake story for offline reading
  if (event.data.type === 'CACHE_KEEPSAKE') {
    const { id, title, text } = event.data;
    if (!id || !text) return;
    caches.open(KEEPSAKE_CACHE).then(cache => {
      const blob = new Blob([JSON.stringify({ id, title, text, cachedAt: new Date().toISOString() })], { type: 'application/json' });
      cache.put(`/keepsake/${id}`, new Response(blob));
    });
    return;
  }
});

// Push event — display notification when received from server
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const title = data.title || 'DreamTalez ✨';
  const body  = data.body  || 'A magical bedtime story is waiting tonight 🌙';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/icons/icon-192.png',
      badge:    '/icons/icon-96.png',
      tag:      data.tag || 'dt-bedtime',
      renotify: true,
      data:     { url: data.url || '/' },
      vibrate:  [100, 50, 100],
    })
  );
});

// Notification click — open or focus the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url === SELF_SCRIPT_URL || event.request.url.startsWith(SELF_SCRIPT_URL + '?')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  if (event.request.url === OFFLINE_SCRIPT_URL) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response('', { status: 404, statusText: 'Not Found' });
      })
    );
    return;
  }

  if (event.request.method !== 'GET') {
    // Non-GET requests: let the browser handle them directly (no SW interception).
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch (err) {
          const cache = await caches.open(OFFLINE_CACHE);
          return (
            await cache.match(event.request)
            || await cache.match(INDEX_URL)
            || await cache.match(OFFLINE_URL)
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    fetchWithCacheFallback(event.request).catch(() =>
      new Response(null, { status: 404, statusText: 'Not Found' })
    )
  );
});
