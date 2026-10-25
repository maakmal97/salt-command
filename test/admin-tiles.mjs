/* test/admin-tiles.mjs: THE FEW, FIXED CHOICES OF A FORM ARE OPTION TILES (Phase 4a of the Salt Admin redesign, 12 Oct 2026; docs/STATEMENTS.md "Record's forms").
 *
 * Where a Record form once asked for a book, a direction, a handover, a kind, a role, a level or a length of time in a <select>, it asks in the system's Option
 * tiles (stmt/owner.js, makerTiles): a fieldset whose legend is the field's label and a real radio in each tile, so the group is one tab stop, the arrows move the
 * choice and a tile is 44px. A party, a row or a loan, a list as long as the book, stays a select. What a form sends is the value it always sent. What is proved
 * here, each check red under its own mutation (test/admin-tiles.mutations.json, run with tools/section.mjs):
 *   1  the groups: which choices are tiles, in which form, offering which values, with which chosen, each radio carrying the select's act keyed by its value
 *   2  a tile is the control: the radio is the recipe's own (it covers its tile, the face is 44px high), one choice at a time, none disabled, none out of the tab order
 *   3  a tap moves the choice and a group drawn again keeps it while it is offered; a group in a shut form (a supplier's level) shuts every tile
 *   4  each tile, tapped and sent through the form's own button, puts the value its select did into the body of the request the form always sent
 * Drawn by the maker harness (test/maker-act.mjs), whose inputsAnswer says what Record's forms are told. */
import { richOwnerPage, byAct, tile, tileGroup, tileValue, tileValues } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* what Record's forms are told, widened so every kind of choice is on offer: a row of each direction, a correction of each kind of value, a second associate */
function told(j) {
  j.catalog.rows = [{ rid: "row-1", party: "CX1-ZED", product: "salt", date: "2026-09-01", qty: 2, total: 200, direction: "SELL" },
    { rid: "row-2", party: "SX1-ZED", product: "oil", date: "2026-09-02", qty: 3, total: 90, direction: "BUY" }];
  j.catalog.correctionFields = [{ field: "qty", kind: "number", required: true }, { field: "unpriced", kind: "boolean", required: true },
    { field: "stream", kind: "stream", required: false }, { field: "handover", kind: "handover", required: false },
    { field: "product", kind: "product", required: true }, { field: "party", kind: "code", required: true }];
  j.catalog.appointmentKinds = [{ kind: "reseller", stream: "R2" }, { kind: "referral", stream: "R3" }];
  j.catalog.appointmentCustomers = ["CX1-ZED", "CX2-ZED"];
  j.catalog.associates = [{ code: "CA1-ZED", resaleReady: true }];
  j.catalog.tips = [{ id: "dup:tip1", title: "A tip", hush: null }];
  return j;
}

/* the groups the page draws: legend, act, and the values offered in order, with the one chosen ("" first when it is the empty value, none when none is) */
const GROUPS = [
  ["Stock count", "Book", "record.count.book", ["salt", "oil"], "salt"],
  ["Sale or purchase", "Sale or purchase", "record.trade.direction", ["sale", "purchase"], "sale"],
  ["Sale or purchase", "Book", "record.trade.book", ["salt", "oil"], "salt"],
  ["Sale or purchase", "Handover", "record.trade.handover", ["", "collected", "delivered"], ""],
  ["Sale or purchase", "Through an associate?", "record.trade.stream", ["", "R2", "R3"], ""],
  ["Loan", "Goods or cash", "record.loan.form", ["salt", "cash"], "salt"],
  ["Loan", "Direction", "record.loan.direction", ["in", "out"], "in"],
  ["Loan", "Book", "record.loan.book", ["salt", "oil"], "salt"],
  ["Gift", "Book", "record.gift.book", ["salt", "oil"], "salt"],
  ["Gift", "Handover", "record.gift.handover", ["", "collected", "delivered"], ""],
  ["Correct a row", "What to do", "record.amend.kind", ["Correction", "Fulfilment", "Cancellation"], "Correction"],
  ["New customer", "Role", "record.add-id.role", ["customer", "supplier", "reseller", "referral", "downstream", "bucket"], "customer"],
  ["New customer", "Starting %, salt", "record.add-id.drift", ["", "0.25", "typed"], ""],
  ["Make an associate", "As", "record.appoint.role", ["reseller", "referral"], null],
  ["Printed sizes", "Book", "record.house.book", ["salt"], "salt"],
  ["Desk reminders", "Hide for", "record.tip.for", ["7", "30", ""], "7"]
];

