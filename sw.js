// Oil Empire — Service Worker
// Handles offline caching + scheduled notifications

const CACHE = 'oil-empire-v6';
const ASSETS = ['/', '/index.html'];

// ── Install: cache the game ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fallback to network ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      // Cache new assets on the fly
      if (res.ok && e.request.url.startsWith(self.location.origin)) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

// ── Message: schedule or cancel notifications ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleNotifications(e.data.lang, e.data.bps);
  }
  if (e.data?.type === 'CANCEL_NOTIFICATIONS') {
    cancelNotifications();
  }
});

// ── Notification click: focus or open the game ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('oil-empire') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// ── Scheduled notification timers ──
const notifTimers = [];

function cancelNotifications() {
  notifTimers.forEach(id => clearTimeout(id));
  notifTimers.length = 0;
}

function scheduleNotifications(lang, bps) {
  cancelNotifications();

  const msgs = lang === 'es' ? [
    { delay: 3  * 3600 * 1000, title: '🛢️ ¡Tu Imperio te espera!',     body: 'Tu petróleo se está acumulando. ¡Véndelo antes de que se derrame!' },
    { delay: 8  * 3600 * 1000, title: '💰 ¡Hay dinero esperándote!',    body: 'Lleva horas produciendo sin parar. Hora de cobrar.' },
    { delay: 24 * 3600 * 1000, title: '🌟 ¡El mercado está activo!',    body: 'Precios al alza. ¡Vuelve y aprovecha la oportunidad!' },
  ] : [
    { delay: 3  * 3600 * 1000, title: '🛢️ Your Empire awaits!',         body: 'Oil is piling up. Sell before it overflows!' },
    { delay: 8  * 3600 * 1000, title: '💰 Money is waiting for you!',   body: "It's been hours of non-stop production. Time to cash in." },
    { delay: 24 * 3600 * 1000, title: '🌟 The market is booming!',      body: 'Prices are up. Come back and seize the opportunity!' },
  ];

  // Extra message if BPS is high — more urgency
  if (bps > 500) {
    const urgentDelay = 5 * 3600 * 1000;
    const urgent = lang === 'es'
      ? { delay: urgentDelay, title: '⚡ ¡Tu producción está a tope!', body: `Produciendo ${Math.floor(bps).toLocaleString()} barriles/seg. ¡Todo se acumula!` }
      : { delay: urgentDelay, title: '⚡ Production maxed out!',       body: `${Math.floor(bps).toLocaleString()} barrels/sec and counting. Come collect!` };
    msgs.push(urgent);
  }

  msgs.forEach(({ delay, title, body }) => {
    const id = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon:  '/icon.png',
        badge: '/icon.png',
        tag:   'oil-empire-reminder',   // replaces previous so no spam
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: '/' },
        actions: [
          { action: 'open', title: lang === 'es' ? '¡Abrir juego!' : 'Open game!' }
        ]
      });
    }, delay);
    notifTimers.push(id);
  });
}
