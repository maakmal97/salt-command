/* stmt/faceid.js: THE FACE ID TEST PAGE (the combined plan's Step 6, his word of 29 Sep 2026: "start Face ID", for both
 * the Counter and the desk's names vault, as a hidden page taken out after the test).
 *
 * WHAT IT ANSWERS. A web app can use Face ID only through a passkey, and a passkey unlocks a vault only if the phone hands
 * back a secret with it (the PRF extension). This page asks his iPhone, in Safari and again as a saved app, four things:
 * is there a platform authenticator; can it make a passkey here; does opening it verify his face; and does it give the
 * same 32-byte secret each time, which sealed a note that the next open must read. A yes to all four means Face ID can
 * stand in for a typed password on this address; a no to the secret means it can only prove presence, and Step 6 stops.
 *
 * WHAT IT TOUCHES. Nothing on the server: no route reads or writes anything, and the page's CSP allows no connection.
 * On the phone it makes one passkey named Face ID test in Passwords and keeps its notes in this origin's localStorage
 * (fid.*). The passkey's address is the Worker serving it, so the desk's copy and the Counter's copy are two separate
 * tests, as the two unlocks would be. Nothing here names either app, and the page is linked from nowhere.
 *
 * ONE MODULE, TWO WORKERS: the Counter imports it as a sibling, and the desk's Worker imports it from here, which the
 * rule allows in that direction only. The client script sits in a template literal: no backslash, no backtick in it.
 */

export const FACEID_PATH = "/faceid-test";

const CLIENT_JS = `(function(){
  var log = document.getElementById("log"), lines = [], enc = new TextEncoder();
  var NL = String.fromCharCode(10);
  function say(k, v) {
    lines.push(k + ": " + v);
    var li = document.createElement("li"), b = document.createElement("b");
    b.textContent = k; li.appendChild(b); li.appendChild(document.createTextNode(" " + v)); log.appendChild(li);
  }
  function rnd(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }
  function b64(u) { u = new Uint8Array(u); var s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(s) { var t = atob(s), u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function keep(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* a private tab keeps nothing */ } }
  /* worked out at load, so each tap calls the passkey at once: Safari wants the call inside the tap's own turn */
  var SALT = null;
  crypto.subtle.digest("SHA-256", enc.encode("face-id-test prf v1")).then(function (d) { SALT = new Uint8Array(d); });
  function fail(step, e) { say(step, "failed: " + ((e && e.name) || "Error") + (e && e.message ? ", " + e.message : "")); }
  var where = document.body.getAttribute("data-where");
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

  async function look() {
    say("address", where);
    say("opened as", standalone ? "saved app" : "browser tab");
    say("phone", navigator.userAgent);
    var pkc = window.PublicKeyCredential;
    if (!pkc) { say("passkeys", "not available here"); return; }
    try { say("face id or touch id", (await pkc.isUserVerifyingPlatformAuthenticatorAvailable()) ? "available" : "not available"); }
    catch (e) { fail("face id or touch id", e); }
    if (pkc.getClientCapabilities) {
      try {
        var c = await pkc.getClientCapabilities();
        say("secret from a passkey (browser says)", c["extension:prf"] === true ? "yes" : c["extension:prf"] === false ? "no" : "not said");
      } catch (e) { fail("capabilities", e); }
    } else say("capabilities", "not reported by this browser");
    say("test passkey made on this page before", load("fid.cred") ? "yes" : "no");
  }

  async function make() {
    if (!SALT) { say("1. make", "the page is still starting; tap again"); return; }
    try {
      var cred = await navigator.credentials.create({ publicKey: {
        rp: { name: "Face ID test" },
        user: { id: rnd(16), name: "face-id-test", displayName: "Face ID test" },
        challenge: rnd(32),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", requireResidentKey: true, userVerification: "required" },
        attestation: "none", timeout: 60000,
        extensions: { prf: { eval: { first: SALT } }, credProps: true }
      } });
      var x = cred.getClientExtensionResults() || {};
      say("1. passkey made", "yes (" + (cred.authenticatorAttachment || "attachment not said") + ")");
      say("1. secret offered", x.prf ? (x.prf.enabled === true ? "yes" : x.prf.enabled === false ? "no" : "not said") : "not reported");
      keep("fid.cred", cred.id);
    } catch (e) { fail("1. make", e); }
  }

  async function open() {
    if (!SALT) { say("2. open", "the page is still starting; tap again"); return; }
    try {
      var r = await navigator.credentials.get({ publicKey: {
        challenge: rnd(32), userVerification: "required", timeout: 60000,
        extensions: { prf: { eval: { first: SALT } } }
      } });
      var flags = new Uint8Array(r.response.authenticatorData)[32];
      say("2. face checked", (flags & 4) ? "yes" : "no");
      var x = r.getClientExtensionResults() || {};
      var raw = x.prf && x.prf.results && x.prf.results.first;
      if (!raw) { say("2. secret", "none given: Face ID here can prove presence but cannot unlock a vault"); return; }
      var fp = hex(await crypto.subtle.digest("SHA-256", raw)).slice(0, 12);
      say("2. secret fingerprint", fp);
      var before = load("fid.fp");
      if (before) say("2. same secret as the last open", before === fp ? "yes" : "NO");
      keep("fid.fp", fp);
      var base = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
      var key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("face-id-test seal v1") },
        base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      var sealed = load("fid.sealed");
      if (sealed) {
        try {
          var o = JSON.parse(sealed);
          var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, key, unb64(o.ct));
          say("3. sealed note opened", "yes, it reads: " + new TextDecoder().decode(pt));
        } catch (e) { say("3. sealed note opened", "NO: the secret changed, so a vault sealed with it would stay shut"); }
      } else {
        var iv = rnd(12), note = "sealed " + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
        var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(note));
        keep("fid.sealed", JSON.stringify({ iv: b64(iv), ct: b64(ct) }));
        say("3. note sealed", "tap Open with Face ID once more: the note must open");
      }
    } catch (e) { fail("2. open", e); }
  }

  function copy() {
    var t = lines.join(NL), btn = document.getElementById("copy");
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy the results"; }, 1600); };
    var pick = function () { var r = document.createRange(); r.selectNodeContents(log); var s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected: copy it"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, pick); else pick();
  }

  function forget() {
    ["fid.cred", "fid.fp", "fid.sealed"].forEach(function (k) { keep(k, null); });
    say("notes", "cleared on this page; delete Face ID test in Settings, Passwords to remove the passkey");
  }

  document.getElementById("make").addEventListener("click", make);
  document.getElementById("open").addEventListener("click", open);
  document.getElementById("copy").addEventListener("click", copy);
  document.getElementById("forget").addEventListener("click", forget);
  look();
})();`;

