/* stmt/sw.js: THE CUSTOMER'S SERVICE WORKER, as a string the Worker serves at /sw.js.
 *
 * It exists for one thing: to show a banner when a push wakes it. It caches nothing and handles
 * no fetch, so the page a customer opens is still fetched from the Worker every time and nothing
 * about a statement is ever held in a cache on the phone. It holds no session.
 *
 * THE BANNER NAMES THE KIND OF NEWS (S12 12.2, his decision D4 of 24 Sep 2026). A wake for a phone
 * whose keys are on file carries { k, o }, encrypted for that phone (stmt/push.js), and the words
 * are NEWS below, this file's own: never an amount, a product, an order or a name. A tap opens
 * the Counter at that order (#o=<id>, which the page reads), and a page already open is told to
 * re-read and open it, where focusing it alone showed whatever it drew last. The tag is the order's,
 * so a banner about one order never replaces another's (S12-C3). A wake with no
 * payload, from a subscription filed before its keys were, keeps the fixed words below.
 *
 * v761: THE ONE THING IT MAY READ IS THE NOTICE, because the notice is public: the page polls it
 * unsigned-in and the door itself draws it. A notice's wake carries no payload, so it cannot say what
 * it is; instead the notice carries its own moment, and one set in the last two minutes is
 * what this wake is about. Being wrong costs a customer the notice's first line instead of a line
 * about an order that is on their page anyway, and being right means a notice actually arrives.
 *
 * The username rides on the script's own address (/sw.js?u=xxxx-xxxx) so a tap on the banner
 * opens the page with it filled in, the way the QR does. A string rather than a file because the
 * site has no assets and every byte it serves is generated per request.
 */
export const NEWS = {
  confirmed: "Your order is confirmed",
  ready: "Your order is ready",
  reply: "A reply on your order",
  paid: "Payment received",
  due: "A payment is due",
  delivered: "Your order was delivered",
  collected: "Your order was collected",
  "part-delivered": "Part of your order was delivered",
  "part-collected": "Part of your order was collected",
  complete: "Your order is complete",
  declined: "Your order could not be taken",
  cancelled: "Your order was cancelled",
};

export const SW_JS = `
var NEWS = ${JSON.stringify(NEWS)};
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(e){
  var u = new URL(self.location.href).searchParams.get('u') || '';
  var n = null;
  try { n = e.data ? e.data.json() : null; } catch (x) { n = null; }
  var o = n && typeof n.o === 'string' && /^[0-9]{14}-[a-z0-9]{1,8}$/.test(n.o) ? n.o : '';
  var to = { url: './' + (u ? '?u=' + encodeURIComponent(u) : '') + (o ? '#o=' + o : ''), order: o };
  if (n && typeof n.k === 'string' && Object.prototype.hasOwnProperty.call(NEWS, n.k)) {
    e.waitUntil(self.registration.showNotification(NEWS[n.k], { body: 'Tap to open it.', tag: o ? 'order-' + o : 'order-update', renotify: true, data: to }));
    return;
  }
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
  var d = e.notification.data || {}, want = d.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++) {
      var c = list[i], path = '';
      try { path = new URL(c.url).pathname; } catch (x) { path = ''; }
      /* S5 5.6: only the Counter's own page can open an order; a guest board or Salt Admin in another tab cannot */
      if (c.url.indexOf(self.registration.scope) === 0 && (path === '/' || path.indexOf('/s/') === 0) && 'focus' in c) {
        try { c.postMessage({ salt: 'news', order: d.order || '' }); } catch (x) {}
        return c.focus();
      }
    }
    return self.clients.openWindow(want);
  }));
});
`;
