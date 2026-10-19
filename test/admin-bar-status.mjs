import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

/* 19 Oct 2026, his word: Salt Admin's bar says where things stand, as the Desk's line does: a dot and Live or Offline, then Open or
   Closed off /hours with when that changes, then the clock. Live only while the Counter answered the last read. */
export async function run({ ok }) {
  const kl = (d, o) => { const p = {}; new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "Asia/Kuala_Lumpur", hourCycle: "h23" }, o)).formatToParts(d).forEach((x) => { p[x.type] = x.value; }); return p; };
  const swallow = () => { };
  process.on("unhandledRejection", swallow);
  /* an hour on, unless that crosses midnight in Kuala Lumpur, when the until line says the day instead */
  const soon = new Date(Date.now() + 60 * 60 * 1000), sameDay = kl(soon, { day: "2-digit" }).day === kl(new Date(), { day: "2-digit" }).day;
  const t = kl(soon, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  const until = sameDay ? t.hour + ":" + t.minute : t.day + " " + t.month;
  const next = new Date(Date.now() + 36 * 60 * 60 * 1000), n = kl(next, { day: "2-digit", month: "short" });
  let hours = { ok: true, open: true, nextChange: soon.toISOString() };
  const dom = new JSDOM(landingPage("", "nbar", { master: "", accounts: [] }), { url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.fetch = async (u) => String(u) === "/hours" && hours ? { ok: true, status: 200, type: "basic", json: async () => hours } : { ok: false, status: 503, type: "basic", json: async () => ({}), text: async () => "" }; } });
  const wait = () => new Promise((r) => setTimeout(r, 200));
  try {
    await wait();
    const D = dom.window.document, live = D.getElementById("aLive"), open = D.getElementById("aHours");
    ok(!!live && live.className === "alive on" && live.textContent === "Live",
      "Salt Admin's bar reads Live, the dot lit, while the Counter answers /hours: " + JSON.stringify(live && [live.className, live.textContent]));
    ok(!!open && !open.hidden && open.textContent === "Open until " + until,
      "and Open until the next change, off /hours: " + JSON.stringify(open && [open.hidden, open.textContent, until]));
    hours = { ok: true, open: false, nextOpen: next.toISOString() };
    D.dispatchEvent(new dom.window.Event("visibilitychange"));
    await wait();
    ok(open.textContent === "Closed, opens " + n.day + " " + n.month, "Closed, with the day it opens, when the shop is shut: " + JSON.stringify(open.textContent));
    hours = null;
    D.dispatchEvent(new dom.window.Event("visibilitychange"));
    await wait();
    ok(live.className === "alive off" && live.textContent === "Offline", "Offline, the dot brass, once the Counter does not answer: " + JSON.stringify([live.className, live.textContent]));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
}
