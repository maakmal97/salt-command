/* test/admin-place-drafts.mjs: THE PLACE DRAFTS HOLD NO PLAIN PLACES MAP, AND THE LOCK LETS ALL THREE GO (Phase 4c of the Salt Account redesign, 12 Oct 2026;
 * Fable's note on #146; docs/STATEMENTS.md "The one unlock").
 *
 * Add ID, Amend ID and Place on the map each keep the last pair of sealed maps they prepared as a draft, so a second tap seals nothing twice. A prepared pair carries the
 * places map in plain text (placeMap) until the form strips it. Place on the map read it, then asked the gazetteer for a locality (an await) and stripped it only on the way
 * that reached the send, so a place that is not on the list left the plain map in the draft. It is stripped in a finally now, and the lock (a page hidden, ended(), a
 * lapse, Lock) lets all three drafts go with the keys. Each check is red under its own mutation (test/admin-place-drafts.mutations.json, run with tools/section.mjs).
 *   A  each form lists its draft with the page, three in all
 *   B  a tap that fails after the pair is prepared leaves a draft with no plain places map in it, Place on the map's included (its locality is not on the list)
 *   C  the lock (Lock, and a page hidden) lets all three drafts go, having held them until then
 * Drawn by the maker harness (test/maker-act.mjs), which seals the invented names, places and slip key under one invented password. */
import { richOwnerPage, byAct, slipFixture, unlockPage } from "./maker-act.mjs";

export async function run({ ok, pageWork }) {
  const fix = await slipFixture();
  const open = async () => {
    const p = await richOwnerPage({ pageWork, slip: true, probe: true });
    await p.work.quiet();
    p.form = (title) => [...p.d.querySelectorAll("#makerInputs section.maker-input")].find((s) => s.querySelector("h3").textContent === title) || null;
    p.send = async (form, act) => { byAct(form, act).click(); await p.work.quiet(); };
    /* the three drafts as the page lists them: null when a form holds none, else the keys of the prepared pair it holds */
    p.drafts = () => JSON.parse(p.w.__owner("JSON.stringify(pairDrafts.map(function(d){ var x=d.draft(); return x?Object.keys(x).sort():null; }))"));
    return p;
  };
  /* a page unlocked, with each of the three forms tapped once and refused after its pair was prepared: the Desk refuses Add ID and Amend ID, and Place on the map's locality is not on the list */
  const held = async () => {
    const p = await open();
    await p.work.quiet();
    p.d.querySelector('[data-act="nav.record"]').click(); await p.work.quiet();
    p.d.querySelector('[data-act="part.record.customers"]').click(); await p.work.quiet();
    await unlockPage(p.w, p.work, fix.pass);
    const add = p.form("New customer"), amend = p.form("Change a name or place"), place = p.form("Place on the map");
    p.refuse["/all/maker/inputs/add-id"] = "The Desk is busy."; p.refuse["/all/maker/inputs/amend-id"] = "The Desk is busy.";
    p.type(byAct(add, "record.add-id.name"), "Zed Tester");
    await p.send(add, "record.add-id.send");
    p.type(byAct(amend, "record.amend-id.party"), "CX1-ZED"); p.type(byAct(amend, "record.amend-id.name"), "Amended Tester"); p.type(byAct(amend, "record.amend-id.place"), "Pudu");
    await p.send(amend, "record.amend-id.send");
    p.type(byAct(place, "record.place.party"), "CX1-ZED"); p.type(byAct(place, "record.place.locality"), "Nowhere Special");
    await p.send(place, "record.place.send");
    p.said = { add: add.textContent, amend: amend.textContent, place: place.textContent };
    return p;
  };

  /* A and B. THE DRAFTS, AS A FAILED TAP LEAVES THEM */
  let p = await held();
  try {
    const got = p.drafts();
    ok(got.length === 3, "Add ID, Amend ID and Place on the map each list their draft with the page, three in all: " + got.length);
    ok(/The Desk is busy[.]|could not do that/.test(p.said.add) && /The Desk is busy[.]|could not do that/.test(p.said.amend) && /not on the list/.test(p.said.place)
      && p.posts.some((x) => /add-id$/.test(x.route)) && p.posts.some((x) => /amend-id$/.test(x.route)) && !p.posts.some((x) => /[/]place$/.test(x.route)),
    "each tap got as far as it can: the Desk refused Add ID and Amend ID after the pair was prepared, and Place on the map stopped at a locality that is not on the list, sending nothing: " + JSON.stringify(p.said).slice(0, 400));
    ok(got.every((x) => x && x.includes("names") && x.includes("places") && x.includes("base") && x.includes("desired")),
      "each form holds the pair it prepared (the sealed maps and the base and desired a retry reads), so what follows is not vacuous: " + JSON.stringify(got));
    ok(got.every((x) => x && !x.includes("placeMap")),
      "and none holds the plain places map, Place on the map's included, whose locality failed after the pair was prepared: " + JSON.stringify(got));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* C. THE LOCK LETS ALL THREE GO */
  for (const [name, trigger] of [
    ["Lock in Shop", async (q) => { q.d.getElementById("vaultOff").click(); }],
    ["a page hidden", async (q) => { Object.defineProperty(q.d, "hidden", { configurable: true, get: () => true }); q.d.dispatchEvent(new q.w.Event("visibilitychange")); }]
  ]) {
    p = await held();
    try {
      const was = p.drafts();
      await trigger(p); await p.work.quiet();
      const now = p.drafts();
      ok(was.length === 3 && was.every(Boolean) && now.length === 3 && now.every((x) => x === null),
        name + " lets all three drafts go, having held them until then: " + JSON.stringify([was.map(Boolean), now]));
      ok(p.d.getElementById("vaultState").textContent === "Locked", name + " locked the page, so what was cleared went with the keys");
    } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }
}
