/* 1 Nov 2026 (the surfaces pass, his word: one consistent design across Salt Desk, Salt Admin and Salt Counter): the words rule
 * of the one language (the salt-design-language skill, craft.md section 3: a button is four words at most, a verb first) on
 * the Counter's door, read off the markup as served.
 *   W1  the door's code button says what it does in four words: Use a sign-in code (it read I have a sign-in code)
 *   W2  his own page has no door, so no code button: Access is his way in
 */
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const user = { username: "0000-0000", code: "" };
  const doc = (owner) => new JSDOM(landingPage(user, "n0nce", owner, null, false)).window.document;
  const d = doc(false), b = d.getElementById("toCode"), w = b ? b.textContent.trim() : "";
  ok(w === "Use a sign-in code" && w.split(/ +/).length <= 4, "W1: the door's code button is four words, a verb first: " + JSON.stringify(w));
  const o = doc(true);
  ok(!!o.body && !o.getElementById("toCode"), "W2: his own page carries no code button");
}
