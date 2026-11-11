/* test/counter-c-spots.mjs: SPOTS ON THE PHONE (Counter Batch C, P5; made simple 11 Nov 2026, his word: "either enter their address
 * (plain text or using links), or use exact location (GPS), and a label. That is it").
 *
 * A delivery's Where to is the spots kept on this phone for this account (localStorage salt-spots:<username>), at most three, none
 * picked when the sheet opens unless one is kept, Review waiting until one is. Add a spot asks a name (its grey suggestion Home, Shop
 * or Work) and an address typed or a map link pasted, or Use my location; the spot is kept by itself; Remove drops one with no confirm;
 * Log out keeps them. Each check observes the signed-in page in jsdom (test/counter-b-kit.mjs) and was proved red by its own mutation
 * (test/counter-c-spots.mutations.json, tools/section.mjs).
 *   1  with none kept, the list holds Add a spot alone and Review waits, saying why
 *   2  the step asks a name and an address, Use my location beside it, and nothing else (no preset names, floor, area or save box)
 *   3  a name under two letters or an address under five is refused at Use this spot, saying which
 *   4  a spot added is picked, kept under this account's key as name and address, and Review goes; its name is the order's place
 *   5  one kept spot is picked on opening and reaches the check as Address, Shared, sealed; 5b two open with none picked;
 *      5c To your last place picks the one kept under that name
 *   6  a pasted map link takes the address's place: the field gives way to the line and Remove, and the spot keeps the point alone
 *   7  each spot's Edit is named for it and is 44px, as is Remove
 *   8  at three kept, Add a spot gives way to the line; Remove drops one with no confirm
 *   9  two usernames keep two lists; Log out keeps this account's
 *   10 a store that throws still gives Add a spot, and the spot serves this order alone
 *   11 a spot kept before 11 Nov 2026 (an area and a floor or unit) is read back with them as its address */
import { open, ord, ago, txt, startAt } from "./counter-b-kit.mjs";

