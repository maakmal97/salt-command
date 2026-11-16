/* stmt/testsurface.js: THE TEST SURFACE'S SHELL (his answers of 18 Oct 2026, Asks 1, 3, 8 and 10). His page at /all/test, inside /all's
   gate: the two views as frames of this origin, side by side from 1080px and two tabs on a phone, the account they show, Reset (asked
   once, a second tap within four seconds), Reset all, Start empty for the fresh account, and the way to Make an account not yet made,
   which is Salt Admin's (it seals the account under the master this page never holds). THE VIEWS ARE landingPage, NEVER A COPY: this
   file draws only the frame around them. Built from the system's carried recipes and tokens alone. */
/* 16 Nov 2026, the move to Ambient (place E): the page's one head (stmt/page.js), Ambient and the site's layer; the frame is one Ambient shell: its hero, the
   account and the view as segments of the system, the moves as pills (every control 44px by the system's own), the two views the real landingPage in frames */
import { DOC_OPEN, SITE_STYLE, BODY_OPEN, ambScript } from "./page.js";
import { TS } from "./words.js";
import { TEST_USER, TEST_LOCKED, TEST_FRESH } from "./testusers.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const SHELL_ACCOUNTS = [[TEST_USER, "ts.open"], [TEST_LOCKED, "ts.locked"], [TEST_FRESH, "ts.fresh"]];
export const RESET_ARM_MS = 4000;

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
  /* the system's Segment presses the tapped choice and releases its neighbours, then says so (amb:change): the account and the view follow it */
  document.querySelectorAll('[name="tsAcct"]').forEach(function(b){ b.addEventListener('amb:change', function(){ pick(b.value); }); });
  document.querySelectorAll('.ts-tabs [data-view]').forEach(function(b){
    b.addEventListener('amb:change', function(){
      var c=b.getAttribute('data-view')==='c';
      cv.hidden=!c; av.hidden=c;
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
  const acct = ([u, k]) => '<button type="button" class="amb-segment__opt" name="tsAcct" value="' + u + '" aria-pressed="' + (u === TEST_FRESH ? "true" : "false") + '">' + w(k) + "</button>";
  const view = (v, k, on) => '<button type="button" class="amb-segment__opt" data-view="' + v + '" aria-pressed="' + on + '">' + w(k) + "</button>";
  return DOC_OPEN
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">'
    + "<title>Salt Counter</title>"
    + '<style nonce="' + nonce + '">' + SITE_STYLE + "</style></head>" + BODY_OPEN
    + '<div class="amb-shell" data-mood="slate"><main class="amb-screen">'
    + '<header class="amb-hero amb-hero--compact amb-mesh"><h1 class="amb-hero__title">' + w("ts.title") + '</h1><p class="amb-hero__sub">' + w("ts.lead") + "</p></header>"
    + '<div class="amb-stack ts-bar">'
    + '<h2 class="amb-section" id="tsAcctL">' + w("ts.acct") + "</h2>"
    + '<div class="amb-segment amb-segment--wrap" role="group" aria-labelledby="tsAcctL">' + SHELL_ACCOUNTS.map(acct).join("") + "</div>"
    + '<div class="ts-acts">'
    + '<button type="button" class="amb-pill amb-pill--quiet" id="tsReset">' + w("ts.reset") + "</button>"
    + '<button type="button" class="amb-pill amb-pill--quiet" id="tsAll">' + w("ts.resetAll") + "</button>"
    + '<button type="button" class="amb-pill amb-pill--quiet" id="tsEmpty">' + w("ts.empty") + "</button>"
    + '<a class="amb-pill amb-pill--quiet" id="tsMake" href="/all#shop/practice" target="_top" hidden>' + w("ts.make") + "</a></div>"
    + '<p class="amb-field__hint ts-say" id="tsSay" role="status" aria-live="polite"></p>'
    + '<div class="amb-segment ts-tabs" role="group" aria-label="' + w("ts.views") + '">' + view("c", "ts.customer", "true") + view("a", "ts.admin", "false") + "</div></div>"
    + '<div class="amb-stack ts-views"><iframe id="tsC" title="' + w("ts.customer") + '"></iframe><iframe id="tsA" title="' + w("ts.admin") + '" hidden></iframe></div>'
    + "</main></div>"
    + ambScript(nonce)
    + '<script nonce="' + nonce + '">'
    + SHELL_JS.replace("__WORDS__", () => JSON.stringify(TS).replace(/</g, "\\u003c")).replace("__STATE__", () => JSON.stringify(state || {}))
      .replace("__FRESH__", JSON.stringify(TEST_FRESH)).replace("__ARM__", String(RESET_ARM_MS))
    + "</script></body></html>";
}