const CSS = `
:root{--bg:#f6f5f2;--card:#ffffff;--ink:#1c1b19;--ink2:#5d5a54;--line:#dedad2;--act:#1f4f8a;--on-act:#ffffff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#141412;--card:#1f1e1b;--ink:#f1efe9;--ink2:#aaa59b;--line:#34322d;--act:#8cb4ec;--on-act:#10151c;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  padding:max(16px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))}
main{max-width:36rem;margin:0 auto;display:flex;flex-direction:column;gap:14px}
h1{font-size:1.5rem;margin:0}
p{margin:0;color:var(--ink2)}
ol{margin:0;padding-left:1.25rem;color:var(--ink2)}
.acts{display:grid;gap:10px}
button{font:inherit;font-weight:600;min-height:44px;min-width:44px;padding:10px 16px;border-radius:12px;border:1px solid var(--line);
  background:var(--card);color:var(--ink);cursor:pointer}
button.go{background:var(--act);border-color:var(--act);color:var(--on-act)}
button:focus-visible{outline:2px solid var(--act);outline-offset:2px}
#log{list-style:none;margin:0;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:12px;
  display:flex;flex-direction:column;gap:6px;overflow-wrap:anywhere;font-size:.94rem}
#log b{font-weight:600}
`;

/** The test page, its inline style and script carrying `nonce`. `where` is "desk" or "counter", said on the page and in
 *  the results, so a pasted report names which address it came from without the page ever holding the other's. */
export function faceIdPage(nonce, where) {
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
    + "<meta name=\"robots\" content=\"noindex,nofollow\">"
    + "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><meta name=\"mobile-web-app-capable\" content=\"yes\">"
    + "<meta name=\"apple-mobile-web-app-title\" content=\"Face ID test\">"
    + "<title>Face ID test</title><style nonce=\"" + nonce + "\">" + CSS + "</style></head>"
    + "<body data-where=\"" + (where === "desk" ? "desk" : "counter") + "\"><main>"
    + "<h1>Face ID test</h1>"
    + "<p>Checks whether Face ID can unlock a vault on this address. Nothing is sent anywhere.</p>"
    + "<ol><li>Tap Make a test passkey and allow Face ID.</li>"
    + "<li>Tap Open with Face ID twice: the second open must read the sealed note.</li>"
    + "<li>Share, Add to Home Screen, open it from there and tap Open with Face ID twice again.</li>"
    + "<li>Copy the results and paste them back.</li></ol>"
    + "<div class=\"acts\"><button id=\"make\" class=\"go\" type=\"button\">Make a test passkey</button>"
    + "<button id=\"open\" class=\"go\" type=\"button\">Open with Face ID</button>"
    + "<button id=\"copy\" type=\"button\">Copy the results</button>"
    + "<button id=\"forget\" type=\"button\">Clear this page&#39;s notes</button></div>"
    + "<ul id=\"log\" aria-live=\"polite\"></ul>"
    + "<p>Afterwards, delete Face ID test in Settings, Passwords.</p>"
    + "</main><script nonce=\"" + nonce + "\">" + CLIENT_JS + "</script></body></html>";
}

/** The page as a response: a fresh nonce, a CSP that allows its own style and script and no connection at all,
 *  never cached, never indexed. GET and HEAD only; the caller routes anything else. */
export function faceIdResponse(where) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
  return new Response(faceIdPage(nonce, where), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
        + "style-src 'nonce-" + nonce + "'; script-src 'nonce-" + nonce + "'",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}
