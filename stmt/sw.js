/* stmt/sw.js: THE CUSTOMER'S SERVICE WORKER, as a string the Worker serves at /sw.js.
 *
 * It exists for one thing: to show a banner when a push wakes it. It caches nothing and handles
 * no fetch, so the page a customer opens is still fetched from the Worker every time and nothing
 * about a statement is ever held in a cache on the phone. It holds no session, so the banner for
 * an order is fixed words: which order, what state and how much are on the page, behind the
 * password, where they belong.
 *
 * v761: THE ONE THING IT MAY READ IS THE NOTICE, because the notice is public: the page polls it
 * unsigned-in and the door itself draws it. A push carries no payload, so the wake cannot say which
 * kind it is; instead the notice carries its own moment, and one set in the last two minutes is
 * what this wake is about. Being wrong costs a customer the notice's first line instead of a line
 * about an order that is on their page anyway, and being right means a notice actually arrives.
 *
 * The username rides on the script's own address (/sw.js?u=xxxx-xxxx) so a tap on the banner
 * opens the page with it filled in, the way the QR does. A string rather than a file because the
 * site has no assets and every byte it serves is generated per request.
 */
export const SW_JS = `
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(e){
  var u = new URL(self.location.href).searchParams.get('u') || '';
  var to = { url: './' + (u ? '?u=' + encodeURIComponent(u) : '') };
  e.waitUntil(fetch('bulletin', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; })
    .then(function(b){
      var fresh = b && b.at && b.lines && b.lines.length && (Date.now() - Date.parse(b.at) < 120000);
      if (fresh) return self.registration.showNotification(String(b.lines[0]).slice(0, 120), {
        body: b.lines.length > 1 ? String(b.lines[1]).slice(0, 120) : 'Open the page to read it.',
        tag: 'notice', renotify: true, data: to
      });
      return self.registration.showNotification('Your order', {
        body: 'Your order has an update. Open your statement page to see it.',
        tag: 'order-update', renotify: true, data: to
      });
    }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var want = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(want);
  }));
});
`;
