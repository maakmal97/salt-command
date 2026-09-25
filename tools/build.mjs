/* build.mjs — produce public/index.html from the master in this repo.
 *
 * The master (salt_command.html) is the ONLY place the desk is edited. This step reads
 * it, injects the PWA head and a handful of cloud-mode patches, and writes the result
 * to public/index.html for deploy. The master is never modified.
 *
 * Every patch anchors on a single, unique line and asserts it is present exactly once,
 * so a future master change that moves an anchor fails the build loudly instead of
 * shipping a half-patched desk. All patches are single-line, so CRLF vs LF never bites.
 *
 *   SALT_MASTER   env override for the master path (absolute).
 */

import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
/* THE DESK IS THE ONLY SURFACE (v387, his instruction). v290 split them, the root being a
   hand-written phone app and the desk sitting at /desk; v376 made the desk the root and kept
   the app at /app as an escape hatch, to be retired if a week passed without it. It is
   retired. There is one built file and one cloud copy of this book. Editing public/desk.html
   by hand is still pointless, for the old reason: the next build overwrites it. */
const OUT = resolve(REPO, "public", "desk.html");
const REV = resolve(REPO, "public", "rev.json");

/* The token the build id is written into. It is a placeholder while the hash is taken,
   so the id covers the whole built file except the three places it is stamped, which is
   the only way a file can carry a hash of itself. */
const IDTOKEN = "__SALT_BUILD_ID__";

const DEFAULT_MASTER =
  resolve(REPO, "master", "salt_command.html");
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;

let src;
try {
  src = readFileSync(MASTER, "utf8");
} catch (e) {
  console.error("BUILD FAILED: cannot read the master desk at\n  " + MASTER +
    "\n  Set SALT_MASTER to its path, or check the folder is mounted.\n  (" + e.message + ")");
  process.exit(1);
}

const EOL = src.includes("\r\n") ? "\r\n" : "\n";
const applied = [];

function replaceOnce(name, anchor, repl) {
  const parts = src.split(anchor);
  if (parts.length - 1 !== 1) {
    console.error(`BUILD FAILED: patch "${name}" expected its anchor exactly once, found ${parts.length - 1}.`);
    console.error("  anchor: " + JSON.stringify(anchor.slice(0, 90) + (anchor.length > 90 ? "..." : "")));
    process.exit(1);
  }
  src = parts[0] + repl + parts[1];
  applied.push(name);
}

/* An assertion rather than a patch: the MASTER owns this now, and the build's job is to
   prove it still does. Same fail-loud contract as replaceOnce, opposite direction. */
function requireOnce(name, needle, why) {
  const n = src.split(needle).length - 1;
  if (n !== 1) {
    console.error(`BUILD FAILED: check "${name}" expected ${JSON.stringify(needle.slice(0, 70))} exactly once in the master, found ${n}.`);
    console.error("  " + why);
    process.exit(1);
  }
  applied.push(name + " (checked)");
}

