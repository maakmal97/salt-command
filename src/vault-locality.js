import places from "../geo/placelist.json" with { type: "json" };
import areas from "../geo/areas.json" with { type: "json" };
import gazetteer from "../geo/gazetteer.json" with { type: "json" };
import E from "../engine/position.mjs";

const official = new Set([
  ...places.names.map((place) => place.n),
  ...areas.areas.flatMap((area) => [area.short, area.kind ? area.kind + " " + area.short : area.short]),
  ...areas.districts.map((district) => district.name)
].filter(Boolean).map(E.placeKey));
const hashes = new Set();
for (let i = 0; i + 11 <= gazetteer.packed.length; i += 11)
  hashes.add(gazetteer.packed.slice(i, i + 7));

export async function officialVaultPoint(point) {
  /* a point is filed only with its locality beside it: a bare point is not public */
  if (!Array.isArray(point) || point.length !== 3) return false;
  if (typeof point[2] !== "string" || point[2].length > 60 || !point[2].trim()) return false;
  const key = E.placeKey(point[2]);
  if (official.has(key)) return true;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest).slice(0, 4), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 7);
  return hashes.has(hash);
}
