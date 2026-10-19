import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

/* 14 Oct 2026 (his review): a live clock on the Counter's header and beside Salt Admin's name, Kuala Lumpur time, painted
   on load and again when the page comes back into view. */
export async function run({ ok }) {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const kl = () => { const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; }); return { t: p.hour + ":" + p.minute, d: p.day + " " + MON[+p.month - 1] + ", " + p.hour + ":" + p.minute }; };
  const swallow = () => { };
  process.on("unhandledRejection", swallow);
  const dom = new JSDOM(landingPage("abcd-efgh", "nclk", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.fetch = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" }); } });
  try {
    await new Promise((r) => setTimeout(r, 300));
    const D = dom.window.document, c = D.querySelector(".chead [data-clock]");
    const want = kl(), got = c ? c.textContent : null;
    ok(!!c && (got === want.t || got === kl().t), "the Counter's header shows the time in Kuala Lumpur, digits only: " + JSON.stringify({ got, want: want.t }));
    c.textContent = "";
    D.dispatchEvent(new dom.window.Event("visibilitychange"));
    ok(c.textContent === kl().t || c.textContent === want.t, "and paints it again when the page comes back into view: " + JSON.stringify(c.textContent));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
  const owner = landingPage("", "nclk2", { master: "", accounts: [] });
  /* 18 Oct 2026: one clock, under the name in the Desk bar that heads every place, as the Desk carries it */
  const bars = owner.match(/<div class="salt-deskbar__name">Salt Admin<\/div><div class="salt-deskbar__meta"><span class="clk" data-clock><\/span><\/div>/g) || [];
  ok(bars.length === 1, "Salt Admin carries the clock under its name in the Desk bar that heads every place: " + bars.length);
}
