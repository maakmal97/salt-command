/* build.mjs — produce public/index.html from the Cow-Crm01 master.
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

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT = resolve(REPO, "public", "index.html");

const DEFAULT_MASTER =
  "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/01_Dashboard/salt_command.html";
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
  '   moment the app leaves the foreground. lockVault() drops the passphrase and the',
  '   decrypted names, so returning shows codes until the password is re-entered. */',
  "document.addEventListener('visibilitychange',function(){",
  "  if(window.SALT_CLOUD&&document.visibilityState==='hidden'&&typeof lockVault==='function'){",
  '    try{lockVault();if(typeof renderReveal==="function")renderReveal();if(typeof render==="function")render();}catch(e){}',
  '  }',
  '});',
  '</' + 'script>',
  '<!-- END cloud/PWA -->'
].join(EOL);

replaceOnce("P1 viewport-fit",
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');

replaceOnce("P2 head PWA block",
  '<title>Salt Command</title>',
  '<title>Salt Command</title>' + EOL + PWA_BLOCK);

replaceOnce("P3 qInit cloud branch",
  "    if(r.ok&&(await r.json()).ok){qSyncState='server';renderQueue();qStatus(qNote());renderRole();await vaultLoad();await bioLoad();qHeartbeat();}",
  "    const j=r.ok?await r.json():{}; if(j.ok){qSyncState='server';window.SALT_CLOUD=!!j.cloud;renderQueue();qStatus(qNote());renderRole(); if(j.cloud){ await vaultLoad(); if(queue&&queue.length){qPost();} } else { await vaultLoad();await bioLoad();qHeartbeat(); } }");

replaceOnce("P4a renderRole cloud tooltip",
  '      +\'title="Served by serve_desk.py, so this copy writes salt_queue.json and salt_vault.json to disk.">\'',
  "      +(window.SALT_CLOUD?'title=\"Cloud desk, behind Cloudflare Access. New transactions push to the queue and reach the source at the next daily run.\">':'title=\"Served by serve_desk.py, so this copy writes salt_queue.json and salt_vault.json to disk.\">')");

replaceOnce("P4b renderRole cloud label",
  "      +'&#9679; master &middot; writes to disk</span>';",
  "      +(window.SALT_CLOUD?'&#9679; cloud &middot; pushes to source</span>':'&#9679; master &middot; writes to disk</span>');");

replaceOnce("P5 qNote cloud line",
  "  if(qSyncState==='server')return 'Record saves straight to <b>'+QFILE+'</b> in this folder, which the daily run reads. Nothing else to do. <b>Save queue file</b> writes it again on demand and <b>Copy queue</b> puts the lines on the clipboard.';",
  "  if(qSyncState==='server'&&window.SALT_CLOUD)return 'Record pushes each entry to the cloud queue, behind Cloudflare Access. The daily run folds it into the source; nothing else to do. <b>Copy queue</b> still puts the lines on the clipboard.';" + EOL +
  "  if(qSyncState==='server')return 'Record saves straight to <b>'+QFILE+'</b> in this folder, which the daily run reads. Nothing else to do. <b>Save queue file</b> writes it again on demand and <b>Copy queue</b> puts the lines on the clipboard.';");

replaceOnce("P6a qPost success line",
  "    qStatus('Saved <b>'+QFILE+'</b> to this folder &mdash; '+j.entries+' queued.');",
  "    qStatus(window.SALT_CLOUD?('Pushed to the cloud queue &mdash; '+j.entries+' waiting for the daily run.'):('Saved <b>'+QFILE+'</b> to this folder &mdash; '+j.entries+' queued.'));");

replaceOnce("P6b qPost offline branch",
  "    qSyncState='download'; qStatus('<b style=\"color:var(--amber)\">The desk server stopped answering</b> &mdash; falling back to downloads. Restart start_desk.bat for in-place saves.');",
  "    if(window.SALT_CLOUD){qStatus('<b style=\"color:var(--amber)\">No signal</b> &mdash; held on this device; it syncs on the next open with a connection.');return false;} qSyncState='download'; qStatus('<b style=\"color:var(--amber)\">The desk server stopped answering</b> &mdash; falling back to downloads. Restart start_desk.bat for in-place saves.');");

replaceOnce("P7 qPayload device id",
  "function qPayload(){return JSON.stringify({updated:new Date().toISOString(),desk:LAST_UPDATED,queue},null,1);}",
  "function qPayload(){return JSON.stringify({updated:new Date().toISOString(),desk:LAST_UPDATED,device:(typeof saltDeviceId==='function'?saltDeviceId():'anon'),queue},null,1);}");

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

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, src);
const kb = (Buffer.byteLength(src) / 1024).toFixed(0);
console.log(`BUILD OK: ${OUT}`);
console.log(`  master:  ${MASTER}`);
console.log(`  size:    ${kb} KB   eol: ${EOL === "\r\n" ? "CRLF" : "LF"}`);
console.log(`  patches: ${applied.length} applied — ${applied.join(", ")}`);