/* a form's own button tapped: the body of the one request it sent to the route, or null when it sent none or more than one */
async function sends(p, route, section, act) {
  const before = p.posts.filter((x) => x.route === route).length;
  byAct(section, act).click(); await p.work.quiet();
  const all = p.posts.filter((x) => x.route === route);
  return all.length === before + 1 ? all.at(-1).body : null;
}

export async function run({ ok, pageWork }) {
  const open = async () => {
    const p = await richOwnerPage({ pageWork, inputsAnswer: told });
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.form = (name) => [...p.d.querySelectorAll("#makerInputs section.maker-input")].find((s) => s.querySelector("h3").textContent === name) || null;
    p.type = (control, value) => { control.value = value; control.dispatchEvent(new p.w.Event("input", { bubbles: true })); control.dispatchEvent(new p.w.Event("change", { bubbles: true })); };
    p.post = (route) => (p.posts.filter((x) => x.route === route).at(-1) || {}).body;
    await p.tap("nav.record");
    return p;
  };

  /* 1. THE GROUPS */
  let p = await open();
  try {
    const bad = [];
    const found = [...p.d.querySelectorAll("#makerInputs fieldset.maker-tiles")];
    for (const [form, label, act, values, chosen] of GROUPS) {
      const section = p.form(form), group = section && tileGroup(section, label);
      if (!group) { bad.push(form + " / " + label + " (no group)"); continue; }
      const radios = [...group.querySelectorAll("input")];
      const got = [radios.map((r) => r.value), (radios.find((r) => r.checked) || { value: null }).value];
      const keys = radios.map((r) => r.getAttribute("data-key"));
      if (!(same(got, [values, chosen]) && radios.every((r) => r.type === "radio" && r.getAttribute("data-act") === act) && new Set(keys).size === keys.length
        && group.tagName === "FIELDSET" && group.closest("section") === section && !!group.querySelector("legend")))
        bad.push(form + " / " + label + " " + JSON.stringify(got));
    }
    ok(bad.length === 0 && found.length === GROUPS.length,
      "each of the " + GROUPS.length + " few, fixed choices of the forms is a group of tiles in its own form, offering its values in order with the one a select began on chosen (none for the appointment's role), "
        + "and no other group is drawn: " + JSON.stringify(bad) + " " + found.length);
    const keyed = tileGroup(p.form("New customer"), "Starting %, salt").querySelectorAll("input");
    ok(same([...keyed].map((r) => r.getAttribute("data-key")), ["salt-none", "salt-0.25", "salt-typed"]),
      "a group drawn once for each book keys its tiles by the book first, the empty value 'none': " + [...keyed].map((r) => r.getAttribute("data-key")).join());
    const parties = ["record.trade.party", "record.trade.associate", "record.trade.end-customer", "record.loan.party", "record.gift.party", "record.repay.loan", "record.amend.row",
      "record.amend.field", "record.revive.row", "record.add-id.parent", "record.appoint.customer", "record.amend-id.party", "record.place.party", "record.tip.tip"];
    const stay = parties.filter((act) => { const c = byAct(p.d, act); return !c || c.tagName !== "SELECT"; });
    ok(stay.length === 0, "a party, a row, a loan, a field or a reminder, a list as long as the book, stays a select: " + JSON.stringify(stay));
    const legends = found.map((g) => g.querySelector("legend")).filter(Boolean);
    ok(legends.length === found.length && legends.every((l) => l.classList.contains("salt-options__legend") && l.classList.contains("lbl") && l.textContent.length > 0)
      && found.every((g) => g.classList.contains("salt-options")),
    "each group is the system's Options fieldset, named by a legend in the form's own label style");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 2. A TILE IS THE CONTROL */
  p = await open();
  try {
    const radios = [...p.d.querySelectorAll("#makerInputs fieldset.maker-tiles input")];
    const names = new Map();
    for (const r of radios) { const g = r.closest("fieldset"); names.set(r.name, new Set([...(names.get(r.name) || []), g])); }
    ok(radios.length > 30 && [...names.values()].every((gs) => gs.size === 1) && radios.every((r) => !!r.name && /^tiles[0-9]+$/.test(r.name)),
      "every group is one radio group of its own, so it is one tab stop and the arrows move the choice: " + radios.length + " tiles in " + names.size + " groups");
    ok(radios.every((r) => !r.disabled && r.getAttribute("tabindex") === null && r.closest("label.salt-option") && r.nextElementSibling && r.nextElementSibling.classList.contains("salt-option__face")
      && (r.nextElementSibling.querySelector(".salt-option__label") || { textContent: "" }).textContent.length + (r.nextElementSibling.querySelector("svg.psym") ? (r.nextElementSibling.querySelector(".sr") || { textContent: "" }).textContent.length : 0) > 0),
    "each tile is a radio in the recipe's own label, followed by its face (its words, or for a book its mark, told to a reader by its shape), in the tab order and not disabled");
    const books = radios.filter((r) => r.nextElementSibling.querySelector("svg.psym"));
    ok(books.length >= 8 && books.every((r) => !r.nextElementSibling.querySelector(".salt-option__label") && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(r.nextElementSibling.querySelector(".sr").textContent)
      && r.nextElementSibling.textContent.replace(r.nextElementSibling.querySelector(".sr").textContent, "").replace(/[A-Z]/g, "").trim() === ""),
    "a book's tile is its mark alone: no label, no word for the book, the shape told to a reader (" + books.length + " tiles)");
    const markGrids = new Set(books.map((r) => r.closest(".salt-options__grid")));
    ok([...markGrids].every((g) => g.classList.contains("maker-marks") && !g.classList.contains("salt-options__grid--2"))
      && radios.filter((r) => r.closest(".maker-marks")).every((r) => r.nextElementSibling.querySelector("svg.psym")),
    "a group of marks alone is laid compact (maker-marks), never two wide boxes across with a mark in a corner, and only marks are: " + markGrids.size + " groups");
    /* Their % left Record on 26 Oct 2026 (a stepper on the account card): Record draws no form for it, and the one typed % field left, Add ID's, still takes a negative with no decimal pad */
    const driftField = byAct(p.d, "record.add-id.drift-value");
    ok(!p.d.querySelector('[data-act^="record.drift"]') && driftField && driftField.min === "-0.3" && driftField.max === "0.3" && driftField.getAttribute("inputmode") === null
      && [...p.d.querySelectorAll("#makerInputs input[type=number]")].filter((f) => f !== driftField && f.min === "0").every((f) => f.getAttribute("inputmode") === "decimal"),
      "Record draws no Their % form, the typed starting % takes a negative and no decimal pad (a negative needs the minus key, which a decimal pad lacks on an iPhone); the other number fields keep the decimal pad");
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.salt-option__face\s*\{[^}]*min-height:\s*var\(--salt-tap\)/.test(css) && /--salt-tap:\s*44px/.test(css)
      && /\.salt-option__input\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/.test(css),
    "the recipe makes the face 44px high and lays the radio over the whole tile, so a tile is 44px in both dimensions and the tile is the hit area");
    ok(/\.adm \.maker-marks\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(88px,\s*1fr\)\)/.test(css) && /\.adm \.maker-marks \.salt-option__face\s*\{[^}]*justify-content:\s*center/.test(css),
      "a group of marks lays tiles 88px and over, as many as fit, each mark centred in its tile");
    ok(/\.adm \.maker-tiles\s*\{[^}]*flex:\s*1 1 100%[^}]*min-width:\s*0/.test(css),
      "a group fills the row of its form's flex layout and may shrink, so its tiles wrap inside a narrow pane instead of widening it");
    const group = tileGroup(p.form("Sale or purchase"), "Handover");
    tile(p.form("Sale or purchase"), "Handover", "collected");
    const one = [...group.querySelectorAll("input")].filter((r) => r.checked).map((r) => r.value);
    tile(p.form("Sale or purchase"), "Handover", "delivered");
    ok(same(one, ["collected"]) && same([...group.querySelectorAll("input")].filter((r) => r.checked).map((r) => r.value), ["delivered"]) && group.value === "delivered",
      "one tile is chosen at a time, and the group answers .value as the select did: " + group.value);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3. A TAP, A GROUP DRAWN AGAIN, A SHUT GROUP */
  p = await open();
  try {
    const trade = p.form("Sale or purchase");
    tile(trade, "Handover", "delivered"); tile(trade, "Book", "oil");
    let heard = 0;
    const direction = tileGroup(trade, "Sale or purchase");
    direction.addEventListener("change", () => { heard++; });
    tile(trade, "Sale or purchase", "purchase");
    ok(heard === 1 && direction.value === "purchase" && tileValue(trade, "Book") === "oil" && tileValue(trade, "Handover") === "delivered",
      "a tap tells the group's listeners once, and the other groups of the form keep their choice when the direction changes the books on offer: " + heard);
    const books = tileGroup(trade, "Book");
    const before = [...books.querySelectorAll("input")].map((r) => r.name).join();
    books.fill([{ value: "salt", label: "salt" }, { value: "oil", label: "oil" }]);
    const after = [...books.querySelectorAll("input")].map((r) => r.name).join();
    ok(books.value === "oil" && before === after && [...books.querySelectorAll("input")].filter((r) => r.checked).length === 1,
      "a group drawn again keeps its choice while it is still offered and its radio group's name: " + books.value);
    books.fill([{ value: "candy", label: "candy" }, { value: "rice", label: "rice" }]);
    ok(books.value === "candy", "and falls to its first tile when it is not: " + books.value);
    const role = (v) => tile(p.form("New customer"), "Role", v);
    const drift = tileGroup(p.form("New customer"), "Starting %, salt");
    role("supplier");
    const shut = [drift.disabled, drift.querySelector("input").matches(":disabled")];
    role("customer");
    ok(same(shut, [true, true]) && !drift.disabled, "a supplier has no starting %, so the group is shut with every tile in it, and open again for a customer: " + shut.join());
    drift.value = "nothing";
    ok(drift.value === "" && ![...drift.querySelectorAll("input")].some((r) => r.checked), "a value no tile offers leaves none chosen, as a select left none");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 4. EACH TILE SENDS WHAT ITS SELECT DID */
  p = await open();
  try {
    const failed = [];
    const check = (name, body, want) => {
      const mismatch = Object.keys(want).filter((k) => !same(body && body[k], want[k]));
      if (!body || mismatch.length) failed.push(name + " " + JSON.stringify({ body, mismatch }));
    };
    const send = (route, section, act) => sends(p, route, section, act);
    /* the stock count: the book */
    const count = p.form("Stock count");
    p.type(byAct(count, "record.count.date"), "2026-10-01"); p.type(byAct(count, "record.count.units"), "4");
    for (const book of tileValues(count, "Book")) {
      tile(count, "Book", book);
      check("count " + book, await send("/all/maker/inputs/stock-count", count, "record.count.send"), { product: book, date: "2026-10-01", qty: 4 });
    }
    /* a sale or purchase: the direction names the route and the key of the carriage, the book and the handover are the body's */
    const trade = p.form("Sale or purchase");
    p.type(byAct(trade, "record.trade.date"), "2026-10-02"); p.type(byAct(trade, "record.trade.units"), "1"); p.type(byAct(trade, "record.trade.total"), "100");
    p.type(byAct(trade, "record.trade.delivery"), "10");
    for (const direction of tileValues(trade, "Sale or purchase")) {
      tile(trade, "Sale or purchase", direction);
      const carriage = direction === "sale" ? { delivery: 10 } : { freight: 10 };
      check("trade " + direction, await send("/all/maker/inputs/" + direction, trade, "record.trade.send"), { party: "CX1-ZED", ...carriage });
    }
    tile(trade, "Sale or purchase", "sale");
    for (const book of tileValues(trade, "Book")) {
      tile(trade, "Book", book);
      check("trade book " + book, await send("/all/maker/inputs/sale", trade, "record.trade.send"), { product: book });
    }
    for (const handover of tileValues(trade, "Handover")) {
      tile(trade, "Handover", handover);
      check("trade handover '" + handover + "'", await send("/all/maker/inputs/sale", trade, "record.trade.send"), { handover: handover || null });
    }
    tile(trade, "Handover", "");
    p.type(byAct(trade, "record.trade.associate"), "CA1-ZED");
    for (const stream of tileValues(trade, "Through an associate?")) {
      tile(trade, "Through an associate?", stream);
      p.type(byAct(trade, "record.trade.associate"), "CA1-ZED");
      const body = await send("/all/maker/inputs/sale", trade, "record.trade.send");
      check("trade stream '" + stream + "'", body, stream ? { stream, assoc: "CA1-ZED", party: stream === "R2" ? "CA1-ZED" : "CX1-ZED" } : { party: "CX1-ZED" });
      if (!stream && body && (Object.hasOwn(body, "stream") || Object.hasOwn(body, "assoc"))) failed.push("trade with no associate named one " + JSON.stringify(body));
    }
    tile(trade, "Through an associate?", "");
    /* a loan: in kind or cash, borrowed or lent, and the book only for goods */
    const loan = p.form("Loan");
    p.w.localStorage.removeItem("saltMakerPending:/all/maker/inputs/loan");   /* the harness keeps a loan unsent on this device; a new one is sent beside it */
    p.type(byAct(loan, "record.loan.amount"), "5");
    for (const form of tileValues(loan, "Goods or cash")) {
      tile(loan, "Goods or cash", form);
      const body = await send("/all/maker/inputs/loan", loan, "record.loan.send");
      check("loan " + form, body, { form, amount: 5 });
      if (body && Object.hasOwn(body, "product") === (form === "cash")) failed.push("loan " + form + " product " + JSON.stringify(body));
    }
    tile(loan, "Goods or cash", "salt");
    for (const direction of tileValues(loan, "Direction")) {
      tile(loan, "Direction", direction);
      check("loan " + direction, await send("/all/maker/inputs/loan", loan, "record.loan.send"), { direction });
    }
    for (const book of tileValues(loan, "Book")) {
      tile(loan, "Book", book);
      check("loan book " + book, await send("/all/maker/inputs/loan", loan, "record.loan.send"), { product: book });
    }
    /* a gift */
    const gift = p.form("Gift");
    for (const book of tileValues(gift, "Book")) {
      tile(gift, "Book", book);
      check("gift book " + book, await send("/all/maker/inputs/gift", gift, "record.gift.send"), { product: book });
    }
    for (const handover of tileValues(gift, "Handover")) {
      tile(gift, "Handover", handover);
      check("gift handover '" + handover + "'", await send("/all/maker/inputs/gift", gift, "record.gift.send"), { handover: handover || null });
    }
    ok(failed.length === 0, "the count, the sale and purchase, the loan and the gift send, for every tile, the value its select sent: " + JSON.stringify(failed));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  p = await open();
  try {
    const failed = [];
    const check = (name, body, want) => {
      const mismatch = Object.keys(want).filter((k) => !same(body && body[k], want[k]));
      if (!body || mismatch.length) failed.push(name + " " + JSON.stringify({ body, mismatch }));
    };
    const send = (route, section, act) => sends(p, route, section, act);
    /* a correction: the kind, and the new value of a field as a tile where the choices are few */
    const editor = p.form("Correct a row");
    /* 16 Oct 2026: a Fulfilment for one row went out against the book's first row, left as the picker's default */
    const rowPick = byAct(editor, "record.amend.row"), amendSend = byAct(editor, "record.amend.send");
    const unpicked = [rowPick.value, rowPick.selectedIndex, amendSend.disabled], unsent = await send("/all/maker/inputs/ledger-amend", editor, "record.amend.send");
    p.type(rowPick, "row-1");
    ok(unpicked[0] === "" && unpicked[1] === 0 && unpicked[2] === true && unsent === null && amendSend.disabled === false,
      "Correct a row opens on no row, its Send disabled and sending nothing, until a row is chosen: " + JSON.stringify([unpicked, unsent, amendSend.disabled]));
    for (const kind of tileValues(editor, "What to do")) {
      tile(editor, "What to do", kind);
      check("correct " + kind, await send("/all/maker/inputs/ledger-amend", editor, "record.amend.send"), { kind, rid: "row-1" });
    }
    p.type(byAct(editor, "record.amend.row"), "row-2");
    ok(same(tileValues(editor, "What to do"), ["Correction", "Fulfilment", "Cancellation", "Payment", "Receipt", "Default"]) && tileValue(editor, "What to do") === "Cancellation",
      "a purchase lot offers its own kinds as tiles and keeps the one chosen while it is offered: " + tileValues(editor, "What to do").join());
    tile(editor, "What to do", "Correction");
    const values = [["unpriced", ["true", "false"]], ["stream", ["R2", "R3"]], ["handover", ["delivered", "collected"]], ["product", ["salt", "oil"]]];
    for (const [field, offered] of values) {
      p.type(byAct(editor, "record.amend.field"), field);
      const got = tileValues(editor, "New value");
      if (!same(got, offered)) failed.push("the new value of " + field + " offered " + JSON.stringify(got));
      for (const value of offered) {
        tile(editor, "New value", value);
        byAct(editor, "record.amend.add-change").click(); await p.work.quiet();
        const body = await send("/all/maker/inputs/ledger-amend", editor, "record.amend.send");
        const want = field === "unpriced" ? value === "true" : value;
        if (!body || !same(body.fields[field], want)) failed.push("correct " + field + "=" + value + " " + JSON.stringify(body));
      }
    }
    p.type(byAct(editor, "record.amend.field"), "party");
    ok(tileValues(editor, "New value") === null && byAct(editor, "record.amend.value").tagName === "SELECT", "a code, a list as long as the book, stays a select in a correction");
    /* a reminder hushed for a time */
    const tip = p.form("Desk reminders");
    for (const days of tileValues(tip, "Hide for")) {
      tile(tip, "Hide for", days);
      const body = await send("/all/maker/inputs/hush", tip, "record.tip.send");
      const want = days === "" || !body ? null : new Date(Date.parse(body.at) + 8 * 3600000 + Number(days) * 86400000).toISOString().slice(0, 10);
      check("hush '" + days + "'", body, { id: "dup:tip1", until: want });
    }
    /* an associate appointed, and an account for an associate's resale: the role */
    const appoint = p.form("Make an associate");
    p.type(byAct(appoint, "record.appoint.customer"), "CX1-ZED");
    const none = await send("/all/maker/inputs/appoint-existing", appoint, "record.appoint.send");
    ok(none === null && /Choose who, and as what/.test(appoint.textContent), "with no role chosen the form says so and sends nothing: " + appoint.textContent.slice(-60));
    for (const [i, kind] of tileValues(appoint, "As").entries()) {
      const code = ["CX1-ZED", "CX2-ZED"][i];
      p.type(byAct(appoint, "record.appoint.customer"), code);
      tile(appoint, "As", kind);
      check("appoint " + kind, await send("/all/maker/inputs/appoint-existing", appoint, "record.appoint.send"), { code, kind });
    }
    const newCustomer = p.form("New customer");
    tile(newCustomer, "Role", "bucket");
    check("a resale account", await send("/all/maker/inputs/add-id", newCustomer, "record.add-id.send"), { kind: "bucket", parent: "CA1-ZED", code: "CA1-ZED-R", tiers: null, vault: null });
    ok(failed.length === 0, "the correction, the level, the hush, the appointment and the resale account send, for every tile, the value their selects sent: " + JSON.stringify(failed));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
