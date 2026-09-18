/* tools/stmt-send.mjs: THE SEND SHEET. One page, one card per customer, for the monthly send.
 *
 * WHY IT EXISTS. Issuing thirty-seven statements is one command; SENDING them was thirty-seven
 * trips between a folder of HTML files, _users.json for the username, and _passwords.json for the
 * password, composing the same message by hand each time. That is where a month's care gets lost:
 * the wrong password pasted under the wrong name, and a customer looking at somebody else's
 * account. This page puts the three things that belong to one customer in one place and gives
 * each card a button.
 *
 * IT IS LAPTOP-ONLY AND GITIGNORED, for the same reason _passwords.json is. It carries every
 * password in the issue, so it is a credential store with a nice face on it. It is written beside
 * the statements, never committed, and never sent: like the review sheet it puts every account
 * beside every other, which is the one thing a statement must never do.
 *
 * TWO MESSAGES, AND THE SPLIT IS THE WHOLE POINT. The first carries the link and the username and
 * no secret at all; the second carries the password and nothing else. They are separate buttons
 * because they are meant to travel by separate routes, and a single button that sent both would
 * quietly undo the reason the password exists. The copy on the page says so.
 *
 * NOTHING LOADS FROM OUTSIDE. Rule 4 of the repo: no CDN, no web font, no external script. The QR
 * is drawn on a canvas from the matrix computed here, which is also what makes the image
 * shareable: the same canvas becomes the PNG the Share sheet carries.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { qrMatrix } from "./qr.mjs";
import { saltTokens } from "./stmt-style.mjs";

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* v688: THE WORDS LIVE IN stmt/send.js, so this sheet and Send statement on his master account
   cannot drift. They are imported for this sheet's own use and re-exported because the suite and
   make_statements.mjs take them from here. */
import { linkMessage, passwordMessage, totalsLine, monthNameOf } from "../stmt/send.js";
export { linkMessage, passwordMessage, totalsLine, monthNameOf };

const LAYER = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;padding:36px 20px 80px;color:var(--salt-text);
  background:radial-gradient(1200px 640px at 82% -12%, rgba(184,115,51,.16) 0%, transparent 62%),
    radial-gradient(900px 560px at -10% 6%, rgba(197,160,89,.10) 0%, transparent 58%),var(--salt-obsidian);
  background-attachment:fixed;font-family:var(--salt-font-display);
  font-size:var(--salt-text-md);line-height:1.6;-webkit-font-smoothing:antialiased}
.w{max-width:1080px;margin:0 auto}
.eyebrow{font-size:var(--salt-text-xs);letter-spacing:.32em;color:var(--salt-copper);
  font-weight:700;margin:0 0 10px;text-transform:uppercase;font-family:var(--salt-font-mono)}
h1{margin:0 0 8px;font-size:var(--salt-text-2xl);font-weight:600;letter-spacing:-.01em}
.sub{color:var(--salt-text-muted);font-size:var(--salt-text-sm);margin:0 0 22px;line-height:1.7}
.warn{border:1px solid rgba(212,105,76,.4);border-radius:var(--salt-radius-md);padding:14px 18px;
  background:rgba(212,105,76,.08);color:var(--salt-mist-light);font-size:var(--salt-text-sm);
  line-height:1.7;margin:0 0 24px}
.warn b{color:var(--salt-ember)}
/* the bar: a search and a count, sticky so it survives thirty-seven cards */
.bar{position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;flex-wrap:wrap;
  padding:12px 16px;margin:0 0 22px;background:var(--salt-veil);border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-sm);backdrop-filter:blur(10px)}
.bar input{flex:1 1 220px;min-height:var(--salt-tap);padding:10px 14px;font-size:16px;
  font-family:var(--salt-font-mono);color:var(--salt-text);background:var(--salt-well);
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);outline:none}
.bar input:focus{border-color:var(--salt-brass)}
.bar .n{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-text-muted);
  font-variant-numeric:tabular-nums;white-space:nowrap}
