/* test/live-fakes.mjs: THE BROWSER'S END OF THE LIVE SOCKET, for the suite (Speed Wave 2 L2, 21 Oct 2026).
 *
 * A page under test gets a WebSocket that connects to nothing: it records its address and subprotocols, what the page sends, and when the
 * page closes it, and a test opens it, hands it the server's messages, drops it. installSockets puts one on a window before the page's script
 * runs, and marks the window so the suite's pageWork leaves it alone. clockOf wraps a customer page's timers: the intervals the live socket
 * sets (the polls, the ping) are kept and fired by hand, and timeouts are kept only while `capture` is true, so a test fires a reconnect or a
 * pong deadline itself; every other timer is the window's own. */
export function installSockets(win, list = []) {
  win.__liveFake = true;
  win.WebSocket = class {
    constructor(url, protocols) {
      this.url = String(url); this.protocols = protocols === undefined ? [] : [].concat(protocols);
      this.readyState = 0; this.sent = []; this.closedByPage = false; list.push(this);
    }
    send(message) { if (this.readyState !== 1) throw new Error("the socket is not open"); this.sent.push(message); }
    close() { if (this.readyState === 3) return; this.closedByPage = true; this.readyState = 3; if (this.onclose) this.onclose({}); }
    open() { this.readyState = 1; if (this.onopen) this.onopen({}); return this; }
    receive(message) { if (this.onmessage) this.onmessage({ data: typeof message === "string" ? message : JSON.stringify(message) }); return this; }
    drop() { if (this.readyState === 3) return; this.readyState = 3; if (this.onclose) this.onclose({}); }
  };
  return list;
}

const WATCH = [2000, 5000, 10000, 45000, 60000];
export function clockOf(win) {
  const si = win.setInterval.bind(win), ci = win.clearInterval.bind(win), st = win.setTimeout.bind(win), ct = win.clearTimeout.bind(win);
  const c = { ints: [], touts: [], capture: false };
  win.setInterval = (f, ms, ...rest) => { if (WATCH.includes(ms)) { c.ints.push({ f, ms, off: false }); return 90000 + c.ints.length; } return si(f, ms, ...rest); };
  win.clearInterval = (id) => { if (id > 90000 && c.ints[id - 90001]) { c.ints[id - 90001].off = true; return; } ci(id); };
  win.setTimeout = (f, ms, ...rest) => { if (c.capture) { c.touts.push({ f, ms, off: false }); return 190000 + c.touts.length; } return st(f, ms, ...rest); };
  win.clearTimeout = (id) => { if (id > 190000 && c.touts[id - 190001]) { c.touts[id - 190001].off = true; return; } ct(id); };
  c.live = (ms) => c.ints.filter((i) => i.ms === ms && !i.off);
  c.pending = (ms) => c.touts.filter((t) => t.ms === ms && !t.off);
  c.fire = (t) => { if (!t.off) { t.off = true; t.f(); } };
  return c;
}