/* ---- P2 head block: PWA + a per-device id + service-worker registration ---------- */
const PWA_BLOCK = [
  '<!-- BEGIN cloud/PWA — injected by tools/build.mjs; do NOT hand-edit this built file -->',
  '<meta name="theme-color" content="#180f2c">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Salt">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="icon-180.png">',
  /* THE WAY BACK MUST BE VISIBLE. The master draws its Close control at 22% opacity and
     lights it on hover, which is right for a mouse and invisible on a phone. Specific
     enough to win over the master rule without touching it. */
  '<style>body .exitbtn.exitfix{opacity:.9}</style>',
  '<script>',
  '/* A stable, opaque per-device id so the cloud queue keeps this phone\'s entries under',
  '   their own key (q:<id>) and one device never overwrites another. Local only. */',
  "function saltDeviceId(){try{var d=localStorage.getItem('saltDevice');if(!d){d=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():('d'+Date.now()+Math.random().toString(36).slice(2));localStorage.setItem('saltDevice',d);}return d;}catch(e){return 'anon';}}",
  '/* Register the service worker so the desk installs to the home screen and opens',
  '   offline. When a fresh build lands, reload once so the phone gets the new ledger. */',
  "if('serviceWorker' in navigator){",
  "  window.addEventListener('load',function(){",
  "    navigator.serviceWorker.register('sw.js').then(function(reg){try{reg.update&&reg.update();}catch(e){}}).catch(function(){});",
  '  });',
  '  var _swFirst=true;',
  "  navigator.serviceWorker.addEventListener('controllerchange',function(){",
  '    if(_swFirst){_swFirst=false;return;}   // first claim after install is not an update',
  '    location.reload();',
  '  });',
  "  document.addEventListener('visibilitychange',function(){",
  "    if(document.visibilityState==='visible'&&navigator.serviceWorker.controller){",
  '      navigator.serviceWorker.getRegistration().then(function(r){try{r&&r.update&&r.update();}catch(e){}});',
  '    }',
  '  });',
  '}',
  '/* Cloud privacy: on the phone names show only after the password and auto-hide the',
  '   moment the app leaves the foreground. lockVault() drops the decrypted names, so',
  '   returning shows codes until the password is re-entered. */',
  "document.addEventListener('visibilitychange',function(){",
  "  if(window.SALT_CLOUD&&document.visibilityState==='hidden'&&typeof lockVault==='function'){",
  '    try{lockVault();if(typeof renderReveal==="function")renderReveal();if(typeof render==="function")render();}catch(e){}',
  '  }',
  '});',
  '/* FRESHNESS. The ledger is baked into this file at build time, so the phone is only',
  '   as current as its last load. This asks the Worker every ten seconds whether a newer',
  '   build has been deployed, and loads it when one has. It is a poll and not a push',
  '   because KV cannot reach a phone; ten seconds is the interval that was asked for.',
  '   IT WILL NOT INTERRUPT YOU. Reloading over a half-typed entry would throw the typing',
  '   away, so it reloads only when the desk is idle: no field focused, no dialog open.',
  '   Otherwise it offers a chip and waits to be tapped.',
  '   A QUEUED ENTRY NO LONGER COUNTS AS BUSY, corrected 03 Sep 2026 on his report that the',
  '   other tabs stood still after he approved a row on the phone. The rule used to treat any',
  '   entry in the local queue as unsent work. In cloud mode that queue is emptied only by a',
  '   LOAD whose watermark has passed the entry, so recording one disabled the auto-reload',
  '   until the very reload it was blocking: the fold would land, the id would move, and the',
  '   desk would offer a chip nobody had been told to watch for while every ledger tab held',
  '   the old build. Nothing is lost by reloading with a queue, because saveQueue() writes',
  '   localStorage before it posts anything and the load reads it straight back.',
  '   The same tick retries a held entry, which is what gets a phone write to the cloud',
  '   without waiting for the next open.',
  '   IT POSTS ONLY WHAT THE CLOUD HAS NOT TAKEN, from 26 Sep 2026: an entry newer than the',
  '   acknowledged mark, or a change the mark cannot see (qDirty, set by saveQueue). It used to post',
  '   whenever the queue held anything, so an acknowledged, refused or stuck entry went every ten',
  '   seconds while the desk was on screen, each post a drafter run over the whole book. A desk that',
  '   cannot answer the question still posts, because a post is idempotent. */',
  'var SALT_BUILD_ID=' + JSON.stringify(IDTOKEN) + ';',
  'var SALT_REV_MS=10000;',
  /* A PUSH WAKES AN OPEN DESK (26 Sep 2026). The push reached only public/sw.js, so an open desk learnt of a new build
     at its next /rev tick (mean 5 s) and of a new row at Approve's CARD_POLL (mean 15 s), and the rail's counts not
     until a reload. The worker now posts {salt:'wake'} to every desk it controls, and the listener below decides. */
  '/* THE WAKE. sw.js posts {salt:\'wake\'} to every desk it controls when a push lands, and this page decides what to read.',
  '   One refresh a burst: a tick\'s pushes (the customer\'s act, then its drafted row) land within about three seconds, so',
  '   the first wake waits this long and the rest ride on it. */',
  'var SALT_WAKE_MS=3000;',
  '(function(){',
  '  var chip=null,timer=null;',
  '  function idle(){try{',
  '    var a=document.activeElement;',
  '    if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return false;',
  "    if(document.querySelector('dialog[open]'))return false;",
  '    return true;',
  '  }catch(e){return false;}}',
  '  function offer(v){',
  '    if(chip||!document.body)return;',
  "    chip=document.createElement('button');chip.type='button';",
  "    chip.textContent='New ledger '+(v||'')+' \\u00b7 tap to load';",
  "    chip.setAttribute('style','position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));z-index:99999;font:600 13px/1.2 inherit;padding:10px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(24,15,44,.94);color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.45)');",
  '    chip.onclick=function(){location.reload();};',
  '    document.body.appendChild(chip);',
  '  }',
  '  function unsent(){',
  "    if(typeof qDirty!=='undefined'&&qDirty)return true;",
  "    if(typeof qNewestAt!=='function'||typeof qSentThrough==='undefined')return true;",
  '    return qNewestAt()>qSentThrough;',
  '  }',
  '  function tick(){',
  "    if(!window.SALT_CLOUD||document.visibilityState!=='visible')return;",
  "    try{if(typeof queue!=='undefined'&&queue&&queue.length&&typeof qSyncState!=='undefined'&&qSyncState==='server'&&typeof qPost==='function'&&unsent())qPost();}catch(e){}",
  "    fetch('rev',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){",
  '      if(!j||!j.id||j.id===SALT_BUILD_ID)return;',
  '      if(idle())location.reload(); else offer(j.v);',
  '    }).catch(function(){});',
  '  }',
  "  window.addEventListener('load',function(){if(!timer){timer=setInterval(tick,SALT_REV_MS);tick();}});",
  '  /* The wake reads what the load and the pollers read: the build first, then Approve\'s drafts and the site\'s orders,',
  '   which the rail\'s counts need with neither part on screen. Under the pollers\' own guards: never into a hidden page',
  '   (the wake is kept for its return), never over a decision in flight, never over a field being typed on Site orders,',
  '   and never for a desk holding no write key. It touches nothing else, so a locked vault still draws codes. */',
  '  var wakeT=null,wakeOwed=false;',
  '  function wake(){',
  '    wakeT=null;',
  '    if(!window.SALT_CLOUD)return;',
  "    if(document.visibilityState!=='visible'){wakeOwed=true;return;}",
  '    wakeOwed=false;',
  '    tick();',
  '    try{',
  "      if(typeof saltWriteKey!=='function'||!saltWriteKey())return;",
  "      if(typeof apLoad==='function'&&!(typeof apBusy!=='undefined'&&apBusy&&Object.keys(apBusy).length))apLoad(true);",
  "      var b=document.getElementById('ordBox'),a=document.activeElement;",
  "      if(typeof ordLoad==='function'&&!(typeof ordBusy!=='undefined'&&ordBusy&&Object.keys(ordBusy).length)&&!(b&&a&&b.contains(a)&&a.tagName==='INPUT'))ordLoad(true);",
  '    }catch(e){}',
  '  }',
  "  try{if(navigator.serviceWorker&&navigator.serviceWorker.addEventListener)navigator.serviceWorker.addEventListener('message',function(e){",
  "    if(!e||!e.data||e.data.salt!=='wake'||wakeT)return;",
  '    wakeT=setTimeout(wake,SALT_WAKE_MS);',
  '  });}catch(e){}',
  "  document.addEventListener('visibilitychange',function(){if(document.visibilityState!=='visible')return;if(wakeOwed&&!wakeT)wake();else tick();});",
  '})();',
  '</' + 'script>',
  '<!-- END cloud/PWA -->'
].join(EOL);

