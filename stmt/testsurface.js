/* stmt/testsurface.js: THE TEST SURFACE'S SHELL (his answers of 18 Oct 2026, Asks 1, 3, 8 and 10). His page at /all/test, inside /all's
   gate: the two views as frames of this origin, side by side from 1080px and two tabs on a phone, the account they show, Reset (asked
   once, a second tap within four seconds), Reset all, Start empty for the fresh account, and the way to Make an account not yet made,
   which is Salt Account's (it seals the account under the master this page never holds). THE VIEWS ARE landingPage, NEVER A COPY: this
   file draws only the frame around them. Built from the system's carried recipes and tokens alone. */
import { DOC_OPEN, LOOK_HEAD } from "./page.js";
import { STATEMENT_CSS, SITE_RECIPES, FONT_FACE_CSS } from "./statement-css.js";
import { TS } from "./words.js";
import { TEST_USER, TEST_LOCKED, TEST_FRESH } from "./testusers.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const SHELL_ACCOUNTS = [[TEST_USER, "ts.open"], [TEST_LOCKED, "ts.locked"], [TEST_FRESH, "ts.fresh"]];
export const RESET_ARM_MS = 4000;

const SHELL_CSS = `
body{margin:0;background:var(--salt-obsidian);color:var(--salt-salt)}
.ts-bar{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-end;padding:16px}
.ts-bar h1{margin:0;font-size:22px;color:var(--salt-salt)}
.ts-lead,.ts-say{margin:4px 0 0;color:var(--salt-mist);font-size:14px}
.ts-say:empty{display:none}
.ts-accts{border:0;margin:0;padding:0;min-width:0}
.ts-accts .salt-options__grid{display:flex;flex-wrap:wrap;gap:8px}
.ts-acts{display:flex;flex-wrap:wrap;gap:8px}
/* the ghosts and the option faces are 44px tall by their recipes; an account's face is held 44px wide too */
.ts-accts .salt-option__face{min-width:var(--salt-tap);box-sizing:border-box}
.ts-tabs{display:flex;gap:8px;padding:0 16px 8px}
.ts-views{padding:0 16px 16px}
.ts-views iframe{vertical-align:top;width:100%;height:calc(100dvh - 190px);min-height:520px;border:1px solid var(--salt-line,transparent);border-radius:16px;background:var(--salt-obsidian)}
@media (min-width:1080px){
.ts-tabs{display:none}
.ts-views{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ts-views iframe[hidden]{display:block}
}
`;

/* the shell's script: no backtick and no lone backslash, as every script spliced from a template literal */
const SHELL_JS = `
(function(){
  var W=__WORDS__, STATE=__STATE__, FRESH=__FRESH__, ARM=__ARM__;
  var cv=document.getElementById('tsC'), av=document.getElementById('tsA'), say=document.getElementById('tsSay');
  var make=document.getElementById('tsMake'), empty=document.getElementById('tsEmpty'), cur=FRESH;
  function note(t){ say.textContent=t||''; }
  function reload(){ cv.src='/all/test/c?u='+encodeURIComponent(cur); av.src='/all/test/admin'; }
  function pick(u){
    cur=u; empty.hidden=u!==FRESH;
    var s=STATE[u]||'none'; make.hidden=s!=='none';
    note(s==='none'?W['ts.none']:s==='waiting'?W['ts.waiting']:'');
    reload();
  }
  document.querySelectorAll('input[name="tsAcct"]').forEach(function(r){ r.addEventListener('change', function(){ if(r.checked) pick(r.value); }); });
  document.querySelectorAll('.ts-tabs [data-view]').forEach(function(b){
    b.addEventListener('click', function(){
      var c=b.getAttribute('data-view')==='c';
      cv.hidden=!c; av.hidden=c;
      document.querySelectorAll('.ts-tabs [data-view]').forEach(function(x){ x.setAttribute('aria-selected', String(x===b)); });
    });
  });
  /* RESET ASKS ONCE: the first tap arms it and says so on the control; a second within ARM clears; left alone it lets go */
  function armed(btn, word, body, done){
    var t=null;
    btn.addEventListener('click', async function(){
      if(!t){ btn.textContent=W['ts.ask']; t=setTimeout(function(){ t=null; btn.textContent=W[word]; }, ARM); return; }
      clearTimeout(t); t=null; btn.textContent=W[word]; btn.disabled=true;
      try{
        var r=await fetch('/all/test/reset', {method:'POST', cache:'no-store', headers:{'content-type':'application/json'}, body:JSON.stringify(body())});
        var j=null; try{ j=await r.json(); }catch(e){ j=null; }
        if(r.ok&&j&&j.ok){ note(W[done]); reload(); } else note((j&&j.error)||W['ts.fail']);
      }catch(e){ note(W['ts.fail']); }
      btn.disabled=false;
    });
  }
  armed(document.getElementById('tsReset'), 'ts.reset', function(){ return {u:cur}; }, 'ts.done');
  armed(document.getElementById('tsAll'), 'ts.resetAll', function(){ return {all:true}; }, 'ts.done');
  armed(empty, 'ts.empty', function(){ return {u:FRESH, empty:true}; }, 'ts.emptied');
  pick(cur);
})();
`;

