/* test/desk-market.mjs: THE PRICE BAND'S VERSION 2 ON THE DESK (11 Nov 2026): four panels on Pricing for salt alone. Display and reading only; the engine
 * (SNAPSHOT_ENGINE.marketOf, marketWhy, priceReading, marketScore, marketReplay) is held by test/price-band-market.mjs.
 * The suite's frozen book holds the market switch off and the move starts tomorrow, so the moved figures are the engine's answer stubbed on the page.
 *   M1  the Market move card shows today's move, its reason in his words, the plain and today's Median at 1 unit, and a 14-day log with a stood-down day
 *   M2  Switch off links to Salt Admin's market/off when his switch is on, Switch on to market/on when it is off
 *   M3  the Median reading lists every size the engine reads, with a Use link to anchor/<size>/<price> only where a re-anchor is suggested, and says it is his tap
 *   M4  his anchored points are listed, and one outside the band says so with his reason
 *   M5  the Quotes column is drawn only when the Desk's /quotes answered ok, with N shown, M placed per size
 *   M6  This week shows margin a day against the eight weeks before, orders, new buyers, regulars won back, and the move's effect said to be an estimate
 *   M7  Replay is shut and empty until opened, then draws a row a day; nothing is drawn for a book that is not salt
 * Every assertion is red under its own mutation (test/desk-market.mutations.json). */
import { openMaster } from "../tools/payload.mjs";