/* P1 WAS A PATCH AND IS NOW A CHECK, at master v276. The build used to add viewport-fit
   because only the phone needed it. The master added it for itself in the portrait pass, so
   the anchor this patch looked for no longer exists and the build failed loudly, which is
   exactly what the anchors are for: it caught a master change that would otherwise have
   shipped a phone build with no safe-area handling, or none at all.
   Keeping it as an assertion rather than deleting it means the phone cannot silently lose
   viewport-fit if someone ever trims that meta tag back on the master. */
requireOnce("P1 viewport-fit (master-owned since v276)",
  'content="width=device-width, initial-scale=1, viewport-fit=cover"',
  'The master must carry viewport-fit=cover on its viewport meta. Without it the phone is letterboxed on a notched screen and the safe-area padding added at v276 resolves to zero.');

replaceOnce("P2 head PWA block",
  '<title>Salt Command</title>',
  '<title>Salt Command</title>' + EOL + PWA_BLOCK);

replaceOnce("P3 qInit cloud branch",
  "    if(r.ok&&(await r.json()).ok){qSyncState='server';renderQueue();qStatus(qNote());renderRole();await vaultLoad();await bioLoad();qHeartbeat();}",
  "    const j=r.ok?await r.json():{}; if(j.ok){qSyncState='server';window.SALT_CLOUD=!!j.cloud;renderQueue();qStatus(qNote());renderRole(); if(j.cloud){ await vaultLoad(); if(queue&&queue.length){qPost();} } else { await vaultLoad();await bioLoad();qHeartbeat(); } }");