/* state: {<username>: 'ready' | 'waiting' | 'none'}, read by the Worker off each account's record and its sealed fixture */
export function testShell(nonce, state) {
  const w = (k) => esc(TS[k]);
  const acct = ([u, k]) => '<label class="salt-option"><input class="salt-option__input" type="radio" name="tsAcct" value="' + u + '"'
    + (u === TEST_FRESH ? " checked" : "") + '><span class="salt-option__face"><span class="salt-option__label">' + w(k) + "</span></span></label>";
  return DOC_OPEN
    + '<script nonce="' + nonce + '">' + LOOK_HEAD + "</script>"
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">'
    + "<title>Salt Counter</title>"
    + '<style nonce="' + nonce + '">' + FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES + SHELL_CSS + "</style></head><body>"
    + '<header class="ts-bar"><div><h1>' + w("ts.title") + '</h1><p class="ts-lead">' + w("ts.lead") + "</p></div>"
    + '<fieldset class="salt-options ts-accts"><legend class="salt-options__legend">' + w("ts.acct") + '</legend><div class="salt-options__grid">'
    + SHELL_ACCOUNTS.map(acct).join("") + "</div></fieldset>"
    + '<div class="ts-acts">'
    + '<button type="button" class="salt-ghost" id="tsReset">' + w("ts.reset") + "</button>"
    + '<button type="button" class="salt-ghost" id="tsAll">' + w("ts.resetAll") + "</button>"
    + '<button type="button" class="salt-ghost" id="tsEmpty">' + w("ts.empty") + "</button>"
    + '<a class="salt-ghost" id="tsMake" href="/all#shop/practice" target="_top" hidden>' + w("ts.make") + "</a></div>"
    + '<p class="ts-say" id="tsSay" role="status" aria-live="polite"></p></header>'
    + '<div class="ts-tabs" role="tablist" aria-label="' + w("ts.views") + '">'
    + '<button type="button" class="salt-ghost" role="tab" data-view="c" aria-selected="true">' + w("ts.customer") + "</button>"
    + '<button type="button" class="salt-ghost" role="tab" data-view="a" aria-selected="false">' + w("ts.admin") + "</button></div>"
    + '<main class="ts-views"><iframe id="tsC" title="' + w("ts.customer") + '"></iframe><iframe id="tsA" title="' + w("ts.admin") + '" hidden></iframe></main>'
    + '<script nonce="' + nonce + '">'
    + SHELL_JS.replace("__WORDS__", () => JSON.stringify(TS).replace(/</g, "\\u003c")).replace("__STATE__", () => JSON.stringify(state || {}))
      .replace("__FRESH__", JSON.stringify(TEST_FRESH)).replace("__ARM__", String(RESET_ARM_MS))
    + "</script></body></html>";
}
