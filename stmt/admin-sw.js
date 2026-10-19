/* stmt/admin-sw.js: SALT ADMIN'S OWN SERVICE WORKER (19 Oct 2026, docs/plan-notifications.html section 3), as a string the Worker serves at
 * /all/sw.js inside the /all gate, so both locks hold it, with Service-Worker-Allowed: /all.
 *
 * It exists to show one banner when the Desk wakes Salt Admin (stmt/push.js wakeOwner) for something that waits on his decision. It is
 * registered at scope /all, which is more specific than the customer's worker at the root, so it controls Admin's pages alone and the
 * customer's worker never sees them. It handles no fetch and caches nothing.
 *
 * THE WAKE CARRIES { k, o }: a kind, and an order id when the Desk knows it, sealed to this phone. The words are this file's own and name
 * no customer, code, amount or product: a kind tells him where to act, never what or how much. Unknown or missing payload is the fixed
 * Something needs you. One kind replaces itself (a tag per kind, and per order where an order is named); every banner renotifies.
 *
 * A TAP opens Salt Admin at the place that answers the kind (the page's own addresses: #orders, #orders/payments, #customers/messages,
 * #needs): an open Admin window is told where to go and focused, else one is opened there. Salt Admin has no address for a single order,
 * so the order id travels as data and the tap lands on the place whose first waiting stage it opens.
 */

/* the kinds the Desk may send, each: title, body, and the Admin address a tap opens */
export const ADMIN_NEWS = {
  order: ["New order", "Open Orders to answer it.", "#orders"],
  pay: ["A customer says they paid", "Check it arrived, then press Received or Not found.", "#orders/payments"],
  cancel: ["A customer cancelled", "Open Orders to see which.", "#orders"],
  said: ["A customer wrote", "Open Chat to read and answer.", "#customers/messages"],
  rate: ["A customer rated an order", "Open Orders to read it.", "#orders"],
  take: ["A customer took your price", "Open Orders to see the agreed order.", "#orders"],
  pass: ["A customer said no to your price", "Open Orders to see the order.", "#orders"],
  approve: ["Rows to approve", "Open Needs you to approve them.", "#needs"]
};
export const ADMIN_FALLBACK = ["Something needs you", "Open Salt Admin to see what.", ""];

export function adminSwScript() {
  return `
var NEWS = ${JSON.stringify(ADMIN_NEWS).replace(/</g, "\\u003c")}, FALL = ${JSON.stringify(ADMIN_FALLBACK).replace(/</g, "\\u003c")};
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(e){
  var n = null;
  try { n = e.data ? e.data.json() : null; } catch (x) { n = null; }
  var k = n && typeof n.k === 'string' && Object.prototype.hasOwnProperty.call(NEWS, n.k) ? n.k : '';
  var o = k && typeof n.o === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(n.o) ? n.o : '';
  var w = k ? NEWS[k] : FALL;
  e.waitUntil(self.registration.showNotification(w[0], {
    body: w[1], tag: k ? 'admin-' + k + (o ? '-' + o : '') : 'admin-update', renotify: true,
    icon: '/icon-key.png', data: { hash: w[2], order: o }
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var d = e.notification.data || {}, hash = typeof d.hash === 'string' ? d.hash : '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++) {
      var c = list[i], path = '';
      try { path = new URL(c.url).pathname; } catch (x) { path = ''; }
      /* Salt Admin's own page only: the test surface under /all/test is not where his work waits */
      if ((path === '/all' || path === '/all/') && 'focus' in c) {
        try { c.postMessage({ salt: 'admin', hash: hash }); } catch (x) {}
        return c.focus();
      }
    }
    return self.clients.openWindow('/all' + hash);
  }));
});
`;
}
export const ADMIN_SW_JS = adminSwScript();