/* 12 Sep 2026: the status is a dot and a word under the name now, so the two anchors moved with it */
replaceOnce("P4a renderRole cloud tooltip",
  "  el.title=live?'Served by serve_desk.py, so this copy writes salt_queue.json and salt_vault.json to disk.'",
  "  el.title=live?(window.SALT_CLOUD?'Cloud desk. A tap queues the entry, the drafter measures it within seconds, and an approval folds and deploys on arrival. Names arrive sealed and need the passphrase.':'Served by serve_desk.py, so this copy writes salt_queue.json and salt_vault.json to disk.')");

replaceOnce("P4b renderRole cloud label",
  "  el.innerHTML='<i></i><span class=\"dhword\">'+(live?'master':'read only'+(loc?'':', not served'))+'</span>';",
  "  el.innerHTML='<i></i><span class=\"dhword\">'+(live?(window.SALT_CLOUD?'cloud':'master'):'read only'+(loc?'':', not served'))+'</span>';");

replaceOnce("P5 qNote cloud line",
  "  if(qSyncState==='server')return 'Saved to <b>'+QFILE+'</b> in this folder; the daily run reads it.';",
  "  if(qSyncState==='server'&&window.SALT_CLOUD)return 'Queued. Drafted in seconds, folded when you approve it.';" + EOL +
  "  if(qSyncState==='server')return 'Saved to <b>'+QFILE+'</b> in this folder; the daily run reads it.';");

replaceOnce("P6a qPost success line",
  "    qStatus('Saved <b>'+QFILE+'</b> to this folder &mdash; '+j.entries+' queued.');",
  "    qStatus(window.SALT_CLOUD?('Pushed to the cloud queue &mdash; '+j.entries+' queued, drafted within seconds, folded on approval.'):('Saved <b>'+QFILE+'</b> to this folder &mdash; '+j.entries+' queued.'));");

replaceOnce("P6b qPost offline branch",
  "    qSyncState='download'; qStatus('<b style=\"color:var(--amber)\">The desk server stopped answering</b> &mdash; falling back to downloads. Restart start_desk.bat for in-place saves.');",
  "    if(window.SALT_CLOUD){qStatus('<b style=\"color:var(--amber)\">No signal</b> &mdash; held on this device; it syncs on the next open with a connection.');return false;} qSyncState='download'; qStatus('<b style=\"color:var(--amber)\">The desk server stopped answering</b> &mdash; falling back to downloads. Restart start_desk.bat for in-place saves.');");

