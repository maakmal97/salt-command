/* Counter Admin tier cards: the held level, the proposal (a level or bands) and the late-payer offer, read from the snapshot. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makerInputCatalog } from "../src/maker-inputs.js";

export async function run({ ok, REPO }) {
  const band = { small: "Platinum", mid: "Gold", big: "Gold" };
  const names = ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"];
  const book = {
    version: 1, sales: [], purchases: [],
    state: { PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" } }, roster: ["CX1-ZED", "CX2-ZED", "CX3-ZED", "CX4-ZED", "AX1-ZED-R"],
      TIER_OF: { "CX1-ZED": { salt: "Gold" }, "CX4-ZED": { salt: "Bogus" } } },
    pricing: {
      tierNames: names,
      tierOf: { "CX1-ZED": { salt: "Gold" }, "CX2-ZED": { salt: band }, "CX3-ZED": { salt: "Silver" }, "CX4-ZED": { salt: "Gold" }, "AX1-ZED-R": { salt: "Gold" } },
      lateOffers: { "CX1-ZED": { why: "paid 6 days after the handover", down: { salt: "Silver", oil: "Gold" } }, "CX3-ZED": { why: "x", down: { salt: "Nowhere" } } },
      byProduct: { salt: { inputs: { policy: { tierRule: { multiples: [1, 2] } } } }, oil: { inputs: { policy: { tierRule: { fixed: true } } } } }
    }
  };
  const cat = makerInputCatalog(book);
  const card = (code, product = "salt") => (cat.tierCards || []).find((c) => c.code === code && c.product === product);
  ok(card("CX1-ZED") && card("CX1-ZED").held === "Gold" && card("CX1-ZED").proposed === null
    && card("CX1-ZED").late && card("CX1-ZED").late.level === "Silver" && card("CX1-ZED").late.why === "paid 6 days after the handover",
    "a customer holding a level shows it held, with the late-payer offer one level down and why");
  ok(card("CX2-ZED") && JSON.stringify(card("CX2-ZED").proposed) === JSON.stringify(band) && card("CX2-ZED").held === null && !card("CX2-ZED").late,
    "a proposed band set shows as proposed, nothing held");
  ok(card("CX3-ZED") && card("CX3-ZED").proposed === "Silver" && card("CX3-ZED").late === null,
    "an offer naming a level the book lacks is dropped");
  ok(card("CX4-ZED") && card("CX4-ZED").held === null && card("CX4-ZED").proposed === "Gold",
    "a held value that is not a level of the book is not shown as held");
  ok(!card("AX1-ZED-R") && !card("CX1-ZED", "oil"),
    "a resale bucket and a fixed board have no tier card");

  const owner = readFileSync(join(REPO, "stmt", "owner.js"), "utf8");
  ok(owner.includes("Small, mid and big bands") && owner.includes("Use the late-payer offer") && owner.includes("'Late payer: offered '")
    && owner.includes("{small:bandSel.small.value,mid:bandSel.mid.value,big:bandSel.big.value}"),
    "the owner page offers bands, the proposal and the late-payer offer, and sends bands as small, mid and big");
}
