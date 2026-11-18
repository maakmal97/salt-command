/* test/work-shell.mjs: THE WORKING SHELL ON SALT ADMIN AND SALT COUNTER (18 Nov 2026, Ambient 0.7.16, redrawn the same day on Ambient 0.7.21 to his
 * four answers on the laptop's layout, "so hectic"). Display and markup only: no route, request body, price or booking changes.
 * His answers B and C: the heading is a real bar on the page's own ground, as wide as the content and closed by a hairline, the aurora a strip along the
 * top edge; Live, the time and the shop's state stand in that bar, at its right, in every place; the rail's foot, their home for a day, is emptied.
 * What is proved here, each check red under its own mutation (test/work-shell.mutations.json):
 *   W1  both shells carry Ambient's working shell, and the carried Ambient holds its rules from 960px (the hero a bar on the page ground with a hairline,
 *       the mesh a strip, the time line shown at the end, the rail's tab bar grown to the foot, the panes' queue up to 440px); under 960px none is written
 *   W2  the rail has no foot, and every place's hero carries the status: the live word, the clock and the shop's state as a control; a phone shows the
 *       state on Needs you alone (the others carry data-wide, which stands down under 960px)
 *   W3  every bar says one thing: Live or Offline, and Open, Closed or Paused to its next change
 *   W4  the chip is a 44px control in every bar, and a tap on any of them goes to Shop hours
 * Geometry is measured in Chromium (the session's shots at 390, 1000, 1180, 1440, 1536 and 1920); jsdom lays nothing out, so these read markup, rules and state. */
import { JSDOM } from "jsdom";
import { landingPage, SITE_STYLE } from "../stmt/page.js";

