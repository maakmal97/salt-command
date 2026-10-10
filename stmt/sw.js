/* stmt/sw.js: THE CUSTOMER'S SERVICE WORKER, as a string the Worker serves at /sw.js.
 *
 * It exists for one thing: to show a banner when a push wakes it. It handles no fetch, so the page a
 * customer opens is still fetched from the Worker every time and nothing about a statement is ever
 * held in a cache on the phone. It holds no session and reads nothing from the Cache.
 *
 * THE BANNER IS A PLAIN SENTENCE OF ITS KIND (S12 12.2, his decision D4 of 24 Sep 2026; his sentences of
 * 28 Sep 2026, Step 1b). A wake for a phone whose keys are on file carries { k, o } and, where the kind
 * has them, its case and his text (sealedNews in stmt/push.js), encrypted for that phone; the words are
 * the table's news.* keys: never an amount, a product or a name. His line on an order is its body in
 * quotation marks, under a tag of its own; his reason at Decline or Cancel is the body. A tap opens
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
import { WORDS } from "./words.js";

/* S13 13.3: THE WORDS ARE THE TABLE'S (stmt/words.js, "news.<kind>" and four more), one table a language; NEWS is
   English's by kind, which is what a wake's kind is checked against. Only the news words travel in the script. */
const KINDS = ["confirmed", "confirmed-credit", "ready-collect", "ready-deliver", "reply", "paid", "notfound", "due",
  "delivered", "collected", "part-delivered", "part-collected", "complete", "declined", "cancelled", "rate", "message", "pool-closed", "offer", "confirm"];
/* Step 1b: the cases a kind's body is chosen by (stmt/orders.js payCase), and the kinds whose body is his own text:
   his line on the order (reply), his line on the account's thread (message, Step 7) and his reason at Decline or Cancel */
export const CASES = ["owed", "waiting", "paid"];
export const TEXT_KINDS = ["reply", "declined", "cancelled", "message"];
/* the kinds that are a line of his, each a banner of its own under its moment */
export const LINE_KINDS = ["reply", "message"];
export const TEXT_MAX = 200;
export const NEWS = Object.fromEntries(KINDS.map((k) => [k, WORDS.en["news." + k]]));
const SW_WORDS = { en: Object.fromEntries(Object.keys(WORDS.en).filter((k) => k.startsWith("news.")).map((k) => [k.slice(5), WORDS.en[k]])) };

export function swScript() {
  return `
var NEWS = ${JSON.stringify(NEWS)}, W = ${JSON.stringify(SW_WORDS).replace(/</g, "\\u003c")};
var CASES = ${JSON.stringify(CASES)}, TEXT_KINDS = ${JSON.stringify(TEXT_KINDS)}, LINE_KINDS = ${JSON.stringify(LINE_KINDS)}, TEXT_MAX = ${TEXT_MAX};
/* a banner word, in English */
function nw(k){ return W.en[k] || ''; }
/* Step 1b: THE BODY OF A KIND. His own text where the kind carries it (his line in quotation marks, his reason as it
   stands), else the case's sentence, else the kind's own, else Tap to open it */
function bodyOf(n){
  var t = typeof n.t === 'string' ? n.t.trim().slice(0, TEXT_MAX) : '';
  if (t && TEXT_KINDS.indexOf(n.k) >= 0) return LINE_KINDS.indexOf(n.k) >= 0 ? '“' + t + '”' : t;
  var v = typeof n.v === 'string' && CASES.indexOf(n.v) >= 0 ? nw(n.k + '.' + n.v) : '';
  return v || nw(n.k + '.b') || (TEXT_KINDS.indexOf(n.k) >= 0 ? nw('update') : nw('tap'));
}
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(e){
  var u = new URL(self.location.href).searchParams.get('u') || '';
  var n = null;
  try { n = e.data ? e.data.json() : null; } catch (x) { n = null; }
  var o = n && typeof n.o === 'string' && /^[0-9]{14}-[a-z0-9]{1,8}$/.test(n.o) ? n.o : '';
  /* Step 7: his line on the account's thread opens the thread (#thread), never an order */
  var th = !!(n && n.k === 'message');
  var to = { url: './' + (u ? '?u=' + encodeURIComponent(u) : '') + (o ? '#o=' + o : th ? '#thread' : ''), order: o, thread: th };
  e.waitUntil(Promise.resolve().then(function(){
    /* one banner a message of his (plan F1): his line takes its own tag, so a second line never replaces the first unseen */
    var m = n && LINE_KINDS.indexOf(n.k) >= 0 && typeof n.m === 'string' && /^[0-9TZ:.-]{10,30}$/.test(n.m) ? n.m : '';
    if (n && typeof n.k === 'string' && Object.prototype.hasOwnProperty.call(NEWS, n.k))
      return self.registration.showNotification(nw(n.k), { body: bodyOf(n), tag: m ? 'm-' + (th ? 'thread' : o) + '-' + m : n.k === 'pool-closed' && o ? 'pool-' + o : o ? 'order-' + o : 'order-update', renotify: true, data: to });
    return fetch('bulletin', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; })
      .then(function(b){
        var fresh = b && b.at && b.lines && b.lines.length && (Date.now() - Date.parse(b.at) < 120000);
        if (fresh) return self.registration.showNotification(String(b.lines[0]).slice(0, 120), {
          body: b.lines.length > 1 ? String(b.lines[1]).slice(0, 120) : nw('open'),
          tag: 'notice', renotify: true, data: to
        });
        return self.registration.showNotification(nw('order'), {
          body: nw('update'),
          tag: 'order-update', renotify: true, data: to
        });
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
      /* S5 5.6: only the Counter's own page can open an order; a guest board or his own page in another tab cannot */
      if (c.url.indexOf(self.registration.scope) === 0 && (path === '/' || path.indexOf('/s/') === 0) && 'focus' in c) {
        try { c.postMessage({ salt: 'news', order: d.order || '', thread: !!d.thread }); } catch (x) {}
        return c.focus();
      }
    }
    return self.clients.openWindow(want);
  }));
});
`;
}
export const SW_JS = swScript();
