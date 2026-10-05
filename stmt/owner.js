/* stmt/owner.js: THE MASTER ACCOUNT'S OWN SCRIPT (v687, his instruction of 18 Sep 2026).
 *
 * WHY IT IS A FILE OF ITS OWN. All of this used to sit inside CLIENT_JS, which is one string
 * served on the customer's door as well as on /all. Only the markup was gated, so every customer
 * was handed the roster code, the guest-link calls and the word "master", and anything added to
 * the master account would have travelled with them. It is now spliced into the page at
 * /*__OWNER_JS__*\/ and only when the route is the owner's, so a customer's page carries none of
 * it and the suite proves that.
 *
 * It is written as the rest of the page is: no imports, no build step, ES5 in a template literal
 * (so every backslash is doubled), and it runs inside CLIENT_JS's own function, which is where
 * say(), el(), stamp(), un, pw, whoacct, busy and OWNER live.
 *
 * WHAT IT DRAWS. Four places (S9): Needs you, a card for each thing waiting on him with its action on
 * it; Accounts, one list for what Send and Review were, read off /all/sheet, the publish's account
 * list merged with the opens this Worker records, a row opening the account's card; Links; and More.
 * View as them opens the account the customer's own way, through the form. */

import { MAKER_GEO_JS } from "./maker-geo.js";

