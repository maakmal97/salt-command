/* test/admin-look.mjs: SALT ADMIN'S LOOK (his word of 11 Oct 2026; docs/STATEMENTS.md "His look").
 *
 * From 11 Oct 2026 Salt Admin wore Night or Tide, chosen on its own device (localStorage salt-look), with a choice Sheet on a first open and a
 * Look row under Shop > This device; parked from 19 Oct 2026 while Tide was off. 15 NOV 2026, THE MOVE TO AMBIENT (his answer of 14 Nov 2026):
 * light and dark follow each device, so the row, the Sheet and their acts are gone, and this file holds that rule on his page. Each check is red
 * under its own mutation (test/admin-look.mutations.json, run with tools/section.mjs).
 *   1  his page draws no Look row, no choice Sheet and no look act, and Shop > This device holds the one unlock and the notifications
 *   2  opened on a device that kept a look, his page sets no theme, reads and writes no salt-look, and asks nothing
 *   3  the page it gives way to when Access lapses is an Ambient shell at rest, its one pill Sign in again, nothing of a look on it */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";

export async function run({ ok, pageWork }) {
  /* 1 */
  const html = landingPage("", "nlook", { master: "fixture-master", accounts: [] });
  ok(!/id="lookRow"|id="lookSheet"|data-look=|data-act="look\./.test(html) && /<section id="oLook" data-in="shop.device"[^>]*>[\s\S]*?<div class="salt-settings adevice"><div id="vaultRow"/.test(html),
    "his page draws no Look row, no choice Sheet and no look act; This device opens on the one unlock");
  /* 2 */
  const seen = [];
  const p = await richOwnerPage({ pageWork, before: (w) => {
    try { w.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the store may refuse; the check below reads what was asked */ }
    const set = w.Storage.prototype.setItem, get = w.Storage.prototype.getItem;
    w.Storage.prototype.setItem = function (k, v) { if (/look/.test(k)) seen.push("set " + k); return set.call(this, k, v); };
    w.Storage.prototype.getItem = function (k) { if (/look/.test(k)) seen.push("get " + k); return get.call(this, k); };
  } });
  try {
    await p.work.quiet();
    const d = p.d;
    ok(!d.documentElement.hasAttribute("data-theme") && seen.length === 0 && !d.querySelector("[data-look]") && !d.getElementById("lookSheet"),
      "opened on a device that kept Tide, his page sets no theme, reads and writes no look, and asks nothing: " + JSON.stringify(seen));
    /* 3 */
    const tap = byAct(d, "nav.shop"); if (tap) tap.click(); await p.work.quiet();
    const end = d.getElementById("aEnded");
    ok(!!end && end.classList.contains("amb-shell") && end.getAttribute("data-mood") === "slate" && !!end.querySelector('a.amb-pill[data-act="ended.sign-in"]') && !end.querySelector("[data-look]"),
      "and the ended page is an Ambient shell at rest, its one pill Sign in again, nothing of a look on it");
  } finally { try { p.w.close(); } catch (e) { } }
}