replaceOnce("P7 qPayload device id",
  "function qPayload(){return JSON.stringify({updated:new Date().toISOString(),desk:LAST_UPDATED,queue},null,1);}",
  "function qPayload(){return JSON.stringify({updated:new Date().toISOString(),desk:LAST_UPDATED,device:(typeof saltDeviceId==='function'?saltDeviceId():'anon'),queue},null,1);}");

/* P8 THERE IS NO WAY OUT TO OFFER (v376). v332 turned the desk's Close control into a link back
   to the phone app, because opened from the installed app the desk filled a standalone window
   with no address bar and a Close that window.close() cannot honour. v376 merged the two: the
   desk IS the root now, so the link would go to the page it is already on. The control is simply
   not drawn in this build. The laptop desk keeps it, because there Close writes the queue and
   stops a real server. Decided at build time for the same reason as before: the built file is
   never served anywhere else, and SALT_CLOUD is only known after the ping. */
replaceOnce("P8 exit control not drawn",
  "  document.body.appendChild(b);})();",
  "  /* v376: not appended. The desk is the root; there is nowhere back to. */ })();");

/* ---- guard: the deploy must load nothing off a third-party origin (CSP is self-only) */
const externals = [];
for (const re of [/\bsrc\s*=\s*["']https?:\/\//gi, /url\(\s*["']?https?:\/\//gi, /@import[^;\n]*https?:\/\//gi]) {
  let mm; while ((mm = re.exec(src))) externals.push(src.slice(mm.index, mm.index + 60).replace(/\s+/g, " "));
}
if (externals.length) {
  console.error("BUILD FAILED: the built desk loads external resources, which the CSP forbids:");
  for (const x of externals.slice(0, 12)) console.error("  " + x);
  process.exit(1);
}

/* ---- the build id, and the manifest the phone polls -------------------------------
   The id is a hash of the built file with the id itself still a placeholder, so it
   changes whenever anything else does and never chases its own tail. rev.json is the
   only thing the ten-second poll fetches: a few dozen bytes, served no-store, so the
   cost of being current is a rounding error against the 800 KB desk. */
/* THE ID COVERS BOTH SURFACES. The phone polls /rev and reloads when this changes, and
   since v290 there are two things it could be running: the app at / and the desk at /desk.
   Hashing the desk alone would leave an app-only change invisible to the poll, so a phone
   would sit on the old app until something in the master happened to move. */
/* AND THE SERVICE WORKER, added v302. It was left out and the fault showed at once: the
   sw.js fix that stops /drafts being cached did not move this id, so update.mjs compared
   equal ids, skipped the deploy and reported the phone current while the broken worker was
   still the one being served. Same shape as the wrangler.jsonc gap CLAUDE.md documents, and
   worse here, because sw.js decides what the phone is allowed to see at all. Anything that
   ships and changes behaviour belongs in this hash.
   THE SEPARATORS ARE NUL BYTES, not spaces, and that is not decoration: a byte that cannot
   occur in any of these sources is the only separator that makes the concatenation
   unambiguous, so no edit to one file can ever forge the hash of another. */
/* AND THE WORKER ITSELF, added the same day for the same reason. src/worker.js and
   src/drafter.js ship on every deploy and decide what the phone is served and what the cron
   writes; a change to either that did not move this id would sit undeployed while update.mjs
   reported the phone current. Read as a sorted directory rather than a list of filenames, so
   a new module added to src/ is covered the day it is written and nobody has to remember. */
let workerSrc = "";
try {
  const dir = resolve(REPO, "src");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".js")).sort())
    workerSrc += f + " " + readFileSync(resolve(dir, f), "utf8") + " ";
} catch (e) { /* no src is not a build failure; the assets still deploy */ }
let swSrc = "";
try { swSrc = readFileSync(resolve(REPO, "public", "sw.js"), "utf8"); } catch (e) { /* likewise */ }
const BUILD_ID = createHash("sha256")
  .update(src).update(" sw ").update(swSrc).update(" worker ").update(workerSrc)
  .digest("hex").slice(0, 16);
