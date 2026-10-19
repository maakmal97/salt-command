/* test/counter-c-spots.mjs: SAVED SPOTS ON THE PHONE (Counter Batch C, P5, item 18; his answers 3, 4, 12 and 13 of 20 Oct 2026).
 *
 * A delivery's Where to is the spots kept on this phone for this account (localStorage salt-spots:<username>), at most three, none
 * picked when the sheet opens, Review waiting until one is; Add a spot and each spot's Edit open a step of the sheet (name, floor or
 * unit, area, exact spot, Save on this phone); Remove drops one with no confirm; Log out keeps them. A store that throws leaves the
 * sheet as it was. Every check observes the signed-in page in jsdom (test/counter-b-kit.mjs); each was proved red by its own
 * mutation (test/counter-c-spots.mutations.json, tools/section.mjs).
 *   1  with none saved, the list holds Add a spot alone and Review waits, saying why
 *   2  a spot added and saved is picked, kept under this account's key, and Review goes
 *   3  a new sheet opens with nothing picked and Review waits; picking fills the area the order carries
 *   4  each spot's Edit is named for it and is 44px; the step's own controls are 44px
 *   5  at three saved, Add a spot gives way to the line saying so
 *   6  Remove drops one, with no confirm
 *   7  Save on this phone off keeps nothing, and the spot serves this order alone
 *   8  two usernames keep two lists; Log out keeps this account's
 *   9  a store that throws leaves today's sheet: the area field, no list */
import { open, ord, ago, txt, until } from "./counter-b-kit.mjs";

