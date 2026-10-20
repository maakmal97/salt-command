/* test/admin-ac-titles.mjs: SALT ADMIN, NO PAGE TITLE DRAWN (canvas V65, his word of 20 Oct 2026: every page starts the same way). What is proved
 * here, each check red under its own mutation (test/admin-ac-titles.mutations.json):
 *   1  each of his five places keeps its heading for a reader, visually hidden, so no page draws a title and the bar is what every page starts with
 *   2  and the hidden heading is the system's own .sr, a 1px clip, never a display:none a reader skips */
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const d = new JSDOM(landingPage("", "ntitle", { master: "fixture-master", accounts: [] })).window.document;
  const hs = [...d.querySelectorAll("#roster h1")];
  ok(JSON.stringify(hs.map((h) => h.textContent)) === JSON.stringify(["Needs you", "Orders", "Customers", "Record", "Shop"]) && hs.every((h) => h.classList.contains("sr")),
    "each of his five places keeps its heading for a reader, and none is drawn: " + JSON.stringify(hs.map((h) => [h.textContent, h.className])));
  const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
  const srs = css.match(/(^|[\n}])\s*\.sr\s*\{[^}]*\}/g) || [];
  ok(srs.length >= 1 && srs.every((r) => /position:\s*absolute/.test(r) && /width:\s*1px/.test(r) && /clip:\s*rect\(0 0 0 0\)/.test(r)),
    "and every .sr the page carries clips to a pixel, which a reader still reads: " + srs.length);
}
