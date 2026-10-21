/* test/jsdom-fast.mjs: tools/jsdom-fast.mjs keeps what document.<name> answers (21 Oct 2026, the suite's speed).
 *
 * The patch keeps jsdom's named-element map through insertions and removals of elements that cannot be in it. Every road a
 * named element has into or out of the map is driven here and read back through `document`, which is where the patch could
 * go wrong: a form or img arriving, deep in a subtree or alone; leaving; moving; an id or a name set on one in place; and a
 * name that overrides a builtin, which only a stale map would miss. */
import { JSDOM } from "jsdom";
import { JSDOM_MODE } from "../tools/payload.mjs";

export async function run({ ok }) {
  ok(JSDOM_MODE === "fast" || JSDOM_MODE === "check", "the suite runs with the named-element patch in place: " + JSDOM_MODE);
  const { window: w } = new JSDOM("<!doctype html><body><div id=host><p>text</p></div></body>");
  const d = w.document, host = d.getElementById("host");
  try {
    const seen = (n) => d[n];
    ok(seen("pay") === undefined, "no element is named pay at the start");
    for (let i = 0; i < 50; i++) host.appendChild(d.createElement("span"));
    ok(seen("pay") === undefined, "and fifty spans added leave it so");
    const f = d.createElement("form"); f.setAttribute("name", "pay");
    const box = d.createElement("section"); box.appendChild(d.createElement("div")).appendChild(f);
    host.appendChild(box);
    ok(seen("pay") === f, "a form named pay, deep in a subtree added in one move, is document.pay");
    for (let i = 0; i < 20; i++) host.appendChild(d.createElement("em"));
    ok(seen("pay") === f, "and stays it while other elements come");
    const img = d.createElement("img"); img.setAttribute("name", "pay"); host.appendChild(img);
    const two = seen("pay");
    ok(two && two.length === 2 && two[0] === f && two[1] === img, "a second element named pay makes it a collection of both, in tree order");
    img.remove();
    ok(seen("pay") === f, "the img removed, it is the form again");
    box.remove();
    ok(seen("pay") === undefined, "the subtree holding the form removed, nothing is named pay");
    host.insertBefore(box, host.firstChild);
    ok(seen("pay") === f, "the same subtree put back, it is again");
    f.setAttribute("name", "paid");
    ok(seen("pay") === undefined && seen("paid") === f, "a name changed in place moves it to the new name");
    const o = d.createElement("object"); o.id = "getElementById"; host.appendChild(o);
    ok(seen("getElementById") === o, "an object with the id getElementById overrides the builtin, as the standard says it must");
    o.remove();
    ok(typeof d.getElementById === "function" && d.getElementById("host") === host, "and removed, the builtin answers again");
    host.innerHTML = "<iframe name='x'></iframe><b></b>";
    ok(seen("paid") === undefined, "innerHTML replacing everything takes the form out of the map");
    ok(seen("x") === host.querySelector("iframe").contentWindow, "and the iframe it brings in answers with its window");
  } finally { w.close(); }
}