.bar .n b{color:var(--salt-brass)}
.bar button{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.06em;
  color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-pill);padding:8px 14px;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
/* a pane is white 3% with a brass hairline: glass once, decision 4 */
.card{border:1px solid var(--salt-line);border-radius:var(--salt-radius-md);
  background:var(--salt-glass);padding:18px 20px 20px;display:flex;flex-direction:column;gap:2px}
.card.done{opacity:.5}
.card.hide{display:none}
.who{font-family:var(--salt-font-mono);font-size:var(--salt-text-lg);font-weight:700;
  letter-spacing:.06em;color:var(--salt-text);margin:0}
.un{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-brass);
  letter-spacing:.1em;margin:2px 0 0}
.site{display:inline-block;margin:6px 0 0;font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);
  color:var(--salt-copper);letter-spacing:.02em;word-break:break-all;text-decoration:underline;
  text-underline-offset:3px;min-height:var(--salt-tap);line-height:var(--salt-tap)}
.site:hover{color:var(--salt-brass)}
.tot{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);color:var(--salt-text-muted);
  margin:6px 0 0;font-variant-numeric:tabular-nums}
.qrw{display:flex;gap:14px;align-items:center;margin:14px 0 4px}
canvas{background:var(--salt-salt);border-radius:var(--salt-radius-sm);display:block;flex:0 0 auto;
  width:104px;height:104px;image-rendering:pixelated}
.qrn{font-size:var(--salt-text-xs);color:var(--salt-text-muted);line-height:1.6;margin:0}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
button.act{min-height:var(--salt-tap);padding:11px 15px;font-family:var(--salt-font-mono);
  font-size:var(--salt-text-sm);font-weight:700;letter-spacing:.03em;cursor:pointer;
  border-radius:var(--salt-radius-pill);border:1px solid var(--salt-line);
  background:none;color:var(--salt-text)}
button.act.lead{background:var(--salt-gradient);color:var(--salt-obsidian);border:0}
button.act.pw{border-color:rgba(212,105,76,.45);color:var(--salt-ember)}
button.act:active{transform:translateY(1px)}
button.act.ok{border-color:var(--salt-verdigris);color:var(--salt-verdigris)}
.tick{margin-top:12px;display:flex;align-items:center;gap:8px;font-size:var(--salt-text-sm);
  color:var(--salt-text-muted);cursor:pointer;user-select:none}
.tick input{width:18px;height:18px;accent-color:var(--salt-verdigris);cursor:pointer}
.msg{margin:10px 0 0;font-size:var(--salt-text-xs);color:var(--salt-text-muted);min-height:1.3em;
  font-family:var(--salt-font-mono)}
.msg.ok{color:var(--salt-verdigris)}
.msg.bad{color:var(--salt-ember)}
details.peek{margin-top:10px}
details.peek summary{font-size:var(--salt-text-xs);color:var(--salt-text-muted);cursor:pointer;
  font-family:var(--salt-font-mono);letter-spacing:.04em}
