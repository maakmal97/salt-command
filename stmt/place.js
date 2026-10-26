/* stmt/place.js: A PLACE FOR HIS COLLECTION POINTS, FOUND FOR SALT ADMIN, AND NOTHING KEPT (his answers of 26 Oct 2026).
 *
 * Two roads, both behind /all's two locks and both answering a read only:
 *
 * 1. mapsOpen: a short or point-less Maps link opened on its own maker's server for the point it leads to. Google's
 *    maps.app.goo.gl and goo.gl/maps links are followed by redirect, "manual", one hop at a time; Apple's maps.apple/p
 *    links likewise; an Apple place page with a place id and no coordinate is read for its place:location meta tags (his
 *    yes to Apple, 26 Oct 2026). Only those hosts are ever fetched: any other host, scheme, port or a credential is
 *    refused before a fetch is made, and every hop is checked again, so this is never a door to anywhere else. The answer
 *    is a full link the page reads as it reads any link (makerGeo.link).
 * 2. placeSearch: the words he types, sent to Photon (photon.komoot.io, OpenStreetMap's search built for search as you
 *    type; his choice of 26 Oct 2026), held to Malaysia and Singapore, five places back, each a name, where it is and its
 *    point. Only the words travel: no code, name, order or account.
 *
 * Nothing is stored and nothing is logged: the words and the link ride in the body. Pure, the fetch passed in, so the
 * suite drives both with no network. Imports nothing (nothing under stmt/ imports from src/, tools/ or a node builtin). */

const MAX_HOPS = 3, PAGE_BYTES = 400000, TIMEOUT = 8000;
const AGENT = "SaltAdmin/1 (owner place search; contact through the site's owner)";

function clean(s) {
  if (typeof s !== "string" || s.length > 400) return null;
  let u;
  try { u = new URL(s.trim()); } catch (e) { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  return u;
}
/* which maker a link is, or null: only these are opened */
export function mapsKind(u) {
  const h = u.hostname.toLowerCase();
  if (h === "maps.app.goo.gl" && /^\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname)) return "google";
  if (h === "goo.gl" && /^\/maps\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname)) return "google";
  if (h === "maps.apple" && /^\/p\/[A-Za-z0-9._~-]{1,80}$/.test(u.pathname)) return "apple";
  if (h === "maps.apple.com") return "apple-page";
  return null;
}
const pairIn = (s) => { const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(String(s || "")); return m ? [+m[1], +m[2]] : null; };
const okPoint = (p) => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && (p[0] || p[1]);
/* a Google maps page, or an Apple page carrying its point, is where a hop ends */
function landed(u) {
  const h = u.hostname.toLowerCase();
  if (/^(www\.|maps\.)?google\.(com|com?\.[a-z]{2}|[a-z]{2})$/.test(h)) return true;
  return h === "maps.apple.com" && ["coordinate", "ll", "sll"].some((k) => okPoint(pairIn(u.searchParams.get(k))));
}
async function hop(fetchFn, u) {
  const res = await fetchFn(u.href, { method: "GET", redirect: "manual", headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(TIMEOUT) });
  return res;
}
/* an Apple place page's point, from its place:location meta tags, and its name from og:title */
async function applePage(fetchFn, u) {
  const res = await hop(fetchFn, u);
  if (res.status >= 300 && res.status < 400) { try { if (res.body) await res.body.cancel(); } catch (e) { /* nothing to free */ } return { next: res.headers.get("location") }; }
  if (res.status !== 200) { try { if (res.body) await res.body.cancel(); } catch (e) { /* nothing to free */ } return {}; }
  const text = (await res.text()).slice(0, PAGE_BYTES);
  const meta = (p) => { const m = new RegExp('<meta[^>]+property="' + p + '"[^>]+content="([^"]{1,200})"').exec(text); return m ? m[1] : null; };
  const lat = Number(meta("place:location:latitude")), lng = Number(meta("place:location:longitude"));
  if (!okPoint([lat, lng])) return {};
  const title = (meta("og:title") || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').slice(0, 120);
  return { location: "https://maps.apple.com/?ll=" + lat + "," + lng + (title ? "&q=" + encodeURIComponent(title) : "") };
}
export async function mapsOpen(url, fetchFn) {
  let u = clean(url);
  if (!u || !mapsKind(u)) return { ok: false, status: 400, error: "Only a Google Maps or Apple Maps link is opened here." };
  try {
    for (let i = 0; i <= MAX_HOPS; i++) {
      if (landed(u)) return { ok: true, location: u.href };
      const kind = mapsKind(u);
      if (!kind) break;
      let next = null;
      if (kind === "apple-page") {
        const got = await applePage(fetchFn, u);
        if (got.location) return { ok: true, location: got.location };
        next = got.next;
      } else {
        const res = await hop(fetchFn, u);
        try { if (res.body) await res.body.cancel(); } catch (e) { /* nothing to free */ }
        next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      }
      if (!next) break;
      let to; try { to = new URL(next, u); } catch (e) { break; }
      if (to.protocol === "http:") to.protocol = "https:";
      const kept = clean(to.href);
      if (!kept || !(landed(kept) || mapsKind(kept))) break;
      u = kept;
    }
  } catch (e) { return { ok: false, status: 502, error: "The link did not answer." }; }
  return { ok: false, status: 502, error: "The link did not lead to a point." };
}

/* PHOTON: Malaysia and Singapore, nearest Kuala Lumpur first, five places */
const BBOX = "99.6,0.8,119.3,7.4";
export function searchWords(q) {
  if (typeof q !== "string") return null;
  const w = q.replace(/\s+/g, " ").trim();
  if (w.length < 3 || w.length > 80 || /^https?:/i.test(w) || pairIn(w)) return null;
  return w;
}
export async function placeSearch(q, fetchFn) {
  const w = searchWords(q);
  if (!w) return { ok: false, status: 400, error: "Type three letters or more of a place." };
  const url = "https://photon.komoot.io/api/?q=" + encodeURIComponent(w) + "&limit=8&lang=en&lat=3.139&lon=101.687&bbox=" + BBOX;
  let res;
  try { res = await fetchFn(url, { method: "GET", headers: { "user-agent": AGENT, accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) }); }
  catch (e) { return { ok: false, status: 502, error: "The place search did not answer." }; }
  if (res.status !== 200) { try { if (res.body) await res.body.cancel(); } catch (e) { /* nothing to free */ } return { ok: false, status: 502, error: "The place search did not answer." }; }
  let data; try { data = await res.json(); } catch (e) { return { ok: false, status: 502, error: "The place search did not answer." }; }
  const seen = new Set(), places = [];
  for (const f of (data && Array.isArray(data.features) ? data.features : [])) {
    const c = f && f.geometry && f.geometry.coordinates, p = (f && f.properties) || {};
    if (!Array.isArray(c) || !okPoint([c[1], c[0]])) continue;
    const road = [p.housenumber, p.street].filter(Boolean).join(" ");
    const name = String(p.name || road || "").slice(0, 80);
    if (!name) continue;
    const where = [p.name && road ? road : null, p.district || p.locality, p.city, p.state].filter((x, i, a) => x && x !== name && a.indexOf(x) === i).slice(0, 3).join(", ").slice(0, 120);
    const lat = Math.round(c[1] * 1e5) / 1e5, lng = Math.round(c[0] * 1e5) / 1e5, key = name + "|" + where;   /* one road in pieces is one choice */
    if (seen.has(key)) continue;
    seen.add(key); places.push({ name, where, lat, lng });
    if (places.length === 5) break;
  }
  return { ok: true, places };
}
