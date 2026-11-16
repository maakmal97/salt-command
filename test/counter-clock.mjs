import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

/* 14 Oct 2026 (his review): a live clock on the Counter's header and beside Salt Admin's name, Kuala Lumpur time, painted
   on load and again when the page comes back into view. 15 Nov 2026, the move to Ambient: the clock is the time line of each place's hero,
   the Counter's one hero and every one of his, beside his live line. */
export async function run({ ok }) {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const kl = () => { const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; }); return { t: p.hour + ":" + p.minute, d: p.day + " " + MON[+p.month - 1] }; };
  const swallow = () => { };
  process.on("unhandledRejection", swallow);
  const dom = new JSDOM(landingPage("abcd-efgh", "nclk", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.fetch = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" }); } });
  try {
    await new Promise((r) => setTimeout(r, 300));
    const D = dom.window.document, c = D.querySelector("#tabs header.amb-hero > .amb-hero__time[data-clock]");
    const want = kl(), got = c ? c.textContent : null;
    ok(!!c && (got === want.t || got === kl().t), "the Counter's hero shows the time in Kuala Lumpur, digits only: " + JSON.stringify({ got, want: want.t }));
    c.textContent = "";
    D.dispatchEvent(new dom.window.Event("visibilitychange"));
    ok(c.textContent === kl().t || c.textContent === want.t, "and paints it again when the page comes back into view: " + JSON.stringify(c.textContent));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
  const owner = landingPage("", "nclk2", { master: "", accounts: [] });
  const heroes = owner.match(/<header class="amb-hero amb-hero--compact amb-mesh">(?:(?!<\/header>)[\s\S])*<\/header>/g) || [];
  const timed = heroes.filter((h) => /<p class="amb-hero__time"><span class="abarlive" data-barlive( id="aBarLive")?><\/span><span class="clk" data-clock><\/span><\/p>/.test(h));
  ok(heroes.length >= 5 && timed.length === heroes.filter((h) => !/id="placeT"/.test(h)).length && (owner.match(/id="aBarLive"/g) || []).length === 1,
    "every place of Salt Admin carries the clock in its hero's time line, beside the live line, the first holding its id: " + [heroes.length, timed.length].join(" of "));
}
