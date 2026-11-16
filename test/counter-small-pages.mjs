/* test/counter-small-pages.mjs: THE COUNTER'S SMALL PAGES ON AMBIENT (16 Nov 2026, the move to Ambient, place E). The guest board, the join page, the
 * sign-in link page, the one-step code screen and the remembered phone's opening each draw only the system's parts (a shell, its hero, rows, a notice,
 * fields, pills) and no class of the salt-ds layer, no style attribute and no brand or product word. The guest pages run no script of the system's.
 * Each check below is proved red by its own mutation (test/counter-small-pages.mutations.json, run with tools/section.mjs). Every code, id and price is invented. */
export async function run({ ok }) {
  const PG = await import("../stmt/page.js"), W = await import("../stmt/words.js"), O = await import("../src/orders.js");
  const { SITE_CSS } = await import("../stmt/statement-css.js");
  const { JSDOM } = await import("jsdom");
  const doc = (h) => new JSDOM(h).window.document;
  const bare = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ");
  const saltClasses = (d) => [...d.querySelectorAll("[class]")].flatMap((e) => [...e.classList]).filter((c) => /^salt-|^(gate|appmark|panel|pane|lead|gh|salt)$/.test(c));
  const visible = (h) => bare(h).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const guest = { prices: { week: { label: "16 Nov 2026" }, products: [
    { product: "salt", unit: "unit", sizes: [{ q: 0.5, price: 75 }, { q: 1, price: 120 }, { q: 12.5, price: 995 }] },
    { product: "oil", unit: "unit", sizes: [{ q: 1, price: 12 }, { q: 10, price: 105 }] }] } };

  /* ---- the guest board: a shell with a hero, a list of settings rows a book headed by its mark, one notice for the next step, no script ---- */
  const bh = PG.boardPage(guest, "nE1"), bd = doc(bh);
  const lists = [...bd.querySelectorAll(".amb-stack .gboard > .amb-settings")];
  const names = lists.map((l) => [...l.querySelectorAll(".amb-setting__name")].map((x) => x.textContent).join("/")), vals = lists.map((l) => [...l.querySelectorAll(".amb-setting__value")].map((x) => x.textContent).join("/"));
  ok(!!bd.querySelector(".amb-shell[data-mood='lagoon'] > .amb-screen > header.amb-hero h1.amb-hero__title") && bd.querySelector("h1").textContent === W.EN["board.h"]
    && (bd.querySelector(".amb-hero__sub") || {}).textContent === "For the week of 16 Nov 2026." && lists.length === 2
    && names.join("|") === "0.5 unit/1 unit/12.5 units|1 unit/10 units" && vals.join("|") === "RM 75.00/RM 120.00/RM 995.00|RM 12.00/RM 105.00",
    "the board is one Ambient shell: its hero the heading over the week, a settings list a book with each size a row and its price the row's value: " + JSON.stringify([names, vals]));
  const heads = [...bd.querySelectorAll("h2.amb-settings__head")];
  ok(heads.length === 2 && heads.every((h) => h.querySelectorAll(".amb-thumb--mark.amb-thumb--ring svg path").length === 1 && /^(Cube|Droplet)$/.test(h.getAttribute("aria-label"))) && !bd.querySelector("table, img"),
    "each list's head is the book's mark as the system's thumb, named for a reader by its shape, and the board draws no table and no picture");
  const bn = [...bd.querySelectorAll(".amb-stack > .amb-notice")];
  ok(bn.length === 2 && bn[bn.length - 1].textContent.trim() === W.EN["board.next"] && saltClasses(bd).length === 0 && !/\bstyle=/.test(bare(bh)) && !/<script/i.test(bh)
    && !O.wordsIn(visible(bh), O.PRODUCT_WORDS.concat(O.LEVEL_WORDS)).length && !/\b(salt|command|counter|desk)\b/i.test(visible(bh)),
    "the next step is the last notice, the board draws no class of the older layer or style attribute, runs no script and names no brand, product or level: " + JSON.stringify(saltClasses(bd)));
  const none = doc(PG.boardPage({ prices: {} }, "nE2"));
  ok(none.querySelector(".amb-hero__sub").textContent === W.EN["board.none"] && !none.querySelector(".gboard, .amb-settings") && none.querySelectorAll(".amb-notice").length === 1,
    "a board with no prices says so in its hero and draws no list, only the next step");

  /* ---- the join page: fields of the system, one solid Send, a notice that holds what the script says ---- */
  const jh = PG.joinPage("nE3", "abcd-efgh"), jd = doc(jh), jf = jd.getElementById("jf");
  const labels = [...jf.querySelectorAll("label.amb-field")];
  ok(!!jd.querySelector(".amb-shell > .amb-screen > header.amb-hero") && jd.querySelector("h1.amb-hero__title").textContent === W.EN["join.h"] && jd.querySelector(".amb-hero__sub").textContent === W.EN["join.p"]
    && jf.className === "amb-form" && jf.getAttribute("data-id") === "abcd-efgh" && labels.length === 2
    && labels.every((l) => l.querySelector(".amb-field__label") && l.querySelector("input.amb-input[required]") && l.querySelector(".amb-field__hint") && l.getAttribute("for") === l.querySelector("input").id)
    && jf.querySelector("button#js.amb-pill.amb-pill--block[type=submit]") && jf.querySelectorAll(".amb-pill").length === 1 && !jf.querySelector("#js").classList.contains("amb-pill--quiet"),
    "the join page is one shell: its hero, a form of two of the system's fields (a label, the input, its hint) and one solid Send");
  ok(jd.getElementById("jm").closest(".amb-notice") && jd.getElementById("jm").getAttribute("role") === "status" && !!jd.getElementById("jw") && saltClasses(jd).length === 0 && !/\bstyle=/.test(bare(jh))
    && [...jd.querySelectorAll("script")].every((s) => s.id === "jw" || s.getAttribute("nonce") === "nE3"),
    "what its script says stands in a notice, and the page carries no older class or style attribute and only its own nonced script: " + JSON.stringify(saltClasses(jd)));

  /* ---- the screens between the door and the account: shells of the system, shown by the page's own script ---- */
  const lh = PG.landingPage("abcd-efgh", "nE4", null), ld = doc(lh);
  const link = ld.getElementById("link"), code = ld.getElementById("codeBox"), opening = ld.getElementById("opening");
  const shell = (e) => !!e && e.hidden && e.classList.contains("amb-shell") && e.getAttribute("data-mood") === "lagoon" && !!e.querySelector(":scope > main.amb-screen > header.amb-hero.amb-hero--compact.amb-mesh");
  ok(shell(link) && shell(code) && shell(opening), "the link page, the code screen and the remembered phone's opening are each one hidden Ambient shell with its hero");
  const rows = [...link.querySelectorAll(".amb-settings .amb-setting")];
  ok(link.querySelector("h1.amb-hero__title").textContent === W.EN["link.h"] && link.querySelector("p#linkLead.amb-hero__sub") && rows.length === 3
    && rows.map((r) => (r.querySelector("use") || { getAttribute: () => "" }).getAttribute("href")).join() === "#amb-home,#amb-tag,#amb-doc" && link.querySelector("h2.amb-settings__head").textContent === W.EN["link.inside"],
    "the link page's hero names the app over the line that says which device it opens, and what is inside is three settings rows, each with its glyph");
  const go = link.querySelector("button#linkGo"), copy = link.querySelector("button#linkCopy"), inapp = link.querySelector("#linkInapp");
  ok(go.classList.contains("amb-pill") && !go.classList.contains("amb-pill--quiet") && copy.classList.contains("amb-pill--quiet") && copy.hidden && link.querySelectorAll(".amb-pill:not(.amb-pill--quiet)").length === 1
    && inapp.hidden && inapp.classList.contains("amb-notice--warn") && inapp.querySelector("#inappIos") && inapp.querySelector("#inappDroid").hidden && link.querySelector("p#linkOnce.amb-field__hint"),
    "Continue is the one solid pill, Copy a quiet one, and an app's own browser is told where to go in a warning notice");
  const field = code.querySelector("input#codeIn"), paste = code.querySelector("button#codePaste");
  ok(code.querySelector("h1#codeH.amb-hero__title") && code.querySelector("p#codeLead.amb-hero__sub") && paste.classList.contains("amb-pill") && !paste.classList.contains("amb-pill--quiet")
    && field.classList.contains("amb-input--code") && field.getAttribute("autocomplete") === "one-time-code" && field.closest("label.amb-field").getAttribute("for") === "codeIn" && !field.hasAttribute("maxlength")
    && code.querySelector("button#codeDoor.amb-pill--quiet") && code.querySelector("p#codeHelp.amb-basis") && code.querySelectorAll(".amb-pill:not(.amb-pill--quiet)").length === 1,
    "the code screen is one solid Paste over the system's one-time code field (one field, no length cut), the other way in a quiet pill, and the help a basis line");
  ok((opening.querySelector("h1.amb-hero__title[role=status]") || {}).textContent === W.EN["open.lead"] && opening.querySelector(".amb-chip--glass").textContent === W.EN["door.app"],
    "the remembered phone's opening is its one line in a hero under the app's name");
  const mine = [link, code, opening].map((e) => ({ salt: saltClasses(doc(e.outerHTML)), style: /\bstyle=/.test(e.outerHTML) }));
  ok(mine.every((m) => !m.salt.length && !m.style), "none of the three draws a class of the older layer or a style attribute: " + JSON.stringify(mine));

  /* ---- the code screen carried into the signed-out Sheet is the form's own box ---- */
  const css = SITE_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  ok(/\.amb-sheet #codeBox \.amb-hero \{ display: none; \}/.test(css) && /\.amb-sheet #codeBox \{ height: auto; overflow: visible;/.test(css) && /\.amb-sheet #codeBox > main \{ position: static;/.test(css),
    "in the Sheet the code screen gives up its hero and its screen height, the Sheet's title standing above it");
}