const J = JSON.stringify;
const text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const d = w.document, E = (s) => w.eval(s);
    const hrefs = (root) => [...root.querySelectorAll("a[href^='admin?to=']")].map((a) => decodeURIComponent(a.getAttribute("href").slice("admin?to=".length)));
    const draw = () => { E("render()"); };

    E("switchTab('pricing')");
    /* a moved day: +5 on 4.2 days of cover, moving towards +15, after a day over 14 days of cover and a stood-down day */
    E("SNAPSHOT_ENGINE.switchOn=()=>true");
    E(`SNAPSHOT_ENGINE.marketOf=()=>({day:'2026-11-11',k:0.05,on:true,target:0.15,cover:4.2,long:false,none:false,stood:false,since:'2026-11-01',
      log:[{day:'2026-11-09',k:-0.1,on:true,cover:2,stood:true},{day:'2026-11-10',k:0,on:true,long:true,cover:null,stood:false},{day:'2026-11-11',k:0.05,on:true,cover:4.2,stood:false}]})`);
    draw();
    const card = d.getElementById("mkCard");
    ok(!!card && /\+5/.test(text(d.getElementById("mkMove"))) && /Median \+5: 4\.2 days of cover, moving 5 a day towards \+15/.test(text(d.getElementById("mkWhy")))
      && /Median at 1 unit: RM \d+ plain, RM \d+ today/.test(text(card)) && d.querySelectorAll("#mkLog tbody tr").length === 3 && /stood down/.test(text(d.getElementById("mkLog"))) && /over 14/.test(text(d.getElementById("mkLog"))),
      "M1 the card shows the move, its reason, the two Medians and the 14-day log: " + J(text(card).slice(0, 240)));

    ok(J(hrefs(card)) === J(["market/off"]) && /Switch off/.test(text(card)),
      "M2.1 with his switch on the card links Switch off to market/off: " + J(hrefs(card)));
    E("SNAPSHOT_ENGINE.switchOn=()=>false");
    draw();
    ok(J(hrefs(d.getElementById("mkCard"))) === J(["market/on"]) && /Switch on/.test(text(d.getElementById("mkCard"))),
      "M2.2 with it off the card links Switch on to market/on: " + J(hrefs(d.getElementById("mkCard"))));

    /* M3 and M4 */
    E(`MARKET_BOOK.salt={anchors:[{q:6.25,price:700,from:'2026-11-12'},{q:12.5,price:900,from:'2026-11-12',outside:{side:'above',why:'the supplier quote moved'}}]}`);
    draw();
    const rd = E("SNAPSHOT_ENGINE.priceReading(snapCtx(),'salt',90)");
    const reading = d.getElementById("mkReading"), rows = [...reading.querySelectorAll("tbody tr")];
    const want = rd.filter((r) => r.suggest).map((r) => "anchor/" + r.q + "/" + r.best);
    ok(rd.length > 1 && rows.length === rd.length && want.length > 0 && want.length < rd.length && J(hrefs(reading)) === J(want)
      && rows.every((tr, i) => (tr.querySelectorAll("a").length === 1) === !!rd[i].suggest) && /Use RM \d/.test(text(reading)),
      "M3.1 a Use link on the suggested sizes only: " + J([rows.length, hrefs(reading), want]));
    ok(/your tap, never automatic/.test(text(reading)), "M3.2 it says a re-anchor is your tap and never automatic");

    const anchors = [...d.querySelectorAll("#mkAnchors li")].map(text);
    ok(anchors.length === 2 && /6\.25 unit anchored at RM 700 from 12 Nov 2026/.test(anchors[0]) && !/Outside/.test(anchors[0])
      && /12\.5 unit anchored at RM 900/.test(anchors[1]) && /Outside the band: the supplier quote moved/.test(anchors[1]),
      "M4 two anchored points, the second marked outside the band with his reason: " + J(anchors));

    /* M5: no column before an answer, none on a refusal, the figures on an ok answer */
    ok(!/Quotes/.test(text(d.querySelector("#mkReading thead"))), "M5.1 no Quotes column before the route has answered");
    const viaFetch = async (answer) => {
      E("MK_QUOTES=null;MK_QUOTES_TRIED=false;cloudMode=()=>true");
      w.fetch = async () => ({ ok: true, json: async () => answer });
      await E("mkQuotesLoad()");
      draw();
      return text(d.querySelector("#mkReading thead"));
    };
    const refused = await viaFetch({ ok: false, books: { salt: { "1": { shown: 9, placed: 4 } } } });
    ok(!/Quotes/.test(refused) && E("MK_QUOTES") === null, "M5.2 an answer that is not ok leaves the column out: " + J(refused));
    const good = await viaFetch({ ok: true, books: { salt: { "1": { shown: 9, placed: 4 } } } });
    const one = d.querySelector("#mkReading tr[data-q='1'] .mkq");
    ok(/Quotes/.test(good) && one && text(one) === "9 shown, 4 placed", "M5.3 an ok answer adds the column with N shown, M placed: " + J(text(one)));

    /* M6 */
    const sc = E("SNAPSHOT_ENGINE.marketScore(snapCtx(),'salt')");
    const score = text(d.getElementById("mkScore"));
    ok(sc && /Margin a dayRM [\d,.]+ against RM [\d,.]+ over the eight weeks before/.test(score) && new RegExp("Orders" + sc.orders + "New").test(score)
      && new RegExp("New buyers" + sc.newBuyers + "Regulars").test(score) && new RegExp("Regulars won back" + sc.wonBack + "What").test(score) && /What the move addedRM [\d,.-]+ estimate/.test(score),
      "M6 the scorecard: " + J(score));

    /* M7 */
    const rep = d.getElementById("mkReplay");
    ok(rep && !rep.open && text(d.getElementById("mkRepBody")) === "" && /mkRepToggle/.test(rep.getAttribute("ontoggle")),
      "M7.1 Replay is shut and its body empty until opened: " + J(text(d.getElementById("mkRepBody"))));
    E("(function(){const el=document.getElementById('mkReplay');el.open=true;mkRepToggle(el);})()");
    const replayRows = d.querySelectorAll("#mkRepBody tbody tr").length;
    ok(replayRows > 0 && /Quote at 1 unit/.test(text(d.getElementById("mkRepBody"))), "M7.2 opened, it draws a row a day: " + replayRows);
    E("setProdView('oil')");
    draw();
    ok(!d.getElementById("mkCard") && !d.getElementById("mkReading") && !d.getElementById("mkScore") && !d.getElementById("mkReplay"),
      "M7.3 a book that is not salt draws none of the four");
  } finally { w.close(); }
}
