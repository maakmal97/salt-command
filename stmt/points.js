/* stmt/points.js: HIS COLLECTION POINTS (Counter Batch A, his decisions of 18 Oct 2026).
 *
 * A point is a code and a place on the map: { code, lat, lng }. The code is one capital letter and one or two digits ("A2"),
 * shown to a customer as "Point A2", so it can never take the roster code's shape and names no place. There is no label, no
 * address and no note: nothing free-text that could carry a place's name. The list is Counter KV `maker:points`,
 * { v: 1, list }, at most twenty, written by Salt Admin alone (stmt/maker.js, the verified owner) and never in git, the
 * Desk build or the master: the coordinates are his. An order set Ready to collect keeps its own copy (`pointAt`, a snapshot),
 * so editing or removing a point later moves no order already waiting at it. */

export const POINTS_KEY = "maker:points";
export const POINT_RE = /^[A-Z][0-9]{1,2}$/;
export const POINTS_MAX = 20;
/* Malaysia, peninsular and Borneo together, generously: a point outside it is a typing slip */
const BOUNDS = { south: 0.5, north: 7.6, west: 99.5, east: 119.5 };

const round5 = (v) => Math.round(v * 1e5) / 1e5;
export const isPointCode = (code) => typeof code === "string" && POINT_RE.test(code);

/** One point checked: { point } or { error }. The coordinates are rounded to five places (about a metre). */
export function validatePoint(p) {
  if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some((k) => !["code", "lat", "lng"].includes(k)))
    return { error: "A point is a code and its place on the map, nothing else." };
  if (!isPointCode(p.code)) return { error: "A point's code is one capital letter and one or two digits, such as A2." };
  const ok = (v) => typeof v === "number" && Number.isFinite(v);
  if (!ok(p.lat) || !ok(p.lng)) return { error: "Give the point's place as two figures, latitude and longitude." };
  const lat = round5(p.lat), lng = round5(p.lng);
  if (lat < BOUNDS.south || lat > BOUNDS.north || lng < BOUNDS.west || lng > BOUNDS.east)
    return { error: "That place is outside Malaysia. Check the two figures." };
  return { point: { code: p.code, lat, lng } };
}

/** The whole list checked, as Save sends it: { v: 1, list } or { error }. Codes are unique; twenty at most. */
export function validatePoints(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => k !== "list") || !Array.isArray(value.list))
    return { error: "Send the list of points." };
  if (value.list.length > POINTS_MAX) return { error: "Twenty points at most." };
  const list = [], seen = new Set();
  for (const p of value.list) {
    const r = validatePoint(p);
    if (r.error) return r;
    if (seen.has(r.point.code)) return { error: "Two points share the code " + r.point.code + "." };
    seen.add(r.point.code); list.push(r.point);
  }
  return { v: 1, list };
}

/** A stored list read back, checked; anything that no longer validates reads as none. */
export function pointsOf(value) {
  const r = value && typeof value === "object" ? validatePoints({ list: value.list }) : { error: "none" };
  return r.error ? { v: 1, list: [] } : r;
}

/** THE ONE RESOLVER, both roads (a real order through stmt/worker.js, an example order through stmt/maker.js): the code's
 *  coordinates out of a list, { lat, lng }, or null when the list has no such code. */
export function resolvePoint(list, code) {
  if (!isPointCode(code) || !Array.isArray(list)) return null;
  const p = list.find((x) => x && x.code === code);
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { lat: p.lat, lng: p.lng } : null;
}

/** His points as Counter KV holds them. */
export async function readPoints(env) {
  let value = null;
  try { value = env && env.STMT ? await env.STMT.get(POINTS_KEY, "json") : null; } catch (e) { value = null; }
  return pointsOf(value);
}