details.peek pre{white-space:pre-wrap;word-break:break-word;font-family:var(--salt-font-mono);
  font-size:var(--salt-text-xs);color:var(--salt-mist-light);background:var(--salt-well);
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);padding:10px 12px;margin:8px 0 0}
@media print{body{display:none}}
`;

/* The page's script. Kept as one string so the sheet is a single self-contained file: it is opened
   off the disk, so there is nothing to fetch it from. */
const JS = `
(function(){
  var ROWS = __ROWS__;
  var grid = document.getElementById('grid');
  var q = document.getElementById('q');
  var count = document.getElementById('count');
  var KEY = 'salt-send-' + __ISSUE__;
  var sent = {};
  try { sent = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) { sent = {}; }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(sent)); } catch(e){} }

  /* THE QR IS DRAWN, NOT FETCHED. The matrix is computed at generation time and shipped as rows of
     0 and 1; the canvas is both what you see and what the Share sheet carries as a PNG. */
  function draw(cv, rows){
    var n = rows.length, quiet = 4, side = n + quiet * 2, px = 8;
    cv.width = side * px; cv.height = side * px;
    var g = cv.getContext('2d');
    g.fillStyle = '#f2f4f5'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#05080a';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      if (rows[r][c] === '1') g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
  }

  function flash(el, text, cls){
    el.textContent = text; el.className = 'msg' + (cls ? ' ' + cls : '');
    setTimeout(function(){ if (el.textContent === text) { el.textContent = ''; el.className = 'msg'; } }, 2600);
  }

  /* Two ways to copy, because a page opened from a file has no origin the Clipboard API trusts in
     every browser, and the fallback is the one that has always worked. */
  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; } catch(e){}
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly','');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch(e) { return false; }
  }

  function toBlob(cv){
    return new Promise(function(res){
      try { cv.toBlob(function(b){ res(b); }, 'image/png'); } catch(e) { res(null); }
    });
  }

  ROWS.forEach(function(row, i){
    var card = document.createElement('div');
    card.className = 'card' + (sent[row.who] ? ' done' : '');
    card.innerHTML =
      '<p class="who"></p><p class="un"></p><a class="site" target="_blank" rel="noopener"></a><p class="tot"></p>'
      + '<div class="qrw"><canvas></canvas><p class="qrn">Scan or share the code.<br>It opens the '
      + 'statement with the username filled in.</p></div>'
      + '<div class="btns">'
      + '<button class="act lead" data-a="share">Share</button>'
      + '<button class="act" data-a="link">Copy message</button>'
      + '<button class="act pw" data-a="pw">Copy password</button>'
      + '</div>'
      + '<p class="msg"></p>'
      + '<label class="tick"><input type="checkbox"> Sent</label>'
      + '<details class="peek"><summary>See the message</summary><pre></pre></details>';
    card.querySelector('.who').textContent = row.who;
    card.querySelector('.un').textContent = row.user;
    /* THE ADDRESS IS A LINK (06 Sep 2026, his instruction): what the QR opens, opened from here, so
       a card can be checked against the live site without scanning it. Username filled in, as the
       code does; the password is still the other button. The backslashes are doubled because this
       script is a template literal: single, they were eaten, and the // that was left commented out
       the rest of the line, so the whole script failed to parse and no card drew (16 Sep 2026). */
    var site = card.querySelector('.site');
    site.href = row.url; site.textContent = row.url.replace(/^https?:\\/\\//, '');
    card.querySelector('.tot').textContent = row.tot;
    card.querySelector('pre').textContent = row.msg;
    var cv = card.querySelector('canvas');
    draw(cv, row.qr);
    var msg = card.querySelector('.msg');
    var box = card.querySelector('.tick input');
    box.checked = !!sent[row.who];
    box.addEventListener('change', function(){
      if (box.checked) { sent[row.who] = 1; card.classList.add('done'); }
      else { delete sent[row.who]; card.classList.remove('done'); }
      save(); tally();
    });
    card.addEventListener('click', async function(ev){
      var b = ev.target.closest('button[data-a]');
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'pw') {
        var ok = await copy(row.pw);
        flash(msg, ok ? 'password copied, send it on its own' : 'could not copy', ok ? 'ok' : 'bad');
        return;
      }
      if (a === 'link') {
        var ok2 = await copy(row.msg);
        flash(msg, ok2 ? 'message copied' : 'could not copy', ok2 ? 'ok' : 'bad');
        return;
      }
      /* SHARE CARRIES THE MESSAGE AND, WHERE THE BROWSER ALLOWS IT, THE CODE AS AN IMAGE. It never
         carries the password: that is the other button, on purpose. */
      var data = { text: row.msg };
      try {
        var blob = await toBlob(cv);
        if (blob && navigator.canShare) {
          var f = new File([blob], 'statement-' + row.user + '.png', { type: 'image/png' });
          if (navigator.canShare({ files: [f] })) data.files = [f];
        }
      } catch(e){}
      if (navigator.share) {
        try { await navigator.share(data); flash(msg, 'shared', 'ok'); }
        catch(e) { if (e && e.name !== 'AbortError') flash(msg, 'sharing was refused', 'bad'); }
      } else {
        var ok3 = await copy(row.msg);
        flash(msg, ok3 ? 'this browser cannot share, so the message is copied' : 'could not copy', ok3 ? 'ok' : 'bad');
      }
    });
    grid.appendChild(card);
    row.el = card;
  });

  function tally(){
    var shown = ROWS.filter(function(r){ return !r.el.classList.contains('hide'); });
    var done = shown.filter(function(r){ return !!sent[r.who]; }).length;
    count.innerHTML = '<b>' + done + '</b> of ' + shown.length + ' sent';
  }
  q.addEventListener('input', function(){
    var t = q.value.trim().toLowerCase();
    ROWS.forEach(function(r){
      var hit = !t || r.who.toLowerCase().indexOf(t) >= 0 || r.user.indexOf(t) >= 0;
      r.el.classList.toggle('hide', !hit);
    });
    tally();
  });
  document.getElementById('reset').addEventListener('click', function(){
    if (!confirm('Clear every sent tick for this issue?')) return;
    sent = {}; save();
    ROWS.forEach(function(r){ r.el.classList.remove('done'); r.el.querySelector('.tick input').checked = false; });
    tally();
  });
  tally();
})();
`;

/** The whole send sheet. `rows` are the sheets makeStatements built, each with who, user, pw, url. */
export function sendSheet(rows, opts) {
  const o = opts || {};
  const monthName = o.monthName || "";
  const data = rows.map((r) => ({
    who: r.who,
    user: r.user,
    pw: r.pw,
    url: r.url,
    /* the same totals the statement itself foots to, formatted here because the generator's own
       formatter is not in scope at the point the rows are built */
    tot: totalsLine(r.t),
    msg: linkMessage(r, monthName),
    qr: qrMatrix(r.url).map((line) => line.join(""))
  }));
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + "<title>Send the " + esc(o.issue || "") + " statements</title>"
    + "<style>" + saltTokens() + LAYER + "</style></head><body><div class=\"w\">"
    + '<p class="eyebrow">Salt Command</p>'
    + "<h1>Send the " + esc(monthName || o.issue || "") + " statements</h1>"
    + '<p class="sub">One card per customer. <b>Share</b> or <b>Copy message</b> sends the link and '
    + "the username and no secret at all; <b>Copy password</b> is a second, separate message. Tick "
    + "each one as it goes, and the count follows you.</p>"
    + '<div class="warn"><b>This page is not for sending.</b> It holds every password in the issue '
    + "and puts every account beside every other, which is exactly what a statement must never do. "
    + "It stays on this machine: it is not committed and never leaves it. Send the two messages, "
    + "not the sheet.</div>"
    + '<div class="bar">'
    + '<input id="q" type="search" placeholder="find a code or username" aria-label="Find a customer">'
    + '<span class="n" id="count"></span>'
    + '<button id="reset" type="button">Clear ticks</button>'
    + "</div>"
    + '<div class="grid" id="grid"></div>'
    + "</div><script>"
    + JS.replace("__ROWS__", JSON.stringify(data)).replace("__ISSUE__", JSON.stringify(String(o.issue || "")))
    + "</script></body></html>";
}

/* ---- RUN IT ON ITS OWN, over an issue already made -----------------------------------
   The sheet is normally written by the issue that mints the passwords. This is for the case that
   put it here: an issue made BEFORE the sheet existed, or a sheet deleted after a send. It reads
   the folder rather than making anything, so nothing is re-encrypted, no password is re-minted and
   nothing in the repository changes. The statements and the records are not touched at all.

     node tools/stmt-send.mjs statements/2026-09 2026-09-01
*/
/* A CODE RE-KEYED SINCE THE ISSUE (Amend ID, v628) still has its card. The statement is filed under the code
   it was issued to, but _users.json has moved the username to the new code, and _passwords.json is gitignored,
   so a laptop fold moves its key and a cloud fold cannot. The username never changes, and the statement prints
   it (make_statements.mjs, "Your username is"), so it is read from there, the current code found from it, and
   the password looked for under either code. Seven cards were missing from the September sheet (16 Sep 2026). */
export function sheetParty(code, users, passwords, statementHtml) {
  const user = users[code] || (/Your username is <code>([^<]+)<\/code>/.exec(statementHtml || "") || [])[1];
  if (!user) return null;
  const who = Object.keys(users).find((c) => users[c] === user) || code;
  const pw = passwords[code] || passwords[who];
  return pw ? { who, user, pw } : null;
}

/* AN ASYNC main() CALLED WITHOUT AWAITING IT, and the reason is a deadlock this hit at once.
   make_statements.mjs imports THIS module statically, so when this file is the entry point a
   TOP-LEVEL `await import("./make_statements.mjs")` asks for a module that is waiting for this one
   to finish evaluating: node reports "unsettled top-level await" and exits 13. Letting evaluation
   finish first, then running, breaks the cycle. */
async function main() {
  const outDir = process.argv[2];
  const issue = process.argv[3];
  if (!outDir || !/^\d{4}-\d{2}-\d{2}$/.test(String(issue || ""))) {
    console.error("usage: node tools/stmt-send.mjs <statements/YYYY-MM> <YYYY-MM-DD issue date>");
    process.exit(2);
  }
  const here = resolve(outDir);
  const root = /^\d{4}-\d{2}$/.test(basename(here)) ? dirname(here) : here;
  const pwFile = join(here, "_passwords.json");
  const usersFile = join(root, "_users.json");
  for (const [f, what] of [[pwFile, "the passwords"], [usersFile, "the usernames"]]) {
    if (!existsSync(f)) {
      console.error("cannot find " + what + " at " + f
        + (f === pwFile ? "\nThat file is gitignored, so it exists only on the machine that made the issue." : ""));
      process.exit(1);
    }
  }
  const passwords = JSON.parse(readFileSync(pwFile, "utf8"));
  const users = JSON.parse(readFileSync(usersFile, "utf8"));
  const made = readdirSync(here)
    .map((f) => (new RegExp("^statement_(.+?)_" + issue + "\\.html$").exec(f) || [])[1])
    .filter(Boolean);
  if (!made.length) { console.error("no statement dated " + issue + " in " + here); process.exit(1); }

  const M = await import("./make_statements.mjs");
  const base = M.siteBaseUrl();
  const rows = [], missing = [];
  for (const code of made) {
    const html = readFileSync(join(here, "statement_" + code + "_" + issue + ".html"), "utf8");
    const p = sheetParty(code, users, passwords, html);
    if (!p) { missing.push(code); continue; }
    /* the same totals the statement itself foots to, read off the same rows it was built from */
    const o = { from: null, to: issue, completed: true, open: true, pending: true, dates: true };
    const r = M.stmtRows(p.who, o);
    const t = { n: r.filter((x) => !x.cancelled).length, total: 0, owed: 0 };
    r.forEach((x) => { if (x.cancelled) return; t.total += x.total; t.owed += x.owed; });
    rows.push({ who: p.who, user: p.user, pw: p.pw, t, url: base + "/?u=" + encodeURIComponent(p.user) });
  }
  rows.sort((a, b) => (a.who < b.who ? -1 : 1));
  if (missing.length) console.log("::warning::no username or password for: " + missing.join(", "));
  const file = join(here, "_send_" + issue + ".html");
  writeFileSync(file, sendSheet(rows, {
    issue,
    monthName: monthNameOf(issue)
  }));
  console.log("wrote " + file + "  (" + rows.length + " cards)");
  console.log("It holds every password in the issue, so it is gitignored and is never the thing you send.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