export async function run({ ok }) {
  const swallow = () => {};
  process.on("unhandledRejection", swallow);
  const owner = landingPage("", "wshell", { master: "", accounts: [] }), customer = landingPage("abcd-efgh", "wshellc", null);
  const css = SITE_STYLE.replace(/\s+/g, " ");
  /* W1 */
  ok(/<div id="roster" class="amb-shell amb-shell--rail amb-shell--page amb-shell--work adm"/.test(owner) && /<div id="tabs" class="amb-shell amb-shell--rail amb-shell--page amb-shell--work"/.test(customer),
    "Salt Admin's shell and the Counter's each carry Ambient's working shell");
  const first = css.indexOf(".amb-shell--work"), open = css.lastIndexOf("@container amb", first);
  const at960 = css.split("@container amb (min-width: 960px) {").filter((b) => /\.amb-shell--work /.test(b)).join(" ");
  const bar = (at960.match(/\.amb-shell--work \.amb-hero--compact \{ ([^}]*)\}/) || [])[1] || "";
  ok(/position: relative; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start;/.test(bar) && /border-bottom: 1px solid var\(--amb-line\);/.test(bar)
    && /background-image: none;/.test(bar) && /margin: 0 var\(--amb-bar-r\) var\(--amb-space-4\) var\(--amb-bar-l\);/.test(bar),
    "from 960px the working shell's hero is a bar on the page's own ground, one row closed by a hairline, its sides the content's: " + bar.slice(0, 80));
  ok(/\.amb-shell--work \.amb-hero--compact::before \{ content: ""; position: absolute; top: 0;[^}]*height: var\(--amb-space-1\); background-image: linear-gradient\(to right, var\(--amb-mesh-1\), var\(--amb-mesh-3\), var\(--amb-mesh-2\)\); \}/.test(at960),
    "and the mesh is a 4px strip along the top edge, behind nothing that is read");
  ok(/\.amb-shell--work \.amb-hero--compact > \.amb-hero__time \{ margin-left: auto;/.test(at960) && /\.amb-shell--work \.amb-hero--compact > \.amb-hero__time ~ \.amb-cluster \{ margin-left: 0; \}/.test(at960)
    && !/amb-hero__time \{ display: none; \}/.test(css),
    "its time line stands at the bar's end, before its actions, and no rule hides it");
  ok(/\.amb-shell--work\.amb-shell--rail > \.amb-dock > \.amb-tabbar \{ flex: 1 1 auto; \}/.test(at960), "its rail's tab bar grows to the screen's foot");
  ok(/\.amb-shell--work :is\(\.amb-screen, \.amb-place\) > \.amb-split--panes \{ grid-template-columns: minmax\(280px, min\(440px, 40%\)\) minmax\(0, 1fr\); \}/.test(at960),
    "and its panes give the queue up to 440px, the queue giving way first");
  ok(first > 0 && open > 0 && css.startsWith("@container amb (min-width: 960px) {", open),
    "under 960px nothing of it is written: the first working-shell rule stands inside the 960px container");
  /* W2 */
  const dom0 = new JSDOM(owner), d0 = dom0.window.document, heroes = [...d0.querySelectorAll("#roster .amb-place > header.amb-hero")];
  ok(!/amb-tabbar__foot|aRailHours|arailtime/.test(owner + customer) && d0.querySelector("#roster > .amb-dock > nav.amb-tabbar").lastElementChild.matches("button.amb-tab"),
    "the rail has no foot: its tab bar ends in a place, and no page carries the foot or its rules");
  const chips = heroes.map((h) => h.querySelector(":scope > button[data-barhours][data-act='bar.hours'][hidden]"));
  ok(heroes.length === 5 && heroes.every((h) => !!h.querySelector(":scope > p.amb-hero__time > [data-barlive]") && !!h.querySelector(":scope > p.amb-hero__time > [data-clock]")) && chips.every(Boolean),
    "every place's hero carries the status: the live word and the clock in one line, then the shop's state, a button hidden until it has a word: " + heroes.length);
  ok(chips.filter((c) => c && !c.hasAttribute("data-wide")).length === 1 && d0.querySelector("#mHome > header > #aBarHours") === chips.find((c) => c && !c.hasAttribute("data-wide"))
    && /@container amb \(max-width: 959\.98px\) \{ \[data-wide\] \{ display: none; \} \}/.test(css) && !/#aBarHours \{ display: none; \}/.test(css),
    "a phone shows the state on Needs you alone: the other four carry data-wide, which stands down under 960px, and nothing hides Needs you's from 960px");
  dom0.window.close();
  /* W3, W4 */
  let status = { open: true, source: "schedule", nextChange: new Date(Date.now() + 3600000).toISOString(), nextOpen: null }, mode = "ok";
  const answer = (body, code = 200) => ({ ok: code === 200, status: code, type: "basic", json: async () => body, text: async () => JSON.stringify(body) });
  const dom = new JSDOM(owner, { url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async (u) => {
        if (mode === "down") throw new TypeError("Failed to fetch");
        return String(u) === "/all/maker/hours" ? answer({ ok: true, status, config: {} }) : answer({ ok: false, error: "fixture" }, 503);
      };
    } });
  const wait = () => new Promise((r) => setTimeout(r, 300));
  const again = async () => { dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange")); await wait(); };
  try {
    await wait();
    const D = dom.window.document, all = [...D.querySelectorAll("#roster [data-barhours]")], hero = D.getElementById("aBarHours"), lives = [...D.querySelectorAll("#roster [data-barlive]")];
    const same = () => all.every((c) => c.textContent === hero.textContent && c.hidden === hero.hidden && c.className === hero.className && c.getAttribute("aria-label") === hero.getAttribute("aria-label"));
    ok(lives.length === 5 && lives.every((l) => l.className === "abarlive on" && l.textContent === "Live"), "every bar reads Live while his reads reach the Counter: " + JSON.stringify(lives.map((l) => l.textContent)));
    ok(all.length === 5 && !hero.hidden && /^Open to /.test(hero.textContent) && same() && hero.classList.contains("amb-chip") && !!hero.querySelector(".amb-chip__dot"),
      "and the shop's state in the same words in every place: " + JSON.stringify(all.map((c) => [c.hidden, c.textContent])));
    status = { open: false, source: "manual", nextChange: new Date(Date.now() + 3600000).toISOString(), nextOpen: new Date(Date.now() + 3600000).toISOString() };
    await again();
    ok(/^Paused to /.test(hero.textContent) && same() && all.every((c) => c.classList.contains("ashop--paused")), "each follows when the shop is paused: " + JSON.stringify(all.map((c) => [c.textContent, c.className])));
    mode = "down";
    await again();
    ok(lives.every((l) => l.className === "abarlive off" && l.textContent === "Offline"), "and each reads Offline once his read cannot reach the Counter: " + lives.map((l) => l.textContent));
    mode = "ok";
    status = { open: true, source: "schedule", nextChange: new Date(Date.now() - 1000).toISOString(), nextOpen: null };
    await again();
    ok(all.every((c) => c.hidden && c.textContent === ""), "a state whose moment has passed is drawn in none: " + JSON.stringify(all.map((c) => [c.hidden, c.textContent])));
    /* W4 */
    ok(/\[data-barhours\] \{ min-height: var\(--amb-tap\); min-width: var\(--amb-tap\); \}/.test(css), "the chip is a 44px control in every bar");
    status = { open: true, source: "schedule", nextChange: new Date(Date.now() + 3600000).toISOString(), nextOpen: null };
    await again();
    D.querySelector("#oCustomers > header [data-barhours]").click(); await wait();
    const cur = D.querySelector('button[data-m][aria-current="page"]'), hours = D.querySelector('.aparts[data-place="shop"] [data-part="hours"]');
    ok(!!cur && cur.getAttribute("data-m") === "shop" && hours.getAttribute("aria-pressed") === "true", "and a tap on Customers' chip goes to Shop hours: " + (cur && cur.getAttribute("data-m")));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
}
