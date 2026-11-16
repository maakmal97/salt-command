/* test/admin-tablet.mjs: SALT ADMIN USES THE WIDTH (12 Oct 2026, Phase 6 of the Salt Admin redesign, his decision 9 of 11 Oct: "Tablet: two panes and the drawer from
 * 860 px (a landscape iPad), the app bar kept until 1080, the rail from 1080").
 *
 * jsdom applies no media query, so what is proved here is the page's own stylesheet read as rules, by query and selector, and the owner page's markup. The page's
 * measured behaviour (panes side by side from 860px, the rail from 1080px, a sticky pane's foot above the App bar, 44px targets, no sideways scroll, on both themes) is
 * the Chromium probe's, and its numbers are in the pull request. The stylesheet is the customer's too (stmt/page.js PAGE_CSS), so a rule of this phase that is not under
 * .adm is a rule the customer's page is handed. Every assertion was proved red by its own mutation (test/admin-tablet.mutations.json, run with tools/section.mjs).
 *   1  every rule of his page at 768px, 860px and below them is under .adm (the customer's own tablet rules come before his and are test/counter-tablet.mjs's)
 *   2  Needs you and Customers: the list beside the account from 860px, the account sticky and scrolling inside itself, its foot above the App bar to 1080px
 *   3  nothing opens by itself: the column beside the list says Choose a card to see it in full, and is drawn only while no account is open
 *   4  Sheets: a centred 560px dialog from 768px, the 460px drawer from 860px, placement only     5  a 620px column and short fields two up from 768px
 *   6  from 1080px Shop is 760px, the rows to approve lie two up, Messages stands the thread beside its list
 *   7  Shop's hours fit a phone of 320 to 371px
 * Every code, name and amount is invented. */
import { JSDOM } from "jsdom";
import { richOwnerPage, byAct, drawEverything } from "./maker-act.mjs";
import { landingPage, SITE_STYLE } from "../stmt/page.js";
import { SITE_CSS, AMB_CSS } from "../stmt/statement-css.js";

/* the owner page's own stylesheet, read as rules, by query (spaces taken out) and selector (a list is written "a,b"). It starts where PAGE_CSS says the owner page's rules begin: what
   comes before is the customer's, which has its own rules at 768px and 860px (test/counter-tablet.mjs) */
const OWNER_MARK = "EVERY RULE FROM HERE TO THE GUEST LINK IS THE OWNER PAGE'S";
export function ownerCss() {
  const html = landingPage("", "tablet-nonce", { master: "fixture-master", accounts: [] });
  /* 16 Nov 2026, the move to Ambient (end pass): PAGE_CSS is empty and the marker of where his rules began went with it; the page's layer is the site's layer, read whole (SITE_CSS) */
  const css = SITE_CSS, from = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].length === SITE_STYLE.length ? css.length : 0;
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const sel = (r) => r.selectorText.replace(/\s*,\s*/g, ",");
  const media = [...sheet.cssRules].filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].map((x) => ({ sel: sel(x), css: x.style.cssText })) }));
  const at = (q, s) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => r.sel === s).map((r) => r.css).join(" ");
  const top = (s) => [...sheet.cssRules].filter((r) => r.selectorText && sel(r) === s).map((r) => r.style.cssText).join(" ");
  return { html, media, at, top, from };
}

