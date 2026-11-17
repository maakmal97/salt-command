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
  /* 17 Nov 2026, the move to Ambient (Fable's review): the Counter's hero carries no bare clock any more; Salt Admin's heroes keep theirs, so the script is read there */
  const dom = new JSDOM(landingPage("", "nclk", { master: "", accounts: [] }), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.fetch = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "" }); } });
  try {
    await new Promise((r) => setTimeout(r, 300));
    const D = dom.window.document, c = D.querySelector("header.amb-hero > .amb-hero__time > [data-clock]");
    const want = kl(), got = c ? c.textContent : null;
    ok(!!c && (got === want.t || got === kl().t), "a hero of Salt Admin shows the time in Kuala Lumpur, digits only: " + JSON.stringify({ got, want: want.t }));
    /* 17 Nov 2026, the move to Ambient (the third red fix): a hero with no clock fails the check above cleanly, it does not throw here */
    if (c) c.textContent = "";
    D.dispatchEvent(new dom.window.Event("visibilitychange"));
    ok(!!c && (c.textContent === kl().t || c.textContent === want.t), "and paints it again when the page comes back into view: " + JSON.stringify(c && c.textContent));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
  const counter = new JSDOM(landingPage("abcd-efgh", "nclk3", null)).window.document;
  ok(counter.querySelectorAll("#tabs header.amb-hero").length === 1 && counter.querySelectorAll("#tabs .amb-hero__time, #tabs [data-clock]").length === 0, "the Counter's hero carries no bare clock");
  const owner = landingPage("", "nclk2", { master: "", accounts: [] });
  const heroes = owner.match(/<header class="amb-hero amb-hero--compact amb-mesh">(?:(?!<\/header>)[\s\S])*<\/header>/g) || [];
  const timed = heroes.filter((h) => /<p class="amb-hero__time"><span class="abarlive" data-barlive( id="aBarLive")?><\/span><span class="clk" data-clock><\/span><\/p>/.test(h));
  ok(heroes.length >= 5 && timed.length === heroes.filter((h) => !/id="placeT"|data-w="door[.]h"/.test(h)).length && (owner.match(/id="aBarLive"/g) || []).length === 1,   /* 17 Nov 2026, the move to Ambient (the third red fix): the door's hero, like Home's, is the Counter's and carries no clock */
    "every place of Salt Admin carries the clock in its hero's time line, beside the live line, the first holding its id: " + [heroes.length, timed.length].join(" of "));
}
