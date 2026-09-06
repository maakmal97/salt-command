/* stmt/sw.js: THE CUSTOMER'S SERVICE WORKER, as a string the Worker serves at /sw.js.
 *
 * It exists for one thing: to show a banner when a push wakes it. It caches nothing and handles
 * no fetch, so the page a customer opens is still fetched from the Worker every time and nothing
 * about a statement is ever held in a cache on the phone. It holds no session and reads nothing
 * back, so the banner is fixed words: which order, what state and how much are on the page,
 * behind the password, where they belong.
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
  e.waitUntil(self.registration.showNotification('Salt Command', {
    body: 'Your order has an update. Open your statement page to see it.',
    tag: 'salt-order', renotify: true,
    data: { url: './' + (u ? '?u=' + encodeURIComponent(u) : '') }
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