if (src.split(IDTOKEN).length - 1 !== 1) {
  console.error(`BUILD FAILED: expected the build-id token exactly once, found ${src.split(IDTOKEN).length - 1}.`);
  console.error("  The freshness patch in PWA_BLOCK is the only thing that may carry it.");
  process.exit(1);
}
src = src.split(IDTOKEN).join(BUILD_ID);

/* the version the desk is stamped with, read from the master's one-entry evolution */
let VER = "";
try { VER = (src.match(/const evolution=\[\{\s*"?v"?\s*:\s*['"](v\d+)['"]/) || [])[1] || ""; } catch (e) { }

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, src);
/* THE STAMP MOVES ONLY WITH THE ID (26 Sep 2026). `built` was stamped afresh on every build, so a
   build of an unchanged master still dirtied rev.json, and tools/update.mjs committed and pushed it:
   12 of 60 laptop commits changed that stamp and nothing else, each one starting CI, a cloud-commit
   run and a Workers Build for nothing shipped. Kept while the id stands, two builds of one master
   leave public/ byte-identical, and ship-check's seven-day warning reads the last build that
   changed anything, which is what it was written to ask. */
let prevRev = null;
try { prevRev = JSON.parse(readFileSync(REV, "utf8")); } catch (e) { /* none yet, or unreadable: stamp afresh */ }
const BUILT = prevRev && prevRev.id === BUILD_ID && typeof prevRev.built === "string" ? prevRev.built : new Date().toISOString();
writeFileSync(REV, JSON.stringify({ ok: true, v: VER, id: BUILD_ID, built: BUILT }) + "\n");
const kb = (Buffer.byteLength(src) / 1024).toFixed(0);
/* THE DESK'S ONE RUNTIME ASSET, AND IT IS NOW SOURCE RATHER THAN A COPY.
   ensureChart() loads `assets/chart.umd.js` from the same origin rather than a CDN, which is
   what keeps the desk self-contained and inside a self-only CSP: script-src is 'self' and
   this is same-origin, so nothing here needs a CSP change.

   It used to be COPIED in from beside the master, and that step died on 20 Aug 2026 when the
   master moved into this repo and left its assets folder behind in the Per-Crm01 project folder.
   Every build since printed "not found beside the master" and copied nothing. Charts went on
   working only because public/assets/chart.umd.js is committed and served exactly as it sits,
   so the warning was true, harmless and ignored for six days, which is the worst of the three.

   v380: THE COMMITTED FILE IS THE SOURCE. It is tracked in this repo at the path it ships
   from, so there is nothing left to copy and a second copy would only be a thing to drift.
   The build proves it is there and FAILS if it is not, because rev.json's id does not hash
   it: a missing asset moves no id, so update.mjs would compare equal, skip the deploy and
   report the desk current. That is the silent shape this repo keeps relearning, and a warning
   nobody reads is not a guard. To change the library, replace this file and commit it. */
const ASSET = resolve(REPO, "public", "assets", "chart.umd.js");
if (!existsSync(ASSET)) {
  console.error("BUILD FAILED: public/assets/chart.umd.js is missing, so the desk would draw no charts.");
  console.error("  It is tracked in this repo and is the only copy. Restore it with:");
  console.error("    git checkout -- public/assets/chart.umd.js");
  process.exit(1);
}
console.log(`  asset:   chart.umd.js present, ${(statSync(ASSET).size / 1024).toFixed(0)} KB`);
console.log(`BUILD OK: ${OUT}`);
console.log(`  master:  ${MASTER}`);
console.log(`  size:    ${kb} KB   eol: ${EOL === "\r\n" ? "CRLF" : "LF"}`);
console.log(`  patches: ${applied.length} applied — ${applied.join(", ")}`);
console.log(`  rev:     ${VER || "(no version found)"}  id ${BUILD_ID}  -> public/rev.json`);