const KEY = "salt-spots:abcd-efgh";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const sheet = async (p) => { p.d.querySelector('button[data-t="order"]').click(); await p.settle(); await startAt(p.d); await p.settle();
    p.d.querySelector('#osheet [data-k="mode:1"]').click(); await p.settle(); };
  const close = async (p) => { p.d.querySelector('#osheet [data-k="close"]').click(); await p.settle(); };
  const list = (p) => [...p.d.querySelectorAll("#osheet .ospot")].map((r) => ({ label: txt(r.querySelector(".salt-option__label")), on: r.querySelector("input").checked, edit: r.querySelector(".ospot__edit").getAttribute("aria-label") }));
  const review = (p) => p.d.getElementById("oGo");
  const typeIn = (p, id, v) => { const x = p.d.getElementById(id); x.value = v; x.dispatchEvent(new p.w.Event("input", { bubbles: true })); };
  const add = async (p, { name = "Home", addr = "12 Jalan Veloria" } = {}) => {
    const go = p.d.getElementById("spAdd"); if (!go) return false;
    go.click(); await p.settle();
    typeIn(p, "spName", name); if (addr) typeIn(p, "spAddr", addr); await p.settle();
    p.d.getElementById("spUse").click(); await p.settle();
    return true;
  };
  const stored = (p, k = KEY) => { try { return JSON.parse(p.w.localStorage.getItem(k) || "[]"); } catch (e) { return "unreadable"; } };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [ord("s0", "done", ago(300))] });
    let confirms = 0; A.w.confirm = () => { confirms++; return true; };
    await sheet(A);
    ok(list(A).length === 0 && !!A.d.getElementById("spAdd") && review(A).getAttribute("aria-disabled") === "true" && /Pick where it is going, or add a spot\./.test(txt(A.d.querySelector("#osheet .ototal"))),
      "with none kept, Where to holds Add a spot alone and Review waits, saying why");
    /* ---- 2 ---- */
    A.d.getElementById("spAdd").click(); await A.settle();
    const nm = A.d.getElementById("spName"), ad = A.d.getElementById("spAddr");
    const inputs = [...A.d.querySelectorAll("#osheet .salt-sheet__body input, #osheet .salt-sheet__body textarea")].map((x) => x.id);
    ok(nm && nm.placeholder === "Home, Shop or Work" && ad && ad.placeholder === "Type the address, or paste a map link" && !!A.d.getElementById("oPinHere")
      && JSON.stringify(inputs) === JSON.stringify(["spName", "spAddr"]) && !A.d.querySelector('#osheet [data-k^="spn:"]') && !A.d.getElementById("spSave") && !A.d.getElementById("spUnit") && !A.d.getElementById("oWhere"),
      "Add a spot asks a name and an address, with Use my location, and nothing else: " + JSON.stringify(inputs));
    /* ---- 3 ---- */
    typeIn(A, "spName", "H"); typeIn(A, "spAddr", "12 Jalan Veloria"); await A.settle();
    const short = [A.d.getElementById("spUse").disabled, txt(A.d.querySelector("#osheet .salt-sheet__foot .ototal"))];
    typeIn(A, "spName", "Home"); typeIn(A, "spAddr", "12"); await A.settle();
    const noAddr = [A.d.getElementById("spUse").disabled, txt(A.d.querySelector("#osheet .salt-sheet__foot .ototal"))];
    ok(short[0] && /Give the spot a name\./.test(short[1]) && noAddr[0] && /Type the address, or use your location\./.test(noAddr[1]),
      "a name under two letters or an address under five is refused, saying which: " + JSON.stringify([short, noAddr]));
    A.d.querySelector('#osheet [data-k="back"]').click(); await A.settle();
    /* ---- 4 ---- */
    await add(A, { name: "Home", addr: "12 Jalan Veloria, Block B" });
    const s4 = stored(A);
    ok(JSON.stringify(list(A).map((x) => [x.label, x.on])) === JSON.stringify([["Home", true]]) && review(A).getAttribute("aria-disabled") !== "true"
      && s4.length === 1 && s4[0].label === "Home" && s4[0].addr === "12 Jalan Veloria, Block B" && !("place" in s4[0]) && !("unit" in s4[0]),
      "a spot added is picked, kept as its name and address, and Review goes: " + JSON.stringify(s4));
    /* ---- 5 ---- */
    await close(A); await sheet(A);
    const fresh = list(A);
    review(A).click(); await A.settle();
    const chk = txt(A.d.getElementById("osheet"));
    ok(fresh.length === 1 && fresh[0].on && /Address/.test(chk) && /Shared, sealed/.test(chk) && !/Jalan/.test(chk),
      "one kept spot is picked on opening and reaches the check as Address, sealed, never its words: " + JSON.stringify(fresh));
    await close(A);
    /* ---- 5b ---- */
    const kept1 = A.w.localStorage.getItem(KEY);
    A.w.localStorage.setItem(KEY, JSON.stringify([{ id: "a1", label: "Shop", addr: "3 Jalan Veloria" }, { id: "a2", label: "Home", addr: "9 Lorong Orlen" }]));
    await sheet(A);
    const two = list(A);
    ok(two.length === 2 && two.every((x) => !x.on) && review(A).getAttribute("aria-disabled") === "true",
      "with two kept a new sheet opens with none picked and Review waits: " + JSON.stringify(two));
    await close(A); A.w.localStorage.setItem(KEY, kept1);
    /* ---- 5c ---- */
    {
      const C = await page({ orders: [ord("s1", "done", ago(300), { mode: "deliver", place: "Home" })] });
      C.w.localStorage.setItem(KEY, JSON.stringify([{ id: "a1", label: "Shop", addr: "3 Jalan Veloria" }, { id: "a2", label: "Home", addr: "9 Lorong Orlen" }]));
      const tile = C.d.querySelector('[data-start="deliver"]');
      const said = tile ? txt(tile) : "";
      if (tile) { tile.click(); await C.settle(); await startAt(C.d); await C.settle(); }
      const fromHome = list(C);
      ok(/To your last place/.test(said) && JSON.stringify(fromHome.map((x) => [x.label, x.on])) === JSON.stringify([["Shop", false], ["Home", true]]),
        "To your last place picks the spot kept under that name: " + JSON.stringify([said, fromHome]));
      await close(C);
    }
    /* ---- 6 ---- */
    await sheet(A);
    A.d.getElementById("spAdd").click(); await A.settle();
    typeIn(A, "spName", "Store"); typeIn(A, "spAddr", "https://maps.google.com/?q=3.1390,101.6869"); await A.settle();
    const linkState = [!A.d.getElementById("spAddr"), !!A.d.getElementById("oPinOff"), txt(A.d.querySelector("#osheet .opin"))];
    A.d.getElementById("spUse").click(); await A.settle();
    const s6 = stored(A).filter((s) => s.label === "Store")[0];
    ok(linkState[0] && linkState[1] && /Your link is ready/.test(linkState[2]) && s6 && s6.addr === "" && s6.pt && Math.abs(s6.pt.lat - 3.139) < 1e-6,
      "a pasted map link takes the address's place and the spot keeps the point alone: " + JSON.stringify([linkState, s6]));
    /* ---- 7 ---- */
    const ed = A.d.querySelector('#osheet [data-k="spotedit:0"]');
    const P = await import("../stmt/page.js?" + Date.now()), css = P.landingPage("abcd-efgh", "n", null).replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (sel) => { const m = new RegExp(sel.replace(/[.]/g, "[.]") + "\\{([^}]*)\\}").exec(css); return m ? m[1] : ""; };
    ok(ed && ed.getAttribute("aria-label") === "Edit Home" && ed.classList.contains("salt-ghost") && /min-height:var\(--salt-tap\)/.test(rule(".ospot__edit"))
      && /min-width:var\(--salt-tap\)/.test(rule(".ospot__edit")) && /min-height:var\(--salt-tap\)/.test(rule(".spremove")),
      "each spot's Edit is named for it and every control of the step is 44px: " + (ed && ed.getAttribute("aria-label")));
    /* ---- 8 ---- */
    await close(A); await sheet(A);
    await add(A, { name: "Mum's", addr: "7 Jalan Kelvar" }); await close(A); await sheet(A);
    const three = list(A).length, full = txt(A.d.getElementById("spFull")), noAdd = !A.d.getElementById("spAdd");
    const e1 = A.d.querySelector('#osheet [data-k="spotedit:1"]'); if (e1) { e1.click(); await A.settle(); }
    const rmv = A.d.getElementById("spRemove"); if (rmv) { rmv.click(); await A.settle(); }
    ok(three === 3 && noAdd && full === "Three saved. Remove one to add another." && JSON.stringify(stored(A).map((s) => s.label)) === JSON.stringify(["Home", "Mum's"]) && confirms === 0 && !!A.d.getElementById("spAdd"),
      "at three kept Add a spot gives way to the line, and Remove drops one with no confirm: " + JSON.stringify(stored(A).map((s) => s.label)));
    await close(A);
    /* ---- 9 ---- */
    A.w.localStorage.setItem("salt-spots:wxyz-abcd", JSON.stringify([{ id: "x1", label: "Other", addr: "1 Jalan Nowhere" }]));
    await sheet(A);
    const mine = list(A).map((x) => x.label);
    await close(A);
    const lock = A.d.getElementById("lock"); lock.click(); lock.click(); await A.settle();
    ok(JSON.stringify(mine) === JSON.stringify(["Home", "Mum's"]) && stored(A).length === 2 && stored(A, "salt-spots:wxyz-abcd").length === 1,
      "another username's spots are not this account's, and Log out keeps them: " + JSON.stringify({ mine, kept: stored(A).length }));
    /* ---- 10 ---- */
    const B = await page({ orders: [ord("s9", "done", ago(300))] });
    const real = B.w.Storage.prototype.getItem;
    B.w.Storage.prototype.getItem = function (k) { if (String(k).indexOf("salt-spots:") >= 0) throw new Error("SecurityError"); return real.call(this, k); };
    await sheet(B);
    const hadAdd = !!B.d.getElementById("spAdd");
    await add(B, { name: "Home", addr: "12 Jalan Veloria" });
    const once = list(B);
    ok(hadAdd && once.length === 1 && once[0].on && review(B).getAttribute("aria-disabled") !== "true",
      "a store that throws still gives Add a spot, and the spot serves this order alone: " + JSON.stringify(once));
    B.w.Storage.prototype.getItem = real;
    /* ---- 11 ---- */
    {
      const D = await page({ orders: [ord("s2", "done", ago(300))] });
      D.w.localStorage.setItem(KEY, JSON.stringify([{ id: "o1", label: "Shop", place: "Veloria", unit: "Level 2" }]));
      await sheet(D);
      const row = D.d.querySelector("#osheet .ospot .salt-option__detail");
      ok(list(D).length === 1 && list(D)[0].on && txt(row) === "Level 2, Veloria",
        "a spot kept before 11 Nov 2026 is read back with its floor and area as its address: " + txt(row));
      await close(D);
    }
  } finally { for (const p of pages) try { p.close(); } catch (e) { /* closed */ } }
}