export const OWNER_JS = `
  var makerGeo=${MAKER_GEO_JS};
  var mHome=document.getElementById('mHome'), oAccts=document.getElementById('oAccts'),
      oLinks=document.getElementById('oLinks'), oMore=document.getElementById('oMore'),
      oCards=document.getElementById('oCards'), oMaker=document.getElementById('oMaker'), aopen=document.getElementById('aopen'),
      sheet=null, sheetAt=null, sheetRows=[], sheetIssue=null, cards=null, deskWait=null;
  /* S9 9.2: Needs you, Accounts, Links, Maker and More; the report card is a page of More */
  var PLACE={accounts:'accounts', links:'links', maker:'maker', more:'more', cards:'more'};
  function panel(which){
    if(which==='needs') which=null;
    mHome.hidden=!!which;
    oAccts.hidden=(which!=='accounts');
    oLinks.hidden=(which!=='links');
    oMore.hidden=(which!=='more');
    oCards.hidden=(which!=='cards');
    oMaker.hidden=(which!=='maker');
    if(which!=='maker'){ stopMakerChat(); makerSlipLock(); }
    var here=which?PLACE[which]:'needs';
    [].slice.call(document.querySelectorAll('.place[data-m]')).forEach(function(b){
      if(b.getAttribute('data-m')===here) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    say('');
    if(which==='links'){ if(!linksRead) loadLinks(); else drawLinks(); }
    if(!which) drawNeeds();
    if(which==='accounts'){ drawRoster(); if(!sheet) loadSheet(); }
    if(which==='cards'){ if(!cards) loadCards(); else drawCards(); }
    if(which==='maker'){ loadMaker(); loadMakerHours(); loadMakerInputs(); loadMakerThreads(false); loadMakerBulletin(); loadMakerPools(); loadMakerClaims(); }
    try{ window.scrollTo(0,0); }catch(e){}
  }
  /* ---- WHERE AN ACCOUNT STANDS ---------------------------------------------------------------
     The list is the roster, so a code with no account behind its username is still on it and
     says so. Everything else comes from /all/sheet. */
  var FLAGW={owes:'Owes',goods:'Owes goods',refund:'Refund due',pend:'Agreed, not actioned',clear:'Clear'};
  /* 23 SEP 2026: THE ACCOUNT IS ONE LIVE DOCUMENT (v769), so there is no issue for an account to be
     missing from. A row with no totals is a username with nothing behind it, and that is what it
     says. D15 (24 Sep 2026): the fold binds a spare account at Add ID and this run's publish opens it,
     so a row reads this only when no spare was free, and the laptop's next update makes it. The level
     is the stranger's, named by the book through the sheet, never here; S9 fix: the sheet is the one
     source, so Needs you, a row and a card say the same level the moment the sheet lands, whether or not
     the links have. */
  var stranger=null;
  function waitLine(){ return 'Made at the next laptop update.'+(stranger?' Until then, show the '+stranger+' link.':''); }
  function flagLine(a){
    if(!a.t||!a.flag) return waitLine();
    var t=a.t;
    if(a.flag==='owes') return FLAGW.owes+' '+rm(t.owed);
    if(a.flag==='goods') return FLAGW.goods+' '+unitsOf(Math.round(t.toGet*100)/100);
    if(a.flag==='refund') return FLAGW.refund+' '+rm(t.refund);
    if(a.flag==='pend') return FLAGW.pend+' '+rm(t.pend);
    return FLAGW.clear;
  }
  function openedLine(a){
    if(!a.seen||!a.seen.opens) return 'Not opened';
    return 'Opened '+stampDay(a.seen.last)+(a.seen.opens>1?' \\u00b7 '+a.seen.opens+' times':'');
  }
  async function loadSheet(){
    try{
      var j=await refs('/all/sheet');
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null; deskWait=j.desk||null; stranger=j.stranger||null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      drawRoster(); drawTest(); drawNeeds(); drawNeedOpen(true);
      if(aOpen) openCard(aOpen);
      var n=document.getElementById('mCount'), real=sheetRows.filter(function(a){ return !a.test; }).length;
      /* the count is of accounts on the book: the test account is not one (v689) */
      if(n) n.textContent=real+' accounts on the site.';
      document.getElementById('mFoot').textContent=real+' accounts, as at '+hm(new Date().toISOString());
    }catch(e){ say(e.message,'bad'); }
  }
  /* ---- SEND STATEMENT (v688) ---------------------------------------------------------------
     One card per account, the same three things the laptop's send sheet puts together: the link
     and username as one message, the QR, and the password on its own. THE PASSWORD IS DECRYPTED
     HERE AND NOWHERE ELSE: it is sealed under the master, which this page holds and the Worker
     never sees opened, and it goes straight from the decryption to the clipboard without being
     written into the page. */
  async function unseal(pass, e){
    var base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(e.salt),iterations:150000,hash:'SHA-256'},
      base, {name:'AES-GCM',length:256}, false, ['decrypt']);
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(e.iv)}, key, b64d(e.ct));
    return new TextDecoder().decode(pt);
  }
  /* THE ACCOUNT'S KEY, WRAPPED UNDER A FRESH ONE, for a link or a hand-over: opened HERE under the master and
     wrapped under a key minted here, so the Worker sees a wrap and a key and never the account's own key.
     CHARACTER CLASSES, NOT ESCAPES: this file is spliced into a template literal, where a backslash before
     + or / is eaten and /+/ is not a regular expression at all. */
  async function keyFor(a){
    var o=await (await fetch('/open', {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({u:a.username, password:OWNER.master, master:OWNER.master})})).json();
    if(!o.ok||!o.wrapMaster) throw new Error('that account did not open under the master');
    var ck=await unwrap(OWNER.master, o.wrapMaster);
    var raw=crypto.getRandomValues(new Uint8Array(24));
    var tok=btoa(String.fromCharCode.apply(null, raw)).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/[=]+$/,'');
    return {token:tok, wrap:await wrapUnder(new TextEncoder().encode(tok), ck)};
  }
  /* v710's one-time link, minted for one account on keyFor: only the token's hash and the wrap reach the Worker,
     which answers with the finished words. The card's Sign-in link, Needs you and Send them in turn all make it here. */
  async function mintLink(a){
    var k=await keyFor(a);
    var j=await refs('/all/signin/'+encodeURIComponent(a.username), {token:k.token, wrap:k.wrap});
    k=null;
    return j;
  }
  /* ---- SHOW A CODE, IN PERSON (S3 3.13, his decision D2 of 24 Sep 2026) -------------------------------
     A customer at his counter signs in on their own phone without a message: a QR their camera opens, signed
     in, and eight symbols to type where Salt Counter asks for one (the saved iPhone app keeps its own storage,
     so a camera's browser does not sign it in). MINTED AS THE SHEET OPENS and only shown: nothing here copies
     or shares, so no clipboard or share sheet ever waits on the derivation and the fetch. One use, fifteen
     minutes; closing the sheet does not spend it. The recipes are the system's: Sheet, Orb, QR panel and Code
     field. */
  var hoSheet=null;
  function closeHo(){
    if(!hoSheet) return;
    var from=hoSheet.from;
    hoSheet.scrim.remove(); hoSheet.box.remove(); hoSheet=null;
    try{ if(from) from.focus(); }catch(e){}
  }
  function svgEl(tag, attrs){
    var e=document.createElementNS('http://www.w3.org/2000/svg', tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  /* rectangles, one a run of dark modules, as engine/qr.mjs's qrRectSvg draws them: a stroked path does not scan */
  function qrRects(rows){
    var n=rows.length, q=4, span=n+q*2;
    var svg=svgEl('svg', {viewBox:'0 0 '+span+' '+span, role:'img', 'aria-label':'A code their camera opens, signed in'});
    var g=svgEl('g', {}); g.style.fill='var(--salt-slate)';
    for(var r=0;r<n;r++){
      for(var c=0;c<n;){
        if(rows[r][c]!=='1'){ c++; continue; }
        var w=1; while(c+w<n&&rows[r][c+w]==='1') w++;
        g.appendChild(svgEl('rect', {x:c+q, y:r+q, width:w, height:1}));
        c+=w;
      }
    }
    svg.appendChild(g);
    return svg;
  }
  async function showHandover(a, from){
    closeHo();
    var scrim=el('div','salt-sheet-scrim'); scrim.setAttribute('aria-hidden','true');
    var box=el('div','salt-sheet ho'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.setAttribute('aria-labelledby','hoT'); box.tabIndex=-1;
    box.appendChild(el('div','salt-sheet__grab'));
    var head=el('div','salt-sheet__head'), title=el('h2','salt-sheet__title','Sign in on their phone'); title.id='hoT';
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.setAttribute('aria-label','Close');
    var xg=svgEl('svg', {width:16, height:16, viewBox:'0 0 16 16', fill:'none', stroke:'currentColor', 'stroke-width':'1.5', 'stroke-linecap':'round', 'aria-hidden':'true'});
    xg.appendChild(svgEl('path', {d:'M3.5 3.5l9 9M12.5 3.5l-9 9'})); x.appendChild(xg);
    head.appendChild(title); head.appendChild(x); box.appendChild(head);
    var body=el('div','salt-sheet__body'); box.appendChild(body);
    body.appendChild(el('p','ho-for','For '+a.username+'.'));
    var wait=el('p','ho-wait','Making a code...'); body.appendChild(wait);
    document.body.appendChild(scrim); document.body.appendChild(box);
    var me=hoSheet={scrim:scrim, box:box, from:from};
    scrim.addEventListener('click', closeHo); x.addEventListener('click', closeHo);
    box.addEventListener('keydown', function(e){ if(e.key==='Escape'){ e.stopPropagation(); closeHo(); } });
    try{ box.focus(); }catch(e){}
    try{
      var k=await keyFor(a);
      var j=await refs('/all/handover', {u:a.username, token:k.token, wrap:k.wrap});
      k=null;
      if(hoSheet!==me) return;
      wait.remove();
      /* the panel's width is the component's own prop, and its place in the sheet is this page's: set from the
         script, which the page's style policy allows where a style attribute is refused */
      var qr=el('div','salt-qr'); qr.style.width='min(280px, 100%)'; qr.style.margin='4px auto 20px';
      var qc=el('div','salt-qr__code'); qc.appendChild(qrRects(j.qr||[])); qr.appendChild(qc);
      var qm=el('div','salt-qr__meta'); qm.appendChild(el('span','salt-qr__caption','Their camera opens it, signed in')); qr.appendChild(qm);
      body.appendChild(qr);
      var p=klBits(j.exp);
      var cf=el('div','salt-field salt-code');
      var lab=el('label','salt-code__label','Or type this code where Salt Counter asks for one'); lab.htmlFor='hoC';
      var inp=el('input','salt-field__input salt-field__input--code'); inp.id='hoC'; inp.readOnly=true;
      inp.setAttribute('autocomplete','off'); inp.setAttribute('spellcheck','false');
      inp.value=String(j.code||'').replace('-',' ');
      cf.appendChild(lab); cf.appendChild(inp);
      cf.appendChild(el('p','salt-code__hint','Works once, until '+p.hour+':'+p.minute+'.'));
      body.appendChild(cf);
    }catch(e){
      if(hoSheet!==me) return;
      wait.className='salt-code__error'; wait.textContent='Could not make a code: '+e.message;
    }
  }
  /* ---- AN ACCOUNT (S9 9.3, the plan's f13) ----------------------------------------------------------
     What a row opens: its code and username, the chips, ONE filled Send a sign-in link with its answer under it, and
     beside it the other ways, Show a code in person, View as them, Copy password and Sign out everywhere; then how
     they got in. THE LINK IS MADE AS THE ACCOUNT OPENS (the plan's must-not-ship list: never a key derivation and a
     fetch inside the share's tap), so the tap shares and does nothing before it. It is kept by username with Needs
     you's (madeLink), so a redraw, or the same account's card on Needs you, never makes a second; a share that goes
     through ticks the account sent, and a link shared or copied from any card is dropped and a fresh one made
     (retire). A username with no account makes nothing and posts nothing, and every control says why it is off. The password is opened on its own tap, straight to the
     clipboard, never into the page. */
  var story={};
  /* the link moved: every Send a sign-in link drawn for that account is painted from madeLink, including one a redraw
     put in the place of the button that asked (a sheet read lands while the link is being made), and Needs you with it */
  /* S9 fix: a link that could not be made leaves the pill on, as Try again, whose tap makes it again and shares nothing */
  function paintPill(b){
    var m=madeLink[b.getAttribute('data-pill')]||{}, again=!m.j&&!m.busy&&!!m.fail;
    b.disabled=b.getAttribute('data-none')==='1'||(!m.j&&!again);
    b.textContent=m.busy?'Making the link...':again?'Try again':'Send a sign-in link';
    if(b.note){ b.note.textContent=m.note||''; b.note.className='anote'+(m.bad?' bad':''); }
  }
  function paintPills(u){ [].slice.call(document.querySelectorAll('[data-pill]')).forEach(function(b){ if(b.getAttribute('data-pill')===u) paintPill(b); }); }
  function linkMoved(u){ paintPills(u); if(!mHome.hidden) drawNeeds(); }
  function makeLink(a){
    var u=a.username, m=madeLink[u]||(madeLink[u]={});
    if(m.j||m.busy||a.account===false) return;
    if(m.fail){ m.fail=false; m.bad=false; m.note=''; }
    m.busy=true;
    mintLink(a).then(function(j){ m.j=j; m.busy=false; linkMoved(u); },
      function(e){ m.busy=false; m.fail=m.bad=true; m.note='Could not make a link: '+e.message; linkMoved(u); });
  }
  function sendPill(a, note, onSent){
    var u=a.username, b=el('button','salt-pill salt-pill--md apill','Send a sign-in link'); b.type='button';
    b.setAttribute('data-pill', u); b.note=note;
    if(a.account===false){ b.setAttribute('data-none','1'); b.title='No account behind this username yet'; }
    paintPill(b); makeLink(a);
    b.addEventListener('click', function(){
      var m=madeLink[u];
      if(!m||!m.j){ if(m&&m.fail&&!m.busy){ makeLink(a); linkMoved(u); } return; }
      var msg=m.j.msg, p;
      /* the tap's first act, before anything that waits: the share sheet, or with none the clipboard */
      try{ p=navigator.share?navigator.share({text:msg}).then(function(){ return 'sent'; })
        :navigator.clipboard.writeText(msg).then(function(){ return 'copied'; }); }
      catch(e){ p=Promise.reject(e); }
      p.then(async function(how){
        if(how==='copied'){ retire(a, 'Copied. Paste it into a message to them, then tick Sent.'); linkMoved(u); return; }
        var said=madeLink[u]={note:'Sent. It signs them in once; the next tap sends a new one.'};
        markOut(u, m.j); linkMoved(u);
        try{ var r=await refs('/all/sent/'+u, {issue:sheetIssue, sent:true}); a.sent=r.sent; countSent(); drawRoster(); onSent(); }
        catch(e){ said.note='Sent, but the tick did not save: '+e.message; said.bad=true; }
        makeLink(a); linkMoved(u);
      }, function(){ m.note=navigator.share?'Not shared. Tap Send a sign-in link again.':'Not copied: this browser refused the clipboard.'; m.bad=true; linkMoved(u); });
    });
    return b;
  }
  /* HOW THEY GOT IN (/all/account/<u>): each way in, newest first, with its moment and the kind of device it was used
     on, as the browser described itself then, never an address; a password refused at an address stands above them */
  /* S9 fix: a code his counter showed is scanned; a customer's own is copied across; key, before the two were told apart */
  var HOWW={link:'Sign-in link', qr:'Code, scanned', copy:'Code, copied across', key:'Code', code:'Code, typed', password:'Password', passkey:'Passkey'};
  function lineRow(label, value, flag){
    var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), v=el('span','salt-ledger__value');
    l.appendChild(el('span','salt-ledger__label',label));
    if(value) v.appendChild(value);
    l.appendChild(v); r.appendChild(l);
    if(flag) r.appendChild(el('span','salt-ledger__flag',flag));
    return r;
  }
  function onWhat(where){ return where?' on '+String(where).replace(/^A /,'a '):''; }
  function drawStory(box, a){
    var s=story[a.username];
    box.textContent='';
    box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper','How they got in'));
    var list=el('div','salt-ledger salt-ledger--plain'), L=a.locked;
    if(L) list.appendChild(lineRow('Password', chip('alarm','Refused'),
      'Ten wrong '+(L.from>1?'from each of '+L.from+' addresses':'from one address')+(L.until?', shut there till '+hm(L.until):'')+'.'));
    var log=(s&&s.log)||[];
    log.forEach(function(x){
      list.appendChild(lineRow(HOWW[x.how]||'Signed in', x.how==='password'||x.how==='passkey'?null:chip('verdigris','Used'), dayMon(x.at)+', '+hm(x.at)+onWhat(x.where)));
    });
    if(!s) list.appendChild(lineRow('Reading how they got in.', null, ''));
    else if(s.err) list.appendChild(lineRow('Not read', null, s.err));
    else if(!log.length) list.appendChild(a.seen&&a.seen.opens
      ?lineRow('Last opened', null, dayMon(a.seen.last)+(howOf(a.seen)?', '+howOf(a.seen):'')+'. Earlier ways in were not kept.')
      :lineRow('Not opened yet', null, a.sent?'Sent '+dayMon(a.sent)+'.':''));
    box.appendChild(list);
    /* S9 9.4: PHONES AND COMPUTERS, off the account's own pointers: each device named as its browser described itself when
       it signed in, when it came and when it was last used, whether it is kept signed in, and a Sign out of its own */
    var devs=(s&&s.devices)||[], dh=el('h3','salt-eyebrow salt-eyebrow--copper dhead','Phones and computers');
    if(devs.length) dh.appendChild(el('span','dcount',String(devs.length)));
    box.appendChild(dh);
    var dl=el('div','salt-ledger salt-ledger--plain');
    devs.forEach(function(d){
      var so=ghost('Sign out');
      so.addEventListener('click', function(){ endOne(a, d, so); });
      dl.appendChild(lineRow(d.label||'A device named before this list began', so, d.kept
        ?'Kept signed in since '+dayMon(d.at)+', last used '+when(d.last)+'.'
        :'Signed in '+when(d.at)+' for this visit, not kept.'));
    });
    if(s&&!s.err&&!devs.length) dl.appendChild(lineRow('None signed in', null, 'A sign-in link or a code signs them in.'));
    box.appendChild(dl);
  }
  async function endOne(a, d, b){
    b.disabled=true; b.textContent='Signing out...';
    try{ await refs('/all/signout', {u:a.username, id:d.id}); loadStory(a); }
    catch(e){ b.textContent='Not signed out'; b.title=e.message; b.disabled=false; }
  }
  /* what Sign out everywhere ended, in words */
  function endedLine(j){
    var n=function(x, one, many){ return x+' '+(x===1?one:many); }, parts=[];
    if(j.devices) parts.push(n(j.devices,'device','devices'));
    if(j.links) parts.push(n(j.links,'link or code not yet used','links and codes not yet used'));
    if(j.phones) parts.push('alerts on '+n(j.phones,'phone','phones'));
    return parts.length?'Signed out: '+andList(parts)+'.':'Nothing was signed in.';
  }
  /* a link named by its token's hash, as the site files it */
  async function tokHash(j){
    var t=j?String(j.url||'').split('/s/')[1]||'':'';
    if(!t) return '';
    var h=new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
    return [].map.call(h, function(x){ return (x<16?'0':'')+x.toString(16); }).join('');
  }
  /* the link his own page made as the account opened, which Sign out everywhere spares */
  function linkId(u){ var m=madeLink[u]; return tokHash(m&&m.j); }
  /* S9 fix: A LINK THAT HAS LEFT THE PAGE IS MARKED SO ON THE SITE (POST /all/out), so Sign out everywhere counts it among
     those not yet used and never spares it; one made as an account opened and never sent is burnt with them, uncounted.
     Best effort: a mark that does not land costs the count, never the burning. */
  function markOut(u, j){ tokHash(j).then(function(id){ return id?refs('/all/out', {u:u, id:id}):null; }).catch(function(){}); }
  async function loadStory(a){
    var u=a.username, j=null, err='';
    try{ j=await refs('/all/account/'+encodeURIComponent(u)); }catch(e){ err=e.message; }
    story[u]=j?{log:j.log||[], devices:j.devices||[]}:{err:err};
    [].slice.call(document.querySelectorAll('[data-story]')).forEach(function(b){ if(b.getAttribute('data-story')===u) drawStory(b, a); });
  }
  function acctCard(a){
    var u=a.username, none=a.account===false, why='No account behind this username yet';
    var c=el('section','oacct scard'); c.setAttribute('data-acct', u);
    var h=el('div','ahead srow');
    h.appendChild(el('h2',null,a.test?testName(a):(a.code||u)));
    h.appendChild(el('span','un',u));
    c.appendChild(h);
    var cs=el('div','achips');
    function chips(){ cs.textContent=''; if(sheet) chipsOf(a).forEach(function(x){ cs.appendChild(x); }); }
    chips(); c.appendChild(cs);
    if(a.test) c.appendChild(el('p','atot','Counts nowhere; nothing on the book is behind it.'));
    else if(none) c.appendChild(el('p','atot',waitLine()));
    else if(a.tot) c.appendChild(el('p','atot',a.tot));
    var box=document.createElement('input');
    var pn=el('p','anote'); pn.setAttribute('role','status');
    c.appendChild(sendPill(a, pn, function(){ box.checked=!!a.sent; chips(); }));
    c.appendChild(pn);
    var grid=el('div','agrid'), gn=el('p','anote'); gn.setAttribute('role','status');
    var hob=ghost('Show a code, in person'), open=ghost('View as them'), pwb=ghost('Copy password'), sob=ghost('Sign out everywhere'), orderFor=ghost('Order for them');
    pwb.classList.add('salt-ghost--danger'); sob.classList.add('salt-ghost--danger');
    [hob, open, orderFor, pwb, sob].forEach(function(b){ if(none){ b.disabled=true; b.title=why; } grid.appendChild(b); });
    if(!none&&!a.pwMaster){ pwb.disabled=true; pwb.title='Not sealed yet: run tools/stmt-seal.mjs on the laptop'; }
    hob.addEventListener('click', function(){ if(!none) showHandover(a, hob); });
    /* S9 9.5: View as them, their own page, read only */
    open.addEventListener('click', function(){ openAcct(a); });
    orderFor.addEventListener('click', function(){ makerForAccount(a); });
    pwb.addEventListener('click', async function(){
      if(none||!a.pwMaster) return;
      pwb.disabled=true; pwb.textContent='Opening...';
      try{
        var pw=await unseal(OWNER.master, a.pwMaster);
        await navigator.clipboard.writeText(pw);
        pw=null;
        pwb.textContent='Password copied';
      }catch(e){ pwb.textContent='Could not open it'; }
      setTimeout(function(){ pwb.textContent='Copy password'; pwb.disabled=false; }, 2200);
    });
    /* SIGN OUT EVERYWHERE, on a second tap within four seconds: a forwarded link or a lost phone stays signed in while
       it is used, so this ends every device, link, code and alert on the account (S9 9.4), sparing the link this page
       made as the account opened and has not sent, and says what it ended; a new link or a code signs them back in */
    var soArmed=null;
    sob.addEventListener('click', async function(){
      if(none) return;
      if(!soArmed){ sob.textContent='Tap again to sign them out'; soArmed=setTimeout(function(){ soArmed=null; sob.textContent='Sign out everywhere'; }, 4000); return; }
      clearTimeout(soArmed); soArmed=null; sob.disabled=true; sob.textContent='Signing out...';
      try{ var j=await refs('/all/signout', {u:u, keep:await linkId(u)}); gn.textContent=endedLine(j); gn.className='anote'; }
      catch(e){ gn.textContent='Could not sign out: '+e.message; gn.className='anote bad'; }
      sob.textContent='Sign out everywhere'; sob.disabled=false;
      loadStory(a);
    });
    c.appendChild(grid); c.appendChild(gn);
    var tick=el('label','tick');
    box.type='checkbox'; box.checked=!!a.sent; box.disabled=none;
    box.addEventListener('change', async function(){
      var want=box.checked;
      try{
        var j=await refs('/all/sent/'+u, {issue:sheetIssue, sent:want});
        a.sent=j.sent; chips(); say(''); countSent(); drawRoster(); drawNeeds();
      }catch(e){ box.checked=!want; say(e.message,'bad'); }
    });
    tick.appendChild(box); tick.appendChild(el('span',null,'Sent'));
    c.appendChild(tick);
    var st=el('div','astory'); st.setAttribute('data-story', u);
    if(!none){ c.appendChild(st); drawStory(st, a); loadStory(a); }
    return c;
  }
  /* the test account is not part of a send, so it is out of both halves of the count (v689). A tick
     recounts as well as a draw (24 Sep 2026): the header sat on its first figure while he ticked. */
  function countSent(){
    var real=sheetRows.filter(function(a){ return !a.test; });
    var done=real.filter(function(a){ return a.sent; }).length;
    var head=document.getElementById('scount');
    if(head) head.textContent=done+' of '+real.length+' sent';
  }
  /* ---- THE ROSTER (10 Sep 2026) ------------------------------------------------------------
     A tap fills the customer's own form with his username and the master, and submits it. Nothing
     below the door knows the difference: the Worker answers byMaster, the page unwraps wrapMaster,
     and the statement, the prices and the lock are the customer's own. */
  function openAcct(a){
    if(!OWNER) return;
    if(sheet&&sheet[a.username]&&sheet[a.username].account===false){ say(waitLine(),'bad'); return; }
    if(!OWNER.master){ say('No master passphrase is set on this Worker, so nothing can be opened. Set STMT_MASTER.','bad'); return; }
    if(busy) return;
    un.value=a.username; pw.value=OWNER.master;
    if(whoacct) whoacct.textContent=(a.code||a.username)+' \\u00b7 ';
    document.getElementById('vasU').textContent=a.username;
    var f=document.getElementById('f');
    if(f.requestSubmit) f.requestSubmit();
    else f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }
  /* S9 9.5: BACK TO ACCOUNTS. The bar's one control on his page runs the page's own Log out first, which puts
     his page back (lock); this then shows Accounts, where the account he was viewing is still open. */
  document.getElementById('lock').addEventListener('click', function(){ panel('accounts'); });
  /* 24 SEP 2026 (M22): AN ACCOUNT HE OPENS IS READ ONLY, and it draws what their own page draws. It
     has no session, the owner does not order, so the orders and an associate's own links come from
     /all/orders/<u>, behind the prefix's one Access check. The page calls this when view is set. */
  async function loadView(u){
    var mine=ticket, j=null;
    /* through refs, so a lapsed Access session reads as one (S9 9.7) */
    try{ j=await refs('/all/orders/'+encodeURIComponent(u)); }
    catch(e){ if(mine===ticket) say('Their orders could not be read: '+e.message,'bad'); }
    if(mine!==ticket) return;
    orders=(j&&j.orders)||[]; myLinks=(j&&j.refs)||[]; myMax=(j&&j.max)||0;
    claims=(j&&Array.isArray(j.claims))?j.claims:[];   /* S6 6.6: their account's claims, as their page reads them */
    if(!tCard.hidden) drawCard();
  }
  /* ---- ACCOUNTS (S9 9.2) -----------------------------------------------------------------------
     One list for what Send and Review were: the system's Inbox row an account, its code and chips for where it
     stands and how it has been reached, found by a word and narrowed by a filter. A row opens the account's
     card, beside the list from 1080px and in its place on a phone with a way back; the card is Send's. */
  var aFilter='all', aOpen=null;
  var FILTER={
    all:function(){ return true; },
    unsent:function(a){ return a.account!==false&&!a.test&&!a.sent; },
    unopened:function(a){ return a.account!==false&&!a.test&&!(a.seen&&a.seen.opens); },
    owes:function(a){ return a.flag==='owes'||a.flag==='goods'; },
    locked:function(a){ return !!a.locked; },
    none:function(a){ return a.account===false; }
  };
  /* HOW AN OPEN CAME: the road markSeen recorded. Stage 3's hand-over records qr (his counter's code, scanned), copy (a
     customer's own, copied across) and code (typed), and key where it was one word for the first two; a road this
     page does not know says no road, and only an open with none at all, from before v827 when the password was the
     one road recorded, was by password. */
  var HOW={password:'by password', link:'by link', remembered:'on a remembered phone', qr:'by a scanned code', copy:'by a copied code', key:'by a code', code:'by a typed code', passkey:'with a passkey'};
  function howOf(s){ return s.how?HOW[s.how]||'':HOW.password; }
  /* the two test accounts, told apart by the state each stands in (his answer of 29 Sep 2026) */
  function testName(a){ return a.state==='locked'?'Test account, locked':'Test account, open'; }
  function chip(tone, t){ return el('span','salt-status salt-status--'+tone, t); }
  function chipsOf(a){
    if(a.test) return [chip('mist','Test, counts nowhere')];
    if(a.account===false) return [chip('alarm','No account')];
    var out=[];
    if(a.locked) out.push(chip('alarm','Refused at '+(a.locked.from>1?a.locked.from+' addresses':'1 address')+(a.locked.until?' till '+hm(a.locked.until):'')));
    if(a.flag&&a.flag!=='clear') out.push(chip({owes:'ember', goods:'steel', refund:'brass', pend:'copper'}[a.flag]||'mist', flagLine(a)));
    out.push(a.seen&&a.seen.opens?chip('mist','Opened '+dayMon(a.seen.last)+(howOf(a.seen)?' '+howOf(a.seen):'')):chip('steel','Not opened'));
    if(a.alerts) out.push(chip('verdigris','Alerts on'));
    if(a.sent) out.push(chip('verdigris','Sent '+dayMon(a.sent)));
    return out;
  }
  function rowOf(a){
    var b=el('button','salt-inbox-row'); b.type='button'; b.setAttribute('data-u', a.username);
    if(aOpen===a.username) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
    t.appendChild(el('span',null,a.test?testName(a):(a.code||a.username)));
    if(sheet) chipsOf(a).forEach(function(c){ t.appendChild(c); });
    main.appendChild(t);
    /* a code with no account says, on its row, when it is made and which link to show until then (D15) */
    main.appendChild(el('span','salt-inbox-row__what', a.username+(a.account===false?', '+waitLine():a.tot?', '+a.tot:'')));
    b.appendChild(main);
    var side=el('span','salt-inbox-row__side'); side.appendChild(el('span','salt-inbox-row__action','Open'));
    b.appendChild(side);
    b.addEventListener('click', function(){ openCard(a.username); });
    return b;
  }
  function drawRoster(){
    if(!OWNER) return;
    var q=(rq.value||'').toLowerCase().replace(/\\s+/g,''), f=FILTER[aFilter]||FILTER.all;
    rlist.textContent='';
    var hits=(sheet?sheetRows:OWNER.accounts).filter(function(a){
      return f(a)&&(!q||((a.code||'')+' '+a.username).toLowerCase().replace(/\\s+/g,'').indexOf(q)>=0);
    });
    countSent();
    if(!hits.length){ rlist.appendChild(el('p','rnone','Nothing matches that.')); return; }
    hits.forEach(function(a){ rlist.appendChild(rowOf(a)); });
  }
  function filterBy(f){
    aFilter=FILTER[f]?f:'all';
    [].slice.call(document.querySelectorAll('#afil button[data-f]')).forEach(function(x){
      x.setAttribute('aria-pressed', x.getAttribute('data-f')===aFilter?'true':'false'); });
    drawRoster();
  }
  /* the open account: its chips, then Send's card, and on a phone the way back to the list above it */
  function openCard(u){
    makerSlipLock();
    var a=u&&((sheet&&sheet[u])||OWNER.accounts.filter(function(x){ return x.username===u; })[0]);
    aOpen=a?u:null;
    oAccts.classList.toggle('open', !!a);
    aopen.hidden=!a; aopen.textContent='';
    [].slice.call(rlist.querySelectorAll('[data-u]')).forEach(function(r){
      if(r.getAttribute('data-u')===aOpen) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
    if(!a) return;
    var back=el('button','aback','← Accounts'); back.type='button'; back.setAttribute('data-back','accounts');
    aopen.appendChild(back);
    acctPane(aopen, a);
    try{ window.scrollTo(0,0); }catch(e){}
  }
  /* an account as it opens (S9 9.3) */
  function acctPane(box, a){ box.appendChild(acctCard(a)); }
  function setCount(m, n){ [].slice.call(document.querySelectorAll('[data-count="'+m+'"]')).forEach(function(c){ c.textContent=n?String(n):''; }); }
  /* ---- THE GUEST LINKS, on the same gated route -------------------------------------------
     Minted, listed and revoked over /all/refs; the Worker draws the QR and returns it as a data
     URI, so nothing here encodes anything and the page loads no library to do it. */
  var links=[];
  /* UX8: the answer to the last move, drawn on the card it moved, since the card changes group and the page's
     own line sits at its foot */
  var moved=null;
  /* S9 fix: AND A TAP THAT FAILS, or a tier pinned, is answered on the card it was tapped on as well, in Needs you
     and in Links, where the page's own line sat under every card, off a phone's screen. The link keeps its buttons. */
  var linkSaid=null;
  function saidOn(r, node){ if(linkSaid&&linkSaid.id===r.id){ node.textContent=linkSaid.t; node.className+=linkSaid.bad?' bad':''; } }
  /* waiting means he still has to act on it: not declined (D13), and not withdrawn either */
  function waitingLink(r){ return !r.standing&&r.approved===false&&r.declined!==true&&!r.revoked; }
  function stampDay(iso){
    /* the page's klBits and MON3, so a day here is written exactly as the customer's page writes one */
    try{ var p=klBits(iso); return p.day+' '+MON3[+p.month-1]+' '+p.year; }catch(e){ return ''; }
  }
  /* v696, his instruction of 18 Sep 2026: ONE LINK PER TIER. They stand at the top, in the ladder's
     own order, each named by its level; anything minted against a customer sits below them under its
     own heading. HOW MANY IS THE BOOK'S (24 Sep 2026): the count is read off the tier list the route
     sends, never written here, because "the five" outlived the fifth tier by a day. */
  function drawLinks(){
    var glist=document.getElementById('glist');
    glist.textContent='';
    if(!links.length){ glist.appendChild(el('p','rnone','No links yet.')); return; }
    /* the guest tiers are the list less Ambassador, the floor, which is never a guest's */
    var want=tiers.slice(1);
    var made=want.filter(function(t){ return links.some(function(r){ return r.standing&&r.level===t; }); }).length;
    var isWaiting=waitingLink;
    /* UX8, 24 Sep 2026: AN ASSOCIATE'S LINK STAYS THEIRS once he has decided on it. Approved or declined, it went
       under "made against a customer" as "Tier 2, (no label)", with nothing to say who minted it */
    var isAssoc=function(r){ return !r.standing&&!!r.by&&r.by!=='standing'; };
    var standing=links.filter(function(r){return r.standing;}),
        waiting=links.filter(isWaiting),
        assoc=links.filter(function(r){return isAssoc(r)&&!isWaiting(r);}),
        older=links.filter(function(r){return !r.standing&&!isWaiting(r)&&!isAssoc(r);});
    /* v709: WHAT IS WAITING ON HIM COMES FIRST. An associate's link is shut until he approves it,
       so the one group he has to act on is the one at the top. */
    var seq=[], heads={};
    if(waiting.length){ heads[seq.length]='Waiting on you'; seq=seq.concat(waiting); }
    if(standing.length){ heads[seq.length]=want.length?'One for each of the '+want.length+' tiers':'One for each tier'; seq=seq.concat(standing); }
    if(assoc.length){ heads[seq.length]='Made by associates'; seq=seq.concat(assoc); }
    if(older.length){ heads[seq.length]='Older links, made against a customer'; seq=seq.concat(older); }
    seq.forEach(function(r,i){
      if(heads[i]) glist.appendChild(el('p','ghead',heads[i]));
      var card=el('div','glink'+(r.revoked?' off':'')); card.setAttribute('data-link',r.id);
      var declined=r.declined===true, pending=r.approved===false&&!declined;
      /* a standing link whose level the book no longer names (Bronze, 23 Sep 2026) is kept because it
         was handed out, and it opens the board a stranger sees, never the level it still carries */
      var retired=r.standing&&want.length&&want.indexOf(r.level)<0;
      card.appendChild(el('p','gt',(r.standing?r.level:(declined?'Not approved':(r.level?r.level:(pending?'Waiting on you':(isAssoc(r)?'Follows the associate':'Tier '+r.tier)))))+(r.revoked?' \\u00b7 withdrawn':'')));
      card.appendChild(el('h4',null,retired?'Kept because it was handed out. It opens the board a stranger sees'
        :r.standing?'Hand this one to a stranger you would quote '+r.level
        :declined?('Minted by '+(r.by||'an associate')+', and not approved, so it stays shut')
        :(pending?('Minted by '+(r.by||'an associate')+', and shut until you approve it')
        :isAssoc(r)?('Minted by '+r.by)
        :(r.label||'(no label)'))));
      card.appendChild(el('code','gu',r.url));
      card.appendChild(el('p','gs', r.opens
        ? 'opened '+r.opens+' time'+(r.opens===1?'':'s')+', last '+stampDay(r.last)
        : 'never opened \\u00b7 made '+stampDay(r.made)));
      var img=document.createElement('img');
      img.src=r.qr; img.alt='QR to the guest price list for '+(r.label||r.id); img.width=180; img.height=180;
      card.appendChild(img);
      var row=el('div','grow');
      var copy=el('button',null,'Copy link'); copy.type='button';
      copy.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); copy.textContent='Copied'; }
        catch(e){ copy.textContent='Copy failed'; }
        setTimeout(function(){ copy.textContent='Copy link'; }, 1500);
      });
      var rev=el('button',null,r.revoked?'Restore':'Withdraw'); rev.type='button';
      rev.addEventListener('click', function(){ moveLink(r, r.revoked?'restore':'revoke'); });
      row.appendChild(copy); row.appendChild(rev);
      /* v709: his word on one an associate minted, and the tier he may change on it. A tier he
         does not set leaves it following the associate, which is what "if need be" means. */
      if(!r.standing&&r.by){
        if(r.approved===false&&!r.revoked){
          /* a declined link keeps Approve, which is how a decline is taken back, and loses Decline;
             a withdrawn one has neither, Restore being the way back */
          var ap=el('button',null,'Approve'); ap.type='button';
          ap.addEventListener('click', function(){ moveLink(r,'approve'); });
          row.appendChild(ap);
          if(!declined){
            var de=el('button',null,'Decline'); de.type='button';
            de.addEventListener('click', function(){ moveLink(r,'decline'); });
            row.appendChild(de);
          }
        }
        if(tiers.length){
          var sel=el('select','fld'); sel.setAttribute('aria-label','The tier this link quotes');
          var o0=el('option',null,'Follows the associate'); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
          /* Ambassador is the floor and never a guest's, so the picker starts at the first of five */
          tiers.slice(1,6).forEach(function(t){ var o=el('option',null,t); o.value=t; if(r.level===t)o.selected=true; sel.appendChild(o); });
          sel.addEventListener('change', function(){ setLevel(r, sel.value); });
          card.appendChild(sel);
        }
      }
      card.appendChild(row);
      if(moved&&moved.id===r.id){ var mv=el('p','msg',moved.t); mv.setAttribute('role','status'); card.appendChild(mv); }
      if(linkSaid&&linkSaid.id===r.id){ var ls=el('p','msg'); ls.setAttribute('role','status'); saidOn(r, ls); card.appendChild(ls); }
      glist.appendChild(card);
    });
    if(want.length&&made<want.length) glist.appendChild(el('p','rnone','Only '+made+' of the '+want.length+' are made. Publish the statements and open this again.'));
  }
  /* S9 9.7, HIS D13: WHEN ACCESS LAPSES, SAY SO. A request under /all after the Access session has ended is
     sent to the Access login, a redirect a fetch cannot follow, and every tap read "Failed to fetch". Asked not
     to follow it, the fetch answers an opaque redirect, and that or the Worker's own 401 is the sign-in ending:
     the page gives way to Sign in again, which loads /all and so the Access login. A fetch that throws is the
     connection, and says so. */
  var ENDED='Your admin sign-in has ended.';
  function ended(){ document.getElementById('aEnded').hidden=false; document.body.classList.add('ended'); }
  async function refs(path, body){
    var o = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}
                 : {};
    o.redirect='manual';
    var r;
    try{ r = await fetch(path, o); }catch(e){ throw new Error('Not sent. Check the connection and try again.'); }
    if(r.type==='opaqueredirect'||r.status===401){ ended(); throw new Error(ENDED); }
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok){ var failure=new Error(j.error||'that did not work'); failure.detail=j; failure.status=r.status; throw failure; }
    return j;
  }
  var makerData=null, makerQuotes={}, makerHours=null, makerBusy=false;
  var makerClaims=[], makerClaimRequests={}, makerSlipPrivate=null, makerSlipGeneration=0, makerSlipUrls=[];
  function makerSlipClose(){
    makerSlipGeneration++;
    makerSlipUrls.forEach(function(url){ URL.revokeObjectURL(url); }); makerSlipUrls=[];
    document.querySelectorAll('[data-maker-slip]').forEach(function(node){ node.remove(); });
  }
  function makerSlipLock(){ makerSlipClose(); makerSlipPrivate=null; }
  document.addEventListener('visibilitychange',function(){ if(document.hidden) makerSlipLock(); });
  function makerClaimButton(parent,label,action,primary){
    var button=el('button',primary?'btn salt-pill salt-pill--md':'salt-ghost',label);
    button.type='button'; button.onclick=function(){ return action(button); }; parent.appendChild(button); return button;
  }
  async function loadMakerClaims(){
    var root=document.getElementById('makerClaims'); if(!root||oMaker.hidden) return;
    makerSlipClose(); root.textContent='Reading account claims…';
    try{
      var result=await refs('/all/maker/claims'); makerClaims=result.claims||[];
      if(!root.isConnected||oMaker.hidden) return;
      root.textContent='';
      var waiting=makerClaims.filter(function(c){ return c.state==='waiting'; });
      if(!waiting.length) root.appendChild(el('p','rnone','No account claims waiting.'));
      waiting.forEach(function(claim){
        var card=makerCard(root), preview=null;
        card.appendChild(el('h3',null,claim.u+' · '+rm(claim.amount)));
        card.appendChild(el('p','maker-facts',claim.id+(claim.test?' · Test, counts nowhere':'')));
        var note=el('div','maker-quote'); card.appendChild(note);
        var route='/all/maker/claims/'+claim.u+'/'+claim.id;
        var receipt=makerClaimButton(card,'Received',function(button){ return decideMakerClaim(false,false,button); },true);
        var covered=makerClaimButton(card,'Received, on the book already',function(button){ return decideMakerClaim(true,false,button); },false);
        receipt.disabled=true; covered.disabled=true;
        makerClaimButton(card,'Preview rows',async function(button){
          button.disabled=true;
          try{
            preview=await refs(route+'/preview',{}); note.textContent='';
            (preview.rows||[]).forEach(function(row){
              note.appendChild(el('p','maker-row',(row.date||'undated')+' · '+rm(row.rm)+' of '+rm(row.owed)+' · '+(row.rid||row.key)));
              (row.flags||[]).forEach(function(flag){ note.appendChild(el('p','salt-insight',typeof flag==='string'?flag:JSON.stringify(flag))); });
            });
            note.appendChild(el('p','salt-insight',preview.booked?'Already booked. Received tells the customer again without booking.':
              preview.left>0.004?rm(preview.left)+' exceeds the rows. Do not book it again if already recorded.':'These rows are answered together.'));
            receipt.disabled=preview.left>0.004; covered.disabled=!(preview.left>0.004);
          }catch(error){ note.textContent=error.message; }
          button.disabled=false;
        },false);
        makerClaimButton(card,'Not found',function(button){ return decideMakerClaim(false,true,button); },false);
        async function decideMakerClaim(onBook,notFound,button){
          if(!notFound&&!preview) return;
          var key=claim.u+':'+claim.id, pending=makerClaimRequests[key];
          var body=notFound?{amount:claim.amount}:{hash:preview.hash};
          if(onBook) body.covered=true;
          var action=notFound?'notfound':'received', intended=JSON.stringify({action:action,body:body});
          if(pending&&pending.intended!==intended){ note.textContent='Read the retained decision before choosing another answer.'; return; }
          if(!pending){
            if(!window.confirm(notFound?'Record this claim as Not found?':'Confirm the amount and rows shown?')) return;
            pending={intended:intended,action:action,body:Object.assign({rid:crypto.randomUUID()},body),busy:false};
            makerClaimRequests[key]=pending;
          }
          if(pending.busy) return; pending.busy=true; button.disabled=true;
          try{
            await refs(route+'/'+pending.action,pending.body); delete makerClaimRequests[key]; await loadMakerClaims(); await loadMaker();
          }catch(error){ note.textContent='Confirmation not received. Retry this same answer: '+error.message; }
          pending.busy=false; button.disabled=false;
        }
        if(claim.slip) makerSlipControl(card,claim.u,claim.slip);
      });
    }catch(error){ root.textContent=error.message; }
  }
  function makerSlipControl(parent,u,id){
    var pass=makerField(parent,'Vault passphrase','password',''), note=el('p','msg'); parent.appendChild(note);
    pass.autocomplete='off';
    makerClaimButton(parent,'View slip',async function(button){
      var generation=++makerSlipGeneration, secret=pass.value; pass.value=''; button.disabled=true;
      try{
        if(!makerSlipPrivate){
          if(!secret) throw new Error('Unlock the slip key with the vault passphrase.');
          var envelope=await refs('/all/maker/vault/key');
          if(generation!==makerSlipGeneration) return;
          if(!envelope.vault) throw new Error('No slip key is filed.');
          var jwk=await makerVaultOpen(secret,envelope.vault); secret='';
          var imported=await crypto.subtle.importKey('jwk',{kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,d:jwk.d},
            {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
          if(generation!==makerSlipGeneration) return;
          makerSlipPrivate=imported;
        }
        var privateKey=makerSlipPrivate, sealed=(await refs('/all/maker/slips/'+u+'/'+id)).slip;
        if(generation!==makerSlipGeneration) return;
        if(!sealed||sealed.v!==1) throw new Error('The sealed slip is malformed.');
        var epk=await crypto.subtle.importKey('raw',makerFrom64(sealed.epk),{name:'ECDH',namedCurve:'P-256'},false,[]);
        var bits=await crypto.subtle.deriveBits({name:'ECDH',public:epk},privateKey,256);
        var hk=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
        var key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:new TextEncoder().encode('salt-slip v1')},
          hk,{name:'AES-GCM',length:256},false,['decrypt']);
        var bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(sealed.iv)},key,makerFrom64(sealed.ct));
        if(generation!==makerSlipGeneration||!parent.isConnected||oMaker.hidden||document.hidden) return;
        var url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
        if(generation!==makerSlipGeneration){ URL.revokeObjectURL(url); return; }
        makerSlipUrls.push(url);
        var image=el('img','maker-slip'); image.src=url; image.alt='Payment slip'; image.setAttribute('data-maker-slip','');
        parent.appendChild(image); note.textContent='Opened on this device only.';
      }catch(error){ if(generation===makerSlipGeneration) note.textContent='Slip could not be opened: '+error.message; }
      finally{ secret=''; button.disabled=false; }
    },false);
    makerClaimButton(parent,'Close and lock slip',function(){ makerSlipLock(); pass.value=''; note.textContent='Slip locked.'; },false);
  }
  var makerThreads=[], makerThreadUser=null, makerThreadTimer=null, makerThreadsReading=false, makerChatDrafts={};
  function stopMakerChat(){
    if(makerThreadTimer!==null) clearInterval(makerThreadTimer);
    makerThreadTimer=null;
  }
  function startMakerChat(){
    stopMakerChat();
    if(!makerThreadUser||oMaker.hidden||document.hidden) return;
    makerThreadTimer=setInterval(function(){
      if(!makerThreadUser||oMaker.hidden||document.hidden){ stopMakerChat(); return; }
      loadMakerThreads(true);
    },2000);
  }
  document.addEventListener('visibilitychange',function(){
    if(document.hidden) stopMakerChat();
    else if(makerThreadUser&&!oMaker.hidden){ loadMakerThreads(true); startMakerChat(); }
  });
  function makerThreadAsked(thread){
    var lines=thread.msgs||[], last=lines[lines.length-1];
    return !!(last&&last.by==='customer'&&thread.quiet!==last.at);
  }
  async function loadMakerThreads(quiet){
    if(makerThreadsReading) return;
    makerThreadsReading=true;
    var status=document.getElementById('makerChatStatus');
    try{
      var result=await refs('/all/maker/threads');
      makerThreads=result.threads||[];
      var list=document.getElementById('makerChatList'); list.textContent='';
      makerThreads.forEach(function(thread){
        var button=el('button','salt-ghost',thread.u+(thread.test?' · Test account':'')+(makerThreadAsked(thread)?' · Asked':' · Chat'));
        button.type='button';button.setAttribute('data-thread',thread.u);
        button.onclick=function(){ openMakerThread(thread.u); };list.appendChild(button);
      });
      status.textContent=makerThreads.length?makerThreads.filter(function(thread){return !thread.test&&makerThreadAsked(thread);}).length+' waiting for a reply.':'No account conversations.';
      if(makerThreadUser) drawMakerThreadLines();
    }catch(error){ status.textContent=error.message; }
    finally{ makerThreadsReading=false; }
  }
  function drawMakerThreadLines(){
    var root=document.getElementById('makerChatLines');
    if(!root) return;
    root.textContent='';
    var thread=makerThreads.filter(function(value){ return value.u===makerThreadUser; })[0];
    (thread&&thread.msgs||[]).forEach(function(line){
      root.appendChild(el('p','maker-facts',(line.by==='desk'?'You':'Customer')+' · '+stampDay(line.at)));
      root.appendChild(el('p','maker-row',line.text));
    });
  }
  function openMakerThread(user){
    makerThreadUser=user;
    var root=document.getElementById('makerChatOpen');root.hidden=false;root.textContent='';
    root.appendChild(el('h3','',user));
    var lines=el('div','');lines.id='makerChatLines';root.appendChild(lines);
    var draft=makerChatDrafts[user], savedPrefix='saltMakerChat:'+user+':';
    if(!draft){
      draft=makerChatDrafts[user]={text:'',pending:null,saved:null};
      try{
        var keys=Object.keys(localStorage).filter(function(key){return key.indexOf(savedPrefix)===0;}).sort();
        if(keys.length){
          draft.savedKey=keys[0];
          var raw=localStorage.getItem(draft.savedKey);
          draft.saved=JSON.parse(raw);
          if(draft.saved.v!==1||draft.saved.u!==user||!draft.saved.envelope||typeof draft.saved.rid!=='string')
            throw new Error('The retained reply needs review or explicit cancellation.');
        }
      }catch(error){draft.storageError=error.message;}
    }
    var label=el('label','maker-field');label.appendChild(el('span','lbl','Reply'));
    var text=el('textarea','fld salt-field__input');text.maxLength=200;text.value=draft.text;
    text.setAttribute('data-thread-reply',user);text.oninput=function(){draft.text=text.value;};
    label.appendChild(text);root.appendChild(label);
    var status=el('p','msg');status.setAttribute('role','status');root.appendChild(status);
    var send=el('button','btn salt-pill salt-pill--md','Send reply'),
      quiet=el('button','salt-ghost','No reply needed'),cancel=el('button','salt-ghost','Cancel reply retry'),
      restore=el('button','salt-ghost','Open retained reply'),close=el('button','salt-ghost','Close chat');
    [send,quiet,restore,cancel,close].forEach(function(button){button.type='button';root.appendChild(button);});
    function makerChatState(){
      var busy=!!draft.busy;
      status.textContent=draft.note||(busy?'Sending reply...':'');
      var unopened=!!draft.storageError||!!(draft.saved&&!draft.pending);
      if(!draft.pending&&!unopened) text.value=draft.text;
      text.disabled=busy||!!draft.pending||unopened;send.disabled=busy||unopened||(draft.pending&&draft.pending.noReply===true);
      quiet.disabled=busy||unopened||(draft.pending&&draft.pending.message!==undefined);
      restore.hidden=!draft.saved||!!draft.pending;restore.disabled=busy||!!draft.storageError;
      cancel.hidden=!draft.pending&&!draft.saved&&!draft.storageError;cancel.disabled=busy;
      send.textContent=draft.pending&&draft.pending.message!==undefined?'Retry reply':'Send reply';
      quiet.textContent=draft.pending&&draft.pending.noReply?'Retry No reply needed':'No reply needed';
    }
    draft.redraw=makerChatState;
    async function makerChatSubmit(noReply){
      if(draft.busy||draft.storageError||(draft.saved&&!draft.pending)) return;
      if(!draft.pending){
        if(!noReply&&!text.value.trim()){status.textContent='Write a reply first.';return;}
        draft.pending=noReply?{noReply:true,rid:mintRid()}:{message:text.value,rid:mintRid()};
      }
      draft.note='';draft.busy=true;makerChatState();
      try{
        if(!draft.saved){
          if(!OWNER.master) throw new Error('Reopen Salt Account before retaining a reply.');
          var envelope=await makerVaultSeal(OWNER.master,{u:user,body:draft.pending});
          var retained={v:1,u:user,rid:draft.pending.rid,at:new Date().toISOString(),envelope:envelope};
          draft.savedKey=savedPrefix+draft.pending.rid;
          localStorage.setItem(draft.savedKey,JSON.stringify(retained));draft.saved=retained;
        }
        var result=await refs('/all/maker/threads/'+user,draft.pending);
        localStorage.removeItem(draft.savedKey);draft.saved=null;
        if(draft.pending.message!==undefined){draft.text='';text.value='';}
        draft.pending=null;draft.note=noReply?'No reply needed recorded.':'Reply sent.'+makerPushResult(result.push);
        await loadMakerThreads(true);
      }catch(error){draft.note=makerCommunicationError(error)+' The original reply is kept for retry.';}
      finally{draft.busy=false;draft.redraw();}
    }
    send.onclick=function(){makerChatSubmit(false);};quiet.onclick=function(){makerChatSubmit(true);};
    restore.onclick=async function(){
      if(draft.busy) return;
      draft.busy=true;makerChatState();
      try{
        if(!OWNER.master) throw new Error('Reopen Salt Account to open the retained reply.');
        var opened=await makerVaultOpen(OWNER.master,draft.saved.envelope);
        if(opened.u!==user) throw new Error('The retained reply belongs to another account. It was not sent.');
        var body=opened.body;
        if(body.rid!==draft.saved.rid||Object.keys(body).some(function(key){return ['rid','message','noReply'].indexOf(key)<0;})
          ||!(/^[A-Za-z0-9_-]{16,64}$/).test(body.rid)
          ||!(body.noReply===true&&body.message===undefined||body.noReply===undefined&&typeof body.message==='string'&&body.message.trim()&&body.message.length<=200))
          throw new Error('The retained reply is malformed. It remains saved until explicitly cancelled.');
        draft.pending=body;draft.text=body.message||'';text.value=draft.text;
        draft.note='Original reply opened. Retry sends the same request; cancellation removes only this device retry.';
      }catch(error){draft.note=error.message;}
      finally{draft.busy=false;draft.redraw();}
    };
    cancel.onclick=function(){
      if(confirm('Cancel this retry? A reply already sent is not removed.')){
        try{localStorage.removeItem(draft.savedKey);draft.pending=null;draft.saved=null;delete draft.storageError;draft.note='This device retry was cancelled.';makerChatState();}
        catch(error){status.textContent='Retry not cancelled: '+error.message;}
      }
    };
    close.onclick=function(){makerThreadUser=null;root.hidden=true;stopMakerChat();};
    if(draft.storageError) draft.note=draft.storageError;
    else if(draft.saved&&!draft.pending) draft.note='A retained reply is encrypted on this device. Open it before retry or cancel it explicitly.';
    makerChatState();drawMakerThreadLines();startMakerChat();
  }
  /* A GROUP ORDER (the pool): open one, see who is in by units, and Close. Close closes it, tells each joiner once and sends
     each joined order for acknowledgement; one the Desk would not accept is listed under the pool with its reason, and Close
     again retries those alone. Reaching the target closes nothing: only this does. */
  async function loadMakerPools(){
    var root=document.getElementById('makerPools'); if(!root||oMaker.hidden) return;
    var result;
    try{ result=await refs('/all/maker/pools'); }catch(error){ root.textContent=error.message; return; }
    if(!root.isConnected||oMaker.hidden) return;
    root.textContent='';
    var note=el('p','msg',''); note.setAttribute('role','status');
    function field(label,type,attrs){
      var l=el('label','maker-field'); l.appendChild(el('span','lbl',label));
      var i=el('input','fld salt-field__input'); i.type=type; Object.keys(attrs||{}).forEach(function(k){ i.setAttribute(k,attrs[k]); });
      l.appendChild(i); root.appendChild(l); return i;
    }
    var product=field('Product','text',{maxlength:'20',autocomplete:'off'}), size=field('Size each, in units','number',{min:'0',step:'any'}),
        target=field('Target, in units','number',{min:'0',step:'any'}), closes=field('Closes on, optional','date',{});
    var open=el('button','btn salt-pill salt-pill--md','Open group order'); open.type='button';
    open.onclick=async function(){
      open.disabled=true;
      try{
        var body={product:product.value.trim().toLowerCase(),q:Number(size.value),target:Number(target.value)};
        if(closes.value) body.closesOn=closes.value;
        await refs('/all/maker/pools',body); await loadMakerPools();
      }catch(error){ note.textContent=error.message; open.disabled=false; }
    };
    root.appendChild(open); root.appendChild(note);
    (result.pools||[]).forEach(function(p){
      var card=el('article','salt-glass-card maker-card');
      card.appendChild(el('p','maker-row',p.product+' '+p.q+' each, '+p.unitsIn+' of '+p.target+' units in, '+(p.joins||[]).length+' joined'
        +(p.closesOn?', closes '+p.closesOn:'')+', '+p.state));
      (p.closeLeft||[]).forEach(function(x){ card.appendChild(el('p','maker-row','Not acknowledged: '+x.id+' ('+x.why+')')); });
      if(p.state==='open'||(p.closeLeft||[]).length){
        var close=el('button','salt-ghost',p.state==='open'?'Close':'Close again'); close.type='button';
        close.onclick=async function(){
          if(p.state==='open'&&!confirm('Close this group order and send each joined order for acknowledgement? Every joiner is told once.')) return;
          close.disabled=true;
          try{
            var r=await refs('/all/maker/pools/'+encodeURIComponent(p.id)+'/close',{});
            await loadMakerPools();
            var again=document.getElementById('makerPools'); if(again){ var m=el('p','msg',r.accepted.length+' sent for acknowledgement'+(r.left.length?', '+r.left.length+' left':'')+'.'); m.setAttribute('role','status'); again.insertBefore(m,again.firstChild); }
          }catch(error){ note.textContent=error.message; close.disabled=false; }
        };
        card.appendChild(close);
      }
      root.appendChild(card);
    });
  }
  async function loadMakerBulletin(){
    var root=document.getElementById('makerBulletin'), status=document.getElementById('makerBulletinStatus');
    if(!root) return;
    var text=root.querySelector('textarea');
    if(!text){
      var label=el('label','maker-field');label.appendChild(el('span','lbl','Notice, one line per sentence'));
      text=el('textarea','fld salt-field__input');text.rows=4;label.appendChild(text);root.appendChild(label);
      var current=el('div','');current.id='makerBulletinCurrent';root.appendChild(current);
      var retained=el('div','');retained.hidden=true;root.appendChild(retained);
      var set=el('button','btn salt-pill salt-pill--md','Set notice'), clear=el('button','salt-ghost','Clear notice'),
        refresh=el('button','salt-ghost','Read current notice'), busy=false, needsRead=false, intended=null;
      [set,clear,refresh].forEach(function(button){button.type='button';root.appendChild(button);});
      function state(){set.disabled=busy||needsRead;clear.disabled=busy||needsRead;refresh.disabled=busy;text.disabled=busy;}
      root.addEventListener('maker-notice-read',function(event){
        needsRead=false;
        if(intended){
          var normalized=function(lines){return lines.map(function(line){return line.replace(/[\\s]+/g,' ').trim();});};
          var matches=JSON.stringify(normalized(event.detail.lines||[]))===JSON.stringify(normalized(intended.lines));
          status.textContent=(matches?'Current notice matches the retained request.':'Current notice differs from the retained request.')
            +' Intended text is kept. This read sends no notification; the previous notification outcome is unknown.';
        }
        state();
      });
      async function submit(lines){
        if(busy||needsRead) return;
        if(!confirm(lines.length?'Set this notice and notify every customer?':'Clear the notice? No notification is sent.')) return;
        intended={lines:lines.slice()};
        busy=true;state();
        try{
          var result=await refs('/all/maker/bulletin',{lines:lines,confirmed:true});
          current.textContent=(result.lines||[]).join(' · ')||'No notice.';
          intended=null;retained.hidden=true;
          status.textContent=lines.length?'Notice set.'+makerPushResult(result.push):'Notice cleared. No notification sent.';
        }catch(error){
          needsRead=true;status.textContent=error.message+' Read the current notice before another change; the result may already be recorded.';
          retained.hidden=false;retained.textContent='';
          retained.appendChild(el('h3','','Retained request'));
          retained.appendChild(el('p','maker-row',intended.lines.length?intended.lines.join(String.fromCharCode(10)):'Clear notice'));
        }finally{busy=false;state();}
      }
      set.onclick=function(){
        var lines=text.value.split(String.fromCharCode(10)).map(function(line){return line.trim();}).filter(Boolean);
        if(!lines.length){status.textContent='Write a notice first, or use Clear notice.';return;}
        submit(lines);
      };
      clear.onclick=function(){submit([]);};
      refresh.onclick=async function(){
        if(busy)return;busy=true;state();
        try{await read();}catch(error){status.textContent=error.message;}finally{busy=false;state();}
      };
    }
    async function read(){
      var result=await refs('/all/maker/bulletin');
      document.getElementById('makerBulletinCurrent').textContent=(result.lines||[]).join(' · ')||'No notice.';
      status.textContent='Current notice read. Changes notify customers only after Set.';
      root.dispatchEvent(new CustomEvent('maker-notice-read',{detail:result}));
    }
    try{await read();}catch(error){status.textContent=error.message;}
  }
  function makerPushResult(push){
    if(!push) return ' Notification outcome not returned.';
    if(!push.ok) return ' Notification not confirmed: '+(push.error||'read the account before retrying.');
    if(push.failed) return ' '+push.failed+' notifications were not sent.';
    return push.sent?' Notifications accepted by the delivery service.':' No subscribed devices.';
  }
  function makerCommunicationError(error){
    return error.message.indexOf('Not sent.')===0
      ?'Confirmation not received. Check the connection; the result may already be recorded.':error.message;
  }
  function makerReading(parent, reading){
    if(reading.cost!=null){
      var cost=typeof reading.cost==='object'?reading.cost.total:reading.cost;
      parent.appendChild(el('p','maker-facts','Cost RM '+Number(cost).toFixed(2)));
    }
    if(reading.margin) parent.appendChild(el('p','maker-facts','Margin RM '+Number(reading.margin.rm).toFixed(2)+' · '+reading.margin.pct+'%'));
    if(reading.reasoning) parent.appendChild(el('p','salt-insight',reading.reasoning));
    (reading.flags||[]).forEach(function(flag){ parent.appendChild(el('p','salt-insight',String(flag))); });
    if(reading.row){
      var detail=el('details',''), summary=el('summary','','Proposed row');
      detail.appendChild(summary); detail.appendChild(el('pre','maker-row',JSON.stringify(reading.row,null,2))); parent.appendChild(detail);
    }
  }
  function makerButton(parent, label, action, primary){
    var b=el('button',primary?'btn salt-pill salt-pill--md':'salt-ghost',label);
    var busy=false, pending=null, cancel=el('button','salt-ghost','Cancel retained input');
    cancel.type='button';cancel.hidden=true;
    cancel.onclick=function(){
      if(pending&&confirm('Cancel this retained request on this device? A server-committed input is not withdrawn.')){
        makerClear(pending.path);pending=null;cancel.hidden=true;
      }
    };
    var message=function(){
      var section=parent.closest('.maker-input');
      return parent.querySelector(':scope > [role="status"]')
        ||section&&section.querySelector(':scope > [role="status"]')||parent.querySelector('[role="status"]');
    };
    var changed=function(){if(!pending||!makerSaved(pending.path))pending=null;};
    parent.addEventListener('input',changed); parent.addEventListener('change',changed);
    var send=function(path,body,intent){
      if(!pending) pending={path:path,body:JSON.parse(JSON.stringify(body))};
      if(pending.path!==path) return Promise.reject(new Error('Finish the pending input before starting another.'));
      if(path.indexOf('/all/maker/inputs/')===0){
        var saved=makerSaved(path);
        if(saved&&JSON.stringify(saved.body)!==JSON.stringify(pending.body)){
          var metadata=function(value){var copy=Object.assign({},value);['at','vault','addrVault','pair'].forEach(function(key){delete copy[key];});return JSON.stringify(copy);};
          if(!intent||!saved.body.pair||metadata(saved.body)!==metadata(pending.body))
            return Promise.reject(new Error('A retained request needs Retry, Review or explicit Cancel before another input.'));
        }
        if(intent){pending.base=intent.base;pending.desired=intent.desired;}
        makerSave(pending);
        cancel.hidden=false;
      }
      return refs(pending.path,pending.body).then(function(result){
        if(!result||result.ok!==true)throw new Error('The input completion was not confirmed. Its request is kept.');
        makerClear(pending.path);pending=null;cancel.hidden=true;return result;
      },function(error){
        /* a refusal that leaves nothing to retry (no proposal to accept) clears the retained request and its Cancel */
        if(error.status===400&&path==='/all/maker/inputs/tier-accept-all'){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.status===400&&path==='/all/maker/inputs/house-sizes'){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.detail&&(error.detail.twin||error.detail.code==='vaultConflict')){
          cancel.onclick=function(){if(confirm('Cancel this retained request on this device? A server-committed input is not withdrawn.')){makerClear(path);pending=null;cancel.hidden=true;}};
          pending=null;
        }
        throw error;
      });
    };
    b.type='button'; b.addEventListener('click',async function(){
      if(busy)return;
      busy=true;b.disabled=true;
      var controls=Array.from(parent.querySelectorAll('input,select,textarea,button')).filter(function(control){return control!==b;});
      var disabled=controls.map(function(control){return control.disabled;});
      controls.forEach(function(control){control.disabled=true;});
      try{
        if(pending){
          await send(pending.path,pending.body);
          var status=message();
          if(status)status.textContent='Sent for review.';
          await loadMaker();
        }else await action(send);
      }catch(error){
        var failure=message();
        if(failure)failure.textContent=error.message;
        else throw error;
      }
      finally{
        controls.forEach(function(control,index){control.disabled=disabled[index];});
        busy=false;b.disabled=false;
      }
    }); parent.appendChild(b);parent.appendChild(cancel);return b;
  }
      function makerSaved(path){
        var text=localStorage.getItem('saltMakerPending:'+path);
        if(!text)return null;
        var saved=JSON.parse(text);
        if(!makerGeo.pendingOk(saved))throw new Error('The retained request is invalid. Explicitly cancel it before another input.');
        return saved;
      }
      function makerSave(record){
        if(!makerGeo.pendingOk(record))throw new Error('The retry record contains unsupported metadata. Nothing was sent.');
        localStorage.setItem('saltMakerPending:'+record.path,JSON.stringify(record));
      }
      function makerClear(path){localStorage.removeItem('saltMakerPending:'+path);}
      function makerRecovery(parent){
        var keys=Object.keys(localStorage).filter(function(key){return key.indexOf('saltMakerPending:')===0;});
        keys.forEach(function(key){
          var path=key.slice('saltMakerPending:'.length),saved;
          var section=el('section','maker-input');section.appendChild(el('h3',null,'Retained input'));
          var status=makerStatus(section),pass=makerField(section,'Vault passphrase','password','');
          parent.appendChild(section);
          try{saved=makerSaved(path);status.textContent=path.split('/').pop()+' · retained on this device. Retry is unchanged; Review starts a new request.';}
          catch(error){status.textContent=error.message;}
          var run=async function(review){
            try{
              if(!saved)throw new Error('Only explicit cancellation is available for an invalid request.');
              if(saved.body.pair||saved.body.vault||saved.body.addrVault){
                if(!pass.value)throw new Error('Unlock the retained ciphertext before retry or review.');
                await makerVaultOpen(pass.value,saved.body.pair?saved.body.pair.names:saved.body.vault||saved.body.addrVault);
                if(review){
                  if(!saved.body.pair)throw new Error('Legacy vault retries can only be sent unchanged or explicitly cancelled.');
                  var prepared=await makerPairPrepare(pass.value,function(){},saved);
                  saved={path:saved.path,body:Object.assign({},saved.body,{at:new Date().toISOString(),
                    pair:{expectedRevision:prepared.revision,names:prepared.names,places:prepared.places}}),
                    base:prepared.base,desired:prepared.desired};
                  if(saved.body.vault)saved.body.vault=prepared.names;
                  if(saved.body.addrVault)saved.body.addrVault=prepared.places;
                  makerSave(saved);
                }
              }else if(review)throw new Error('This immutable input can only be retried unchanged or explicitly cancelled.');
              pass.value='';
              var answer=await refs(saved.path,saved.body);
              if(!answer||answer.ok!==true)throw new Error('The input completion was not confirmed.');
              makerClear(saved.path);section.remove();await loadMaker();
            }catch(error){pass.value='';status.textContent=error.message;}
          };
          ['Retry unchanged','Review latest','Cancel retained input'].forEach(function(label,index){
            var button=el('button','salt-ghost',label);button.type='button';
            button.onclick=async function(){
              if(index===2){
                if(confirm('Cancel this retained request on this device? An input already committed on the server is not withdrawn.')){
                  makerClear(path);section.remove();
                }
                return;
              }
              var controls=section.querySelectorAll('button');controls.forEach(function(control){control.disabled=true;});
              try{await run(index===1);}finally{controls.forEach(function(control){control.disabled=false;});}
            };section.appendChild(button);
          });
        });
      }
  function makerField(parent, label, type, value, step){
    var wrap=el('label','maker-field'), title=el('span','lbl',label), input=el('input','fld salt-field__input');
    input.type=type; input.value=value==null?'':String(value);
    if(type==='number'){ input.step=step||'0.01'; input.min='0'; input.inputMode='decimal'; }
    wrap.appendChild(title); wrap.appendChild(input); parent.appendChild(wrap); return input;
  }
  function makerBytes64(bytes){
    var text=''; for(var i=0;i<bytes.length;i++) text+=String.fromCharCode(bytes[i]);
    return btoa(text);
  }
  function makerFrom64(value){
    var text=atob(value), bytes=new Uint8Array(text.length);
    for(var i=0;i<text.length;i++) bytes[i]=text.charCodeAt(i);
    return bytes;
  }
  async function makerVaultOpen(pass, envelope){
    if(!envelope) return {};
    var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:makerFrom64(envelope.salt),
      iterations:envelope.it||150000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    var plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(envelope.iv)},key,makerFrom64(envelope.ct));
    var value=JSON.parse(new TextDecoder().decode(plain));
    if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('The encrypted vault is not a code map.');
    return value;
  }
  async function makerPairPrepare(pass,edit,previous){
    var namesRead=await refs('/all/maker/vault'), pair=null, names,places;
    if(namesRead.revision)pair=await refs('/all/maker/vault/pair');
    var placesRead=pair?{vault:pair.places}:await refs('/all/maker/vault/addr');
    names=await makerVaultOpen(pass,pair?pair.names:namesRead.vault);
    places=await makerVaultOpen(pass,placesRead.vault);
    var base=previous?{names:await makerVaultOpen(pass,previous.base.names),places:await makerVaultOpen(pass,previous.base.places)}
      :{names:JSON.parse(JSON.stringify(names)),places:JSON.parse(JSON.stringify(places))};
    var desired=previous?{names:await makerVaultOpen(pass,previous.desired.names),places:await makerVaultOpen(pass,previous.desired.places)}
      :{names:JSON.parse(JSON.stringify(names)),places:JSON.parse(JSON.stringify(places))};
    if(!previous)edit(desired);
    var nextNames=makerGeo.merge(base.names,desired.names,names),nextPlaces=makerGeo.merge(base.places,desired.places,places);
    var conflicts=Array.from(new Set(nextNames.conflicts.concat(nextPlaces.conflicts)));
    if(conflicts.length){
      if(!confirm('The vault changed for '+conflicts.join(', ')+'. Apply your retained edit over those changed entries? Cancel keeps this draft.'))
        throw new Error('Conflict not applied. Your form is kept; review it before sending.');
      nextNames=makerGeo.merge(base.names,desired.names,names,conflicts);
      nextPlaces=makerGeo.merge(base.places,desired.places,places,conflicts);
    }
    var sealed=await Promise.all([makerVaultSeal(pass,nextNames.map),makerVaultSeal(pass,nextPlaces.map),
      makerVaultSeal(pass,base.names),makerVaultSeal(pass,base.places),makerVaultSeal(pass,desired.names),makerVaultSeal(pass,desired.places)]);
    return {base:{names:sealed[2],places:sealed[3]},desired:{names:sealed[4],places:sealed[5]},revision:pair&&pair.revision,names:sealed[0],
      places:pair&&pair.places===null&&!Object.keys(nextPlaces.map).length?null:sealed[1],placeMap:nextPlaces.map};
  }
  function makerPairBody(body,prepared){
    if(prepared.revision)body.pair={expectedRevision:prepared.revision,names:prepared.names,places:prepared.places};
    return body;
  }
  async function makerVaultSeal(pass, value){
    var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:150000,hash:'SHA-256'},
      base,{name:'AES-GCM',length:256},false,['encrypt']);
    var cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(JSON.stringify(value)));
    return {v:1,salt:makerBytes64(salt),iv:makerBytes64(iv),ct:makerBytes64(new Uint8Array(cipher))};
  }
  function makerRekeyMap(map,from,to){
    return makerGeo.rekey(map,from,to);
  }
  function makerDerivedCode(name, locality, kind, roster, except, parent){
    var n=String(name||'').trim(), local=String(locality||'').split(',')[0].trim();
    if(!n||!local) return null;
    var bits=local.split(/\\s+/), suffix=(bits.length>1?bits.map(function(x){return x.charAt(0);}).join(''):local.slice(0,3)).toUpperCase();
    if(kind==='downstream'){
      if(!parent) return null;
      var siblings=roster.filter(function(code){return code.indexOf(parent+'-')===0&&/-\\d+-/.test(code.slice(parent.length));});
      return parent+'-'+(siblings.length+1)+'-'+suffix;
    }
    var base=(kind==='supplier'?'S':'C')+n.charAt(0).toUpperCase()+n.length+'-'+suffix;
    var free=function(code){return code===except||roster.indexOf(code)<0;};
    if(free(base)) return base;
    var head=base.slice(0,2), tail=base.slice(2), more=n.slice(1).replace(/[^A-Za-z]/g,'').toUpperCase();
    for(var i=1;i<=more.length;i++){var next=head+more.slice(0,i)+tail;if(free(next)) return next;}
    for(i=2;;i++) if(free(base+i)) return base+i;
  }
  function makerStatus(parent){
    var status=el('p','msg'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    parent.appendChild(status); return status;
  }
  var makerPlaceListId=0;
  function makerLocalityField(parent){
    var input=makerField(parent,'Locality (device only)','text','');
    var list=el('datalist'), key='makerPlaces'+(++makerPlaceListId);
    list.id=key;input.setAttribute('list',key);
    makerGeo.picks().forEach(function(point,label){
      var option=el('option');option.value=label;list.appendChild(option);
    });
    parent.appendChild(list);return input;
  }
  async function makerLocalityPoint(value){
    var picked=makerGeo.picks().get(value);
    var result=picked?{point:picked}:await makerGeo.find(value);
    if(!result.point)throw new Error(result.how==='ambiguous'
      ?'That locality names more than one place. Choose its district from the list.'
      :'That locality is not on the official list. Place it on Desk first.');
    return result.point.map(function(number){return Math.round(number*100)/100;});
  }
  async function makerFiledLink(value){
    if(!value.trim())return null;
    var reading=makerGeo.link(value);
    if(reading&&reading.short){
      var expanded=await refs('/all/maker/geo/expand',{url:reading.short});
      var full=makerGeo.link(expanded.location);
      if(!full||full.short)throw new Error('The short link did not lead to a map. Paste the full link.');
      reading=Object.assign({},full,{addr:reading.addr||full.addr});
    }
    if(!reading||reading.lat==null&&!reading.addr)
      throw new Error('Paste a Maps or Waze link carrying a point or address, or clear the field.');
    return {addr:reading.addr||null,lat:reading.lat,lng:reading.lng,src:reading.src,at:new Date().toISOString()};
  }
  async function makerOtherInputs(parent,catalog){
    makerGeo.configure(catalog.placed);
    var today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
    var parties=(catalog.parties||[]).filter(function(code){return !code.endsWith('-R');});
    var books=catalog.products||[];
    var addSelect=function(root,label,items){
      var wrap=el('label','maker-field'), title=el('span','lbl',label), select=el('select','fld salt-field__input');
      items.forEach(function(item){var option=el('option',null,item.label);option.value=item.value;select.appendChild(option);});
      wrap.appendChild(title);wrap.appendChild(select);root.appendChild(wrap);return select;
    };
    var partyItems=parties.map(function(code){return {value:code,label:code};});
    var productItems=books.map(function(item){return {value:item.product,label:pshape(item.product)};});
    var loan=el('section','maker-input');loan.appendChild(el('h3',null,'Borrow or lend'));
    loan.appendChild(el('p','msg','Cash and in-kind loans use the ledger’s loan rows. Notes are disabled here: free text could disclose names or places.'));
    parent.appendChild(loan);
    var loanForm=addSelect(loan,'Form',[{value:'salt',label:'In kind'},{value:'cash',label:'Cash'}]);
    var loanDirection=addSelect(loan,'Direction',[{value:'in',label:'Borrow'},{value:'out',label:'Lend'}]);
    var loanParty=addSelect(loan,'Party',partyItems), loanProduct=addSelect(loan,'Book',productItems);
    var loanDate=makerField(loan,'Date','date',today), loanAmount=makerField(loan,'Units or RM','number','1');
    var loanStatus=makerStatus(loan);
    makerButton(loan,'Send loan for review',async function(send){
      if(!loanStatus) return;
      loanStatus.textContent='Sending to the Desk…';
      var body={at:new Date().toISOString(),form:loanForm.value,direction:loanDirection.value,
        code:loanParty.value,date:loanDate.value,amount:Number(loanAmount.value)};
      if(loanForm.value==='salt') body.product=loanProduct.value;
      try{await send('/all/maker/inputs/loan',body);loanStatus.textContent='Sent for review. It changes the loan book only when approved and folded.';loadMaker();}
      catch(error){loanStatus.textContent=error.message;}
    },true);
    var gift=el('section','maker-input');gift.appendChild(el('h3',null,'Gift'));
    gift.appendChild(el('p','msg','The Desk costs this from the inventory and books goodwill, not a reward redemption. No note field is sent.'));
    parent.appendChild(gift);
    var giftParty=addSelect(gift,'Party',partyItems), giftProduct=addSelect(gift,'Book',productItems);
    var giftDate=makerField(gift,'Date','date',today), giftQty=makerField(gift,'Units','number','1');
    var giftHandover=addSelect(gift,'Handover',[{value:'',label:'Not stated'},{value:'collected',label:'Collected'},{value:'delivered',label:'Delivered'}]);
    var giftStatus=makerStatus(gift);
    makerButton(gift,'Send gift for review',async function(send){
      var body={at:new Date().toISOString(),product:giftProduct.value,code:giftParty.value,date:giftDate.value,
        qty:Number(giftQty.value),movedUnits:Number(giftQty.value),handover:giftHandover.value||null};
      giftStatus.textContent='Sending to the Desk…';
      try{await send('/all/maker/inputs/gift',body);giftStatus.textContent='Sent for review. It changes nothing until approved and folded.';loadMaker();}
      catch(error){giftStatus.textContent=error.message;}
    },true);
    var repay=el('section','maker-input');repay.appendChild(el('h3',null,'Repayment'));
    repay.appendChild(el('p','msg','Choose an open loan. The Desk checks the remaining amount and whether it is due in units or RM.'));
    parent.appendChild(repay);
    var loanItems=(catalog.loans||[]).map(function(item){return {value:item.rid,label:item.party+' · '+item.rid+' · '+item.remaining+' '+(item.form==='cash'?'RM':'unit')};});
    var repayLoan=addSelect(repay,'Open loan',loanItems), repayDate=makerField(repay,'Date','date',today),
      repayAmount=makerField(repay,'Amount','number','1'), repayStatus=makerStatus(repay);
    makerButton(repay,'Send repayment for review',async function(send){
      repayStatus.textContent='Sending to the Desk…';
      try{await send('/all/maker/inputs/repay',{at:new Date().toISOString(),loan:repayLoan.value,
        date:repayDate.value,amount:Number(repayAmount.value)});
        repayStatus.textContent='Sent for review. It settles only when approved and folded.';loadMaker();}
      catch(error){repayStatus.textContent=error.message;}
    },true);
    var redeem=el('section','maker-input');redeem.appendChild(el('h3',null,'Reward redemption'));
    redeem.appendChild(el('p','msg','The Desk derives the balance. An outstanding advance is offset first; otherwise the reward is redeemed in kind.'));
    parent.appendChild(redeem);
    var redeemParty=addSelect(redeem,'Party',partyItems), redeemDate=makerField(redeem,'Date','date',today),
      redeemStatus=makerStatus(redeem);
    makerButton(redeem,'Redeem or offset',async function(send){
      redeemStatus.textContent='Checking the reward on the Desk…';
      try{await send('/all/maker/inputs/redeem',{at:new Date().toISOString(),code:redeemParty.value,date:redeemDate.value});
        redeemStatus.textContent='Sent for review. The Desk chose the oldest advance or an in-kind redemption.';loadMaker();}
      catch(error){redeemStatus.textContent=error.message;}
    },true);
    var offsets=el('section','maker-input');offsets.appendChild(el('h3',null,'Automatic offsets'));
    offsets.appendChild(el('p','msg','What the Desk offers an associate holding a reward and an unpaid advance: one unit against the oldest order. A departed holder is never offered. Each tap waits for approval.'));
    parent.appendChild(offsets);
    var offerDate=makerField(offsets,'Date','date',today), offerStatus=makerStatus(offsets),
      offerList=el('div','maker-offers'), offerAt={};
    offsets.appendChild(offerList);
    var offerLoad=async function(){
      offerStatus.textContent='Reading offers from the Desk…';
      try{
        var read=await refs('/all/maker/offsets');
        offerList.textContent='';
        offerStatus.textContent=read.offers.length?read.offers.length+' offered.':'No offset is offered.';
        read.offers.forEach(function(offer){
          var row=el('div','maker-offer');
          row.appendChild(el('p','maker-facts',offer.code+' · '+offer.units+' unit · RM '+offer.rm.toFixed(2)+' against the '+(offer.saleDate||'undated')+' order '+offer.rid));
          makerButton(row,'Send offset for review',async function(){
            var key=offer.code+'|'+offer.rid+'|'+offerDate.value, at=offerAt[key]||(offerAt[key]=new Date().toISOString());
            offerStatus.textContent='Sending to the Desk…';
            try{
              await refs('/all/maker/inputs/offset',{at:at,code:offer.code,rid:offer.rid,date:offerDate.value});
              delete offerAt[key];
              await offerLoad();
              offerStatus.textContent='Sent for review. It settles in kind only when approved and folded.';
              loadMaker();
            }catch(error){offerStatus.textContent=error.message;}
          },true);
          offerList.appendChild(row);
        });
      }catch(error){offerStatus.textContent=error.message;}
    };
    offerLoad();
    var editor=el('section','maker-input');editor.appendChild(el('h3',null,'Amend a ledger row'));
    editor.appendChild(el('p','msg','Correction restates typed fields; Fulfilment records cash or units; Cancellation withdraws an open row with no goods moved. A purchase lot also takes Payment (cash), Receipt (units) and Default (nothing arrived). Notes, settlement prose, order-code edits and cancelled/defaulted-row editing stay on Desk. Linked/Rewarded are unavailable here and refused by the cloud drafter.'));
    parent.appendChild(editor);
    var rows=catalog.rows||[], rowItems=rows.map(function(row){return {value:row.rid,
      label:row.rid+' · '+row.party+' · '+pshape(row.product)+' · '+(row.date||'Undated')+' · '+row.qty+' unit · RM '+row.total};});
    var editRow=addSelect(editor,'Ledger row',rowItems),
      editKind=addSelect(editor,'Amendment',[{value:'Correction',label:'Correction'},
        {value:'Fulfilment',label:'Fulfilment'},{value:'Cancellation',label:'Cancellation'}]),
      editDate=makerField(editor,'Recorded on','date',today);
    var movement=el('div','maker-fields');editor.appendChild(movement);
    var editCash=makerField(movement,'RM moved','number','0'), editUnits=makerField(movement,'Units moved','number','0');
    var patch=el('div','maker-fields');editor.appendChild(patch);
    var definitions=catalog.correctionFields||[];
    var editField=addSelect(patch,'Field',definitions.map(function(item){return {value:item.field,label:item.field};}));
    var valueBox=el('div','maker-fields');patch.appendChild(valueBox);
    var editValue=null, changes={}, patchList=el('p','msg');patch.appendChild(patchList);
    var editStatus=makerStatus(editor);
    var drawValue=function(){
      valueBox.replaceChildren();
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition)return;
      var choices=definition.kind==='boolean'?[{value:'true',label:'True'},{value:'false',label:'False'}]
        :definition.kind==='code'?partyItems
          :definition.kind==='product'?productItems
            :definition.kind==='stream'?[{value:'R2',label:'R2'},{value:'R3',label:'R3'}]
              :definition.kind==='handover'?[{value:'delivered',label:'Delivered'},{value:'collected',label:'Collected'}]:null;
      if(choices)editValue=addSelect(valueBox,'Set to',choices);
      else editValue=makerField(valueBox,'Set to',definition.kind==='date'?'date':'number','');
    };
    editField.addEventListener('change',drawValue);drawValue();
    makerButton(patch,'Add field change',function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||!editValue)return;
      if(!editValue.value.trim())throw new Error('Choose a value. Use Clear field to remove an optional value.');
      changes[definition.field]=definition.kind==='number'?Number(editValue.value)
        :definition.kind==='boolean'?editValue.value==='true':editValue.value;
      patchList.textContent=Object.keys(changes).join(', ')+' ready to send.';
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    makerButton(patch,'Clear field',function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||definition.required)throw new Error('This field is required; set a replacement value.');
      changes[definition.field]=null;patchList.textContent=Object.keys(changes).join(', ')+' ready to send.';
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    editRow.addEventListener('change',function(){changes={};patchList.textContent='';});
    var kindsFor=function(){
      var row=rows.find(function(item){return item.rid===editRow.value;}), kept=editKind.value;
      var names=row&&row.direction==='BUY'?['Correction','Fulfilment','Cancellation','Payment','Receipt','Default']:['Correction','Fulfilment','Cancellation'];
      editKind.replaceChildren();
      names.forEach(function(name){var option=el('option',null,name);option.value=name;editKind.appendChild(option);});
      editKind.value=names.indexOf(kept)>=0?kept:'Correction';
    };
    var drawKind=function(){var k=editKind.value;
      movement.style.display=(k==='Fulfilment'||k==='Payment'||k==='Receipt')?'':'none';
      editCash.parentNode.style.display=k==='Receipt'?'none':'';editUnits.parentNode.style.display=k==='Payment'?'none':'';
      patch.style.display=k==='Correction'?'':'none';};
    editKind.addEventListener('change',drawKind);editRow.addEventListener('change',function(){kindsFor();drawKind();});kindsFor();drawKind();
    var editorButton=makerButton(editor,'Send amendment for review',async function(send){
      var body={at:new Date().toISOString(),rid:editRow.value,kind:editKind.value,date:editDate.value};
      if(body.kind==='Correction')body.fields=Object.assign({},changes);
      if(body.kind==='Fulfilment'){body.cash=Number(editCash.value);body.movedUnits=Number(editUnits.value);}
      if(body.kind==='Payment')body.cash=Number(editCash.value);
      if(body.kind==='Receipt')body.movedUnits=Number(editUnits.value);
      editStatus.textContent='Checking the ledger row…';
      await send('/all/maker/inputs/ledger-amend',body);
      changes={};patchList.textContent='';editStatus.textContent='Sent for review. The row changes only after approval and the fold.';
      await loadMaker();
    },true);
    editorButton.disabled=!rows.length;
    if(!rows.length)editStatus.textContent='No ledger row is available.';
    var id=el('section','maker-input');id.appendChild(el('h3',null,'Add ID'));
    id.appendChild(el('p','msg','Name and locality stay in this device until encrypted. Only the derived code, role and sealed envelope leave it. A name/place note is never sent.'));
    parent.appendChild(id);
    var idKind=addSelect(id,'Role',[{value:'customer',label:'Customer'},{value:'supplier',label:'Supplier'},
      {value:'reseller',label:'Reseller'},{value:'referral',label:'Referral'},
      {value:'downstream',label:'Downstream buyer'},{value:'bucket',label:'Resale account'}]);
    var idParentItems=(catalog.associates||[]).map(function(item){return {value:item.code,label:item.code};});
    var idParent=addSelect(id,'Parent / associate',idParentItems);
    var idName=makerField(id,'Name (device only)','text',''), idPlace=makerLocalityField(id);
    var idPass=makerField(id,'Vault passphrase','password','');
    var idLink=makerField(id,'Maps / Waze link (device only)','text','');
    var tierBooks=books.filter(function(item){return item.tiered;});
    var idTierProduct=addSelect(id,'Starting tier book',[{value:'',label:'No starting tier'}]
      .concat(tierBooks.map(function(item){return {value:item.product,label:pshape(item.product)};})));
    var idTier=addSelect(id,'Starting tier',[{value:'',label:'No starting tier'}]
      .concat((catalog.tierNames||[]).map(function(name){return {value:name,label:name};})));
    var idStatus=makerStatus(id), idBusy=false;
    idKind.addEventListener('change',function(){
      var bucket=idKind.value==='bucket', needsParent=bucket||idKind.value==='downstream';
      idName.disabled=bucket;idPlace.disabled=bucket;idPass.disabled=bucket;idLink.disabled=bucket;
      idParent.disabled=!needsParent;
    });
    idKind.dispatchEvent(new Event('change'));
    var idDraft=null;
    id.addEventListener('input',function(event){if(event.target!==idPass)idDraft=null;});
    id.addEventListener('change',function(event){if(event.target!==idPass)idDraft=null;});
    makerButton(id,'Encrypt and send Add ID',async function(send){
      if(idBusy)return;idBusy=true;idStatus.textContent='Preparing the device-side vault…';
      var kind=idKind.value, parentCode=(kind==='bucket'||kind==='downstream')?idParent.value:null;
      var name=idName.value.trim(), locality=idPlace.value.trim(), code;
      if(kind==='bucket') code=parentCode?parentCode+'-R':null;
      else code=makerDerivedCode(name,locality,kind,catalog.parties||[],null,parentCode);
      if(!code){idStatus.textContent='Enter a name and locality, or choose the parent for a resale account.';idBusy=false;return;}
      var envelope=null,addrEnvelope=null,geo=null;
      try{
        if(kind!=='bucket'){
          var pass=idPass.value;
          if(!pass) throw new Error('Enter the vault passphrase on this device.');
          geo=await makerLocalityPoint(locality);
          var filed=await makerFiledLink(idLink.value);
          idDraft=await makerPairPrepare(pass,function(maps){
            if(Object.hasOwn(maps.names,code))throw new Error('That code is already filed in the vault. Keep this form and review its identity.');
            maps.names[code]=name+' ('+locality+')';if(filed)maps.places[code]=filed;
          },idDraft);
          envelope=idDraft.names;if(filed)addrEnvelope=idDraft.places;delete idDraft.placeMap;
          idPass.value='';pass='';
        }
        var tiers=idTier.value?{[idTierProduct.value]:idTier.value}:null;
        if(idTier.value&&!idTierProduct.value) throw new Error('Choose a tiered book for the starting tier.');
        var idBody={at:new Date().toISOString(),code:code,kind:kind,
          parent:parentCode,geo:geo,tiers:tiers,vault:envelope};
        if(addrEnvelope)idBody.addrVault=addrEnvelope;
        if(idDraft)makerPairBody(idBody,idDraft);
        await send('/all/maker/inputs/add-id',idBody,idDraft);
        idDraft=null;
        idName.value='';idPlace.value='';idLink.value='';idStatus.textContent='Encrypted envelope filed; '+code+' is queued for review.';
        loadMaker();
      }catch(error){idPass.value='';idStatus.textContent=error.message;}
      idBusy=false;
    },true);
    var amend=el('section','maker-input');amend.appendChild(el('h3',null,'Amend ID'));
    amend.appendChild(el('p','msg','Names and filed addresses are re-keyed and encrypted here. Choose the locality; an optional map link replaces the encrypted address. Only codes and the rounded locality point are queued.'));
    parent.appendChild(amend);
    var amendParty=addSelect(amend,'Party',partyItems), amendName=makerField(amend,'Name (device only)','text',''),
      amendPlace=makerLocalityField(amend), amendPass=makerField(amend,'Vault passphrase','password',''),
      amendStatus=makerStatus(amend), amendBusy=false;
    var amendLink=makerField(amend,'Maps / Waze link (device only)','text','');
    var amendDraft=null;
    amend.addEventListener('input',function(event){if(event.target!==amendPass)amendDraft=null;});
    amend.addEventListener('change',function(event){if(event.target!==amendPass)amendDraft=null;});
    makerButton(amend,'Encrypt and send Amend ID',async function(send){
      if(amendBusy)return;amendBusy=true;amendStatus.textContent='Preparing the device-side vault…';
      var from=amendParty.value, kind=from.charAt(0)==='S'?'supplier':'customer';
      var name=amendName.value.trim(), locality=amendPlace.value.trim(), to=makerDerivedCode(name,locality,kind,catalog.parties||[],from);
      if(!to){amendStatus.textContent='Enter a name and locality first.';amendBusy=false;return;}
      try{
        var pass=amendPass.value;if(!pass) throw new Error('Enter the vault passphrase on this device.');
        var geo=await makerLocalityPoint(locality), filed=await makerFiledLink(amendLink.value);
        amendDraft=await makerPairPrepare(pass,function(maps){
          maps.names=makerRekeyMap(maps.names,from,to);maps.places=makerRekeyMap(maps.places,from,to);
          maps.names[to]=name+' ('+locality+')';if(filed)maps.places[to]=filed;
        },amendDraft);
        delete amendDraft.placeMap;
        amendPass.value='';pass='';
        var result=await send('/all/maker/inputs/amend-id',makerPairBody({at:new Date().toISOString(),from:from,to:to,geo:geo,
          vault:amendDraft.names,addrVault:amendDraft.places||undefined},amendDraft),amendDraft);
        amendDraft=null;
        amendName.value='';amendPlace.value='';amendLink.value='';
        amendStatus.textContent=result.vaultOnly?'Encrypted vault updated; the code stays '+from+'.'
          :'Encrypted vault filed; re-key '+from+' to '+to+' is queued for Desk review.';
        loadMaker();
      }catch(error){amendPass.value='';amendStatus.textContent=error.message;}
      amendBusy=false;
    },true);
    var placement=el('section','maker-input');placement.appendChild(el('h3',null,'Map placement'));
    placement.appendChild(el('p','msg','Keep the filed point, or choose a locality and paste a new map link. Exact points and addresses stay encrypted; the queue receives only the rounded point and code.'));
    parent.appendChild(placement);
    var placeParty=addSelect(placement,'Party with a filed point',partyItems),
      placePass=makerField(placement,'Vault passphrase','password',''), placeStatus=makerStatus(placement), placeBusy=false;
    var placeLocality=makerLocalityField(placement), placeLink=makerField(placement,'New Maps / Waze link (device only)','text','');
    var placeDraft=null;
    placement.addEventListener('input',function(event){if(event.target!==placePass)placeDraft=null;});
    placement.addEventListener('change',function(event){if(event.target!==placePass)placeDraft=null;});
    makerButton(placement,'Queue map placement',async function(send){
      if(placeBusy)return;placeBusy=true;placeStatus.textContent='Opening the encrypted places vault on this device…';
      try{
        var pass=placePass.value;if(!pass) throw new Error('Enter the vault passphrase on this device.');
        var filed=await makerFiledLink(placeLink.value), coords, envelope;
        placeDraft=await makerPairPrepare(pass,function(maps){if(filed)maps.places[placeParty.value]=filed;},placeDraft);
        var places=placeDraft.placeMap;
        if(filed){
          coords=await makerLocalityPoint(placeLocality.value.trim());
          envelope=placeDraft.places;
        }else if(placeLocality.value.trim())coords=await makerLocalityPoint(placeLocality.value.trim());
        else{
          var point=places[placeParty.value];
          if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))
            throw new Error('That party has no point in the encrypted places vault. Choose a locality first.');
          coords=[Math.round(point.lat*100)/100,Math.round(point.lng*100)/100];
        }
        delete placeDraft.placeMap;
        placePass.value='';pass='';
        var body={at:new Date().toISOString(),places:{[placeParty.value]:coords}};
        if(envelope)body.addrVault=envelope;
        makerPairBody(body,placeDraft);
        await send('/all/maker/inputs/place',body,placeDraft);
        placeDraft=null;
        placeLocality.value='';placeLink.value='';
        placeStatus.textContent='Approximate point queued for Desk review. The address remains encrypted.';
        loadMaker();
      }catch(error){placePass.value='';placeStatus.textContent=error.message;}
      placeBusy=false;
    },true);
  }
  function makerCard(parent){
    var card=el('article','salt-glass-card maker-card');
    parent.appendChild(card); return card;
  }
  function makerAction(path, body, message){
    if(makerBusy) return Promise.resolve();
    makerBusy=true;
    return refs(path,body).then(function(result){
      makerBusy=false;
      var status=document.getElementById('makerReviewStatus');
      return loadMaker().then(function(){
        if(status) status.textContent=result.differs?'The row differs from the preview and waits for review.'
          :result.waiting?'The row is being drafted; acknowledgement is still waiting.'
          :result.preapproval&&result.preapproval.says?result.preapproval.says:message||'Saved.';
        return true;
      });
    },function(error){
      makerBusy=false;
      var status=document.getElementById('makerReviewStatus');
      if(status) status.textContent=error.message;
      return false;
    });
  }
  /* one request id per move until it lands, so a retry after a lost answer is the same request */
  var makerRids={};
  function makerMove(order,body,message){
    var key=order.id+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+(body.claim?'notfound':'move'),
      Object.assign({rid:rid},body),message).then(function(done){ if(done) delete makerRids[key]; });
  }
  function makerOrderMoves(card,order){
    var reason=makerField(card,'Reason to the customer (Decline or Cancel, optional)','text','');
    var said=makerField(card,'Reply to the customer','text','');
    makerButton(card,'Send reply',function(){
      if(!said.value.trim()) return;
      makerMove(order,{message:said.value.trim()},'Reply sent.');
    },false);
    makerButton(card,'No reply needed',function(){ makerMove(order,{noReply:true},'No reply needed recorded.'); },false);
    var note=function(){ var t=reason.value.trim(); return t?{note:t}:{}; };
    if(order.status==='placed')
      makerButton(card,'Decline',function(){
        if(!window.confirm('Decline this order?')) return;
        makerMove(order,Object.assign({status:'declined'},note()),'Order declined.');
      },false);
    else if((order.status==='acknowledged'||order.status==='ready')&&!order.closed&&!(+order.paid>0)&&!(+order.claimed>0)&&!(+order.moved>0))
      makerButton(card,'Cancel order',function(){
        if(!window.confirm('Cancel this order? Nothing is paid on it.')) return;
        makerMove(order,Object.assign({status:'cancelled'},note()),'Order cancelled.');
      },false);
  }
  async function loadMakerInputs(){
    var box=document.getElementById('makerInputs'); if(!box||box.childElementCount>1) return;
    var note=el('p','msg','Reading available books…'); note.setAttribute('role','status'); box.appendChild(note);
    try{
      var context=await refs('/all/maker/inputs');
      makerRecovery(box);
      if(!Array.isArray(context.products)||!context.products.length) throw new Error('No active book is available.');
      note.textContent='Inputs are checked by the Desk and wait for review before they change the book.';
      var label=el('label','maker-field','Book'), product=el('select','fld salt-field__input');
      context.products.forEach(function(code){ var option=el('option',null,pshape(code)); option.value=code; product.appendChild(option); });
      label.appendChild(product); box.appendChild(label);
      var date=makerField(box,'Counted on','date',''), qty=makerField(box,'Stock count: units','number','', '0.01');
      var pending=false, at=null, signature='', answer=el('p','msg'); answer.setAttribute('role','status'); box.appendChild(answer);
      var button=makerButton(box,'Record count',async function(send){
        if(pending) return;
        var body={product:product.value,date:date.value,qty:qty.value===''?null:Number(qty.value)};
        var now=JSON.stringify(body); if(now!==signature){ signature=now; at=new Date().toISOString(); }
        body.at=at; pending=true; button.disabled=true; answer.textContent='Recording…';
        try{ await send('/all/maker/inputs/stock-count',body); answer.textContent='Recorded. Review its row under Order review.'; loadMaker(); }
        catch(error){ answer.textContent=error.message; }
        pending=false; button.disabled=false;
      },true);
      var catalog=context.catalog||{}, tradeSection=el('section','maker-input');
      tradeSection.appendChild(el('h3',null,'Sale or purchase'));
      tradeSection.appendChild(el('p','msg','Goods and carriage stay separate. Notes are disabled here: this route cannot safely prove arbitrary prose contains no names or places.'));
      box.appendChild(tradeSection);
      var direction=el('select','fld salt-field__input');
      [['sale','Sale'],['purchase','Purchase']].forEach(function(item){
        var option=el('option',null,item[1]); option.value=item[0]; direction.appendChild(option);
      });
      var directionLabel=el('label','maker-field','Entry');
      directionLabel.appendChild(direction); tradeSection.appendChild(directionLabel);
      var tradeProduct=el('select','fld salt-field__input'), tradeParty=el('select','fld salt-field__input');
      var productLabel=el('label','maker-field','Book'), partyLabel=el('label','maker-field','Party');
      productLabel.appendChild(tradeProduct); partyLabel.appendChild(tradeParty);
      tradeSection.appendChild(productLabel); tradeSection.appendChild(partyLabel);
      var tradeDate=makerField(tradeSection,'Date','date',''), tradeQty=makerField(tradeSection,'Units','number','1','0.01');
      var tradeTotal=makerField(tradeSection,'Goods total (RM)','number','','0.01');
      var tradeCash=makerField(tradeSection,'Cash recorded (RM)','number','0','0.01');
      var tradeMoved=makerField(tradeSection,'Units moved','number','0','0.01');
      var handover=el('select','fld salt-field__input');
      [['','Not stated'],['collected','Collected'],['delivered','Delivered']].forEach(function(item){
        var option=el('option',null,item[1]); option.value=item[0]; handover.appendChild(option);
      });
      var handoverLabel=el('label','maker-field','Handover'); handoverLabel.appendChild(handover); tradeSection.appendChild(handoverLabel);
      var carriage=makerField(tradeSection,'Delivery (RM)','number','0','0.01');
      var tradeAnswer=el('p','msg'); tradeAnswer.setAttribute('role','status'); tradeSection.appendChild(tradeAnswer);
      var tradePending=false, tradeAt=null, tradeSignature='';
      function fillTradeChoices(){
        var isSale=direction.value==='sale';
        tradeProduct.textContent='';
        (catalog.products||[]).filter(function(item){ return isSale?item.saleReady:item.purchaseReady; }).forEach(function(item){
          var option=el('option',null,pshape(item.product)); option.value=item.product; tradeProduct.appendChild(option);
        });
        tradeParty.textContent='';
        (catalog.parties||[]).forEach(function(code){
          var option=el('option',null,code); option.value=code; tradeParty.appendChild(option);
        });
        carriage.parentNode.querySelector('.lbl').textContent=isSale?'Delivery (RM)':'Freight (RM)';
      }
      direction.addEventListener('change',fillTradeChoices);
      fillTradeChoices();
      async function submitTrade(confirmedTwin,send){
        if(tradePending) return;
        var isSale=direction.value==='sale';
        var body={product:tradeProduct.value,party:tradeParty.value,date:tradeDate.value,
          qty:tradeQty.value===''?null:Number(tradeQty.value),total:tradeTotal.value===''?null:Number(tradeTotal.value),
          cash:tradeCash.value===''?null:Number(tradeCash.value),movedUnits:tradeMoved.value===''?null:Number(tradeMoved.value),
          handover:handover.value||null};
        body[isSale?'delivery':'freight']=carriage.value===''?null:Number(carriage.value);
        if(confirmedTwin) body.second=confirmedTwin;
        var check=JSON.stringify(body);
        if(check!==tradeSignature){ tradeSignature=check; tradeAt=new Date().toISOString(); }
        body.at=tradeAt;
        tradePending=true; tradeAnswer.textContent='Sending to the Desk…';
        try{
          var result=await send('/all/maker/inputs/'+direction.value,body);
          tradeAnswer.textContent=result.status==='pending'
            ?'Sent for review. It changes nothing until approved and folded.'
            :'Recorded for review.';
          loadMaker();
        }catch(error){
          tradeAnswer.textContent=error.message;
          var twin=error.detail&&error.detail.twin&&error.detail.twin.second;
          if(twin&&!confirmedTwin&&window.confirm('A matching row is already booked. Record this as a separate order?')){
            tradeSignature=''; tradePending=false; await submitTrade(twin,send); return;
          }
        }
        tradePending=false;
      }
      makerButton(tradeSection,'Send trade for review',function(send){ return submitTrade(null,send); },true);
      var tierSection=el('section','maker-input');
      tierSection.appendChild(el('h3',null,'Customer tier'));
      tierSection.appendChild(el('p','msg','Tiered books only. Set a held level or clear it; proposals do not move held tiers.'));
      tradeSection.parentNode.insertBefore(tierSection,tradeSection.nextSibling);
      var tierCodes=catalog.tierCustomers||[], tierBooks=(catalog.products||[]).filter(function(item){ return item.tiered; });
      if(!tierCodes.length||!tierBooks.length||!(catalog.tierNames||[]).length){
        tierSection.appendChild(el('p','msg','No tiered customer input is available.'));
      }else{
        var tierCode=el('select','fld salt-field__input'), tierProduct=el('select','fld salt-field__input'), tierValue=el('select','fld salt-field__input');
        tierCodes.forEach(function(code){ var option=el('option',null,code); option.value=code; tierCode.appendChild(option); });
        tierBooks.forEach(function(item){ var option=el('option',null,pshape(item.product)); option.value=item.product; tierProduct.appendChild(option); });
        [['','Clear held tier']].concat((catalog.tierNames||[]).map(function(name){ return [name,name]; })).forEach(function(item){
          var option=el('option',null,item[1]); option.value=item[0]; tierValue.appendChild(option);
        });
        [['Customer',tierCode],['Book',tierProduct],['Held level',tierValue]].forEach(function(item){
          var wrap=el('label','maker-field',item[0]); wrap.appendChild(item[1]); tierSection.appendChild(wrap);
        });
        var tierAnswer=el('p','msg'); tierAnswer.setAttribute('role','status'); tierSection.appendChild(tierAnswer);
        var tierPending=false, tierAt=null, tierSignature='';
        makerButton(tierSection,'Send tier for review',async function(send){
          if(tierPending) return;
          var body={code:tierCode.value,product:tierProduct.value,tier:tierValue.value||null};
          var check=JSON.stringify(body); if(check!==tierSignature){ tierSignature=check; tierAt=new Date().toISOString(); }
          body.at=tierAt; tierPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); tierAnswer.textContent='Sent for review. The held tier changes only when folded.'; loadMaker(); }
          catch(error){ tierAnswer.textContent=error.message; }
          tierPending=false;
        },true);
        /* A1: the Desk's Accept all. The Desk reads its own proposals; held tiers and tiers already waiting are left alone. */
        var allAnswer=el('p','msg'); allAnswer.setAttribute('role','status'); tierSection.appendChild(allAnswer);
        var allPending=false, allAt=null;
        makerButton(tierSection,'Accept tier proposals',async function(send){
          if(allPending) return;
          if(!allAt) allAt=new Date().toISOString();
          allPending=true;
          try{ await send('/all/maker/inputs/tier-accept-all',{at:allAt}); allAt=null;
            allAnswer.textContent='Proposals sent for review. Held tiers were not moved.'; loadMaker(); }
          catch(error){ allAnswer.textContent=error.message; }
          allPending=false;
        },false);
      }
      /* A6: the Desk's Make it the house board. Which sizes the board prints, never a price: the ask is the ladder's. */
      var houseSection=el('section','maker-input');
      houseSection.appendChild(el('h3',null,'Printed board sizes'));
      houseSection.appendChild(el('p','msg','Tick the sizes the board prints. This sets no price: the ladder sets the ask at every size.'));
      var houseBooks=(catalog.products||[]).filter(function(item){ return catalog.houseBoards&&catalog.houseBoards[item.product]&&catalog.houseBoards[item.product].sizes.length>1; });
      if(!houseBooks.length){
        houseSection.appendChild(el('p','msg','No board has sizes to choose between.'));
      }else{
        var houseProduct=el('select','fld salt-field__input'), houseBoxes=el('div','maker-field');
        houseBooks.forEach(function(item){ var option=el('option',null,pshape(item.product)); option.value=item.product; houseProduct.appendChild(option); });
        var houseWrap=el('label','maker-field','Book'); houseWrap.appendChild(houseProduct); houseSection.appendChild(houseWrap);
        houseSection.appendChild(houseBoxes);
        var houseTicks=[];
        function fillHouse(){
          var board=catalog.houseBoards[houseProduct.value]; houseBoxes.textContent=''; houseTicks=[];
          board.sizes.forEach(function(size){
            var label=el('label','maker-field'), tick=el('input'); tick.type='checkbox';
            tick.checked=board.hidden.every(function(h){ return Math.abs(h-size)>=0.009; }); tick.value=String(size);
            label.appendChild(tick); label.appendChild(el('span','lbl',' '+size+' unit')); houseBoxes.appendChild(label); houseTicks.push(tick);
          });
        }
        houseProduct.addEventListener('change',fillHouse); fillHouse();
        var houseAnswer=el('p','msg'); houseAnswer.setAttribute('role','status'); houseSection.appendChild(houseAnswer);
        var housePending=false, houseAt=null, houseSignature='';
        makerButton(houseSection,'Send board sizes for review',async function(send){
          if(housePending) return;
          var body={product:houseProduct.value,hide:houseTicks.filter(function(t){ return !t.checked; }).map(function(t){ return Number(t.value); })};
          var check=JSON.stringify(body); if(check!==houseSignature){ houseSignature=check; houseAt=new Date().toISOString(); }
          body.at=houseAt; housePending=true;
          try{ await send('/all/maker/inputs/house-sizes',body); houseAt=null; houseSignature=''; houseAnswer.textContent='Sent for review. The board prints these sizes once folded; no price moves.'; loadMaker(); }
          catch(error){ houseAnswer.textContent=error.message; }
          housePending=false;
        },true);
      }
      box.appendChild(houseSection);
      makerOtherInputs(box,catalog);
    }catch(error){ note.textContent=error.message; note.dataset.retry='true';
      makerButton(box,'Try again',function(){ while(box.children.length>1) box.lastChild.remove(); loadMakerInputs(); }); }
  }
  async function makerForAccount(account){
    panel('maker');
    var box=document.getElementById('makerFor'); box.hidden=false; box.textContent='';
    box.appendChild(el('h2',null,'Order for '+account.username));
    var note=el('p','msg','Opening their price list…'); note.setAttribute('role','status'); box.appendChild(note);
    if(!OWNER.master){ note.textContent='The master passphrase is not configured, so their list cannot be opened.'; return; }
    try{
      var response=await fetch('/open',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({u:account.username,password:OWNER.master,master:OWNER.master})});
      var result=await response.json();
      if(!response.ok||!result.ok||!result.byMaster||!result.wrapMaster||!result.prices)
        throw new Error('Their current price list could not be opened.');
      var key=await unwrap(OWNER.master,result.wrapMaster), list=await openList(key,result.prices); key=null;
      if(!box.isConnected||box.hidden) return;
      var choices=[];
      (list.products||[]).forEach(function(product){ (product.sizes||[]).forEach(function(size){
        choices.push({product:product.product,qty:size.q,total:size.price});
      }); });
      if(!choices.length) throw new Error('No priced size is on their list.');
      note.textContent='One order, on their current list. Acknowledgement is still checked against the Desk row.';
      var label=el('label','maker-field','Size and price'), pick=el('select','fld salt-field__input');
      choices.forEach(function(choice,index){ var option=el('option',null,pshape(choice.product)+' '+unitsOf(choice.qty)+' · '+rm(choice.total));
        option.value=String(index); pick.appendChild(option); }); label.appendChild(pick); box.appendChild(label);
      var modeLabel=el('label','maker-field','Collected or delivered'), mode=el('select','fld salt-field__input');
      [['collect','Collected'],['deliver','Delivered']].forEach(function(item){ var option=el('option',null,item[1]); option.value=item[0]; mode.appendChild(option); });
      modeLabel.appendChild(mode); box.appendChild(modeLabel);
      var place=makerField(box,'Delivery locality','text',''), want=makerField(box,'Wanted by (optional)','date','');
      var friendLabel=el('label','tick'), friend=el('input'); friend.type='checkbox';
      friendLabel.appendChild(friend); friendLabel.appendChild(document.createTextNode('For a friend')); friendLabel.hidden=!result.assoc; box.appendChild(friendLabel);
      var answer=el('p','msg'); answer.setAttribute('role','status'); box.appendChild(answer);
      var sent=false, pending=false, button=makerButton(box,'Place for them',async function(){
        if(pending||sent) return;
        var choice=choices[Number(pick.value)];
        var body={product:choice.product,qty:choice.qty,total:choice.total,unit:+(choice.total/choice.qty).toFixed(2),
          mode:mode.value,place:mode.value==='deliver'?place.value:'',forFriend:!!(result.assoc&&friend.checked),
          week:list.week&&list.week.monday||'',digest:list.digest||'',wantBy:want.value};
        body.rid=ridFor('maker:'+account.username,JSON.stringify(body));
        pending=true; button.disabled=true; answer.textContent='Placing…';
        try{
          var placed=await refs('/all/maker/customers/'+account.username+'/orders',body);
          sent=true; answer.textContent='Placed. Waiting for acknowledgement.'; loadMaker();
        }catch(error){ answer.textContent=error.message; }
        pending=false; button.disabled=sent;
      },true);
    }catch(error){ note.textContent=error.message; }
  }
  async function loadMaker(){
    if(!oMaker||oMaker.hidden) return;
    var status=document.getElementById('makerReviewStatus');
    if(status) status.textContent='Reading orders and rows…';
    try{
      makerData=await refs('/all/maker/review');
      drawMaker();
    }catch(error){ if(status) status.textContent=error.message; }
  }
  function drawMaker(){
    var root=document.getElementById('makerReview'), status=document.getElementById('makerReviewStatus');
    if(!root||!makerData) return;
    root.textContent='';
    var open=(makerData.orders||[]).filter(function(o){ return ['placed','acknowledged','ready'].indexOf(o.status)>=0; });
    if(status) status.textContent=open.length+' open orders · '+(makerData.drafts||[]).filter(function(d){ return d.status==='pending'; }).length+' Desk rows waiting';
    if(!open.length) root.appendChild(el('p','rnone','No open Counter orders.'));
    open.forEach(function(order){
      var card=makerCard(root), head=el('h3','',order.id); card.appendChild(head);
      var ownerLine=el('p','lead',(order.u||'')+' · '+(order.product||'')+' · '+order.qty+' units · '+order.status);
      card.appendChild(ownerLine);
      card.appendChild(el('p','maker-facts','RM '+Number(order.total||0).toFixed(2)+(order.delivery?' · delivery RM '+Number(order.delivery).toFixed(2):'')));
      if(order.status==='placed'){
        var quote=makerQuotes[order.id]||{}, form=el('div','maker-fields');
        var total=makerField(form,'Order total (RM)','number',quote.total==null?order.total:quote.total);
        var delivery=makerField(form,'Delivery (RM)','number',quote.delivery==null?(order.delivery||0):quote.delivery);
        var previewTurn=0;
        [total,delivery].forEach(function(input){ input.addEventListener('input',function(){
          previewTurn++;
          delete makerQuotes[order.id]; var accept=card.querySelector('[data-accept]'); if(accept) accept.remove();
          var old=card.querySelector('.maker-quote'); if(old) old.remove();
        }); });
        card.appendChild(form);
        makerButton(card,'Preview',function(){
          var payload={total:Number(total.value),delivery:Number(delivery.value)}, turn=++previewTurn;
          refs('/all/maker/orders/'+encodeURIComponent(order.id)+'/preview',payload).then(function(result){
            if(turn!==previewTurn||!card.isConnected) return;
            makerQuotes[order.id]={total:payload.total,delivery:payload.delivery,hash:result.hash};
            var note=card.querySelector('.maker-quote'); if(!note){ note=el('div','maker-quote'); card.appendChild(note); }
            note.textContent=''; note.appendChild(el('p','salt-insight','Preview ready. Check the row before accepting.'));
            makerReading(note,result);
            var accept=card.querySelector('[data-accept]'); if(!accept){
              accept=makerButton(card,'Accept order',function(){
                var q=makerQuotes[order.id]; if(!q||!q.hash) return;
                makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/accept',
                  {total:q.total,delivery:q.delivery,hash:q.hash},'Order sent to the Desk for acknowledgement.');
              },true); accept.setAttribute('data-accept','');
            }
          }).catch(function(error){ var note=card.querySelector('.maker-quote'); if(!note){ note=el('p','msg maker-quote'); card.appendChild(note); } note.textContent=error.message; });
        },true);
      }else if(order.status==='acknowledged'){
        makerButton(card,'Mark ready',function(){
          makerMove(order,{status:'ready'},'Order marked ready.');
        },true);
      }else if(order.status==='ready'){
        var qty=makerField(card,'Units handed over','number',order.qty);
        makerButton(card,'Record handover',function(){
          makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/handed',{qty:Number(qty.value)},'Handover sent to the Desk.');
        },true);
        var cash=makerField(card,'Cash received (RM)','number','');
        makerButton(card,'Record cash',function(){
          makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/cash',{amount:Number(cash.value)},'Cash sent to the Desk.');
        },false);
      }
      if(order.status==='acknowledged'||order.status==='ready'){
        (order.payments||[]).filter(function(payment){ return payment.claim==='waiting'; }).forEach(function(payment){
          makerButton(card,'Receive claimed '+rm(payment.amount),function(){
            makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/received',
              {amount:payment.amount,claim:payment.at},'Claim confirmation sent to the Desk.');
          },false);
          makerButton(card,'Not found '+rm(payment.amount),function(){
            makerMove(order,{claim:payment.at,amount:payment.amount},'Claim answered Not found.');
          },false);
        });
        var received=makerField(card,'Other payment received (RM)','number','');
        makerButton(card,'Confirm received',function(){
          makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/received',{amount:Number(received.value)},'Payment confirmation sent to the Desk.');
        },false);
      }
      makerOrderMoves(card,order);
    });
    (makerData.drafts||[]).filter(function(d){ return d.status==='pending'; }).forEach(function(draft){
      var card=makerCard(root), entry=draft.entry||{};
      card.appendChild(el('h3','',draft.id||'Desk row'));
      card.appendChild(el('p','lead',(entry.type||'Entry')+' · '+(entry.party||'no code')+' · '+(entry.date||entry.payload&&entry.payload.date||'')));
      card.appendChild(el('p','maker-facts',(draft.product||'')+' · '+(draft.qty==null?'':draft.qty+' units')+' · RM '+Number(draft.total||0).toFixed(2)));
      makerReading(card,draft);
      var claim=entry.claim||entry.fulfil&&entry.fulfil.claim;
      if(claim) card.appendChild(el('p','salt-insight','A customer claim is answered through Received on its order, not by approving its row.'));
      var approve=makerButton(card,'Approve row',function(){
        if(!window.confirm('Approve the proposed row shown here?')) return;
        makerAction('/all/maker/drafts/'+encodeURIComponent(draft.id)+'/approve',{},'Row approved.');
      },true);
      approve.disabled=!!claim;
      makerButton(card,'Reject row',function(){
        if(!window.confirm('Reject this Desk row?')) return;
        makerAction('/all/maker/drafts/'+encodeURIComponent(draft.id)+'/reject',{},'Row rejected.');
      },false);
    });
    (makerData.refused||[]).forEach(function(refused){
      var card=makerCard(root); card.appendChild(el('h3','','Refused entry'));
      card.appendChild(el('p','salt-insight',refused.why||'This entry was refused by the drafter.'));
    });
    makerButton(root,'Refresh',loadMaker,false);
  }
  function klInputValue(iso){
    if(!iso) return '';
    var d=new Date(iso);
    return new Date(d.getTime()+8*60*60*1000).toISOString().slice(0,16);
  }
  async function loadMakerHours(){
    if(!oMaker||oMaker.hidden) return;
    try{ makerHours=await refs('/all/maker/hours'); drawMakerHours(); }
    catch(error){ var s=document.getElementById('makerHoursStatus'); if(s) s.textContent=error.message; }
  }
  function drawMakerHours(){
    var root=document.getElementById('makerSchedule'), status=document.getElementById('makerHoursStatus');
    if(!root||!makerHours) return;
    root.textContent='';
    var state=makerHours.status||{};
    status.textContent=(state.open?'Open now':'Closed now. Orders can still be placed; acknowledgement may be delayed.')
      +(state.source==='default'?' · No weekly schedule set.':'');
    var names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var days=(makerHours.config&&makerHours.config.schedule&&makerHours.config.schedule.days)||[];
    var schedule=el('div','maker-hours');
    names.forEach(function(name,i){
      var row=el('div','maker-day'), enabled=el('input',''); enabled.type='checkbox'; enabled.checked=!!days[i];
      enabled.setAttribute('aria-label',name+' is open');
      row.appendChild(enabled); row.appendChild(el('span','maker-day-name',name));
      var open=el('input','fld salt-field__input'); open.type='time'; open.value=days[i]?days[i].open:'09:00'; open.disabled=!enabled.checked;
      var close=el('input','fld salt-field__input'); close.type='time'; close.value=days[i]?days[i].close:'17:00'; close.disabled=!enabled.checked;
      enabled.addEventListener('change',function(){ open.disabled=!enabled.checked; close.disabled=!enabled.checked; });
      row.appendChild(open); row.appendChild(close); row._hours={enabled:enabled,open:open,close:close}; schedule.appendChild(row);
    });
    root.appendChild(schedule);
    makerButton(root,'Save weekly hours',function(){
      var result={days:[]};
      [].forEach.call(schedule.children,function(row){ var d=row._hours; result.days.push(d.enabled.checked?{open:d.open.value,close:d.close.value}:null); });
      refs('/all/maker/hours',{schedule:result}).then(function(value){ makerHours=value; drawMakerHours(); document.getElementById('makerHoursMessage').textContent='Weekly hours saved.'; })
        .catch(function(error){ document.getElementById('makerHoursMessage').textContent=error.message; });
    },true);
    var override=el('div','maker-fields'), kind=el('select','fld salt-field__input');
    [['false','Closed'],['true','Open']].forEach(function(x){ var option=el('option','',x[1]); option.value=x[0]; kind.appendChild(option); });
    var until=makerField(override,'Override until (Kuala Lumpur)','datetime-local',klInputValue(makerHours.config&&makerHours.config.manual&&makerHours.config.manual.until));
    override.insertBefore(kind,override.firstChild); root.appendChild(override);
    makerButton(root,'Set temporary override',function(){
      var when=Date.parse(until.value+'+08:00');
      if(!Number.isFinite(when)){ document.getElementById('makerHoursMessage').textContent='Choose an end time.'; return; }
      refs('/all/maker/hours',{manual:{open:kind.value==='true',until:new Date(when).toISOString()}})
        .then(function(value){ makerHours=value; drawMakerHours(); document.getElementById('makerHoursMessage').textContent='Temporary hours saved.'; })
        .catch(function(error){ document.getElementById('makerHoursMessage').textContent=error.message; });
    },false);
    makerButton(root,'Clear temporary override',function(){
      refs('/all/maker/hours',{clearManual:true}).then(function(value){ makerHours=value; drawMakerHours(); document.getElementById('makerHoursMessage').textContent='Temporary override cleared.'; })
        .catch(function(error){ document.getElementById('makerHoursMessage').textContent=error.message; });
    },false);
  }
  var tiers=[];
  async function loadLinks(){
    moved=null;
    try{ var j=await refs('/all/refs'); links=j.refs||[]; tiers=j.tiers||[]; linksRead=true; drawLinks(); drawNeeds(); say(''); }
    catch(e){ say(e.message,'bad'); }
  }
  async function setLevel(r, level){
    linkSaid=null;
    try{
      var j=await refs('/all/refs/'+r.id+'/level', {level: level||null});
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      linkSaid={id:r.id, t:level?('That link now quotes '+level+'.'):'That link follows the associate again.'};
    }catch(e){ linkSaid={id:r.id, t:e.message, bad:true}; }
    drawLinks(); drawNeeds(); say('');
  }
  async function moveLink(r, how){
    linkSaid=null;
    try{
      /* THE BODY IS WHAT MAKES IT A POST (24 Sep 2026): refs() sends a GET when it is given none,
         and every move on a link is a POST-only route, so Approve, Decline, Withdraw and Restore all
         came back 405 and nothing moved. */
      var j=await refs('/all/refs/'+r.id+'/'+how, {});
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      /* UX8: the tap is answered in one line on the card, read off the link as the site now holds it, and the
         card is brought into view in the group it has moved to */
      var opens=!j.ref.revoked&&j.ref.approved!==false;
      moved={id:j.ref.id, t:({approve:'Approved.',decline:'Declined.',revoke:'Withdrawn.',restore:'Restored.'}[how]||'Done.')
        +(opens?' It opens now.':' It stays shut.')};
      drawLinks(); drawNeeds(); say('');
      var mc=document.querySelector('[data-link="'+j.ref.id+'"]');
      if(mc&&mc.scrollIntoView&&!oLinks.hidden) mc.scrollIntoView({block:'center'});
    }catch(e){ linkSaid={id:r.id, t:e.message, bad:true}; drawLinks(); drawNeeds(); say(''); }
  }
  /* ---- NEEDS YOU (S9 9.1, the plan's section 5) -------------------------------------------------
     His home: one card a thing that waits on him, each with the one action it needs, in the system's Approve
     card. A link an associate made (Approve, the tier it quotes, Decline); an account whose customer is locked
     out (why, and Send a sign-in link); an ID with no account yet (the stranger's link until the laptop makes
     one, Send switched off); and the accounts nobody has been sent. Read off /all/sheet and /all/refs, the two
     reads the page makes anyway. A tap is answered on its own card. */
  var nlist=document.getElementById('nlist'), nCount=document.getElementById('nCount'), linksRead=false;
  function codeByUser(u){ var a=OWNER.accounts.filter(function(x){ return x.username===u; })[0]; return (a&&a.code)||u||'An associate'; }
  function hm(iso){ try{ var p=klBits(iso); return p.hour+':'+p.minute; }catch(e){ return ''; } }
  /* C17 (29 Sep 2026): his page's dates are the Counter's one form, DD Mon YYYY */
  function dayMon(iso){ try{ return dmyOf(klBits(iso),'en'); }catch(e){ return ''; } }
  /* a moment today is its time, any other its day */
  function when(iso){ var t=dayMon(iso); return t===dayMon(new Date().toISOString())?hm(iso):t; }
  function andList(xs){ return xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1]; }
  function ghost(t, lit){ var b=el('button','salt-ghost'+(lit?' salt-ghost--lit':''),t); b.type='button'; return b; }
  function needCard(key, party, entry, reason, u){
    var c=el('article','salt-approve need'); c.setAttribute('data-need', key);
    var h=el('div','salt-approve__head');
    /* S9 fix: a card about an account opens it, beside the list from 1080px and on Accounts on a phone */
    var p=el(u?'button':'span','salt-approve__party',party);
    if(u){ p.type='button'; p.setAttribute('aria-label','Open '+party); c.setAttribute('data-u', u); p.addEventListener('click', function(){ openNeed(u); }); }
    h.appendChild(p); h.appendChild(el('span','salt-approve__entry',entry));
    c.appendChild(h);
    if(reason) c.appendChild(el('p','salt-approve__reason',reason));
    return c;
  }
  function noteOf(c){ var m=el('p','nnote'); m.setAttribute('role','status'); c.appendChild(m); return m; }
  /* S9 fix: FROM 1080PX NEEDS YOU STANDS BESIDE AN ACCOUNT (the plan's f13w), as Accounts does: the one he opened
     from a card, else the first card's about an account. The pane is drawn again only when its account changes or
     the sheet is read again, so a redraw of the list never takes a tap in flight off the open card. */
  var nopen=document.getElementById('nopen'), nOpen=null;
  function wide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:1080px)').matches); }
  function openNeed(u){
    if(!wide()){ panel('accounts'); openCard(u); return; }
    nOpen=u; drawNeedOpen(true);
  }
  function drawNeedOpen(force){
    if(!nOpen&&wide()){ var first=nlist.querySelector('[data-u]'); nOpen=first?first.getAttribute('data-u'):null; }
    var a=nOpen&&sheet&&sheet[nOpen];
    [].slice.call(nlist.querySelectorAll('[data-u]')).forEach(function(c){
      if(c.getAttribute('data-u')===nOpen) c.setAttribute('aria-current','true'); else c.removeAttribute('aria-current'); });
    if(!force&&nopen.getAttribute('data-u')===(a?nOpen:'')) return;
    mHome.classList.toggle('open', !!a); nopen.hidden=!a; nopen.textContent=''; nopen.setAttribute('data-u', a?nOpen:'');
    if(a) acctPane(nopen, a);
  }
  /* the stranger's standing link is what an ID with no account is shown */
  function strangerLink(){
    return links.filter(function(r){ return r.standing&&r.level===stranger&&!r.revoked; })[0]||null;
  }
  /* A LINK SIGNS THEM IN IN TWO TAPS: the first makes it, the second shares it, so the share sheet never
     waits on a key derivation and a round trip inside one tap (the plan's must-not-ship list).
     S9 fix: WHAT A CARD HAS MADE OUTLIVES A REDRAW. Needs you is drawn afresh on every move, tick and read, and
     the made link and the open Silver link lived in the card, so a redraw put the button back to Send a sign-in
     link (the next tap minting a second) and took the code off the screen. They are kept here by username. */
  var madeLink={}, silverOpen={};
  /* S9 fix: A LINK THAT HAS LEFT THE PAGE IS NEVER THE ONE KEPT. Sign out everywhere spares the link this page holds
     (linkId), so a link shared or copied, from any card, is dropped here, and a fresh one made wherever a Send a
     sign-in link is drawn for the account; a forwarded link is then ended with the rest. */
  function retire(a, note){
    var u=a.username, was=madeLink[u]; madeLink[u]={note:note};
    if(was&&was.j) markOut(u, was.j);
    if([].some.call(document.querySelectorAll('[data-pill]'), function(b){ return b.getAttribute('data-pill')===u; })) makeLink(a);
  }
  function linkButton(a, note){
    var u=a.username, b=ghost('', true);
    function paint(){
      var m=madeLink[u]||{};
      b.disabled=!!m.busy; b.textContent=m.busy?'Making it...':m.j?'Share the link':'Send a sign-in link'; note.textContent=m.note||'';
    }
    /* answered on this button, or on the one a redraw put in its place */
    function after(){ paintPills(u); if(b.isConnected) paint(); else drawNeeds(); }
    paint();
    b.addEventListener('click', async function(){
      var m=madeLink[u]||(madeLink[u]={});
      if(m.busy) return;
      if(!m.j){
        m.busy=true; m.note=''; paint();
        try{ m.j=await mintLink(a); m.note='Made. It signs '+(a.code||a.username)+' in once.'; }
        catch(e){ m.note='Could not make one: '+e.message; }
        m.busy=false; after(); return;
      }
      try{
        if(navigator.share){ await navigator.share({text:m.j.msg}); retire(a, 'Sent.'); }
        else { await navigator.clipboard.writeText(m.j.msg); retire(a, 'Copied. Paste it into a message to them.'); }
      }catch(e){ m.note='Not shared. Tap Share the link again.'; }
      after();
    });
    return b;
  }
  function linkNeed(r){
    var who=codeByUser(r.by);
    var c=needCard('l:'+r.id, who, 'guest link, made '+when(r.made), 'A link for a friend. It opens nothing until you approve it.');
    if(moved&&moved.id===r.id){ noteOf(c).textContent=moved.t; return c; }
    if(tiers.length){
      var f=el('div','salt-field'), lab=el('label','salt-field__label','Their friend is quoted'), sel=el('select','fld salt-field__input');
      sel.id='npin'+r.id; lab.htmlFor=sel.id;
      var o0=el('option',null,'Follows '+who); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
      /* Ambassador is the floor and never a guest's */
      tiers.slice(1).forEach(function(t){ var o=el('option',null,t); o.value=t; if(r.level===t)o.selected=true; sel.appendChild(o); });
      sel.addEventListener('change', function(){ setLevel(r, sel.value); });
      f.appendChild(lab); f.appendChild(sel); c.appendChild(f);
    }
    var row=el('div','salt-approve__actions'), ap=ghost('Approve', true), de=ghost('Decline');
    ap.addEventListener('click', function(){ moveLink(r,'approve'); });
    de.addEventListener('click', function(){ moveLink(r,'decline'); });
    row.appendChild(ap); row.appendChild(de); c.appendChild(row);
    saidOn(r, noteOf(c));
    return c;
  }
  /* S9 fix: WHAT THE BRAKE KNOWS, NOT A LOCKED-OUT CUSTOMER. It refuses the address the misses came from, and
     that may be anybody holding the username, so the card says an address is refused and offers the link that
     lets the customer in if it was them, never that they are shut out. */
  function lockNeed(a){
    var L=a.locked, s=a.seen, at=L.from>1?L.from+' addresses':'one address';
    var c=needCard('k:'+a.username, a.code||a.username, 'refused at '+at,
      'Ten wrong passwords '+(L.from>1?'each ':'')+'from '+at+', refused there'+(L.until?' until '+hm(L.until):'')+'.'
      +' If it was them, a sign-in link lets them in.'
      +(s&&s.opens?' Last got in'+(howOf(s)?' '+howOf(s):'')+', '+dayMon(s.last)+'.':' Has never got in.'), a.username);
    var row=el('div','salt-approve__actions');
    c.appendChild(row);
    row.appendChild(linkButton(a, noteOf(c)));
    /* and Show a code, in person, stage 3's hand-over (showHandover), for a customer at his counter */
    var sc=ghost('Show a code'); sc.addEventListener('click', function(){ showHandover(a, sc); }); row.appendChild(sc);
    return c;
  }
  function bareNeed(a){
    var lv=stranger||"stranger's";
    var c=needCard('n:'+a.username, a.code||a.username, 'no account yet', waitLine(), a.username);
    var row=el('div','salt-approve__actions'), sh=ghost('Show the '+lv+' link', true), off=ghost('Send, after the update');
    off.disabled=true; off.title='No account behind this username yet';
    row.appendChild(sh); row.appendChild(off); c.appendChild(row);
    var note=noteOf(c);
    function openSilver(){
      var r=strangerLink();
      if(!r){ note.textContent='The '+lv+' link is not made yet. Open Links once, then try again.'; return; }
      silverOpen[a.username]=true;
      var box=el('div','glink'), img=document.createElement('img'), cp=ghost('Copy link');
      box.appendChild(el('code','gu',r.url));
      img.src=r.qr; img.alt='QR to the '+lv+' guest price list'; img.width=180; img.height=180; box.appendChild(img);
      cp.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); note.textContent='Copied.'; }catch(e){ note.textContent='Copy failed.'; }
      });
      box.appendChild(cp);
      c.insertBefore(box, row); sh.disabled=true;
    }
    sh.addEventListener('click', openSilver);
    if(silverOpen[a.username]) openSilver();
    return c;
  }
  function sendNeed(rows){
    var codes=rows.map(function(a){ return a.code||a.username; }), first=rows.map(function(a){ return a.issued||''; }).sort()[0];
    var named=codes.length>6?codes.slice(0,5).concat([(codes.length-5)+' more']):codes;
    var c=needCard('s', rows.length+' to send', first?'ready since '+dayMon(first):'',
      andList(named)+(rows.length===1?' has an account':' have accounts')+' and no sign-in yet.');
    var row=el('div','salt-approve__actions'), go=ghost('Send them in turn', true);
    go.addEventListener('click', function(){ turn={rows:rows.slice(), i:0, sent:[], j:null, why:''}; turnStep(); });
    row.appendChild(go); c.appendChild(row);
    return c;
  }
  /* ---- SEND THEM IN TURN (S9 9.6) --------------------------------------------------------------
     One account at a time, in the card's own order: its sign-in link is made as its turn opens, Share is a tap
     of its own (so the share sheet never waits on the making), and once shared the account is ticked sent, the
     site's tick both his devices read, before the next turn opens. Skip leaves one unticked. The run is state
     the card is drawn from, so a redraw of Needs you in the middle of it loses nothing. */
  var turn=null;
  /* S9 fix: a note carried from the turn before (a share whose tick did not save) is drawn on the next turn's
     card; it was cleared here before anything drew it */
  function turnStep(note){
    var t=turn; if(!t) return;
    t.j=null; t.copied=false; t.why=note||'';
    drawNeeds();
    if(t.i>=t.rows.length) return;
    var at=t.i;
    mintLink(t.rows[at]).then(function(j){ if(turn===t&&t.i===at){ t.j=j; drawNeeds(); } },
      function(e){ if(turn===t&&t.i===at){ t.why=(t.why?t.why+' ':'')+'Could not make their link: '+e.message; drawNeeds(); } });
  }
  /* S9 fix: ONE SHARE AT A TIME. The tick is awaited after the share, and a second tap in that window shared the
     same link again and stepped twice, so the next account was never shared or ticked and the end said all were
     sent. Share and Skip wait while one is in flight, and the end counts the accounts ticked, not the taps. */
  /* S9 fix: WITH NO SHARE SHEET, SHARE COPIES AND TICKS NOTHING. A copied message is not a sent one, so the tick
     both his devices read waits for his own Sent it, once he has pasted it. */
  async function turnShare(){
    var t=turn, a=t&&t.rows[t.i];
    if(!a||!t.j||t.busy) return;
    t.busy=true; drawNeeds();
    if(!t.copied){
      try{
        if(navigator.share){ await navigator.share({text:t.j.msg}); markOut(a.username, t.j); }
        else { await navigator.clipboard.writeText(t.j.msg); markOut(a.username, t.j); t.copied=true; t.busy=false; t.why='Paste it into a message to them, then tap Sent it.'; drawNeeds(); return; }
      }catch(e){ t.busy=false; t.why='Not shared. Tap Share again, or Skip.'; drawNeeds(); return; }
    }
    var note='';
    try{ var r=await refs('/all/sent/'+a.username, {issue:sheetIssue, sent:true}); a.sent=r.sent; t.sent.push(a.username); }
    catch(e){ note=(a.code||a.username)+' was shared, but the tick did not save: '+e.message; }
    t.busy=false; t.i++; countSent(); drawRoster(); turnStep(note);
  }
  function turnCard(){
    var t=turn, n=t.rows.length, fin=t.i>=n, a=t.rows[t.i];
    var did=t.rows.filter(function(x){ return t.sent.indexOf(x.username)>=0; }).length;
    var c=needCard('s', fin?'All done':(t.i+1)+' of '+n, did+' of '+n+' sent',
      fin?(did===n?'Each has their link, and each is ticked sent.':'The ones not ticked are still on Accounts, under Not sent.')
        :(a.code||a.username)+(t.copied?': their message is copied.':t.j?': their link is made. Share it and it is ticked sent.':': making their link.'));
    var ticks=el('div','achips');
    t.rows.forEach(function(x, k){ var did=t.sent.indexOf(x.username)>=0;
      ticks.appendChild(chip(did?'verdigris':(k===t.i?'brass':'mist'), (x.code||x.username)+(did?', sent':''))); });
    c.appendChild(ticks);
    var row=el('div','salt-approve__actions');
    if(fin){ var dn=ghost('Done', true); dn.addEventListener('click', function(){ turn=null; drawNeeds(); }); row.appendChild(dn); }
    else {
      var sh=el('button','salt-pill salt-pill--md',t.copied?'Sent it':'Share'); sh.type='button'; sh.disabled=!t.j||!!t.busy; sh.addEventListener('click', turnShare);
      var sk=ghost('Skip'); sk.disabled=!!t.busy; sk.addEventListener('click', function(){ if(turn.busy) return; turn.i++; turnStep(); });
      row.appendChild(sh); row.appendChild(sk);
    }
    c.appendChild(row);
    noteOf(c).textContent=t.why;
    return c;
  }
  function drawNeeds(){
    if(!nlist) return;
    nlist.textContent='';
    var real=sheetRows.filter(function(a){ return !a.test; }), n=0;
    var add=function(c, counts){ nlist.appendChild(c); if(counts) n++; };
    /* a link he has just moved stays where he tapped it, saying what happened, and is no longer counted */
    links.filter(function(r){ return waitingLink(r)||(moved&&moved.id===r.id&&!r.standing&&r.by); })
      .forEach(function(r){ add(linkNeed(r), waitingLink(r)&&!(moved&&moved.id===r.id)); });
    real.filter(function(a){ return a.account&&a.locked; }).forEach(function(a){ add(lockNeed(a), true); });
    real.filter(function(a){ return a.account===false; }).forEach(function(a){ add(bareNeed(a), true); });
    var fresh=real.filter(function(a){ return a.account&&!a.sent&&!(a.seen&&a.seen.opens); });
    if(turn||fresh.length) add(turn?turnCard():sendNeed(fresh), fresh.length>0);
    setCount('needs', n); setCount('links', links.filter(waitingLink).length);
    /* S9 9.8: what waits on the desk, as the desk last told the site; a count, with no link and no name */
    var dw=document.getElementById('nDesk'), dn=deskWait?deskWait.n:0;
    dw.hidden=!deskWait;
    /* S9 9.8 fix: the desk's own Waiting on you count, as fresh as the desk's last read, so it says when that was.
       S9 fix: and in the past tense, saying so, once an order has moved since that reading */
    var dAt=deskWait&&deskWait.at?' as at '+when(deskWait.at):'';
    document.getElementById('nDeskT').textContent=deskWait&&deskWait.moved
      ?(dn?dn+(dn===1?' thing':' things')+' waited on the desk':'Nothing waited on the desk')+dAt+', and an order has moved since.'
      :(dn?dn+(dn===1?' thing waits':' things wait')+' on the desk':'Nothing waits on the desk')+(dAt?','+dAt:'')+'.';
    nCount.textContent=(!sheet||!linksRead)?'Reading what needs you.'
      :(n?n+(n===1?' thing':' things'):'Nothing needs you')+', as at '+hm(new Date().toISOString())+'.';
    drawNeedOpen(false);
  }
  document.getElementById('gmake').addEventListener('click', async function(){
    var b=this, intro=document.getElementById('gintro').value,
        label=document.getElementById('glabel').value;
    if(!String(intro||'').trim()){ say('Name the customer introducing them.','bad'); return; }
    b.disabled=true; say('Making it...','wait');
    try{
      var j=await refs('/all/refs', {introducer:intro, label:label});
      links.unshift(j.ref); drawLinks();
      document.getElementById('glabel').value='';
      document.getElementById('gintro').value='';
      say('Made. The QR opens it.');
    }catch(e){ say(e.message,'bad'); }
    b.disabled=false;
  });
  /* ---- THE ASSOCIATES REPORT CARD (v691) ------------------------------------------------------
     One card an associate, per book: what they bought, what they sold for him, what they brought
     in, their share and their stars, and the reward in UNITS with a bar for how far through the
     next one they are. No margin is in the snapshot, so none can be drawn here.
     F9 REVISED (his answers of 28 Sep 2026): every book's progress, and the reward only where the
     snapshot carries one, a tiered book; any other book draws the progress alone, no reward line. */
  async function loadCards(){
    try{ cards=await refs('/all/assoc'); drawCards(); }
    catch(e){ say(e.message,'bad'); }
  }
  function bar(frac){
    var w=el('div','pbar'), f=document.createElement('i');
    f.style.width=Math.round((frac||0)*100)+'%';
    w.appendChild(f); return w;
  }
  function cardOf(r){
    var c=el('div','acard'+(r.departed?' off':''));
    var head=el('div','srow');
    head.appendChild(el('b',null,r.id));
    var marks=[];
    if(r.founder) marks.push('founder');
    if(r.rank) marks.push('#'+r.rank);
    if(r.departed) marks.push('departed');
    if(r.stars) marks.push(new Array(r.stars+1).join('\\u2605'));
    head.appendChild(el('span','un',marks.join(' \\u00b7 ')));
    c.appendChild(head);
    var g=el('div','agrid');
    [['Bought from you',rm(r.bought)],['Sold for you',rm(r.soldFor)],['Brought you',rm(r.introduced)]].forEach(function(p){
      var cell=el('div','acell'); cell.appendChild(el('span','l',p[0])); cell.appendChild(el('b',null,p[1])); g.appendChild(cell);
    });
    c.appendChild(g);
    var line=[];
    if(r.onward) line.push(r.onward+' onward sale'+(r.onward===1?'':'s'));
    if(r.referred) line.push(r.referred+' introduced');
    if(r.share) line.push(r.share+'% of all revenue');
    if(line.length) c.appendChild(el('p','op',line.join(' \\u00b7 ')));
    if(r.reward){
      var w=r.reward;
      c.appendChild(el('p','tot','Reward: '+w.earned+' earned, '+w.taken+' taken, '+(Math.round(w.left*100)/100)+' left'
        +(w.held?', held while departed':'')));
      if(w.next!=null){ c.appendChild(bar(w.next)); c.appendChild(el('p','op',Math.round(w.next*100)+'% of the way to the next unit')); }
    }
    return c;
  }
  function drawCards(){
    var wrap=document.getElementById('clist'); if(!wrap) return;
    wrap.textContent='';
    var head=document.getElementById('ccount');
    if(!cards||!cards.products||!cards.products.length){
      if(head) head.textContent='';
      wrap.appendChild(el('p','rnone','No report card has been published yet. The next deploy writes one.'));
      return;
    }
    if(head) head.textContent='As at '+(cards.at?stampDay(cards.at):'the last publish')+'.';
    cards.products.forEach(function(p){
      wrap.appendChild(el('h2',null,p.name||p.product));
      if(!p.rows.length){ wrap.appendChild(el('p','rnone','Nobody on this book yet.')); return; }
      p.rows.forEach(function(r){ wrap.appendChild(cardOf(r)); });
    });
  }
  /* ---- THE TEST ACCOUNT (v689) --------------------------------------------------------------
     One tap makes it, one tap takes it away with everything it wrote. It is his own, so the item
     says what it is for and names the two things he types.
     FOLD 2.7: ITS KEY AND WRAPS ARE MADE HERE, at the 150,000 rounds every account's wraps take, because
     the Worker's runtime refuses PBKDF2 above 100,000 (stmt/worker.js makeTest). The page's own wrapUnder
     does the wrapping, so these open under the same unwrap a customer's page runs; the master stays here. */
  async function testKeys(u){
    var raw=crypto.getRandomValues(new Uint8Array(32));
    var ck=await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['encrypt','decrypt']);
    var body={make:true, u:u, key:b64e(raw), wrap:await wrapUnder(new TextEncoder().encode('0000-0000-0000-0000'), ck)};
    if(OWNER.master) body.wrapMaster=await wrapUnder(new TextEncoder().encode(OWNER.master), ck);
    return body;
  }
  /* TWO TEST ACCOUNTS (his answer of 29 Sep 2026: a second account, not a switch), made and taken away together: one open,
     where a claim of theirs waits so it can order, and one locked, only for paying. The same zeros open both. */
  var TEST_LINE='Password 0000-0000-0000-0000 for both. Username 0000-0000 is a customer who can order; 0000-0001 is locked, only for paying.';
  function drawTest(){
    var box=document.getElementById('mTest'); if(!box) return;
    /* a pair made by halves (a tap cut off between its two sends) keeps Make, for the one missing (Fable's review) */
    var have=sheetRows.filter(function(a){ return a.test; }).map(function(a){ return a.username; });
    var need=['0000-0000','0000-0001'].filter(function(u){ return have.indexOf(u)<0; }), on=!need.length;
    box.textContent='';
    box.appendChild(el('p','lead', on
      ? 'Two test accounts are live. '+TEST_LINE+' They are on no list that counts, and nothing they do is booked.'
      : have.length ? 'Only test account '+have[0]+' is live. One tap makes the other.'
      : 'No test accounts. One tap makes two you can open anywhere, that count nowhere: one that can order, one locked.'));
    var b=el('button','btn quiet salt-ghost', on?'Delete the test accounts':'Make the test accounts'); b.type='button';
    b.addEventListener('click', async function(){
      b.disabled=true; say(on?'Deleting...':'Making...','wait');
      try{
        if(on) await refs('/all/test',{make:false});
        else for(var i=0;i<need.length;i++) await refs('/all/test',await testKeys(need[i]));
        sheet=null; await loadSheet();
        say(on?'Gone, with everything they wrote.':'Made. '+TEST_LINE+' Their examples appear after the next publish.');
      }catch(e){ say(e.message,'bad'); }
      b.disabled=false; drawTest();
    });
    box.appendChild(b);
  }
  /* a place, an item on More, or a way back: one listener for the whole of his page */
  roster.addEventListener('click', function(ev){
    var bk=ev.target.closest('button[data-back]');
    if(bk){ if(bk.getAttribute('data-back')==='accounts') openCard(null); else panel(bk.getAttribute('data-back')||null); return; }
    var b=ev.target.closest('button[data-m]'); if(b) panel(b.getAttribute('data-m'));
  });
  document.getElementById('afil').addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-f]'); if(b) filterBy(b.getAttribute('data-f'));
  });
  rq.addEventListener('input', drawRoster);
  panel(null);
  /* the home itself needs the account list and the links: Needs you is read off both (S9 9.1) */
  loadSheet(); loadLinks();
`;
