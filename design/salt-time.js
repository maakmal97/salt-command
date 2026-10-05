/* salt-time.js: the theme follows the viewer's clock (05 Oct 2026).
 *
 * Four themes, six hours each, on the viewer's own local time: Dawn from 04:00, Day from 10:00, Dusk
 * from 16:00, Night from 22:00. It sets data-time on <html>, which re-points the identity's roles in
 * styles.css. Run it in <head>, before the body paints, so a page never flashes the wrong theme.
 *
 * It arms one timer to the next boundary (never a poll) and re-reads on every return to the page. A
 * change while the page is open cross-fades for --salt-theme-fade (the class salt-theming, removed
 * when the fade ends); the first paint never fades. A choice of the viewer's (Auto, or one theme held)
 * is kept in localStorage under salt-time; Auto is the default. In Auto, a phone set to dark mode is
 * never given the light Day theme: Dawn stands in for it, as it does on a surface marked
 * data-time-day="off" while its own colours are still being turned into tokens.
 *
 * A consumer that draws its own colours (a chart, a canvas) listens for the salt-time event on
 * document.documentElement and redraws once. window.saltTime.set('auto' | 'dawn' | 'day' | 'dusk' |
 * 'night') is the one way to change the choice.
 *
 * Vendored by each surface's own sync: the desk inlines it in the master, the Counter carries it inside
 * its page script, QR Command inside app.js (its CSP refuses an inline script). It is ES5 with no
 * backslash and no backtick, because the Counter ships it inside a template literal. */
(function () {
  var KEY = 'salt-time';
  var HOURS = [[4, 'dawn'], [10, 'day'], [16, 'dusk'], [22, 'night']];
  var GROUND = { dawn: '#0f131a', day: '#f3efe6', dusk: '#120d0b', night: '#05080a' };
  var root = document.documentElement;
  var timer = 0, fading = 0;

  function byClock(d) {
    var h = d.getHours(), t = 'night';
    for (var i = 0; i < HOURS.length; i++) if (h >= HOURS[i][0]) t = HOURS[i][1];
    return t;
  }
  function choice() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return v === 'dawn' || v === 'day' || v === 'dusk' || v === 'night' ? v : 'auto';
  }
  function prefersDark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }
  /* A surface whose own colours are not yet all tokens marks <html data-time-day="off">: it is never
     given the light theme, held or by the clock, and Dawn stands in for it. */
  function dayOff() { return root.getAttribute('data-time-day') === 'off'; }
  function resolve(d) {
    var c = choice();
    if (c !== 'auto') return c === 'day' && dayOff() ? 'dawn' : c;
    var t = byClock(d || new Date());
    return t === 'day' && (prefersDark() || dayOff()) ? 'dawn' : t;
  }
  function paint(t, fade) {
    if (root.getAttribute('data-time') === t) return;
    if (fade && root.hasAttribute('data-time')) {
      root.classList.add('salt-theming');
      clearTimeout(fading);
      fading = setTimeout(function () { root.classList.remove('salt-theming'); }, 1300);
    }
    root.setAttribute('data-time', t);
    bar();
    var ev;
    try { ev = new CustomEvent('salt-time', { detail: { time: t } }); } catch (e) { ev = null; }
    if (ev) root.dispatchEvent(ev);
  }
  /* the browser's bar takes the ground; a theme-color meta written after this script (a build that
     injects one later in <head>) is set again once the document is parsed */
  function bar() {
    var t = root.getAttribute('data-time'), metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', GROUND[t] || GROUND.night);
  }
  function untilNext(d) {
    var h = d.getHours(), next = -1;
    for (var i = 0; i < HOURS.length; i++) if (HOURS[i][0] > h) { next = HOURS[i][0]; break; }
    var n = new Date(d.getTime());
    if (next < 0) { n.setDate(n.getDate() + 1); next = HOURS[0][0]; }
    n.setHours(next, 0, 0, 0);
    return n.getTime() - d.getTime();
  }
  function arm() {
    clearTimeout(timer);
    timer = setTimeout(function () { paint(resolve(), true); arm(); }, Math.min(untilNext(new Date()) + 500, 2147483000));
  }

  paint(resolve(), false);
  arm();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { paint(resolve(), true); arm(); }
  });

  window.saltTime = {
    hours: HOURS,
    byClock: byClock,
    choice: choice,
    get: function () { return root.getAttribute('data-time'); },
    set: function (v) {
      try {
        if (v === 'dawn' || v === 'day' || v === 'dusk' || v === 'night') localStorage.setItem(KEY, v);
        else localStorage.removeItem(KEY);
      } catch (e) {}
      paint(resolve(), true);
      arm();
    }
  };
})();
