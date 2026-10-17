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
 * WHAT IT DRAWS. Five places (his decision of 11 Oct 2026): Needs you, a card for each thing waiting on him with its
 * action on it; Orders, the Counter's orders by stage, the payments customers say they sent and the group orders;
 * Customers, the accounts (one list, read off /all/sheet, the publish's account list merged with the opens this
 * Worker records, a row opening the account's card), their messages, guest links and the associates' report card;
 * Record, the Desk's rows waiting for him and his own entries; and Shop, the hours, the notice, the practice
 * accounts and This device, whose Look is Night or Tide for this page. View as them opens the account the customer's own way,
 * through the form. */

import { MAKER_GEO_JS } from "./maker-geo.js";

export const OWNER_JS = `
  var makerGeo=${MAKER_GEO_JS};
  var mHome=document.getElementById('mHome'), oAccts=document.getElementById('oAccts'),
      oLinks=document.getElementById('oLinks'), aopen=document.getElementById('aopen'),
      sheet=null, sheetAt=null, sheetRows=[], sheetIssue=null, cards=null, sheetBusy=false;
  /* 11 Oct 2026: EVERY CONTROL CARRIES A STABLE data-act, "<place>.<thing>", named by what the control does and never by its words, so a
     later change of label, class or layout leaves whatever finds a control by its act where it was (docs/STATEMENTS.md). A control drawn
     once for each item of a list also carries the item's id as data-key. Where a helper makes the control, its label may be
     [words, act, key]: the words it shows and the act it is found by sit side by side. */
  function actOn(e, name, key){
    if(name) e.setAttribute('data-act', name);
    if(name&&key!=null&&key!=='') e.setAttribute('data-key', String(key));
    return e;
  }
  function labOf(x){ return Array.isArray(x)?x:[x]; }
  /* ---- THE FIVE PLACES (his decision of 11 Oct 2026) ------------------------------------------------------
     Needs you, Orders, Customers, Record and Shop. A place but Needs you has parts, a strip of the system's tabs; the markup
     (stmt/page.js) says which place and part each section shows in, in data-in, and this decides what is on screen, what each read
     brings in, and the address. The place is read on entering it, a part on entering the part, and what neither shows is never read:
     entering Shop reads no order and entering Orders reads no form. Nothing changes below the screen: every route, request body, id
     and retained send is as it was. Re-entering a place reads again, as it always did. */
  var placeNow='needs', partNow='', PARTS={}, fOpen=null;
  [].forEach.call(document.querySelectorAll('.aparts'), function(strip){
    PARTS[strip.getAttribute('data-place')]=[].map.call(strip.querySelectorAll('[data-part]'), function(b){ return b.getAttribute('data-part'); });
  });
  /* what a place reads when it is entered, and what a part reads when it is entered. The stages of Orders are one list that its
     place reads once, so moving between them is a filter and never a second read. */
  var PLACE_READ={
    needs:function(){ drawNeeds(); readNeeds(); },
    orders:function(){ loadMaker(); loadMakerClaims(); },
    record:function(){ loadMakerInputs(); }
  };
  var PART_READ={
    'orders.group':function(){ loadMakerPools(); },
    'orders.ledger':function(){ loadLedger(); },
    'customers.accounts':function(){ drawRoster(); if(!sheet&&!sheetBusy) loadSheet(); },
    'customers.messages':function(){ loadMakerThreads(false); },
    'customers.links':function(){ if(linksRead) drawLinks(); else if(!linksBusy) loadLinks(); },
    'customers.associates':function(){ if(!cards) loadCards(); else drawCards(); },
    'record.approve':function(){ loadMaker(); },
    'shop.hours':function(){ loadMakerHours(); },
    'shop.notice':function(){ loadMakerBulletin(); },
    'shop.practice':function(){ if(sheet) drawTest(); else if(!sheetBusy) loadSheet(); }
  };
  /* every element that names where it shows is shown there and hidden elsewhere: a card, a form, a section or a whole place. Record's
     forms are shown one at a time (fOpen, a form's slug): a form only while it is the one open, and the way back only while one is. The menu and
     a retained input stay with their part; below 860px the grid's open class puts them out of the form's way and from 860px they stand beside it
     (PHASE 4a, as Orders' list and card do). */
  function sweep(){
    [].forEach.call(roster.querySelectorAll('[data-in]'), function(n){
      n.hidden=!n.getAttribute('data-in').split(' ').some(function(t){ return t===placeNow||t===placeNow+'.'+partNow; });
    });
    [].forEach.call(roster.querySelectorAll('[data-form],[data-formmenu],[data-formback]'), function(n){
      var here=!n.hasAttribute('data-in')||!n.hidden;
      if(n.hasAttribute('data-form')) n.hidden=!here||n.getAttribute('data-form')!==fOpen;
      else if(n.hasAttribute('data-formmenu')) n.hidden=!here;
      else n.hidden=!here||!fOpen;
    });
    var grid=document.getElementById('makerFormGrid'); if(grid) grid.classList.toggle('open', !!fOpen);
    [].forEach.call(document.querySelectorAll('#makerMenu [data-act="record.form"]'), function(r){
      if(fOpen&&r.getAttribute('data-key')===fOpen) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
  }
  function inClaims(){ return placeNow==='orders'&&partNow==='payments'; }
  function inChat(){ return placeNow==='customers'&&partNow==='messages'; }
  function addrFor(place, part){ var p=PARTS[place]; return '#'+place+(part&&p&&part!==p[0]?'/'+part:''); }
  /* THE ADDRESSES. A place and a part have one each, #orders and #orders/ready; the old ones stay as addresses, each to where its
     section went: #maker is Orders, #more is Shop, #accounts and #links are those parts of Customers, #cards the associates' report card. */
  var ADDR={needs:['needs',''], orders:['orders',''], customers:['customers',''], record:['record',''], shop:['shop',''],
    maker:['orders',''], more:['shop',''], accounts:['customers','accounts'], links:['customers','links'], cards:['customers','associates']};
  function addrOf(h){
    var t=String(h||'').replace(/^#/,'').split('/'), k=t[0];
    if(!Object.prototype.hasOwnProperty.call(ADDR,k)) return null;
    var a=ADDR[k], part=t[1]||a[1];
    return {place:a[0], part:(PARTS[a[0]]||[]).indexOf(part)>=0?part:''};
  }
  /* o.fresh reads the place again (a tap on its item, as entering Maker always read it); o.push writes the address, so Back and
     Forward move between places */
  function showPlace(place, part, o){
    o=o||{};
    var asked=part, prevPlace=placeNow;
    if(place!=='needs'&&!PARTS[place]) place='needs';
    var parts=PARTS[place]||[];
    if(!parts.length) part=''; else if(parts.indexOf(part)<0) part=parts[0];
    var fresh=!!o.fresh||place!==placeNow, moved2=place!==placeNow||part!==partNow;
    if(placeNow==='needs'&&place!=='needs') needSaid={};
    placeNow=place; partNow=part;
    /* Orders opens on the first stage that has something waiting, found when the read lands (drawMaker); a stage he chose is his */
    ordAuto=place==='orders'&&place!==prevPlace&&!asked;
    /* the order whose card is open is closed by leaving the place or the part (Phase 1c) */
    if(moved2&&(ordOpened||placeNow==='orders')){ ordOpened=null; drawOrderPane(); }
    /* so is the form open on Record: leaving the part or the place closes it; the + orb is not shown on Record, where the parts are one tap away */
    if(moved2) fOpen=null;
    var add=document.getElementById('oAdd'); if(add) add.hidden=placeNow==='record';
    if(!inChat()) stopMakerChat();
    /* the picture is let go when Waiting on you is left; the one unlock is the page's and stays (PHASE 4b), going only with the lock */
    if(!inClaims()) makerSlipClose();
    /* so is the claim opened, and the line of the last answer: the claims are drawn again, every card shut, so a part left shows as it will be found */
    if(!inClaims()&&(makerClaimOpen||makerClaimSaid)){ makerClaimOpen=null; makerClaimSaid=''; drawMakerClaims(); }
    [].forEach.call(document.querySelectorAll('.place[data-m]'), function(b){
      if(b.getAttribute('data-m')===placeNow) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    [].forEach.call(document.querySelectorAll('.aparts button[data-part]'), function(b){
      b.setAttribute('aria-selected', b.parentNode.getAttribute('data-place')===placeNow&&b.getAttribute('data-part')===partNow?'true':'false'); });
    sweep();
    say('');
    unsentPaint();
    if(fresh&&PLACE_READ[placeNow]) PLACE_READ[placeNow]();
    if(PART_READ[placeNow+'.'+partNow]) PART_READ[placeNow+'.'+partNow]();
    if(o.push){ var to=addrFor(placeNow, partNow); if(location.hash!==to){ try{ history.pushState(null,'',to); }catch(e){} } }
    if(fresh){ try{ window.scrollTo(0,0); }catch(e){} }
    needsWatch();
  }
  /* Back, Forward and an address typed in: the place the address names, and nothing written back. Not while an account is viewed
     as them, which has the page's own bar and no places. */
  function fromAddress(){
    if(view) return;
    var a=location.hash?addrOf(location.hash):{place:'needs', part:''};
    if(!a) return;
    var part=a.part||(PARTS[a.place]||[])[0]||'';
    if(a.place===placeNow&&part===partNow) return;
    showPlace(a.place, part);
  }
  window.addEventListener('popstate', fromAddress);
  window.addEventListener('hashchange', fromAddress);
  /* ---- WHERE AN ACCOUNT STANDS ---------------------------------------------------------------
     The list is the roster, so a code with no account behind its username is still on it and
     says so. Everything else comes from /all/sheet. */
  var FLAGW={owes:'They owe',goods:'You owe them',refund:'You owe a refund,',pend:'Agreed, not handed over,',clear:'Settled'};
  /* 23 SEP 2026: THE ACCOUNT IS ONE LIVE DOCUMENT (v769), so there is no issue for an account to be
     missing from. A row with no totals is a username with nothing behind it, and that is what it
     says. D15 (24 Sep 2026): the fold binds a spare account at Add ID and this run's publish opens it,
     so a row reads this only when no spare was free, and the laptop's next update makes it. The level
     is the stranger's, named by the book through the sheet, never here; S9 fix: the sheet is the one
     source, so Needs you, a row and a card say the same level the moment the sheet lands, whether or not
     the links have. */
  var stranger=null;
  function waitLine(){ return 'Their account comes with the next update. Show them the guest price list meanwhile.'; }
  function flagLine(a){
    if(!a.t||!a.flag) return waitLine();
    var t=a.t;
    if(a.flag==='owes') return FLAGW.owes+' '+rm(t.owed);
    if(a.flag==='goods') return FLAGW.goods+' '+units(Math.round(t.toGet*100)/100);
    if(a.flag==='refund') return FLAGW.refund+' '+rm(t.refund);
    if(a.flag==='pend') return FLAGW.pend+' '+rm(t.pend);
    return FLAGW.clear;
  }
  function openedLine(a){
    if(!a.seen||!a.seen.opens) return 'Not opened';
    return 'Opened '+stampDay(a.seen.last)+(a.seen.opens>1?' \\u00b7 '+a.seen.opens+' times':'');
  }
  async function loadSheet(quiet){
    sheetBusy=true;
    try{
      var j=await refs('/all/sheet');
      nGot('sheet');
      if(!changed('sheet',[j.accounts,j.desk,j.stranger,j.issue])&&quiet===true) return;
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null; stranger=j.stranger||null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      drawRoster(); drawTest(); drawNeeds(); drawNeedOpen(true);
      if(aOpen) openCard(aOpen);
      /* the count is of accounts on the book: the test account is not one (v689) */
      var real=sheetRows.filter(function(a){ return !a.test; }).length;
      document.getElementById('mFoot').textContent=real+' accounts';   /* the time is the live clock beside the name (14 Oct 2026) */
    }catch(e){ nGot('sheet', e); if(quiet!==true) sayFail(e); }
    finally{ sheetBusy=false; }
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
    var box=el('div','salt-sheet ho adm asheet'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.setAttribute('aria-labelledby','hoT'); box.tabIndex=-1;
    box.appendChild(el('div','salt-sheet__grab'));
    var head=el('div','salt-sheet__head'), title=el('h2','salt-sheet__title','Sign in on their phone'); title.id='hoT';
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.setAttribute('aria-label','Close'); actOn(x,'code.close');
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
      var inp=el('input','salt-field__input salt-field__input--code'); inp.id='hoC'; inp.readOnly=true; actOn(inp,'code.value');
      inp.setAttribute('autocomplete','off'); inp.setAttribute('spellcheck','false');
      inp.value=String(j.code||'').replace('-',' ');
      cf.appendChild(lab); cf.appendChild(inp);
      cf.appendChild(el('p','salt-code__hint','Works once, until '+p.hour+':'+p.minute+'.'));
      body.appendChild(cf);
    }catch(e){
      if(hoSheet!==me) return;
      wait.className='salt-code__error'; refusal(wait,e,'Could not make a code: ');
    }
  }
  /* ---- AN ACCOUNT (S9 9.3, the plan's f13) ----------------------------------------------------------
     What a row opens: its code and username, the chips, ONE filled Send a sign-in link with its answer under it, and
     beside it the other ways, Show a code in person, View as them, Copy password and Sign out everywhere; then how
     they got in. LOOKING MAKES NO LINK (his decision 7 of 11 Oct 2026): a card drawn, on Accounts or beside Needs you, sends
     nothing that writes. THE FIRST TAP MAKES IT and the second shares it, so the share sheet never waits on a key
     derivation and a fetch (the plan's must-not-ship list): the share is the second tap's first act. It is kept by
     username with Needs you's (madeLink), so a redraw, or the same account's card on Needs you, keeps the one made and
     never makes a second; a share that goes through ticks the account sent, and a link shared or copied from any card
     is dropped (retire), the next tap making a fresh one. A username with no account makes nothing and posts nothing,
     and every control says why it is off. The password is opened on its own tap, straight to the clipboard, never into
     the page. */
  var story={};
  /* the link moved: every Send a sign-in link drawn for that account is painted from madeLink, including one a redraw
     put in the place of the button that asked (a sheet read lands while the link is being made), and Needs you with it */
  /* his decision 7 of 11 Oct 2026: Send a sign-in link makes the link, Share the link shares it, and a link that could
     not be made says Try again, whose tap makes it again and shares nothing */
  function paintPill(b){
    var m=madeLink[b.getAttribute('data-pill')]||{}, again=!m.j&&!m.busy&&!!m.fail;
    b.disabled=b.getAttribute('data-none')==='1'||!!m.busy;
    b.textContent=m.busy?'Making the link...':m.j?'Share the link':again?'Try again':'Send a sign-in link';
    if(b.note){ b.note.textContent=m.note||''; b.note.className='anote'+(m.bad?' bad':''); withDetails(b.note,m.err); }
  }
  function paintPills(u){ [].slice.call(document.querySelectorAll('[data-pill]')).forEach(function(b){ if(b.getAttribute('data-pill')===u) paintPill(b); }); }
  function linkMoved(u){ paintPills(u); if(!mHome.hidden) drawNeeds(); }
  function makeLink(a){
    var u=a.username, m=madeLink[u]||(madeLink[u]={});
    if(m.j||m.busy||a.account===false) return;
    if(m.fail){ m.fail=false; m.bad=false; m.note=''; m.err=null; }
    m.busy=true;
    mintLink(a).then(function(j){ m.j=j; m.busy=false; linkMoved(u); },
      function(e){ m.busy=false; m.fail=m.bad=true; m.note='Could not make a link: '+e.message; m.err=e; linkMoved(u); });
  }
  function sendPill(a, note, onSent){
    var u=a.username, b=el('button','salt-pill salt-pill--md apill','Send a sign-in link'); b.type='button';
    b.setAttribute('data-pill', u); b.note=note; actOn(b,'acct.signin-link');
    if(a.account===false){ b.setAttribute('data-none','1'); b.title='No account yet'; }
    paintPill(b);
    b.addEventListener('click', function(){
      var m=madeLink[u]||{};
      if(m.busy||a.account===false) return;
      /* the first tap makes it and shares nothing; a failed make is tried again by the next */
      if(!m.j){ makeLink(a); linkMoved(u); return; }
      var msg=m.j.msg, p;
      /* the tap's first act, before anything that waits: the share sheet, or with none the clipboard */
      try{ p=navigator.share?navigator.share({text:msg}).then(function(){ return 'sent'; })
        :navigator.clipboard.writeText(msg).then(function(){ return 'copied'; }); }
      catch(e){ p=Promise.reject(e); }
      p.then(async function(how){
        if(how==='copied'){ retire(a, 'Copied. Paste it into a message to them, then tick Sent.'); linkMoved(u); return; }
        var said=madeLink[u]={note:'Sent. It signs them in once; the next tap makes a new one.'};
        markOut(u, m.j); linkMoved(u);
        try{ var r=await refs('/all/sent/'+u, {issue:sheetIssue, sent:true}); a.sent=r.sent; countSent(); drawRoster(); onSent(); }
        catch(e){ said.note='Sent, but the tick did not save: '+e.message; said.err=e; said.bad=true; }
        linkMoved(u);
      }, function(){ m.note=navigator.share?'Not shared. Tap Share the link again.':'Not copied: this browser refused the clipboard.'; m.bad=true; linkMoved(u); });
    });
    return b;
  }
  /* HOW THEY GOT IN (/all/account/<u>): each way in, newest first, with its moment and the kind of device it was used
     on, as the browser described itself then, never an address; a password refused at an address stands above them */
  /* S9 fix: a code his counter showed is scanned; a customer's own is copied across; key, before the two were told apart */
  var HOWW={link:'Sign-in link', qr:'Code', copy:'Code', key:'Code', code:'Code', password:'Password', passkey:'Passkey'};
  var HOWT={qr:'Scanned at the counter', copy:'Copied across', code:'Typed in'};
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
    box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper','How they signed in'));
    var list=el('div','salt-ledger salt-ledger--plain'), L=a.locked;
    if(L) list.appendChild(lineRow('Password', chip('alarm','Locked out'),
      'Too many wrong passwords'+(L.until?', locked out until '+hm(L.until):'')+'.'));
    var log=(s&&s.log)||[];
    log.forEach(function(x){
      var way=lineRow(HOWW[x.how]||'Signed in', x.how==='password'||x.how==='passkey'?null:chip('verdigris','Used'), fmtWhen(x.at)+onWhat(x.where)+(HOWT[x.how]?'. '+HOWT[x.how]+'.':''));
      list.appendChild(way);
    });
    if(!s) list.appendChild(lineRow('Reading how they signed in.', null, ''));
    else if(s.err) list.appendChild(lineRow('Not read', null, s.err));
    else if(!log.length) list.appendChild(a.seen&&a.seen.opens
      ?lineRow('Last opened', null, dayMon(a.seen.last)+(howOf(a.seen)?', '+howOf(a.seen):'')+'. Earlier sign-ins were not kept.')
      :lineRow('Not opened yet', null, a.sent?'Sent '+dayMon(a.sent)+'.':''));
    box.appendChild(list);
    /* S9 9.4: PHONES AND COMPUTERS, off the account's own pointers: each device named as its browser described itself when
       it signed in, when it came and when it was last used, whether it is kept signed in, and a Sign out of its own */
    var devs=(s&&s.devices)||[], dh=el('h3','salt-eyebrow salt-eyebrow--copper dhead','Phones and computers');
    if(devs.length) dh.appendChild(el('span','dcount',String(devs.length)));
    box.appendChild(dh);
    var dl=el('div','salt-ledger salt-ledger--plain');
    devs.forEach(function(d){
      var so=ghost(['Sign out','acct.device-signout',d.id]);
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
    if(j.phones) parts.push('notifications on '+n(j.phones,'phone','phones'));
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
    var u=a.username, none=a.account===false, why='No account yet';
    var c=el('section','oacct scard'); c.setAttribute('data-acct', u);
    var h=el('div','ahead srow');
    h.appendChild(whoTag(el('h2',null,a.test?testName(a):(a.code||u)),a.test?'':a.code));
    h.appendChild(el('span','un',u));
    c.appendChild(h);
    var cs=el('div','achips');
    function chips(){ cs.textContent=''; if(sheet) chipsOf(a).forEach(function(x){ cs.appendChild(x); }); }
    chips(); c.appendChild(cs);
    if(a.test) c.appendChild(el('p','atot','A practice account. Nothing it does is recorded.'));
    else if(none) c.appendChild(el('p','atot',waitLine()));
    else if(a.tot) c.appendChild(el('p','atot',a.tot));
    var box=actOn(document.createElement('input'),'acct.sent');
    var pn=el('p','anote'); pn.setAttribute('role','status');
    c.appendChild(sendPill(a, pn, function(){ box.checked=!!a.sent; chips(); }));
    c.appendChild(pn);
    var grid=el('div','agrid'), gn=el('p','anote'); gn.setAttribute('role','status');
    var hob=ghost(['Show a code, in person','acct.show-code']), open=ghost(['View as them','acct.view-as']), pwb=ghost(['Copy password','acct.password']), sob=ghost(['Sign out everywhere','acct.signout-all']), orderFor=ghost(['Order for them','acct.order-for']);
    pwb.classList.add('salt-ghost--danger'); sob.classList.add('salt-ghost--danger');
    [hob, open, orderFor, pwb, sob].forEach(function(b){ if(none){ b.disabled=true; b.title=why; } grid.appendChild(b); });
    if(!none&&!a.pwMaster){ pwb.disabled=true; pwb.title='Password not stored yet.'; }
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
    var tick=el('label','tick atick');
    box.type='checkbox'; box.checked=!!a.sent; box.disabled=none;
    box.addEventListener('change', async function(){
      var want=box.checked;
      try{
        var j=await refs('/all/sent/'+u, {issue:sheetIssue, sent:want});
        a.sent=j.sent; chips(); say(''); countSent(); drawRoster(); drawNeeds();
      }catch(e){ box.checked=!want; sayFail(e); }
    });
    /* 12 Oct 2026 (Phase 2a): the input is the 44px target, laid unseen over the box drawn beside it, so the control measures what the label did */
    tick.appendChild(box); tick.appendChild(el('span','tickbox')); tick.appendChild(el('span',null,'Sent'));
    c.appendChild(tick);
    /* 14 OCT 2026 (his decision): everything related to a customer is on their card, so their loans and their reward stand here, read from the Desk's catalogue */
    var books=el('div','abooks'); books.setAttribute('data-loans', u);
    if(!none&&!a.test&&a.code){ c.appendChild(books); drawBooks(books, a); }
    var st=el('div','astory'); st.setAttribute('data-story', u);
    if(!none){ c.appendChild(st); drawStory(st, a); loadStory(a); }
    return c;
  }
  /* the loans with this customer and their reward: the Desk's catalogue, the same read as Record's Repayment form, asked once a minute at most */
  var partyRead=null, partyAt=0;
  function readParty(){
    if(partyRead&&Date.now()-partyAt<60000) return partyRead;
    partyAt=Date.now();
    partyRead=refs('/all/maker/inputs').then(function(j){ return (j&&j.catalog)||{}; });
    partyRead.catch(function(){ partyRead=null; });
    return partyRead;
  }
  function loanLine(item){
    var cash=item.form==='cash', fmt=cash?rm:units, on=fmtWhen(item.date);
    return (item.direction==='in'?'Borrowed':'Lent')+(on?' '+on:'')+(item.value!=null?', '+fmt(item.value):'');
  }
  function drawBooks(box, a){
    box.textContent='';
    box.appendChild(el('p','salt-eyebrow salt-eyebrow--copper','Loans and reward'));
    var body=el('div','aloans'); box.appendChild(body); body.appendChild(el('p','anote','Reading.'));
    readParty().then(function(cat){
      if(!box.isConnected) return;
      body.textContent='';
      var mine=(cat.loans||[]).filter(function(item){ return item.party===a.code; });
      var reward=(cat.rewards||[]).filter(function(item){ return item.code===a.code; })[0];
      mine.forEach(function(item){
        var cash=item.form==='cash', fmt=cash?rm:units, row=el('div','aloan'); row.setAttribute('data-loan', item.rid);
        var txt=el('div','aloan__txt');
        txt.appendChild(el('p','aloan__what',loanLine(item)));
        var fig=el('div','aloan__fig');
        [['Repaid',item.repaid],['Left',item.remaining]].forEach(function(p){
          if(p[1]==null) return;
          var f=el('span','aloan__f'); f.appendChild(el('span','aloan__k',p[0])); f.appendChild(el('span','aloan__v',fmt(p[1]))); fig.appendChild(f); });
        txt.appendChild(fig); row.appendChild(txt);
        var go=ghost(['Repayment','acct.repay']); go.setAttribute('data-key',item.rid);
        go.addEventListener('click', function(){ repayFor(item.rid); });
        row.appendChild(go); body.appendChild(row);
      });
      if(reward){
        var rw=el('p','aloan__what','Reward: '+units(reward.held)+' held'+(reward.departed?' while away':reward.free<reward.held?', '+units(reward.free)+' free':'')); rw.setAttribute('data-reward',a.code); body.appendChild(rw); }
      if(!mine.length&&!reward) body.appendChild(el('p','anote','No loans and no reward held.'));
    }).catch(function(){ if(box.isConnected){ body.textContent=''; body.appendChild(el('p','anote bad','Their loans could not be read.')); } });
  }
  /* Repayment opens Record's own form for that loan: the form is the one that sends, so a repayment waits under Approve like any other. A form not built yet is
     filled when it is (repayWant, applied once Record's forms are drawn). */
  var repayWant=null;
  function applyRepay(){
    if(!repayWant) return;
    var form=document.querySelector('#makerInputs [data-form="repayment"]'); if(!form) return;
    var pick=form.querySelector('[data-act="record.repay.loan"]');
    if(pick){ pick.value=repayWant; pick.dispatchEvent(new Event('change',{bubbles:true})); }
    repayWant=null; openForm('repayment');
  }
  function repayFor(rid){ repayWant=rid; showPlace('record','entry',{fresh:true,push:true}); applyRepay(); }
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
    if(!OWNER.master){ say('This page cannot open accounts yet.','bad'); return; }
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
  document.getElementById('lock').addEventListener('click', function(){ showPlace('customers','accounts',{fresh:true,push:true}); });
  /* 24 SEP 2026 (M22): AN ACCOUNT HE OPENS IS READ ONLY, and it draws what their own page draws. It
     has no session, the owner does not order, so the orders and an associate's own links come from
     /all/orders/<u>, behind the prefix's one Access check. The page calls this when view is set. */
  async function loadView(u){
    var mine=ticket, j=null;
    /* through refs, so a lapsed Access session reads as one (S9 9.7) */
    try{ j=await refs('/all/orders/'+encodeURIComponent(u)); }
    catch(e){ if(mine===ticket) sayFail(e,'Their orders could not be read: '); }
    if(mine!==ticket) return;
    orders=(j&&j.orders)||[]; myLinks=(j&&j.refs)||[]; myMax=(j&&j.max)||0;
    claims=(j&&Array.isArray(j.claims))?j.claims:[];   /* S6 6.6: their account's claims, as their page reads them */
    if(!tCard.hidden) drawCard();
  }
  /* ---- ACCOUNTS (S9 9.2) -----------------------------------------------------------------------
     One list for what Send and Review were: the system's Inbox row an account, its code and chips for where it
     stands and how it has been reached, found by a word and narrowed by a filter. A row opens the account's
     card, beside the list from 860px and in its place on a phone with a way back; the card is Send's. */
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
  var HOW_IN={password:'by password', link:'by link', remembered:'on a remembered phone', qr:'by code', copy:'by code', key:'by code', code:'by code', passkey:'with a passkey'};
  function howOf(s){ return s.how?HOW_IN[s.how]||'':HOW_IN.password; }
  /* the two test accounts, told apart by the state each stands in (his answer of 29 Sep 2026) */
  function testName(a){ return a.state==='locked'?'Practice account, locked':'Practice account, open'; }
  function chip(tone, t){ return el('span','salt-status salt-status--'+tone, t); }
  function chipsOf(a){
    if(a.test) return [chip('mist','Practice')];
    if(a.account===false) return [chip('alarm','No account yet')];
    var out=[];
    if(a.locked) out.push(chip('alarm','Locked out'+(a.locked.until?' until '+hm(a.locked.until):'')));
    if(a.flag&&a.flag!=='clear') out.push(chip({owes:'ember', goods:'steel', refund:'brass', pend:'copper'}[a.flag]||'mist', flagLine(a)));
    out.push(a.seen&&a.seen.opens?chip('mist','Opened '+dayMon(a.seen.last)+(howOf(a.seen)?' '+howOf(a.seen):'')):chip('steel','Not opened'));
    if(a.alerts) out.push(chip('verdigris','Notifications on'));
    if(a.sent) out.push(chip('verdigris','Sent '+dayMon(a.sent)));
    return out;
  }
  /* 14 OCT 2026 (the layout rework): A ROW SHOWS ONE STATE, the most important, and the rest as one quiet line; the whole row is the tap. The order of
     importance is no account, practice, locked out, then what they owe or are owed; Opened, Sent and Notifications stay on the card's chips. */
  function stateOf(a){
    if(a.test) return chip('mist','Practice');
    if(a.account===false) return chip('alarm','No account yet');
    if(a.locked) return chip('alarm','Locked out'+(a.locked.until?' until '+hm(a.locked.until):''));
    if(a.flag&&a.flag!=='clear') return chip({owes:'ember', goods:'steel', refund:'brass', pend:'copper'}[a.flag]||'mist', flagLine(a));
    return null;
  }
  function quietOf(a){
    var bits=[a.username];
    if(a.account===false) bits.push(waitLine());
    else if(a.tot&&!a.test) bits.push(a.tot);
    if(a.account!==false&&!a.test) bits.push(a.seen&&a.seen.opens?'Opened '+dayMon(a.seen.last)+(howOf(a.seen)?' '+howOf(a.seen):''):'Not opened');
    if(a.sent) bits.push('Sent '+dayMon(a.sent));
        return bits.join(' \u00b7 ');
  }
  function rowOf(a){
    var b=el('button','salt-inbox-row arow'); b.type='button'; b.setAttribute('data-u', a.username); actOn(b,'acct.open',a.username);
    if(aOpen===a.username) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
    t.appendChild(whoTag(el('span','acode',a.test?testName(a):(a.code||a.username)),a.test?'':a.code));
    var st=sheet?stateOf(a):null; if(st){ st.className+=' astate'; t.appendChild(st); }
    main.appendChild(t);
    main.appendChild(el('span','salt-inbox-row__what',quietOf(a)));
    b.appendChild(main);
    b.addEventListener('click', function(){ openCard(a.username); });
    return b;
  }
  function drawRoster(){
    if(!OWNER) return;
    var q=(rq.value||'').toLowerCase().replace(/\\s+/g,''), f=FILTER[aFilter]||FILTER.all;
    rlist.textContent='';
    var pool=sheet?sheetRows:OWNER.accounts;
    /* a filter shows only while some account is in the state it names (the layout rework); the one in use is let go when none is */
    [].slice.call(document.querySelectorAll('#afil button[data-f]')).forEach(function(x){
      var k=x.getAttribute('data-f'); x.hidden=k!=='all'&&!pool.some(FILTER[k]); });
    if(aFilter!=='all'&&!pool.some(FILTER[aFilter])){ aFilter='all'; f=FILTER.all;
      [].slice.call(document.querySelectorAll('#afil button[data-f]')).forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-f')==='all'?'true':'false'); }); }
    var hits=pool.filter(function(a){
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
    var a=u&&((sheet&&sheet[u])||OWNER.accounts.filter(function(x){ return x.username===u; })[0]);
    aOpen=a?u:null;
    oAccts.classList.toggle('open', !!a);
    aopen.hidden=!a; aopen.textContent='';
    [].slice.call(rlist.querySelectorAll('[data-u]')).forEach(function(r){
      if(r.getAttribute('data-u')===aOpen) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
    if(!a) return;
    var back=el('button','aback','← Accounts'); back.type='button'; back.setAttribute('data-back','accounts'); actOn(back,'acct.back');
    aopen.appendChild(back);
    acctPane(aopen, a);
    /* below 860px the account takes the list's place with its way back showing, so he is taken to the top of it; from 860px the list is the page's
       scroll and the account stands beside it, sticky, so a tap on a low row leaves the page where it is and only brings the pane into view */
    try{
      if(window.getComputedStyle(back).display!=='none') window.scrollTo(0,0);
      else if(aopen.scrollIntoView) aopen.scrollIntoView({block:'nearest'});
    }catch(e){}
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
  var linkSaid=null, openLinks={};
  function saidOn(r, node){ if(linkSaid&&linkSaid.id===r.id){ node.textContent=linkSaid.t; node.className+=linkSaid.bad?' bad':''; withDetails(node,linkSaid.err); } }
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
    if(standing.length){ heads[seq.length]='One link per price level'; seq=seq.concat(standing); }
    if(assoc.length){ heads[seq.length]='Made by associates'; seq=seq.concat(assoc); }
    if(older.length){ heads[seq.length]='Older links'; seq=seq.concat(older); }
    seq.forEach(function(r,i){
      if(heads[i]) glist.appendChild(el('p','ghead salt-eyebrow salt-eyebrow--copper',heads[i]));
      var card=el('details','glink salt-glass-card salt-glass-card--radius-md'+(r.revoked?' off':'')); card.setAttribute('data-link',r.id);
      /* 14 OCT 2026 (the layout rework): A LINK IS ONE ROW, who it is for and what it has done, its state a pill only when it is one worth seeing; the address, its
         QR and the moves open from the row. A row stays open across a redraw once it has been opened, and opens at once for the answer to a move made on it. */
      card.open=!!(openLinks[r.id]||(moved&&moved.id===r.id)||(linkSaid&&linkSaid.id===r.id));
      card.addEventListener('toggle', function(){ if(card.open) openLinks[r.id]=true; else delete openLinks[r.id]; });
      var declined=r.declined===true, pending=r.approved===false&&!declined;
      /* a standing link whose level the book no longer names (Bronze, 23 Sep 2026) is kept because it
         was handed out, and it opens the board a stranger sees, never the level it still carries */
      var retired=r.standing&&want.length&&want.indexOf(r.level)<0;
      var sum=el('summary','gsum'); actOn(sum,'link.open',r.id);
      var top=el('span','gtop');
      top.appendChild(el('span','gt salt-field__label',r.standing?r.level:(declined?'Not approved':(r.level?r.level:(pending?'Waiting on you':(isAssoc(r)?'Follows '+codeByUser(r.by):(r.label||'Level '+r.tier)))))));
      if(r.revoked) top.appendChild(chip('mist','Withdrawn'));
      sum.appendChild(top);
      sum.appendChild(el('span','gs', (r.opens
        ? 'Opened '+r.opens+' time'+(r.opens===1?'':'s')+', last '+stampDay(r.last)
        : 'Never opened, made '+stampDay(r.made))));
      card.appendChild(sum);
      card.appendChild(el('h4','gwho',retired?'An old link, kept'
        :r.standing?'For strangers'
        :declined?('Made by '+(r.by?codeByUser(r.by):'an associate')+', not approved, so it stays shut')
        :(pending?('Made by '+(r.by?codeByUser(r.by):'an associate')+', shut until you approve it')
        :isAssoc(r)?('Made by '+codeByUser(r.by))
        :(r.label||'(no note)'))));
      card.appendChild(el('code','gu',r.url));
      var img=document.createElement('img');
      img.src=r.qr; img.alt='QR to the guest price list for '+(r.label||r.id); img.width=180; img.height=180;
      card.appendChild(img);
      var row=el('div','grow');
      var copy=el('button','salt-ghost','Copy link'); copy.type='button'; actOn(copy,'link.copy');
      copy.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); copy.textContent='Copied'; }
        catch(e){ copy.textContent='Copy failed'; }
        setTimeout(function(){ copy.textContent='Copy link'; }, 1500);
      });
      var rev=el('button','salt-ghost'+(r.revoked?'':' salt-ghost--danger'),r.revoked?'Restore':'Withdraw'); rev.type='button'; rev.setAttribute('data-move',''); actOn(rev,r.revoked?'link.restore':'link.withdraw');
      rev.addEventListener('click', function(){ moveLink(r, r.revoked?'restore':'revoke'); });
      row.appendChild(copy); row.appendChild(rev);
      /* v709: his word on one an associate minted, and the tier he may change on it. A tier he
         does not set leaves it following the associate, which is what "if need be" means. */
      if(!r.standing&&r.by){
        if(r.approved===false&&!r.revoked){
          /* a declined link keeps Approve, which is how a decline is taken back, and loses Decline;
             a withdrawn one has neither, Restore being the way back */
          var ap=el('button','salt-ghost','Approve'); ap.type='button'; ap.setAttribute('data-move',''); actOn(ap,'link.approve');
          ap.addEventListener('click', function(){ moveLink(r,'approve'); });
          row.appendChild(ap);
          if(!declined){
            var de=el('button','salt-ghost salt-ghost--danger','Decline'); de.type='button'; de.setAttribute('data-move',''); actOn(de,'link.decline');
            de.addEventListener('click', function(){ moveLink(r,'decline'); });
            row.appendChild(de);
          }
        }
        if(tiers.length){
          var sel=el('select','fld salt-field__input'); sel.setAttribute('aria-label','Price list their friend sees'); actOn(sel,'link.tier');
          var o0=el('option',null,'Follows '+codeByUser(r.by)); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
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
    if(want.length&&made<want.length) glist.appendChild(el('p','rnone','One level link is not made yet; it comes with the next update.'));
  }
  /* S9 9.7, HIS D13: WHEN ACCESS LAPSES, SAY SO. A request under /all after the Access session has ended is
     sent to the Access login, a redirect a fetch cannot follow, and every tap read "Failed to fetch". Asked not
     to follow it, the fetch answers an opaque redirect, and that or the Worker's own 401 is the sign-in ending:
     the page gives way to Sign in again, which loads /all and so the Access login. A fetch that throws is the
     connection, and says so. */
  var ENDED='Your sign-in has ended.';
  function ended(){
    lookShut();   /* 11 Oct 2026: the look Sheet gives way; the lapse is what he must see */
    ynShut(true);   /* 12 Oct 2026: and so does a yes or no left open, as lapsed() and lock() take it, never left standing over the lapse screen */
    makerVaultLock();   /* and every key, name, place and picture the one unlock holds (Phase 4b) */
    document.getElementById('aEnded').hidden=false; document.body.classList.add('ended');
    /* the 30-second read ends with the sign-in: every poll after a lapse would send seven requests to the login and fail each */
    if(needsTimer){ clearInterval(needsTimer); needsTimer=null; }
  }
  /* ---- A REFUSAL IS A PLAIN SENTENCE, THE SERVER'S OWN WORDS ONE TAP AWAY (Phase 3b, 12 Oct 2026) ---------------------------------
     The Counter and the Desk refuse a move in their own words (stmt/maker.js, src/maker-inputs.js, stmt/hours.js, src/orders.js). This page maps the ones a
     person can act on, the server's sentence to a plain one, the way the customer's page maps e.code; every other one is REFUSAL_GENERAL. refs() raises the plain
     sentence as the Error's message and keeps the server's words in .raw, and refusal() draws the sentence with a Details control that opens them, so a
     refusal is never nothing and never only the server's words. Owner only: none of it is in stmt/words.js and the customer's words are untouched.
     The table below sits between two markers so the suite can read it as data. */
  var REFUSAL_GENERAL='The Counter could not do that. Try again.';
  /*REFUSALS*/
  var REFUSALS={
    'Say which figure changes.':'Change at least one of the units, the price or the delivery.',
    'A size and a price are above nothing.':'Units and price must each be above zero.',
    'A reply is 1 to 200 characters.':'A reply is 1 to 200 characters.',
    'A reason goes only with Decline or Cancel, up to 140 characters.':'A reason goes only with Decline or Cancel, up to 140 characters.',
    'Collected or delivered goes only with Ready.':'Collected or delivered goes only with Ready.',
    'Atomic order storage is unavailable.':'The order book is not available just now. Try again shortly.',
    'The amendment could not be recorded.':'The change could not be recorded. Try again.',
    'Set a weekly schedule, a temporary open/closed override, or clear the override.':'Set the weekly hours, set an override, or go back to the weekly hours.',
    'Admin access required':'Only you can do this. Sign in again.',
    'The Desk claim list was unreadable.':'The payments they say they sent could not be read. Try again.',
    'The Desk claim preview was unreadable.':'The rows for this payment could not be read. Try again.',
    'That claim amount has changed.':'That payment changed. Read it again.',
    'The acceptance rows changed. Preview them again.':'The rows changed; check them again.',
    'Their rows owe all of it.':'Their rows owe all of this payment, so nothing is left over.',
    'Part of this claim exceeds what the rows owe.':'This payment is for more than their rows owe.',
    'Send only the short map link.':'Paste only the short map link.',
    'The server-held queue was unreadable.':'The queue could not be read. Try again.',
    'Not available on an example order.':'A practice order does not take this.',
    'That claim is not waiting any more.':'That claim is not waiting any more.',
    'The order book could not be read.':'The order book could not be read. Try again.',
    'That request id already names different content.':'That move was already sent with different details. Read the order again.',
    'A trade needs a real date in YYYY-MM-DD.':'Pick a real date.',
    'The Desk mirror is being seeded.':'The Desk is catching up. Try again in a minute.',
    'Choose an active product.':'Choose a book that is open.',
    'Choose an active book.':'Choose a book that is open.',
    'Trade figures must be finite, non-negative numbers.':'Figures cannot be negative.',
    'Units must be above zero.':'Units must be above zero.',
    'Carriage must be a finite, non-negative number.':'Delivery cannot be negative.',
    'Handover is delivered, collected or not stated.':'Say whether it was delivered or collected, or leave it blank.',
    'Choose a buyer on the roster. Register a new buyer under Counter Admin > Add ID first, then pick the code.':'Choose a customer from the list. A new customer is added under Record, New customer, first.',
    'Choose a supplier on the roster. Register a new supplier under Counter Admin > Add ID first, then pick the code.':'Choose a supplier from the list. A new supplier is added under Record, New customer, first.',
    'Choose an end buyer on the roster, or leave End customer as Not named. Register a new end buyer under Counter Admin > Add ID first, then pick the code.':'Choose their customer from the list, or leave it as Not named. A new customer is added under Record, New customer, first.',
    'Choose a referrer on the roster. Register a new referrer under Counter Admin > Add ID first, then pick the code.':'Choose who introduced the buyer from the list. A new one is added under Record, New customer, first.',
    'Choose an associate on the roster. Register a new associate under Counter Admin > Add ID first, then pick the code.':'Choose an associate from the list. A new one is added under Record, New customer, first.',
    'Choose R2 or R3.':'Choose They resell or They introduced the buyer.',
    'An attribution needs an associate and its stream.':'Choose the associate and how they were involved.',
    "Register the associate's resale account first.":'Their resale account is not set up yet. Make them an associate first.',
    'An R2 sale names its associate as the party.':'Book a resale under the associate.',
    'This product has no inventory cost yet. Record the lot first.':'This book has no cost yet. Record a purchase first.',
    'This book has no inventory cost yet.':'This book has no cost yet. Record a purchase first.',
    'Cover is a choice, never a typed reward figure.':'Choose reward cover; an amount cannot be typed.',
    'No reward cover is available for this sale. Read the offer again.':'No reward is available for this sale. Read the offer again.',
    'A row with this party, date, units and total is already booked. Confirm a separate order.':'The same sale is already on the book.',
    'A loan with this party, book, amount and date is already booked. Confirm a separate loan.':'The same loan is already on the book.',
    'A gift with this party, book, units and date is already booked. Confirm a separate gift.':'The same gift is already on the book.',
    'The booked twin has changed. Read the trade again.':'The book changed meanwhile. Check the sale again.',
    "The party's confirmed Add ID is no longer available. Read the catalog again.":'That customer is no longer available. Open the form again.',
    'Choose one or more extra books, at most one row per book.':'Choose each extra book once.',
    'Choose each book once.':'Choose each book once.',
    'This request timestamp already carries another entry. Read its draft instead.':'That entry was already sent. Look for it under Approve.',
    'The same order is already queued. Read its draft instead.':'The same sale is already waiting for the Desk.',
    'The same gift is already queued. Read its draft instead.':'The same gift is already waiting for the Desk.',
    'The same loan is already queued. Read its draft instead.':'The same loan is already waiting for the Desk.',
    'Choose an associate on the roster.':'Choose an associate from the list.',
    'That offset is not on offer: the reward is spent or held, the order is settled, or it already has a correction waiting.':'That offset is no longer on offer. Read the offers again.',
    'Choose a customer on the roster, not a resale account.':'Choose a customer, not a resale account.',
    'This product has no customer tiers.':'This book has no price levels.',
    'A supplier cannot hold customer drift.':'A supplier has no price drift.',
    'Choose a drift from -1 to +1, or clear it.':'Choose a drift from -1 to +1, or clear it.',
    'Choose a tier or a set of small, mid and big tiers.':'Choose a level, or a level for each order size.',
    'There is no tier proposal to accept.':'There is no suggested level to accept.',
    'Choose the sizes to hide from the board.':'Choose the sizes to leave off the printed list.',
    "A size to hide must be one of this book's board sizes.":'Choose sizes from this book printed list.',
    'Every size is unticked, so there is no board to make.':'Every size is unticked, so there is nothing to print.',
    'A snooze is a real day, or null to dismiss.':'Pick a real day, or hide it for good.',
    'A snooze ends after today and within a year.':'Pick a day after today and within a year.',
    'Choose a tip the Desk is showing.':'Choose a reminder the Desk is showing.',
    'Choose a ledger row, amendment kind and real date; identity and raw prose are not input fields.':'Choose a row, what to change and a real date.',
    'A cancelled row takes only its revival: cancelled off and its date cleared.':'A cancelled order can only be reopened.',
    'Payment, Receipt and Default are purchase-lot movements.':'Payment, Receipt and Default apply to purchases only.',
    'Choose correctable typed fields; notes and settlement prose stay on Desk.':'Choose fields that can be corrected here. Notes stay on the Desk.',
    'An order code is up to 16 letters, digits and hyphens.':'An order code is up to 16 letters, digits and hyphens.',
    'Correction dates must be real dates.':'Use real dates.',
    'Correction figures must be finite, non-negative numbers.':'Figures cannot be negative.',
    'Choose a roster code; names and places are not correction values.':'Choose a code from the list. A name or place cannot be set here.',
    'Choose a listed stream or handover.':'Choose a listed way they were involved, and a listed handover.',
    'A movement or cancellation carries no row patch.':'A move or a cancellation changes nothing else on the row. Send it on its own.',
    'This row is no longer open.':'This row is no longer open.',
    'A payment is cash only, and above zero.':'A payment is cash only, and above zero.',
    'A receipt is units only, and above zero.':'A receipt is units only, and above zero.',
    'A default moves nothing, and a lot that has received units cannot default.':'A default moves nothing, and a purchase that has arrived cannot default.',
    'A cancellation moves nothing and cannot cancel goods already handed over.':'A cancellation moves nothing, and goods already handed over cannot be cancelled.',
    'A fulfilment needs non-negative cash and units, with at least one movement.':'Enter cash, units or both, and none below zero.',
    'The open-order snapshot is unavailable. Reseed the mirror before amending.':'Open orders could not be read just now. Try again shortly.',
    'The mirror changed or could not be read. Read the row again.':'The row changed or could not be read. Open it again.',
    "The row's remaining money could not be confirmed.":'What this row can still take could not be confirmed. Try again.',
    'Choose a roster party, direction, real date and positive amount.':'Choose a customer, a direction, a real date and an amount above zero.',
    'Choose an open loan, real date and positive amount.':'Choose an open loan, a real date and an amount above zero.',
    'That loan is settled or the amount exceeds what remains owing.':'That loan is settled, or the amount is more than is still owed.',
    'Choose a valid book, roster party, date, amount and handover.':'Choose a book, a customer, a date, units and how it was handed over.',
    'The reward is already spent or reserved by another input awaiting its fold.':'Their reward is already spent or waiting under Approve.',
    'There is no whole reward unit available to redeem.':'They have no whole reward unit to use.',
    'The available reward cannot offset this order.':'Their reward cannot be used on this order.',
    'File the encrypted vault on this device before adding the ID.':'Save their name and place on this phone first. Unlock them with your password and try again.',
    'That code is already on the roster.':'A customer with that name and place is already here.',
    'Choose a parent already on the roster.':'Choose their associate from the list.',
    'The map point is outside Malaysia or has invalid locality text.':'The map point must be inside Malaysia.',
    'Only a customer, reseller or referral holds a starting tier.':'Only a customer, a reseller or an introducer starts with a price drift.',
    'Starting tiers must name active tiered books.':'Start a drift only on a book that has price drift.',
    'A starting drift is a number from -1 to +1, never a level.':'A starting drift is a number from -1 to +1.',
    'Starting tiers must use active tiered books and current level names.':'Start a drift only on a book that has price drift.',
    'Each map point must belong to a roster party and remain inside Malaysia.':'Each point must belong to a customer and sit inside Malaysia.',
    'Set hours or mark closed for each day of the week.':'Set hours, or mark closed, for each day.',
    'Each day must be closed or have opening and closing times.':'Each day is closed, or has an opening and a closing time.',
    'Use valid 24-hour times, with closing later than opening on the same day.':'Use 24-hour times, with closing after opening.',
    'Choose whether the Counter is open or closed.':'Choose open or closed.',
    'Set an end time within the next 14 days.':'Choose an end time within the next 14 days.',
    'An appointment for this ID is already queued or waiting for approval.':'That customer is already waiting for the Desk or for your approval.',
    'choose the delivery charge first':'Choose the delivery charge first.',
    'type your price for the goods first':'Type your price for the goods first.',
    'the price has to be a figure above nothing':'The price must be above zero.',
    'the row has changed since the card drew it: look at it again before you accept':'The order changed since you opened it. Open it again.',
    'the row has changed since the card drew it: look at it again before you offer':'The order changed since you opened it. Open it again.',
    'the row has changed since the card drew it: look at it again before you send it':'The order changed since you opened it. Open it again.',
    'a yes of yours on this order is already on its way to its row':'Your yes on this order is already on its way.',
    'the mirror is being seeded: try again in a minute':'The Desk is catching up. Try again in a minute.',
    'they have taken your offer already: its row is drafted at it':'They have already taken your offer. Its row is drafted at that price.',
    'this raises their price or changes their window: send it to them for their yes':'This raises their price or changes their window. Send it to them for their yes.',
    'nothing here needs their yes: Accept it':'Nothing here needs their yes. Accept it.',
    'no offer of yours is open on this order':'You have no offer open on this order.',
    'this order has already been approved for a row and cannot be changed':'This order is already approved for a row and cannot be changed.',
    'this order is already under review or agreed':'This order is already under review or agreed.',
    'an offer is open on this order':'An offer is open on this order. Withdraw it first.',
    'a time window is a day and one of the six four-hour windows':'Choose a day and one of the six four-hour windows.',
    'only a delivery takes a time window':'Only a delivery takes a time window.',
    'they chose their own day, and it stands':'They chose their own day, and it stands.',
    'that window has passed or is more than a week off: choose another':'That window has passed or is more than a week off. Choose another.',
    'the Desk revision is unavailable':'The Desk is updating. Try again in a minute.',
    'the Desk mirror is updating':'The Desk is updating. Try again in a minute.',
    'no such slip':'That slip is no longer held. Slips are kept for 30 days.',
    'no such order':'That order is no longer there. Read the orders again.',
    'order not found':'That order is no longer there. Read the orders again.',
    'no such account':'That account was not found.',
    'account not found':'That account was not found.'
  };
  /*END REFUSALS*/
  /* the server's words to a plain sentence: the table above, then the two sentences the Desk composes around a figure, then the general one */
  function plainRefusal(raw){
    var s=String(raw==null?'':raw), left;
    if(Object.prototype.hasOwnProperty.call(REFUSALS,s)) return REFUSALS[s];
    if(s.indexOf('Money is already on its way to this row.')===0) return 'Money is already on its way to this row. Decide that first.';
    left=/^This row can still take RM ([0-9][0-9,]*[.][0-9]+)/.exec(s);
    if(left) return 'This row can only take RM '+left[1]+' more.';
    return REFUSAL_GENERAL;
  }
  /* an Error for a refused move: the plain sentence is its message, the server's words .raw, and the status and the whole answer are kept for the code that reads them */
  function refused(raw,answer,status){
    var failure=new Error(plainRefusal(raw));
    failure.raw=String(raw==null||raw===''?'The Counter answered '+status+' and gave no reason.':raw); failure.detail=answer; failure.status=status;
    return failure;
  }
  /* Details under a line: the server's own words, to copy. Nothing is drawn for an error that has none (a connection that failed, a sign-in that ended). */
  function withDetails(node,error){
    var detail,summary;
    if(!node||!error||!error.raw||!node.appendChild) return node;
    detail=el('details','rdet'); summary=actOn(el('summary','salt-ghost','Details'),'refusal.details');
    detail.appendChild(summary); detail.appendChild(el('p','rraw',noBook(error.raw))); node.appendChild(detail);
    return node;
  }
  /* a refusal on a line: its words, a lead before them and a tail after, and Details when the server gave words */
  function refusal(node,error,lead,tail){
    node.textContent=(lead||'')+error.message+(tail||'');
    return withDetails(node,error);
  }
  /* the same on the page's one status line */
  function sayFail(error,lead){
    say((lead||'')+error.message,'bad');
    return withDetails(rmsg,error);
  }
  async function refs(path, body){
    var o = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}
                 : {};
    o.redirect='manual';
    var r;
    try{ r = await fetch(path, o); }catch(e){ throw new Error('Not sent. Check the connection and try again.'); }
    if(r.type==='opaqueredirect'||r.status===401){ ended(); throw new Error(ENDED); }
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok) throw refused(j.error, j, r.status);
    return j;
  }
  var makerData=null, makerQuotes={}, makerPv={}, makerFee={}, makerWin={}, makerHours=null, makerBusy=false;
  /* PHASE 1b: a part he has begun on is left alone by a poll. Opening a field or tapping a button inside the order cards or the claims marks it
     (in the capture phase, so a redraw its own tap makes clears the mark afterwards); the redraw of that part clears it. */
  var dirty={makerReview:false, makerClaims:false};
  ['makerReview','makerClaims'].forEach(function(id){
    var r=document.getElementById(id);
    if(r) ['input','change','click'].forEach(function(t){
      r.addEventListener(t, function(ev){ if(ev.target.closest&&ev.target.closest('button,input,select,textarea,label')) dirty[id]=true; }, true);
    });
  });
  /* 10 Oct 2026, version 2: today and the seven days after it, Kuala Lumpur, and a day's six windows whose start is ahead, as the
     Desk's ordWinDays and ordWinOn */
  var MW_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function mwPad(n){ return (n<10?'0':'')+n; }
  function mwDayLabel(d){ return (+d.slice(8))+' '+MW_MON[+d.slice(5,7)-1]; }
  function makerWinOn(day,now){
    return [0,4,8,12,16,20].map(function(w){ return [day+'T'+mwPad(w),mwPad(w)+':00 to '+mwPad(w+4)+':00',Date.parse(day+'T00:00:00Z')+(w-8)*3600000]; })
      .filter(function(x){ return x[2]>now; });
  }
  function makerWinDays(now){
    var out=[]; for(var i=0;i<8;i++){ var d=new Date(now+8*3600000+i*86400000).toISOString().slice(0,10); if(makerWinOn(d,now).length) out.push(d); }
    return out;
  }
  /* what needs their yes, the Worker's needsYes: goods above what they placed it at, or a window other than theirs */
  function makerNeedsYes(order,total,slot){ return (total>(+order.total||0)+0.004)||(!!slot&&!!order.slot&&slot!==order.slot); }
  /* his Accept sent for their yes, open or said yes to: the order waits on them, or on its row */
  function makerAccHeld(order){ var p=order&&order.price; return !!p&&p.from==='accept'&&(p.state==='taken'||(p.state==='offered'&&!!p.offer&&new Date().toISOString()<=String(p.offer.until))); }
  var makerClaims=[], makerClaimRequests={}, makerSlipGeneration=0, makerSlipUrls=[], makerSlipDraw=null;
  /* 12 Oct 2026 (Phase 2b, his decisions 3, 4 and 6 of 11 Oct): THE CLAIM CARD. A waiting account claim is a row of the system's Inbox row and the one
     opened is its card under it, one at a time. The card reads the claim's rows ITSELF when it is opened (the Desk's preview through the Counter, stored
     nowhere), never a row, and reads them afresh each time it is drawn; the Preview rows button is retired. Received and Not found ask on the page's
     Sheet. The slip is a thumbnail drawn only from the slip key the page already holds. */
  var makerClaimOpen=null, makerClaimSaid='';
  function makerSlipClose(){
    makerSlipGeneration++;
    makerSlipUrls.forEach(function(url){ URL.revokeObjectURL(url); }); makerSlipUrls=[];
    document.querySelectorAll('[data-maker-slip]').forEach(function(node){ node.remove(); });
  }
  /* 12 Oct 2026 (PHASE 4b, his decision 3 of 11 Oct 2026): THE ONE UNLOCK. One password, typed once on the Sheet below, opens the names, the places and the slip
     key, and every place that asked for its own password (Add ID, Amend ID, Place on the map, an unsent entry, a claim's slip) reads this instead; locked, each says
     Locked and offers the same Unlock. What it holds, in this page's memory and nowhere else: the password as a PBKDF2 base key imported NON-EXTRACTABLE (it derives
     the key of any envelope from that envelope's own salt and gives nothing back), the names and places as the vault opened them, and the slip key imported
     non-extractable for deriveBits. The password itself is read from its field, the field cleared, and the string never kept. Nothing here is sent, logged or
     written to localStorage, sessionStorage, IndexedDB or a cookie, and every read and write is the ciphertext road it was: makerVaultOpen and makerVaultSeal are
     as they were, the one change being that they take the held base key where they took the password. THE LOCK lets all of it go together: the keys, the names
     and places, every slip picture (its blob: URL revoked) and the Sheet with whatever was typed in it, on a page hidden, on ended(), on a lapse (lapseHooks, in
     the customer's view) and on an explicit Lock; the page then shows codes again. An unlock still being read when the lock comes lands on nothing. */
  var makerVault=null, makerVaultTurn=0, vaultBusy=false, vaultBack=null,
      vaultSheetEl=document.getElementById('vaultSheet'), vaultScrim=document.getElementById('vaultScrim'), vaultPass=document.getElementById('vaultPass'),
      vaultSay=document.getElementById('vaultSay'), vaultGo=document.getElementById('vaultGo');
  /* PHASE 4c (Fable's note on #146): the three forms that prepare a pair of sealed maps (Add ID, Amend ID, Place on the map) each keep the last one prepared as a draft, and a
     draft carries the places map in plain text until it is stripped. Each form lists how its draft is read and let go here, and the lock lets every one go with the keys. */
  var pairDrafts=[];
  function makerVaultBase(){
    if(!makerVault) throw new Error('Unlock names and places first.');
    return makerVault.base;
  }
  function makerVaultLock(){
    makerVaultTurn++; makerVault=null;
    pairDrafts.forEach(function(d){ d.clear(); });
    makerSlipClose(); vaultShut(true);
    makerVaultNotify(); if(makerSlipDraw) makerSlipDraw();
  }
  document.addEventListener('visibilitychange',function(){ if(document.hidden) makerVaultLock(); });
  lapseHooks.push(makerVaultLock);
  /* the vault's two envelopes, read as Add ID reads them: the names, and with a revision the pair that holds the places beside them */
  async function makerVaultRead(){
    var namesRead=await refs('/all/maker/vault'), pair=null;
    if(namesRead.revision) pair=await refs('/all/maker/vault/pair');
    var placesRead=pair?{vault:pair.places}:await refs('/all/maker/vault/addr');
    return {pair:pair, names:pair?pair.names:namesRead.vault, places:placesRead.vault};
  }
  async function makerVaultUnlock(secret){
    var turn=++makerVaultTurn, base, read, names, places, filed, slip=null;
    try{
      base=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']); secret='';
      read=await makerVaultRead();
      if(turn!==makerVaultTurn) return false;
      names=await makerVaultOpen(base,read.names); places=await makerVaultOpen(base,read.places);
      filed=await refs('/all/maker/vault/key');
      if(turn!==makerVaultTurn) return false;
      if(filed.vault){
        var jwk=await makerVaultOpen(base,filed.vault);
        slip=await crypto.subtle.importKey('jwk',{kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,d:jwk.d},{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
      }
    }catch(error){
      if(error&&error.name==='OperationError') throw new Error('That password did not open names, places and slips.');
      throw error;
    }
    if(turn!==makerVaultTurn) return false;
    makerVault={base:base, names:names, places:places, slip:slip};
    makerVaultNotify(); if(makerSlipDraw) makerSlipDraw();
    return true;
  }
  /* after a name or a place is filed, the held maps are read again so a new code is named at once; a read that fails leaves what is held */
  async function makerVaultRefresh(){
    var held=makerVault, turn=makerVaultTurn;
    if(!held) return;
    try{
      var read=await makerVaultRead(), names=await makerVaultOpen(held.base,read.names), places=await makerVaultOpen(held.base,read.places);
      if(turn!==makerVaultTurn||makerVault!==held) return;
      held.names=names; held.places=places; makerVaultNotify();
    }catch(error){ /* the names already held stand until the next unlock */ }
  }
  /* what a place that needs the vault draws: Locked and the one Unlock while it is shut, a line saying so once it is open. extra (optional) adds a line of its own. */
  function makerVaultGate(parent,extra){
    var gate=el('div','maker-lock'); gate.setAttribute('data-vault-gate',''); gate.extra=extra||null;
    parent.appendChild(gate); makerVaultDraw(gate); return gate;
  }
  function makerVaultDraw(gate){
    gate.textContent='';
    var line=el('p','msg',makerVault?'Names and places are open on this phone.':'Locked'); line.setAttribute('role','status'); gate.appendChild(line);
    if(!makerVault){
      var ask=actOn(el('button','salt-ghost','Unlock'),'vault.unlock'); ask.type='button'; ask.onclick=function(){ vaultAsk(ask); }; gate.appendChild(ask);
    }
    if(gate.extra) gate.extra(gate);
  }
  /* every gate, the Shop row and the names beside the codes follow the lock */
  function makerVaultNotify(){
    [].forEach.call(document.querySelectorAll('[data-vault-gate]'),makerVaultDraw);
    var state=document.getElementById('vaultState'), on=document.getElementById('vaultOn'), off=document.getElementById('vaultOff');
    if(state) state.textContent=makerVault?'Open on this phone':'Locked';
    if(on) on.hidden=!!makerVault;
    if(off) off.hidden=!makerVault;
    makerVaultPaint();
  }
  /* a name beside its code, wherever a code is drawn with data-who, until the lock; a code the vault has no name for shows alone. A redraw of the page is
     painted at once by the observer, so a card opened after the unlock is named too. */
  function makerVaultPaint(){
    var names=makerVault&&makerVault.names;
    [].forEach.call(document.querySelectorAll('[data-who]'),function(node){
      var code=node.getAttribute('data-who'), name=names&&Object.hasOwn(names,code)&&typeof names[code]==='string'?names[code]:'', tag=node.querySelector('.maker-name');
      if(!name){ if(tag) tag.remove(); return; }
      if(!tag){ tag=el('span','maker-name'); node.appendChild(tag); }
      if(tag.textContent!==name) tag.textContent=name;
    });
  }
  new MutationObserver(function(){ if(makerVault) makerVaultPaint(); }).observe(document.body,{childList:true,subtree:true});
  /* THE SHEET: the one field. It closes on the ghost, the close control, the scrim and Escape, sending nothing; Tab stays inside. */
  function vaultShut(quiet){
    if(!vaultSheetEl||vaultSheetEl.hidden) return;
    vaultSheetEl.hidden=true; vaultScrim.hidden=true; vaultPass.value=''; vaultSay.textContent='';
    if(!quiet){ try{ if(vaultBack&&vaultBack.isConnected&&vaultBack.focus) vaultBack.focus({preventScroll:true}); }catch(x){} }
  }
  function vaultAsk(opener){
    if(makerVault||!vaultSheetEl) return;
    vaultBack=opener||document.activeElement; vaultSay.textContent=''; vaultPass.value='';
    vaultScrim.hidden=false; vaultSheetEl.hidden=false;
    try{ vaultPass.focus({preventScroll:true}); }catch(x){}
  }
  async function vaultSubmit(){
    if(vaultBusy) return;
    var secret=vaultPass.value; vaultPass.value='';
    if(!secret){ vaultSay.textContent='Enter the password for names and places.'; return; }
    vaultBusy=true; vaultGo.disabled=true; vaultSay.textContent='Opening names, places and slips.';
    try{ if(await makerVaultUnlock(secret)) vaultShut(false); }
    catch(error){ refusal(vaultSay,error); }
    finally{ secret=''; vaultBusy=false; vaultGo.disabled=false; }
  }
  if(vaultSheetEl){
    vaultGo.addEventListener('click',vaultSubmit);
    vaultPass.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); vaultSubmit(); } });
    [document.getElementById('vaultX'),document.getElementById('vaultKeep'),vaultScrim].forEach(function(n){ n.addEventListener('click',function(){ vaultShut(false); }); });
    document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') vaultShut(false); });
    vaultSheetEl.addEventListener('keydown',function(ev){
      if(ev.key!=='Tab') return;
      var f=[].slice.call(vaultSheetEl.querySelectorAll('button,input')).filter(function(c){ return !c.disabled; }), i=f.indexOf(document.activeElement);
      if(ev.shiftKey&&i<=0){ ev.preventDefault(); f[f.length-1].focus(); }
      else if(!ev.shiftKey&&i===f.length-1){ ev.preventDefault(); f[0].focus(); }
    });
    /* Shop > This device holds the control that is always in reach: Unlock while shut, Lock while open */
    document.getElementById('vaultOn').addEventListener('click',function(){ vaultAsk(this); });
    document.getElementById('vaultOff').addEventListener('click',function(){ makerVaultLock(); });
  }
  function makerClaimButton(parent,label,action,primary){
    var L=labOf(label), button=actOn(el('button',primary?'btn salt-pill salt-pill--md':'salt-ghost',L[0]),L[1],L[2]);
    button.type='button'; button.onclick=function(){ return action(button); }; parent.appendChild(button); return button;
  }
  /* PHASE 1b: Needs you reads the claims too (placeNow is then needs and nothing is drawn here). A poll leaves a claim he has opened (its rows read, a field
     open, a slip showing) alone, and one that finds the same answer draws nothing. */
  var claimsReading=false;
  async function loadMakerClaims(quiet){
    var root=document.getElementById('makerClaims'), show=placeNow==='orders', poll=quiet===true, apply=false;
    if(!root||(!show&&!(poll&&placeNow==='needs'))) return;
    if(poll&&(claimsReading||(show&&(dirty.makerClaims||makerClaimOpen||makerSlipUrls.length)))) return;
    claimsReading=true;
    if(show&&!poll){ makerSlipClose(); root.textContent='Reading.'; }
    try{
      var result=await refs('/all/maker/claims'); makerClaims=result.claims||[]; nGot('claims');
      if(!changed('claims', makerClaims)&&poll) return;
      apply=true;
      if(!show||!root.isConnected||placeNow!=='orders') return;
      drawMakerClaims();
    }catch(error){ nGot('claims', error); apply=true; if(show&&!poll) refusal(root,error); }
    finally{ claimsReading=false; if(apply){ paintOrdCounts(); drawNeeds(); } }
  }
  /* the claims drawn from the read that stands: a row each, and the card of the one opened under its row. A redraw lets every picture go first, and
     a claim answered meanwhile closes its card. */
  function drawMakerClaims(){
    var root=document.getElementById('makerClaims'); if(!root) return;
    makerSlipClose(); makerSlipDraw=null; dirty.makerClaims=false; root.textContent='';
    var waiting=makerClaims.filter(function(c){ return c.state==='waiting'; });
    if(makerClaimOpen&&!waiting.some(function(c){ return c.u+':'+c.id===makerClaimOpen; })) makerClaimOpen=null;
    if(makerClaimSaid){ var said=el('p','salt-insight',makerClaimSaid); said.setAttribute('role','status'); root.appendChild(said); }
    if(!waiting.length) root.appendChild(el('p','rnone','No payments waiting.'));
    waiting.forEach(function(claim){
      var key=claim.u+':'+claim.id; root.appendChild(makerClaimRow(claim,key));
      if(makerClaimOpen===key) makerClaimCard(root,claim,key);
    });
  }
  /* a row reads nothing: who, that they say they sent it, the slip if one is attached, how long ago and how much */
  function makerClaimRow(claim,key){
    var b=el('button','salt-inbox-row'), main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title'), side=el('span','salt-inbox-row__side');
    b.type='button'; actOn(b,'claim.open',key); b.setAttribute('aria-expanded',makerClaimOpen===key?'true':'false');
    if(makerClaimOpen===key) b.setAttribute('aria-current','true');
    t.appendChild(whoTag(el('span',null,codeByUser(claim.u)),codeOfUser(claim.u))); t.appendChild(chip('ember','Says sent'));
    if(claim.test) t.appendChild(chip('mist','Practice'));
    main.appendChild(t); main.appendChild(el('span','salt-inbox-row__what',claim.slip?'Slip attached':'No slip'));
    if(ageOf(claim.at)) side.appendChild(el('span','salt-inbox-row__age',ageOf(claim.at)));
    side.appendChild(el('span','salt-inbox-row__action',rm(claim.amount)));
    b.appendChild(main); b.appendChild(side);
    b.addEventListener('click',function(){ makerClaimToggle(key); });
    return b;
  }
  /* a tap on a row opens its card, which reads its rows afresh, and a tap on the row open closes it; one is open at a time, and the card that closes lets its picture go */
  function makerClaimToggle(key){
    var was=makerClaimOpen===key;
    makerClaimOpen=was?null:key; makerClaimSaid='';
    drawMakerClaims();
    try{
      var rows=document.querySelectorAll('#makerClaims [data-act="claim.open"]'), row=[].filter.call(rows,function(r){ return r.getAttribute('data-key')===key; })[0];
      if(row&&row.focus) row.focus({preventScroll:true});
      var card=document.querySelector('#makerClaims [data-maker-card]'); if(!was&&card&&card.scrollIntoView) card.scrollIntoView({block:'nearest'});
    }catch(x){}
  }
  /* the claim as a sheet restates it: who, how much, and that they say they sent it */
  function makerClaimAskRow(claim){
    var L=el('div','salt-ledger salt-ledger--plain'), r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label');
    lab.appendChild(el('span',null,codeByUser(claim.u)));
    l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm(claim.amount))); r.appendChild(l);
    r.appendChild(el('span','salt-ledger__flag','Says they paid it'+(claim.test?', practice':'')));
    L.appendChild(r); return L;
  }
  /* the Sheet a claim's Received or Not found asks on, in place of the native confirm. As makerAsk's: one action sends what the confirm let through, and
     the ghost, the close control, the scrim and Escape send nothing. q: title, say (lines), extra (nodes), go, keep, plain, yes. */
  function makerClaimAsk(claim,key,opener,kind,q){
    ynOpen({title:q.title, opener:opener, again:ynFind('claim:'+key+':'+kind), go:q.go, keep:q.keep, yes:q.yes,
      body:[makerClaimAskRow(claim)].concat(q.say.map(function(s){ return el('p',null,s); })).concat(q.extra||[])});
    var go=document.getElementById('ynGo');
    actOn(go,'claim.ask-go',key); actOn(document.getElementById('ynKeep'),'claim.ask-keep',key); actOn(document.getElementById('ynX'),'claim.ask-close',key);
    go.classList.toggle('salt-ghost--danger',!q.plain);
  }
  /* a claim's rows, one line each, as the card and the Received sheet show them */
  function makerClaimRowLine(row){ return (fmtWhen(row.date)||'Undated')+': '+rm(row.rm)+' of '+rm(row.owed); }
  function makerClaimCard(root,claim,key){
    var card=makerCard(root,'claim:'+key), route='/all/maker/claims/'+claim.u+'/'+claim.id, acts=el('div','maker-foot__acts'), who=codeByUser(claim.u);
    var turn=0, preview=null, said=el('p','salt-insight'), note=el('div','maker-quote');
    card.setAttribute('data-key',key);
    var claimHead=el('h3'); claimHead.appendChild(whoTag(el('span',null,who),codeOfUser(claim.u))); claimHead.appendChild(document.createTextNode(' says they paid '+rm(claim.amount)));
    card.appendChild(claimHead);
    card.appendChild(el('p','maker-facts','Sent '+fmtWhen(claim.at)+(ageOf(claim.at)?', '+ageOf(claim.at)+' ago':'')+(claim.test?'. A practice account.':'')));
    card.appendChild(detailBox('claim.details',key,[['Reference',claim.id],['Sent',fmtWhen(claim.at)],['Slip',claim.slip?'Attached':'None'],['Practice',claim.test?'Yes':'']]));
    said.setAttribute('role','status'); card.appendChild(said); card.appendChild(note);
    if(claim.slip) makerSlipControl(card,claim.u,claim.slip,key);
    var receipt=makerClaimButton(acts,['Yes, received '+rm(claim.amount),'claim.received',key],function(){ return claimAsk(false,false); },true);
    var covered=makerClaimButton(acts,['Already recorded','claim.received-booked',key],function(){ return claimAsk(true,false); },false);
    var lost=makerClaimButton(acts,['Not found','claim.not-found',key],function(){ return claimAsk(false,true); },false);
    receipt.disabled=true; covered.disabled=true;
    receipt.setAttribute('data-yn','claim:'+key+':received'); covered.setAttribute('data-yn','claim:'+key+':received-booked'); lost.setAttribute('data-yn','claim:'+key+':notfound');
    makerCardFoot(card,acts,'claim:'+key,false,true);
    var answer=card.querySelector('.maker-foot .maker-say');
    function claimShow(result){
      preview=result; said.className='salt-insight'; said.textContent='Rows read. Check them before you answer.';
      note.textContent='';
      (result.rows||[]).forEach(function(row){
        note.appendChild(el('p','maker-row',makerClaimRowLine(row)));
        (row.flags||[]).forEach(function(flag){ note.appendChild(el('p','salt-insight',typeof flag==='string'?noBook(flag):rowValue('flag',flag))); });
      });
      note.appendChild(el('p','salt-insight',result.booked?'Already recorded: Yes only tells them.':
        result.left>0.004?rm(result.left)+' more than the rows: do not record it twice.':'These rows are settled together.'));
      receipt.disabled=result.left>0.004; covered.disabled=!(result.left>0.004);
    }
    /* the rows are read when the card is drawn, which is when it is opened, and again by Read the rows again when that failed; Received waits for them */
    function claimRead(){
      var mine=++turn; preview=null;
      said.className='salt-insight'; said.textContent='Reading the rows.'; note.textContent='';
      refs(route+'/preview',{}).then(function(result){
        if(mine!==turn||!card.isConnected) return;
        claimShow(result);
      }).catch(function(error){
        if(mine!==turn||!card.isConnected) return;
        said.className='msg'; refusal(said,error);
        makerClaimButton(note,['Read the rows again','claim.reread',key],claimRead,false);
      });
    }
    async function claimPost(pending){
      if(pending.busy) return; pending.busy=true; [receipt,covered,lost].forEach(function(b){ b.disabled=true; });
      try{
        await refs(route+'/'+pending.action,pending.body); delete makerClaimRequests[key];
        makerClaimSaid=pending.action==='notfound'?'Answered Not found. '+who+' is told.':pending.body.covered?'Already recorded. '+who+' is told.':'Recorded. '+who+' is told.';
        makerClaimOpen=null; await loadMakerClaims(); await loadMaker();
      }catch(error){ refusal(answer,error,'Not confirmed. Try the same answer again: '); lost.disabled=false; if(preview) claimShow(preview); }
      pending.busy=false;
    }
    /* the answer asks once, on the Sheet; the same answer again after a lost reply is sent at once under the request id it had, as the confirm was not asked twice */
    function claimAsk(onBook,notFound){
      if(!notFound&&!preview) return;
      var body=notFound?{amount:claim.amount}:{hash:preview.hash}; if(onBook) body.covered=true;
      var action=notFound?'notfound':'received', kind=notFound?'notfound':onBook?'received-booked':'received', intended=JSON.stringify({action:action,body:body}), pending=makerClaimRequests[key];
      if(pending&&pending.intended!==intended){ answer.textContent='Send your first answer again before choosing another.'; return; }
      if(pending){ claimPost(pending); return; }
      var lines=notFound?['The claim is answered Not found and nothing is recorded. '+who+' is told.']:onBook?
        [rm(claim.amount)+' is more than these rows owe, so it is recorded already. Nothing more is recorded, and '+who+' is told it arrived.']:
        [preview.booked?'These rows are recorded already. Nothing more is recorded, and '+who+' is told it arrived.':rm(claim.amount)+' is recorded against the rows below, and '+who+' is told it arrived.'];
      var rows=notFound?[]:(preview.rows||[]).map(function(row){ return el('p','maker-row',makerClaimRowLine(row)); });
      makerClaimAsk(claim,key,{received:receipt,'received-booked':covered,notfound:lost}[kind],kind,{
        title:notFound?'Not found '+rm(claim.amount)+' from '+who+'?':onBook?'Already recorded?':'Received '+rm(claim.amount)+' from '+who+'?',
        plain:!notFound, go:notFound?'Not found':onBook?'Yes, already recorded':'Yes, received', keep:'Not yet', say:lines, extra:rows,
        yes:function(){
          var req=makerClaimRequests[key]||(makerClaimRequests[key]={intended:intended,action:action,body:Object.assign({rid:crypto.randomUUID()},body),busy:false});
          claimPost(req);
        }});
    }
    claimRead();
  }
  /* THE SLIP of a claim: sealed until the page holds the slip key (the one unlock, above), a thumbnail once it does, and the thumbnail is the control that enlarges
     it. The picture is a blob: URL, let go on the lock, on a page hidden, and when its card closes; the ciphertext is fetched only once there is a key to open it. */
  function makerSlipControl(parent,u,id,key){
    var box=el('div','maker-slipbox'), note=el('p','msg'); parent.appendChild(box);
    note.setAttribute('role','status');
    function slipSealed(){
      box.textContent=''; box.classList.remove('open');
      note.textContent='Locked. Unlock names and places to see the slip; it is seen on this phone only.'; box.appendChild(note);
      makerClaimButton(box,['Unlock','vault.unlock',key],function(button){ vaultAsk(button); },false);
    }
    function slipNone(){
      box.textContent=''; box.classList.remove('open');
      note.textContent='No slip key is filed, so this slip cannot be opened.'; box.appendChild(note);
    }
    function slipOpening(text){
      box.textContent=''; box.classList.remove('open');
      note.textContent=text; box.appendChild(note);
      makerClaimButton(box,['Open the slip again','claim.view-slip',key],function(button){ return slipView(button); },false);
    }
    function slipPaint(url){
      box.textContent=''; box.classList.remove('open');
      var pic=el('button','maker-slip-open'), image=el('img','maker-slip');
      pic.type='button'; actOn(pic,'claim.slip',key); pic.setAttribute('data-maker-slip','');
      pic.setAttribute('aria-expanded','false'); pic.setAttribute('aria-label','Enlarge the slip');
      image.src=url; image.alt='Payment slip'; pic.appendChild(image);
      pic.addEventListener('click',function(){
        var on=box.classList.toggle('open'); pic.setAttribute('aria-expanded',on?'true':'false'); pic.setAttribute('aria-label',on?'Shrink the slip':'Enlarge the slip');
      });
      box.appendChild(pic); note.textContent='Seen on this phone only. Tap the picture to enlarge it.'; box.appendChild(note);
      makerClaimButton(box,['Lock','vault.lock',key],function(){ makerVaultLock(); },false);
    }
    async function slipView(button){
      var generation=++makerSlipGeneration; if(button) button.disabled=true;
      try{
        if(!makerVault) throw new Error('Unlock names and places first.');
        if(!makerVault.slip) throw new Error('No slip key is filed.');
        var privateKey=makerVault.slip, sealedSlip=(await refs('/all/maker/slips/'+u+'/'+id)).slip;
        if(generation!==makerSlipGeneration) return;
        if(!sealedSlip||sealedSlip.v!==1) throw new Error('This slip cannot be read.');
        var epk=await crypto.subtle.importKey('raw',makerFrom64(sealedSlip.epk),{name:'ECDH',namedCurve:'P-256'},false,[]);
        var bits=await crypto.subtle.deriveBits({name:'ECDH',public:epk},privateKey,256);
        var hk=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
        var aes=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:new TextEncoder().encode('salt-slip v1')},
          hk,{name:'AES-GCM',length:256},false,['decrypt']);
        var bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(sealedSlip.iv)},aes,makerFrom64(sealedSlip.ct));
        if(generation!==makerSlipGeneration||!parent.isConnected||!inClaims()||document.hidden) return;
        var url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
        if(generation!==makerSlipGeneration){ URL.revokeObjectURL(url); return; }
        makerSlipUrls.push(url); slipPaint(url);
      }catch(error){
        if(generation===makerSlipGeneration){ var said='Slip could not be opened: '+error.message; if(makerVault&&makerVault.slip) slipOpening(said); else { note.textContent=said; withDetails(note,error); } }
      }
      finally{ if(button) button.disabled=false; }
    }
    /* the card follows the lock: sealed while shut, its slip drawn from the key once open, a word if none is filed */
    makerSlipDraw=function(){
      if(!box.isConnected) return;
      if(!makerVault) slipSealed(); else if(!makerVault.slip) slipNone(); else { slipOpening('Opening the slip.'); slipView(null); }
    };
    makerSlipDraw();
  }
  var makerThreads=[], makerThreadUser=null, makerThreadTimer=null, makerThreadsReading=false, makerChatDrafts={};
  function stopMakerChat(){
    if(makerThreadTimer!==null) clearInterval(makerThreadTimer);
    makerThreadTimer=null;
  }
  function startMakerChat(){
    stopMakerChat();
    if(!makerThreadUser||!inChat()||document.hidden) return;
    makerThreadTimer=setInterval(function(){
      if(!makerThreadUser||!inChat()||document.hidden){ stopMakerChat(); return; }
      loadMakerThreads(true);
    },2000);
  }
  document.addEventListener('visibilitychange',function(){
    if(document.hidden) stopMakerChat();
    else if(makerThreadUser&&inChat()){ loadMakerThreads(true); startMakerChat(); }
  });
  function makerThreadAsked(thread){
    var lines=thread.msgs||[], last=lines[lines.length-1];
    return !!(last&&last.by==='customer'&&thread.quiet!==last.at);
  }
  async function loadMakerThreads(quiet){
    if(makerThreadsReading) return;
    makerThreadsReading=true;
    var status=document.getElementById('makerChatStatus'), apply=false;
    try{
      var result=await refs('/all/maker/threads');
      makerThreads=result.threads||[]; nGot('threads');
      if(!changed('threads', makerThreads)&&quiet===true) return;
      apply=true;
      var list=document.getElementById('makerChatList'); list.textContent='';
      makerThreads.forEach(function(thread){
        var button=el('button','salt-ghost');
        button.appendChild(whoTag(el('span',null,codeByUser(thread.u)),codeOfUser(thread.u)));
        button.appendChild(document.createTextNode((thread.test?' · Practice':'')+(makerThreadAsked(thread)?', waiting for your reply':'')));
        button.type='button';button.setAttribute('data-thread',thread.u);actOn(button,'chat.open',thread.u);
        button.onclick=function(){ openMakerThread(thread.u); };list.appendChild(button);
      });
      status.textContent=makerThreads.length?makerThreads.filter(function(thread){return !thread.test&&makerThreadAsked(thread);}).length+' waiting for your reply.':'No messages yet.';
      if(makerThreadUser) drawMakerThreadLines();
    }catch(error){ nGot('threads', error); apply=true; refusal(status,error); }
    finally{ makerThreadsReading=false; if(apply) drawNeeds(); }
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
    root.setAttribute('data-key',user);root.appendChild(whoTag(el('h3','',codeByUser(user)),codeOfUser(user)));
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
            throw new Error('This unsent reply cannot be sent. Discard it.');
        }
      }catch(error){draft.storageError=error.message;}
    }
    var label=el('label','maker-field');label.appendChild(el('span','lbl salt-field__label','Answer them'));
    var text=el('textarea','fld salt-field__input');text.maxLength=200;text.value=draft.text;
    text.setAttribute('data-thread-reply',user);actOn(text,'chat.reply');text.oninput=function(){draft.text=text.value;};
    label.appendChild(text);root.appendChild(label);
    var status=el('p','msg');status.setAttribute('role','status');root.appendChild(status);
    var send=el('button','btn salt-pill salt-pill--md','Send'),
      quiet=el('button','salt-ghost','No reply needed'),cancel=el('button','salt-ghost','Discard unsent reply'),
      restore=el('button','salt-ghost','Open unsent reply'),close=el('button','salt-ghost','Close');
    [send,quiet,restore,cancel,close].forEach(function(button){button.type='button';root.appendChild(button);});
    actOn(send,'chat.send');actOn(quiet,'chat.no-reply');actOn(restore,'chat.open-retained');actOn(cancel,'chat.cancel-retry');actOn(close,'chat.close');
    function makerChatState(){
      var busy=!!draft.busy;
      status.textContent=draft.note||(busy?'Sending.':'');
      var unopened=!!draft.storageError||!!(draft.saved&&!draft.pending);
      if(!draft.pending&&!unopened) text.value=draft.text;
      text.disabled=busy||!!draft.pending||unopened;send.disabled=busy||unopened||(draft.pending&&draft.pending.noReply===true);
      quiet.disabled=busy||unopened||(draft.pending&&draft.pending.message!==undefined);
      restore.hidden=!draft.saved||!!draft.pending;restore.disabled=busy||!!draft.storageError;
      cancel.hidden=!draft.pending&&!draft.saved&&!draft.storageError;cancel.disabled=busy;
      send.textContent=draft.pending&&draft.pending.message!==undefined?'Send again':'Send';
      quiet.textContent=draft.pending&&draft.pending.noReply?'Send No reply needed again':'No reply needed';
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
          if(!OWNER.master) throw new Error('Reload Salt Account, then send the reply again.');
          var envelope=await makerVaultSeal(OWNER.master,{u:user,body:draft.pending});
          var retained={v:1,u:user,rid:draft.pending.rid,at:new Date().toISOString(),envelope:envelope};
          draft.savedKey=savedPrefix+draft.pending.rid;
          localStorage.setItem(draft.savedKey,JSON.stringify(retained));draft.saved=retained;
        }
        var result=await refs('/all/maker/threads/'+user,draft.pending);
        localStorage.removeItem(draft.savedKey);draft.saved=null;
        if(draft.pending.message!==undefined){draft.text='';text.value='';}
        draft.pending=null;draft.note=noReply?'No reply needed. Noted.':'Reply sent.'+makerPushResult(result.push);
        await loadMakerThreads(true);
      }catch(error){draft.note=makerCommunicationError(error)+' Your reply is kept; send it again.';}
      finally{draft.busy=false;draft.redraw();}
    }
    send.onclick=function(){makerChatSubmit(false);};quiet.onclick=function(){makerChatSubmit(true);};
    restore.onclick=async function(){
      if(draft.busy) return;
      draft.busy=true;makerChatState();
      try{
        if(!OWNER.master) throw new Error('Reload Salt Account to open the unsent reply.');
        var opened=await makerVaultOpen(OWNER.master,draft.saved.envelope);
        if(opened.u!==user) throw new Error('That unsent reply belongs to another account. It was not sent.');
        var body=opened.body;
        if(body.rid!==draft.saved.rid||Object.keys(body).some(function(key){return ['rid','message','noReply'].indexOf(key)<0;})
          ||!(/^[A-Za-z0-9_-]{16,64}$/).test(body.rid)
          ||!(body.noReply===true&&body.message===undefined||body.noReply===undefined&&typeof body.message==='string'&&body.message.trim()&&body.message.length<=200))
          throw new Error('This unsent reply cannot be sent. Discard it.');
        draft.pending=body;draft.text=body.message||'';text.value=draft.text;
        draft.note='Your reply is open. Send again sends it as it was; Discard removes only the unsent copy on this phone.';
      }catch(error){draft.note=error.message;}
      finally{draft.busy=false;draft.redraw();}
    };
    ynTag(cancel,'chat:'+user+':retry');
    cancel.onclick=function(){
      ownerAsk(cancel,'chat:'+user+':retry',{title:'Discard this unsent reply?', say:['A reply already sent stays sent.'], go:'Discard it', keep:'Keep it'}).then(function(yes){
        if(!yes) return;
        try{localStorage.removeItem(draft.savedKey);draft.pending=null;draft.saved=null;delete draft.storageError;draft.note='Discarded.';makerChatState();}
        catch(error){status.textContent='Not discarded: '+error.message;}
      });
    };
    close.onclick=function(){makerThreadUser=null;root.hidden=true;stopMakerChat();};
    if(draft.storageError) draft.note=draft.storageError;
    else if(draft.saved&&!draft.pending) draft.note='An unsent reply is kept on this phone. Open it to send it again, or discard it.';
    makerChatState();drawMakerThreadLines();startMakerChat();
  }
  /* 16 Oct 2026: THE MINI LEDGER. Open orders, Pending orders and the latest twenty, read off the Desk's mirror of the folded book by the engine's own rules (GET
     /all/maker/ledger: txStat for the stage, txOwed, txPaid and txAdvance for what is owed, txEffDeliv for what was handed over). This page states no status
     or price and sorts nothing; it draws what it is given, a book as its mark and a customer as its code. An order the site has not yet put on the book is under Orders, not here. */
  var LEDGER_COLS=[['Order','l'],['Date','l'],['Customer','l'],['Book','l'],['Units',''],['Total',''],['Owed',''],['Handed over','l'],['Stage','l']];
  var LEDGER_TABLES=[['open','Open orders','No open orders.'],['pending','Pending orders','No pending orders.'],['recent','Latest 20 orders','No orders on the book.']];
  function ledgerCells(r){
    var owed=el('td','',rm(r.owed)); if(r.advance>0.009) owed.appendChild(el('small','','goods out, '+rm(r.advance)));
    var book=el('td','l'); book.appendChild(bookTag(r.product));
    return [el('td','l salt-table__label',r.rid), el('td','l',r.date?fmtWhen(r.date):'Undated'), el('td','l',r.customer), book, el('td','',String(+r.qty)), el('td','',rm(r.total)),
      owed, el('td','l',String(+r.moved)+' of '+String(+r.qty)), el('td','l',r.stage)];
  }
  function drawLedger(j){
    LEDGER_TABLES.forEach(function(t){
      var root=document.getElementById('led-'+t[0]), rows=j[t[0]]||[]; if(!root) return;
      root.textContent='';
      var h=document.getElementById('led-'+t[0]+'-h'); if(h) h.textContent=t[1]+' · '+rows.length;
      if(!rows.length){ root.appendChild(el('p','rnone',t[2])); return; }
      var table=el('table','salt-table'), head=el('tr'), body=el('tbody');
      LEDGER_COLS.forEach(function(c){ var th=el('th',c[1],c[0]); head.appendChild(th); th.setAttribute('scope','col'); });
      table.appendChild(el('thead')).appendChild(head); table.appendChild(body);
      rows.forEach(function(r){ var tr=el('tr'); tr.setAttribute('data-rid',r.rid); ledgerCells(r).forEach(function(c){ tr.appendChild(c); }); body.appendChild(tr); });
      root.appendChild(table);
    });
  }
  async function loadLedger(){
    var status=document.getElementById('ledgerStatus'); if(!status||placeNow!=='orders'||partNow!=='ledger') return;
    var j;
    try{ j=await refs('/all/maker/ledger'); }catch(error){ refusal(status,error); return; }
    if(!status.isConnected||placeNow!=='orders'||partNow!=='ledger') return;
    status.textContent='The folded book: '+j.orders+(j.orders===1?' order':' orders')+'. A site order not yet on the book is under Placed.';
    drawLedger(j);
  }
  /* A GROUP ORDER (the pool): open one, see who is in by units, and Close. Close closes it, tells each joiner once and sends
     each joined order for acknowledgement; one the Desk would not accept is listed under the pool with its reason, and Close
     again retries those alone. Reaching the target closes nothing: only this does. */
  async function loadMakerPools(){
    var root=document.getElementById('makerPools'); if(!root||placeNow!=='orders') return;
    var result;
    try{ result=await refs('/all/maker/pools'); }catch(error){ refusal(root,error); return; }
    if(!root.isConnected||placeNow!=='orders') return;
    root.textContent='';
    var note=el('p','msg',''); note.setAttribute('role','status');
    function field(label,type,attrs){
      var L=labOf(label), l=el('label','maker-field'); l.appendChild(el('span','lbl salt-field__label',L[0]));
      var i=actOn(el('input','fld salt-field__input'),L[1],L[2]); i.type=type; Object.keys(attrs||{}).forEach(function(k){ i.setAttribute(k,attrs[k]); });
      l.appendChild(i); root.appendChild(l); return i;
    }
    /* the book is chosen by its mark, never typed: a name typed here would be a name drawn (his word of 12 Oct 2026); the books are the ones that have a mark */
    var product=makerTilesIn(root,['Book','pool.product'],Object.keys(PLET).map(bookItem)), size=field(['Units each','pool.size'],'number',{min:'0',step:'any'}),
        target=field(['Target, units','pool.target'],'number',{min:'0',step:'any'}), closes=field(['Closes on (optional)','pool.closes-on'],'date',{});
    var open=el('button','btn salt-pill salt-pill--md','Open group order'); open.type='button'; actOn(open,'pool.open');
    open.onclick=async function(){
      open.disabled=true;
      try{
        var body={product:product.value,q:Number(size.value),target:Number(target.value)};
        if(closes.value) body.closesOn=closes.value;
        await refs('/all/maker/pools',body); await loadMakerPools();
      }catch(error){ refusal(note,error); open.disabled=false; }
    };
    root.appendChild(open); root.appendChild(note);
    (result.pools||[]).forEach(function(p){
      var card=el('article','salt-glass-card maker-card');
      card.setAttribute('data-key',p.id);
      var pline=el('p','maker-row'); pline.appendChild(bookTag(p.product));
      pline.appendChild(document.createTextNode(', '+units(p.q)+' each. '+p.unitsIn+' of '+p.target+' units in, '+(p.joins||[]).length+' joined.'
        +(p.closesOn?' Closes '+fmtWhen(p.closesOn)+'.':'')+' '));
      pline.appendChild(chip(p.state==='open'?'verdigris':'mist',p.state==='open'?'Open':'Closed')); card.appendChild(pline);
      (p.closeLeft||[]).forEach(function(x){ card.appendChild(el('p','maker-row','One order was not agreed: '+noBook(x.why)+'.')); });
      if(p.state==='open'||(p.closeLeft||[]).length){
        var close=el('button','salt-ghost',p.state==='open'?'Close':'Close again'); close.type='button'; actOn(close,'pool.close',p.id);
        ynTag(close,'pool:'+p.id);
        var closePool=async function(){
          close.disabled=true;
          try{
            var r=await refs('/all/maker/pools/'+encodeURIComponent(p.id)+'/close',{});
            await loadMakerPools();
            var again=document.getElementById('makerPools'); if(again){ var m=el('p','msg',r.accepted.length+' sent to you to agree'+(r.left.length?', '+r.left.length+' left':'')+'.'); m.setAttribute('role','status'); again.insertBefore(m,again.firstChild); }
          }catch(error){ refusal(note,error); close.disabled=false; }
        };
        close.onclick=function(){
          if(p.state!=='open'){ closePool(); return; }
          ownerAsk(close,'pool:'+p.id,{title:'Close this group order?', row:askRow('each', p.unitsIn+' of '+p.target+' units', (p.joins||[]).length+' joined', bookTile(p.product,p.q)),
            say:['Each joined order comes to you to agree, and every joiner is told once.'], go:'Close the group order', keep:'Keep it open'})
            .then(function(yes){ if(yes) closePool(); });
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
      var label=el('label','maker-field');label.appendChild(el('span','lbl salt-field__label','Notice (one line each)'));
      text=actOn(el('textarea','fld salt-field__input'),'notice.text');text.rows=4;label.appendChild(text);root.appendChild(label);
      var current=el('div','');current.id='makerBulletinCurrent';root.appendChild(current);
      var retained=el('div','');retained.hidden=true;root.appendChild(retained);
      var set=el('button','btn salt-pill salt-pill--md','Set the notice'), clear=el('button','salt-ghost','Clear the notice'),
        refresh=el('button','salt-ghost','Read it again'), busy=false, needsRead=false, intended=null;
      [set,clear,refresh].forEach(function(button){button.type='button';root.appendChild(button);});
      actOn(set,'notice.set');actOn(clear,'notice.clear');actOn(refresh,'notice.read');ynTag(set,'notice:set');ynTag(clear,'notice:clear');
      function state(){set.disabled=busy||needsRead;clear.disabled=busy||needsRead;refresh.disabled=busy;text.disabled=busy;}
      root.addEventListener('maker-notice-read',function(event){
        needsRead=false;
        if(intended){
          var normalized=function(lines){return lines.map(function(line){return line.replace(/[\\s]+/g,' ').trim();});};
          var matches=JSON.stringify(normalized(event.detail.lines||[]))===JSON.stringify(normalized(intended.lines));
          status.textContent=(matches?'The notice now up matches what you sent.':'The notice now up differs from what you sent.')
            +' Your text is kept. Reading sends no notification; whether the first one went out is not known.';
        }
        state();
      });
      async function submit(lines){
        if(busy||needsRead) return;
        var yes=await (lines.length
          ?ownerAsk(set,'notice:set',{title:'Set this notice?', say:['Every customer is notified.'], extra:[el('p','maker-row',lines.join(String.fromCharCode(10)))], go:'Set the notice', keep:'Not yet', plain:true})
          :ownerAsk(clear,'notice:clear',{title:'Clear the notice?', say:['No notification is sent.'], go:'Clear the notice', keep:'Keep it'}));
        if(!yes||busy||needsRead) return;
        intended={lines:lines.slice()};
        busy=true;state();
        try{
          var result=await refs('/all/maker/bulletin',{lines:lines,confirmed:true});
          current.textContent=(result.lines||[]).join(' · ')||'No notice.'; makerNotice=result.lines||[];
          intended=null;retained.hidden=true;
          /* 11 Oct 2026: a notice set empties its box, so a second tap has nothing to send, and the same one set again says so */
          if(lines.length&&!result.unchanged) text.value='';
          status.textContent=lines.length?(result.unchanged?'That notice is already up. Nobody was notified.':'Notice set.'+makerPushResult(result.push)):'Notice cleared. No notification sent.';
        }catch(error){
          needsRead=true;refusal(status,error,'',' Read the notice again before another change; it may already be set.');
          retained.hidden=false;retained.textContent='';
          retained.appendChild(el('h3','','Unsent notice'));
          retained.appendChild(el('p','maker-row',intended.lines.length?intended.lines.join(String.fromCharCode(10)):'Clear notice'));
        }finally{busy=false;state();}
      }
      set.onclick=function(){
        var lines=text.value.split(String.fromCharCode(10)).map(function(line){return line.trim();}).filter(Boolean);
        if(!lines.length){status.textContent='Write a notice first, or clear it.';return;}
        submit(lines);
      };
      clear.onclick=function(){submit([]);};
      refresh.onclick=async function(){
        if(busy)return;busy=true;state();
        try{await read();}catch(error){refusal(status,error);}finally{busy=false;state();}
      };
    }
    async function read(){
      var result=await refs('/all/maker/bulletin'); makerNotice=result.lines||[];
      document.getElementById('makerBulletinCurrent').textContent=(result.lines||[]).join(' · ')||'No notice.';
      status.textContent='Notice read. Customers are notified only when you set one.';
      root.dispatchEvent(new CustomEvent('maker-notice-read',{detail:result}));
    }
    try{await read();}catch(error){refusal(status,error);}
  }
  function makerPushResult(push){
    if(!push) return ' It is not known whether notifications went out.';
    if(!push.ok) return ' Notifications not confirmed: '+(push.error||'read the account before trying again.');
    if(push.failed) return ' '+push.failed+' notifications were not sent.';
    return push.sent?' Notifications sent.':' No phones to notify.';
  }
  function makerCommunicationError(error){
    return error.message.indexOf('Not sent.')===0
      ?'No reply from the Counter. It may have gone through; read the thread before sending again.':error.message;
  }
  /* 12 Oct 2026 (Phase 5): LABELLED FIGURES ARE THE SYSTEM'S METRIC ROW, the label over the figure, as the Desk draws them. #142 drew them on lines of a card's own
     for lack of the recipe. A space sits between a label and its figure, so the words read as they did ("Cost RM 56.00") to a screen reader and to a copy. */
  function metrics(pairs){
    var row=el('div','salt-metrics salt-metrics--sm');
    pairs.forEach(function(p,i){
      var cell=el('div'); if(i) row.appendChild(document.createTextNode(' '));
      cell.appendChild(el('span','salt-metrics__label',p[0])); cell.appendChild(document.createTextNode(' ')); cell.appendChild(el('span','salt-metrics__value',p[1])); row.appendChild(cell);
    });
    return row;
  }
  function readingFigures(reading){
    var figs=[];
    if(reading.cost!=null) figs.push(['Cost',rm(typeof reading.cost==='object'?reading.cost.total:reading.cost)]);
    if(reading.margin) figs.push(['Your margin',rm(reading.margin.rm)+' · '+reading.margin.pct+'%']);
    return figs;
  }
  function makerReading(parent, reading, key){
    var figs=readingFigures(reading);
    if(figs.length) parent.appendChild(metrics(figs));
    if(reading.reasoning) parent.appendChild(el('p','salt-insight',noBook(reading.reasoning)));
    (reading.flags||[]).forEach(function(flag){ parent.appendChild(el('p','salt-insight',noBook(flag))); });
    if(reading.row) parent.appendChild(detailBox('row.proposed',key,rowPairs(reading.row)));
  }
  /* the placed-order preview's own native comparison, mirroring ordPvBlock on the Desk: their card today, margin,
     floor and their usual, read off the preview the server drafted (src/orders.js previewAck), never raw row JSON */
  function makerPlacedReading(parent, result){
    var note=function(text){ return el('span',null,text); };
    var tiles=el('div','maker-fields'), card=typeof result.card==='number'?result.card:null,
        floor=result.floor&&typeof result.floor.rm==='number'?result.floor.rm:null,
        margin=result.margin&&typeof result.margin.rm==='number'?result.margin:null,
        usual=result.usual&&typeof result.usual.rate==='number'?result.usual.rate:null,
        quote=typeof result.quote==='number'?result.quote:null;
    /* every figure is the server's; the browser only words a comparison, it computes none */
    if(card==null) tiles.appendChild(kpiTile('mist','Their price','-',note(noBook(result.cardNote||'no price for this size'))));
    else tiles.appendChild(kpiTile(quote==null||quote>=card?'steel':'copper','Their price',rm(card),
      note('the quote is '+(quote==null?'not read':rm(quote))+(result.cardNote?' · '+noBook(result.cardNote):''))));
    if(margin==null) tiles.appendChild(kpiTile('mist','Your margin','-',note('no cost on this book')));
    else tiles.appendChild(kpiTile(margin.rm>0.004?'verdigris':'ember','Your margin',rm(margin.rm),note((result.cost&&typeof result.cost.total==='number'?'on '+rm(result.cost.total)+' cost · ':'')+margin.pct+'%')));
    if(floor==null) tiles.appendChild(kpiTile('mist','Floor','-',note('no floor for this size')));
    else tiles.appendChild(kpiTile(quote!=null&&quote>=floor-0.004?'verdigris':'ember','Floor',rm(floor),
      note(quote!=null&&quote>=floor-0.004?'the quote clears it':'the quote is under it')));
    if(usual==null) tiles.appendChild(kpiTile('mist','Their usual','-',note('no priced order yet')));
    else tiles.appendChild(kpiTile('steel','Their usual',rm(usual),note('a unit')));
    parent.appendChild(tiles);
    var flags=result.flags||[];
    parent.appendChild(el('p','salt-insight',flags.length?(flags.length===1?'1 thing':flags.length+' things')+' to check:':'Nothing to check.'));
    flags.forEach(function(flag){ parent.appendChild(el('p','salt-insight',noBook(flag))); });
    if(result.owedWith!=null&&result.ceiling!=null){
      var over=result.owedWith>result.ceiling+0.004, lateRun=result.late&&typeof result.late.run==='number'&&typeof result.late.need==='number'?'paid late before, '+result.late.run+' of '+result.late.need+' on time since; ':'';
      parent.appendChild(el('p','salt-insight',result.prepay
        ?'They pay first: '+lateRun+rm(result.owedWith)+(over?' owed and this takes them past ':' owed with this, within ')+rm(result.ceiling)+'.'
        :'On credit: '+rm(result.owedWith)+' owed with this, '+(over?'over ':'within ')+rm(result.ceiling)+'.'));
    }
  }
  function makerButton(parent, label, action, primary, onSuccess){
    var L=labOf(label), b=actOn(el('button',primary?'btn salt-pill salt-pill--md':'salt-ghost',L[0]),L[1],L[2]);
    var busy=false, pending=null, cancel=el('button','salt-ghost','Discard');
    cancel.type='button';cancel.hidden=true;if(L[1]) actOn(cancel,L[1]+'.cancel-retained',L[2]);
    ynTag(cancel,'retained:'+(L[1]||'input')+':'+(L[2]||''));
    cancel.onclick=function(){
      if(pending) retainedCancel(cancel,'If the Desk already took it, it stays.',function(){
        if(pending){ makerClear(pending.path);pending=null;cancel.hidden=true; }
      });
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
      if(pending.path!==path) return Promise.reject(new Error('An entry is half sent. Send it again or discard it first.'));
      if(path.indexOf('/all/maker/inputs/')===0){
        var saved=makerSaved(path);
        if(saved&&JSON.stringify(saved.body)!==JSON.stringify(pending.body)){
          var metadata=function(value){var copy=Object.assign({},value);['at','vault','addrVault','pair'].forEach(function(key){delete copy[key];});return JSON.stringify(copy);};
          if(!intent||!saved.body.pair||metadata(saved.body)!==metadata(pending.body))
            return Promise.reject(new Error('An entry is half sent. Send it again or discard it first.'));
        }
        if(intent){pending.base=intent.base;pending.desired=intent.desired;}
        makerSave(pending);
        cancel.hidden=false;
      }
      return refs(pending.path,pending.body).then(function(result){
        if(!result||result.ok!==true)throw new Error('The Desk did not confirm. Nothing is lost; tap Send again.');
        makerClear(pending.path);pending=null;cancel.hidden=true;if(onSuccess)onSuccess();return result;
      },function(error){
        /* a refusal that leaves nothing to retry (no proposal to accept) clears the retained request and its Cancel */
        /* a gift the Desk already holds queued is refused before anything is recorded: nothing to retry, so the form is free again */
        if(error.status===409&&error.detail&&error.detail.queuedTwin&&path==='/all/maker/inputs/gift'){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.status===400&&(path==='/all/maker/inputs/tier-accept-all'||path==='/all/maker/inputs/hush'||path==='/all/maker/inputs/partner')){makerClear(path);pending=null;cancel.hidden=true;}
        /* a point the Desk refuses (not an official locality) leaves nothing to retry, and its word must not stay saved */
        if(error.status===400&&(path==='/all/maker/inputs/add-id'||path==='/all/maker/inputs/amend-id'||path==='/all/maker/inputs/place')){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.status===400&&path==='/all/maker/inputs/house-sizes'){makerClear(path);pending=null;cancel.hidden=true;}
        /* plan 3: an order's payment or join the Desk refused whole (a split that changed, a share its row cannot take) left nothing queued, so nothing is kept to retry */
        if((error.status===400||error.status===409)&&(path==='/all/maker/inputs/trip-pay'||path==='/all/maker/inputs/trip-join')){makerClear(path);pending=null;cancel.hidden=true;}
        /* plan 4: an undo the Desk refused (it waits on something, or the row moved since it was read) left nothing queued, so nothing is kept to retry */
        if((error.status===400||error.status===409)&&path==='/all/maker/inputs/ledger-amend'&&pending&&pending.body&&(pending.body.undo!==undefined||error.detail&&error.detail.restate)){makerClear(path);pending=null;cancel.hidden=true;}
        /* a loan the Desk already holds queued is refused before anything is recorded: nothing to retry, so the form is free again */
        if(error.status===409&&error.detail&&error.detail.queuedTwin&&path==='/all/maker/inputs/loan'){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.detail&&(error.detail.twin||error.detail.code==='vaultConflict')){
          cancel.onclick=function(){retainedCancel(cancel,'If the Desk already took it, it stays.',function(){makerClear(path);pending=null;cancel.hidden=true;});};
          if(error.detail.twin){makerClear(path);cancel.hidden=true;}
          pending=null;
        }
        throw error;
      });
    };
    send.button=b;   /* a question the action asks on the way (a twin) gives focus back to this button */
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
          if(status)status.textContent='Sent. It waits under Approve.';
          await loadMaker();
        }else await action(send);
      }catch(error){
        var failure=message();
        if(failure)refusal(failure,error);
        else throw error;
      }
      finally{
        controls.forEach(function(control,index){control.disabled=disabled[index];});
        busy=false;b.disabled=false;
      }
    }); parent.appendChild(b);parent.appendChild(cancel);return b;
  }
      /* a locality is public when the official list carries it or this phone verified it (placeFromText) and kept the word */
      /* a filed locality is always an official place name, so a saved entry is checked against the bundled official names; no word is stored */
      /* 17 Oct 2026: and a gazetteer locality this page verified (makerLocalityPoint, makerVerifySaved), held in memory only */
      var makerVerifiedWords=new Set();
      async function makerVerifySaved(){
        try{
          for(var key of Object.keys(localStorage)){
            if(key.indexOf('saltMakerPending:')!==0)continue;
            var body=(JSON.parse(localStorage.getItem(key))||{}).body||{}, word=Array.isArray(body.geo)?body.geo[2]:null;
            if(typeof word==='string'&&!makerVerifiedWords.has(word)){var found=await makerGeo.find(word);if(found.how==='list'&&found.point)makerVerifiedWords.add(word);}
          }
        }catch(e){}
      }
      function makerPublicWord(word){
        if(makerGeo.official().indexOf(word)>=0||makerVerifiedWords.has(word))return true;
        var found=false;makerGeo.picks().forEach(function(point,label){if(label.split(',')[0].trim()===word)found=true;});
        return found;
      }
      function makerSaved(path){
        var text=localStorage.getItem('saltMakerPending:'+path);
        if(!text)return null;
        var saved=JSON.parse(text);
        if(!makerGeo.pendingOk(saved,makerPublicWord))throw new Error('This saved entry cannot be sent. Discard it.');
        return saved;
      }
      function makerSave(record){
        if(!makerGeo.pendingOk(record,makerPublicWord))throw new Error('This saved entry cannot be sent. Discard it.');
        localStorage.setItem('saltMakerPending:'+record.path,JSON.stringify(record));
      }
      function makerClear(path){localStorage.removeItem('saltMakerPending:'+path);unsentPaint();}
      /* ---- THE UNSENT ENTRIES (PHASE 4c, 12 Oct 2026, the plan's retained-send words) -------------------------------------------------
         An entry that left this page and was not confirmed is kept on this phone, whole, until the Desk confirms it or he discards it (makerSave, above). He should not
         have to open Record to learn that one waits: a banner over every place says how many and opens them, and each is a Soon card on Needs you. Both only READ the
         phone's own storage and send nothing; Send again, Update and send and Discard stay Record's, on the entry's own section, exactly as they were. */
      var UNSENT_WORD={'add-id':'new customer','appoint-existing':'appointment','amend-id':'change of name or place','place':'map placement','stock-count':'stock count','sale':'sale','purchase':'purchase',
        'tier-set':'price setting','partner':'partner','tier-accept-all':'set of price levels','house-sizes':'set of printed sizes','hush':'reminder','loan':'loan','repay':'repayment','gift':'gift','redeem':'reward','ledger-amend':'correction','offset':'offset'};
      /* what one kept entry is, from its storage key: never a name or a place, which a kept entry holds only sealed; a record that will not read is still an entry */
      function unsentRead(storageKey){
        var path=storageKey.slice('saltMakerPending:'.length), body=null;
        try{ var saved=JSON.parse(localStorage.getItem(storageKey)); body=saved&&saved.body&&typeof saved.body==='object'?saved.body:null; }catch(e){}
        var code=body?String(body.party||body.code||body.from||''):'';
        return {path:path, key:path.split('/').pop(), at:body?isoAt(body.at):'', who:/^[A-Z]+[0-9]+-[A-Z0-9-]+$/.test(code)?code:''};
      }
      /* every entry kept on this phone, the oldest first */
      function unsentList(){
        var list=[];
        try{ Object.keys(localStorage).filter(function(k){ return k.indexOf('saltMakerPending:')===0; }).forEach(function(k){ list.push(unsentRead(k)); }); }catch(e){}
        return list.sort(function(a,b){ var x=a.at||'~', y=b.at||'~'; return x<y?-1:x>y?1:(a.path<b.path?-1:1); });
      }
      function unsentWord(u){ return UNSENT_WORD[u.key]||'entry'; }
      function unsentSaid(u){
        var w=unsentWord(u);
        return (/^[aeiou]/.test(w)?'An ':'A ')+w+' you sent'+(u.at?' on '+fmtWhen(u.at):'')+' was not confirmed.';
      }
      /* Open: Record, on the part the entry belongs to, where its section stands above the menu */
      function unsentOpen(u){ showPlace('record', retainedPart(u.path), {fresh:true, push:true}); }
      function unsentPaint(){
        try{
          var bar=document.getElementById('unsentBar'); if(!bar) return;
          var list=unsentList(), n=list.length;
          bar.textContent=''; bar.hidden=!n;
          if(!n) return;
          var one=n===1, c=needCard({sev:'soon', kind:'rows', word:'Unsent', key:'unsent', at:list[0].at, act:'unsent.open', who:n+' unsent '+(one?'entry':'entries'), what:'on this phone',
            why:one?unsentSaid(list[0])+' Open it to send it again, update it or discard it.':'They were sent from this phone and not confirmed. Open them to send them again, update them or discard them.',
            open:function(){ unsentOpen(list[0]); }, keepOpen:true});
          c.removeAttribute('data-need'); c.removeAttribute('data-kind');
          bar.appendChild(c);
        }catch(e){}
      }
      function makerRecovery(parent){
        var keys=Object.keys(localStorage).filter(function(key){return key.indexOf('saltMakerPending:')===0;});
        keys.forEach(function(key){
          var path=key.slice('saltMakerPending:'.length),saved;
          var section=makerForm(retainedPart(path));section.setAttribute('data-key',path.split('/').pop());section.setAttribute('data-formmenu','');section.appendChild(el('h3',null,'Unsent entry'));
          var status=makerStatus(section);
          parent.appendChild(section);
          try{saved=makerSaved(path);status.textContent=unsentSaid(unsentRead(key))+' Send it again, or update it first.';}
          catch(error){refusal(status,error);}
          /* an unsent name or place opens on the one unlock before it is sent again or updated; any other entry needs none */
          if(saved&&saved.body&&(saved.body.pair||saved.body.vault||saved.body.addrVault))makerVaultGate(section);
          var run=async function(review){
            try{
              if(!saved)throw new Error('This saved entry cannot be sent. Discard it.');
              if(saved.body.pair||saved.body.vault||saved.body.addrVault){
                var held=makerVaultBase();
                await makerVaultOpen(held,saved.body.pair?saved.body.pair.names:saved.body.vault||saved.body.addrVault);
                if(review){
                  if(!saved.body.pair)throw new Error('This saved entry cannot be sent. Discard it.');
                  var prepared=await makerPairPrepare(held,function(){},saved);
                  saved={path:saved.path,body:Object.assign({},saved.body,{at:new Date().toISOString(),
                    pair:{expectedRevision:prepared.revision,names:prepared.names,places:prepared.places}}),
                    base:prepared.base,desired:prepared.desired};
                  if(saved.body.vault)saved.body.vault=prepared.names;
                  if(saved.body.addrVault)saved.body.addrVault=prepared.places;
                  makerSave(saved);
                }
              }else if(review)throw new Error('This saved entry cannot be sent. Discard it.');
              var answer=await refs(saved.path,saved.body);
              if(!answer||answer.ok!==true)throw new Error('The Desk did not confirm. Nothing is lost; tap Send again.');
              makerClear(saved.path);section.remove();await loadMaker();
              if(saved.body.pair||saved.body.vault||saved.body.addrVault)makerVaultRefresh();
            }catch(error){refusal(status,error);}
          };
          ['Send again','Update and send','Discard'].forEach(function(label,index){
            var button=actOn(el('button','salt-ghost',label),['record.retained.retry','record.retained.review','record.retained.cancel'][index]);button.type='button';
            button.onclick=async function(){
              if(index===2){
                retainedCancel(ynTag(button,'retained:'+path),'If the Desk already took it, it stays.',function(){ makerClear(path);section.remove(); });
                return;
              }
              var controls=section.querySelectorAll('button');controls.forEach(function(control){control.disabled=true;});
              try{await run(index===1);}finally{controls.forEach(function(control){control.disabled=false;});}
            };section.appendChild(button);
          });
        });
      }
  /* 11 Oct 2026: a Record form is a section that shows in one part of Record, Entry, Customers or Pricing (data-in); a retained input
     shows in the part its route belongs to */
  function makerForm(part){ var section=el('section','maker-input'); section.setAttribute('data-in','record.'+part); return section; }
  function retainedPart(path){
    var k=path.split('/').pop();
    return ['add-id','amend-id','appoint-existing','place'].indexOf(k)>=0?'customers':['house-sizes','hush','tier-set','partner','tier-accept-all'].indexOf(k)>=0?'pricing':'entry';
  }
  /* 12 Oct 2026 (PHASE 4a): OPTION TILES for the few, fixed choices of a form (a book, a direction, a handover, a kind, a role, a level, yes or no): the system's
     Option recipe, a real radio each, so the group is one tab stop, the arrows move the choice and a tile is 44px. The group is a fieldset that answers where the
     select it replaces did: .value is the tile chosen ('' when none is), .disabled is the fieldset's own and shuts every tile, the radios' change bubbles to it,
     and fill(items) draws the tiles again, keeping the choice while it is still offered, else the first tile (or none, when none is true). Each radio keeps the
     select's act, keyed by its value ('none' for the empty one) and, for a group drawn once for each book, by that book first. What a form sends is the value. */
  var tileSeq=0;
  function makerTiles(label,items,none){
    var L=labOf(label), set=el('fieldset','salt-options maker-tiles'), grid=el('div','salt-options__grid'), name='tiles'+(++tileSeq), legend=el('legend','salt-options__legend salt-options__legend--label lbl',L[0]);
    if(L[3]){ legend.appendChild(document.createTextNode(' ')); legend.appendChild(bookMark(L[3])); }   /* a legend about a book ends in its mark: [words, act, key, book] */
    set.appendChild(legend); set.appendChild(grid);
    Object.defineProperty(set,'value',{
      get:function(){ var on=set.querySelector('input:checked'); return on?on.value:''; },
      set:function(v){ [].forEach.call(set.querySelectorAll('input'),function(r){ r.checked=r.value===String(v); }); }
    });
    set.fill=function(list){
      var on=set.querySelector('input:checked'), kept=on?on.value:null, offered=list.some(function(item){ return String(item.value)===kept; });
      grid.textContent='';
      grid.className='salt-options__grid'+(list.length!==3&&list.every(function(item){ return String(item.label).length<=14; })?' salt-options__grid--2':'');
      list.forEach(function(item,i){
        var lab=el('label','salt-option'), radio=el('input','salt-option__input'), face=el('span','salt-option__face');
        radio.type='radio'; radio.name=name; radio.value=String(item.value);
        actOn(radio,L[1],(L[2]?L[2]+'-':'')+(String(item.value)===''?'none':item.value));
        radio.checked=offered?String(item.value)===kept:(!none&&i===0);
        if(item.mark) face.appendChild(bookMark(item.mark,28)); else face.appendChild(el('span','salt-option__label',item.label));   /* a book's tile is its mark alone, named by its shape for a reader */
        lab.appendChild(radio); lab.appendChild(face); grid.appendChild(lab);
      });
    };
    set.fill(items); return set;
  }
  function makerTilesIn(root,label,items,none){ var set=makerTiles(label,items,none); root.appendChild(set); return set; }
  function makerField(parent, label, type, value, step){
    var L=labOf(label), wrap=el('label','maker-field'), title=el('span','lbl salt-field__label',L[0]), input=actOn(el('input','fld salt-field__input'),L[1],L[2]);
    if(L[3]){ title.appendChild(document.createTextNode(' ')); title.appendChild(bookMark(L[3])); }   /* a field about a book ends in its mark: [words, act, key, book] */
    input.type=type; input.value=value==null?'':String(value);
    if(type==='number'){ input.step=step||'0.01'; input.min='0'; input.inputMode='decimal'; }
    if(type==='number'||type==='date'||type==='time') wrap.classList.add('maker-field--short');   /* a short field lies beside another on a portrait tablet (the page's CSS, 768 to 859px) */
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
  /* pass is the password (the sealed device retries, under the master) or the one unlock's PBKDF2 base key (a CryptoKey): the derivation is the same either way */
  async function makerVaultOpen(pass, envelope){
    if(!envelope) return {};
    var base=typeof pass==='string'?await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']):pass;
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:makerFrom64(envelope.salt),
      iterations:envelope.it||150000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    var plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(envelope.iv)},key,makerFrom64(envelope.ct));
    var value=JSON.parse(new TextDecoder().decode(plain));
    if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('This saved entry cannot be sent. Discard it.');
    return value;
  }
  async function makerPairPrepare(pass,edit,previous){
    var read=await makerVaultRead(), pair=read.pair, names,places;
    names=await makerVaultOpen(pass,read.names);
    places=await makerVaultOpen(pass,read.places);
    var base=previous?{names:await makerVaultOpen(pass,previous.base.names),places:await makerVaultOpen(pass,previous.base.places)}
      :{names:JSON.parse(JSON.stringify(names)),places:JSON.parse(JSON.stringify(places))};
    var desired=previous?{names:await makerVaultOpen(pass,previous.desired.names),places:await makerVaultOpen(pass,previous.desired.places)}
      :{names:JSON.parse(JSON.stringify(names)),places:JSON.parse(JSON.stringify(places))};
    if(!previous)edit(desired);
    var nextNames=makerGeo.merge(base.names,desired.names,names),nextPlaces=makerGeo.merge(base.places,desired.places,places);
    var conflicts=Array.from(new Set(nextNames.conflicts.concat(nextPlaces.conflicts)));
    if(conflicts.length){
      if(!(await ownerAsk(document.activeElement,'vault:conflict',{title:'Replace their change with yours?', say:['Someone changed these names since you started: '+conflicts.join(', ')+'.','Keeping your draft changes nothing and leaves the form as it is.'],
        go:'Replace with mine', keep:'Keep my draft'})))
        throw new Error('Not changed. Your form is kept; check it before sending.');
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
    var base=typeof pass==='string'?await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']):pass;
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
    if(!n) return null;
    local=local||'TBC';
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
  /* a Correction field and an amendment kind in his words (glossary 5.2) */
  var FIELDW={product:'Book', stream:'Resale route', qty:'Units', total:'Price', cash:'Cash', deliveredQty:'Units delivered', receivedQty:'Units received', cost:'Cost',
    settledRM:'Settled (RM)', settledKg:'Settled (units)', rebateKg:'Reward (units)', delivery:'Delivery', freight:'Freight', coverUnits:'Reward used (units)', coverRM:'Reward used (RM)',
    date:'Order date', agreedOn:'Agreed on', paidOn:'Paid on', deliveredOn:'Delivered on', receivedOn:'Received on', cancelledOn:'Cancelled on', unpriced:'Unpriced', cancelled:'Cancelled',
    pending:'Pending', inTransit:'In transit', defaulted:'Defaulted', rebate:'Reward', goodwill:'Goodwill', party:'Who', assoc:'Associate', downstream:'Their customer',
    orderCode:'Order code', settle:'Settlement', note:'Note', handover:'Handover'};
  function fieldWord(f){ return FIELDW[f]||f; }
  var KINDW={Correction:'Change the figures', Fulfilment:'Record goods or cash moved', Cancellation:'Cancel the order', Payment:'Paid the supplier', Receipt:'Goods received', Default:'Nothing arrived'};
  function makerStatus(parent){
    var status=el('p','msg'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    parent.appendChild(status); return status;
  }
  var makerPlaceListId=0;
  function makerLocalityField(parent, act){
    var input=makerField(parent,['Place',act],'text','');
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
      ?'That place matches more than one. Choose its district from the list.'
      :'That place is not on the list. Add its area after a comma, or leave it blank.');
    /* the point travels with its locality, the Desk's own geoWhere: a point is never filed without the words before the place's first comma */
    var parts=value.split(',').map(function(w){return w.trim();}).filter(Boolean), official=new Set();
    makerGeo.picks().forEach(function(point,label){official.add(label.split(',')[0].trim());});
    if(result.name)official.add(result.name);
    var said=parts.find(function(w){return official.has(w);})||(result.how==='area'&&result.name?result.name:'');
    /* 17 Oct 2026: a place found on the gazetteer files the part of the wording the gazetteer itself carries, as the Worker's
       officialVaultPoint accepts; before this every unlisted place was refused here, so no new customer could be added with one */
    for(var i=0;!said&&result.how==='list'&&i<parts.length;i++){
      var alone=await makerGeo.find(parts[i]);
      if(alone.how==='list'&&alone.point&&alone.point[0]===result.point[0]&&alone.point[1]===result.point[1])said=parts[i];
    }
    if(!said)throw new Error('That place has no locality to file with its point. Choose it from the list.');
    makerVerifiedWords.add(said);
    var where=makerGeo.where(result.point.map(function(number){return Math.round(number*100)/100;}),said);
    if(where.length!==3)throw new Error('That place has no locality to file with its point. Choose it from the list.');
    return where;
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
      throw new Error('Paste a Maps or Waze link with a point or address, or leave it empty.');
    return {addr:reading.addr||null,lat:reading.lat,lng:reading.lng,src:reading.src,at:new Date().toISOString()};
  }
  /* what is on file for a party, in the Desk's words: whether a point is held, from where and on which Kuala Lumpur day, never the address */
  function makerPlaceSaid(e){
    e=e&&typeof e==='object'?e:{};
    var from={waze:'Waze',google:'Google Maps',apple:'Apple Maps',pin:'a shared pin',file:'the laptop'}[e.src]||'', d=e.at?new Date(e.at):null,
      k=d&&!isNaN(d)?d.toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}):'', mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      day=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(k)?k.slice(8,10)+' '+mon[+k.slice(5,7)-1]+' '+k.slice(0,4):'';
    return (Number.isFinite(e.lat)&&Number.isFinite(e.lng)?' with its point':' as an address alone')+(from?', from '+from:'')+(day?', filed '+day:'')+'.';
  }
  async function makerOtherInputs(parent,catalog,refreshTradeCatalog){
    pairDrafts.length=0;
    makerGeo.configure(catalog.placed);
    var today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
    var idCanStart=function(kind){return kind==='customer'||kind==='reseller'||kind==='referral';};
    var parties=(catalog.parties||[]).filter(function(code){return !code.endsWith('-R');});
    var books=catalog.products||[];
    var addSelect=function(root,label,items){
      var L=labOf(label), wrap=el('label','maker-field'), title=el('span','lbl salt-field__label',L[0]), select=actOn(el('select','fld salt-field__input'),L[1],L[2]);
      items.forEach(function(item){var option=el('option',null,item.label);option.value=item.value;select.appendChild(option);});
      wrap.appendChild(title);wrap.appendChild(select);root.appendChild(wrap);return select;
    };
    /* a row already booked with the same party, amount and date is asked about, as a trade is: he says it is a separate one, or nothing is sent */
    var makerSecond=async function(send,path,body,what){
      try{return await send(path,body);}
      catch(error){
        var twin=error.detail&&error.detail.twin&&error.detail.twin.second;
        if(!twin||!(await ownerAsk(send.button,'twin:'+what,{title:'Record this '+what+' again?', say:['You already recorded a '+what+' like this. Record it again as a separate one?'], go:'Record it again', keep:'Do not record', plain:true})))throw error;
        return send(path,Object.assign({},body,{at:new Date().toISOString(),second:twin}));
      }
    };
    var partyItems=parties.map(function(code){return {value:code,label:code};});
    var productItems=books.map(function(item){return bookItem(item.product);});
    var loan=makerForm('entry');loan.appendChild(el('h3',null,'Loan'));
    loan.appendChild(el('p','msg','Cash or goods lent or borrowed.'));
    parent.appendChild(loan);
    var loanForm=makerTilesIn(loan,['Goods or cash','record.loan.form'],[{value:'salt',label:'Goods'},{value:'cash',label:'Cash'}]);
    var loanDirection=makerTilesIn(loan,['Direction','record.loan.direction'],[{value:'in',label:'We borrowed'},{value:'out',label:'We lent'}]);
    var loanParty=addSelect(loan,['Who','record.loan.party'],partyItems), loanProduct=makerTilesIn(loan,['Book','record.loan.book'],productItems);
    var loanDate=makerField(loan,['Date','record.loan.date'],'date',today), loanAmount=makerField(loan,['Units','record.loan.amount'],'number','1');
    loanForm.addEventListener('change',function(){ loanAmount.parentNode.firstChild.textContent=loanForm.value==='cash'?'RM':'Units'; });
    var loanStatus=makerStatus(loan);
    makerButton(loan,['Send the loan','record.loan.send'],async function(send){
      if(!loanStatus) return;
      loanStatus.textContent='Sending.';
      var body={at:new Date().toISOString(),form:loanForm.value,direction:loanDirection.value,
        code:loanParty.value,date:loanDate.value,amount:Number(loanAmount.value)};
      if(loanForm.value==='salt') body.product=loanProduct.value;
      try{await makerSecond(send,'/all/maker/inputs/loan',body,'loan');loanStatus.textContent='Sent. It waits under Approve.';loadMaker();}
      catch(error){refusal(loanStatus,error);}
    },true);
    var gift=makerForm('entry');gift.appendChild(el('h3',null,'Gift'));
    gift.appendChild(el('p','msg','A gift leaves stock at cost.'));
    parent.appendChild(gift);
    var giftParty=addSelect(gift,['Who','record.gift.party'],partyItems), giftProduct=makerTilesIn(gift,['Book','record.gift.book'],productItems);
    var giftDate=makerField(gift,['Date','record.gift.date'],'date',today), giftQty=makerField(gift,['Units','record.gift.units'],'number','1');
    var giftHandover=makerTilesIn(gift,['Handover','record.gift.handover'],[{value:'',label:'Not yet'},{value:'collected',label:'Collected'},{value:'delivered',label:'Delivered'}]);
    var giftStatus=makerStatus(gift);
    makerButton(gift,['Send the gift','record.gift.send'],async function(send){
      var body={at:new Date().toISOString(),product:giftProduct.value,code:giftParty.value,date:giftDate.value,
        qty:Number(giftQty.value),movedUnits:Number(giftQty.value),handover:giftHandover.value||null};
      giftStatus.textContent='Sending.';
      try{await makerSecond(send,'/all/maker/inputs/gift',body,'gift');giftStatus.textContent='Sent. It waits under Approve.';loadMaker();}
      catch(error){refusal(giftStatus,error);}
    },true);
    var repay=makerForm('entry');repay.appendChild(el('h3',null,'Repayment'));
    repay.appendChild(el('p','msg','Part or all of a loan, paid back.'));
    parent.appendChild(repay);
    var loanItems=(catalog.loans||[]).map(function(item){
      var left=item.form==='cash'?rm(item.remaining):units(item.remaining), on=fmtWhen(item.date);
      return {value:item.rid,label:item.direction==='in'?'You owe '+item.party+' '+left+(on?' (borrowed '+on+')':''):item.party+' owes '+left+(on?' (lent '+on+')':'')};});
    var repayLoan=addSelect(repay,['Which loan','record.repay.loan'],loanItems), repayDate=makerField(repay,['Date','record.repay.date'],'date',today),
      repayAmount=makerField(repay,['Amount','record.repay.amount'],'number','1'), repayStatus=makerStatus(repay);
    makerButton(repay,['Send the repayment','record.repay.send'],async function(send){
      repayStatus.textContent='Sending.';
      try{await send('/all/maker/inputs/repay',{at:new Date().toISOString(),loan:repayLoan.value,
        date:repayDate.value,amount:Number(repayAmount.value)});
        repayStatus.textContent='Sent. It waits under Approve.';loadMaker();}
      catch(error){refusal(repayStatus,error);}
    },true);
    var redeem=makerForm('entry');redeem.appendChild(el('h3',null,'Rewards'));
    redeem.appendChild(el('p','msg','A reward settles what they owe first; if nothing is owed it is given as goods.'));
    parent.appendChild(redeem);
    var redeemDate=makerField(redeem,['Date','record.redeem.date'],'date',today), redeemStatus=makerStatus(redeem),
      redeemList=el('div','maker-rewards');
    redeem.appendChild(redeemList);
    function drawMakerRewards(rewards){
      redeemList.textContent='';
      if(!rewards.length)redeemList.appendChild(el('p','msg','No rewards held.'));
      rewards.forEach(function(offer){
        var row=el('div','maker-reward');row.setAttribute('data-reward-holder',offer.code);
        row.appendChild(el('p','maker-facts',offer.code+', '+units(offer.held)+' held'
          +(offer.departed?' while away':offer.free<offer.held?' ('+units(offer.free)+' free)':'')));
        if(offer.action){
          var status=makerStatus(row);
          makerButton(row,[offer.action==='Redeem'?(offer.associate?'Give '+offer.code+' their reward':'Give '+offer.code+' 1 unit'):'Take 1 unit off what '+offer.code+' owes','record.redeem.send'],async function(send){
            status.textContent='Checking.';
            try{
              await send('/all/maker/inputs/redeem',{at:new Date().toISOString(),code:offer.code,date:redeemDate.value});
              redeemStatus.textContent='Sent. It waits under Approve.';
              var read=await refs('/all/maker/inputs');drawMakerRewards(read.catalog.rewards||[]);loadMaker();
            }catch(error){refusal(status,error);}
          },true);
        }
        redeemList.appendChild(row);
      });
    }
    drawMakerRewards(catalog.rewards||[]);
    makerButton(redeem,['Read again','record.redeem.read'],async function(){
      try{var read=await refs('/all/maker/inputs');drawMakerRewards(read.catalog.rewards||[]);redeemStatus.textContent='Read.';}
      catch(error){refusal(redeemStatus,error);}
    },false);
    var offsets=makerForm('entry');offsets.appendChild(el('h3',null,'Offsets'));
    parent.appendChild(offsets);
    var offerDate=makerField(offsets,['Date','record.offset.date'],'date',today), offerStatus=makerStatus(offsets),
      /* two lists, never one: a customer's offset and an associate's reward offset. The Counter's answer names no kind; it offers only an associate's reward
         (the holders of a reward), so an offer is a customer's only when it says associate:false */
      offerLists={customer:el('div','maker-offers'), reward:el('div','maker-offers')};
    offerLists.customer.setAttribute('data-offers','customer'); offerLists.reward.setAttribute('data-offers','reward');
    [['customer','Customer offsets'],['reward','Associate reward offsets']].forEach(function(k){ offsets.appendChild(el('h4','maker-offers__head',k[1])); offsets.appendChild(offerLists[k[0]]); });
    var offerLoad=async function(){
      offerStatus.textContent='Reading.';
      try{
        var read=await refs('/all/maker/offsets');
        offerLists.customer.textContent=''; offerLists.reward.textContent='';
        offerStatus.textContent='';
        read.offers.forEach(function(offer){
          var row=el('div','maker-offer'), kind=offer.associate===false?'customer':'reward'; row.setAttribute('data-key',offer.rid);
          var facts=el('span','maker-offer__what'); facts.appendChild(el('span','maker-offer__code',offer.code));
          facts.appendChild(el('span','maker-offer__fig',units(offer.units)+' ('+rm(offer.rm)+') off the order of '+(fmtWhen(offer.saleDate)||'an undated day')));
          row.appendChild(facts);
          makerButton(row,['Add','record.offset.send'],async function(send){
            offerStatus.textContent='Sending.';
            try{
              await send('/all/maker/inputs/offset',{at:new Date().toISOString(),code:offer.code,rid:offer.rid,date:offerDate.value});
              await offerLoad();
              offerStatus.textContent='Sent. It waits under Approve.';
              loadMaker();
            }catch(error){refusal(offerStatus,error);}
          },true);
          offerLists[kind].appendChild(row);
        });
        ['customer','reward'].forEach(function(k){ if(!offerLists[k].childElementCount) offerLists[k].appendChild(el('p','rnone','None to offer.')); });
      }catch(error){refusal(offerStatus,error);}
    };
    offerLoad();
    var editor=makerForm('entry');editor.appendChild(el('h3',null,'Correct a row'));
    editor.appendChild(el('p','msg','Change the figures: restate what was typed on a row.'));
    editor.appendChild(el('p','msg','Goods or cash moved: record what was handed over or paid.'));
    editor.appendChild(el('p','msg','Cancel the order: only while nothing has moved.'));
    parent.appendChild(editor);
    var rows=catalog.rows||[], rowItems=rows.map(function(row){return {value:row.rid,
      label:optionBook(row.product)+row.party+', '+units(row.qty)+', '+rm(row.total)+', '+(fmtWhen(row.date)||'undated')+(row.defaulted?', defaulted':'')};});
    /* no row is chosen until he picks one, so a movement never goes out against the book's first row by default */
    var editRow=addSelect(editor,['Which row','record.amend.row'],[{value:'',label:rows.length?'Choose a row':'No row to correct'}].concat(rowItems)),
      editKind=makerTilesIn(editor,['What to do','record.amend.kind'],[{value:'Correction',label:KINDW.Correction},
        {value:'Fulfilment',label:KINDW.Fulfilment},{value:'Cancellation',label:KINDW.Cancellation}]),
      editDate=makerField(editor,['On','record.amend.date'],'date',today);
    var movement=el('div','maker-fields');editor.appendChild(movement);
    var editCash=makerField(movement,['RM','record.amend.cash'],'number','0'), editUnits=makerField(movement,['Units','record.amend.units'],'number','0');
    var patch=el('div','maker-fields');editor.appendChild(patch);
    var definitions=catalog.correctionFields||[];
    var editField=addSelect(patch,['What to change','record.amend.field'],definitions.map(function(item){return {value:item.field,label:fieldWord(item.field)};}));
    var valueBox=el('div','maker-fields');patch.appendChild(valueBox);
    var editValue=null, changes={}, patchList=el('p','msg');patch.appendChild(patchList);
    var editStatus=makerStatus(editor);
    var cancelPreview=el('div','maker-cancellation');cancelPreview.setAttribute('aria-live','polite');editor.appendChild(cancelPreview);
    var drawValue=function(){
      valueBox.replaceChildren();
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition)return;
      var choices=definition.kind==='boolean'?[{value:'true',label:'Yes'},{value:'false',label:'No'}]
        :definition.kind==='code'?partyItems
          :definition.kind==='product'?productItems
            :definition.kind==='stream'?[{value:'R2',label:'They resell'},{value:'R3',label:'They introduced the buyer'}]
              :definition.kind==='handover'?[{value:'delivered',label:'Delivered'},{value:'collected',label:'Collected'}]:null;
      var tiled=definition.kind==='boolean'||definition.kind==='stream'||definition.kind==='handover'||definition.kind==='product';
      if(choices)editValue=(tiled?makerTilesIn:addSelect)(valueBox,['New value','record.amend.value'],choices);
      else editValue=makerField(valueBox,['New value','record.amend.value'],definition.kind==='date'?'date':definition.kind==='text'?'text':'number','');
    };
    editField.addEventListener('change',drawValue);drawValue();
    makerButton(patch,['Add','record.amend.add-change'],function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||!editValue)return;
      if(!editValue.value.trim())throw new Error('Enter a new value, or tap Clear it to empty the field.');
      changes[definition.field]=definition.kind==='number'?Number(editValue.value)
        :definition.kind==='boolean'?editValue.value==='true':definition.kind==='text'?editValue.value.trim():editValue.value;
      patchList.textContent=Object.keys(changes).map(fieldWord).join(', ')+' ready to send.';
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    makerButton(patch,['Clear it','record.amend.clear-field'],function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||definition.required)throw new Error('This field cannot be empty. Enter a new value.');
      changes[definition.field]=null;patchList.textContent=Object.keys(changes).map(fieldWord).join(', ')+' ready to send.';
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    editRow.addEventListener('change',function(){changes={};patchList.textContent='';});
    /* plan 4: the row picked has its History, and Undo on its newest move */
    var editHist=el('div','maker-fields');editor.appendChild(editHist);
    var drawHist=function(){editHist.replaceChildren();if(editRow.value&&rows.some(function(item){return item.rid===editRow.value&&item.direction!=='BUY';}))historyBlock(editHist,{rid:editRow.value},'row:'+editRow.value,null,'row:'+editRow.value);};
    editRow.addEventListener('change',drawHist);drawHist();
    var kindsFor=function(){
      var row=rows.find(function(item){return item.rid===editRow.value;}), kept=editKind.value;
      var names=row&&row.defaulted?['Correction']:row&&row.direction==='BUY'?['Correction','Fulfilment','Cancellation','Payment','Receipt','Default']:['Correction','Fulfilment','Cancellation'];
      editKind.fill(names.map(function(name){return {value:name,label:KINDW[name]||name};}));
      editKind.value=names.indexOf(kept)>=0?kept:'Correction';
    };
    var drawKind=function(){var k=editKind.value;
      movement.style.display=(k==='Fulfilment'||k==='Payment'||k==='Receipt')?'':'none';
      editCash.disabled=k==='Cancellation';editUnits.disabled=k==='Cancellation';
      editCash.parentNode.style.display=k==='Receipt'?'none':'';editUnits.parentNode.style.display=k==='Payment'?'none':'';
      patch.style.display=k==='Correction'?'':'none';
      cancelPreview.replaceChildren();cancelPreview.hidden=k!=='Cancellation';
      if(k==='Cancellation'){
        var row=rows.find(function(item){return item.rid===editRow.value;}), reading=row&&row.cancellation;
        if(!reading){cancelPreview.appendChild(el('p','msg','This order cannot be cancelled: it is closed, or goods have moved.'));return;}
        cancelPreview.appendChild(el('p','maker-facts','After: '+reading.pay+', '+reading.deliv+', '+reading.order));
        var refund=reading.refundRM;
        cancelPreview.appendChild(el('p','msg','The order is cancelled'
          +(refund!=null?', and '+rm(refund)+' already paid becomes a refund you owe '+row.party:'')+'.'));
      }};
    editKind.addEventListener('change',drawKind);editRow.addEventListener('change',function(){kindsFor();drawKind();});kindsFor();drawKind();
    /* plan 1: Needs you's owed cards open this form on their row, as goods or cash moved (amendFor) */
    amendPick=function(rid){ if(!rows.some(function(item){return item.rid===rid;}))return false; editRow.value=rid; changes={}; patchList.textContent=''; kindsFor(); editKind.value='Fulfilment'; drawKind(); editorReady(); return true; };
    var editorButton=makerButton(editor,['Send the correction','record.amend.send'],async function(send){
      if(!editRow.value)throw new Error('Choose a row first.');
      var body={at:new Date().toISOString(),rid:editRow.value,kind:editKind.value,date:editDate.value};
      if(body.kind==='Correction')body.fields=Object.assign({},changes);
      if(body.kind==='Fulfilment'){body.cash=Number(editCash.value);body.movedUnits=Number(editUnits.value);}
      if(body.kind==='Payment')body.cash=Number(editCash.value);
      if(body.kind==='Receipt')body.movedUnits=Number(editUnits.value);
      editStatus.textContent='Sending.';
      try{ await send('/all/maker/inputs/ledger-amend',body); }
      catch(error){
        /* a customer's order: the Desk names it, and the change goes as the order's Amend, so the order and the row change together */
        var rs=error.detail&&error.detail.restate;
        if(!rs||!(/^[0-9]{14}-[a-z0-9]{1,8}$/).test(rs.order))throw error;
        await refs('/all/maker/orders/'+encodeURIComponent(rs.order)+'/restate',{rid:mintRid(),qty:rs.qty,total:rs.total,delivery:rs.delivery});
        changes={};patchList.textContent='';editStatus.textContent='Sent as an amendment of their order, so the order and the row change together.';
        await loadMaker();
        return;
      }
      changes={};patchList.textContent='';editStatus.textContent='Sent. The row changes once you approve it.';
      await loadMaker();
    },true);
    var editorReady=function(){editorButton.disabled=!rows.length||!editRow.value;};
    editRow.addEventListener('change',editorReady);editorReady();
    if(!rows.length)editStatus.textContent='No row to correct.';
    var revive=makerForm('entry');revive.appendChild(el('h3',null,'Reopen a cancelled order'));
    revive.appendChild(el('p','msg','Reopens an order you cancelled, if nothing was paid or handed over.'));
    parent.appendChild(revive);
    var revivable=(catalog.revivable||[]).filter(function(row){return !(row.paid>0.009)&&!(row.movedUnits>0.009);});
    var reviveRow=addSelect(revive,['Which order','record.revive.row'],revivable.map(function(row){return {value:row.rid,
      label:optionBook(row.product)+row.party+', '+units(row.qty)+', '+rm(row.total)+', '+(fmtWhen(row.date)||'undated')+(row.cancelledOn?', cancelled '+fmtWhen(row.cancelledOn):'')};}));
    var reviveDate=makerField(revive,['On','record.revive.date'],'date',today), reviveStatus=makerStatus(revive);
    var reviveButton=makerButton(revive,['Reopen the order','record.revive.send'],async function(send){
      reviveStatus.textContent='Sending.';
      await send('/all/maker/inputs/ledger-amend',{at:new Date().toISOString(),rid:reviveRow.value,kind:'Correction',date:reviveDate.value,
        fields:{cancelled:false,cancelledOn:null}});
      reviveStatus.textContent='Sent. The order is back once you approve it.';
      await loadMaker();
    },true);
    reviveButton.disabled=!revivable.length;
    if(!revivable.length)reviveStatus.textContent='No cancelled order can be reopened.';
    var id=makerForm('customers');id.appendChild(el('h3',null,'New customer'));
    id.appendChild(el('p','msg','The name and place are locked on this phone before anything is sent; only a short code travels.'));
    parent.appendChild(id);
    var idKind=makerTilesIn(id,['Role','record.add-id.role'],[{value:'customer',label:'Customer'},{value:'supplier',label:'Supplier'},
      {value:'reseller',label:'Associate who resells'},{value:'referral',label:'Associate who introduces'},
      {value:'downstream',label:'Customer of an associate'},{value:'bucket',label:'Associate’s resale account'}]);
    var idParentItems=(catalog.associates||[]).map(function(item){return {value:item.code,label:item.code};});
    var idParent=addSelect(id,['Their associate','record.add-id.parent'],idParentItems);
    var idName=makerField(id,['Name','record.add-id.name'],'text',''), idPlace=makerLocalityField(id,'record.add-id.place');
    idPlace.closest('label').appendChild(el('span','msg','Optional. Blank gives TBC until the place is confirmed.'));
    var idGate=makerVaultGate(id);
    var idLink=makerField(id,['Maps or Waze link','record.add-id.link'],'text','');
    var tierBooks=books.filter(function(item){return item.tiered;});
    var tierNames=catalog.tierNames||[], idTiers=tierBooks.map(function(item){
      var sel=makerTilesIn(id,['Starting level','record.add-id.tier',item.product,item.product],[{value:'',label:'Not set'}]
        .concat(tierNames.map(function(name){return {value:name,label:name};})));
      sel.value=tierNames.length?tierNames[tierNames.length-1]:'';
      return {product:item.product,select:sel};
    });
    var driftBooks=books.filter(function(item){return item.drift;});
    var idDrifts=driftBooks.map(function(item){
      var presets=item.driftPresets||[];
      var select=makerTilesIn(id,['Starting price drift','record.add-id.drift',item.product,item.product],[{value:'',label:'Follows their record'}]
        .concat(presets.map(function(preset){return {value:String(preset.value),
          label:preset.name+' ('+(preset.value>0?'+':'')+Number(preset.value).toFixed(2)+')'};}))
        .concat([{value:'typed',label:'Typed'}]));
      var typed=makerField(id,['Drift','record.add-id.drift-value',item.product,item.product],'number','',0.05);
      typed.min='-1';typed.max='1';typed.step='0.05';typed.placeholder='-1 to 1';typed.closest('label').hidden=true;
      select.addEventListener('change',function(){typed.closest('label').hidden=select.value!=='typed';});
      return {product:item.product,select:select,typed:typed};
    });
    var idStatus=makerStatus(id), idBusy=false;
    idKind.addEventListener('change',function(){
      var bucket=idKind.value==='bucket', needsParent=bucket||idKind.value==='downstream';
      idName.disabled=bucket;idPlace.disabled=bucket;idGate.hidden=bucket;idLink.disabled=bucket;
      idParent.disabled=!needsParent;
      var canStart=idCanStart(idKind.value);
      idTiers.forEach(function(item){item.select.disabled=!canStart;});
      idDrifts.forEach(function(item){item.select.disabled=!canStart;item.typed.disabled=!canStart;});
    });
    idKind.dispatchEvent(new Event('change'));
    var idDraft=null;
    pairDrafts.push({draft:function(){return idDraft;},clear:function(){idDraft=null;}});
    id.addEventListener('input',function(){idDraft=null;});
    id.addEventListener('change',function(){idDraft=null;});
    makerButton(id,['Add the customer','record.add-id.send'],async function(send){
      if(idBusy)return;idBusy=true;idStatus.textContent='Locking the name and place.';
      var kind=idKind.value, parentCode=(kind==='bucket'||kind==='downstream')?idParent.value:null;
      var tiers={};
      if(idCanStart(kind)){
        idTiers.forEach(function(item){if(item.select.value)tiers[item.product]=item.select.value;});
        for(var driftIndex=0;driftIndex<idDrifts.length;driftIndex++){
          var driftItem=idDrifts[driftIndex], choice=driftItem.select.value, driftValue;
          if(choice==='typed'){
            var raw=driftItem.typed.value.trim();driftValue=Number(raw);
            if(!raw||!Number.isFinite(driftValue)||driftValue< -1||driftValue>1){
              idStatus.textContent='Enter a drift from -1 to +1.';idBusy=false;return;
            }
          }else if(choice!=='')driftValue=Number(choice);
          else continue;
          tiers[driftItem.product]=driftValue;
        }
      }
      if(!Object.keys(tiers).length)tiers=null;
      var name=idName.value.trim(), locality=idPlace.value.trim(), code;
      if(kind==='bucket') code=parentCode?parentCode+'-R':null;
      else code=makerDerivedCode(name,locality,kind,catalog.parties||[],null,parentCode);
      if(!code){idStatus.textContent='Enter a name, or choose the associate for a resale account.';idBusy=false;return;}
      var envelope=null,addrEnvelope=null,geo=null;
      try{
        if(kind!=='bucket'){
          var held=makerVaultBase();
          if(locality)geo=await makerLocalityPoint(locality);
          var filed=await makerFiledLink(idLink.value);
          idDraft=await makerPairPrepare(held,function(maps){
            if(Object.hasOwn(maps.names,code))throw new Error('That code is already in use. Check the name and place.');
            maps.names[code]=name+' ('+(locality||'to be confirmed')+')';if(filed)maps.places[code]=filed;
          },idDraft);
          envelope=idDraft.names;if(filed)addrEnvelope=idDraft.places;delete idDraft.placeMap;
        }
        var idBody={at:new Date().toISOString(),code:code,kind:kind,
          parent:parentCode,tiers:tiers,vault:envelope};
         if(geo)idBody.geo=geo;
        if(addrEnvelope)idBody.addrVault=addrEnvelope;
        if(idDraft)makerPairBody(idBody,idDraft);
        await send('/all/maker/inputs/add-id',idBody,idDraft);
        idDraft=null;
        idName.value='';idPlace.value='';idLink.value='';
        if(kind!=='bucket')makerVaultRefresh();
        try{
          await refreshTradeCatalog();
          idStatus.textContent='Sent. '+code+' waits under Approve, and can be chosen already.';
        }catch(refreshError){
          idStatus.textContent='Sent. '+code+' waits under Approve, but the lists could not be refreshed: '+refreshError.message;
        }
        loadMaker();
      }catch(error){refusal(idStatus,error);}
      idBusy=false;
    },true);
    var appointment=makerForm('customers');appointment.appendChild(el('h3',null,'Make an associate'));
    appointment.appendChild(el('p','msg','Their name and place stay as they are.'));
    parent.appendChild(appointment);
    var appointmentCustomers=(catalog.appointmentCustomers||[]).filter(function(code){return typeof code==='string';});
    var appointmentCustomerItems=[{value:'',label:appointmentCustomers.length?'Choose a customer':'Nobody to appoint'}]
      .concat(appointmentCustomers.map(function(code){return {value:code,label:code};}));
    var appointmentCustomer=addSelect(appointment,['Who','record.appoint.customer'],appointmentCustomerItems);
    var appointmentKinds=(catalog.appointmentKinds||[]).map(function(item){
      return {value:item.kind,label:item.kind==='referral'?'Introducer':item.kind.charAt(0).toUpperCase()+item.kind.slice(1)};
    });
    var appointmentRole=makerTilesIn(appointment,['As','record.appoint.role'],appointmentKinds,true);
    var appointmentStatus=makerStatus(appointment);
    makerButton(appointment,['Send the appointment','record.appoint.send'],async function(send){
      var code=appointmentCustomer.value, kind=appointmentRole.value;
      if(!code||!kind){appointmentStatus.textContent='Choose who, and as what.';return;}
      await send('/all/maker/inputs/appoint-existing',{at:new Date().toISOString(),code:code,kind:kind});
      var option=[].filter.call(appointmentCustomer.options,function(item){return item.value===code;})[0];
      if(option)option.remove();
      appointmentCustomer.value='';
      appointmentStatus.textContent='Sent. They become an associate once you approve it.';
      loadMaker();
    },true);
    var amend=makerForm('customers');amend.appendChild(el('h3',null,'Change a name or place'));
    amend.appendChild(el('p','msg','The name and place are locked on this phone first. Only the short code and the rounded place travel.'));
    parent.appendChild(amend);
    var amendParty=addSelect(amend,['Who','record.amend-id.party'],partyItems), amendName=makerField(amend,['Name','record.amend-id.name'],'text',''),
      amendPlace=makerLocalityField(amend,'record.amend-id.place'), amendGate=makerVaultGate(amend),
      amendStatus=makerStatus(amend), amendBusy=false;
    var amendLink=makerField(amend,['Maps or Waze link','record.amend-id.link'],'text','');
    var amendDraft=null;
    pairDrafts.push({draft:function(){return amendDraft;},clear:function(){amendDraft=null;}});
    amend.addEventListener('input',function(){amendDraft=null;});
    amend.addEventListener('change',function(){amendDraft=null;});
    makerButton(amend,['Save the change','record.amend-id.send'],async function(send){
      if(amendBusy)return;amendBusy=true;amendStatus.textContent='Locking the name and place.';
      var from=amendParty.value, kind=from.charAt(0)==='S'?'supplier':'customer';
      var name=amendName.value.trim(), locality=amendPlace.value.trim(), to=makerDerivedCode(name,locality,kind,catalog.parties||[],from);
      if(!to||!locality){amendStatus.textContent='Enter a name and place first.';amendBusy=false;return;}
      try{
        var held=makerVaultBase();
        var geo=await makerLocalityPoint(locality), filed=await makerFiledLink(amendLink.value);
        amendDraft=await makerPairPrepare(held,function(maps){
          maps.names=makerRekeyMap(maps.names,from,to);maps.places=makerRekeyMap(maps.places,from,to);
          maps.names[to]=name+' ('+locality+')';if(filed)maps.places[to]=filed;
        },amendDraft);
        delete amendDraft.placeMap;
        var result=await send('/all/maker/inputs/amend-id',makerPairBody({at:new Date().toISOString(),from:from,to:to,geo:geo,
          vault:amendDraft.names,addrVault:amendDraft.places||undefined},amendDraft),amendDraft);
        amendDraft=null;
        amendName.value='';amendPlace.value='';amendLink.value='';
        makerVaultRefresh();
        amendStatus.textContent=result.vaultOnly?'Saved. The code stays '+from+'.'
          :'Sent. The code changes from '+from+' to '+to+' once you approve it.';
        loadMaker();
      }catch(error){refusal(amendStatus,error);}
      amendBusy=false;
    },true);
    var placement=makerForm('customers');placement.appendChild(el('h3',null,'Place on the map'));
    placement.appendChild(el('p','msg','Keep the filed point, or choose a place and paste a new map link.'));
    parent.appendChild(placement);
    var placeParty=addSelect(placement,['Who','record.place.party'],partyItems),
      placeGate=makerVaultGate(placement,function(gate){
        /* open, the gate says whether a place is filed for the one chosen, from the places the unlock holds; never where */
        if(!makerVault||!placeParty.value) return;
        gate.appendChild(el('p','msg',Object.hasOwn(makerVault.places,placeParty.value)?'A place is filed for them'+makerPlaceSaid(makerVault.places[placeParty.value])+' Filing a new link replaces it.':'No place is filed for them yet.'));
      }), placeStatus=makerStatus(placement), placeBusy=false;
    var placeLocality=makerLocalityField(placement,'record.place.locality'), placeLink=makerField(placement,['New Maps or Waze link','record.place.link'],'text','');
    var placeDraft=null;
    pairDrafts.push({draft:function(){return placeDraft;},clear:function(){placeDraft=null;}});
    placement.addEventListener('input',function(){placeDraft=null;});
    placement.addEventListener('change',function(){placeDraft=null;});
    placeParty.addEventListener('change',function(){makerVaultDraw(placeGate);});
    makerButton(placement,['Place them','record.place.send'],async function(send){
      if(placeBusy)return;placeBusy=true;placeStatus.textContent='Opening the locked places.';
      try{
        var held=makerVaultBase();
        var filed=await makerFiledLink(placeLink.value), coords, envelope;
        placeDraft=await makerPairPrepare(held,function(maps){if(filed)maps.places[placeParty.value]=filed;},placeDraft);
        var places=placeDraft.placeMap;
        if(filed){
          coords=await makerLocalityPoint(placeLocality.value.trim());
          envelope=placeDraft.places;
        }else if(placeLocality.value.trim())coords=await makerLocalityPoint(placeLocality.value.trim());
        else{
          /* the point filed already, with the locality it was filed with; a point with none is not re-filed bare */
          var point=places[placeParty.value], held2=(catalog.placed||{})[placeParty.value];
          if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))
            throw new Error('They have no place filed yet. Choose a place first.');
          if(!held2||typeof held2[2]!=='string'||!held2[2].trim())
            throw new Error('Choose a place from the list: a point is filed with its locality.');
          coords=[Math.round(point.lat*100)/100,Math.round(point.lng*100)/100,held2[2].trim()];
        }
        delete placeDraft.placeMap;
        var body={at:new Date().toISOString(),places:{[placeParty.value]:coords}};
        if(envelope)body.addrVault=envelope;
        makerPairBody(body,placeDraft);
        await send('/all/maker/inputs/place',body,placeDraft);
        placeDraft=null;
        placeLocality.value='';placeLink.value='';
        makerVaultRefresh();
        placeStatus.textContent='Sent. The exact address stays locked.';
        loadMaker();
      }catch(error){refusal(placeStatus,error);}
      /* a place that is not on the list throws after the pair is prepared, so the plain places map is stripped here whichever way the tap ended */
      finally{ if(placeDraft) delete placeDraft.placeMap; placeBusy=false; }
    },true);
  }
  function makerCard(parent,key,recipe){
    var card=el('article',(recipe||'salt-glass-card')+' maker-card');
    if(key) card.setAttribute('data-maker-card',key);
    parent.appendChild(card); return card;
  }
  /* 11 Oct 2026: a card's answer lands in its own foot, beside its buttons, and #makerReviewStatus keeps the list's own words
     (the read, the count). The card is found by its key when the answer comes, since a redraw replaces it; a card that has gone
     (the order left the open list, the row was decided) hands its answer to the list's line, so it is never lost. A foot below
     the screen (a tall card, a tap near its head) is scrolled to, clear of the bottom bar, so the answer is seen. */
  function makerFoot(card,key){
    var say=el('p','maker-say'); say.setAttribute('role','status'); say.setAttribute('aria-live','polite');
    say.setAttribute('data-maker-say',key); card.appendChild(say); return say;
  }
  /* 12 Oct 2026 (Phase 2a): THE STAGE FOOT. The moves of the card's stage stand together at its foot, the filled one first (Accept, Accept again, Ready,
     Record handover) and the quiet ones beside it (Decline, Cancel order, Offer again, Withdraw the offer), and the card's answer line under them.
     Cash held for the order shuts every control of the card (makerCashControls), the foot's too. The class has marks a foot with moves, or one whose
     Accept is still being read, which stands along the card's foot as it scrolls. */
  function makerCardFoot(card,acts,key,cashed,pending){
    var foot=el('div','maker-foot'); foot.appendChild(acts); card.appendChild(foot); makerFoot(foot,key);
    if(acts.children.length||pending) foot.classList.add('has');
    if(cashed&&(makerCashHeld[key]||makerCashStorageError)) [].forEach.call(acts.querySelectorAll('button,input,select'),function(n){ n.disabled=true; });
  }
  /* the last answer a card was given, kept by its key: Needs you reads a Desk row's, which its own card is gone to hear */
  var makerSaid={};
  function makerSay(key,text,error){
    makerSaid[key]=text;
    var line=null, list=document.getElementById(String(key).indexOf('draft:')===0?'makerDraftStatus':'makerReviewStatus');
    [].forEach.call(document.querySelectorAll('#makerReview [data-maker-say], #makerDrafts [data-maker-say]'),function(node){ if(node.getAttribute('data-maker-say')===key) line=node; });
    /* 13 Oct 2026 (stress, Medium): a card that has gone (the order moved on, the row was decided) hands its answer to the list's line at the head of the
       part, which the page may be scrolled well below: it is brought into reach, as a card's own line is */
    if(line){ line.textContent=text; withDetails(line,error); if(line.scrollIntoView) line.scrollIntoView({block:'nearest'}); }
    else if(list){ list.textContent=text; withDetails(list,error); if(list.scrollIntoView) list.scrollIntoView({block:'nearest'}); }
  }
  function makerAction(path, body, message, key){
    if(makerBusy) return Promise.resolve();
    makerBusy=true;
    return refs(path,body).then(function(result){
      makerBusy=false;
      return loadMaker().then(function(){
        makerSay(key,result.differs?'The row differs from what you saw and waits under Approve.'
          :result.waiting?'The row is still being made. Check Approve in a moment.'
          :result.dropped&&result.row?'Taken off. The money is on '+result.row+'.'
          :result.preapproval&&result.preapproval.says?result.preapproval.says:message||'Saved.');
        return true;
      });
    },function(error){
      makerBusy=false;
      makerSay(key,error.message,error);
      return false;
    });
  }
  /* one request id per move until it lands, so a retry after a lost answer is the same request */
  var makerRids={};
  function makerMove(order,body,message){
    var key=order.id+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+(body.claim?'notfound':'move'),
      Object.assign({rid:rid},body),message,order.id).then(function(done){ if(done) delete makerRids[key]; });
  }
  /* a handover, a close, cash, a Received or a move offered again, under one request id until it lands, as a move is */
  function makerTap(order,action,body,message){
    var key=order.id+action+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+action,
      Object.assign({rid:rid},body),message,order.id).then(function(done){ if(done) delete makerRids[key]; });
  }
  var MAKER_CASH_MS=10000, makerCashHeld={}, makerCashSaid={};
  var MAKER_CASH_PREFIX='saltMakerCash:', makerCashStorageError='';
  function makerCashSave(id,held){
    var key=MAKER_CASH_PREFIX+id, old=localStorage.getItem(key);
    if(old&&JSON.parse(old).body!==held.body)throw new Error('A cash entry on this order is stuck. Reload to recover it.');
    localStorage.setItem(key,JSON.stringify({v:1,id:id,body:held.body,beforePaid:held.beforePaid,confirmed:!!held.confirmed}));
  }
  function makerCashRestore(){
    try{
      Object.keys(localStorage).filter(function(key){return key.indexOf(MAKER_CASH_PREFIX)===0;}).forEach(function(key){
        var saved=JSON.parse(localStorage.getItem(key)), body=JSON.parse(saved.body), id=key.slice(MAKER_CASH_PREFIX.length);
        if(saved.v!==1||saved.id!==id||typeof saved.confirmed!=='boolean'||!Number.isFinite(saved.beforePaid)||saved.beforePaid<0
          ||!(/^[0-9a-f]{32}$/).test(body.rid)||!Number.isFinite(body.amount)||body.amount<=0.004
          ||Object.keys(body).sort().join(',')!=='amount,rid')throw new Error('A cash entry on this order is stuck. Reload to recover it.');
        if(!makerCashHeld[id]){
          makerCashHeld[id]={amount:body.amount,body:saved.body,beforePaid:saved.beforePaid,confirmed:saved.confirmed,sent:true,busy:false};
          makerCashSaid[id]=saved.confirmed?'Recorded. Refresh to see it.':'Not confirmed. Tap Retry cash.';
        }
      });
      makerCashStorageError='';
    }catch(error){makerCashStorageError=error.message;}
  }
  function makerCashReconcile(data){
    Object.keys(makerCashHeld).forEach(function(id){
      var held=makerCashHeld[id], order=(data.orders||[]).filter(function(o){return o.id===id;})[0];
      if(held.confirmed&&order&&Number(order.paid||0)+0.004>=held.beforePaid+held.amount){
        localStorage.removeItem(MAKER_CASH_PREFIX+id);delete makerCashHeld[id];
        makerCashSaid[id]='Recorded: '+rm(held.amount)+' in cash. '+rm(Math.max(0,Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0)))+' still owed.';
      }
    });
  }
  function makerCashLeft(id){
    var held=makerCashHeld[id];
    return held?Math.max(0,Math.ceil((held.until-Date.now())/1000)):0;
  }
  function makerCashHold(order,amount){
    makerCashRestore();
    if(makerCashStorageError){drawMaker();return;}
    if(makerCashHeld[order.id]) return;
    var due=Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0);
    if(!Number.isFinite(amount)||amount<=0.004||amount>due+0.004){
      makerCashSaid[order.id]='That is not a figure above RM 0 and up to the '+rm(due)+' owed. Nothing was sent.';drawMaker();return;
    }
    var held={amount:amount,beforePaid:Number(order.paid||0),until:Date.now()+MAKER_CASH_MS,sent:false,busy:false};
    makerCashHeld[order.id]=held;delete makerCashSaid[order.id];
    held.timer=setTimeout(function(){ makerCashGo(order.id); },MAKER_CASH_MS);
    held.tick=setInterval(function(){
      var node=document.querySelector('[data-maker-cash-left="'+order.id+'"]');
      if(node)node.textContent=String(makerCashLeft(order.id));
    },1000);
    drawMaker();
  }
  function makerCashUndo(id){
    var held=makerCashHeld[id];if(!held||held.sent)return;
    clearTimeout(held.timer);clearInterval(held.tick);delete makerCashHeld[id];
    makerCashSaid[id]='Undone: nothing was sent, and the order is as it was.';drawMaker();
  }
  async function makerCashGo(id){
    var held=makerCashHeld[id];if(!held||held.busy||held.confirmed)return;
    held.busy=true;held.sent=true;
    clearTimeout(held.timer);clearInterval(held.tick);
    /* After transport starts, every retry carries these exact bytes, never the edited field. */
    if(!held.body)held.body=JSON.stringify({rid:mintRid(),amount:held.amount});
    makerCashSaid[id]='Sending.';drawMaker();
    try{
      makerCashSave(id,held);
      var response=await fetch('/all/maker/orders/'+encodeURIComponent(id)+'/cash',{
        method:'POST',headers:{'content-type':'application/json'},body:held.body,redirect:'manual',keepalive:true
      });
      if(response.type==='opaqueredirect'||response.status===401){ended();throw new Error(ENDED);}
      var result=await response.json();
      if(!response.ok||!result.ok)throw refused(result.error||'The Desk did not take the cash.',result,response.status);
      held.confirmed=true;
      makerCashSaid[id]='Recorded. Refresh to see it.';
      makerCashSave(id,held);
      await loadMaker();
    }catch(error){
      makerCashSaid[id]=(held.confirmed?'Recorded. Refresh to see it. ':'Not confirmed. Tap Retry cash. ')+error.message;
    }finally{held.busy=false;drawMaker();}
  }
  function makerCashFlush(){
    return Promise.all(Object.keys(makerCashHeld).filter(function(id){return !makerCashHeld[id].sent;}).map(makerCashGo));
  }
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')makerCashFlush();});
  window.addEventListener('pagehide',function(){makerCashFlush();});
  function makerCashControls(card,order){
    var held=makerCashHeld[order.id], note=el('p','salt-insight');
    note.setAttribute('role','status');note.setAttribute('data-maker-cash-status',order.id);
    if(held){
      card.querySelectorAll('button,input,select').forEach(function(node){node.disabled=true;});
      if(!held.sent){
        note.appendChild(document.createTextNode('Cash received, '+rm(held.amount)+': it goes in '));
        var left=el('span',null,String(makerCashLeft(order.id)));left.setAttribute('data-maker-cash-left',order.id);
        note.appendChild(left);note.appendChild(document.createTextNode(' s. Undo sends nothing.'));
        makerClaimButton(card,['Undo','order.cash-undo'],function(){makerCashUndo(order.id);},true).setAttribute('data-maker-cash-undo','');
      }else{
        note.textContent=makerCashSaid[order.id]||'Sending.';
        var retry=makerClaimButton(card,[held.confirmed?'Refresh cash':'Retry cash','order.cash-retry'],function(){
          return held.confirmed?loadMaker():makerCashGo(order.id);
        },true);
        retry.disabled=held.busy;retry.setAttribute('data-maker-cash-retry','');
      }
    }else if(makerCashStorageError){
      card.querySelectorAll('button,input,select').forEach(function(node){node.disabled=true;});
      note.textContent=makerCashStorageError;
    }else{
      makerPayControl(card,order,true);
      note.textContent=makerCashSaid[order.id]||'';
    }
    card.appendChild(note);
  }
  /* 16 Oct 2026 (plan 5, part 1): BANK AND CASH ARE TWO TILES OVER ONE AMOUNT, in place of a field and a button each. Cash is offered at Ready alone, as
     before, and neither tile is chosen until he chooses, so money is never booked by a road he did not pick; an agreed order not yet Ready has Bank alone,
     chosen. The button says the figure and the road once both are there. What a tap sends is what the old button of that road sent, to the sen and the
     byte: Bank the order's received with the amount, under one request id until it lands (makerTap), so the Desk's rowRoom and the fold's payFault read it
     as they did; Cash held ten seconds with its Undo (makerCashHold), then the order's cash. No road is new. */
  function makerPayControl(card,order,cash){
    var amount=makerField(card,['Amount, RM','order.pay-amount'],'number','');
    var by=makerTilesIn(card,['Paid by','order.pay-by'],[{value:'bank',label:'Bank'}].concat(cash?[{value:'cash',label:'Cash'}]:[]),cash);
    var record=makerButton(card,['Record payment','order.pay'],function(){
      if(by.value==='cash') makerCashHold(order,Number(amount.value));
      else if(by.value==='bank') makerTap(order,'received',{amount:Number(amount.value)},'Sent to the Desk.');
      else makerSay(order.id,'Choose Bank or Cash first. Nothing was sent.');
    },false);
    var draw=function(){ record.textContent=Number(amount.value)>0&&by.value?'Record '+rm(amount.value)+', '+by.value:'Record payment'; };
    amount.addEventListener('input',draw); by.addEventListener('change',draw); draw();
  }
  /* a stage he rejected under Approve, offered again by the Desk's own againOrder */
  var MAKER_AGAIN={pay:'payment',cash:'cash',move:'handover',cancel:'cancellation',amend:'amendment'};
  function makerAgain(card,order,acts){
    (order.again||[]).filter(function(stage){ return MAKER_AGAIN[stage]; }).forEach(function(stage){
      var offer=makerButton(acts,['Send the '+MAKER_AGAIN[stage]+' again','order.again-'+stage],function(){
        makerAsk(order,offer,'again-'+stage,{title:'Send the '+MAKER_AGAIN[stage]+' again?', plain:true, go:'Send it again', keep:'Not now',
          say:['The '+MAKER_AGAIN[stage]+' you rejected goes back to the Desk as it was, for you to approve again.'],
          yes:function(){ makerTap(order,'again',{stage:stage},'The '+MAKER_AGAIN[stage]+' is sent again.'); }});
      },false);
      offer.setAttribute('data-again',stage); makerAskTag(order,offer,'again-'+stage);
    });
    var dropOne=function(stage){
      var drop=makerButton(acts,['Not needed','order.again-drop'+(stage?'-'+stage:'')],function(){
        makerAsk(order,drop,'again-drop'+(stage||''),{title:'Not needed?', plain:true, go:'Not needed', keep:'Keep it',
          say:[stage?'Use this when the sale is on the book another way. The '+MAKER_AGAIN[stage]+' you rejected is no longer offered, and nothing goes to the Desk.'
            :'Use this when the sale is on the book another way. Every step you rejected on this order is no longer offered, and nothing goes to the Desk.'],
          yes:function(){ makerTap(order,'again',stage?{drop:true,stage:stage}:{drop:true},'Taken off. Nothing is sent again.'); }});
      },false);
      drop.setAttribute('data-again','drop'+(stage?'-'+stage:'')); makerAskTag(order,drop,'again-drop'+(stage||''));
    };
    if(order.againWhole===true&&(order.again||[]).indexOf('pay')<0) dropOne('');
    else ['cancel','move','amend'].forEach(function(stage){ if((order.again||[]).indexOf(stage)>=0) dropOne(stage); });
  }
  /* a pending row he rejected on an agreed order is offered again by Accept against a fresh preview, at the charge and
     goods the order already carries (the customer was told them), as the Desk's own Accept again: nothing priced is sent */
  function makerAgainAck(order){ return ['acknowledged','ready','done'].indexOf(order.status)>=0&&(order.again||[]).indexOf('ack')>=0; }
  function makerAcceptAgain(card,order,acts){
    var route='/all/maker/orders/'+encodeURIComponent(order.id), key=order.id+':again', sig=JSON.stringify(order), turn=0;
    var said=el('p','salt-insight'), figs=el('div','maker-quote');
    said.setAttribute('role','status'); card.appendChild(said); card.appendChild(figs);
    /* 12 Oct 2026 (his decision 6 of 11 Oct): its figures read themselves when the order is opened, as a placed order's do, and Preview Accept again is retired */
    function againShow(result){
      said.className='salt-insight'; said.textContent='Figures read. Check them before you agree again.';
      figs.textContent=''; makerReading(figs,result,'preview');
      var old=card.querySelector('[data-accept-again]'); if(old) old.remove();
      var again=makerButton(acts,['Check and agree again','order.accept-again'],function(){
        makerAction(route+'/accept',{hash:result.hash},'Agreed again and sent to the Desk.',order.id);
      },true);
      again.setAttribute('data-accept-again',''); acts.insertBefore(again,acts.firstChild);
    }
    function againRead(){
      var mine=++turn, old=card.querySelector('[data-accept-again]'); if(old) old.remove();
      said.className='salt-insight'; said.textContent='Reading the figures.'; figs.textContent='';
      var pv=makerPv[key]; if(!pv) pv=makerPv[key]={p:refs(route+'/preview',{})};
      pv.p.then(function(result){
        if(makerPv[key]===pv) delete makerPv[key];
        if(mine!==turn||!card.isConnected) return;
        makerQuotes[key]={sig:sig,result:result}; againShow(result);
      }).catch(function(error){
        if(makerPv[key]===pv) delete makerPv[key];
        if(mine!==turn||!card.isConnected) return;
        said.className='msg'; refusal(said,error);
        makerButton(figs,['Read the figures again','order.reread'],againRead,false);
      });
    }
    return function(){ var held=makerQuotes[key]; if(held&&held.sig===sig) againShow(held.result); else againRead(); };
  }
  /* his quick replies, six at most, kept on this device under the Desk's own key; each is checked when it is sent */
  var MAKER_QUICK='saltQuickReplies';
  function makerQuick(){ try{ var a=JSON.parse(localStorage.getItem(MAKER_QUICK)||'[]'); return Array.isArray(a)?a.filter(function(x){ return typeof x==='string'&&x; }).slice(0,6):[]; }catch(e){ return []; } }
  function makerQuickKeep(text){
    var t=String(text||'').trim().replace(/[ ]+/g,' ').slice(0,200), cur=makerQuick();
    if(!t) return 'Type the line first, then save it.';
    try{
      if(cur.indexOf(t)>=0){ localStorage.setItem(MAKER_QUICK,JSON.stringify(cur.filter(function(x){ return x!==t; }))); return 'Forgotten.'; }
      localStorage.setItem(MAKER_QUICK,JSON.stringify([t].concat(cur).slice(0,6))); return 'Saved as a quick reply on this phone.';
    }catch(e){ return 'This browser would not save it.'; }
  }
  /* the Desk's reasons for Decline and Cancel; delivery only on an order to be delivered */
  var MAKER_WHY=[['stock','We do not have enough in hand this week.','Out of stock'],['place','We cannot deliver there.','Cannot deliver there'],['price','Our prices have changed.','Prices changed']];
  /* 12 Oct 2026 (Phase 2a, his decision 4 of 11 Oct): A YES OR NO ON THE ORDER CARD IS THE PAGE'S SHEET, never a native confirm. makerAsk opens
     ynOpen, the Sheet the customer's Cancel and Withdraw use, over the page: it restates the order by its mark, its code, its size and its figure,
     says what follows, and has one action that sends what the old confirm let through, with the ghost, the close control, the scrim and Escape
     sending nothing and focus going back to the control that asked (found again by its data-yn if a redraw replaced it). The request, its body
     and its request id are the caller's, untouched. q: title, say (lines), extra (nodes), go, keep, plain (not a danger action), yes. */
  function makerAskRow(order){
    var L=el('div','salt-ledger salt-ledger--plain'), r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label mlab');
    lab.appendChild(bookTile(order.product,order.qty)); lab.appendChild(el('span',null,codeByUser(order.u)));
    l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm(Number(order.total||0)+Number(order.delivery||0)))); r.appendChild(l);
    r.appendChild(el('span','salt-ledger__flag',units(order.qty)+', '+String((ORD_STAGE[order.status]||['',order.status])[1]).toLowerCase()));
    L.appendChild(r); return L;
  }
  /* the control that asks carries its data-yn from the moment it is drawn, so a card redrawn while its sheet is open still has the control to give focus back to */
  function makerAskKey(order,kind){ return 'order:'+order.id+':'+kind; }
  function makerAskTag(order,btn,kind){ btn.setAttribute('data-yn',makerAskKey(order,kind)); return btn; }
  function makerAsk(order,opener,kind,q){
    ynOpen({title:q.title, opener:opener, again:ynFind(makerAskKey(order,kind)), go:q.go, keep:q.keep, yes:q.yes,
      body:[makerAskRow(order)].concat(q.say.map(function(s){ return el('p',null,s); })).concat(q.extra||[])});
    var go=document.getElementById('ynGo');
    actOn(go,'order.ask-go',order.id); actOn(document.getElementById('ynKeep'),'order.ask-keep',order.id); actOn(document.getElementById('ynX'),'order.ask-close',order.id);
    if(q.plain) go.classList.remove('salt-ghost--danger');
  }
  /* 12 Oct 2026 (Phase 2c, his decision 4 of 11 Oct): EVERY OTHER YES OR NO ON THIS PAGE IS THE SAME SHEET, and no native confirm is left in this script. ownerAsk opens
     ynOpen and answers a promise: true when the one action is tapped, false on the ghost, the close control, the scrim, Escape or a lapse. The Sheet tells the promise it
     has come down (the shut hook) a microtask later, so the action, which runs just after it, is read first; a flow that awaits the answer carries on as it did when the
     confirm said no, and a second tap on the action finds the Sheet gone and answers nothing. key names what is asked: its opener carries it as data-yn (ynTag), so a card
     redrawn meanwhile still has the control to give focus back to, and the Sheet's three controls carry it as their data-key. q: title, row (a node restating what is
     asked), say (lines), extra (nodes), go, keep, plain (not a danger action). */
  function ynTag(btn,key){ if(btn&&btn.setAttribute) btn.setAttribute('data-yn',key); return btn; }
  /* a Sheet this page opens carries .adm beside .asheet, which is how the page's CSS places it on a tablet (the Sheets stand at the body's root, outside #roster) */
  sheetOwn=function(box){ box.classList.add('adm','asheet'); };
  function ownerAsk(opener,key,q){
    return new Promise(function(resolve){
      ynOpen({title:q.title, opener:opener, again:ynFind(key), go:q.go, keep:q.keep, yes:function(){ resolve(true); },
        shut:function(){ Promise.resolve().then(function(){ resolve(false); }); },
        body:(q.row?[q.row]:[]).concat((q.say||[]).map(function(s){ return el('p',null,s); })).concat(q.extra||[])});
      var go=document.getElementById('ynGo');
      actOn(go,'ask.go',key); actOn(document.getElementById('ynKeep'),'ask.keep',key); actOn(document.getElementById('ynX'),'ask.close',key);
      go.classList.toggle('salt-ghost--danger',q.plain!==true);
    });
  }
  /* what a Sheet restates: a mark if there is one, a label, a figure, and a line under them */
  function askRow(label,value,flag,tile){
    var L=el('div','salt-ledger salt-ledger--plain'), r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label'+(tile?' mlab':''));
    if(tile) lab.appendChild(tile);
    lab.appendChild(el('span',null,label)); l.appendChild(lab);
    if(value) l.appendChild(el('span','salt-ledger__value',value));
    r.appendChild(l); if(flag) r.appendChild(el('span','salt-ledger__flag',flag));
    L.appendChild(r); return L;
  }
  /* ---- DETAILS (PHASE 4c, 12 Oct 2026, glossary 5.2) -------------------------------------------------------------------------------------------
     An id is for quoting, not for reading. A card says who, what and how much; its reference, its moment and what else it was made from stand behind ONE Details
     control, shut, as a list of names and values (the system's plain Ledger list), never raw JSON and never a run-on line. detailBox is that control and its list
     (act and key name it); rowPairs words a Desk row's own fields, so a row's Details is the same list wherever a row is shown. */
  var ROWK={rid:'Row reference', customer:'Who', trip:'Trip', sheet:'Sheet'};
  function rowKey(k){
    if(ROWK[k]) return ROWK[k];
    if(FIELDW[k]) return FIELDW[k];
    var s=String(k).replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase(); return s.charAt(0).toUpperCase()+s.slice(1);
  }
  function rowValue(k,v){
    if(v===true||v===false) return v?'Yes':'No';
    if(typeof v==='number') return /^(qty|[a-z]+Qty|settledKg|rebateKg|coverUnits)$/.test(k)?units(v):/^(total|cash|delivery|freight|cost|settledRM|coverRM)$/.test(k)?rm(v):String(v);
    /* a value that is a book's own name is left out (the card has its mark); a name inside a sentence becomes "the book" */
    if(typeof v==='string'){ var s=noBook(v); return /^[0-9]{4}-[0-9]{2}-[0-9]{2}(T|$)/.test(v)?fmtWhen(v):(s==='The book'?'':s); }
    if(Array.isArray(v)) return v.map(function(x){ return rowValue(k,x); }).filter(function(s){ return s!==''; }).join(', ');
    if(v&&typeof v==='object') return Object.keys(v).map(function(n){ var s=rowValue(n,v[n]); return s===''?'':rowKey(n)+': '+s; }).filter(Boolean).join(', ');
    return '';
  }
  /* a Desk row as names and values, its reference first when it has one that is an id */
  function rowPairs(row,ref){
    var list=ref?[['Reference',ref]]:[];
    Object.keys(row||{}).forEach(function(k){ var v=rowValue(k,row[k]); if(v!=='') list.push([rowKey(k),v]); });
    return list;
  }
  function detailList(pairs){
    var list=el('div','salt-ledger salt-ledger--plain');
    pairs.forEach(function(p){
      if(p[1]==null||p[1]==='') return;
      var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line');
      l.appendChild(el('span','salt-ledger__label',p[0])); l.appendChild(el('span','salt-ledger__value',String(p[1]))); r.appendChild(l); list.appendChild(r);
    });
    return list;
  }
  function detailBox(act,key,pairs){
    var box=el('details','rdet');
    box.appendChild(actOn(el('summary','salt-ghost','Details'),act,key));
    box.appendChild(detailList(pairs)); return box;
  }
  /* Cancel retained input, wherever it is offered: the unsent copy on this device goes, and what the Desk server already holds does not. The opener carries its key (ynTag). */
  function retainedCancel(opener,line,done){
    ownerAsk(opener,opener.getAttribute('data-yn')||'retained',{title:'Discard this unsent entry?', say:[line], go:'Discard it', keep:'Keep it'})
      .then(function(yes){ if(yes) done(); });
  }
  /* the reason a Decline or a Cancel gives the customer, optional: the Desk's lines as the system's Option tiles (the place line only on an order to be
     delivered) and a field for his own words; a tile fills the field, typing clears the pick. note() is what rides with the request. */
  function makerWhy(order){
    var set=el('fieldset','salt-options'), grid=el('div','salt-options__grid'), wrap=el('label','salt-field'), field=el('input','salt-field__input');
    set.appendChild(el('legend','salt-options__legend','Tell them why (optional)'));
    MAKER_WHY.filter(function(w){ return w[0]!=='place'||order.mode==='deliver'; }).forEach(function(w){
      var label=el('label','salt-option'), radio=el('input','salt-option__input'), face=el('span','salt-option__face');
      radio.type='radio'; radio.name='makerWhy-'+order.id; radio.value=w[0]; actOn(radio,'order.reason-'+w[0],order.id);
      radio.addEventListener('change',function(){ field.value=w[1]; });
      face.appendChild(el('span','salt-option__label',w[2])); label.appendChild(radio); label.appendChild(face); grid.appendChild(label);
    });
    set.appendChild(grid);
    field.type='text'; actOn(field,'order.reason',order.id);
    field.addEventListener('input',function(){ [].forEach.call(grid.querySelectorAll('input'),function(r){ r.checked=false; }); });
    wrap.appendChild(el('span','salt-field__label','Or in your own words')); wrap.appendChild(field);
    return {nodes:[set,wrap], note:function(){ var v=field.value.trim(); return v?{note:v}:{}; }};
  }
  /* replyOnly is a closed order: only his answer to their question, and no Decline, Cancel or reason */
  function makerOrderMoves(card,order,replyOnly,acts){
    /* 15 Oct 2026: their last line stands above the reply, so the field has something to answer (the card drew no line of theirs before; Needs you did) */
    var theirs=((order&&order.msgs)||[]).filter(function(m){ return m.by==='customer'&&m.text; }).slice(-1)[0];
    if(theirs) card.appendChild(el('p','maker-facts','They wrote, '+fmtWhen(theirs.at)+': '+theirs.text));
    var said=makerField(card,['Answer them','order.reply-text'],'text','');
    makerQuick().forEach(function(line,i){
      makerButton(card,[line,'order.quick-reply',i],function(){ said.value=line; keepWord(); },false).setAttribute('data-quick','');
    });
    var keep=makerButton(card,['Save this line','order.quick-keep'],function(){
      makerSay(order.id,makerQuickKeep(said.value));
      keepWord();
    },false);
    keep.setAttribute('data-keep','');
    function keepWord(){ var t=said.value.trim().replace(/[ ]+/g,' '); keep.textContent=t&&makerQuick().indexOf(t)>=0?'Forget it':'Save this line'; }
    said.addEventListener('input',keepWord);
    makerButton(card,['Send','order.reply'],function(){
      if(!said.value.trim()) return;
      makerMove(order,{message:said.value.trim()},'Reply sent.');
    },false);
    makerButton(card,['No reply needed','order.no-reply'],function(){ makerMove(order,{noReply:true},'No reply needed recorded.'); },false);
    /* his decision 4 of 11 Oct 2026: a Decline or a Cancel asks on the page's Sheet, and the reason is asked there, on tiles */
    if(order.status==='placed'){
      var dec=makerButton(acts,['Decline','order.decline'],function(){
        var why=makerWhy(order);
        makerAsk(order,dec,'decline',{title:'Decline this order?', go:'Decline the order', keep:'Keep the order', extra:why.nodes,
          say:['It is declined and goes no further. The customer is told, with your reason if you give one.'],
          yes:function(){ makerMove(order,Object.assign({status:'declined'},why.note()),'Order declined.'); }});
      },false);
      makerAskTag(order,dec,'decline');
    }else if((order.status==='acknowledged'||order.status==='ready')&&!order.closed&&!(+order.claimed>0)&&!(+order.moved>0)){
      var can=makerButton(acts,['Cancel','order.cancel'],function(){
        var why=makerWhy(order);
        makerAsk(order,can,'cancel',{title:'Cancel this order?', go:'Cancel the order', keep:'Keep the order', extra:why.nodes,
          say:[+order.paid>0?rm(+order.paid)+' is paid on it, so a refund to the customer opens for you to return.':'Nothing is paid on it.'],
          yes:function(){ makerMove(order,Object.assign({status:'cancelled'},why.note()),'Order cancelled.'); }});
      },false);
      makerAskTag(order,can,'cancel');
    }else if((order.status==='acknowledged'||order.status==='ready')&&!order.closed&&!(+order.claimed>0)&&+order.moved>0&&+order.moved<+order.qty-0.0004){
      /* his answer of 17 Oct 2026: A CANCEL ONCE GOODS ARE OUT CANCELS THE REST. The order closes at what was handed over, the Desk restating its total
         (the close Finish at fewer units sends), and anything paid above that opens as a refund */
      var rest=makerButton(acts,['Cancel the rest','order.cancel-rest'],function(){
        var n=+(+order.moved).toFixed(3);
        makerAsk(order,rest,'cancel-rest',{title:'Cancel the rest of this order?', go:'Cancel the rest', keep:'Keep the order',
          say:['The order ends at the '+units(n)+' handed over, and the Desk restates its total. Anything they paid above it opens as a refund for you to return.'],
          yes:function(){ makerTap(order,'handed',{qty:n,close:true},'Sent to the Desk: the order ends at what was handed over.'); }});
      },false);
      makerAskTag(order,rest,'cancel-rest');
    }
  }
  /* PHASE 1c (11 Oct 2026): RECORD'S FORMS ARE A MENU. Entry, Customers and Pricing each list their forms by name, a row of the system's
     Inbox row for each, and a row opens that form alone with a way back. The forms are the sections they were, moved and never drawn
     again: what is typed in one, its retained send and its request ids are kept by closing it, as by opening another. A retained input
     stays on the menu, above the rows. */
  function formSlug(name){ return String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function recordMenu(box,note){
    fOpen=null;
    var back=el('button','aback','← Entry'); back.type='button'; back.id='makerFormBack'; back.setAttribute('data-back','form'); back.setAttribute('data-formback','');
    back.setAttribute('data-in','record.entry record.customers record.pricing'); actOn(back,'record.form-back');
    box.insertBefore(back,note.nextSibling);
    var menu=el('div','formmenu'), lists={}, anchor=back;
    menu.id='makerMenu'; menu.setAttribute('data-formmenu','');
    ['entry','customers','pricing'].forEach(function(part){
      var list=el('div','formlist'); list.setAttribute('data-in','record.'+part); lists[part]=list; menu.appendChild(list);
    });
    [].slice.call(box.children).forEach(function(n){ if(n.hasAttribute('data-formmenu')) anchor=n; });
    box.insertBefore(menu,anchor.nextSibling);
    [].slice.call(box.querySelectorAll('section.maker-input')).forEach(function(form){
      if(form.hasAttribute('data-formmenu')) return;
      var name=form.querySelector('h3').textContent, slug=formSlug(name), part=form.getAttribute('data-in').replace('record.','');
      form.setAttribute('data-form',slug);
      var row=el('button','salt-inbox-row formrow'), main=el('span','salt-inbox-row__main'), title=el('span','salt-inbox-row__title');
      row.type='button'; actOn(row,'record.form',slug);
      title.appendChild(el('span',null,name)); main.appendChild(title);
      row.appendChild(main);
      row.addEventListener('click', function(){ openForm(slug); });
      lists[part].appendChild(row);
    });
    /* PHASE 4a (12 Oct 2026): THE FORM OPEN IS A PANE. The retained input and the menu are one column and the forms the pane beside it, moved into
       them and never drawn again; the grid is one column below 860px, where the form takes the menu's place and has its way back. */
    var grid=el('div','recgrid'), list=el('div','reclist'), pane=el('div','recpane');
    grid.id='makerFormGrid'; pane.appendChild(el('p','rnone recnone','Choose a form to open it here.'));
    grid.appendChild(list); grid.appendChild(pane); box.insertBefore(grid,back.nextSibling);
    [].slice.call(box.children).forEach(function(n){
      if(n.hasAttribute('data-formmenu')) list.appendChild(n); else if(n.hasAttribute('data-form')) pane.appendChild(n);
    });
    applyRepay(); applyAmend();
  }
  function openForm(slug){
    var form=document.querySelector('#makerInputs [data-form="'+slug+'"]');
    if(!form) return;
    fOpen=slug; sweep();
    /* below 860px the form takes the menu's place and has its way back showing, so he is taken to the top of it; from 860px the menu is the
       page's scroll and the form stands beside it, so a tap on a low row only brings the pane into view */
    try{
      var back=document.getElementById('makerFormBack'), tab=document.querySelector('.aparts[data-place="record"] [data-part="'+partNow+'"]');
      back.textContent='← '+(tab?tab.textContent:'Back'); back.focus();
      if(window.getComputedStyle(back).display!=='none') window.scrollTo(0,0);
      else { var pane=form.parentNode; if(pane&&pane.scrollIntoView) pane.scrollIntoView({block:'nearest'}); }
    }catch(x){}
  }
  function closeForm(){
    var was=fOpen; fOpen=null; sweep();
    try{ var row=was&&document.querySelector('#makerMenu [data-act="record.form"][data-key="'+was+'"]'); if(row&&row.focus) row.focus(); }catch(x){}
  }
  async function loadMakerInputs(){
    var box=document.getElementById('makerInputs'); if(!box||box.hasAttribute('data-read')) return; box.setAttribute('data-read','');
    var note=el('p','msg','Reading.'); note.setAttribute('role','status'); box.appendChild(note);
    try{
      var context=await refs('/all/maker/inputs');
      makerRecovery(box);
      if(!Array.isArray(context.products)||!context.products.length) throw new Error('The Desk is not ready. Try again in a minute.');
      note.remove();
      var countFrom=box.children.length;
      var product=makerTilesIn(box,['Book','record.count.book'],context.products.map(bookItem));
      var date=makerField(box,['Counted on','record.count.date'],'date',''), qty=makerField(box,['Units on the shelf','record.count.units'],'number','', '0.01');
      var pending=false, at=null, signature='', answer=el('p','msg'); answer.setAttribute('role','status'); box.appendChild(answer);
      var button=makerButton(box,['Record the count','record.count.send'],async function(send){
        if(pending) return;
        var body={product:product.value,date:date.value,qty:qty.value===''?null:Number(qty.value)};
        var now=JSON.stringify(body); if(now!==signature){ signature=now; at=new Date().toISOString(); }
        body.at=at; pending=true; button.disabled=true; answer.textContent='Recording.';
        try{ await send('/all/maker/inputs/stock-count',body); answer.textContent='Recorded. It waits under Approve.'; loadMaker(); }
        catch(error){ refusal(answer,error); }
        pending=false; button.disabled=false;
      },true,function(){ at=null; signature=''; });
      /* the count's controls, moved into a form of their own so that Entry's menu can name it (Phase 1c) */
      var countForm=makerForm('entry'); countForm.appendChild(el('h3',null,'Stock count'));
      [].slice.call(box.children,countFrom).forEach(function(n){ countForm.appendChild(n); });
      box.appendChild(countForm);
      var catalog=context.catalog||{}, tradeSection=makerForm('entry');
      tradeSection.appendChild(el('h3',null,'Sale or purchase'));
      tradeSection.appendChild(el('p','msg','Goods and delivery are entered separately.'));
      box.appendChild(tradeSection);
      var direction=makerTilesIn(tradeSection,['Sale or purchase','record.trade.direction'],[{value:'sale',label:'Sale'},{value:'purchase',label:'Purchase'}]);
      var tradeProduct=makerTilesIn(tradeSection,['Book','record.trade.book'],[]), tradeParty=actOn(el('select','fld salt-field__input'),'record.trade.party');
      var partyLabel=el('label','maker-field','Who');
      partyLabel.appendChild(tradeParty);
      tradeSection.appendChild(partyLabel);
      var tradeDate=makerField(tradeSection,['Date','record.trade.date'],'date',''), tradeQty=makerField(tradeSection,['Units','record.trade.units'],'number','1','0.01');
      var tradeTotal=makerField(tradeSection,['Price (goods)','record.trade.total'],'number','','0.01');
      var tradeCash=makerField(tradeSection,['Cash received','record.trade.cash'],'number','0','0.01');
      var tradeMoved=makerField(tradeSection,['Units handed over','record.trade.moved'],'number','0','0.01');
      var handover=makerTilesIn(tradeSection,['Handover','record.trade.handover'],[{value:'',label:'Not yet'},{value:'collected',label:'Collected'},{value:'delivered',label:'Delivered'}]);
      var carriage=makerField(tradeSection,['Delivery','record.trade.delivery'],'number','0','0.01');
      var attribution=el('div','maker-trade-attribution');
      var tradeStream=makerTilesIn(attribution,['Through an associate?','record.trade.stream'],[{value:'',label:'No'},{value:'R2',label:'They resell'},{value:'R3',label:'They introduced the buyer'}]);
      var tradeAssoc=actOn(el('select','fld salt-field__input'),'record.trade.associate'), tradeDown=actOn(el('select','fld salt-field__input'),'record.trade.end-customer');
      var assocLabel=el('label','maker-field','Which associate'), downLabel=el('label','maker-field','Their customer (optional)');
      assocLabel.appendChild(tradeAssoc); downLabel.appendChild(tradeDown);
      attribution.appendChild(assocLabel); attribution.appendChild(downLabel);
      var attributionNote=el('p','msg'); attribution.appendChild(attributionNote); tradeSection.appendChild(attribution);
      function fillAttribution(){
        var isSale=direction.value==='sale', stream=isSale?tradeStream.value:'', r2=stream==='R2', kept=tradeAssoc.value;
        attribution.hidden=!isSale; assocLabel.hidden=!stream; downLabel.hidden=!r2;
        partyLabel.hidden=r2;
        partyLabel.firstChild.textContent=stream==='R3'?'Buyer':'Who';
        tradeAssoc.textContent='';
        var none=el('option',null,'Choose an associate'); none.value=''; tradeAssoc.appendChild(none);
        (catalog.associates||[]).filter(function(item){return !r2||item.resaleReady;}).forEach(function(item){
          var option=el('option',null,item.code); option.value=item.code; tradeAssoc.appendChild(option);
        });
        if(Array.from(tradeAssoc.options).some(function(option){return option.value===kept;}))tradeAssoc.value=kept;
        attributionNote.textContent=r2
          ?'A resale books to the associate’s own account.'
          :stream==='R3'?'The sale books to the buyer; the associate is credited with the introduction.':'';
      }
      var unnamed=el('option',null,'Not named'); unnamed.value=''; tradeDown.appendChild(unnamed);
      (catalog.parties||[]).filter(function(code){return !/[-]R$/.test(code);}).forEach(function(code){
        var option=el('option',null,code); option.value=code; tradeDown.appendChild(option);
      });
      tradeStream.addEventListener('change',fillAttribution);
      var coverChoices=[];
      function coverChoice(root,bookControl,unitsControl,goodsControl,acts){
        /* 11 Oct 2026: a read never collapses a box it has shown (a tap on Send after typing blurs the field, the change
           re-reads, and a box that hid moved Send up before the finger lifted: no click). Only an answer of no cover hides it;
           a failed read keeps it, dead, with its note and a Read cover again beside it. */
        var row=el('div','maker-cover-row'), wrap=el('label','maker-cover'), check=actOn(el('input'),acts[0]), words=el('span'),
          retry=actOn(el('button','salt-ghost','Read again'),acts[1]), note=el('p','msg'), revision=0;
        check.type='checkbox';check.setAttribute('data-reward-cover','');check.disabled=true;retry.type='button';retry.hidden=true;
        wrap.hidden=true;wrap.appendChild(check);wrap.appendChild(words);row.appendChild(wrap);row.appendChild(retry);
        root.appendChild(row);root.appendChild(note);
        async function readCoverChoice(){
          var ticket=++revision;check.checked=false;check.disabled=true;retry.hidden=true;note.textContent='';
          if(direction.value!=='sale'||tradeStream.value==='R2'||goodsControl.value===''||!(Number(unitsControl.value)>0)){wrap.hidden=true;return;}
          if(wrap.hidden)note.textContent='Reading.';else words.textContent='Checking.';
          try{
            var result=await refs('/all/maker/trade-cover',{product:bookControl.value,party:tradeParty.value,
              qty:Number(unitsControl.value),total:Number(goodsControl.value),stream:tradeStream.value||null});
            if(ticket!==revision||!root.isConnected)return;
            note.textContent='';
            if(result.cover){
              words.textContent='Use '+units(result.cover.units)+' of their reward: '+rm(result.cover.rm)+' off (they hold '+units(result.cover.free)+')';
              check.disabled=false;wrap.hidden=false;
            }else wrap.hidden=true;
          }catch(error){
            if(ticket===revision){words.textContent='Reward not read';wrap.hidden=false;retry.hidden=false;refusal(note,error);}
          }
        }
        retry.addEventListener('click',readCoverChoice);
        var choice={check:check,read:readCoverChoice};coverChoices.push(choice);
        [bookControl,unitsControl,goodsControl,tradeParty,tradeStream,direction].forEach(function(control){
          control.addEventListener('input',readCoverChoice);control.addEventListener('change',readCoverChoice);
        });
        return choice;
      }
      var firstCover=coverChoice(tradeSection,tradeProduct,tradeQty,tradeTotal,['record.trade.cover','record.trade.cover-retry']);
      /* B1 of #62: what the Workbench shows before Record, shown before Send (the Desk reads it from the same engine: cost a unit,
         the goods, the margin over it, the floor and a refusal-style line when the goods are under it, their recent prices).
         A purchase shows its cost a unit against the current cost and no margin. It is a read; Send is never held by it. */
      var readingBox=el('div','maker-reading'), readingRevision=0;
      readingBox.setAttribute('aria-live','polite'); readingBox.hidden=true; tradeSection.appendChild(readingBox);
      function readingLine(text,bad){ var p=el('p',bad?'msg bad':'msg',text); readingBox.appendChild(p); return p; }
      async function readTrade(){
        var ticket=++readingRevision, isSale=direction.value==='sale';
        readingBox.textContent='';
        if(!(Number(tradeQty.value)>0)||tradeTotal.value===''||!tradeProduct.value){readingBox.hidden=true;return;}
        readingBox.hidden=false; readingLine('Reading.');
        var ask={direction:direction.value,product:tradeProduct.value,qty:Number(tradeQty.value),total:Number(tradeTotal.value)};
        if(tradeDate.value)ask.date=tradeDate.value;
        if(isSale){ if(tradeParty.value&&tradeStream.value!=='R2')ask.party=tradeParty.value; }
        else if(carriage.value!=='')ask.freight=Number(carriage.value);
        try{
          var got=(await refs('/all/maker/trade-reading',ask)).reading;
          if(ticket!==readingRevision||!readingBox.isConnected)return;
          readingBox.textContent='';
          var c=got.cogs||{};
          readingLine(c.rate==null?'No cost to read against.':'Cost a unit '+rm(c.rate)+', from '+c.source+'.');
          if(!isSale){
            if(got.purchase.versusCogs!=null)readingLine('This buy costs '+rm(got.purchase.perUnit)+' a unit, '+(got.purchase.versusCogs>=0?rm(got.purchase.versusCogs)+' above':rm(-got.purchase.versusCogs)+' under')+' the current cost.');
            return;
          }
          if(got.margin)readingLine('Goods '+rm(got.goods)+', '+rm(got.price)+' a unit: margin '+rm(got.margin.rm)+(got.margin.pct==null?'':' ('+Math.round(got.margin.pct)+'%)')+' over cost.',got.margin.belowCost);
          if(got.margin&&got.margin.belowCost&&!(got.floor&&got.floor.warn))readingLine('Below cost: every unit loses '+rm(c.rate-got.price)+'.',true);
          if(got.floor){
            readingLine('Floor '+rm(got.floor.rm)+' for '+units(got.qty)+', cost times the size.');
            if(got.floor.warn)readingLine(got.floor.warn,true);
          }
          var h=got.history;
          if(h)readingLine('Their usual '+rm(h.median)+' a unit over '+h.count+' order'+(h.count===1?'':'s')+', '+rm(h.low)+' to '+rm(h.high)
            +(h.offMedianPct==null?'':'; this is '+(h.offMedianPct>=0?h.offMedianPct+'% above':(-h.offMedianPct)+'% below'))+'. Recent: '
            +h.recent.map(function(r){return rm(r.rate);}).join(', ')+'.');
          else if(ask.party)readingLine('No earlier price of theirs on this book.');
        }catch(error){
          if(ticket===readingRevision){readingBox.textContent='';refusal(readingLine('',true),error,'Reading not available. ');}
        }
      }
      [direction,tradeProduct,tradeQty,tradeTotal,carriage,tradeParty,tradeStream,tradeDate].forEach(function(control){
        control.addEventListener('input',readTrade);control.addEventListener('change',readTrade);
      });
      var extraBooks=el('div','maker-extra-books'), extraTrades=[], extraSeq=0;
      tradeSection.appendChild(extraBooks);
      var tripNote=el('p','msg','Same buyer, same day; delivery charged once; approved in one tap.');
      tradeSection.appendChild(tripNote);
      function extraChoices(tiles){
        tiles.fill((catalog.products||[]).filter(function(item){
          return item.product!==tradeProduct.value&&(direction.value==='sale'?item.saleReady:item.purchaseReady);
        }).map(function(item){ return bookItem(item.product); }));
      }
      makerButton(tradeSection,['Another book on this visit','record.trade.add-book'],function(){
        var row=el('section','maker-extra-trade'); row.setAttribute('data-key','extra'+(++extraSeq)); row.appendChild(el('h4',null,'Another book'));
        var select=makerTilesIn(row,['Book','record.trade.extra-book'],[]); extraChoices(select);
        var extra={row:row,product:select,qty:makerField(row,['Units','record.trade.extra-units'],'number','1','0.01'),
          total:makerField(row,['Price (goods)','record.trade.extra-total'],'number','','0.01'),
          cash:makerField(row,['Cash received','record.trade.extra-cash'],'number','0','0.01'),
          movedUnits:makerField(row,['Units handed over','record.trade.extra-moved'],'number','0','0.01')};
        extraTrades.push(extra); extraBooks.appendChild(row);
        extra.cover=coverChoice(row,select,extra.qty,extra.total,['record.trade.extra-cover','record.trade.extra-cover-retry']);
        makerButton(row,['Remove','record.trade.remove-book'],function(){
          extraTrades.splice(extraTrades.indexOf(extra),1);coverChoices.splice(coverChoices.indexOf(extra.cover),1);row.remove();
        },false);
      },false);
      var tradeAnswer=el('p','msg'); tradeAnswer.setAttribute('role','status'); tradeSection.appendChild(tradeAnswer);
      var tradePending=false, tradeAt=null, tradeSignature='';
      function fillTradeChoices(){
        var isSale=direction.value==='sale';
        var keptParty=tradeParty.value;
        tradeProduct.fill((catalog.products||[]).filter(function(item){ return isSale?item.saleReady:item.purchaseReady; }).map(function(item){ return bookItem(item.product); }));
        tradeParty.textContent='';
        (catalog.parties||[]).forEach(function(code){
          var option=el('option',null,code); option.value=code; tradeParty.appendChild(option);
        });
        if(Array.from(tradeParty.options).some(function(option){return option.value===keptParty;}))tradeParty.value=keptParty;
        carriage.parentNode.querySelector('.lbl').textContent=isSale?'Delivery':'Freight';
        extraTrades.forEach(function(extra){extraChoices(extra.product);});
        fillAttribution();
        coverChoices.forEach(function(choice){choice.read();});
        readTrade();
      }
      async function refreshMakerTradeCatalog(){
        var refreshed=await refs('/all/maker/inputs');
        if(!refreshed.catalog||!Array.isArray(refreshed.catalog.parties))
          throw new Error('The Desk is not ready. Try again in a minute.');
        catalog=refreshed.catalog;
        fillTradeChoices();
      }
      direction.addEventListener('change',fillTradeChoices);
      tradeProduct.addEventListener('change',function(){
        extraTrades.forEach(function(extra){extraChoices(extra.product);});
        coverChoices.forEach(function(choice){choice.read();});
      });
      fillTradeChoices();
      async function submitTrade(confirmedTwin,send){
        if(tradePending) return;
        var isSale=direction.value==='sale';
        var body={product:tradeProduct.value,party:tradeParty.value,date:tradeDate.value,
          qty:tradeQty.value===''?null:Number(tradeQty.value),total:tradeTotal.value===''?null:Number(tradeTotal.value),
          cash:tradeCash.value===''?null:Number(tradeCash.value),movedUnits:tradeMoved.value===''?null:Number(tradeMoved.value),
          handover:handover.value||null};
        body[isSale?'delivery':'freight']=carriage.value===''?null:Number(carriage.value);
        if(isSale&&firstCover.check.checked)body.cover=true;
        if(isSale&&tradeStream.value){
          if(!tradeAssoc.value){tradeAnswer.textContent='Choose an associate first.';return;}
          body.assoc=tradeAssoc.value; body.stream=tradeStream.value;
          if(body.stream==='R2'){body.party=body.assoc;body.downstream=tradeDown.value||null;}
        }
        if(extraTrades.length) body.extras=extraTrades.map(function(extra){
          var input={product:extra.product.value,qty:extra.qty.value===''?null:Number(extra.qty.value),
            total:extra.total.value===''?null:Number(extra.total.value),cash:extra.cash.value===''?null:Number(extra.cash.value),
            movedUnits:extra.movedUnits.value===''?null:Number(extra.movedUnits.value)};
          if(isSale&&extra.cover.check.checked)input.cover=true;
          return input;
        });
        if(confirmedTwin) Object.keys(confirmedTwin).forEach(function(index){
          if(Number(index)===0)body.second=confirmedTwin[index];
          else if(body.extras&&body.extras[Number(index)-1])body.extras[Number(index)-1].second=confirmedTwin[index];
        });
        var check=JSON.stringify(body);
        if(check!==tradeSignature){ tradeSignature=check; tradeAt=new Date().toISOString(); }
        body.at=tradeAt;
        tradePending=true; tradeAnswer.textContent='Sending.';
        try{
          var result=await send('/all/maker/inputs/'+direction.value,body);
          tradeAnswer.textContent='Sent. It waits under Approve.';
          loadMaker();
        }catch(error){
          refusal(tradeAnswer,error);
          var twin=error.detail&&error.detail.twin&&error.detail.twin.second;
          var index=error.detail&&error.detail.twin&&error.detail.twin.index||0;
          if(twin&&!(confirmedTwin&&confirmedTwin[index])&&await ownerAsk(send.button,'twin:trade',{title:'Record this '+direction.value+' again?', say:['You already recorded a '+direction.value+' like this'+(tradeDate.value?' on '+fmtWhen(tradeDate.value):'')+'. Record it again as a separate '+direction.value+'?'], go:'Record it again', keep:'Do not record', plain:true})){
            var confirmations=Object.assign({},confirmedTwin||{}); confirmations[index]=twin;
            tradeSignature=''; tradePending=false; await submitTrade(confirmations,send); return;
          }
        }
        tradePending=false;
      }
      var tradeSend=makerButton(tradeSection,['Send the sale','record.trade.send'],function(send){ return submitTrade(null,send); },true,function(){
        tradeAt=null;tradeSignature='';coverChoices.forEach(function(choice){choice.read();});
      });
      direction.addEventListener('change',function(){ tradeSend.textContent='Send the '+direction.value; });
      var tierSection=makerForm('pricing');
      tierSection.appendChild(el('h3',null,'Price level'));
      tierSection.appendChild(el('p','msg','Set the level a customer is priced at, or let the Desk suggest one.'));
      tradeSection.parentNode.insertBefore(tierSection,tradeSection.nextSibling);
      var tierCodes=catalog.tierCustomers||[], tierBooks=(catalog.products||[]).filter(function(item){ return item.tiered; });
      if(!tierCodes.length||!tierBooks.length||!(catalog.tierNames||[]).length){
        tierSection.appendChild(el('p','msg','No customer has a level to set.'));
      }else{
        var tierCode=actOn(el('select','fld salt-field__input'),'record.tier.customer'), tierCodeWrap=el('label','maker-field','Customer');
        tierCodes.forEach(function(code){ var option=el('option',null,code); option.value=code; tierCode.appendChild(option); });
        tierCodeWrap.appendChild(tierCode); tierSection.appendChild(tierCodeWrap);
        var tierProduct=makerTilesIn(tierSection,['Book','record.tier.book'],tierBooks.map(function(item){ return bookItem(item.product); }));
        var tierValue=makerTilesIn(tierSection,['Level','record.tier.level'],[['','Let the Desk decide']].concat((catalog.tierNames||[]).map(function(name){ return [name,name]; }),[['__bands','A level by order size']])
          .map(function(item){ return {value:item[0],label:item[1]}; }));
        var bandBox=el('div','maker-bands'), bandSel={};
        bandBox.hidden=true;
        [['small','Small sizes'],['mid','Mid sizes'],['big','Big sizes']].forEach(function(item){
          bandSel[item[0]]=makerTilesIn(bandBox,[item[1],'record.tier.band-'+item[0]],(catalog.tierNames||[]).map(function(name){ return {value:name,label:name}; }));
        });
        tierSection.appendChild(bandBox);
        var tierState=el('p','msg'), useProposal=actOn(el('button','salt-ghost','Use the suggestion'),'record.tier.use-proposal'), useOffer=actOn(el('button','salt-ghost','Use the late-payer level'),'record.tier.use-offer');
        useProposal.type='button'; useOffer.type='button';
        tierSection.appendChild(tierState); tierSection.appendChild(useProposal); tierSection.appendChild(useOffer);
        function tierPut(level){
          if(level&&typeof level==='object'){ tierValue.value='__bands'; ['small','mid','big'].forEach(function(k){ if(level[k]) bandSel[k].value=level[k]; }); }
          else tierValue.value=level||'';
          bandBox.hidden=tierValue.value!=='__bands';
        }
        function tierCardOf(){
          return (catalog.tierCards||[]).filter(function(c){ return c.code===tierCode.value&&c.product===tierProduct.value; })[0]||null;
        }
        function tierSay(level){
          return typeof level==='string'?level:['small','mid','big'].map(function(k){ return k+' '+level[k]; }).join(', ');
        }
        function tierRefresh(){
          var c=tierCardOf(), lines=[];
          if(c&&c.held) lines.push('Now: '+tierSay(c.held)+'.');
          else if(c&&c.proposed) lines.push('Suggested: '+tierSay(c.proposed)+', not applied.');
          else lines.push('No level set or suggested.');
          if(c&&c.late) lines.push('Late payer: suggested '+c.late.level+(c.late.why?', '+noBook(c.late.why):'')+'.');
          tierState.textContent=lines.join(' ');
          useProposal.hidden=!(c&&(c.proposed||c.held)); useOffer.hidden=!(c&&c.late);
        }
        tierValue.addEventListener('change',function(){ bandBox.hidden=tierValue.value!=='__bands'; });
        tierCode.addEventListener('change',tierRefresh); tierProduct.addEventListener('change',tierRefresh);
        useProposal.onclick=function(){ var c=tierCardOf(); if(c) tierPut(c.proposed||c.held); };
        useOffer.onclick=function(){ var c=tierCardOf(); if(c&&c.late) tierPut(c.late.level); };
        tierRefresh();
        var tierAnswer=el('p','msg'); tierAnswer.setAttribute('role','status'); tierSection.appendChild(tierAnswer);
        var tierPending=false, tierAt=null, tierSignature='';
        makerButton(tierSection,['Send the level','record.tier.send'],async function(send){
          if(tierPending) return;
          var level=tierValue.value==='__bands'?{small:bandSel.small.value,mid:bandSel.mid.value,big:bandSel.big.value}:(tierValue.value||null);
          var body={code:tierCode.value,product:tierProduct.value,tier:level};
          var check=JSON.stringify(body); if(check!==tierSignature){ tierSignature=check; tierAt=new Date().toISOString(); }
          body.at=tierAt; tierPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); tierAnswer.textContent='Sent. The level changes once you approve it.'; loadMaker(); }
          catch(error){ refusal(tierAnswer,error); }
          tierPending=false;
        },true,function(){ tierAt=null; tierSignature=''; });
        /* A1: the Desk's Accept all. The Desk reads its own proposals; held tiers and tiers already waiting are left alone.
           Each new Accept is its own request; a retry is the button's retained request, which keeps the id it was sent under. */
        var allAnswer=el('p','msg'); allAnswer.setAttribute('role','status'); tierSection.appendChild(allAnswer);
        var allPending=false;
        makerButton(tierSection,['Accept every suggestion','record.tier.accept-all'],async function(send){
          if(allPending) return;
          allPending=true;
          try{ await send('/all/maker/inputs/tier-accept-all',{at:new Date().toISOString()});
            allAnswer.textContent='Sent. Levels already set do not change.'; loadMaker(); }
          catch(error){ refusal(allAnswer,error); }
          allPending=false;
        },false);
      }
      var driftSection=makerForm('pricing');
      driftSection.appendChild(el('h3',null,'Price drift'));
      driftSection.appendChild(el('p','msg','Only on a book with price drift. Moves one customer’s price up (+) or down (-); 0 fixes it at the set price; Clear lets it follow their record.'));
      tradeSection.parentNode.insertBefore(driftSection,tierSection.nextSibling);
      var driftCodes=catalog.driftCustomers||[], driftBooks=(catalog.products||[]).filter(function(item){ return item.drift; });
      if(!driftCodes.length||!driftBooks.length){
        driftSection.appendChild(el('p','msg','No customer has a drift to set.'));
      }else{
        var driftCode=actOn(el('select','fld salt-field__input'),'record.drift.customer'), driftCodeWrap=el('label','maker-field','Customer');
        driftCodes.forEach(function(code){ var option=el('option',null,code); option.value=code; driftCode.appendChild(option); });
        driftCodeWrap.appendChild(driftCode); driftSection.appendChild(driftCodeWrap);
        var driftProduct=makerTilesIn(driftSection,['Book','record.drift.book'],driftBooks.map(function(item){ return bookItem(item.product); }));
        var driftValue=makerField(driftSection,['Drift, -1 to +1','record.drift.value'],'number','','0.05');
        driftValue.min='-1'; driftValue.max='1';
        var driftState=el('p','msg'); driftSection.appendChild(driftState);
        var driftAnswer=el('p','msg'); driftAnswer.setAttribute('role','status'); driftSection.appendChild(driftAnswer);
        var driftPending=false, driftAt=null, driftSignature='';
        function driftReceiptComplete(){ driftAt=null; driftSignature=''; }
        function driftCardOf(){
          return (catalog.driftCards||[]).filter(function(card){ return card.code===driftCode.value&&card.product===driftProduct.value; })[0]||null;
        }
        function driftFormat(value){ return (value>=0?'+':'')+Number(value).toFixed(2); }
        function driftRefresh(){
          var card=driftCardOf();
          if(card&&card.held) driftState.textContent='Set by hand: '+driftFormat(card.value)+' (scale -1 to +1).';
          else if(card&&typeof card.current==='number') driftState.textContent='From their record: '+driftFormat(card.current)+'.';
          else driftState.textContent='From their record. No drift is read yet.';
          clearDrift.hidden=!(card&&card.held);
        }
        driftCode.addEventListener('change',driftRefresh); driftProduct.addEventListener('change',driftRefresh);
        var driftActions=el('div','maker-drift-actions'); driftSection.appendChild(driftActions);
        makerButton(driftActions,['Send the drift','record.drift.set'],async function(send){
          if(driftPending) return;
          var raw=driftValue.value.trim(), value=Number(raw);
          if(!raw||!Number.isFinite(value)||value < -1||value > 1){
            driftAnswer.textContent='Enter a drift from -1 to +1.';
            return;
          }
          value=Number(value.toFixed(2));
          var body={code:driftCode.value,product:driftProduct.value,tier:value};
          var check=JSON.stringify(body); if(check!==driftSignature){ driftSignature=check; driftAt=new Date().toISOString(); }
          body.at=driftAt; driftPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); driftAnswer.textContent='Sent. The drift changes once you approve it.'; loadMaker(); }
          catch(error){ refusal(driftAnswer,error); }
          driftPending=false;
        },true,driftReceiptComplete);
        var clearDrift=makerButton(driftActions,['Follow their record','record.drift.clear'],async function(send){
          if(driftPending) return;
          var body={code:driftCode.value,product:driftProduct.value,tier:null};
          var check=JSON.stringify(body); if(check!==driftSignature){ driftSignature=check; driftAt=new Date().toISOString(); }
          body.at=driftAt; driftPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); driftAnswer.textContent='Sent. Their price follows their record once you approve it.'; loadMaker(); }
          catch(error){ refusal(driftAnswer,error); }
          driftPending=false;
        },false,driftReceiptComplete);
        driftRefresh();
      }
      /* B2 of #62: the Desk's Make partner. A partner pays cost; Approve is the confirmation, and a name never travels. Drift books only. */
      var partnerSection=makerForm('pricing');
      partnerSection.appendChild(el('h3',null,'Partner'));
      partnerSection.appendChild(el('p','msg','A partner pays cost on every book and is an associate. Only on a book with price drift.'));
      driftSection.parentNode.insertBefore(partnerSection,driftSection.nextSibling);
      var partnerHeld=catalog.partners||[], partnerWait=catalog.partnerWaiting||[];
      var partnerCodes=(catalog.driftCustomers||[]).filter(function(c){ return /^C/.test(c)&&!/-Gen$/.test(c)&&partnerHeld.indexOf(c)<0&&partnerWait.indexOf(c)<0; });
      if(!(catalog.products||[]).some(function(item){ return item.drift; })){
        partnerSection.appendChild(el('p','msg','No book has price drift.'));
      }else{
        if(partnerHeld.length) partnerSection.appendChild(el('p','msg','Partner now: '+partnerHeld.join(', ')+'.'));
        if(partnerWait.length) partnerSection.appendChild(el('p','msg','Waiting under Approve: '+partnerWait.join(', ')+'.'));
        if(!partnerCodes.length){
          partnerSection.appendChild(el('p','msg','No customer is left to make a partner.'));
        }else{
          var partnerCode=actOn(el('select','fld salt-field__input'),'record.partner.customer'), partnerCodeWrap=el('label','maker-field','Customer');
          partnerCodes.forEach(function(c){ var option=el('option',null,c); option.value=c; partnerCode.appendChild(option); });
          partnerCodeWrap.appendChild(partnerCode); partnerSection.appendChild(partnerCodeWrap);
          var partnerAnswer=el('p','msg'); partnerAnswer.setAttribute('role','status'); partnerSection.appendChild(partnerAnswer);
          var partnerPending=false, partnerAt=null, partnerSignature='';
          makerButton(partnerSection,['Make partner','record.partner.make'],async function(send){
            if(partnerPending) return;
            var body={code:partnerCode.value};
            var check=JSON.stringify(body); if(check!==partnerSignature){ partnerSignature=check; partnerAt=new Date().toISOString(); }
            body.at=partnerAt; partnerPending=true;
            try{ await send('/all/maker/inputs/partner',body); partnerAnswer.textContent='Sent. They pay cost once you approve it.'; loadMaker(); }
            catch(error){ refusal(partnerAnswer,error); }
            partnerPending=false;
          },true,function(){ partnerAt=null; partnerSignature=''; });
        }
      }
      /* A6: the Desk's Make it the house board. Which sizes the board prints, never a price: the ask is the ladder's. */
      var houseSection=makerForm('pricing');
      houseSection.appendChild(el('h3',null,'Printed sizes'));
      houseSection.appendChild(el('p','msg','Choose the sizes on the printed price list. Prices do not change.'));
      var houseBooks=(catalog.products||[]).filter(function(item){ return catalog.houseBoards&&catalog.houseBoards[item.product]&&catalog.houseBoards[item.product].sizes.length>1; });
      if(!houseBooks.length){
        houseSection.appendChild(el('p','msg','No book has sizes to choose between.'));
      }else{
        var houseProduct=makerTilesIn(houseSection,['Book','record.house.book'],houseBooks.map(function(item){ return bookItem(item.product); })), houseBoxes=el('fieldset','salt-options maker-sizes'), houseGrid=el('div','salt-options__grid');
        /* 12 Oct 2026 (PHASE 4a): the sizes are a grid of the system's Option tiles, a size a tile, ticked while it is printed; the same ticks, acts and body as the list was */
        houseBoxes.appendChild(el('legend','salt-options__legend salt-options__legend--label lbl','Sizes to print')); houseBoxes.appendChild(houseGrid);
        houseSection.appendChild(houseBoxes);
        var houseTicks=[];
        function fillHouse(){
          var board=catalog.houseBoards[houseProduct.value]; houseGrid.textContent=''; houseTicks=[];
          board.sizes.forEach(function(size){
            var tile=el('label','salt-option'), tick=actOn(el('input','salt-option__input'),'record.house.size',size), face=el('span','salt-option__face'); tick.type='checkbox';
            tick.checked=board.hidden.every(function(h){ return Math.abs(h-size)>=0.009; }); tick.value=String(size);
            face.appendChild(el('span','salt-option__label',units(size))); tile.appendChild(tick); tile.appendChild(face); houseGrid.appendChild(tile); houseTicks.push(tick);
          });
        }
        houseProduct.addEventListener('change',fillHouse); fillHouse();
        var houseAnswer=el('p','msg'); houseAnswer.setAttribute('role','status'); houseSection.appendChild(houseAnswer);
        var housePending=false, houseAt=null, houseSignature='';
        makerButton(houseSection,['Send the sizes','record.house.send'],async function(send){
          if(housePending) return;
          var body={product:houseProduct.value,hide:houseTicks.filter(function(t){ return !t.checked; }).map(function(t){ return Number(t.value); })};
          var check=JSON.stringify(body); if(check!==houseSignature){ houseSignature=check; houseAt=new Date().toISOString(); }
          body.at=houseAt; housePending=true;
          try{ await send('/all/maker/inputs/house-sizes',body); houseAnswer.textContent='Sent. The sizes change once you approve it. No price moves.'; loadMaker(); }
          catch(error){ refusal(houseAnswer,error); }
          housePending=false;
        },true,function(){ houseAt=null; houseSignature=''; });
      }
      box.appendChild(houseSection);
      /* A5: the Desk's Whiteboard hush. The tips are the ones the Desk is showing; a hush moves no figure. */
      var tipSection=makerForm('pricing');
      tipSection.appendChild(el('h3',null,'Desk reminders'));
      tipSection.appendChild(el('p','msg','Hide a reminder for a while.'));
      tierSection.parentNode.insertBefore(tipSection,tierSection.nextSibling);
      var tips=catalog.tips||[];
      if(!tips.length){
        tipSection.appendChild(el('p','msg','The Desk is showing no reminder to hide.'));
      }else{
        var tipId=actOn(el('select','fld salt-field__input'),'record.tip.tip');
        tips.forEach(function(tip){ var option=el('option',null,tip.title+(tip.hush===null?' (hidden for good)':tip.hush?' (hidden until '+fmtWhen(tip.hush)+')':'')); option.value=tip.id; tipId.appendChild(option); });
        var tipWrap=el('label','maker-field','Reminder'); tipWrap.appendChild(tipId); tipSection.appendChild(tipWrap);
        var tipFor=makerTilesIn(tipSection,['Hide for','record.tip.for'],[{value:'7',label:'7 days'},{value:'30',label:'30 days'},{value:'',label:'For good'}]);
        var tipAnswer=el('p','msg'); tipAnswer.setAttribute('role','status'); tipSection.appendChild(tipAnswer);
        var tipPending=false, tipAt=null, tipSignature='';
        makerButton(tipSection,['Hide it','record.tip.send'],async function(send){
          if(tipPending) return;
          var check=tipId.value+'|'+tipFor.value; if(check!==tipSignature){ tipSignature=check; tipAt=new Date().toISOString(); }
          var until=tipFor.value===''?null:new Date(Date.parse(tipAt)+8*3600000+Number(tipFor.value)*86400000).toISOString().slice(0,10);
          tipPending=true;
          try{ await send('/all/maker/inputs/hush',{at:tipAt,id:tipId.value,until:until}); tipAnswer.textContent='Hidden. The Desk drops it next time it opens.'; loadMaker(); }
          catch(error){ refusal(tipAnswer,error); }
          tipPending=false;
        },true,function(){ tipAt=null; tipSignature=''; });
      }
      makerOtherInputs(box,catalog,refreshMakerTradeCatalog);
      recordMenu(box,note);
    }catch(error){ refusal(note,error); note.dataset.retry='true';
      makerButton(box,['Try again','record.retry'],function(){ while(box.children.length>1) box.lastChild.remove(); loadMakerInputs(); }); }
    finally{ sweep(); }
  }
  async function makerForAccount(account){
    showPlace('orders','placed',{fresh:true,push:true});
    var box=document.getElementById('makerFor'); box.hidden=false; box.textContent='';
    box.appendChild(el('h2',null,'Order for '+(account.code||account.username)));
    var note=el('p','msg','Opening their price list.'); note.setAttribute('role','status'); box.appendChild(note);
    if(!OWNER.master){ note.textContent='This page cannot open accounts yet.'; return; }
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
      note.textContent='One order, at their current prices. You agree it next, under Orders.';
      var label=el('label','maker-field','Size and price'), pick=actOn(el('select','fld salt-field__input'),'orderfor.size');
      choices.forEach(function(choice,index){ var option=el('option',null,optionBook(choice.product)+units(choice.qty)+', '+rm(choice.total));
        option.value=String(index); pick.appendChild(option); }); label.appendChild(pick); box.appendChild(label);
      var modeLabel=el('label','maker-field','Collect or deliver'), mode=actOn(el('select','fld salt-field__input'),'orderfor.mode');
      [['collect','Collected'],['deliver','Delivered']].forEach(function(item){ var option=el('option',null,item[1]); option.value=item[0]; mode.appendChild(option); });
      modeLabel.appendChild(mode); box.appendChild(modeLabel);
      var place=makerField(box,['Delivery place','orderfor.place'],'text',''), want=makerField(box,['Wanted by (optional)','orderfor.want'],'date','');
      var friendLabel=el('label','tick atick'), friend=actOn(el('input'),'orderfor.friend'); friend.type='checkbox';
      /* 13 Oct 2026 (stress, Low): the tick of the account card's Sent (the input is the 44px tap, the box beside it shows the state), where this was a bare box with a 19px label */
      friendLabel.appendChild(friend); friendLabel.appendChild(el('span','tickbox')); friendLabel.appendChild(el('span',null,'For a friend')); friendLabel.hidden=!result.assoc; box.appendChild(friendLabel);
      var answer=el('p','msg'); answer.setAttribute('role','status'); box.appendChild(answer);
      var sent=false, pending=false, button=makerButton(box,['Place for them','orderfor.place-order'],async function(){
        if(pending||sent) return;
        var choice=choices[Number(pick.value)];
        var body={product:choice.product,qty:choice.qty,total:choice.total,unit:+(choice.total/choice.qty).toFixed(2),
          mode:mode.value,place:mode.value==='deliver'?place.value:'',forFriend:!!(result.assoc&&friend.checked),
          week:list.week&&list.week.monday||'',digest:list.digest||'',wantBy:want.value};
        body.rid=ridFor('maker:'+account.username,JSON.stringify(body));
        pending=true; button.disabled=true; answer.textContent='Placing.';
        try{
          var placed=await refs('/all/maker/customers/'+account.username+'/orders',body);
          sent=true; answer.textContent='Placed. It waits for you to agree it.'; loadMaker();
        }catch(error){ refusal(answer,error); }
        pending=false; button.disabled=sent;
      },true);
    }catch(error){ refusal(note,error); }
  }
  /* PHASE 1b: Needs you and Orders read this too. A poll (quiet true; a button hands this its own argument, never true) starts no read while
     one is out, nor on Orders while he has a field open, a tap in flight or cash held, and a poll that finds the same answer draws nothing.
     The newest read wins, so a slow one never draws over a fresher. */
  var reviewReading=false, makerGen=0;
  async function loadMaker(quiet){
    if(placeNow!=='orders'&&placeNow!=='record'&&placeNow!=='needs') return;
    var poll=quiet===true;
    if(poll&&(reviewReading||(placeNow!=='needs'&&(makerBusy||dirty.makerReview||Object.keys(makerCashHeld).length)))) return;
    var gen=++makerGen, apply=false, status=document.getElementById('makerReviewStatus'), rows=document.getElementById('makerDraftStatus');
    reviewReading=true;
    if(!poll){
      if(status) status.textContent='Reading.';
      if(rows) rows.textContent='Reading.';
      var reading0=document.getElementById('makerRefreshSaid'); if(reading0) reading0.textContent='Reading.';
    }
    try{
      makerCashRestore();
      var reading=await refs('/all/maker/review');
      await makerVerifySaved();
      if(gen!==makerGen) return;
      nGot('review');
      if(!changed('review', reading)&&poll) return;
      apply=true;
      makerCashReconcile(reading);makerData=reading;
      drawMaker();
    }catch(error){
      if(gen!==makerGen) return;
      nGot('review', error); apply=true;
      if(!poll){
        drawMaker();if(status) refusal(status,error); if(rows) refusal(rows,error);
        var failed0=document.getElementById('makerRefreshSaid'); if(failed0){ refusal(failed0,error); if(failed0.scrollIntoView) failed0.scrollIntoView({block:'nearest'}); }
      }
    }finally{ if(gen===makerGen){ reviewReading=false; ordFocus=null; if(apply) drawNeeds(); } }
  }
  /* 14 Oct 2026, HIS DECISION: THE PARTS OF ORDERS ARE THE CUSTOMER'S STAGES, Placed, Confirmed, Ready, Done and Ended (declined or cancelled), and an
     order is in exactly ONE. What waits on him is no part but a mark on the order's row (orderWaits: a placed order, a payment they say they sent, a stage
     he rejected, a question of theirs unanswered, the Worker's awaitingAnswer) and a count on its stage's pill. A closed practice order is in none. */
  function orderAsked(order){
    var m=(order&&order.msgs)||[], last=m[m.length-1];
    return !!(last&&last.by==='customer'&&!(order.quiet&&String(order.quiet)>=String(last.at)));
  }
  function orderWaits(order){
    var again=!!(order.again&&order.again.length);
    if(ordOpen(order)) return order.status==='placed'||(order.payments||[]).some(function(p){ return p.claim==='waiting'; })||again||orderAsked(order);
    return !order.test&&(again||orderAsked(order));
  }
  var STAGE_OF={placed:'placed', acknowledged:'confirmed', ready:'ready', done:'done'};
  /* 17 Oct 2026, HIS FLOW: an agreed order whose goods are all out, or that is paid in full, is Delivered or paid until it is both (the Desk's flowStage
     for a row of the book, the same rule) */
  function orderPartsOf(order){
    if(!ordOpen(order)&&order.test) return '';
    if(order.writtenOff) return 'orders.ended';   /* written off on the book: it ended there (17 Oct 2026) */
    /* and an Agree he rejected under Approve has no row behind it: it waits under Received, to be agreed again (17 Oct 2026) */
    if(order.status==='acknowledged'&&(order.again||[]).indexOf('ack')>=0) return 'orders.placed';
    var st=STAGE_OF[order.status]||'ended';
    if(st==='confirmed'||st==='ready'){
      var q=Number(order.qty)||0, out=q>0&&Number(order.moved||0)>=q-0.0005, paid=Number(order.paid||0), owed=Number(order.total||0)+Number(order.delivery||0)-paid;
      if(out||(owed<=0.004&&paid>0.004)) st='paid';
    }
    return 'orders.'+st;
  }
  /* PHASE 1c (11 Oct 2026): ORDERS ARE A LIST AND A DETAIL. #makerOrderList holds a row for each order of the part showing, the system's
     Inbox row: who by code, the mark and its units, the stage and what is asked of him, the figure and the age. A row opens that order's
     card in #makerReview, today's card with every control, request and guard as it was, drawn for the order opened and no other. From 860px
     the list stands beside the card; below it the card takes the list's place, with a way back. A row has no preview: that read is the
     card's. Leaving the place or the part closes the card. */
  var ordOpened=null, ordEntries={}, makerOpenOrders=[], ordAuto=false, ordFocus=null, ordMore={};
  function ordShown(st){ return ordMore[st]||50; }
  var ORD_STAGE={placed:['copper','Waiting on you'], acknowledged:['brass','Agreed'], ready:['verdigris','Ready'], done:['mist','Done'], declined:['mist','Declined'], cancelled:['mist','Cancelled']};
  function ordInPart(e){ return e.parts.split(' ').indexOf('orders.'+partNow)>=0; }
  function orderRow(e){
    var o=e.order, b=el('button','salt-inbox-row ordrow'); b.type='button'; b.setAttribute('data-in',e.parts); b.setAttribute('data-order',e.id); actOn(b,'order.open',e.id);
    if(ordOpened===e.id) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title'), side=el('span','salt-inbox-row__side');
    if(o){
      /* the stage is the part he is in, so the row carries one pill, Waiting on you, and says why in its line */
      b.appendChild(bookTile(o.product,o.qty));
      t.appendChild(whoTag(el('span',null,codeByUser(o.u)),codeOfUser(o.u)));
      /* ONE PILL AT MOST, and only a state the stage does not already say: Placed always waits on him, so its rows carry no Waiting on you; on any
         other stage the pill says he is wanted there (a question, a payment they say they sent). Practice, then Cash held, then Waiting on you. */
      var pillOf=o.test?['mist','Practice']:makerCashHeld[e.id]?['brass','Cash held']:(e.waits&&e.parts.indexOf('orders.placed')<0)?['copper','Waiting on you']:null;
      if(pillOf) t.appendChild(chip(pillOf[0],pillOf[1]));
      var why=[orderAsked(o)?'asked a question':'', ordPays(o).length?'says sent':'', o.again&&o.again.length?'send again':'', o.status==='placed'?'to decide':''].filter(Boolean);
      main.appendChild(el('span','salt-inbox-row__what',[o.mode==='deliver'?'Deliver':o.mode==='collect'?'Collect':''].concat(e.waits?why.slice(0,1):[]).filter(Boolean).join(', ')));
      side.appendChild(el('span','salt-inbox-row__age',ageOf(o.at)));
      side.appendChild(el('span','salt-inbox-row__action',rm(Number(o.total||0)+Number(o.delivery||0))));
    }else if(e.row){
      /* a row of the book: the buyer's code, the mark and its units, and what it owes, the Desk's figure */
      var r=e.row;
      b.appendChild(bookTile(r.product,r.qty));
      t.appendChild(whoTag(el('span',null,r.party),r.party));
      main.appendChild(el('span','salt-inbox-row__what',[r.rid, r.cancelled?'cancelled':r.writtenOff?'written off':r.owed>0.004?'owes '+rm(r.owed):'', r.waiting>0?'waits under Approve':''].filter(Boolean).join(', ')));
      side.appendChild(el('span','salt-inbox-row__age',r.date?fmtWhen(r.date):'Undated'));
      side.appendChild(el('span','salt-inbox-row__action',rm(Number(r.total||0)+Number(r.delivery||0))));
    }else if(e.trip||e.day){
      /* an order of several books: the buyer's code, a mark a line, and what the order owes, the Desk's figure */
      var g=e.trip||e.day, what=el('span','salt-inbox-row__what');
      t.appendChild(whoTag(el('span',null,g.party),g.party));
      g.lines.forEach(function(l){ what.appendChild(bookMark(l.product)); what.appendChild(document.createTextNode(' ')); });
      what.appendChild(document.createTextNode(e.trip?'one order':'same day, not one order'));
      main.appendChild(what);
      side.appendChild(el('span','salt-inbox-row__action',rm(g.owed)));
    }else{ t.appendChild(el('span',null,e.id)); if(e.waits) t.appendChild(chip('copper','Waiting on you')); }
    main.insertBefore(t,main.firstChild); b.appendChild(main); b.appendChild(side);
    b.addEventListener('click', function(){ openOrder(e.id); });
    return b;
  }
  /* a count on the pill of each stage whose orders wait on him, and on Payments for the payments they say they sent; a practice order is not counted, as the rail does not */
  function paintOrdCounts(){
    var n={};
    Object.keys(ordEntries).forEach(function(k){ var e=ordEntries[k], st=e.parts.replace('orders.',''); if(e.waits&&e.order&&!e.order.test) n[st]=(n[st]||0)+1; });
    n.payments=waitingClaims().filter(function(c){ return !c.test; }).length;
    [].forEach.call(document.querySelectorAll('.aparts[data-place="orders"] [data-part]'), function(b){
      var c=b.querySelector('.salt-tabs__count'), v=n[b.getAttribute('data-part')]||0;
      if(!v){ if(c) c.remove(); return; }
      if(!c){ c=el('span','salt-tabs__count'); b.appendChild(c); }
      c.textContent=String(v);
    });
  }
  function markOrderRows(){
    [].forEach.call(document.querySelectorAll('#makerOrderList [data-order]'), function(r){
      if(r.getAttribute('data-order')===ordOpened) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
  }
  /* the card of the order opened, drawn from the read that stands; it closes when its order has left the part showing (the answer to a tap
     that moved it is then on the list's line, as a card that had gone always left it) */
  function drawOrderPane(){
    var root=document.getElementById('makerReview'), split=document.getElementById('oSplit');
    if(!root) return;
    root.textContent=''; dirty.makerReview=false;
    var e=ordOpened&&placeNow==='orders'&&ordEntries[ordOpened];
    if(e&&!ordInPart(e)) e=null;
    /* from 860px the detail column is never an empty invitation: the first order of the part opens in it */
    if(!e&&placeNow==='orders'&&window.matchMedia&&window.matchMedia('(min-width:860px)').matches){
      var first=Object.keys(ordEntries).map(function(k){ return ordEntries[k]; }).filter(function(x){ return ordInPart(x); })[0];
      if(first){ e=first; ordOpened=first.id; [first.id,first.id+':again'].forEach(function(k){ delete makerQuotes[k]; delete makerPv[k]; }); }
    }
    if(!e) ordOpened=null;
    if(split) split.classList.toggle('open', !!e);
    markOrderRows();
    if(!e) return;
    var back=el('button','aback','← Orders'); back.type='button'; back.setAttribute('data-back','orders'); back.setAttribute('data-in',e.parts); actOn(back,'order.back');
    root.appendChild(back);
    if(e.order&&ordOpen(e.order)) orderCard(root,e.order); else if(e.row) rowCard(root,e); else if(e.trip) tripCard(root,e); else if(e.day) dayCard(root,e); else orderPlainCard(root,e);
    focusOrderAt();
  }
  function openOrder(id){
    var e=ordEntries[id];
    if(!e||placeNow!=='orders'||!ordInPart(e)) return;
    /* an order opened reads its figures afresh: the card draws from no earlier quote */
    [id,id+':again'].forEach(function(k){ delete makerQuotes[k]; delete makerPv[k]; });
    ordOpened=id; drawOrderPane(); sweep();
    /* below 860px the card takes the list's place and has its way back showing, so he is taken to the top of it; from 860px the list is the
       page's scroll and the card stands beside it, sticky, so a tap on a low row leaves the page where it is and only brings the card into view */
    try{
      var back=document.querySelector('#makerReview [data-back="orders"]'), card=document.getElementById('makerReview');
      if(back&&back.focus) back.focus();
      if(back&&window.getComputedStyle(back).display!=='none') window.scrollTo(0,0);
      else if(card&&card.scrollIntoView) card.scrollIntoView({block:'nearest'});
    }catch(x){}
  }
  function closeOrder(){
    var was=ordOpened; ordOpened=null; drawOrderPane(); sweep();
    try{ var row=was&&document.querySelector('#makerOrderList [data-order="'+was+'"]'); if(row&&row.focus) row.focus(); }catch(x){}
  }
  /* a Desk row that rides a trip with others: the trip's id, and every pending row of it. A claim's row or an order's has none. */
  function tripOf(draft){
    var entry=draft.entry||{};
    return !entry.orderId&&!entry.claim&&!(entry.fulfil&&entry.fulfil.claim)&&draft.row&&draft.row.trip;
  }
  function tripRows(draft){
    var trip=tripOf(draft);
    return trip?(makerData.drafts||[]).filter(function(item){ return item.status==='pending'&&item.collection==='sales'&&tripOf(item)===trip; }):[];
  }
  /* 12 Oct 2026 (Phase 2c, his decision 4 of 11 Oct): A DESK ROW'S APPROVE AND REJECT ASK ON THE PAGE'S SHEET, never a native confirm. The Sheet restates the row (or every
     row of the trip) by its mark, its code, its size and its figure and says what follows; its one action sends the request the confirm let through, the same route
     and the same empty body, and the ghost, the close control, the scrim and Escape send nothing. What is approved is the ROW AS DRAFTED, never recomputed. */
  function deskAskRow(item){
    var rid=draftRid(item);
    return askRow((rid?rid+' · ':'')+(draftParty(item)||'no code'), item.amends?'':rm(item.total), [moveWord(item), item.amends||item.qty==null?'':units(item.qty)].filter(Boolean).join(', '), item.product&&item.qty!=null&&!item.amends?bookTile(item.product,item.qty):null);
  }
  function deskAskRows(draft){ return groupOf(draft).drafts.map(deskAskRow); }
  /* a row's Approve and Reject, and a trip's: Approve, or Approve both for two books and Approve all for more */
  function approveWord(n){ return n?(n===2?'Approve both':'Approve all'):'Approve'; }
  function rejectWord(n){ return n?(n===2?'Reject both':'Reject all'):'Reject'; }
  /* THE ONE APPROVE of a Desk row, Record > Approve's button and Needs you's pill alike: the same question, the same request, the same
     answer line. It resolves true when the row was approved, false when it was not, and nothing when it was not asked (he declined, or a
     tap is already out). opener is the control that asked and key what it asks (its data-yn); going is told when he says yes, before the request goes. */
  /* PLAN 2 (16 Oct 2026): ONE CARD, ONE APPROVE. The Sheet lists every draft the card holds, as it stood when he tapped; his yes decides exactly those. A trip is one
     request (the Desk decides its rows in one batch); moves on one row are each draft's own approval, sent in the order they were entered, stopping at the first the
     Desk refuses, which the answer names. What one approval does is unchanged. */
  function approveDraft(draft,opener,key,going){
    var g=groupOf(draft), many=g.drafts.length>1;
    return ownerAsk(opener,key,{title:g.trip?'Approve every row of this trip?':many?'Approve every move on this order?':'Approve this row?', extra:g.drafts.map(deskAskRow), plain:true,
      say:[g.trip?'Every row of the trip is approved as drafted, with the cost, margin and flags shown. This tap decides them all.'
        :many?'Each move is approved as drafted, in the order it was entered. If the Desk refuses one, the moves after it wait and you are told which.'
        :'The row is approved as drafted, with the cost, margin and flags shown.'],
      go:approveLabel(g), keep:'Not yet'}).then(function(yes){
      if(!yes) return;
      if(going) going();
      if(g.trip||!many) return makerAction('/all/maker/drafts/'+encodeURIComponent(g.lead.id)+'/approve',{},'Row approved.','draft:'+g.lead.id);
      return decideInOrder(g,'approve');
    });
  }
  function rejectDraft(draft,opener,key){
    var g=groupOf(draft), many=g.drafts.length>1;
    return ownerAsk(opener,key,{title:g.trip?'Reject every row of this trip?':many?'Reject every move on this order?':'Reject this row?', extra:g.drafts.map(deskAskRow),
      say:[g.trip?'Every row of the trip is rejected and none is recorded.':many?'Each move is rejected and none is recorded.':'The row is rejected and nothing is recorded.'],
      go:g.trip?rejectWord(g.drafts.length):many?'Reject all':'Reject', keep:'Keep it'}).then(function(yes){
      if(!yes) return;
      if(g.trip||!many) return makerAction('/all/maker/drafts/'+encodeURIComponent(g.lead.id)+'/reject',{},'Row rejected.','draft:'+g.lead.id);
      return decideInOrder(g,'reject');
    });
  }
  /* each draft of the card in turn, the next only once the last was taken; the first refusal stops the rest and is named, with how many went before it */
  function decideInOrder(g,verb){
    if(makerBusy) return Promise.resolve();
    makerBusy=true;
    var key='draft:'+g.lead.id, n=g.drafts.length, done=0, word=verb==='approve'?'approved':'rejected';
    function next(){
      if(done>=n) return Promise.resolve();
      return refs('/all/maker/drafts/'+encodeURIComponent(g.drafts[done].id)+'/'+verb,{}).then(function(){ done++; return next(); });
    }
    function settle(said,error,ok){ makerBusy=false; return loadMaker().then(function(){ makerSay(key,said,error); return ok; },function(){ makerSay(key,said,error); return ok; }); }
    return next().then(function(){ return settle(n===2?'Both moves '+word+'.':'All '+n+' moves '+word+'.',null,true); },function(error){
      var d=g.drafts[done];
      return settle((done?done+' of '+n+' '+word+'. ':'')+'Move '+(done+1)+', '+moveWord(d).toLowerCase()+', was not '+word+': '+error.message+(done<n-1?' The moves after it wait under Approve.':''),error,false);
    });
  }
  function drawMaker(){
    var root=document.getElementById('makerReview'), list=document.getElementById('makerOrderList'), status=document.getElementById('makerReviewStatus');
    var queueRoot=document.getElementById('makerQueueReview'), draftRoot=document.getElementById('makerDrafts')||root, draftStatus=document.getElementById('makerDraftStatus');
    if(!root||!list) return;
    if(!makerData){
      if(!Object.keys(makerCashHeld).length&&!makerCashStorageError)return;
      makerData={orders:[],drafts:[]};
    }
    if(draftRoot!==root) draftRoot.textContent='';
    var open=(makerData.orders||[]).filter(ordOpen);
    var pendingRows=(makerData.drafts||[]).filter(function(d){ return d.status==='pending'; });
    makerOpenOrders=open;
    if(status) status.textContent=open.length+(open.length===1?' open order':' open orders');
    if(draftStatus) draftStatus.textContent=pendingRows.length+(pendingRows.length===1?' row':' rows')+' waiting for your approval';
    /* a row for each order of its stage, a done or ended one (fifty a stage at most) as well; an order whose cash is held is marked Waiting on you
       with its Undo, whatever else it is, and a held cash with no order on the read is a row of its own, in Placed */
    var held=Object.keys(makerCashHeld), entries=[], known={}, settled={}, closedAll={}, STAGES=['placed','confirmed','ready','paid','done','ended'];
    (makerData.orders||[]).forEach(function(o){
      known[o.id]=true;
      var parts=orderPartsOf(o);
      if(!parts) return;
      var waits=orderWaits(o)||held.indexOf(o.id)>=0, stage=parts.replace('orders.','');
      if(!ordOpen(o)){
        closedAll[stage]=(closedAll[stage]||0)+1;
        if(!waits&&(settled[stage]=(settled[stage]||0)+1)>ordShown(stage)) return;
      }
      entries.push({id:o.id, order:o, parts:parts, waits:waits});
    });
    /* 17 Oct 2026, HIS FLOW: every live row of the book with no live site order is an order here, at the stage the Desk read off its figures */
    (makerData.rows||[]).forEach(function(r){
      var stage=r.stage==='done'||r.stage==='ended'||r.stage==='paid'?r.stage:'confirmed';
      if(stage==='done'||stage==='ended'){
        closedAll[stage]=(closedAll[stage]||0)+1;
        if((settled[stage]=(settled[stage]||0)+1)>ordShown(stage)) return;
      }
      entries.push({id:'row:'+r.rid, row:r, parts:'orders.'+stage, waits:false});
    });
    held.filter(function(id){ return !known[id]; }).forEach(function(id){ entries.push({id:id, order:null, parts:'orders.placed', waits:true}); });
    /* plan 3 (16 Oct 2026): an order of several books on the book is agreed, one card for all its lines; a buyer's same-day rows that could be one stand beside it */
    (makerData.trips||[]).forEach(function(t){ entries.push({id:'trip:'+t.trip, trip:t, parts:'orders.confirmed', waits:false}); });
    (makerData.sameDay||[]).forEach(function(t){ entries.push({id:'day:'+t.rids.join('+'), day:t, parts:'orders.confirmed', waits:false}); });
    ordEntries={}; entries.forEach(function(e){ ordEntries[e.id]=e; });
    list.textContent='';
    entries.forEach(function(e){ list.appendChild(orderRow(e)); });
    /* a done or ended stage lists the orders with nothing asked of him (fifty at most) and every one that waits on him, which is never dropped; the note
       counts what the list shows against every order of the stage */
    ['done','ended'].forEach(function(st){
      var shownN=entries.filter(function(e){ return e.parts==='orders.'+st; }).length;
      if(shownN<(closedAll[st]||0)){
        var more=el('p','rnone',shownN+' of '+closedAll[st]+' closed orders are shown.'); more.setAttribute('data-in','orders.'+st); list.appendChild(more);
        /* 17 Oct 2026: Completed is paged, fifty more a tap */
        var next=el('button','salt-ghost','Show 50 more'); next.type='button'; next.setAttribute('data-in','orders.'+st); actOn(next,'orders.more',st);
        next.addEventListener('click',function(){ ordMore[st]=ordShown(st)+50; drawMaker(); }); list.appendChild(next);
      }
    });
    /* a stage with nothing in it says so, so an empty one is never read as a fault */
    [['placed','No orders received.'],['confirmed','No agreed orders.'],['ready','No orders ready.'],['paid','No orders delivered or paid.'],['done','No completed orders.'],['ended','No ended orders.']].forEach(function(p){
      if(entries.some(function(e){ return e.parts==='orders.'+p[0]; })) return;
      var none=el('p','rnone',p[1]); none.setAttribute('data-in','orders.'+p[0]); list.appendChild(none);
    });
    if(makerData.tripsError){ var te=el('p','msg bad',makerData.tripsError); te.setAttribute('data-in','orders.confirmed'); te.setAttribute('data-trips-error',''); list.appendChild(te); }
    makerButton(list,['Refresh','maker.refresh'],loadMaker,false);
    /* 13 Oct 2026 (stress, Medium): Refresh answers under itself; its refusal went to the list's line at the head of Orders, a screen above it */
    var refreshSaid=el('p','msg osaid'); refreshSaid.id='makerRefreshSaid'; refreshSaid.setAttribute('role','status'); refreshSaid.setAttribute('aria-live','polite'); list.appendChild(refreshSaid);
    /* the first read after entering Orders opens the first stage with something waiting (Placed when nothing does), unless he has chosen one */
    if(ordAuto&&placeNow==='orders'){
      ordAuto=false;
      var wait1=STAGES.filter(function(st){ return entries.some(function(e){ return e.waits&&e.parts==='orders.'+st; }); })[0];
      if(wait1&&wait1!==partNow){ showPlace('orders',wait1,{}); try{ history.replaceState(null,'',addrFor('orders',wait1)); }catch(x){} }
    }
    paintOrdCounts();
    drawOrderPane();
    drawDeskRows(draftRoot,queueRoot,pendingRows);
    sweep();
  }
  /* an order's head, as every card of an order says it: who by code, what and for how much; its stage as a chip, the four money words, and its reference small */
  function orderHead(card,order){
    var st=order.writtenOff?['mist','Written off']:ORD_STAGE[order.status]||['mist',String(order.status||'')], line=el('p','lead');
    var orderTitle=el('h3','');
    orderTitle.appendChild(whoTag(el('span',null,codeByUser(order.u)),codeOfUser(order.u)));
    orderTitle.appendChild(document.createTextNode(', ')); orderTitle.appendChild(bookMark(order.product));
    orderTitle.appendChild(document.createTextNode(' '+units(order.qty)+', '+rm(order.total)+(order.delivery?' + '+rm(order.delivery):'')));
    card.appendChild(orderTitle);
    line.appendChild(chip(st[0],st[1])); card.appendChild(line);
    /* 15 Oct 2026: an agreed order's head is its progress, what is owed, what is paid and what is handed over, and what they say they sent; the goods and the
       delivery charge are already in the title and stand in Details. A placed, declined or cancelled order has no agreed figure to owe, so it keeps Goods. */
    var agreed=['acknowledged','ready','done'].indexOf(order.status)>=0, moved=Math.round((+order.moved||0)*100)/100;
    card.appendChild(metrics(agreed
      ?[['Owed',rm(Math.max(0,Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0)))],['Paid',rm(order.paid||0)],['Handed',moved+' of '+units(order.qty)]].concat(+order.claimed>0?[['Says sent',rm(order.claimed)]]:[])
      :[['Goods',rm(order.total)]].concat(order.delivery?[['Delivery',rm(order.delivery)]]:[],+order.paid>0?[['Paid',rm(order.paid)]]:[])));
    /* 17 Oct 2026: an ended order's last move is under Approve until he decides it, and the book keeps its row live until then */
    var waitN=((makerData&&makerData.drafts)||[]).filter(function(d){ return d.status==='pending'&&d.entry&&d.entry.orderId===order.id; }).length;
    if(waitN&&!ordOpen(order)) card.appendChild(el('p','salt-insight',(waitN===1?'Its move waits':'Its '+waitN+' moves wait')+' under Approve: the book keeps the row as it was until you approve.'));
    /* 17 Oct 2026: a refund the book still owes them on this order's row */
    var owes=makerData&&makerData.refunds&&order.ledgerKey&&makerData.refunds[order.ledgerKey];
    if(+owes>0.004) card.appendChild(el('p','salt-insight','You owe them a refund of '+rm(owes)+' on this order. Close it on the Desk once it is paid.'));
    card.appendChild(detailBox('order.details',order.id,[['Reference',order.id],['Placed',fmtWhen(order.at)],['Way',order.mode==='deliver'?'Delivery':order.mode==='collect'?'Collection':'']]
      .concat(agreed?[['Goods',rm(order.total)],['Delivery',order.delivery?rm(order.delivery):'']]:[])));
  }
  /* the card of an open order: every control it had, on the order opened alone */
  function orderCard(root,order){
    var open=makerOpenOrders;
    {
      var card=makerCard(root,order.id), acts=el('div','maker-foot__acts'), cashed=false; card.setAttribute('data-in',orderPartsOf(order));
      orderHead(card,order);
      /* 10 Oct 2026: the delivery time they asked for, the part of its window inside the hours, while goods are still to go */
      if(order.mode==='deliver'&&order.slot&&order.slotSpan&&!((+order.moved||0)>=(+order.qty||0)-0.004))
        card.appendChild(el('p','maker-facts','Wanted '+String(order.slotSpan).replace('-',' to ')+' on '+fmtWhen(String(order.slot).slice(0,10))+'.'));
      /* 10 Oct 2026: their exact spot is sealed to his key: the Desk opens it, this page only says it was shared */
      if(order.mode==='deliver'&&order.pin) card.appendChild(el('p','maker-facts','They shared a pin. Open it on the Desk to price the delivery.'));
      var againAck=makerAgainAck(order), quoteStart=null;
      /* his decision of 06 Oct 2026: the size, the goods' price and the delivery charge stay amendable after Accept, one Correction for approval.
         16 Oct 2026 (plan 5, part 2): Change the order stands under the head, where the figures it changes are read, in place of below the money; it opens
         the same Sheet and sends the same restate (stage amend), so nothing about what it books moved */
      if(!againAck&&(order.status==='acknowledged'||order.status==='ready')){
        var change=makerButton(card,['Change the order','order.amend'],function(){ amendOpen(order,change); },false);
        change.setAttribute('data-amend',''); makerAskTag(order,change,'amend');
      }
      if(order.status==='placed'&&makerAccHeld(order)){
        var ap=order.price, apf=ap.offer||{};
        card.appendChild(el('p','maker-facts',(ap.state==='taken'?'They agreed to ':'Waiting for their yes to ')+rm(apf.total)
          +(order.mode==='deliver'?' + '+rm(apf.delivery||0):'')+(apf.slot&&apf.slotSpan?', '+String(apf.slotSpan).replace('-',' to ')+' on '+mwDayLabel(String(apf.slot).slice(0,10)):'')
          +(ap.state==='taken'?'. The row waits under Approve.':', until '+fmtWhen(apf.until)+'.')));
        if(ap.state!=='taken') makerButton(acts,['Take back the offer','order.withdraw-offer'],function(){ makerTap(order,'withdraw',{},'Offer withdrawn. The order stands as they placed it.'); },false).setAttribute('data-withdraw','');
      }else if(order.status==='placed'){
        var quote=makerQuotes[order.id]||(makerPv[order.id]&&makerPv[order.id].payload)||{}, form=el('div','maker-fields');
        var total=makerField(form,['Price (goods)','order.total'],'number',quote.total==null?order.total:quote.total);
        card.appendChild(form);
        /* a sheet of several placed orders asks for the delivery charge once, on its first order (the Desk's ordPvDelivery):
           the others hide the chips and send nought */
        var group=open.filter(function(o){ return order.sheet&&o.u===order.u&&o.sheet===order.sheet; }).sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); });
        var follower=group.length>1&&group.every(function(o){ return o.status==='placed'; })&&group[0].id!==order.id;
        var deliver=order.mode==='deliver'&&!follower;
        var chip=makerFee[order.id]||(makerFee[order.id]={value:'',other:''});
        var otherField=null, previewTurn=0, sig=JSON.stringify(order), feeRadios=[], winDraw=null;
        /* 12 Oct 2026 (his decision 6 of 11 Oct): THE CARD READS ITS OWN PREVIEW, once, when its order is opened, and again when an input is
           changed; the Preview button is retired. A row of the list reads nothing (only the opened order draws a card), so the Desk is asked
           once for an order he opens. A redraw of the card (a read that changed, a tap) keeps the quote it has, or waits on the one in
           flight, and never asks again for the same figures. */
        var qsay=el('p','salt-insight'), qfigs=el('div','maker-quote');
        qsay.setAttribute('role','status');
        function makerPlacedSay(text,bad,error){
          qsay.className=bad?'msg':'salt-insight'; qsay.textContent=text; withDetails(qsay,error); qfigs.textContent='';
          var accept=card.querySelector('[data-accept]'); if(accept) accept.remove();
        }
        /* any failed or in-flight preview, and any changed input, clears the usable quote/hash and takes Accept away:
           none of it is usable until a fresh exact-input preview succeeds (immediate safety requirement) */
        function makerPlacedInvalidate(){
          previewTurn++;
          delete makerQuotes[order.id]; delete makerPv[order.id];
          var chosen=makerPlacedDelivery()!=null;
          makerPlacedSay(chosen?'The figures are read again when you finish.':'Choose the delivery charge, and the figures read themselves.');
          /* 12 Oct 2026: an edit put back to what it was fires no change, so the read it waits for would never come: the card offers it, and nothing is left
             waiting on an event that may not happen (Accept stays away until the figures are read) */
          if(chosen) makerButton(qfigs,['Read the figures again','order.reread'],makerPlacedRead,false);
        }
        /* what the figures stand on: the goods total, the charge, and the window, which decides whether Accept goes to them for their yes */
        function makerPlacedWin(){ return order.mode==='deliver'?((follower?(makerWin[group[0].id]||{}).value:win.value)||''):''; }
        function makerPlacedKey(){
          var d=makerPlacedDelivery();
          return d==null?'':JSON.stringify([{total:Number(total.value),delivery:d},makerPlacedWin()]);
        }
        function makerPlacedShow(q){
          qsay.className='salt-insight'; qsay.textContent='Figures read. Check them before you agree.';
          qfigs.textContent=''; makerPlacedReading(qfigs,q.result);
          var old=card.querySelector('[data-accept]'); if(old) old.remove();
          /* a sheet's lines take its first order's window, as they take its one delivery charge */
          var wv=makerPlacedWin(), yes=makerNeedsYes(order,q.total,wv);
          var accept=makerButton(acts,[(yes?'Ask them, ':'Agree, ')+rm(q.result.quote)+(q.result.delivery>0?' + '+rm(q.result.delivery):''),yes?'order.send-yes':'order.accept'],function(){
            var s=makerQuotes[order.id]; if(!s||!s.hash) return;
            /* version 2: a raise or another window goes to them as an offer, for their yes; never on a sheet, which the Desk refuses */
            if(yes){ var ob={total:s.total,delivery:s.delivery,hash:s.offerHash}; if(order.mode==='deliver'&&wv) ob.slot=wv;
              makerTap(order,'offer',ob,'Sent to them for their yes.'); return; }
            var body={total:s.total,delivery:s.delivery,hash:s.hash};
            if(order.mode==='deliver'&&!order.slot&&!order.wantBy&&wv) body.slot=wv;
            makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/accept',body,'Agreed and sent to the Desk.',order.id);
          },true); accept.setAttribute('data-accept',''); acts.insertBefore(accept,acts.firstChild);
        }
        /* 13 Oct 2026 (stress, High): A CHOICE THAT DID NOT SAVE IS NOT SHOWN AS CHOSEN. The charge and the time are held on this card until the
           figures are read; a read that fails (a 500, no connection) leaves the radio he just pressed ticked over figures nobody read. The choice
           the last good read stood on is put back (chip.kept, win.kept), and the card's line says which did not save. The read itself is unchanged. */
        function makerPlacedRevert(){
          var k=chip.kept||{value:'',other:''}, said=[];
          if(chip.value!==k.value||(chip.value==='other'&&chip.other!==k.other)){
            chip.value=k.value; chip.other=k.other;
            feeRadios.forEach(function(r){ r.checked=r.value===chip.value; });
            if(otherField){ otherField.value=chip.other; otherField.closest('label').hidden=chip.value!=='other'; }
            said.push('That charge did not save. '+(chip.value===''?'No charge is chosen.':'RM '+(chip.value==='other'?chip.other:chip.value)+' is still chosen.'));
          }
          if(winDraw&&win.value!==(win.kept||'')){ win.value=win.kept||''; winDraw(); said.push('That time did not save. The one before it stands.'); }
          return said.length?said.join(' ')+' ':'';
        }
        function makerPlacedRead(){
          var delivery=makerPlacedDelivery();
          if(delivery==null){ previewTurn++; makerPlacedSay('Choose the delivery charge, and the figures read themselves.'); return; }
          var payload={total:Number(total.value),delivery:delivery}, key=makerPlacedKey(), turn=++previewTurn;
          /* an in-flight preview is not yet usable: clear any existing quote/Accept at once, not only on success */
          delete makerQuotes[order.id];
          makerPlacedSay('Reading the figures.');
          var pv=makerPv[order.id];
          if(!pv||pv.key!==key) pv=makerPv[order.id]={key:key,payload:payload,p:refs('/all/maker/orders/'+encodeURIComponent(order.id)+'/preview',payload)};
          pv.p.then(function(result){
            if(makerPv[order.id]===pv) delete makerPv[order.id];
            if(turn!==previewTurn||!card.isConnected) return;
            makerQuotes[order.id]={total:payload.total,delivery:payload.delivery,hash:result.hash,offerHash:result.offerHash,result:result,key:key,sig:sig};
            chip.kept={value:chip.value,other:chip.other}; win.kept=win.value;
            makerPlacedShow(makerQuotes[order.id]);
          }).catch(function(error){
            if(makerPv[order.id]===pv) delete makerPv[order.id];
            if(turn!==previewTurn||!card.isConnected) return;
            delete makerQuotes[order.id];
            var back=makerPlacedRevert();
            makerPlacedSay(back+error.message,true,error);
            if(makerPlacedDelivery()!=null) makerButton(qfigs,['Read the figures again','order.reread'],makerPlacedRead,false);
          });
        }
        total.addEventListener('input',makerPlacedInvalidate);
        total.addEventListener('change',makerPlacedRead);
        quoteStart=function(){
          var held=makerQuotes[order.id];
          if(held&&held.sig===sig&&held.key===makerPlacedKey()) makerPlacedShow(held); else makerPlacedRead();
        };
        if(deliver){
          /* S11 11.3 on the Counter: the delivery charge is chosen where the order is agreed, RM 0, 10, 15 or his own
             figure, and NONE is chosen until he chooses, so a delivery is never agreed at a charge nobody set */
          var fieldset=el('fieldset','salt-options'), grid=el('div','salt-options__grid salt-options__grid--2');
          fieldset.appendChild(el('legend','salt-options__legend','Delivery'));
          [['0','RM 0'],['10','RM 10'],['15','RM 15'],['other','Other']].forEach(function(opt){
            var label=el('label','salt-option'), radio=el('input','salt-option__input'),
                face=el('span','salt-option__face'), text=el('span','salt-option__label',opt[1]);
            radio.type='radio'; radio.name='makerFee-'+order.id; radio.value=opt[0]; radio.checked=chip.value===opt[0]; actOn(radio,'order.fee-'+opt[0]); feeRadios.push(radio);
            radio.addEventListener('change',function(){
              chip.value=opt[0];
              if(otherField) otherField.closest('label').hidden=opt[0]!=='other';
              makerPlacedInvalidate(); makerPlacedRead();
            });
            face.appendChild(text); label.appendChild(radio); label.appendChild(face); grid.appendChild(label);
          });
          fieldset.appendChild(grid);
          otherField=makerField(fieldset,['Other, RM','order.fee-other-amount'],'number',chip.other);
          otherField.closest('label').hidden=chip.value!=='other';
          otherField.addEventListener('input',function(){ chip.other=otherField.value; makerPlacedInvalidate(); });
          otherField.addEventListener('change',makerPlacedRead);
          card.appendChild(fieldset);
        }
        /* 13 Oct 2026 (stress, Medium): THE FIGURES STAND UNDER THE CHARGE, above the time. They were drawn after the whole Delivery time fieldset, 1,270px down a phone's
           card, so a charge pressed there had its answer a screen away (the status line of a read, its figures, its failure). The time still re-reads them, and is a
           fieldset's height below them. */
        card.appendChild(qsay); card.appendChild(qfigs);
        /* 10 Oct 2026 (his Q3): a delivery that asked for no time may be answered with a window, sent with Accept; theirs stands */
        var win=makerWin[order.id]||(makerWin[order.id]={value:'',day:''});
        if(deliver&&!order.wantBy){
          var now=Date.now(), days=makerWinDays(now), theirs=order.slot?String(order.slot).slice(0,10):'';
          if(days.indexOf(win.day)<0) win.day=days.indexOf(theirs)>=0?theirs:(days[0]||'');
          var wset=el('fieldset','salt-options'), wgrid=el('div','salt-options__grid salt-options__grid--2');
          wset.appendChild(el('legend','salt-options__legend','Delivery time'));
          var dl=el('label','salt-field'), ds=el('select','salt-field__input');
          dl.appendChild(el('span','salt-field__label','Day')); ds.setAttribute('data-winday',''); actOn(ds,'order.window-day');
          days.forEach(function(d){ var op=el('option','',mwDayLabel(d)); op.value=d; op.selected=d===win.day; ds.appendChild(op); });
          dl.appendChild(ds); wset.appendChild(dl);
          var own=order.slot&&order.slotSpan?'Theirs, '+String(order.slotSpan).replace('-',' to ')+' on '+mwDayLabel(theirs):'As soon as it can';
          function makerWinDraw(){
            wgrid.textContent='';
            [['',own]].concat(makerWinOn(win.day,Date.now()).filter(function(x){ return x[0]!==order.slot; })).forEach(function(opt){
              var label=el('label','salt-option'), radio=el('input','salt-option__input'),
                  face=el('span','salt-option__face'), text=el('span','salt-option__label',opt[1]);
              radio.type='radio'; radio.name='makerWin-'+order.id; radio.value=opt[0]; radio.checked=win.value===opt[0]; actOn(radio,opt[0]===''?'order.window-own':'order.window-'+opt[0].slice(11));
              /* a window decides whether Accept goes to them for their yes, so a change reads the figures again */
              radio.addEventListener('change',function(){ win.value=opt[0]; makerPlacedInvalidate(); makerPlacedRead(); });
              face.appendChild(text); label.appendChild(radio); label.appendChild(face); wgrid.appendChild(label);
            });
          }
          ds.addEventListener('change',function(){ win.day=ds.value; makerWinDraw(); });
          makerWinDraw(); winDraw=function(){ if(win.value) win.day=win.value.slice(0,10); ds.value=win.day; makerWinDraw(); };
          wset.appendChild(wgrid);
          wset.appendChild(el('p','salt-insight',order.slot?'They chose '+String(order.slotSpan||'').replace('-',' to ')+'. Choose another and they will be asked.'
            :'They want it as soon as it can; choose a window and it goes with Agree.'));
          card.appendChild(wset);
        }
        function makerPlacedDelivery(){
          if(!deliver) return 0;
          if(chip.value==='other'){ var v=Number(otherField.value); return otherField.value!==''&&v>=0?v:null; }
          if(chip.value==='0'||chip.value==='10'||chip.value==='15') return Number(chip.value);
          return null;
        }
      }else if(againAck){
        quoteStart=makerAcceptAgain(card,order,acts);
      }else if(order.status==='acknowledged'){
        /* Ready says how the goods go, as the Desk's card does; the order book records the mode at Ready */
        [['collect','Ready to collect'],['deliver','Ready to deliver']].forEach(function(m){
          makerButton(acts,[m[1],'order.ready-'+m[0]],function(){
            makerMove(order,{status:'ready',mode:m[0]},'Order marked '+m[1].toLowerCase()+'.');
          },(order.mode||'collect')===m[0]).setAttribute('data-mode',m[0]);
        });
      }else if(order.status==='ready'&&Number(order.moved||0)<Number(order.qty)-0.0004){
        /* 17 Oct 2026 (his word on CR3-DAM's order): asked only while units are left to hand over; all handed over, the card's figures say so */
        /* 16 Oct 2026 (plan 5, part 3): THE UNITS FIELD HAS ONE BUTTON. Handed over and Finish at fewer units were two buttons on one field; now the field
           has one, and fewer units than ordered show two tiles under it: More to come (the default, a part handover, as Handed over sent it) or That is all
           (a close at these units, asked on the Sheet, as Finish at fewer units sent it). The button says which. Each body is the one its old button sent. */
        var qty=makerField(card,['Units handed over','order.handed-units'],'number',order.qty), rest=null;
        if(!order.test){ rest=makerTilesIn(card,['The rest','order.handed-rest'],[{value:'more',label:'More to come'},{value:'all',label:'That is all'}]); rest.setAttribute('data-close',''); }
        var handedPart=function(){ var n=Number(qty.value); return !!rest&&n>0&&n<Number(order.qty); };
        var handedEnds=function(){ return handedPart()&&rest.value==='all'; };
        var handed=makerButton(acts,['Handed over, '+units(order.qty),'order.handed'],function(){
          if(!handedEnds()){ makerTap(order,'handed',{qty:Number(qty.value)},'Handover sent to the Desk.'); return; }
          /* a close at what was handed over: the order ends at these units, its total restated by the Desk */
          var n=Number(qty.value);
          makerAsk(order,handed,'close',{title:'Finish this order at '+n+' of '+order.qty+' units?', plain:true, go:'Finish the order', keep:'Not yet',
            say:['The order ends at '+n+' units, and the Desk restates its total.'],
            yes:function(){ makerTap(order,'handed',{qty:n,close:true},'Finish sent to the Desk.'); }});
        },true);
        makerAskTag(order,handed,'close');
        var handedDraw=function(){
          if(rest) rest.hidden=!handedPart();
          handed.textContent=handedEnds()?'Finish at '+Number(qty.value)+' of '+units(order.qty):Number(qty.value)>0?'Handed over, '+units(qty.value):'Handed over';
        };
        qty.addEventListener('input',handedDraw); if(rest) rest.addEventListener('change',handedDraw); handedDraw();
      }
      if(!againAck&&(order.status==='acknowledged'||order.status==='ready')){
        /* 15 Oct 2026: MONEY RECEIVED IS ONE BLOCK, in the order the money comes: their claim answered, a payment into the bank, then cash at the handover (Ready only).
           Since 16 Oct 2026 the bank and the cash are one amount and two tiles (makerPayControl); the reply stands below it, with their last line. */
        var moneyHead=el('h4','','Money received'); moneyHead.setAttribute('data-sect','money'); moneyHead.tabIndex=-1; card.appendChild(moneyHead);
        (order.payments||[]).filter(function(payment){ return payment.claim==='waiting'; }).forEach(function(payment){
          /* a claim above what the order still owes is money he recorded another way: the Desk's Received, already recorded */
          var onBook=Number(payment.amount)>Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0)+0.004;
          /* 12 Oct 2026 (Phase 2b, his decision 4 of 11 Oct): a claim's Received and its Not found ask on the page's Sheet, restating who and how much, and
             one action sends what the tap sent, the same route, body and request id */
          var got=makerButton(card,[onBook?'Already recorded, '+rm(payment.amount):'Yes, I got '+rm(payment.amount),'order.claim-received',payment.at],function(){
            makerAsk(order,got,'claim-'+payment.at,{title:onBook?'Already recorded, '+rm(payment.amount)+'?':'Received '+rm(payment.amount)+' from '+codeByUser(order.u)+'?', plain:true,
              go:onBook?'Yes, already recorded':'Yes, received', keep:'Not yet',
              say:[onBook?rm(payment.amount)+' is more than this order still owes, so you recorded it another way. Nothing more is recorded, and the customer is told it arrived.'
                :'The Desk records '+rm(payment.amount)+' against this order, and the customer is told it arrived.'],
              yes:function(){
                makerTap(order,'received',onBook?{amount:payment.amount,claim:payment.at,covered:true}:{amount:payment.amount,claim:payment.at},
                  onBook?'Already recorded. Nothing more is recorded.':'Sent to the Desk.');
              }});
          },false);
          makerAskTag(order,got,'claim-'+payment.at);
          var lost=makerButton(card,['Not found, '+rm(payment.amount),'order.claim-not-found',payment.at],function(){
            makerAsk(order,lost,'lost-'+payment.at,{title:'Not found '+rm(payment.amount)+' from '+codeByUser(order.u)+'?', go:'Not found', keep:'Not yet',
              say:['The claim is answered Not found and nothing is recorded. The customer is told.'],
              yes:function(){ makerMove(order,{claim:payment.at,amount:payment.amount},'Claim answered Not found.'); }});
          },false);
          makerAskTag(order,lost,'lost-'+payment.at);
        });
        if(order.status==='ready'){ makerCashControls(card,order); cashed=true; } else makerPayControl(card,order,false);
      }
      /* plan 4: an agreed order's History, and Undo on its newest move */
      if(['acknowledged','ready','done'].indexOf(order.status)>=0) historyBlock(card,{order:order.id},'order:'+order.id,order,order.id);
      makerAgain(card,order,acts);
      makerOrderMoves(card,order,false,acts);
      /* cash held for the order shuts every control of the card, the reply's too, which is drawn after the cash block: its Undo or Retry alone stays live */
      if(cashed&&(makerCashHeld[order.id]||makerCashStorageError)) [].forEach.call(card.querySelectorAll('button,input,select'),function(n){
        if(!n.hasAttribute('data-maker-cash-undo')&&!n.hasAttribute('data-maker-cash-retry')) n.disabled=true; });
      makerCardFoot(card,acts,order.id,cashed,!!quoteStart);
      if(quoteStart) quoteStart();
      return card;
    }
  }
  /* ---- 16 OCT 2026, PLAN 3 OF docs/plans-counter-admin.html: ORDERS ACROSS SEVERAL BOOKS ----------------------------------------------------------
     CS6-PER's salt, oil and rice of 14 Oct were three cards, each handed over and paid on its own. An order of several books (a trip: one buyer, one day, one
     row a book, the delivery on one row) is one card under Agreed. Its head is what the order owes and has paid and how many lines are handed over in full,
     in the head v1117 gave an order's card; then one line a book, its mark (never a word for it), units, total and what is handed over. Every figure is the
     Desk's (src/maker-inputs.js makerTrips, read with the drafts); this page adds up no money.
     Handover all sends one handover a line through Record's own input (a Fulfilment of units, ledger-amend), each line its own request under its own moment
     until it lands, so a book short of stock holds only its own line; a line's field allows a part. One payment is split by the Desk, oldest first by the
     engine's claimAlloc, shown, and sent with the split he read (trip-pay); the Desk refuses it whole if the split moved or any share is more than its row can
     take. A buyer's same-day rows with no trip are offered as one order (trip-join), a Correction a row. All of it lands under Approve as one card. ---- */
  var tripHand={}, tripRead={};
  function tripToday(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}); }
  function tripHead(card,t){
    var title=el('h3','');
    title.appendChild(whoTag(el('span',null,t.party),t.party));
    title.appendChild(document.createTextNode(', '+t.lines.length+' books'+(t.date?', '+fmtWhen(t.date):'')));
    card.appendChild(title);
    card.appendChild(metrics([['Owed',rm(t.owed)],['Paid',rm(t.paid)],['Handed',t.handedLines+' of '+t.lines.length+' lines']]));
    /* the Desk reads the order as it will stand, so a move waiting under Approve is never asked for twice; it says so */
    if(t.waiting>0) card.appendChild(el('p','salt-insight','As it will stand once '+(t.waiting===1?'the move':'the '+t.waiting+' moves')+' waiting under Approve '+(t.waiting===1?'is':'are')+' approved.'));
  }
  function tripLines(card,t,more){
    var list=el('div','triplines');
    t.lines.forEach(function(l){
      var row=el('div','tripline'), p=el('p','maker-facts');
      row.setAttribute('data-line',l.rid);
      p.appendChild(bookMark(l.product));
      p.appendChild(document.createTextNode(' '+units(l.qty)+', '+rm(l.total)+(l.delivery>0.004?' + '+rm(l.delivery)+' delivery':'')+', handed '+String(+(+l.handed||0).toFixed(3))+' of '+units(l.qty)+(l.waiting>0?', '+(l.waiting===1?'one move':l.waiting+' moves')+' waiting under Approve':'')));
      row.appendChild(p); if(more) more(row,l); list.appendChild(row);
    });
    card.appendChild(list);
  }
  function tripCard(root,e){
    var t=e.trip, key=e.id, card=makerCard(root,key), acts=el('div','maker-foot__acts'), fields={};
    card.setAttribute('data-in',e.parts);
    tripHead(card,t);
    var left=t.lines.filter(function(l){ return l.left>0.0005; });
    tripLines(card,t,function(row,l){ if(l.left>0.0005) fields[l.rid]=makerField(row,['Units to hand over','trip.hand-units',l.rid,l.product],'number',l.left);
      historyBlock(row,{rid:l.rid},'line:'+l.rid,null,key); });   /* plan 4: each line its History and Undo */
    if(left.length){
      var hand=el('div','maker-fields triphand'), handSaid=el('p','msg'); handSaid.setAttribute('role','status');
      var handBtn=makerButton(hand,['Handover all','trip.handover',t.trip],function(){ return tripHandover(t,key,fields,handSaid); },true);
      var relabel=function(){ handBtn.textContent=left.every(function(l){ return Number(fields[l.rid].value)===l.left; })?'Handover all':'Hand over as typed'; };
      left.forEach(function(l){ fields[l.rid].addEventListener('input',relabel); });
      hand.appendChild(handSaid); card.appendChild(hand);
    }
    if(t.owed>0.004) tripPayBlock(card,t,key);
    card.appendChild(detailBox('trip.details',key,[['Order',t.trip],['Day',t.date?fmtWhen(t.date):'']].concat(t.lines.map(function(l){ return ['Row',l.rid]; }))));
    makerCardFoot(card,acts,key,false,false);
    return card;
  }
  /* 17 Oct 2026, HIS FLOW: A ROW OF THE BOOK WITH NO SITE ORDER IS AN ORDER HERE TOO, at the stage its figures put it (the Desk's flowStage). Its moves
     are Record's own (ledger-amend), each under Approve: a handover or a payment a Fulfilment, a change of units, price or delivery a Correction, a
     cancel a Cancellation; History and Undo are the row's. Every figure is the Desk's, as the row will stand once the moves waiting fold. */
  var ROW_STAGE={confirmed:['brass','Agreed'], paid:['verdigris','Delivered or paid'], done:['mist','Completed'], ended:['mist','Ended']};
  function rowCard(root,e){
    var r=e.row, key=e.id, card=makerCard(root,key), acts=el('div','maker-foot__acts'), live=!r.cancelled&&!r.writtenOff;
    card.setAttribute('data-in',e.parts); card.setAttribute('data-row',r.rid);
    var title=el('h3','');
    title.appendChild(whoTag(el('span',null,r.party),r.party)); title.appendChild(document.createTextNode(', ')); title.appendChild(bookMark(r.product));
    title.appendChild(document.createTextNode(' '+units(r.qty)+', '+rm(r.total)+(r.delivery>0.004?' + '+rm(r.delivery):'')));
    card.appendChild(title);
    var st=r.cancelled?['mist','Cancelled']:r.writtenOff?['mist','Written off']:ROW_STAGE[r.stage]||['mist',String(r.stage)], head=el('p','lead');
    head.appendChild(chip(st[0],st[1])); card.appendChild(head);
    card.appendChild(metrics([['Owed',rm(r.owed)],['Paid',rm(r.paid)],['Handed',String(+(+r.handed||0).toFixed(3))+' of '+units(r.qty)]]));
    if(r.waiting>0) card.appendChild(el('p','salt-insight','As it will stand once '+(r.waiting===1?'the move':'the '+r.waiting+' moves')+' waiting under Approve '+(r.waiting===1?'is':'are')+' approved.'));
    if(+r.refund>0.004) card.appendChild(el('p','salt-insight','You owe them a refund of '+rm(r.refund)+' on this order. Close it on the Desk once it is paid.'));
    function amend(send,body,said){
      return send('/all/maker/inputs/ledger-amend',Object.assign({at:new Date().toISOString(),rid:r.rid,date:tripToday()},body))
        .then(function(){ return loadMaker(); }).then(function(){ makerSay(key,said); });
    }
    if(live&&r.left>0.0005){
      var hand=el('div','maker-fields rowhand'), n=makerField(hand,['Units to hand over','row.hand-units',r.rid,r.product],'number',r.left);
      makerButton(hand,['Record handover','row.handover',r.rid],function(send){
        var v=Number(n.value);
        if(!(v>0&&v<=r.left+0.0005)) throw new Error('Type from 0.01 to '+units(r.left)+'.');
        return amend(send,{kind:'Fulfilment',cash:0,movedUnits:v},'Sent. The handover waits under Approve.');
      },true);
      card.appendChild(hand);
    }
    if(live&&r.owed>0.004){
      var pay=el('div','maker-fields rowpay'), a=makerField(pay,['Paid, RM, cash or bank','row.pay-amount',r.rid],'number',r.owed);
      makerButton(pay,['Record payment','row.pay',r.rid],function(send){
        var v=Math.round(Number(a.value)*100)/100;
        if(!(v>0.004&&v<=r.owed+0.004)) throw new Error('Type from 0.01 to '+rm(r.owed)+'.');
        return amend(send,{kind:'Fulfilment',cash:v,movedUnits:0},'Sent. '+rm(v)+' waits under Approve.');
      },!(r.left>0.0005));
      card.appendChild(pay);
    }
    if(live){
      card.appendChild(el('h4','','Change the order'));
      var ch=el('div','maker-fields rowchange'), cq=makerField(ch,['Units','row.change-units',r.rid,r.product],'number',r.qty), ct=makerField(ch,['Price (goods)','row.change-total',r.rid],'number',r.total);
      /* a row on a trip carries the trip's one delivery: that is changed by hand */
      var cd=r.trip?null:makerField(ch,['Delivery','row.change-delivery',r.rid],'number',r.delivery||0);
      makerButton(ch,['Send the change','row.change',r.rid],function(send){
        var f={}, q=Number(cq.value), t=Math.round(Number(ct.value)*100)/100, d=cd?Math.round(Number(cd.value)*100)/100:null;
        if(!(q>0)||!(t>=0)||(cd&&!(d>=0))) throw new Error('Type the units, the price and the delivery, none below nought.');
        if(Math.abs(q-r.qty)>0.0004) f.qty=q;
        if(Math.abs(t-r.total)>0.004) f.total=t;
        if(cd&&Math.abs(d-(r.delivery||0))>0.004) f.delivery=d;
        if(!Object.keys(f).length) throw new Error('Nothing changed.');
        return amend(send,{kind:'Correction',fields:f},'Sent. The change waits under Approve.');
      },false);
      card.appendChild(ch);
    }
    if(live&&r.handed<=0.0005){
      makerButton(acts,['Cancel order','row.cancel',r.rid],async function(send){
        if(!await ownerAsk(send.button,'row.cancel:'+r.rid,{title:'Cancel this order?', plain:true, go:'Cancel order', keep:'Keep it',
          say:[r.paid>0.004?'The row is cancelled, and the '+rm(r.paid)+' they paid opens as a refund you owe them.':'The row is cancelled. Nothing was paid or handed over.']})) return;
        return amend(send,{kind:'Cancellation'},'Sent. The cancellation waits under Approve.');
      },false);
    }
    if(live&&r.closeAt!=null){
      makerButton(acts,['Cancel the rest','row.cancel-rest',r.rid],async function(send){
        var over=Math.round((r.paid-r.closeAt-(r.delivery||0))*100)/100;
        if(!await ownerAsk(send.button,'row.cancel-rest:'+r.rid,{title:'Cancel the rest of this order?', plain:true, go:'Cancel the rest', keep:'Keep it',
          say:['The order ends at the '+units(r.handed)+' handed over, for '+rm(r.closeAt)+(r.delivery>0.004?' and the delivery':'')+'.'+(over>0.004?' They paid '+rm(over)+' more than that, which opens as a refund you owe them.':'')]})) return;
        return amend(send,{kind:'Correction',fields:{qty:r.handed,total:r.closeAt}},'Sent. The order ends at what was handed over once it is approved.');
      },false);
    }
    historyBlock(card,{rid:r.rid},'line:'+r.rid,null,key);
    card.appendChild(detailBox('row.details',key,[['Row',r.rid],['Day',r.date?fmtWhen(r.date):'Undated']].concat(r.trip?[['Order of several books',r.trip]]:[])));
    makerCardFoot(card,acts,key,false,false);
    return card;
  }
  /* one handover a line, each its own request: what the Desk takes waits under Approve, and a line it refuses is said and holds only itself */
  async function tripHandover(t,key,fields,said){
    var lines=t.lines.filter(function(l){ return l.left>0.0005; }), want={}, day=tripToday(), base=Date.now(), sent=[], held=[], first=null;
    lines.forEach(function(l){
      var n=Number(fields[l.rid].value);
      if(!(n>=0&&n<=l.left+0.0005)) throw new Error(l.rid+' takes from 0 to '+units(l.left)+'.');
      want[l.rid]=n;
    });
    if(!lines.some(function(l){ return want[l.rid]>0; })) throw new Error('Type the units to hand over first.');
    said.textContent='Sending.';
    for(var i=0;i<lines.length;i++){
      var l=lines[i], n=want[l.rid]; if(!(n>0)) continue;
      var k=t.trip+'|'+l.rid+'|'+n, at=tripHand[k]||(tripHand[k]=new Date(base+i).toISOString());
      try{ await refs('/all/maker/inputs/ledger-amend',{at:at,rid:l.rid,kind:'Fulfilment',date:day,cash:0,movedUnits:n}); delete tripHand[k]; sent.push(l.rid); }
      catch(error){ held.push(l.rid+': '+error.message); if(!first) first=error; }
    }
    await loadMaker();
    makerSay(key,(sent.length?'Sent for '+andList(sent)+'. '+(sent.length>1?'They wait':'It waits')+' under Approve as one card.':'Nothing was sent.')
      +(held.length?' Held: '+held.join(' ')+' Tap again to send '+(held.length>1?'those lines':'that line')+' again.':''),first);
  }
  /* one payment for the order: the Desk splits it and the split is shown before it is sent; a change of the figure takes the split away */
  function tripPayBlock(card,t,key){
    var pay=el('div','maker-fields trippay'), said=el('p','msg'), shown=el('div','tripsplit'), rec=null;
    said.setAttribute('role','status');
    card.appendChild(el('h4','','Money received'));
    var held=tripRead[t.trip];
    var amount=makerField(pay,['Paid, RM, cash or bank','trip.pay-amount',t.trip],'number',held?held.amount:'');
    function drop(){ shown.textContent=''; if(rec){ var c=rec.nextSibling; if(c&&c.getAttribute&&c.getAttribute('data-act')==='trip.pay.cancel-retained'&&c.hidden) c.remove(); rec.remove(); rec=null; } }
    function draw(r){
      drop();
      r.split.shares.forEach(function(s){
        var p=el('p','maker-facts'); p.setAttribute('data-share',s.rid); p.appendChild(bookMark(s.product));
        p.appendChild(document.createTextNode(' '+s.rid+', '+rm(s.rm)+(s.rm<s.owed-0.004?' of '+rm(s.owed)+' owed':', all it owes')));
        shown.appendChild(p);
      });
      rec=makerButton(pay,['Record '+rm(r.amount),'trip.pay',t.trip],async function(send){
        var body={at:new Date().toISOString(),trip:t.trip,date:tripToday(),amount:r.amount,shares:r.split.shares.map(function(s){ return {rid:s.rid,rm:s.rm}; })};
        said.textContent='Sending.';
        await send('/all/maker/inputs/trip-pay',body);
        delete tripRead[t.trip];
        await loadMaker();
        makerSay(key,'Sent. '+rm(r.amount)+' waits under Approve as one card, split as shown.');
      },true);
      pay.appendChild(said);
    }
    makerButton(pay,['Show the split','trip.pay-split',t.trip],async function(){
      var a=Number(amount.value);
      if(!(a>0)) throw new Error('Type what they paid first.');
      said.textContent='Reading the split.';
      var j=await refs('/all/maker/trip-split',{trip:t.trip,amount:a});
      tripRead[t.trip]={amount:a, split:j.split};
      draw(tripRead[t.trip]);
      said.textContent='The Desk splits it oldest first. Check it before you record it.';
    },false);
    pay.appendChild(shown); pay.appendChild(said);
    amount.addEventListener('input',function(){ delete tripRead[t.trip]; drop(); said.textContent=''; });
    card.appendChild(pay);
    if(held&&held.split) draw(held);
  }
  /* a buyer's rows of one day with no trip: offered as one order, a Correction a row setting one trip, the delivery left on the row that has it */
  function dayCard(root,e){
    var t=e.day, key=e.id, card=makerCard(root,key), acts=el('div','maker-foot__acts');
    card.setAttribute('data-in',e.parts);
    tripHead(card,t);
    var dv=t.lines.filter(function(l){ return l.delivery>0.004; })[0];
    card.appendChild(el('p','salt-insight','Entered apart on one day. As one order they are handed over and paid together, '
      +(dv?'the delivery staying on '+dv.rid+'.':'with no delivery.')));
    tripLines(card,t);
    var join=el('div','maker-fields tripjoin'), said=el('p','msg'); said.setAttribute('role','status');
    makerButton(join,['These are one order','trip.join',t.rids.join('+')],async function(send){
      said.textContent='Sending.';
      await send('/all/maker/inputs/trip-join',{at:new Date().toISOString(),date:tripToday(),rids:t.rids.slice()});
      await loadMaker();
      makerSay(key,'Sent. Each row waits under Approve as one card.');
    },true);
    join.appendChild(said); card.appendChild(join);
    card.appendChild(detailBox('trip.details',key,[['Day',t.date?fmtWhen(t.date):'']].concat(t.lines.map(function(l){ return ['Row',l.rid]; }))));
    makerCardFoot(card,acts,key,false,false);
    return card;
  }
  /* 12 Oct 2026 (Phase 4c, glossary 5.2): CHANGE THE ORDER IS A SHEET of Units, Price (goods) and Delivery, opened from the card's Change the order (it was three fields and
     a button down the card). Its one action sends exactly what Send the change sent: the same restate route, the same figures (only those changed, the goods' price with a
     new size) and the same request id until it lands, so a lost reply is retried as itself. The card keeps what was typed while a change has not landed (amendMemo), so a
     failed send is opened again as he left it; a change that landed is forgotten, as the redrawn card forgot it. */
  var amendMemo={};
  function amendOpen(order,opener){
    var base=[order.qty,order.total,order.delivery||0].join(), memo=amendMemo[order.id], kept=memo&&memo.base===base?memo.vals:null;
    function one(label,act,value){
      var wrap=el('label','salt-field'), input=actOn(el('input','salt-field__input'),act,order.id);
      input.type='number'; input.step='0.01'; input.min='0'; input.inputMode='decimal'; input.value=String(value); input.setAttribute('data-amend-field','');
      wrap.appendChild(el('span','salt-field__label',label)); wrap.appendChild(input); return {wrap:wrap, input:input};
    }
    var aq=one('Units','order.amend-units',kept?kept[0]:order.qty), at=one('Price (goods)','order.amend-total',kept?kept[1]:order.total), ad=one('Delivery','order.amend-delivery',kept?kept[2]:order.delivery||0);
    makerAsk(order,opener,'amend',{title:'Change the order', plain:true, go:'Send the change', keep:'Not now', say:['You approve the change next, under Approve.'], extra:[aq.wrap,at.wrap,ad.wrap],
      yes:function(){
        var body={}, q=Number(aq.input.value), t=Number(at.input.value), d=Number(ad.input.value);
        if(q!==Number(order.qty)) body.qty=q;
        if(t!==Number(order.total)) body.total=t;
        if(d!==Number(order.delivery||0)) body.delivery=d;
        if(body.qty!==undefined&&body.total===undefined) body.total=t;
        if(!Object.keys(body).length){ makerSay(order.id,'Change a figure first.'); return; }
        amendMemo[order.id]={base:base, vals:[aq.input.value,at.input.value,ad.input.value]};
        makerTap(order,'restate',body,'Change sent. You approve it next, under Approve.').then(function(){ if(!makerRids[order.id+'restate'+JSON.stringify(body)]) delete amendMemo[order.id]; });
      }});
  }
  /* ---- 16 OCT 2026, PLAN 4 OF docs/plans-counter-admin.html: EASY REVERT (his answers: the newest move only; a site order's customer told by a banner) ----
     On an agreed order's card, on each line of an order of several books and on Correct a row, History reads a sale's booked moves from the Desk, newest
     first, and offers Undo on the newest alone, so undos peel back in order. The Desk says what undoing it sets and its Now and After, and why it waits when it
     does (money on its way, a move under Approve, the site's order not caught up); the Counter reckons nothing. Undo asks on the page's Sheet, Now and After
     and one action, and lands under Approve as one card: a Correction by Correct a row's road, or, for a change of a site order's terms, the order's own
     restate, so the order keeps its row. ---- */
  var undoRead={};
  function moveSay(m,handover){
    var bits=[];
    if(m.cash) bits.push(rm(m.cash)+' paid');
    if(m.kg) bits.push(units(Math.abs(m.kg))+(m.kg<0?' taken back':' '+(handover==='delivered'||handover==='collected'?handover:'handed over')));
    if(!bits.length) bits.push(m.kind==='Correction'?(m.changed&&m.changed.length?'Changed '+m.changed.map(function(k){ return fieldWord(k).toLowerCase(); }).join(', '):'A change')
      :m.kind==='Modification'?'Size and price restated':m.kind==='Cancellation'?'Cancelled':'A '+String(m.kind||'step').toLowerCase());
    return bits.join(', ')+(m.date?', '+fmtWhen(m.date):'')+(m.undone?', undone':'');
  }
  function undoGo(h){
    var u=h.undo, a=u.after;
    if(u.kind==='terms') return 'Undo: '+h.rid+' at '+rm(a.total);
    if(u.kind==='hand') return 'Undo: '+h.rid+' '+handedSay(a)+' handed over';
    return 'Undo: '+h.rid+(a.owed>0.004?' owes '+rm(a.owed):' paid');
  }
  function historyBlock(card,ref,key,order,sayKey){
    var box=el('div','undohist'), list=el('div','undolist'), said=el('p','msg'); said.setAttribute('role','status'); box.setAttribute('data-history',key);
    box.appendChild(el('h4','','History'));
    makerButton(box,[undoRead[key]?'Read it again':'History','undo.history',key],async function(){
      said.textContent='Reading.';
      var j=await refs('/all/maker/undo',ref);
      undoRead[key]=j.history; drawHist(j.history); said.textContent='';
    },false);
    function drawHist(h){
      list.textContent='';
      if(!h.moves.length) list.appendChild(el('p','rnone','Nothing booked since the row was entered.'));
      h.moves.forEach(function(m){
        var line=el('div','undomove'); line.setAttribute('data-move',String(m.i));
        line.appendChild(el('p','maker-facts',moveSay(m,h.handover)));
        if(h.undo&&h.undo.i===m.i&&!h.undo.blocked) undoButton(line,h,m,key,order,sayKey||key);
        list.appendChild(line);
      });
      if(h.undo&&h.undo.blocked){ var w=el('p','salt-insight',h.undo.blocked); w.setAttribute('data-undo-blocked',''); list.appendChild(w); }
      else if(!h.undo&&h.why&&h.moves.length){ var n=el('p','salt-insight','The newest move is not undone here: '+h.why+'.'); n.setAttribute('data-undo-none',''); list.appendChild(n); }
    }
    box.appendChild(list); box.appendChild(said); card.appendChild(box);
    if(undoRead[key]) drawHist(undoRead[key]);
    return box;
  }
  function undoButton(line,h,m,key,order,sayKey){
    var u=h.undo, btn=makerButton(line,['Undo','undo.open',key],async function(send){
      var say=['The row goes back to how it stood before this move. You approve it next, under Approve.']
        .concat(h.order?['Their order page follows once it is booked, and they are told.']:[]).concat(u.notes||[]);
      var yes=await ownerAsk(btn,'undo:'+key,{title:'Undo this move?', row:askRow((h.rid?h.rid+' · ':'')+h.party,'',moveSay(m,h.handover)), say:say,
        extra:[nowAfter({now:u.now, after:u.after})], go:undoGo(h), keep:'Keep it', plain:true});
      if(!yes) return;
      if(u.route==='restate'&&order){
        await makerTap(order,'restate',{qty:u.restate.qty,total:u.restate.total,delivery:u.restate.delivery,undo:u.i},'Undo sent. You approve it next, under Approve.');
      }else{
        await send('/all/maker/inputs/ledger-amend',{at:new Date().toISOString(),rid:h.rid,kind:'Correction',date:tripToday(),fields:u.fields,undo:u.i});
        makerSay(sayKey,'Undo sent. It waits under Approve.');
      }
      delete undoRead[key];
      await loadMaker();
    },true);
    ynTag(btn,'undo:'+key);
    return btn;
  }
  /* the card of an order that is not open: one with a stage he rejected keeps its card until that stage is offered again or left; a closed
     order has its figures, and a question of theirs he has not answered its reply; cash held for it keeps its Undo (or its Retry) */
  function orderPlainCard(root,e){
    var order=e.order, again=null, acts=el('div','maker-foot__acts'), cashed=false, card=makerCard(root,e.id); card.setAttribute('data-in',e.parts);
    if(!order){ card.appendChild(el('h3','','Cash held for an order not on this read')); card.appendChild(detailBox('order.details',e.id,[['Reference',e.id]])); }
    if(order){
      orderHead(card,order);
      /* his answer of 17 Oct 2026: a completed order keeps Change the order; figures that leave it owing open it again at Ready */
      if(order.status==='done'&&!order.test&&!makerAgainAck(order)){
        var redo=makerButton(card,['Change the order','order.amend'],function(){ amendOpen(order,redo); },false);
        redo.setAttribute('data-amend',''); makerAskTag(order,redo,'amend');
      }
      if(order.status==='done') historyBlock(card,{order:order.id},'order:'+order.id,order,e.id);   /* plan 4 */
      if(makerAgainAck(order)) again=makerAcceptAgain(card,order,acts);
      makerAgain(card,order,acts);
      if(orderAsked(order)) makerOrderMoves(card,order,true);
    }else card.setAttribute('data-key',e.id);
    if(makerCashHeld[e.id]){ makerCashControls(card,order||{id:e.id}); cashed=true; }
    makerCardFoot(card,acts,e.id,cashed,!!again);
    if(again) again();
    return card;
  }
  /* the Desk's rows waiting for him and the entries the server holds, on Record > Approve */
  /* 16 Oct 2026, PLAN 2 OF docs/plans-counter-admin.html: THE APPROVE CARD, FOR A PERSON. Still the system's approve card (salt-approve, carried whole by SITE_RECIPES and
     restated nowhere), now saying what the change does rather than what the order is. Its head is the row, the customer's code and the book's mark, and where the entry
     came from and when; then one plain verb; then Now and After, Paid, Owed and Handed over, read off the engine's figures the Desk sends with the draft (src/approve-figures.js)
     and computed nowhere here, only what changes marked; then at most two lines that ask a decision; then Approve, saying the result, Reject and Details, which keeps the
     drafter's whole note, every flag and the row. Every draft on one row, or on one trip, is one card and one Approve. */
  function draftAt(d){ return String(d&&d.id||''); }
  function draftParty(d){ var e=d.entry||{}, p=e.payload||{}; return d.party||e.party||p.party||''; }
  function draftRid(d){ var r=d.row||{}, f=d.figures||{}; return f.rid||r.rid||(/^[a-z]{1,3}[0-9]+$/i.test(String(d.amends||''))?d.amends:''); }
  /* where the entry came from: Counter Admin's own inputs carry their request, a site order's its id (his taps on it are the Desk's own), the laptop's queue holds the bare
     payload, and the phone typed the rest */
  function draftFrom(d){
    var e=d.entry||{};
    if(e.makerRequest) return 'Counter Admin';
    if(e.orderId) return e.by==='desk'||e.counter?'Counter Admin':'the site';
    if(!e.type&&e.payload) return 'laptop';
    return e.type?'phone':'';
  }
  /* a trip's rows (the Desk decides them in one batch) or every move on one row is one card, in the order entered. A customer's claim stands alone: it is answered
     on its order's card, never approved here, so it never shuts his own move on the same row (Fable's review of 16 Oct 2026) */
  function draftClaim(d){ var e=d.entry||{}; return !!(e.claim||e.fulfil&&e.fulfil.claim); }
  /* plan 3 (16 Oct 2026): a move on a row of an order of several books, his own (never a site order's or a claim's), names that order: the trip the Desk read
     off the row (figures.trip), or the one a These are one order sets. Such moves on the order's rows are one card, each draft approved in the order entered. */
  function moveTrip(d){
    var e=d.entry||{}, p=e.payload||{}, f=p.fields||{}, kind=d.amendKind||p.kind, keys=Object.keys(f);
    if(!d.amends||d.collection!=='sales'||draftClaim(d)||e.orderId) return '';
    /* only the order's own moves ride its card: a handover or a payment (a Fulfilment), and a join; any other move on a line keeps its own card (Fable's review) */
    if(kind==='Fulfilment') return String(d.figures&&d.figures.trip||'');
    return kind==='Correction'&&keys.length===1&&f.trip?String(f.trip):'';
  }
  function draftGroups(rows){
    var by={}, out=[];
    rows.slice().sort(function(a,b){ return draftAt(a)<draftAt(b)?-1:draftAt(a)>draftAt(b)?1:0; }).forEach(function(d){
      var t=tripOf(d), mt=moveTrip(d), k=t&&tripRows(d).length?'trip:'+t:mt?'moves:'+mt:d.amends&&!draftClaim(d)?'row:'+d.collection+':'+d.amends:'draft:'+d.id;
      if(!by[k]){ by[k]={key:k, trip:k.indexOf('trip:')===0, drafts:[]}; out.push(by[k]); }
      by[k].drafts.push(d);
    });
    out.forEach(function(g){ g.lead=g.drafts[0]; g.last=g.drafts[g.drafts.length-1]; g.tripMoves=g.key.indexOf('moves:')===0&&tripMoveRows(g).length>1; });
    return out;
  }
  /* the rows a card of an order's moves touches, in the order first entered, each with the Desk's Now (its first move's) and After (its last's) */
  function tripMoveRows(g){
    var rows=[], by={};
    g.drafts.forEach(function(d){
      var r=by[d.amends];
      if(!r){ r=by[d.amends]={rid:draftRid(d)||d.amends, product:d.product||'salt', drafts:[]}; rows.push(r); }
      r.drafts.push(d);
    });
    rows.forEach(function(r){
      var a=r.drafts[0].figures, b=r.drafts[r.drafts.length-1].figures;
      r.fg=r.drafts.every(function(d){ return d.figures&&d.figures.now&&d.figures.after; })?{now:a.now, after:b.after}:null;
    });
    return rows;
  }
  function groupOf(d){
    var hit=draftGroups(pendingRows()).filter(function(g){ return g.drafts.some(function(x){ return x.id===d.id; }); })[0];
    return hit||{key:'draft:'+d.id, trip:false, drafts:[d], lead:d, last:d};
  }
  /* WHAT ONE MOVE DOES, in a word a person uses: off the draft's kind, the fields it changes and which way. Correction and Fulfilment are the book's words, not his. */
  var AP_MONEY=['cash','settledRM','paidOn'], AP_HAND=['deliveredQty','deliveredOn','handover','settledKg'], AP_PRICE=['total','qty','delivery'];
  function moveKind(d){
    var e=d.entry||{}, p=e.payload||{}, kind=d.amendKind||p.kind;
    if(d.collection!=='sales'&&d.collection!=='purchases') return 'other';
    if(!d.amends) return d.collection==='purchases'?'buy':'sell';
    if(kind==='Cancellation') return 'cancel';
    if(kind==='Modification') return 'price';
    if(kind==='Default') return 'default';
    if(kind==='Correction'){
      var f=p.fields||{}, keys=Object.keys(f), ch=(d.row&&d.row.changes)||[];
      var from=function(k){ var c=ch.filter(function(x){ return x.field===k; })[0]; return c?+c.from||0:null; };
      var only=function(set){ return keys.length>0&&keys.every(function(k){ return set.indexOf(k)>=0; }); };
      var some=function(set){ return keys.some(function(k){ return set.indexOf(k)>=0; }); };
      /* plan 4: an undo says what it undoes */
      if(p.undo!=null) return some(AP_PRICE)?'undoterms':some(AP_HAND)&&some(AP_MONEY)?'undopayhand':some(AP_HAND)?'undohand':some(AP_MONEY)?'undopay':'fix';
      if(some(AP_HAND)&&some(AP_PRICE)&&only(AP_HAND.concat(AP_PRICE,AP_MONEY))
        &&f.deliveredQty!=null&&+f.deliveredQty>=+(f.qty!=null?f.qty:(d.row||{}).qty||0)-0.0005) return 'close';
      if(only(['trip'])&&f.trip) return 'join';
      if(only(AP_MONEY)&&f.cash!=null&&from('cash')!=null) return +f.cash<from('cash')?'unpay':'pay';
      if(only(AP_HAND)&&f.deliveredQty!=null&&from('deliveredQty')!=null) return +f.deliveredQty<from('deliveredQty')?'unhand':'hand';
      if(only(AP_PRICE)) return 'price';
      return 'fix';
    }
    var cash=+p.cash||0, kg=+p.kg||0;
    if(d.collection==='purchases') return kg>0.0005?'receive':cash>0.005?'paidout':'fix';
    return cash>0.005&&kg>0.0005?'payhand':kg>0.0005?'hand':cash>0.005?'pay':'fix';
  }
  var AP_WORD={sell:'New sale', buy:'New purchase', cancel:'Cancel the order', price:'Change the price', 'default':'Never delivered', close:'Close the order', pay:'Payment received',
    unpay:'Take back a payment', hand:'Handover', unhand:'Take back a handover', payhand:'Handover and payment', receive:'Goods received', paidout:'Payment made', fix:'Fix a row',
    join:'These are one order', undopay:'Undo a payment', undohand:'Undo a handover', undopayhand:'Undo a handover and payment', undoterms:'Undo a change of terms'};
  function moveWord(d){ var k=moveKind(d); return k==='other'?entryWord(d.entry||{}):AP_WORD[k]; }
  /* the card's one verb: a close among its moves closes the order; moves of one kind keep it; a payment and a handover together are both; anything else fixes a row */
  function groupKind(g){
    var ks=g.drafts.map(moveKind), has=function(k){ return ks.indexOf(k)>=0; };
    if(g.trip||ks.every(function(k){ return k===ks[0]; })) return ks[0];
    if(has('close')&&ks.every(function(k){ return ['close','pay','hand','payhand','price'].indexOf(k)>=0; })) return 'close';
    if(ks.every(function(k){ return ['pay','hand','payhand'].indexOf(k)>=0; })) return 'payhand';
    return 'fix';
  }
  /* Now and After of the whole card: the first move's Now and the last's After, both the Desk's; none unless every move carries them */
  function groupFigures(g){
    if(g.trip||g.tripMoves||!g.drafts.every(function(d){ return d.figures&&d.figures.after; })) return null;
    var a=g.lead.figures, b=g.last.figures;
    return {now:a.now, after:b.after, party:a.party, owedNow:a.owedNow, owedAfter:b.owedAfter, ceiling:a.ceiling, approvedBefore:a.approvedBefore||0};
  }
  function handedSay(f){ return String(+(+f.handed||0).toFixed(3))+' of '+units(f.qty); }
  /* THE BUTTON SAYS THE RESULT, read off the After the Desk sent; a card with no figures says its verb */
  function approveLabel(g){
    var k=groupKind(g), fg=groupFigures(g), rid=draftRid(g.lead), a=fg&&fg.after;
    if(g.trip) return approveWord(g.drafts.length);
    if(g.tripMoves){ var n=tripMoveRows(g).length;
      return k==='hand'?'Approve: handover on '+n+' lines':k==='pay'?'Approve: payment on '+n+' lines':k==='join'?'Approve: one order of '+n+' lines':approveWord(n); }
    if(k==='sell') return 'Approve the sale';
    if(k==='buy') return 'Approve the purchase';
    if(k==='other') return 'Approve';
    if(!rid) return 'Approve: '+AP_WORD[k].toLowerCase();
    if(k==='close') return 'Approve: '+rid+' closed';
    if(k==='cancel') return 'Approve: '+rid+' cancelled';
    if(!a) return 'Approve: '+rid+', '+AP_WORD[k].toLowerCase();
    var full=a.handed>=a.qty-0.0005, paid=!(a.owed>0.004);
    if(k==='pay'||k==='unpay'||k==='undopay') return 'Approve: '+rid+(paid?' paid':' owes '+rm(a.owed));
    if(k==='hand'||k==='unhand'||k==='undohand') return 'Approve: '+rid+(full?' handed over':' '+handedSay(a)+' handed over');
    if(k==='payhand'||k==='undopayhand') return 'Approve: '+rid+(paid&&full?' closed':paid?' paid, '+handedSay(a)+' handed over':' owes '+rm(a.owed));
    if(k==='price'||k==='undoterms') return 'Approve: '+rid+' at '+rm(a.total);
    return 'Approve: '+rid+' fixed';
  }
  /* Close the order says what it closes on: the goods' total, how it went, and that it was paid in cash */
  function closeSay(g){
    var fg=groupFigures(g), f={}, cash=false;
    g.drafts.forEach(function(d){ var p=(d.entry||{}).payload||{}; Object.assign(f,p.fields||{}); if((+p.cash||0)>0.005) cash=true; });
    var total=fg?fg.after.total:f.total;
    return [total!=null?rm(total):'', f.handover==='collected'||f.handover==='delivered'?f.handover:'', cash?'paid cash':''].filter(Boolean).join(', ');
  }
  /* THE LINES THAT ASK A DECISION, two at most and in his words: what the customer will owe against the ceiling when the card raises it, then the drafter's flags that
     ask one (under the floor, a refund opens, stock below zero, a twin). Every flag stands in Details whatever is drawn here. */
  var AP_ASK=[[/under the floor|loses money/i,'floor'],[/refund|overpaid|more than the order is owed|more than it is worth/i,'refund'],
    [/inventory the book puts at|owed out|unmeetable|a count of this book/i,'stock'],[/on the book by party, date, size and total/i,'twin']];
  function sentenceCase(s){
    s=noBook(s).replace(/\\b([A-Z][A-Z]+)\\b/g,function(w){ return /^(RM|COGS|ID|MYT)$/.test(w)?w:w.toLowerCase(); });
    s=s.split(/[.!?] /)[0].split(', which')[0].split(': ')[0].replace(/[.]$/,'');
    return s.charAt(0).toUpperCase()+s.slice(1)+'.';
  }
  function askLines(g){
    var out=[], fg=groupFigures(g)||(g.drafts.length===1&&g.lead.figures), seen={};
    /* over the ceiling always asks; under it, only a move on a booked row that raises what they owe (a payment taken back, a price raised), never a new sale */
    if(fg&&fg.ceiling!=null&&fg.owedAfter>fg.owedNow+0.004&&fg.party&&(fg.owedAfter>fg.ceiling+0.004||g.lead.amends))
      out.push(fg.owedAfter>fg.ceiling+0.004?fg.party+' will owe '+rm(fg.owedAfter)+', over the '+rm(fg.ceiling)+' ceiling.':fg.party+' will owe '+rm(fg.owedAfter)+' (under the '+rm(fg.ceiling)+' ceiling).');
    g.drafts.forEach(function(d){ (d.flags||[]).forEach(function(f){
      var hit=AP_ASK.filter(function(a){ return a[0].test(String(f)); })[0];
      if(hit&&!seen[hit[1]]){ seen[hit[1]]=true; out.push(sentenceCase(String(f))); }
    }); });
    return out.slice(0,2);
  }
  function nowAfter(fg){
    var tb=el('table','apnow'), hd=el('tr'), body=el('tbody'), thead=el('thead');
    [['',''],['Now','col'],['After','col']].forEach(function(h){ var th=el('th','',h[0]); if(h[1]) th.setAttribute('scope','col'); hd.appendChild(th); });
    thead.appendChild(hd); tb.appendChild(thead);
    [['Paid',rm(fg.now.paid),rm(fg.after.paid)],['Owed',rm(fg.now.owed),rm(fg.after.owed)],['Handed over',handedSay(fg.now),handedSay(fg.after)]].forEach(function(r){
      var tr=el('tr'), th=el('th','',r[0]); th.setAttribute('scope','row'); tr.appendChild(th);
      tr.appendChild(el('td','',r[1]));
      var td=el('td');
      if(r[1]!==r[2]){ td.className='apchg'; td.appendChild(el('strong','',r[2])); } else td.textContent=r[2];
      tr.appendChild(td); body.appendChild(tr);
    });
    tb.appendChild(body); return tb;
  }
  function apDetails(g){
    var panel=el('div','rdet rdet--row'); panel.hidden=true;
    g.drafts.forEach(function(d,i){
      if(g.drafts.length>1) panel.appendChild(el('h4','',(g.trip?'Row ':'Move ')+(i+1)+' of '+g.drafts.length+': '+moveWord(d)));
      if(d.reasoning) panel.appendChild(el('p','salt-approve__reason',noBook(d.reasoning)));
      (d.flags||[]).forEach(function(f){ panel.appendChild(el('p','salt-insight apnote',noBook(f))); });
      /* the draft's reference and the row in his words, and the row's id where the drafter left it off the row */
      panel.appendChild(detailList(rowPairs(d.row,d.id).concat(d.row&&d.row.rid||!draftRid(d)?[]:[['Row reference',draftRid(d)]])));
    });
    return panel;
  }
  /* an entry waiting for the Desk, by its moment when it has one: Entry of 09 Oct 2026, 14:11 */
  function entryLine(entry){ var at=isoAt(entry.id)||entry.date||''; return 'Entry'+(at?' of '+fmtWhen(at):''); }
  function drawDeskRows(draftRoot,queueRoot,pendingRows){
    draftGroups(pendingRows).forEach(function(g){
      var draft=g.lead, card=makerCard(draftRoot,'draft:'+draft.id,'salt-approve apcard'), head=el('div','salt-approve__head apphead');
      var rid=g.tripMoves?'':draftRid(draft), from=draftFrom(draft), when=fmtWhen(isoAt(draft.id)||draft.date||(draft.entry||{}).date||''), party=el('span','salt-approve__party');
      /* the head: the row, the customer's code and the book's mark; then where the entry came from, and when */
      party.appendChild(document.createTextNode((rid?rid+' · ':'')+(draftParty(draft)||'no code')));
      if(g.tripMoves) party.appendChild(document.createTextNode(' · '+tripMoveRows(g).length+' books, one order'));
      else if(draft.product&&(draft.collection==='sales'||draft.collection==='purchases')){ party.appendChild(document.createTextNode(' · ')); party.appendChild(bookMark(draft.product)); }
      head.appendChild(party);
      head.appendChild(el('span','salt-approve__entry',[from?'from '+from:'',when].filter(Boolean).join(', ')));
      card.appendChild(head);
      var kind=groupKind(g), verb=kind==='other'?entryWord(draft.entry||{}):AP_WORD[kind], fg=groupFigures(g), closed=kind==='close'?closeSay(g):'';
      card.appendChild(el('h3','apverb',verb+(closed?': '+closed:'')));
      if(fg&&fg.now) card.appendChild(nowAfter(fg));
      else if(g.tripMoves) tripMoveRows(g).forEach(function(r){
        /* each line of the order: its mark and row, then its Now and After as the Desk sent them; nothing is added up here */
        var h=el('p','maker-facts apline'); h.appendChild(bookMark(r.product)); h.appendChild(document.createTextNode(' '+r.rid)); card.appendChild(h);
        if(r.fg) card.appendChild(nowAfter(r.fg));
      });
      else if(!draft.amends){
        g.drafts.forEach(function(d){ card.appendChild(bookLine(d.qty,d.product||'salt',d.total)); var figs=readingFigures(d); if(figs.length){ var fr=metrics(figs); fr.classList.add('apfigs'); card.appendChild(fr); } });
        if(g.trip) card.appendChild(el('p','salt-insight',g.drafts.length===2?'Two books, one trip. Approve decides both.':g.drafts.length+' books, one trip. Approve decides all of them.'));
      }
      if(fg&&fg.approvedBefore) card.appendChild(el('p','salt-insight aphalf','Half approved: '+(fg.approvedBefore===1?'one move':fg.approvedBefore+' moves')+' on this row approved before, waiting to be booked; '+(g.drafts.length===1?'this one waits for you.':'these wait for you.')));
      askLines(g).forEach(function(line){ var p=el('p','salt-insight apflag'), bang=el('span','apbang','!'); bang.setAttribute('aria-hidden','true'); p.appendChild(bang); p.appendChild(document.createTextNode(' '+line)); card.appendChild(p); });
      var claim=g.drafts.some(draftClaim);
      if(claim) card.appendChild(el('p','salt-insight','Answer this through the payment card.'));
      var panel=apDetails(g), acts=el('div','salt-approve__actions'); card.appendChild(acts);
      var approve=makerButton(acts,[approveLabel(g),'draft.approve'],function(){ approveDraft(draft,approve,'draft:'+draft.id+':approve'); },true);
      approve.disabled=!!claim; ynTag(approve,'draft:'+draft.id+':approve');
      var reject=makerButton(acts,[g.trip?rejectWord(g.drafts.length):g.drafts.length>1?'Reject all':'Reject','draft.reject'],function(){ rejectDraft(draft,reject,'draft:'+draft.id+':reject'); },false);
      reject.classList.add('salt-ghost--danger'); ynTag(reject,'draft:'+draft.id+':reject');
      var more=makerButton(acts,['Details','row.proposed'],function(){ var open=more.getAttribute('aria-expanded')!=='true'; more.setAttribute('aria-expanded',String(open)); panel.hidden=!open; },false);
      more.setAttribute('aria-expanded','false');
      card.appendChild(panel);
      makerFoot(card,'draft:'+draft.id);
    });
    (makerData.refused||[]).forEach(function(refused){
      var card=makerCard(draftRoot); card.appendChild(el('h3','','Entry not taken'));
      card.appendChild(el('p','salt-insight',noBook(refused.why||'The Desk could not take this entry.')));
    });
    if(!pendingRows.length&&!(makerData.refused||[]).length) draftRoot.appendChild(el('p','rnone','Nothing waits for your approval.'));
    if(queueRoot){
      /* 14 Oct 2026 (his screenshot): a copy a device still holds of an entry already approved or committed is not waiting for anything,
         so it is not listed; it leaves the device's key when that device next posts */
      queueRoot.textContent='';
      var held=(makerData.queue||[]).filter(function(e){ return e&&e.state!=='committed'&&e.state!=='approved'; }), counted=document.getElementById('makerQueueCount');
      /* the queue is a fold shut by default, titled and counted, so it is never read as missing: its count is read off the entries the server holds */
      if(counted) counted.textContent=String(held.length);
      /* plan 1: a queue key the Desk could not read is said first, by its name, and never read as an empty queue */
      var bad=unreadableKeys();
      if(bad.length){ var ub=el('p','msg bad',unreadableLine(bad)); ub.setAttribute('data-unreadable',''); queueRoot.appendChild(ub); }
      if(!held.length&&!bad.length) queueRoot.appendChild(el('p','rnone','Nothing is waiting for the Desk.'));
      held.forEach(function(entry){
        var card=makerCard(queueRoot), title=entry.state==='refused'?'Entry the Desk refused':'Entry waiting for the Desk'; card.setAttribute('data-key',entry.id);
        card.appendChild(el('h4','',title));
        card.appendChild(el('p','maker-facts',entryLine(entry)+', '+(entry.state==='refused'?'refused':'waiting for the Desk')+'.'));
        if(entry.device) card.appendChild(el('p','maker-facts','From another device.'));
        if(entry.seenAt) card.appendChild(el('p','maker-facts','Seen '+fmtWhen(entry.seenAt)+'.'));
        if(entry.why) card.appendChild(el('p','salt-insight',noBook(entry.why)));
        card.appendChild(detailBox('queue.details',entry.id,[['Reference',entry.id],['Sent',fmtWhen(isoAt(entry.id)||entry.date)],['State',entry.state==='refused'?'Refused':'Waiting for the Desk']]));
        if(entry.unavailable) card.appendChild(el('p','msg',entry.unavailable));
        if(entry.canWithdraw||entry.canRetry){
          var note=el('p','msg'); note.setAttribute('role','status'); card.appendChild(note);
          var action=makerClaimButton(card,[entry.canRetry?'Finish the withdrawal':'Withdraw this entry','queue.withdraw'],function(button){
            /* his decision 4 of 11 Oct 2026: asked on the page's Sheet; finishing a withdrawal already begun asks nothing, as it did not */
            function withdraw(){
              button.disabled=true;
              refs('/all/maker/queue/'+encodeURIComponent(entry.id)+'/withdraw',{fingerprint:entry.fingerprint})
                .then(function(result){
                  var confirmed=result&&result.ok===true&&result.withdrawn===entry.id
                    && (result.state==='withdrawn'&&result.confirmedAbsent===undefined
                      || result.state==='rejected'&&result.confirmedAbsent===true)
                    && (result.again===undefined||result.again===true);
                  if(!confirmed) throw new Error('The Desk did not confirm the withdrawal. Refresh and try again.');
                  return loadMaker().then(function(){
                    var current=document.getElementById('makerDraftStatus');
                    if(current) current.textContent=result.state==='rejected'
                      ?'The Desk rejected it. The entry is gone.'
                      :'Withdrawn. The entry is gone.';
                  });
                }).catch(function(error){ refusal(note,error); button.disabled=false; });
            }
            if(!entry.canWithdraw){ withdraw(); return; }
            ownerAsk(button,'queue:'+entry.id,{title:'Withdraw this entry?', row:askRow(entryLine(entry),'',entry.state==='refused'?'refused':'waiting for the Desk'),
              say:['It is taken off the queue waiting for the Desk. An entry still unsent on a phone is not affected.'], go:'Withdraw entry', keep:'Keep it'})
              .then(function(yes){ if(yes) withdraw(); });
          },false);
          ynTag(action,'queue:'+entry.id);
          action.classList.add('maker-queue-action');
        }
      });
    }
  }
  function klInputValue(iso){
    if(!iso) return '';
    var d=new Date(iso);
    return new Date(d.getTime()+8*60*60*1000).toISOString().slice(0,16);
  }
  async function loadMakerHours(){
    if(placeNow!=='shop') return;
    try{ makerHours=await refs('/all/maker/hours'); drawMakerHours(); }
    catch(error){ var s=document.getElementById('makerHoursStatus'); if(s) refusal(s,error); }
  }
  function drawMakerHours(){
    var root=document.getElementById('makerSchedule'), status=document.getElementById('makerHoursStatus');
    if(!root||!makerHours) return;
    root.textContent='';
    var state=makerHours.status||{};
    status.textContent=(state.open?'Open now':'Closed now. Customers can still order; you answer when you open.')
      +(state.source==='default'?' · No weekly hours set.':'');
    var names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var days=(makerHours.config&&makerHours.config.schedule&&makerHours.config.schedule.days)||[];
    /* 12 Oct 2026 (PHASE 4a): the week is a table whose head names its three columns, the day with its tick, when it opens and when it closes; the same ticks, times, acts and body as the rows of bare controls were */
    var schedule=el('table','maker-hours salt-table'), head=el('tr'), weekdays=el('tbody');
    ['Day','Opens','Closes'].forEach(function(word,i){ var th=el('th',i?'':'salt-table__label',word); th.setAttribute('scope','col'); head.appendChild(th); });
    schedule.appendChild(el('thead')).appendChild(head); schedule.appendChild(weekdays);
    names.forEach(function(name,i){
      var row=el('tr','maker-day'), pick=el('label','maker-day-pick'), enabled=actOn(el('input',''),'hours.day-open',name); enabled.type='checkbox'; enabled.checked=!!days[i];
      enabled.setAttribute('aria-label',name+' is open');
      pick.appendChild(enabled); pick.appendChild(el('span','maker-day-name',name)); row.appendChild(el('td','salt-table__label')).appendChild(pick);
      var open=actOn(el('input','fld salt-field__input'),'hours.day-from',name); open.type='time'; open.value=days[i]?days[i].open:'09:00'; open.disabled=!enabled.checked; open.setAttribute('aria-label',name+' opens');
      var close=actOn(el('input','fld salt-field__input'),'hours.day-to',name); close.type='time'; close.value=days[i]?days[i].close:'17:00'; close.disabled=!enabled.checked; close.setAttribute('aria-label',name+' closes');
      enabled.addEventListener('change',function(){ open.disabled=!enabled.checked; close.disabled=!enabled.checked; });
      row.appendChild(el('td')).appendChild(open); row.appendChild(el('td')).appendChild(close); row._hours={enabled:enabled,open:open,close:close}; weekdays.appendChild(row);
    });
    root.appendChild(schedule);
    makerButton(root,['Save the weekly hours','hours.save'],function(){
      var result={days:[]};
      [].forEach.call(weekdays.children,function(row){ var d=row._hours; result.days.push(d.enabled.checked?{open:d.open.value,close:d.close.value}:null); });
      return refs('/all/maker/hours',{schedule:result}).then(function(value){ makerHours=value; drawMakerHours(); hoursSaid('week','Weekly hours saved.'); })
        .catch(function(error){ hoursSaid('week',null,error); });
    },true);
    /* 13 Oct 2026 (stress, Medium): the answer to Save stands under Save. It lay under the shop-for-now controls below, a screen away at 1280px. */
    var weekSaid=el('p','msg osaid'); weekSaid.id='makerHoursSaved'; weekSaid.setAttribute('role','status'); weekSaid.setAttribute('aria-live','polite'); root.appendChild(weekSaid);
    /* the shop held for now is two tiles over the field that says what the one chosen does: Closed until, or Open until; Kuala Lumpur time */
    var override=el('div','maker-fields'), kind=makerTilesIn(override,['The shop, for now','hours.override-state'],[{value:'false',label:'Closed'},{value:'true',label:'Open'}]);
    var until=makerField(override,['Closed until','hours.override-until'],'datetime-local',klInputValue(makerHours.config&&makerHours.config.manual&&makerHours.config.manual.until));
    var untilWord=until.parentNode.querySelector('.lbl');
    until.parentNode.appendChild(el('span','msg','Kuala Lumpur time'));
    kind.addEventListener('change',function(){ untilWord.textContent=kind.value==='true'?'Open until':'Closed until'; });
    root.appendChild(override);
    makerButton(root,['Set it','hours.override-set'],function(){
      var when=Date.parse(until.value+'+08:00');
      if(!Number.isFinite(when)){ hoursSaid('now','Choose an end time.'); return; }
      return refs('/all/maker/hours',{manual:{open:kind.value==='true',until:new Date(when).toISOString()}})
        .then(function(value){ makerHours=value; drawMakerHours(); hoursSaid('now','Saved for now.'); })
        .catch(function(error){ hoursSaid('now',null,error); });
    },false);
    makerButton(root,['Back to the weekly hours','hours.override-clear'],function(){
      return refs('/all/maker/hours',{clearManual:true}).then(function(value){ makerHours=value; drawMakerHours(); hoursSaid('now','Back on the weekly hours.'); })
        .catch(function(error){ hoursSaid('now',null,error); });
    },false);
  }
  /* an answer on Shop's hours stands under the control that asked: the weekly save under Save, the shop held for now under Set it and Back to the weekly
     hours (#makerHoursMessage, which sits right below them); the other line is cleared, so one answer is on screen, and it is scrolled into reach */
  function hoursSaid(where,text,error){
    var mine=document.getElementById(where==='week'?'makerHoursSaved':'makerHoursMessage'), other=document.getElementById(where==='week'?'makerHoursMessage':'makerHoursSaved');
    if(other) other.textContent='';
    if(!mine) return;
    if(error) refusal(mine,error); else mine.textContent=text;
    if(mine.scrollIntoView) mine.scrollIntoView({block:'nearest'});
  }
  var tiers=[];
  async function loadLinks(quiet){
    var poll=quiet===true;
    if(!poll) moved=null;
    linksBusy=true;
    try{
      var j=await refs('/all/refs'); nGot('links');
      var diff=changed('links',[j.refs,j.tiers]);
      links=j.refs||[]; tiers=j.tiers||[]; linksRead=true;
      if(diff||!poll){ drawLinks(); drawNeeds(); if(!poll){ say(''); linkSay(''); } }
    }
    catch(e){ nGot('links', e); if(!poll) sayFail(e); }
    finally{ linksBusy=false; }
  }
  async function setLevel(r, level){
    linkSaid=null;
    try{
      var j=await refs('/all/refs/'+r.id+'/level', {level: level||null});
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      linkSaid={id:r.id, t:level?('That link now shows the '+level+' price list.'):'That link follows its associate again.'};
    }catch(e){ linkSaid={id:r.id, t:e.message, bad:true, err:e}; }
    drawLinks(); drawNeeds(); say('');
  }
  /* 11 Oct 2026: A MOVE ON A LINK IS SENT ONCE. While it is out the card's move buttons are off, on Needs you and on Links,
     and a second tap, on a button a redraw put in their place, sends nothing. */
  var moving={};
  function moveLock(id, on){
    [].forEach.call(document.querySelectorAll('[data-link="'+id+'"] button[data-move], [data-need="l:'+id+'"] button[data-move]'), function(b){ b.disabled=on; });
  }
  async function moveLink(r, how){
    if(moving[r.id]) return;
    moving[r.id]=true; moveLock(r.id, true);
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
    }catch(e){ linkSaid={id:r.id, t:e.message, bad:true, err:e}; drawLinks(); drawNeeds(); say(''); }
    finally{ delete moving[r.id]; moveLock(r.id, false); }
  }
  /* ---- NEEDS YOU, THE INBOX (S9 9.1, and Phase 1b of 11 Oct 2026) ------------------------------------
     His home: every thing that waits on him, one card each on the system's Action recipe (salt-action, coloured by --salt-sev), ranked
     Now, Soon, Watch and oldest first in each. NOW is a customer waiting: an order placed, a payment they say they sent (on an order or
     against the account), a message asked, an account whose address is refused. SOON is his own work: a Desk row to approve, an entry
     that did not get through, a stage he rejected, a guest link, an ID with no account, accounts nobody has been sent, money owed past its term
     and goods paid for and not handed over. WATCH is an override in force and a notice set. A practice item is drawn after the real ones, labelled, and counted nowhere.
     A card is its kind word, who (the code), what, its age, one Open that goes to the detail, and, only where the page already has that
     exact action as one tap, one filled pill that calls the same function with the same guards. NOTHING HERE BOOKS MONEY: Agree, Yes
     received and Cash stay on their cards in Orders, which Open reaches. Read off what the places read anyway (/all/sheet, /all/refs, the
     review, the claims, the threads, the hours and the notice). A tap is answered on its own card. */
  var SEVS=[['now','Now'],['soon','Soon'],['watch','Watch']], SEVC={now:'copper',soon:'brass',watch:'mist'}, NEED_MS=30000;
  var NEED_SRC=[['sheet','accounts'],['links','links'],['review','orders and rows'],['claims','payments'],['threads','messages'],['hours','hours'],['notice','the notice'],['book','what is owed']];
  var nlist=document.getElementById('nlist'), nCount=document.getElementById('nCount'), linksRead=false, linksBusy=false;
  var nFoldOpen={}, nKind='all', needSaid={}, nSrc={}, nSeen={}, needN=0, needsAt=0, needsReading=false, needsTimer=null, makerNotice=null, shopReading=false;
  /* each source says it was read, or why it was not, so a read that failed is never taken for an empty inbox */
  function nGot(name, err){ nSrc[name]=err?String(err.message||err):'ok'; }
  /* a read that finds what it found last time draws nothing: each keeps its last answer */
  function changed(name, value){ var s=JSON.stringify(value), was=nSeen[name]!==s; nSeen[name]=s; return was; }
  function codeByUser(u){ var a=OWNER.accounts.filter(function(x){ return x.username===u; })[0]; return (a&&a.code)||u||'An associate'; }
  /* a code drawn where the one unlock may name it (Phase 4b): the node carries data-who, and the name is put beside it only while the vault is open */
  function codeOfUser(u){ var a=OWNER.accounts.filter(function(x){ return x.username===u; })[0]; return (a&&a.code)||''; }
  function whoTag(node,code){ if(typeof code==='string'&&/^[A-Z]+[0-9]+-[A-Z0-9-]+$/.test(code)) node.setAttribute('data-who',code); return node; }
  function hm(iso){ try{ var p=klBits(iso); return p.hour+':'+p.minute; }catch(e){ return ''; } }
  /* C17 (29 Sep 2026): his page's dates are the Counter's one form, DD Mon YYYY */
  function dayMon(iso){ try{ return dmyOf(klBits(iso),'en'); }catch(e){ return ''; } }
  /* a moment today is its time, any other its day */
  function when(iso){ var t=dayMon(iso); return t===dayMon(new Date().toISOString())?hm(iso):t; }
  function andList(xs){ return xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1]; }
  /* PHASE 3 (12 Oct 2026, 3a): THREE WORDS FOR A DAY, A SIZE AND A SUM, so no card prints one its own way. fmtWhen: a day is DD Mon YYYY and a moment is
     DD Mon YYYY, HH:MM in Kuala Lumpur, 24 hours, never ISO and never UTC; units: 1 unit, 2.5 units; rm is the page's own (stmt/page.js), RM and two places. */
  function fmtWhen(v){
    var s=String(v||'');
    if(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return dmyOf({day:s.slice(8), month:s.slice(5,7), year:s.slice(0,4)}, 'en');
    return stamp(s, 'en');
  }
  function units(n){ return unitsOf(Number(n)||0); }
  /* NO BOOK HAS A NAME ON THIS PAGE (his word of 12 Oct 2026, "and even the name of the product", which took back decision 5 of 11 Oct): a book is its mark, with
     his letter in it, and no word for it is drawn, not the Desk's (salt, oil, candy, rice) and not the shape's (Cube, Droplet, Lozenge, Capsule). A reader is told the
     shape, as on the customer's page (pshape: a hidden .sr or an aria-label), never the product. The Desk keeps its names; this page does not. bookMark is a mark in
     a line, bookTile mtile for a card (the mark, and under it "2.5 units"), bookTag the system's Product tag holding the mark, bookItem a tile of a form that is the
     mark alone, and pmarkHead, the customer's, a heading that is the mark alone. A select cannot hold a mark, so an option says the book's letter in brackets, [I],
     and nothing for a book with none. noBook takes a book's name out of a sentence the Desk or the Counter wrote, for the words that are not this page's to change. */
  var BOOKS=/\\b(salt|oil|candy|rice)\\b(?!\\s+(?:account|counter|command|desk)\\b)/gi;
  function noBook(text){
    return String(text==null?'':text).replace(BOOKS,function(w,k,at,all){ var before=all.slice(0,at); return /\\bthe\\s+$/i.test(before)?'book':/(^|[.!?]\\s)$/.test(before)?'The book':'the book'; });
  }
  function bookLetter(product){ var k=String(product||'').toLowerCase(); return Object.prototype.hasOwnProperty.call(PLET,k)?PLET[k].l:''; }
  function bookMark(product,px){ var w=el('span','pwith'); w.appendChild(psym(product,px||20)); w.appendChild(el('span','sr',pshape(product))); return w; }
  function bookTile(product,q){ return mtile(product,Number(q)||0); }
  function bookItem(product){ return {value:product,label:pshape(product),mark:product}; }
  function optionBook(product){ var l=bookLetter(product); return l?'['+l+'] ':''; }
  /* 12 Oct 2026 (Phase 5): A BOOK ON A ROW WEARS THE SYSTEM'S PRODUCT TAG, the book's mark in it and its own accent as its hue (PRODUCTS.accent in ledger/book.json is
     the system's --salt-product-<book> token, which the tag's modifier for the book reads). The tag holds no words; this page alone draws one. */
  function bookTag(product){
    var t=el('span','salt-producttag salt-producttag--'+String(product||'').toLowerCase().replace(/[^a-z]/g,'')), dot=el('span','salt-producttag__dot');
    dot.setAttribute('aria-hidden','true'); t.appendChild(dot); t.appendChild(bookMark(product,20)); return t;
  }
  /* a quantity, its book and a sum on one line: 2 units [its tag], RM 100.00 */
  function bookLine(qty,product,total){
    var p=el('p','maker-facts');
    if(qty==null){ p.appendChild(document.createTextNode(rm(total))); return p; }
    p.appendChild(document.createTextNode(units(qty)+(product?' ':''))); if(product) p.appendChild(bookTag(product));
    p.appendChild(document.createTextNode(', '+rm(total))); return p;
  }
  var ENTRY_WORD={SELL:'Sale', BUY:'Purchase', AMEND:'Correction', TIER:'Price level', REPAY:'Repayment', RENAME:'Name or place change', REDEEM:'Reward', PRICE:'Price change', PLACE:'Map placement', PARTNER:'Partner', OBS:'Reminder', GIFT:'Gift', COUNT:'Stock count', ADDID:'New customer', LOAN:'Loan'};
  function entryWord(e){ return ENTRY_WORD[e&&e.type]||(e&&e.type)||'Entry'; }
  /* what a Desk row is, in the order a person says it: the kind, the size, the sum; its book is the mark its card draws before these words (needCard, mark) */
  function rowWhat(d){ var e=d.entry||{}; return [entryWord(e), d.qty==null?'':units(d.qty), rm(d.total)].filter(Boolean).join(', '); }
  function ghost(t, lit){ var L=labOf(t), b=actOn(el('button','salt-ghost'+(lit?' salt-ghost--lit':''),L[0]),L[1],L[2]); b.type='button'; return b; }
  function pill(t){ var L=labOf(t), b=actOn(el('button','salt-pill salt-pill--md',L[0]),L[1],L[2]); b.type='button'; return b; }
  /* an age in the hours a customer has waited: minutes under the first, days from the third */
  function ageOf(iso){
    var t=Date.parse(iso); if(!(t>0)) return '';
    var m=Math.max(0,Math.floor((Date.now()-t)/60000));
    return m<60?m+' min':m<2880?Math.floor(m/60)+' h':Math.floor(m/1440)+' d';
  }
  /* an id that is a moment (a Desk row's is) is its age; any other id is not */
  function isoAt(s){ return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(String(s||''))?String(s):''; }
  function cut(s){ s=String(s||'').replace(/[ ]+/g,' ').trim(); return s.length>70?s.slice(0,69)+'…':s; }
  function goPlace(place, part){ return function(){ showPlace(place, part, {fresh:true, push:true}); }; }
  /* a card before it is drawn: where it ranks (sev, then age), the chip it answers to (kind), and how it is built. n is the order it was found
     in, which settles a tie. counts false is a card on screen that no longer waits on him. */
  function item(sev, kind, word, key, at, o, tweak){
    return {sev:sev, kind:kind, key:key, at:at||'', practice:!!o.practice, counts:o.counts!==false, n:needN++, make:function(){
      var c=needCard(Object.assign({sev:sev, kind:kind, word:word, key:key, at:at||''}, o));
      if(tweak) tweak(c);
      return c;
    }};
  }
  /* the Action recipe's own parts: the kind word, the body (who and what, then why), the age in the money's place, the way there. A card
     about an account carries data-u, which the pane beside the list is drawn from. c._add puts an action before Open. */
  function needCard(o){
    /* 14 Oct 2026: THE WHOLE CARD IS THE TAP. The title is the one real button (data-act need.open, keyboard and screen reader), its ::after
       stretched over the card; a card's own actions stand above that. No Open button: a card with no way of its own has no go row. */
    var tap=!!o.open&&!o.keepOpen;
    var c=el('article','salt-action salt-action--'+o.sev+' need'+(tap?' ncard':'')), body=el('div','salt-action__body'), title=el(tap?'button':'div','salt-action__title'+(tap?' need-tap':'')),
      go=el('div','salt-action__go'), op=null;
    if(tap){ title.type='button'; actOn(title,o.act||'need.open',o.key); title.addEventListener('click', o.open); }
    c.setAttribute('data-need', o.key); c.setAttribute('data-kind', o.kind); c.setAttribute('data-sev', o.sev);
    if(o.u) c.setAttribute('data-u', o.u);
    if(o.practice) c.setAttribute('data-practice','');
    c.appendChild(el('span','salt-action__kind',o.word));
    title.appendChild(whoTag(el('span','need-who',o.who),o.who));
    if(o.practice) title.appendChild(chip('mist','Practice'));
    if(o.what||o.mark){ var what=el('span','need-what'); if(o.mark) what.appendChild(bookMark(o.mark)); if(o.what) what.appendChild(document.createTextNode((o.mark?' ':'')+o.what)); title.appendChild(what); }
    body.appendChild(title);
    if(o.why) body.appendChild(el('p','salt-action__why',o.why));
    c.appendChild(body);
    c.appendChild(el('span','salt-action__money salt-action__money--nil',ageOf(o.at)));
    /* the banner over every place keeps its Open: it is not a list's card */
    if(o.open&&o.keepOpen){ op=ghost(['Open',o.act||'need.open',o.key]); op.addEventListener('click', o.open); go.appendChild(op); c.appendChild(go); }
    /* a card with an action of its own sets its ways on a row under the body, so a wide button never squeezes what it says */
    c._body=body; c._add=function(b){ if(!go.parentNode) c.appendChild(go); c.classList.add('need--act'); go.insertBefore(b, op); };
    return c;
  }
  function noteOf(c){ var m=el('p','nnote'); m.setAttribute('role','status'); c._body.appendChild(m); return m; }
  /* S9 fix: FROM 860PX NEEDS YOU STANDS BESIDE AN ACCOUNT (the plan's f13w, his decision 9 of 11 Oct 2026), as Customers does: the one he
     opened from a card, and NOTHING OPENS BY ITSELF (the column says Tap a card until he taps, and only the card he tapped is marked
     current). The pane is drawn again only when its account changes or the sheet is read again, so a redraw of the list never takes
     a tap in flight off the open card. wide() is the
     two panes' width, which the page's CSS shares at 860px; the rail's 1080px is the system's own switch and nothing here reads it. */
  var nopen=document.getElementById('nopen'), nOpen=null;
  function wide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:860px)').matches); }
  function openNeed(u){
    if(!wide()){ showPlace('customers','accounts',{fresh:true,push:true}); openCard(u); return; }
    nOpen=u; drawNeedOpen(true);
  }
  function drawNeedOpen(force){
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
     (linkId), so a link shared or copied, from any card, is dropped here and the next tap makes a fresh one (his decision 7
     of 11 Oct 2026: nothing is made unasked, so retire makes none); a forwarded link is then ended with the rest. */
  function retire(a, note){
    var u=a.username, was=madeLink[u]; madeLink[u]={note:note};
    if(was&&was.j) markOut(u, was.j);
  }
  function linkButton(a, note){
    var u=a.username, b=pill(['','need.signin-link']);
    function paint(){
      var m=madeLink[u]||{};
      b.disabled=!!m.busy; b.textContent=m.busy?'Making it...':m.j?'Share the link':'Send a sign-in link'; note.textContent=m.note||''; withDetails(note,m.err);
    }
    /* answered on this button, or on the one a redraw put in its place */
    function after(){ paintPills(u); if(b.isConnected) paint(); else drawNeeds(); }
    paint();
    b.addEventListener('click', async function(){
      var m=madeLink[u]||(madeLink[u]={});
      if(m.busy) return;
      if(!m.j){
        m.busy=true; m.note=''; m.err=null; paint();
        try{ m.j=await mintLink(a); m.note='Made. It signs '+(a.code||a.username)+' in once.'; }
        catch(e){ m.note='Could not make one: '+e.message; m.err=e; }
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
    var who=codeByUser(r.by), done=moved&&moved.id===r.id;
    return item('soon','accounts','Link','l:'+r.id, r.made, {who:who, what:'guest link, made '+when(r.made),
      why:'A link for a friend. It opens nothing until you approve it.', open:goPlace('customers','links'), counts:waitingLink(r)&&!done}, function(c){
      if(done){ noteOf(c).textContent=moved.t; return; }
      if(tiers.length){
        var f=el('div','salt-field'), lab=el('label','salt-field__label','Price list their friend sees'), sel=el('select','fld salt-field__input');
        sel.id='npin'+r.id; lab.htmlFor=sel.id; actOn(sel,'need.link-tier');
        var o0=el('option',null,'Follows '+who); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
        /* Ambassador is the floor and never a guest's */
        tiers.slice(1).forEach(function(t){ var o=el('option',null,t); o.value=t; if(r.level===t)o.selected=true; sel.appendChild(o); });
        sel.addEventListener('change', function(){ setLevel(r, sel.value); });
        f.appendChild(lab); f.appendChild(sel); c._body.appendChild(f);
      }
      var ap=pill(['Approve','need.link-approve']), de=ghost(['Decline','need.link-decline']);
      ap.setAttribute('data-move',''); de.setAttribute('data-move','');
      ap.addEventListener('click', function(){ moveLink(r,'approve'); });
      de.addEventListener('click', function(){ moveLink(r,'decline'); });
      c._add(ap); c._add(de);
      saidOn(r, noteOf(c));
    });
  }
  /* WHAT THE BRAKE KNOWS. It refuses the address the misses came from, which may be anybody holding the username, so the card says "Locked out until
     HH:MM" (the glossary's words, 12 Oct 2026, over S9's older "an address is refused") and offers the sign-in link that lets the customer in if it was
     them. The brake holds fifteen minutes from its last miss (the Worker's FAIL_TTL), so its age is read back from the moment it lets go. */
  function lockNeed(a){
    var L=a.locked, s=a.seen, held=Date.parse(L.until);
    return item('now','accounts','Locked','k:'+a.username, held>0?new Date(held-900000).toISOString():'', {who:a.code||a.username, u:a.username, what:'locked out'+(L.until?' until '+hm(L.until):''),
      why:'Too many wrong passwords. If it was them, send a sign-in link.'
        +(s&&s.opens?' Last signed in'+(howOf(s)?' '+howOf(s):'')+', '+dayMon(s.last)+'.':' Has never signed in.'),
      open:function(){ openNeed(a.username); }}, function(c){
      c._add(linkButton(a, noteOf(c)));
      /* and Show a code, in person, stage 3's hand-over (showHandover), for a customer at his counter */
      var sc=ghost(['Show a code','need.show-code']); sc.addEventListener('click', function(){ showHandover(a, sc); }); c._add(sc);
    });
  }
  function bareNeed(a){
    return item('soon','accounts','Account','n:'+a.username, '', {who:a.code||a.username, u:a.username, what:'no account yet', why:waitLine(),
      open:function(){ openNeed(a.username); }}, function(c){
      var sh=pill(['Show the guest price list','need.show-link']);
      c._add(sh);
      var note=noteOf(c);
      function openSilver(){
        var r=strangerLink();
        if(!r){ note.textContent='The guest link is not made yet. Open Links once, then try again.'; return; }
        silverOpen[a.username]=true;
        var box=el('div','glink salt-glass-card salt-glass-card--radius-md'), img=document.createElement('img'), cp=ghost(['Copy link','need.copy-link']);
        box.appendChild(el('code','gu',r.url));
        img.src=r.qr; img.alt='QR to the guest price list'; img.width=180; img.height=180; box.appendChild(img);
        cp.addEventListener('click', async function(){
          try{ await navigator.clipboard.writeText(r.url); note.textContent='Copied.'; }catch(e){ note.textContent='Copy failed.'; }
        });
        box.appendChild(cp);
        c._body.insertBefore(box, note); sh.disabled=true;
      }
      sh.addEventListener('click', openSilver);
      if(silverOpen[a.username]) openSilver();
    });
  }
  function sendAt(rows){ return rows.map(function(a){ return a.issued||''; }).filter(Boolean).sort()[0]||''; }
  function sendNeed(rows){
    var codes=rows.map(function(a){ return a.code||a.username; }), first=sendAt(rows);
    var named=codes.length>6?codes.slice(0,5).concat([(codes.length-5)+' more']):codes;
    return item('soon','accounts','Account','s', first, {who:rows.length+(rows.length===1?' account has':' accounts have')+' not been sent their sign-in link', what:first?'ready since '+dayMon(first):'',
      why:andList(named)+'.', open:function(){ showPlace('customers','accounts',{fresh:true,push:true}); filterBy('unsent'); }}, function(c){
      var go=pill(['Send sign-in links one by one','need.send-turn']);
      go.addEventListener('click', function(){ turn={rows:rows.slice(), i:0, sent:[], j:null, why:''}; turnStep(); });
      c._add(go);
    });
  }
  /* ---- THE CARDS OF ORDERS, PAYMENTS, MESSAGES AND ROWS (Phase 1b). Each is what the place it opens shows, found in what that place
     read, so a card and the place it opens never disagree: ordWaits is the Orders part Waiting on you. ---- */
  function ordOpen(o){ return ['placed','acknowledged','ready'].indexOf(o.status)>=0; }
  function ordPays(o){ return ordOpen(o)?(o.payments||[]).filter(function(p){ return p.claim==='waiting'; }):[]; }
  function ordWaits(o){ return orderWaits(o); }
  /* an order's Open goes to Orders, the stage it stands at, with that order's card open (Phase 1c) */
  function orderOpener(id){ return function(){ var e=ordEntries[id], st=e?e.parts.replace('orders.',''):'placed'; showPlace('orders',st,{fresh:true, push:true}); openOrder(id); }; }
  function orderWhat(o){ return units(o.qty)+', '+rm(o.total); }
  function waitingClaims(){ return makerClaims.filter(function(c){ return c.state==='waiting'; }); }
  function pendingRows(){ return (makerData&&makerData.drafts||[]).filter(function(d){ return d.status==='pending'; }); }
  /* a Desk row to approve: the same tap, the same question and the same request as Approve row on Record > Approve (approveDraft). A row
     that is a customer's claim is answered through Received on its order, so it has no pill. The answer stays on the card, which is drawn
     from the live row, and outlives it once the row is decided. */
  function rowNeed(d){
    var g=groupOf(d), claim=g.drafts.some(draftClaim), sibs=g.trip?g.drafts:[], said=needSaid['d:'+d.id], who=draftParty(d)||'no code';
    return item('soon','rows','Row','d:'+d.id, isoAt(d.id), {who:who,
      mark:d.qty==null||g.tripMoves?'':d.product, what:g.tripMoves?moveWord(d)+', '+tripMoveRows(g).length+' books, one order'
        :d.amends?[draftRid(d),moveWord(d)].filter(Boolean).join(', ')+(g.drafts.length>1&&!g.trip?', '+g.drafts.length+' moves':''):rowWhat(d),
      why:claim?'Answer this through the payment card.'
        :sibs.length?(sibs.length===2?'Two books, one trip. Approve decides both.':sibs.length+' books, one trip. Approve decides all of them.'):'',
      open:goPlace('record','approve')}, function(c){
      if(!claim){
        var ap=pill([approveLabel(g),'need.approve-row']);
        ap.disabled=!!makerBusy; ynTag(ap,'need:draft:'+d.id+':approve');
        ap.addEventListener('click', function(){
          /* asked on the page's Sheet, with nothing shut until he says yes: a no leaves the pill and the card as they were */
          var said=false;
          approveDraft(d,ap,'need:draft:'+d.id+':approve',function(){ said=true; ap.disabled=true; }).then(function(ok){
            if(!said) return;
            if(ok!==undefined) needSaid['d:'+d.id]={t:makerSaid['draft:'+d.id]||(ok?'Row approved.':'Not approved.'), bad:!ok, who:who};
            drawNeeds();
          });
        });
        c._add(ap);
      }
      if(said) { var n=noteOf(c); n.textContent=said.t; if(said.bad) n.className+=' bad'; }
    });
  }
  /* a row he has just approved stays where he tapped it, saying what happened, and no longer waits on him */
  function decidedNeed(k, said){
    return item('soon','rows','Row',k, '', {who:said.who, what:'', why:said.t, counts:false, open:goPlace('record','approve')});
  }
  /* 15 Oct 2026 (plan 1, part 2): a device's queue key the Desk could not read (malformed, or with no matching device), named so he can mend it;
     every other entry is read beside it */
  function unreadableKeys(){ return (makerData&&makerData.unreadable||[]).filter(function(k){ return typeof k==='string'; }); }
  function unreadableLine(keys){ return keys.length+(keys.length===1?' queue entry':' queue entries')+' unreadable: '+keys.join(', '); }
  function unreadableNeed(keys){
    return item('soon','rows','Entry','qx', '', {who:'Desk queue', what:unreadableLine(keys),
      why:'Every other entry is read as usual. No entry is withdrawn until that key is mended.', open:goPlace('record','approve')});
  }
  function entryNeed(r, key){
    return item('soon','rows','Entry',key, isoAt(r.at||r.seenAt||r.id), {who:r.party||'Desk', what:'did not get through',
      why:noBook(r.why||'The Desk could not take this entry.'), open:goPlace('record','approve')});
  }
  /* an entry kept on this phone and not confirmed (Phase 4c): Soon, his own work; its Open is Record, on the entry's own section, where Send again, Update and send and Discard are */
  function unsentNeed(u){
    var w=unsentWord(u);
    return item('soon','rows','Unsent','u:'+u.path, u.at, {who:u.who||'This phone', what:w.charAt(0).toUpperCase()+w.slice(1),
      why:unsentSaid(u)+' Open it to send it again, update it or discard it.', open:function(){ unsentOpen(u); }});
  }
  function threadNeed(t){
    var last=t.msgs[t.msgs.length-1];
    return item('now','messages','Message','m:'+t.u, last.at, {who:codeByUser(t.u), what:cut(last.text), practice:!!t.test,
      open:function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(t.u); }});
  }
  /* ---- 15 Oct 2026 (plan 1, parts 3 and 4): WHAT IS OWED, BOTH WAYS, as Soon cards, his own work. The figures are the Desk's (/all/maker/inputs, owedMoney
     and owedGoods: src/maker-inputs.js owedBothWays over the engine's txAdvance, txUnpaidSince, the term and txStat), so nothing is reckoned here.
     A card's button opens the site order its row belongs to (the order's ledgerKey is the row's ovKey) on Money received or the handover; a row
     with no site order opens Record's Correct a row on that row, as goods or cash moved. The button opens; it books nothing. ---- */
  var owed=null, owedReading=false;
  async function loadOwed(){
    if(owedReading) return;
    owedReading=true;
    var apply=false;
    try{
      var j=await refs('/all/maker/inputs'), c=(j&&j.catalog)||{};
      if(!Array.isArray(c.owedMoney)||!Array.isArray(c.owedGoods)) throw new Error(c.owedError||c.error||'The Desk did not say what is owed.');
      nGot('book');
      var v={money:c.owedMoney, goods:c.owedGoods};
      if(changed('book', v)){ owed=v; apply=true; }
    }catch(error){ nGot('book', error); apply=true; }
    owedReading=false;
    if(apply) drawNeeds();
  }
  /* the open site order a Desk row is, found by its key (a key of three parts is salt's, from before a key named its book) */
  function siteOrderOf(r){
    var key=String(r.key||''), three=key.split('|').slice(0,3).join('|');
    return (makerData&&makerData.orders||[]).filter(function(o){
      var k=typeof o.ledgerKey==='string'?o.ledgerKey:'';
      return !o.test&&ordOpen(o)&&!!k&&(k===key||(k.split('|').length===3&&k===three&&(o.product||'salt')===r.product));
    })[0]||null;
  }
  /* an order's card opened at one of its parts: Money received (data-sect money) or the handover (its units field) */
  function openOrderAt(id, at){
    orderOpener(id)();
    /* kept through the read the place started, which draws the card again, and let go once that read lands (loadMaker) */
    ordFocus={id:id, at:at}; focusOrderAt();
    if(!reviewReading) ordFocus=null;
  }
  function focusOrderAt(){
    if(!ordFocus||ordFocus.id!==ordOpened) return;
    try{ var n=document.querySelector('#makerReview '+ordFocus.at); if(n){ if(n.scrollIntoView) n.scrollIntoView({block:'center'}); if(n.focus) n.focus(); } }catch(x){}
  }
  var amendWant=null, amendPick=null;
  function applyAmend(){
    if(!amendWant||!amendPick) return;
    var rid=amendWant; amendWant=null;
    if(amendPick(rid)) openForm('correct-a-row');
  }
  function amendFor(rid){ amendWant=rid; showPlace('record','entry',{fresh:true,push:true}); applyAmend(); }
  function owedGo(r, sect){
    var o=siteOrderOf(r);
    if(o) openOrderAt(o.id, sect); else amendFor(r.rid);
  }
  function moneyNeed(m){
    var first=m.rows[0];
    return item('soon','payments','Owed','$:'+m.party, m.since, {who:m.party, what:rm(m.rm)+' past term',
      why:'Handed over '+fmtWhen(m.since)+', due '+fmtWhen(m.due)+'.'+(m.rows.length>1?' '+m.rows.length+' orders; the oldest opens.':''),
      open:function(){ owedGo(first,'[data-sect="money"]'); }}, function(c){
      var b=ghost(['Record payment','need.owed-pay',m.party]); b.addEventListener('click', function(){ owedGo(first,'[data-sect="money"]'); }); c._add(b);
    });
  }
  function goodsNeed(r){
    return item('soon','orders','To hand over','g:'+r.rid, r.date||'', {who:r.party, mark:r.product, what:units(r.units)+' paid, not handed over',
      why:r.date?'Ordered '+fmtWhen(r.date)+'.':'', open:function(){ owedGo(r,'[data-act="order.handed-units"]'); }}, function(c){
      var b=ghost(['Handover','need.owed-hand',r.rid]); b.addEventListener('click', function(){ owedGo(r,'[data-act="order.handed-units"]'); }); c._add(b);
    });
  }
  /* the Watch cards: an override in force, a notice set. 15 Oct 2026 (plan 1, part 5): THE DESK'S OWN COUNT IS NO CARD. "The Desk shows 4 for you" named
     nothing he could act on, and every kind it counts (the master's ordActs: an order placed, a question asked, a payment they say they sent, cash
     to record on goods handed over) is a card of its own here: Order, Message, Payment, and Owed once past its term. */
  function hoursNeed(m){
    var wd=day3('en')[new Date(Date.parse(m.until)+28800000).getUTCDay()];
    return item('watch','watch','Hours','w:hours', '', {who:'Shop', what:(m.open?'Open':'Closed')+' until '+wd+' '+hm(m.until),
      why:'The weekly hours are overridden for now.', open:goPlace('shop','hours')});
  }
  function noticeNeed(lines){
    return item('watch','watch','Notice','w:notice', '', {who:'Shop', what:cut(lines.join(' · ')), why:'This line is at the top of every customer account.', open:goPlace('shop','notice')});
  }
  /* ---- SEND THEM IN TURN (S9 9.6) --------------------------------------------------------------
     One account at a time, in the card's own order: its sign-in link is made as its turn opens, Share is a tap
     of its own (so the share sheet never waits on the making), and once shared the account is ticked sent, the
     site's tick both his devices read, before the next turn opens. Skip leaves one unticked. The run is state
     the card is drawn from, so a redraw of Needs you in the middle of it loses nothing. */
  var turn=null;
  /* S9 fix: a note carried from the turn before (a share whose tick did not save) is drawn on the next turn's
     card; it was cleared here before anything drew it */
  function turnStep(note,err){
    var t=turn; if(!t) return;
    t.j=null; t.copied=false; t.why=note||''; t.whyErr=err||null;
    drawNeeds();
    if(t.i>=t.rows.length) return;
    var at=t.i;
    mintLink(t.rows[at]).then(function(j){ if(turn===t&&t.i===at){ t.j=j; drawNeeds(); } },
      function(e){ if(turn===t&&t.i===at){ t.why=(t.why?t.why+' ':'')+'Could not make their link: '+e.message; t.whyErr=e; drawNeeds(); } });
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
        else { await navigator.clipboard.writeText(t.j.msg); markOut(a.username, t.j); t.copied=true; t.busy=false; t.why='Paste it into a message to them, then tap Sent it.'; t.whyErr=null; drawNeeds(); return; }
      }catch(e){ t.busy=false; t.why='Not shared. Tap Share again, or Skip.'; t.whyErr=null; drawNeeds(); return; }
    }
    var note='', noteErr=null;
    try{ var r=await refs('/all/sent/'+a.username, {issue:sheetIssue, sent:true}); a.sent=r.sent; t.sent.push(a.username); }
    catch(e){ note=(a.code||a.username)+' was shared, but the tick did not save: '+e.message; noteErr=e; }
    t.busy=false; t.i++; countSent(); drawRoster(); turnStep(note,noteErr);
  }
  function turnCard(counts){
    var t=turn, n=t.rows.length, fin=t.i>=n, a=t.rows[t.i];
    var did=t.rows.filter(function(x){ return t.sent.indexOf(x.username)>=0; }).length;
    return item('soon','accounts','Account','s', sendAt(t.rows), {who:fin?'All done':(t.i+1)+' of '+n, what:did+' of '+n+' sent', counts:counts,
      why:fin?(did===n?'Each has their link, and each is ticked sent.':'The ones not ticked are still on Accounts, under Not sent.')
        :(a.code||a.username)+(t.copied?': their message is copied.':t.j?': their link is made. Share it and it is ticked sent.':': making their link.'),
      open:function(){ showPlace('customers','accounts',{fresh:true,push:true}); filterBy('unsent'); }}, function(c){
      var ticks=el('div','achips');
      t.rows.forEach(function(x, k){ var did=t.sent.indexOf(x.username)>=0;
        ticks.appendChild(chip(did?'verdigris':(k===t.i?'brass':'mist'), (x.code||x.username)+(did?', sent':''))); });
      c._body.appendChild(ticks);
      if(fin){ var dn=ghost(['Done','need.turn-done'], true); dn.addEventListener('click', function(){ turn=null; drawNeeds(); }); c._add(dn); }
      else {
        var sh=pill(['','need.turn-share']); sh.textContent=t.copied?'Sent it':'Share'; sh.disabled=!t.j||!!t.busy; sh.addEventListener('click', turnShare);
        var sk=ghost(['Skip','need.turn-skip']); sk.disabled=!!t.busy; sk.addEventListener('click', function(){ if(turn.busy) return; turn.i++; turnStep(); });
        c._add(sh); c._add(sk);
      }
      var tn=noteOf(c); tn.textContent=t.why; withDetails(tn,t.whyErr);
    });
  }
  /* every card there is, ranked: Now before Soon before Watch, a real one before a practice one, the oldest first, those with no age last */
  function needItems(){
    var L=[], real=sheetRows.filter(function(a){ return !a.test; }), orders=makerData&&makerData.orders||[];
    needN=0;
    orders.filter(ordWaits).forEach(function(o){
      var who=codeByUser(o.u), t=!!o.test, to=orderOpener(o.id), pays=ordPays(o);
      if(o.status==='placed') L.push(item('now','orders','Order','o:'+o.id, o.at, {who:who, mark:o.product, what:orderWhat(o), practice:t, open:to}));
      /* a question of theirs on the order that he has not answered (the Worker's awaitingAnswer), as an account's thread is Now when asked */
      if(orderAsked(o)){
        var last=o.msgs[o.msgs.length-1];
        L.push(item('now','messages','Message','om:'+o.id, last.at, {who:who, what:cut(last.text), why:'On their order.', practice:t, open:to}));
      }
      if(pays.length){
        var sum=pays.reduce(function(s,p){ return s+(+p.amount||0); },0), first=pays.map(function(p){ return p.at||''; }).filter(Boolean).sort()[0]||'';
        L.push(item('now','payments','Payment','p:'+o.id, first, {who:who, what:'says they paid '+rm(sum), practice:t, open:to}));
      }
      if(o.again&&o.again.length) L.push(item('soon','orders','Order','a:'+o.id, o.at, {who:who, mark:o.product, what:orderWhat(o),
        why:'A step you rejected waits to be sent again.', practice:t, open:to}));
    });
    waitingClaims().forEach(function(c){
      L.push(item('now','payments','Payment','c:'+c.u+':'+c.id, c.at, {who:codeByUser(c.u), what:'says they paid '+rm(c.amount),
        practice:!!c.test, open:goPlace('orders','payments')}));
    });
    makerThreads.filter(makerThreadAsked).forEach(function(t){ L.push(threadNeed(t)); });
    real.filter(function(a){ return a.account&&a.locked; }).forEach(function(a){ L.push(lockNeed(a)); });
    var rows=pendingRows();
    draftGroups(rows).forEach(function(g){ L.push(rowNeed(g.lead)); });
    Object.keys(needSaid).filter(function(k){ return !rows.some(function(d){ return 'd:'+d.id===k; }); }).forEach(function(k){ L.push(decidedNeed(k, needSaid[k])); });
    (makerData&&makerData.refused||[]).forEach(function(r, i){ L.push(entryNeed(r, 'x:'+i)); });
    (makerData&&makerData.queue||[]).filter(function(e){ return e.state==='refused'; }).forEach(function(e){ L.push(entryNeed(e, 'q:'+e.id)); });
    if(unreadableKeys().length) L.push(unreadableNeed(unreadableKeys()));
    if(owed) owed.money.forEach(function(m){ if(m&&m.rows&&m.rows.length) L.push(moneyNeed(m)); });
    if(owed) owed.goods.forEach(function(r){ if(r&&r.rid) L.push(goodsNeed(r)); });
    unsentList().forEach(function(u){ L.push(unsentNeed(u)); });
    /* a link he has just moved stays where he tapped it, saying what happened, and is no longer counted */
    links.filter(function(r){ return waitingLink(r)||(moved&&moved.id===r.id&&!r.standing&&r.by); }).forEach(function(r){ L.push(linkNeed(r)); });
    real.filter(function(a){ return a.account===false; }).forEach(function(a){ L.push(bareNeed(a)); });
    var fresh=real.filter(function(a){ return a.account&&!a.sent&&!(a.seen&&a.seen.opens); });
    if(turn||fresh.length) L.push(turn?turnCard(fresh.length>0):sendNeed(fresh));
    var manual=makerHours&&makerHours.status&&makerHours.status.source==='manual'&&makerHours.config&&makerHours.config.manual;
    if(manual) L.push(hoursNeed(manual));
    if(makerNotice&&makerNotice.length) L.push(noticeNeed(makerNotice));
    /* within a severity (drawNeeds heads them Now, Soon, Watch): real before practice, then the oldest, then as built */
    return L.sort(function(a, b){
      var d=(a.practice?1:0)-(b.practice?1:0);
      if(d) return d;
      var ta=Date.parse(a.at), tb=Date.parse(b.at);
      if(isFinite(ta)!==isFinite(tb)) return isFinite(ta)?-1:1;
      return (isFinite(ta)&&ta!==tb)?ta-tb:a.n-b.n;
    });
  }
  /* the count on each item of the bars: what waits on him there, a practice item never counted. Shop has none. */
  function drawCounts(items){
    setCount('needs', items.filter(function(i){ return i.sev==='now'&&!i.practice; }).length);
    setCount('orders', (makerData&&makerData.orders||[]).filter(function(o){ return !o.test&&ordWaits(o); }).length+waitingClaims().filter(function(c){ return !c.test; }).length);
    setCount('customers', makerThreads.filter(function(t){ return !t.test&&makerThreadAsked(t); }).length+links.filter(waitingLink).length);
    setCount('record', pendingRows().length);
  }
  function needsReady(){ return NEED_SRC.every(function(s){ return nSrc[s[0]]; }); }
  function needsBad(){ return NEED_SRC.filter(function(s){ return nSrc[s[0]]&&nSrc[s[0]]!=='ok'; }).map(function(s){ return s[1]; }); }
  /* 15 Oct 2026 (plan 1, his word: "Nothing needs you" while its orders read had failed): A READ THAT FAILED LEADS THE PAGE, above the title, in plain
     words and with a Retry, and the all-clear is said only when every read got through. The banner is made once and its words changed, so a redraw
     never takes the Retry from under his finger. */
  var nFail=document.getElementById('nFail'), nRetry=null;
  function drawFail(bad){
    if(!nFail) return;
    nFail.hidden=!bad.length;
    if(!bad.length) return;
    if(!nRetry){
      nFail.textContent=''; nFail.appendChild(el('p','nfail__what'));
      nRetry=pill(['Retry','need.retry']); nRetry.addEventListener('click', function(){ nRetry.disabled=true; nRetry.textContent='Reading.'; readNeeds(true); });
      nFail.appendChild(nRetry);
    }
    nFail.firstChild.textContent='Couldn\\'t read '+andList(bad)+'.';
    if(!needsReading){ nRetry.disabled=false; nRetry.textContent='Retry'; }
  }
  /* the line under the title: Now and Soon as counted, as at the time of drawing; with a read failed it never says nothing needs him */
  function drawLead(items){
    var bad=needsBad(); drawFail(bad);
    if(!needsReady()){ nCount.textContent='Reading what needs you.'; return; }
    var now=0, soon=0;
    items.forEach(function(i){ if(i.practice||!i.counts) return; if(i.sev==='now') now++; else if(i.sev==='soon') soon++; });
    nCount.textContent=now||soon?[now?now+' now':'', soon?soon+' soon':''].filter(Boolean).join(', ')+(bad.length?' in what could be read.':'.')
      :bad.length?'Nothing in what could be read.':'Nothing needs you.';
  }
  function drawNeeds(){
    if(!nlist) return;
    var items=needItems(), shown=items.filter(function(i){ return nKind==='all'||i.kind===nKind; });
    drawCounts(items); drawLead(items);
    /* the chips are the kinds present, and All; one whose kind has gone leaves him on All */
    if(needsReady()){
      var have={}; items.forEach(function(i){ have[i.kind]=1; });
      [].forEach.call(document.querySelectorAll('.nchips button'), function(x){ var k=x.getAttribute('data-chip'); x.hidden=!(k==='all'||have[k]); });
      if(nKind!=='all'&&!have[nKind]){ nKind='all'; shown=items; [].forEach.call(document.querySelectorAll('.nchips button'), function(x){ x.setAttribute('aria-selected', x.getAttribute('data-chip')==='all'?'true':'false'); }); }
    }
    nlist.textContent='';
    if(!shown.length&&needsReady()) nlist.appendChild(el('p','rnone',nKind==='all'&&!needsBad().length?'Nothing needs you.':'Nothing here.'));
    SEVS.forEach(function(s){
      var group=shown.filter(function(i){ return i.sev===s[0]; });
      if(!group.length) return;
      /* Now stands open; Soon and Watch are folded behind their heading and a count, kept as he leaves them across a redraw */
      var h=el(s[0]==='now'?'p':'summary','salt-eyebrow salt-eyebrow--'+SEVC[s[0]]+' nsev', s[1]+(s[0]==='now'?'':' · '+group.length)); h.setAttribute('data-sev', s[0]); if(s[0]!=='now') h.setAttribute('data-act','need.fold.'+s[0]);
      var box=nlist;
      if(s[0]!=='now'){
        box=el('details','nfold'); box.setAttribute('data-sev', s[0]); if(nFoldOpen[s[0]]) box.open=true;
        box.addEventListener('toggle', function(){ nFoldOpen[s[0]]=box.open; });
        nlist.appendChild(box);
      }
      box.appendChild(h);
      group.forEach(function(i){ box.appendChild(i.make()); });
    });
    drawNeedOpen(false);
  }
  function redrawLead(){ drawLead(needItems()); }
  /* ---- READING WHAT NEEDS YOU, on entering it and every 30 seconds while it is showing. Everything it shows is read from the sources the
     other places read, each guarding its own read: none starts while another of its kind is out, and a poll that finds the same answer
     draws nothing. The sheet and the links are read again only after the page has read them once (it does at opening). ---- */
  function readNeeds(force){
    if(needsReading) return;
    if(!force&&needsAt&&Date.now()-needsAt<NEED_MS) return;
    needsReading=true;
    var jobs=[loadMaker(true), loadMakerClaims(true), loadMakerThreads(true), readShop(), loadOwed()];
    /* the sheet and the links are read again once read, or once their read has failed, so a Retry reaches every read that did */
    if((sheet||nSrc.sheet)&&!sheetBusy) jobs.push(loadSheet(true));
    if((linksRead||nSrc.links)&&!linksBusy) jobs.push(loadLinks(true));
    Promise.all(jobs).then(function(){ needsAt=Date.now(); }, function(){}).then(function(){ needsReading=false; redrawLead(); });
  }
  /* what Watch shows: the hours with an override in force, and the notice */
  async function readShop(){
    if(shopReading) return;
    shopReading=true;
    var apply=false;
    try{ var h=await refs('/all/maker/hours'); nGot('hours'); if(changed('hours', h)){ makerHours=h; apply=true; } }
    catch(error){ nGot('hours', error); apply=true; }
    try{ var b=await refs('/all/maker/bulletin'); nGot('notice'); if(changed('notice', b.lines||[])){ makerNotice=b.lines||[]; apply=true; } }
    catch(error){ nGot('notice', error); apply=true; }
    shopReading=false;
    if(apply) drawNeeds();
  }
  /* THE POLL runs only while Needs you or Orders is showing and the page is visible, and stops the moment either stops. */
  function needsWatch(){
    var on=!document.hidden&&!document.body.classList.contains('ended')&&(placeNow==='needs'||placeNow==='orders');
    if(on&&needsTimer===null) needsTimer=setInterval(tickPlace, NEED_MS);
    else if(!on&&needsTimer!==null){ clearInterval(needsTimer); needsTimer=null; }
  }
  function tickPlace(){
    if(document.hidden||(placeNow!=='needs'&&placeNow!=='orders')){ needsWatch(); return; }
    /* viewing an account as them hides this page (stmt/page.js): nothing is read for a page nobody is looking at, and the read goes on when he is back */
    if(roster.hidden) return;
    if(placeNow==='needs') readNeeds(true);
    else { loadMaker(true); loadMakerClaims(true); }
  }
  document.addEventListener('visibilitychange', function(){ needsWatch(); if(!document.hidden&&needsTimer!==null) tickPlace(); });
  document.getElementById('gmake').addEventListener('click', async function(){
    var b=this, intro=document.getElementById('gintro').value,
        label=document.getElementById('glabel').value;
    if(!String(intro||'').trim()){ linkSay('Name the customer whose friend it is.','bad'); return; }
    b.disabled=true; linkSay('Making it...','wait');
    try{
      var j=await refs('/all/refs', {introducer:intro, label:label});
      links.unshift(j.ref); openLinks[j.ref.id]=true; drawLinks();
      document.getElementById('glabel').value='';
      document.getElementById('gintro').value='';
      linkSay('Made. The QR opens it.');
      /* the new link is drawn among the older ones, below the standing five: it is brought into view, as the answer is */
      var fresh=document.querySelector('#glist [data-link="'+j.ref.id+'"]'); if(fresh&&fresh.scrollIntoView) fresh.scrollIntoView({block:'nearest'});
    }catch(e){ linkSay(e.message,'bad',e); }
    b.disabled=false;
  });
  /* 13 Oct 2026 (stress, Medium): Make a link answers under its button (#gmsg), not on the page's one line at the foot of Customers, 4,000px away */
  function linkSay(t,cls,error){
    var m=document.getElementById('gmsg'); if(!m) return;
    m.textContent=t||''; m.className='msg osaid'+(cls?' '+cls:'');
    if(error) withDetails(m,error);
    if(t&&m.scrollIntoView) m.scrollIntoView({block:'nearest'});
  }
  /* ---- THE ASSOCIATES REPORT CARD (v691) ------------------------------------------------------
     One card an associate, per book: what they bought, what they sold for him, what they brought
     in, their share and their stars, and the reward in UNITS with a bar for how far through the
     next one they are. No margin is in the snapshot, so none can be drawn here.
     F9 REVISED (his answers of 28 Sep 2026): every book's progress, and the reward only where the
     snapshot carries one, a tiered book; any other book draws the progress alone, no reward line. */
  async function loadCards(){
    try{ cards=await refs('/all/assoc'); drawCards(); }
    catch(e){ sayFail(e); }
  }
  function bar(frac){
    var w=el('div','pbar'), f=document.createElement('i');
    f.style.width=Math.round((frac||0)*100)+'%';
    w.appendChild(f); return w;
  }
  function cardOf(r){
    var c=el('div','acard salt-glass-card salt-glass-card--radius-md'+(r.departed?' off':''));
    var head=el('div','srow');
    head.appendChild(el('b','acode',r.id));
    var marks=[];
    if(r.founder) marks.push('founder');
    if(r.rank) marks.push('#'+r.rank);
    if(r.departed) marks.push('away');
    if(r.stars) marks.push(new Array(r.stars+1).join('\\u2605'));
    head.appendChild(el('span','un',marks.join(' \\u00b7 ')));
    c.appendChild(head);
    var g=el('div','agrid salt-metrics salt-metrics--sm');
    [['Bought from you',rm(r.bought)],['Sold for you',rm(r.soldFor)],['Introduced',rm(r.introduced)]].forEach(function(p){
      var cell=el('div','acell'); cell.appendChild(el('span','salt-metrics__label',p[0])); cell.appendChild(el('span','salt-metrics__value',p[1])); g.appendChild(cell);
    });
    c.appendChild(g);
    /* 14 OCT 2026 (the layout rework): the counts and the reward are names and values, one to a line, the figures aligned down the right */
    var led=el('div','salt-ledger salt-ledger--plain aled');
    function ledRow(k,v){ var rw=el('div','salt-ledger__row'), l=el('div','salt-ledger__line');
      l.appendChild(el('span','salt-ledger__label',k)); l.appendChild(el('span','salt-ledger__value',String(v))); rw.appendChild(l); led.appendChild(rw); }
    if(r.onward) ledRow('Resales',r.onward);
    if(r.referred) ledRow('Introduced',r.referred);
    if(r.share) ledRow('Share of all revenue',r.share+'%');
    if(r.reward){
      var w=r.reward;
      ledRow('Reward',w.earned+' earned, '+w.taken+' taken, '+(Math.round(w.left*100)/100)+' left'+(w.held?', held while away':''));
    }
    if(led.childElementCount) c.appendChild(led);
    if(r.reward&&r.reward.next!=null){ c.appendChild(bar(r.reward.next)); c.appendChild(el('p','op',Math.round(r.reward.next*100)+'% of the way to the next unit')); }
    return c;
  }
  function drawCards(){
    var wrap=document.getElementById('clist'); if(!wrap) return;
    wrap.textContent='';
    var head=document.getElementById('ccount');
    if(!cards||!cards.products||!cards.products.length){
      if(head) head.textContent='';
      wrap.appendChild(el('p','rnone','No report yet. It comes with the next update.'));
      return;
    }
    if(head) head.textContent='As at '+(cards.at?stampDay(cards.at):'the last publish')+'.';
    cards.products.forEach(function(p){
      wrap.appendChild(pmarkHead('h2',p.product));
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
  var TEST_LINE='Password 0000-0000-0000-0000 for both. Username 0000-0000 can order; 0000-0001 is locked, for paying only.';
  function drawTest(){
    var box=document.getElementById('mTest'); if(!box) return;
    /* a pair made by halves (a tap cut off between its two sends) keeps Make, for the one missing (Fable's review) */
    var have=sheetRows.filter(function(a){ return a.test; }).map(function(a){ return a.username; });
    var need=['0000-0000','0000-0001'].filter(function(u){ return have.indexOf(u)<0; }), on=!need.length;
    box.textContent='';
    box.appendChild(el('p','lead', on
      ? 'Two practice accounts are open. '+TEST_LINE+' Nothing they do is recorded.'
      : have.length ? 'Only practice account '+have[0]+' is open. One tap makes the other.'
      : 'No practice accounts. One tap makes two you can open anywhere: one that can order, one locked. Nothing they do is recorded.'));
    var b=el('button','btn quiet salt-ghost', on?'Remove the practice accounts':'Make the practice accounts'); b.type='button'; actOn(b,'more.test-accounts');
    b.addEventListener('click', async function(){
      b.disabled=true; say(on?'Removing...':'Making...','wait');
      try{
        if(on) await refs('/all/test',{make:false});
        else for(var i=0;i<need.length;i++) await refs('/all/test',await testKeys(need[i]));
        sheet=null; await loadSheet();
        say(on?'Gone, with everything they wrote.':'Made. '+TEST_LINE+' Their examples appear after the next update.');
      }catch(e){ sayFail(e); }
      b.disabled=false; drawTest();
    });
    box.appendChild(b);
  }
  /* a place, an item on More, or a way back: one listener for the whole of his page */
  roster.addEventListener('click', function(ev){
    var bk=ev.target.closest('button[data-back]');
    if(bk){ var way=bk.getAttribute('data-back'); if(way==='accounts') openCard(null); else if(way==='orders') closeOrder(); else if(way==='form') closeForm(); return; }
    var b=ev.target.closest('button[data-m]'); if(b){ var mm=b.getAttribute('data-m'); showPlace(mm, mm===placeNow?partNow:'', {fresh:true,push:true}); return; }
    var k=ev.target.closest('button[data-chip]');
    if(k){ nKind=k.getAttribute('data-chip'); [].forEach.call(document.querySelectorAll('.nchips button'), function(x){ x.setAttribute('aria-selected', x===k?'true':'false'); }); drawNeeds(); return; }
    var t=ev.target.closest('button[data-part]'); if(t) showPlace(t.parentNode.getAttribute('data-place'), t.getAttribute('data-part'), {push:true});
  });
  /* the + orb opens Record's menu of entries */
  var oAdd=document.getElementById('oAdd');
  if(oAdd) oAdd.addEventListener('click', function(){ showPlace('record','entry',{fresh:true,push:true}); });
  document.getElementById('afil').addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-f]'); if(b) filterBy(b.getAttribute('data-f'));
  });
  rq.addEventListener('input', drawRoster);
  showPlace('needs','',{fresh:true});
  /* the home itself needs the account list and the links: Needs you is read off both (S9 9.1) */
  loadSheet(); loadLinks();
  /* an address he opened the page on (#orders, #customers/links, the old #maker): the place it names, over the home */
  if(location.hash){
    var first=addrOf(location.hash);
    if(first){
      showPlace(first.place, first.part, {fresh:true});
      try{ history.replaceState(null,'',addrFor(placeNow, partNow)); }catch(e){}
    }
  }
  /* 11 Oct 2026, HIS WORD: SALT ACCOUNT HAS ITS OWN NIGHT OR TIDE, per device. The head script has set the stored theme (Tide until one is
     chosen); the choice Sheet is the customer's (stmt/page.js, lookAsk), asked once when this page opens on a device that holds none, and
     Shop > This device holds the switch. The rest of the look (kept in localStorage salt-look on this origin, applied at once, no
     reload) is the page's own and is shared. An Access lapse, which ended() reads on a request's answer, takes the Sheet down. */
  lookAsk(null, true);
`;
