/* test/work-shell.mjs: THE WORKING SHELL ON SALT ADMIN AND SALT COUNTER (18 Nov 2026, Ambient 0.7.16, his three answers on the laptop's layout).
 * Display and markup only: no route, request body, price or booking changes. His screenshots at a laptop's width showed the hero taking a third of
 * the screen before any work, the rail's column empty under five rows, and the queue cutting its rows; his answers: the hero one slim row, the rail to
 * the foot with Live and the shop's state there, the queue 360 to 440px.
 * What is proved here, each check red under its own mutation (test/work-shell.mutations.json):
 *   W1  both shells carry Ambient's working shell, and the carried Ambient holds its three rules from 960px (the hero a row, the rail's tab bar grown
 *       to the foot, the panes' queue up to 440px); under 960px none of it is written
 *   W2  his rail ends in a foot: the live word, the clock and the shop's state as a control, inside the tab bar; a customer's page carries none
 *   W3  the foot says what the hero says: Live or Offline, and Open, Closed or Paused to its next change, a plain chip (the rail is no mesh)
 *   W4  from 960px the hero's own chip stands down, the foot's chip is a 44px control, and a tap on it goes to Shop
 * Geometry is measured in Chromium (the session's shots at 390, 1180, 1440, 1536 and 1920); jsdom lays nothing out, so these read markup, rules and state. */
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
  const at960 = css.split("@container amb (min-width: 960px) {").filter((b) => /\.amb-shell--work /.test(b)).join(" ");
  ok(/\.amb-shell--work \.amb-hero--compact \{ flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start;/.test(at960)
    && /\.amb-shell--work \.amb-hero--compact > \.amb-cluster \{ margin-left: auto; \}/.test(at960),
    "from 960px the working shell's hero is one row, its one action at the end");
  ok(/\.amb-shell--work\.amb-shell--rail > \.amb-dock > \.amb-tabbar \{ flex: 1 1 auto; \}/.test(at960), "its rail's tab bar grows to the screen's foot");
  ok(/\.amb-shell--work :is\(\.amb-screen, \.amb-place\) > \.amb-split--panes \{ grid-template-columns: minmax\(280px, min\(440px, 40%\)\) minmax\(0, 1fr\); \}/.test(at960),
    "and its panes give the queue up to 440px, the queue giving way first");
  const footOff = css.indexOf(".amb-tabbar__foot { display: none; } @container amb (min-width: 960px) {");
  ok(footOff >= 0 && css.indexOf(".amb-shell--work") > footOff,
    "under 960px nothing of it is written: the foot is not drawn, and the first working-shell rule stands inside the 960px container that follows");
  /* W2 */
  const dom0 = new JSDOM(owner), d0 = dom0.window.document, foot = d0.querySelector("#roster > .amb-dock > nav.amb-tabbar > .amb-tabbar__foot");
  ok(!!foot && foot.parentElement.lastElementChild === foot && !!foot.querySelector("p.arailtime > [data-barlive]") && !!foot.querySelector("p.arailtime > [data-clock]")
    && !!foot.querySelector("button#aRailHours[data-act='bar.hours'][hidden]") && d0.querySelectorAll("#aBarLive").length === 1 && !foot.querySelector("#aBarLive"),
    "his rail's tab bar ends in a foot: the live word and the clock in one line, then the shop's state, a button hidden until it has a word");
  dom0.window.close();
  ok(!/amb-tabbar__foot|aRailHours|arailtime/.test(customer.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")), "and a customer's page carries no foot, its rules apart");
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
    const D = dom.window.document, hero = D.getElementById("aBarHours"), rail = D.getElementById("aRailHours"), live = D.querySelector(".amb-tabbar__foot [data-barlive]");
    ok(!!live && live.className === "abarlive on" && live.textContent === "Live", "the foot reads Live while his reads reach the Counter: " + JSON.stringify(live && [live.className, live.textContent]));
    ok(!rail.hidden && /^Open to /.test(rail.textContent) && rail.textContent === hero.textContent && rail.getAttribute("aria-label") === hero.getAttribute("aria-label")
      && rail.classList.contains("amb-chip") && !rail.classList.contains("amb-chip--glass") && !!rail.querySelector(".amb-chip__dot"),
      "and the shop's state in the hero's own words, a plain chip, since the rail is no mesh: " + JSON.stringify([rail.hidden, rail.textContent, rail.className]));
    status = { open: false, source: "manual", nextChange: new Date(Date.now() + 3600000).toISOString(), nextOpen: new Date(Date.now() + 3600000).toISOString() };
    await again();
    ok(/^Paused to /.test(rail.textContent) && rail.textContent === hero.textContent && rail.classList.contains("ashop--paused"), "it follows the hero's chip when the shop is paused: " + JSON.stringify([rail.textContent, rail.className]));
    mode = "down";
    await again();
    ok(live.className === "abarlive off" && live.textContent === "Offline", "and reads Offline once his read cannot reach the Counter: " + live.textContent);
    mode = "ok";
    status = { open: true, source: "schedule", nextChange: new Date(Date.now() - 1000).toISOString(), nextOpen: null };
    await again();
    ok(rail.hidden && rail.textContent === "" && hero.hidden, "a state whose moment has passed is drawn in neither: " + JSON.stringify([rail.hidden, rail.textContent]));
    /* W4 */
    ok(/#aRailHours \{ min-height: var\(--amb-tap\); min-width: var\(--amb-tap\); \}/.test(css) && /@container amb \(min-width: 960px\) \{ #aBarHours \{ display: none; \} \}/.test(css),
      "the foot's chip is a 44px control, and from 960px the hero's chip stands down, the foot saying it");
    status = { open: true, source: "schedule", nextChange: new Date(Date.now() + 3600000).toISOString(), nextOpen: null };
    await again();
    rail.click(); await wait();
    const cur = D.querySelector('button[data-m][aria-current="page"]');
    ok(!!cur && cur.getAttribute("data-m") === "shop", "and a tap on the foot's chip goes to Shop: " + (cur && cur.getAttribute("data-m")));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
}
