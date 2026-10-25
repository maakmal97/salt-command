/* test/admin-record-codes.mjs: SALT ADMIN RECORD, P7, THE CODE BEFORE IT IS SENT (25 Oct 2026; his canvas Salt Admin Record and his Ask J). What is proved here, each
 * check red under its own mutation (test/admin-record-codes.mutations.json):
 *   1  New customer shows the code they will get as the name and place are typed, worked out as Add the customer works it out: by role (C or S), the name's first
 *      letter and length, the place's letters (TBC with no place); a resale account is its associate's code and -R; nothing is shown before there is a code
 *   2  Change a name or place shows the code after the change, and says unchanged where the name and place keep it
 *   3  the page's rules: the line one ledger row, its code in mono, never drawn while empty
 * Drawn by the maker harness (test/maker-act.mjs). Nothing here is sent. */
import { richOwnerPage, byAct, enter, tile } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet(), W = d.defaultView;
    enter(d, "record", "customers"); await quiet();
    const form = (slug) => d.querySelector('#makerInputs section.maker-input[data-form="' + slug + '"]');
    const type = async (f, act, v) => { const x = byAct(f, act); x.value = v; x.dispatchEvent(new W.Event("input", { bubbles: true })); await quiet(); };
    const code = (f) => { const box = f.querySelector(".codeline"); return box.hidden ? null : [t(box.querySelector(".salt-ledger__label")), t(box.querySelector(".codeline__code"))]; };
    /* 1 */
    const add = form("new-customer"), seen = [];
    seen.push(code(add));
    await type(add, "record.add-id.name", "Kedai Ruma"); seen.push(code(add));
    await type(add, "record.add-id.place", "Pudu"); seen.push(code(add));
    tile(add, "Role", "supplier"); await quiet(); seen.push(code(add));
    tile(add, "Role", "bucket"); await quiet();
    const parent = byAct(add, "record.add-id.parent"); parent.value = "AX1-ZED"; parent.dispatchEvent(new W.Event("change", { bubbles: true })); await quiet(); seen.push(code(add));
    ok(J(seen) === J([null, ["Their code", "CK10-TBC"], ["Their code", "CK10-PUD"], ["Their code", "SK10-PUD"], ["Their code", "AX1-ZED-R"]]),
      "New customer shows the code as it is typed, by role, name and place, TBC with no place, an associate's resale account its code and -R, and nothing before a name: " + J(seen));
    /* 2 */
    const am = form("change-a-name-or-place"), party = byAct(am, "record.amend-id.party");
    party.value = "CX1-ZED"; party.dispatchEvent(new W.Event("change", { bubbles: true })); await quiet();
    const before = code(am);
    await type(am, "record.amend-id.name", "Kedai Ruma"); await type(am, "record.amend-id.place", "Pudu");
    const moved = code(am);
    await type(am, "record.amend-id.name", "X"); await type(am, "record.amend-id.place", "Zed");
    const kept = code(am);
    ok(before === null && J(moved) === J(["Code after", "CK10-PUD"]) && J(kept) === J(["Code after", "CX1-ZED, unchanged"]),
      "Change a name or place shows the code after the change, and unchanged where the name and place keep it: " + J([before, moved, kept]));
    /* 3 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.codeline\[hidden\]\{display:none\}/.test(css) && /\.adm \.codeline \.codeline__code\{font-family:var\(--salt-font-mono\)\}/.test(css) && /\.adm \.codeline \.salt-ledger__value\{white-space:nowrap\}/.test(css),
      "the line is one ledger row, its code in mono and on one line, never drawn while empty");
  } finally { p.w.close(); }
}