const KEY = "salt-spots:abcd-efgh";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const sheet = async (p) => { p.d.querySelector('button[data-t="order"]').click(); await p.settle(); p.d.getElementById("oNew").click(); await p.settle();
    p.d.querySelector('#osheet [data-k="mode:1"]').click(); await p.settle(); };
  const close = async (p) => { p.d.querySelector('#osheet [data-k="close"]').click(); await p.settle(); };
  const list = (p) => [...p.d.querySelectorAll("#osheet .ospot")].map((r) => ({ label: txt(r.querySelector(".salt-option__label")), on: r.querySelector("input").checked, edit: r.querySelector(".ospot__edit").getAttribute("aria-label") }));
  const review = (p) => p.d.getElementById("oGo");
  const typeIn = (p, id, v) => { const x = p.d.getElementById(id); x.value = v; x.dispatchEvent(new p.w.Event("input", { bubbles: true })); };
  const add = async (p, { name = 0, typed = "", unit = "", area = "Veloria", save = true } = {}) => {
    const go = p.d.getElementById("spAdd"); if (!go) return false;
    go.click(); await p.settle();
    if (typed) typeIn(p, "spName", typed); else p.d.querySelector('#osheet [data-k="spn:' + name + '"]').click();
    await p.settle();
    if (unit) typeIn(p, "spUnit", unit);
    typeIn(p, "oWhere", area);
    const sv = p.d.getElementById("spSave"); if (sv && sv.checked !== save) { sv.checked = save; sv.dispatchEvent(new p.w.Event("change", { bubbles: true })); }
    p.d.getElementById("spUse").click(); await p.settle();
    return true;
  };
  const stored = (p, k = KEY) => { try { return JSON.parse(p.w.localStorage.getItem(k) || "[]"); } catch (e) { return "unreadable"; } };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [ord("s0", "done", ago(300))] });
    let confirms = 0; A.w.confirm = () => { confirms++; return true; };
    await sheet(A);
    ok(list(A).length === 0 && !!A.d.getElementById("spAdd") && review(A).disabled && /Pick where it is going, or add a spot\./.test(txt(A.d.querySelector("#osheet .ototal"))),
      "with none saved, Where to holds Add a spot alone and Review waits, saying why");
    /* ---- 2 ---- */
    await add(A, { name: 0, unit: "Level 2", area: "Veloria" });
    const s2 = stored(A);
    ok(J(list(A).map((x) => [x.label, x.on])) === J([["Shop", true]]) && !review(A).disabled && s2.length === 1 && s2[0].label === "Shop" && s2[0].unit === "Level 2" && s2[0].place === "Veloria",
      "a spot added and saved is picked, kept under this account's key, and Review goes: " + J(s2));
    /* ---- 3 ---- */
    await close(A); await sheet(A);
    const fresh = list(A);
    const s0 = A.d.querySelector('#osheet [data-k="spot:0"]'); if (s0) { s0.click(); await A.settle(); }
    review(A).click(); await A.settle();
    const chk = txt(A.d.getElementById("osheet"));
    ok(fresh.length === 1 && !fresh[0].on && list(A)[0] === undefined && /Veloria/.test(chk),
      "a new sheet opens with nothing picked; picking the spot carries its area to the check: " + J(fresh));
    await close(A);
    /* ---- 4 ---- */
    await sheet(A);
    const ed = A.d.querySelector('#osheet [data-k="spotedit:0"]');
    const P = await import("../stmt/page.js?" + Date.now()), css = P.landingPage("abcd-efgh", "n", null).replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (sel) => { const m = new RegExp(sel.replace(/[.]/g, "[.]") + "\\{([^}]*)\\}").exec(css); return m ? m[1] : ""; };
    ok(ed && ed.getAttribute("aria-label") === "Edit Shop" && ed.classList.contains("salt-ghost") && /min-height:var\(--salt-tap\)/.test(rule(".ospot__edit"))
      && /min-width:var\(--salt-tap\)/.test(rule(".ospot__edit")) && /min-height:var\(--salt-tap\)/.test(rule(".spsave")) && /min-height:var\(--salt-tap\)/.test(rule(".spremove")),
      "each spot's Edit is named for it and every control of the step is 44px: " + (ed && ed.getAttribute("aria-label")));
    /* ---- 5 ---- */
    await add(A, { name: 1, area: "Zarvo" }); await close(A); await sheet(A);
    await add(A, { typed: "Mum's", area: "Kelvar" }); await close(A); await sheet(A);
    ok(list(A).length === 3 && !A.d.getElementById("spAdd") && txt(A.d.getElementById("spFull")) === "Three saved. Remove one to add another." && stored(A).length === 3,
      "at three saved, Add a spot gives way to the line: " + J(list(A).map((x) => x.label)));
    /* ---- 6 ---- */
    const e1 = A.d.querySelector('#osheet [data-k="spotedit:1"]'); if (e1) { e1.click(); await A.settle(); }
    const rmv = A.d.getElementById("spRemove"); if (rmv) { rmv.click(); await A.settle(); }
    ok(J(stored(A).map((s) => s.label)) === J(["Shop", "Mum's"]) && confirms === 0 && J(list(A).map((x) => x.label)) === J(["Shop", "Mum's"]) && !!A.d.getElementById("spAdd"),
      "Remove drops the one, with no confirm, and Add a spot is back: " + J(stored(A).map((s) => s.label)));
    /* ---- 7 ---- */
    await add(A, { name: 2, area: "Ostra", save: false });
    ok(stored(A).length === 2 && J(list(A).map((x) => [x.label, x.on])) === J([["Shop", false], ["Mum's", false], ["Warehouse", true]]) && !review(A).disabled,
      "Save on this phone off keeps nothing, and the spot serves this order: " + J(list(A)));
    await close(A);
    /* ---- 8 ---- */
    A.w.localStorage.setItem("salt-spots:wxyz-abcd", JSON.stringify([{ id: "x1", label: "Other", place: "Nowhere" }]));
    await sheet(A);
    const mine = list(A).map((x) => x.label);
    await close(A);
    const lock = A.d.getElementById("lock"); lock.click(); lock.click(); await A.settle();
    ok(J(mine) === J(["Shop", "Mum's"]) && stored(A).length === 2 && stored(A, "salt-spots:wxyz-abcd").length === 1,
      "another username's spots are not this account's, and Log out keeps them: " + J({ mine, kept: stored(A).length }));
    /* ---- 9 ---- */
    const B = await page({ orders: [ord("s9", "done", ago(300))] });
    const real = B.w.Storage.prototype.getItem;
    B.w.Storage.prototype.getItem = function (k) { if (String(k).indexOf("salt-spots:") >= 0) throw new Error("SecurityError"); return real.call(this, k); };
    await sheet(B);
    ok(!B.d.querySelector("#osheet .ospots") && !!B.d.getElementById("oWhere") && B.d.getElementById("oWhere").closest("#osheet"),
      "a store that throws leaves today's sheet: the area field, no list");
    B.w.Storage.prototype.getItem = real;
  } finally { for (const p of pages) try { p.close(); } catch (e) { /* closed */ } }
}
const J = (o) => JSON.stringify(o);