export async function run({ ok, pageWork }) {
  const { html, media, at, top, from } = ownerCss();
  const d = new JSDOM(html).window.document;

  /* 1. EVERY RULE AT THE TABLET WIDTHS IS UNDER .adm */
  {
    const fam = media.filter((m) => /(^|[^0-9.])(768|860)px|(767|859|371)\.98px/.test(m.q));
    const sels = fam.flatMap((m) => m.rules.map((r) => r.sel));
    const loose = sels.filter((s) => s.split(",").some((x) => !/\.adm\b/.test(x)));
    ok(from > 0 && !loose.length,   /* 16 Nov 2026, the end pass: no rule is left at the tablet widths (the Sheets' placement went with Ambient's 480px card), so what holds is that none comes back outside .adm */
      "every rule of his page at 768px, 860px, 372px and the widths below them is under .adm, which the customer's page shares this stylesheet without (the rules before the one that marks where his begin are the customer's own, test/counter-tablet.mjs): "
        + sels.length + " rules, outside .adm: " + (loose.join(" | ") || "none") + ", the layer read: " + (from > 0));
  }

  /* 2. NEEDS YOU AND CUSTOMERS: A LIST AND A DETAIL FROM 860px */
  {
    /* 16 Nov 2026, the move to Ambient (place H): Customers is Ambient's two panes (the list and the open account); Needs you's card is drawn by place F */
    ok(d.querySelector("#oAccts > .asplit").classList.contains("amb-split--panes") && !at("(min-width:860px)", ".adm .asplit") && !at("(min-width:860px)", ".adm #aopen"),
      "Customers' list and account are Ambient's two panes, the page keeping no rule of its own for them");
    const css = SITE_STYLE.replace(/\s+/g, " ");
    ok(/@container amb \(min-width: 960px\) \{ \.aback \{ display: none; \} \}/.test(css) && /@container amb \(max-width: 959px\) \{ #oAccts\.open \.afind, #oAccts\.open #rlist,[^}]*display: none; \}/.test(css),
      "from 960px the way back is not drawn; below it an account open takes the list's place");
    ok(/@media \(max-width: 959px\) \{ #nrecord:not\(:has\(> #nopen:not\(\[hidden\]\)\)\) \{ display: none; \} \}/.test(SITE_CSS), "Needs you draws no column for a card that is not open, below 960px");
    const rail = media.filter((m) => /1080px|1079[.]98px/.test(m.q) && !/860px/.test(m.q)).flatMap((m) => m.rules.map((r) => r.sel)).filter((s) => /nopen|aopen|nsplit|asplit|oAccts/.test(s));
    ok(!rail.some((s) => /aopen|asplit|oAccts/.test(s)), "Needs you's pane waits for nothing at 1080px, and the page keeps no Customers rule there: " + (rail.join(" | ") || "none"));
  }

  /* 3. NOTHING OPENS BY ITSELF: TAP A CARD */
  {
    ok(/\.panenone \{ display: none; margin: 0;/.test(SITE_CSS) && /@media \(min-width: 960px\) \{ \.panenone \{ display: block; \} #nopen:not\(\[hidden\]\) ~ \.panenone \{ display: none; \} \}/.test(SITE_CSS),
      "the invitation is not drawn on a phone, drawn beside the list from 960px (Ambient's split), and not drawn beside a card that is open");
    const kids = (id) => [...d.getElementById(id).parentElement.children].map((c) => c.id || c.className).join("|");
    const words = [...d.querySelectorAll(".panenone")].map((p) => p.textContent);
    /* 2 Nov 2026 (Customers on the canvas): Customers' column holds the list and the account's pane and no invitation, so the table takes the width until an account is open */
    ok(kids("nopen") === "nopen|rnone panenone" && kids("aopen") === "anone|aopen" && words.length === 1 && words.every((w) => w === "Choose a card to see it in full."),
      "Needs you's column holds the list, the card's pane and then the invitation, which says Choose a card to see it in full, and Customers' holds the list and the account's pane alone: " + kids("nopen") + " , " + kids("aopen") + " " + JSON.stringify(words));
  }

  /* 4. SHEETS (16 Nov 2026, the move to Ambient, end pass): his Sheets are Ambient's, and from 720px a Sheet is Ambient's 480px card in the middle of the window (0.7.7);
     the 560px dialog and the 460px drawer of 12 Oct 2026 went with the salt-ds sheet, and the page writes no placement, colour or surface for a Sheet */
  {
    const flat = AMB_CSS.replace(/\s+/g, " ");
    ok(/@media \(min-width: 720px\) \{[^@]*?\.amb-sheet \{ inset: 0; height: fit-content; max-width: 480px;/.test(flat),
      "from 720px a sheet is Ambient's card, 480px at most, in the middle of the window");
    const sheetRules = [...new JSDOM("<style>" + SITE_CSS + "</style>").window.document.styleSheets[0].cssRules].flatMap((r) => (r.cssRules ? [...r.cssRules] : [r])).filter((r) => r.selectorText && /asheet|amb-sheet|salt-sheet/.test(r.selectorText));
    ok(!sheetRules.some((r) => /asheet|salt-sheet/.test(r.selectorText)), "the page keeps no rule for a Sheet of his: none names .asheet or the older sheet, whatever the width: " + sheetRules.map((r) => r.selectorText).join(" | "));
    ok(!sheetRules.some((r) => /(^|;)\s*(background|color|border|box-shadow|font)/.test(";" + r.style.cssText)), "and none of the site's rules for a Sheet writes a colour, a type or a surface");
    const mine = (h) => new JSDOM(h).window.document;
    /* 15 Nov 2026, the move to Ambient: the look's choice Sheet is gone from both pages (light and dark follow the device) */
    const lone = mine(landingPage("", "n", null));
    const own = (e) => !!e && e.classList.contains("amb-sheet") && e.classList.contains("asheet");   /* 16 Nov 2026: .adm went with the rules that read it */
    ok(own(d.getElementById("vaultSheet")) && !d.getElementById("lookSheet") && !lone.getElementById("lookSheet") && !lone.getElementById("vaultSheet"),
      "the unlock sheet of Salt Admin is Ambient's sheet and carries .asheet, the customer's page draws none, and neither draws a look Sheet: " + d.getElementById("vaultSheet").className);
    const p = await richOwnerPage({ pageWork });
    try {
      await p.work.quiet();
      const page = p.d, tap = async (act, key) => { const c = byAct(page, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
      await tap("nav.orders"); await tap("order.open", "ord-p1"); await tap("order.decline", "ord-p1");
      const yn = page.getElementById("ynSheet");
      ok(!!yn && yn.tagName === "DIALOG" && yn.classList.contains("amb-sheet") && own(yn), "the sheet that asks Yes or No on Salt Admin is Ambient's sheet and carries .asheet: " + (yn && yn.className));
      await tap("order.ask-keep", "ord-p1");
      await tap("nav.customers"); await tap("part.customers.accounts"); await tap("acct.open", "abcd-efgh"); await tap("acct.show-code");
      const ho = page.querySelector("dialog.amb-sheet.ho");
      ok(!!ho && !!ho.querySelector(".amb-codeframe__field > svg.amb-codeframe__code"), "the sheet that shows a sign-in code is the system's dialog, its code in the code frame: " + (ho && ho.className));
    } catch (e) { ok(false, "the sheets stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }

  /* 5. A PORTRAIT TABLET, 768 to 859px: a 620px column, a form's short fields two up, cards and rows one column */
  {
    const q = "(min-width:768px)and(max-width:859.98px)";
    const col = at(q, ".gate.adm"), grid = at(q, ".adm .maker-input"), full = at(q, ".adm .maker-input>*"), short = at(q, ".adm .maker-input>.maker-field--short");
    /* 15 Nov 2026, the move to Ambient: his shell is Ambient's, which lays itself out by its own width; the page no longer sizes a column there */
    ok(!col && !at(q, "#roster") && !at(q, ".adm"), "from 768 to 859px the page sizes no column of its own, the shell laying itself out: " + col);
    /* 16 Nov 2026, the move to Ambient (place I): a Record form is Ambient's stack of fields, one column; the page lays none out */
    ok(!grid && !full && !short, "a form is Ambient's stack of fields there, the page laying out no column of its own: " + [grid, full, short].join(" | "));
    const rules = media.filter((m) => m.q === q).flatMap((m) => m.rules.map((r) => r.sel));
    ok(!rules.filter((s) => /need|nlist|ordrow|ordlist|makerOrderList|nopen|aopen/.test(s)).length && !at("(min-width:860px)", ".adm .maker-input"),
      "Needs you cards and order rows keep one column there, and a form beside its menu from 860px keeps its own: " + rules.join(" | "));
    const p = await richOwnerPage({ pageWork });
    try {
      await p.work.quiet();
      const page = p.d, tap = async (act, key) => { const c = byAct(page, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
      await tap("nav.record");
      /* 27 Oct 2026 (Record's forms as settings rows): a Record form's fields are rows of its lists (settings rows, full width, none marked short), so what the mark and the two-up rule cover is the fields that keep their label above them,
         the cards' and sheets' (drawn here by drawEverything); the form itself is held to its rows */
      const record = [];
      for (const [part, slug] of [["entry", "sale-or-purchase"], ["customers", "new-customer"]]) {
        await tap("part.record." + part); await tap("record.form", slug);
        const form = page.querySelector('section.maker-input[data-form="' + slug + '"]');
        if (form) record.push(form);
      }
      const rowsOk = record.length === 2 && record.every((f) => ![...f.children].some((c) => c.matches("label.maker-field")) && f.querySelectorAll(":scope > label.amb-field, :scope > div.amb-field").length >= 5
        && !f.querySelector(".maker-field--short"));
      const every = await richOwnerPage({ pageWork, slip: true, probe: true });
      let fields = [];
      try { await drawEverything(every); fields = [...every.d.querySelectorAll("label.maker-field")].filter((f) => !f.closest("#makerInputs")); } finally { every.w.close(); }
      const kind = (f) => (f.querySelector("input,select") || { type: "" }).type, SHORT = ["number", "date", "time"];
      const marked = fields.filter((f) => f.classList.contains("maker-field--short")), others = fields.filter((f) => !f.classList.contains("maker-field--short"));
      /* v1377: Order for them's own box, the one form outside Record with a marked field and a text field, is gone (it opens their page), so
         what holds is that any field marked short is a number, a date or a time */
      ok(rowsOk && marked.every((f) => SHORT.includes(kind(f))) && !others.some((f) => f.classList.contains("maker-field--short")),   /* the cards also hand-build a few number fields that carry no mark */
        "the sale and new customer forms are Ambient's fields with no field marked short, and the fields that keep their label above mark the short ones, a number, a date or a time, and no other text or select field: " + rowsOk + " " + JSON.stringify(fields.map((f) => [kind(f), f.classList.contains("maker-field--short")])));
    } catch (e) { ok(false, "the form stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  }

  /* 6. FROM 1080px, THE LAPTOP: Shop is one column of 760px, the rows to approve lie two up, and Messages stands the thread beside the thread list */
  {
    const q = "(min-width:1080px)";
    const shop = at(q, ".adm #oShop");
    ok(!shop, "from 1080px the page sizes no Shop column (Ambient's panes lay it out): " + shop);
    /* 16 Nov 2026, the move to Ambient (place F): the rows to approve are Ambient's stack (one column, the gutter the stack's), the page keeping no width or grid of its own for them */
    ok(!at(q, ".adm #makerDrafts") && !at(q, ".adm #oOrders>.abody>#oApprove") && /\.apstack \{ display: grid; gap: var\(--amb-space-3\); \}/.test(SITE_CSS) && !!d.querySelector("#oApprove.amb-stack #makerDrafts.apstack"),
      "and the rows to approve are Ambient's stack, a card one under the other, the page setting no width or grid for them");
    /* 16 Nov 2026, the move to Ambient (place H): Messages is a notice over Ambient's two panes, the threads and the open thread, the page keeping no rule of its own for them */
    ok(!at(q, ".adm .chatgrid") && !at(q, ".adm #makerChatList") && !at(q, ".adm #makerChatOpen") && !!d.querySelector('[data-in="customers.messages"] > .amb-split--panes'),
      "Messages' threads and thread are Ambient's two panes, and the page writes no column of its own for them");
    const sec = d.querySelector('[data-in="customers.messages"]');
    ok(!!sec && sec.classList.contains("chatgrid") && [...sec.querySelectorAll("#makerChatList, #chatside, #makerChatOpen")].map((c) => c.id).join() === "makerChatList,chatside,makerChatOpen" && sec.querySelector("#makerChatOpen").hidden,
      "the thread list and the thread are two panes of one place, the thread empty until a tap");
    const p = await richOwnerPage({ pageWork });
    try {
      await p.work.quiet();
      const page = p.d, tap = async (act, key) => { const c = byAct(page, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
      await tap("nav.customers"); await tap("part.customers.messages");
      const room = page.getElementById("makerChatOpen"), before = room.hidden && room.textContent === "";
      await tap("chat.open", "abcd-efgh");
      ok(before && !room.hidden && room.getAttribute("data-key") === "abcd-efgh" && !!room.closest('[data-in="customers.messages"]') && !page.querySelector("dialog[open]"),
        "a thread opens in its own place in the section, beside the list from 1080px and never in a Sheet, and nothing was open before the tap: " + [before, room.hidden, room.getAttribute("data-key")]);
    } catch (e) { ok(false, "Messages stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }

  /* 7. SHOP'S HOURS FIT A PHONE OF 320px (20 Oct 2026, canvas V63): the week chart's row is the day's name, a track that takes what is left and the
     times, so a 288px column holds it with room for the track; the table and its narrow-phone rules are gone */
  {
    const row = (html.match(/\.amb-week__day \{[^}]*?grid-template-columns: ([^;]*);/) || [])[1] || "";
    ok(/minmax\(0(px)?, ?1fr\)/.test(row) && /var\(--amb-week-name\)/.test(row) && !/maker-hours/.test(html) && !/[.]maker-day[{ ,.:]/.test(html),
      "the week of spans takes its name column from Ambient's token and gives its bar what is left, so a 288px column holds it with room for the bar, and the table's rules are gone: " + row);
  }
}
