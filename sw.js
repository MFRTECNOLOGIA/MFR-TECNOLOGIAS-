const CACHE = 'mfr-market-v20261123-push';
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response && response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html'))));
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { title: 'MFR Market', body: event.data?.text() || 'Você tem uma nova oportunidade.' }; }
  const title = payload.title || 'MFR Market';
  const options = {
    body: payload.body || 'Você recebeu uma nova notificação.',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: payload.tag || 'mfr-market-notification',
    data: { url: payload.url || './', target_tab: payload.target_tab || 'home' },
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        client.postMessage({ type: 'MFR_NOTIFICATION_CLICK', target_tab: event.notification.data?.target_tab || 'home' });
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
