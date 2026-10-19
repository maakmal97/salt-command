/* test/admin-needs-5s.mjs: COUNTER ADMIN'S NEEDS AND ORDERS ARE READ EVERY 5 SECONDS (R4, his yes of 19 Oct 2026, D12 of the Live and fast plan).
 *
 * The poll that read Needs you and Orders every 30 seconds while they show now runs every 5, and a tick that finds what the last found
 * costs nothing on screen: not a card, not the line under the title, not the failure banner. A read that fails again with the same words
 * draws nothing the second time; one that gets through after a failure clears the banner. The pause while the page is hidden stands.
 * Each assertion was proved red by its own mutation (test/admin-needs-5s.mutations.json, run with tools/section.mjs).
 * Drawn by the maker harness (test/maker-act.mjs), whose page keeps every interval it is given, so a tick is called by hand. */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const ROUTES = { review: "/all/maker/review", claims: "/all/maker/claims", threads: "/all/maker/threads", hours: "/all/maker/hours", bulletin: "/all/maker/bulletin",
  inputs: "/all/maker/inputs" };

export async function run({ ok, pageWork }) {
  const open = async () => {
    const p = await richOwnerPage({ pageWork });
    await p.work.quiet();
    p.live = () => p.intervals.filter((i) => i.ms === 5000 && !i.off);
    p.tick = async () => { const t = p.live()[0]; if (t) t.f(); await p.work.quiet(); return !!t; };
    p.hide = (on) => { Object.defineProperty(p.d, "hidden", { configurable: true, get: () => on }); p.d.dispatchEvent(new p.w.Event("visibilitychange")); };
    p.watch = () => { const seen = [], mo = new p.w.MutationObserver((rs) => seen.push(...rs));
      mo.observe(p.d.body, { childList: true, subtree: true, characterData: true, attributes: true });
      return { count: () => { seen.push(...mo.takeRecords()); return seen.length; }, stop: () => mo.disconnect() }; };
    return p;
  };

  /* 1. THE INTERVAL: five seconds, on Needs you and on Orders, and none of thirty */
  let p = await open();
  try {
    ok(p.live().length === 1 && p.intervals.filter((i) => i.ms === 30000 && !i.off).length === 0,
      "Needs you sets one read, every 5 seconds, and none every 30: " + JSON.stringify(p.intervals.filter((i) => !i.off).map((i) => i.ms)));
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    ok(p.live().length === 1, "and Orders sets the same one");
    byAct(p.d, "nav.needs").click(); await p.work.quiet();
    p.hide(true);
    ok(p.live().length === 0, "a hidden page stops it");
    p.reads.length = 0;
    const ghost = p.intervals.filter((i) => i.ms === 5000).pop();
    if (ghost) ghost.f();
    await p.work.quiet();
    ok(p.reads.length === 0, "and a tick that still arrives while the page is hidden reads nothing");
    p.hide(false); await p.work.quiet();
    ok(p.live().length === 1, "and the page sets it again when it is shown");
  } finally { p.w.close(); }

  /* 2. A TICK THAT FINDS THE SAME ANSWER DRAWS NOTHING, ANYWHERE ON THE PAGE */
  p = await open();
  try {
    p.reads.length = 0;
    const w = p.watch();
    await p.tick(); await p.tick(); await p.tick();
    ok(p.reads.filter((r) => r === ROUTES.review).length === 3 && w.count() === 0,
      "three ticks on Needs you read the orders each time and change nothing on the page, the title's line included: " + w.count() + " changes");
    w.stop();
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    const w2 = p.watch();
    await p.tick(); await p.tick();
    ok(w2.count() === 0, "two ticks on Orders change nothing either: " + w2.count());
    w2.stop();
  } finally { p.w.close(); }

  /* 3. A READ THAT FAILS IS SAID ONCE; THE SAME FAILURE AGAIN DRAWS NOTHING; A READ THAT GETS THROUGH CLEARS IT */
  p = await open();
  try {
    const d = p.d, banner = () => d.getElementById("nFail");
    ok(banner().hidden === true, "(nothing is failing at the start)");
    for (const r of Object.values(ROUTES)) p.fail.add(r);
    await p.tick();
    ok(banner().hidden === false && /Couldn't read/.test(banner().textContent) && /orders and rows/.test(banner().textContent),
      "the first tick that cannot read says so at the head of the page: " + banner().textContent);
    const w = p.watch();
    await p.tick(); await p.tick();
    ok(w.count() === 0, "and the same failure at the next two ticks draws nothing: " + w.count() + " changes");
    w.stop();
    for (const r of Object.values(ROUTES)) p.fail.delete(r);
    await p.tick();
    ok(banner().hidden === true, "a tick that gets through again clears it: " + banner().textContent);
    for (const r of Object.values(ROUTES)) p.fail.add(r);
    await p.tick();
    ok(banner().hidden === false, "and a failure after that is a new one, said again");
  } finally { p.w.close(); }
}
