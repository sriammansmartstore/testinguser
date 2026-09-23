/* Simple service worker for asset/page caching */
const CACHE_VERSION = 'v1.0.0';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  // Activate immediately after installing
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('runtime-') && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Helper: cache-first for static assets, network-first for documents
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Strategy selection by destination
  const dest = req.destination;

  // Cache-first for scripts, styles, fonts, images, audio, video
  if (['script', 'style', 'font', 'image', 'audio', 'video'].includes(dest)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // For navigation/page requests (HTML), use network-first with cache fallback
  if (dest === 'document' || req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  // Default: try cache-first as well
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: false });
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    // Only cache successful, basic (opaque false) responses
    if (resp && resp.status === 200 && resp.type === 'basic') {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (e) {
    // On failure return whatever we have (likely null) so the page can decide
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200) {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (e) {
    const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: false });
    if (cached) return cached;
    // Offline fallback to cached root (SPA shell) if available
    const fallback = await cache.match('/');
    return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received:', event);
  
  if (!event.data) {
    console.log('[Service Worker] No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[Service Worker] Push notification data:', data);

    const options = {
      body: data.body || data.message || '',
      icon: data.icon || '/banner.png',
      badge: data.badge || '/banner.png',
      tag: data.tag || 'notification',
      requireInteraction: data.requireInteraction !== false,
      data: {
        url: data.url || '/',
        ...data
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  } catch (error) {
    console.error('[Service Worker] Error handling push notification:', error);
    
    // Fallback if data is not JSON
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Notification', {
        body: text,
        icon: '/banner.png',
        badge: '/banner.png'
      })
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for existing window/tab
      for (let client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not found, open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification);
});
