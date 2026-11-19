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
 * action on it; Orders, the Counter's orders by stage, Approve, the payments customers say they sent and the group orders;
 * Customers, the accounts (one list, read off /all/sheet, the publish's account list merged with the opens this
 * Worker records, a row opening the account's card), their messages, guest links and the associates' report card;
 * Record, his own entries (Approve, the Desk's rows waiting for him, is under Orders); and Shop, the hours, the notice, the practice
 * accounts and This device, whose Look is Night or Tide for this page. View as them opens the account the customer's own way,
 * through the form. */

import { MAKER_GEO_JS } from "./maker-geo.js";
import { TEST_USERS } from "./testusers.js";

export const OWNER_JS = `
  var makerGeo=${MAKER_GEO_JS};
  var mHome=document.getElementById('mHome'), oAccts=document.getElementById('oAccts'),
      oLinks=document.getElementById('oLinks'), aopen=document.getElementById('aopen'),
      sheet=null, sheetAt=null, sheetRows=[], sheetIssue=null, cards=null, sheetBusy=false, sheetSpares=null;
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
  /* the test surface (his answers of 18 Oct 2026): true on Salt Admin under /all/test alone, where it reads the example orders, their
     payments and chats, and nothing else (no account list, links, inputs, notice or book) */
  var TESTING=/*__TESTING__*/false;
  var placeNow='needs', partNow='', PARTS={}, fOpen=null;
  [].forEach.call(document.querySelectorAll('.aparts'), function(strip){
    /* PARTS is a place's parts in the order its strip draws them */
    var pl=strip.getAttribute('data-place'); PARTS[pl]=(PARTS[pl]||[]).concat([].map.call(strip.querySelectorAll('[data-part]'), function(b){ return b.getAttribute('data-part'); }));
  });
  /* 2 Nov 2026: Approve has no control of its own on Orders (the bar's Approve reaches it), so its address is listed here, and the old stage addresses
     (#orders/ready) land on the part that holds that stage now */
  /* 18 Nov 2026 (his answer D): Orders' More list is gone. Payments they sent keeps its part and address (Needs you's cards, his alerts and the test surface open it), and so
     does Ledger check, which the bar's indicator opens from every place */
  if(PARTS.orders){ PARTS.orders.push('payments'); if(!TESTING) PARTS.orders.push('approve','ledger'); }
  var PART_ALIAS={placed:'todo', confirmed:'open', ready:'open', paid:'open'};
  /* what a place reads when it is entered, and what a part reads when it is entered. The stages of Orders are one list that its
     place reads once, so moving between them is a filter and never a second read. */
  var PLACE_READ={
    needs:function(){ drawNeeds(); readNeeds(); },
    orders:function(){ loadMaker(); loadMakerClaims(); },
    record:function(){ loadMakerInputs(); }
  };
  var PART_READ={
    'orders.approve':function(){ loadMaker(); },
    'orders.ledger':function(){ loadLedger(); },
    'customers.accounts':function(){ drawRoster(); if(!sheet&&!sheetBusy) loadSheet(); },
    'customers.messages':function(){ loadMakerThreads(false); },
    'customers.links':function(){ if(linksRead) drawLinks(); else if(!linksBusy) loadLinks(); },
    'customers.associates':function(){ if(!cards) loadCards(); else drawCards(); },
    'shop.hours':function(){ loadMakerHours(); loadMakerPoints(); },
    'shop.notice':function(){ loadMakerBulletin(); },
    'shop.group':function(){ loadMakerPools(); },
    'shop.market':function(){ loadMarket(); },
    'shop.calendar':function(){ loadCalendar(); },
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
  /* 17 Oct 2026: Approve moved from Record to Orders, as the Desk's Order book took it; the old address #record/approve lands there */
  /* 18 Nov 2026 (his answer D): Group orders is a part of Settings; its old address under Orders lands there */
  var PART_ADDR={'record/approve':['orders','approve'], 'orders/group':['shop','group']};
  /* 9 Nov 2026, his word (every Desk conclusion leads to the correct path): the Desk's Act links land here through its /admin, which passes only
     the addresses its ADMIN_TO lists. Three name one thing rather than a place: row/<rid> opens that row in the sale form (as Ledger check's tap),
     acct/<code> that account's card, tip/<id> Desk reminders with that reminder chosen. Each is a want, read once and then left for the place. */
  var WANTS={row:/^[slp][0-9]{1,6}$/, acct:/^[A-Z0-9]{2,4}(-[A-Z0-9]{1,6}){1,2}$/, tip:/^[A-Za-z0-9:._+-]{1,120}$/, market:/^(off|on)$/};
  /* 11 Nov 2026 (the price band's version 2): market/off and market/on open Shop's Market part with the switch's question ready; anchor/<size>/<price> opens it with the
     re-anchor form filled, nothing sent. Each is a want, as the others are. */
  var ANCHOR_Q=/^[0-9]{1,3}([.][0-9]{1,2})?$/, ANCHOR_P=/^[0-9]{1,5}$/;
  function addrOf(h){
    var t=String(h||'').replace(/^#/,'').split('/'), k=t[0];
    if(k==='anchor'&&t.length===3) return ANCHOR_Q.test(t[1])&&ANCHOR_P.test(t[2])&&+t[1]>0&&+t[2]>0?{place:'shop', part:'market', want:['anchor',t[1]+'/'+t[2]]}:null;
    if(Object.prototype.hasOwnProperty.call(WANTS,k)&&t.length===2){ var key=''; try{ key=decodeURIComponent(t[1]); }catch(e){ key=''; }
      return WANTS[k].test(key)?{place:k==='acct'?'customers':k==='market'?'shop':'record', part:k==='acct'?'accounts':k==='tip'?'pricing':k==='market'?'market':'entry', want:[k,key]}:null; }
    if(Object.prototype.hasOwnProperty.call(PART_ADDR,k+'/'+t[1])){ var m=PART_ADDR[k+'/'+t[1]]; return {place:m[0], part:m[1]}; }
    if(!Object.prototype.hasOwnProperty.call(ADDR,k)) return null;
    var a=ADDR[k], part=t[1]||a[1];
    if(a[0]==='orders'&&Object.prototype.hasOwnProperty.call(PART_ALIAS,part)) part=PART_ALIAS[part];
    return {place:a[0], part:(PARTS[a[0]]||[]).indexOf(part)>=0?part:''};
  }
  /* o.fresh reads the place again (a tap on its item, as entering Maker always read it); o.push writes the address, so Back and
     Forward move between places */
  function showPlace(place, part, o){
    o=o||{};
    if(place!=='needs'&&!PARTS[place]) place='needs';
    var parts=PARTS[place]||[];
    if(place==='orders'&&Object.prototype.hasOwnProperty.call(PART_ALIAS,part)) part=PART_ALIAS[part];
    if(!parts.length) part=''; else if(parts.indexOf(part)<0) part=parts[0];
    var fresh=!!o.fresh||place!==placeNow, moved2=place!==placeNow||part!==partNow;
    placeNow=place; partNow=part;
    /* the order whose card is open is closed by leaving the place or the part (Phase 1c) */
    if(moved2&&(ordOpened||placeNow==='orders')){ ordOpened=null; drawOrderPane(); }
    /* so is the form open on Record: leaving the part or the place closes it; the + orb is not shown on Record, where the parts are one tap away */
    if(moved2) fOpen=null;
    [].forEach.call(document.querySelectorAll('#oAdd'), function(add){ add.hidden=placeNow==='record'; });
    if(!inChat()) stopMakerChat();
    /* the picture is let go when Waiting on you is left; the one unlock is the page's and stays (PHASE 4b), going only with the lock */
    if(!inClaims()) makerSlipClose();
    /* so is the claim opened, and the line of the last answer: the claims are drawn again, every card shut, so a part left shows as it will be found */
    if(!inClaims()&&(makerClaimOpen||makerClaimSaid)){ makerClaimOpen=null; makerClaimSaid=''; drawMakerClaims(); }
    [].forEach.call(document.querySelectorAll('.place[data-m]'), function(b){
      if(b.getAttribute('data-m')===placeNow&&(!b.getAttribute('data-p')||b.getAttribute('data-p')===partNow)) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    [].forEach.call(document.querySelectorAll('.aparts button[data-part]'), function(b){
      var on=b.parentNode.getAttribute('data-place')===placeNow&&b.getAttribute('data-part')===partNow;
      b.setAttribute('aria-selected', on?'true':'false');
      if(b.classList.contains('amb-segment__opt')){ b.setAttribute('aria-pressed', on?'true':'false'); b.removeAttribute('aria-selected'); }   /* 16 Nov 2026 (Ambient): Record's and Shop's parts are a Segment, pressed not selected */
      /* a strip scrolls sideways on a narrow screen: the part he is in is brought into view */
      var sp=b.parentNode; if(on&&sp.scrollWidth>sp.clientWidth) sp.scrollLeft=Math.max(0,b.offsetLeft-sp.offsetLeft-12); });
    ordSegPaint();
    sweep();
    moodSet();
    if(placeNow==='orders'&&moved2&&makerData) paintOrdStatus();
    say('');
    unsentPaint();
    if(fresh&&PLACE_READ[placeNow]) PLACE_READ[placeNow]();
    if(PART_READ[placeNow+'.'+partNow]) PART_READ[placeNow+'.'+partNow]();
    if(!ledgerAt||Date.now()-ledgerAt>600000) ledgerRead();
    /* Fable's review (18 Nov 2026): the indicator is pressed while its own view is open, so the bar says where he is */
    [].forEach.call(document.querySelectorAll('[data-ledger]'), function(b){ var on=placeNow==='orders'&&partNow==='ledger'?'true':'false'; if(b.getAttribute('aria-pressed')!==on) b.setAttribute('aria-pressed',on); });
    if(o.push){ var to=addrFor(placeNow, partNow); if(location.hash!==to){ try{ history.pushState(null,'',to); }catch(e){} } }
    if(fresh) pageTop();
    needsWatch();
  }
  /* Back, Forward and an address typed in: the place the address names, and nothing written back. Not while an account is viewed
     as them, which has the page's own bar and no places. */
  function fromAddress(){
    if(view) return;
    var a=location.hash?addrOf(location.hash):{place:'needs', part:''};
    if(!a) return;
    if(a.want){ try{ history.replaceState(null,'',addrFor(placeNow,partNow)); }catch(e){} wantGo(a.want); return; }
    var part=a.part||(PARTS[a.place]||[])[0]||'';
    if(a.place===placeNow&&part===partNow) return;
    showPlace(a.place, part);
  }
  window.addEventListener('popstate', fromAddress);
  window.addEventListener('hashchange', fromAddress);
  /* ---- WHERE AN ACCOUNT STANDS ---------------------------------------------------------------
     The list is the roster, so a code with no account behind its username is still on it and
     says so. Everything else comes from /all/sheet. */
  var FLAGW={owes:'They owe',goods:'You owe them',refund:'Their credit, off their next order,',pend:'Agreed, not handed over,',clear:'Settled'};
  /* 23 SEP 2026: THE ACCOUNT IS ONE LIVE DOCUMENT (v769), so there is no issue for an account to be
     missing from. A row with no totals is a username with nothing behind it, and that is what it
     says. D15 (24 Sep 2026): the fold binds a spare account at Add ID and this run's publish opens it,
     so a row reads this only when no spare was free, and the laptop's next update makes it. */
  function waitLine(){ return 'Their account comes with the next update.'; }
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
      if(!changed('sheet',[j.accounts,j.desk,j.issue,j.spares])&&quiet===true) return;
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null;
      sheetSpares=typeof j.spares==='number'&&j.spares>=0?j.spares:null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      liveSheet();   /* 20 Nov 2026: each account's credit is the Desk's, not the sealed statement's (liveAcct) */
      if(!TESTING&&!owedReading&&Date.now()-owedAt>5000) loadOwed();
      drawRoster(); drawTest(); drawNeeds(); drawNeedOpen(true); joinsDrive();
      if(aOpen) openCard(aOpen);
      /* the count is of accounts on the book: the test account is not one (v689) */
      var real=sheetRows.filter(function(a){ return !a.test; }).length;
      document.getElementById('mFoot').textContent=real+' accounts';   /* 15 Nov 2026: the line under Customers' title (it was the rail's foot) */
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
    try{ if(hoSheet.box.close) hoSheet.box.close(); }catch(e){}
    hoSheet.box.remove(); hoSheet=null;
    try{ if(from) from.focus(); }catch(e){}
  }
  function svgEl(tag, attrs){
    var e=document.createElementNS('http://www.w3.org/2000/svg', tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  /* rectangles, one a run of dark modules, as engine/qr.mjs's qrRectSvg draws them: a stroked path does not scan. 16 Nov 2026 (Ambient): the symbol is the code frame's own, four modules of quiet zone in its viewBox, dark modules on the frame's white field */
  function qrRects(rows){
    var n=rows.length, q=4, span=n+q*2;
    var svg=svgEl('svg', {viewBox:'0 0 '+span+' '+span, role:'img', 'aria-label':'A code their camera opens, signed in'});
    svg.setAttribute('role','img'); svg.setAttribute('class','amb-codeframe__code');
    var g=svgEl('g', {fill:'#000'});
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
    var box=sheetNode('hoSheet','ho','hoT'), head=el('div','amb-sheet__head'), body=el('div','amb-sheet__body'), title=el('h2','amb-sheet__title','Sign in on their phone'); title.id='hoT';
    var x=el('button','amb-circle'); x.type='button'; x.setAttribute('aria-label','Close'); actOn(x,'code.close'); x.appendChild(ambIcon('close'));
    head.appendChild(title); head.appendChild(x); box.appendChild(head); box.appendChild(body);
    body.appendChild(el('p','ho-for','For '+a.username+'.'));
    var wait=el('p','ho-wait','Making a code...'); body.appendChild(wait);
    var me=hoSheet={box:box, from:from};
    x.addEventListener('click', closeHo);
    sheetShow(box, closeHo);
    box.addEventListener('keydown', function(e){ if(e.key==='Escape'){ e.stopPropagation(); closeHo(); } });
    try{ box.focus({preventScroll:true}); }catch(e){}
    try{
      var k=await keyFor(a);
      var j=await refs('/all/handover', {u:a.username, token:k.token, wrap:k.wrap});
      k=null;
      if(hoSheet!==me) return;
      wait.remove();
      var fig=el('figure','amb-codeframe'), fld=el('div','amb-codeframe__field');
      fld.appendChild(qrRects(j.qr||[])); fig.appendChild(fld); fig.appendChild(el('figcaption','amb-codeframe__caption','Their camera opens it, signed in'));
      body.appendChild(fig);
      var p=klBits(j.exp);
      var cf=el('label','amb-field'), lab=el('span','amb-field__label','Or type this code where Salt Counter asks for one');
      var inp=el('input','amb-input amb-input--code'); inp.id='hoC'; inp.readOnly=true; actOn(inp,'code.value');
      inp.setAttribute('autocomplete','off'); inp.setAttribute('spellcheck','false');
      inp.value=String(j.code||'').replace('-',' ');
      cf.appendChild(lab); cf.appendChild(inp);
      cf.appendChild(el('span','amb-field__hint','Works once, until '+p.hour+':'+p.minute+'.'));
      body.appendChild(cf);
    }catch(e){
      if(hoSheet!==me) return;
      wait.className='amb-field__error'; refusal(wait,e,'Could not make a code: ');
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
    if(b.note){ b.note.textContent=m.note||''; b.note.className='amb-settings__foot anote'+(m.bad?' bad amb-neg':''); withDetails(b.note,m.err); }
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
    var u=a.username, b=el('button','amb-pill amb-pill--block apill','Send a sign-in link'); b.type='button';
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
  function onWhat(where){ return where?' on '+String(where).replace(/^An? /,function(m){ return m.toLowerCase(); }):''; }
  /* an event of the account, read only: what it was and where, and when; a row with a control of its own stands as Ambient's row does, the control at its trail */
  function aEvent(title, sub, when, hot){
    var li=el('li','amb-row'), tx=el('span','amb-row__text');
    tx.appendChild(el('span','amb-row__title',title)); if(sub) tx.appendChild(el('span','amb-row__sub',sub)); li.appendChild(tx);
    if(when!=null){ var tr=el('span','amb-row__trail amb-row__trail--stack'); tr.appendChild(el('span','amb-row__age'+(hot?' amb-neg':''),when)); li.appendChild(tr); }
    return li;
  }
  function drawStory(box, a){
    var s=story[a.username];
    box.textContent='';
    box.appendChild(el('h2','amb-section','Sign-ins'));
    var list=el('ul','amb-list amb-list--ruled astory__list'), L=a.locked;
    if(L) list.appendChild(aEvent('Password','Too many wrong passwords'+(L.until?', until '+hm(L.until):''),'Locked out',true));
    var log=(s&&s.log)||[];
    log.forEach(function(x){
      var sub=HOWT[x.how]?HOWT[x.how]+onWhat(x.where):x.where?String(x.where):'';
      list.appendChild(aEvent(HOWW[x.how]||'Signed in', sub, fmtWhen(x.at)));
    });
    if(!s) box.appendChild(el('p','amb-empty','Reading.'));
    else if(s.err) list.appendChild(aEvent('Not read', s.err, null));
    else if(!log.length) list.appendChild(a.seen&&a.seen.opens
      ?aEvent('Last opened', 'Earlier sign-ins were not kept.', dayMon(a.seen.last)+(howOf(a.seen)?' '+howOf(a.seen):''))
      :aEvent('Not opened yet', null, a.sent?'Sent '+dayMon(a.sent):null));
    if(list.firstChild) box.appendChild(list);
    /* S9 9.4: PHONES AND COMPUTERS, off the account's own pointers: each device named as its browser described itself when it signed in, when it came and
       when it was last used, whether it is kept signed in, and a Sign out of its own */
    var devs=(s&&s.devices)||[], dh=el('h2','amb-section dhead','Phones and computers');
    if(devs.length) dh.appendChild(el('span','amb-section__note dcount',String(devs.length)));
    box.appendChild(dh);
    var dl=el('ul','amb-list amb-list--ruled adevs');
    devs.forEach(function(d){
      var li=aEvent(d.label||'An older device', d.kept?'Kept since '+dayMon(d.at)+', used '+when(d.last):'Not kept, signed in '+when(d.at), null);
      var tr=el('span','amb-row__trail'), so=aPill('Sign out','acct.device-signout',d.id,true,true);
      so.addEventListener('click', function(){ endOne(a, d, so); });
      tr.appendChild(so); li.appendChild(tr); dl.appendChild(li);
    });
    if(s&&!s.err&&!devs.length) box.appendChild(el('p','amb-empty','None signed in. A sign-in link or a code signs them in.'));
    var nodev=s&&!s.err&&!devs.length;   /* 17 Nov 2026 (the second red fix): the heading stays over its None signed in line, as it did before the move to Ambient */
    if(dl.firstChild) box.appendChild(dl); else if(!nodev) dh.remove();
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
  /* 25 OCT 2026 (canvas Salt Admin Customers, P2; his yes to Asks A to J): AN ACCOUNT LEADS WITH WHERE IT STANDS. The head: the state and its age, as its
     card on the list says them, the code and the username, and what is owed, large at the right (ember when late or when he owes it back); under it a
     ledger of the standing (locked out, opened and how, marked sent, notifications) and, when a line of theirs waits, the way to it. Then Sign-in, the
     ways in on one card: Send a sign-in link filled, Show a code, View as them, Order for them and Copy password two by two, Sign out everywhere asking
     once. The Sent tick goes (his yes to Ask F): Mark as sent while it is not, and Marked sent in the ledger once it is. */
  function acctFig(a){
    var t=a.t||{}, s=acctState(a);
    if(a.test||a.account===false) return null;
    if(a.flag==='owes') return {word:'They owe', fig:rmShort(t.owed), hot:!!s.late};
    if(a.flag==='refund') return {word:'Their credit', fig:rmShort(t.refund), hot:true};   /* 27 Oct 2026: an open refund is their credit */
    if(a.flag==='goods') return {word:'You owe them', fig:units(Math.round((+t.toGet||0)*100)/100), hot:false};
    if(a.flag==='pend') return {word:'Agreed', fig:rmShort(t.pend), hot:false};
    return {word:'Owed', fig:'Nil', hot:false};
  }
  /* a button made by makerButton on an action row of a group: the button and its Discard each a row of the list, the Discard standing only while it is shown */
  function aActBtn(group, label, action, onSuccess, danger){
    var b=makerButton(group, label, action, false, onSuccess), cancel=b.nextSibling;
    aAct(b, danger); aAct(cancel); group.add(b); group.add(cancel); return b;
  }
  function acctLine(L, k, v){ var r=aLine(k, v); r.setAttribute('data-line',k); L.add(r); return r; }
  function acctCard(a){
    /* 16 Nov 2026, THE MOVE TO AMBIENT (place H): THE ACCOUNT IN AMBIENT'S PARTS. Its head is the code over where it stands (a chip for the state, its age, the username) and what is owed,
       then where it stands as a settings group, their messages a row that goes there, Sign-in as action rows, what prices them and what they hold, their sign-ins and devices,
       and, in ember and alone in their group, Copy password and Sign out everywhere, each asking on the Sheet first. The one main action, Send a sign-in link, is the foot of the
       pane. Every control keeps its act. */
    var u=a.username, none=a.account===false, why='No account yet';
    var c=el('section','oacct scard'); c.setAttribute('data-acct', u);
    var head=el('div','asec ahead'), s=acctState(a), f=acctFig(a), line=el('p','ahead__line');
    head.appendChild(whoTag(el('h2','amb-section'+(a.test?'':' ahead__code'),a.test?testName(a):(a.code||u)),a.test?'':a.code));
    line.appendChild(el('span','amb-chip ahead__kind'+(s.sev==='now'?' amb-chip--neg':s.sev==='soon'?' amb-chip--warn':''),s.word));
    if(s.age) line.appendChild(el('span','nage'+(s.late?' amb-neg nage--late':''),s.age));
    line.appendChild(el('span','un',u));
    head.appendChild(line);
    if(f){ var fb=amb.node(amb.stat(f.word,f.fig)); fb.classList.add('ahead__fig'); if(f.hot) fb.querySelector('.amb-stat__value').classList.add('amb-neg'); head.appendChild(fb); }
    c.appendChild(head);
    var stand=aGroup(null,'astand'); stand.setAttribute('aria-label','Where it stands');
    function standRow(k, v, hot){ var r=aLine(k, v, hot); r.setAttribute('data-line',k); stand.add(r); return r; }
    function standDraw(){
      stand.list.textContent='';
      if(a.test){ standRow('Practice','Nothing recorded'); return; }
      if(none){ standRow('Account','Next update'); return; }
      if(a.locked) standRow('Locked out',a.locked.until?'until '+hm(a.locked.until):'now',true);
      standRow('Opened',a.seen&&a.seen.opens?dayMon(a.seen.last)+(howOf(a.seen)?' '+howOf(a.seen):''):'Not yet');
      if(a.sent) standRow('Marked sent',dayMon(a.sent));
      if(a.alerts) standRow('Notifications','On');
    }
    standDraw();
    if(a.test) stand.foot('A practice account. Nothing it does is recorded.').classList.add('atot');
    else if(none) stand.foot(waitLine()).classList.add('atot');
    c.appendChild(stand);
    var th=(makerThreads||[]).filter(function(x){ return x.u===u&&!x.test&&makerThreadAsked(x); })[0];
    if(th){
      /* their line waiting for his reply: a row that goes to the thread */
      var last=th.msgs[th.msgs.length-1], tl=aGroup(null,'athread'), rp=aOpens('Their messages','Waiting '+ageOf(last.at),'acct.reply',u);
      rp.addEventListener('click', function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(u); }); tl.add(rp); c.appendChild(tl);
    }
    var sign=aGroup('Sign-in','asign'); sign.setAttribute('aria-label','Sign-in');
    var mark=aBtn('Mark as sent','amb-action','acct.sent');
    var pn=sign.foot(''); pn.className='amb-settings__foot anote'; pn.setAttribute('role','status');
    var gn=null;
    var hob=aBtn('Show a code','amb-action','acct.show-code'), open=aBtn('View as them','amb-action','acct.view-as'), orderFor=aBtn('Order for them','amb-action','acct.order-for');
    var pwb=aBtn('Copy password','amb-action amb-action--danger','acct.password'), sob=aBtn('Sign out everywhere','amb-action amb-action--danger','acct.signout-all');
    sob.classList.add('asignout');
    [hob, open, orderFor, mark].forEach(function(b){ sign.add(b); });
    [hob, open, orderFor, pwb, sob].forEach(function(b){ if(none){ b.disabled=true; b.title=why; } });
    if(!none&&!a.pwMaster){ pwb.disabled=true; pwb.title='Password not stored yet.'; }
    /* the one main action and its answer are the pane's foot, pinned at the foot of the open account */
    var afoot=el('div','amb-foot afoot');
    afoot.appendChild(sendPill(a, pn, function(){ standDraw(); markShow(); }));
    hob.addEventListener('click', function(){ if(!none) showHandover(a, hob); });
    /* S9 9.5: View as them, their own page, read only */
    open.addEventListener('click', function(){ openAcct(a); });
    orderFor.addEventListener('click', function(){ makerForAccount(a); });
    /* 2 Nov 2026: asked on the Sheet first, as every row in ember is; then opened and copied as before */
    pwb.addEventListener('click', async function(){
      if(none||!a.pwMaster) return;
      if(!await ownerAsk(pwb,'acct.password:'+u,{title:'Copy their password?', plain:true, go:'Copy it', keep:'Not now',
        say:['It goes to this phone’s clipboard, for you to give to them.']})) return;
      pwb.disabled=true; pwb.textContent='Opening...';
      try{
        var pw=await unseal(OWNER.master, a.pwMaster);
        await navigator.clipboard.writeText(pw);
        pw=null;
        pwb.textContent='Password copied';
      }catch(e){ pwb.textContent='Could not open it'; }
      setTimeout(function(){ pwb.textContent='Copy password'; pwb.disabled=false; }, 2200);
    });
    /* SIGN OUT EVERYWHERE: a forwarded link or a lost phone stays signed in while it is used, so this ends every device, link, code and alert on the account
       (S9 9.4), sparing the link this page made as the account opened and has not sent, and says what it ended; a new link or a code signs them back in.
       2 Nov 2026: asked on the Sheet, in place of a second tap within four seconds */
    sob.addEventListener('click', async function(){
      if(none) return;
      if(!await ownerAsk(sob,'acct.signout-all:'+u,{title:'Sign out everywhere?', go:'Sign out everywhere', keep:'Not now',
        say:['Every phone, link, code and alert on this account ends. A new link or a code signs them back in.']})) return;
      sob.disabled=true; sob.textContent='Signing out...';
      try{ var j=await refs('/all/signout', {u:u, keep:await linkId(u)}); gn.textContent=endedLine(j); gn.className='amb-settings__foot anote'; }
      catch(e){ gn.textContent='Could not sign out: '+e.message; gn.className='amb-settings__foot anote bad amb-neg'; }
      sob.textContent='Sign out everywhere'; sob.disabled=false;
      loadStory(a);
    });
    function markShow(){ var off=!!a.sent||none||!!a.test; mark.hidden=off; mark.parentNode.hidden=off; }
    markShow();
    mark.addEventListener('click', async function(){
      mark.disabled=true;
      try{
        var j=await refs('/all/sent/'+u, {issue:sheetIssue, sent:true});
        a.sent=j.sent; standDraw(); markShow(); say(''); countSent(); drawRoster(); drawNeeds();
      }catch(e){ sayFail(e); }
      mark.disabled=false;
    });
    c.appendChild(sign);
    if(!none&&!a.test&&a.code){ var more=el('div','amore'); c.appendChild(more); acctMore(more, a); }
    /* 14 OCT 2026 (his decision): everything related to a customer is on their card, so their loans and their reward stand here, read from the Desk's catalogue */
    var books=el('section','asec abooks'); books.setAttribute('data-loans', u); books.setAttribute('aria-label','Loans and reward');
    if(!none&&!a.test&&a.code){ c.appendChild(books); drawBooks(books, a); }
    var sty=el('section','asec astory'); sty.setAttribute('data-story', u); sty.setAttribute('aria-label','Sign-ins');
    if(!none){ c.appendChild(sty); drawStory(sty, a); loadStory(a); }
    /* what ends or removes, last and alone in its group */
    var endList=aGroup(null,'aend'); endList.add(pwb); endList.add(sob); gn=endList.foot('');
    gn.className='amb-settings__foot anote'; gn.setAttribute('role','status');
    c.appendChild(endList); c.appendChild(afoot);
    return c;
  }
  /* 26 OCT 2026 (canvas Salt Admin Customers, P3 and P4; his yes to Asks A, B and G): WHAT PRICES A CUSTOMER STANDS ON THEIR CARD. Their % moved here from
     Record: a book a choice, the suggestion and why, a stepper in whole steps of 5 from the book's low to its high (his alone; nothing sets it but his Send, and it goes to
     Approve), their prices at that % off the Desk (drift-preview) against the Floor, Send at that % only once it differs from what is set, Use the
     suggestion, Set back to 0. Then This customer (salt) and the associate reward, read by the account's code (customer-of, reward-of), and Partner, which
     asks once. Nothing on the card prices: every figure is the Desk's. 16 Nov 2026 (Ambient): the stepper walks its values (Ambient 0.7.2). */
  var pctOn={}, pctReads={}, ofReads={}, ofWait={};
  function pctWord(n){ return n>0?'+'+n+'%':n<0?'−'+(-n)+'%':'0%'; }
  /* 18 Nov 2026 (his word: "a smooth slider that moves in steps of 5 rather than a long options list", for every personalised %): A CUSTOMER'S %
     IS AMBIENT'S SLIDER (0.7.29), whole steps of 5 from the book's low to its high, its figure in words beside its label (say), moved by the arrow keys
     a step at a time. o: {label:[words, act, key, book], min, max, value (whole %), say(whole), step}. The range's input fires the words alone; its
     change (a release, a key) is the app's. */
  function pctSlider(o){
    var L=labOf(o.label), id='mslide'+(++tileSeq), box=el('div','amb-field amb-slider mslide'), head=el('span','amb-slider__head'), lab=el('label','amb-field__label',L[0]),
      out=el('output','amb-slider__value'), r=actOn(el('input','amb-slider__input'),L[1],L[2]), ends=el('span','amb-slider__ends'), say=o.say||pctWord;
    if(L[3]){ lab.appendChild(document.createTextNode(' ')); lab.appendChild(bookChip(L[3])); }
    lab.setAttribute('for',id); out.setAttribute('for',id); r.id=id; r.type='range';
    r.min=String(o.min); r.max=String(o.max); r.step=String(o.step||5);
    ends.setAttribute('aria-hidden','true'); ends.appendChild(el('span',null,say(o.min))); ends.appendChild(el('span',null,say(o.max)));
    head.appendChild(lab); head.appendChild(out); box.appendChild(head); box.appendChild(r); box.appendChild(ends);
    box.input=r;
    /* the words: what it is set to, or another word when nothing is set (Not set) */
    box.say=function(whole,words){ var t=words!=null?words:say(whole); out.textContent=t; r.setAttribute('aria-valuetext',t); };
    box.put=function(whole){ r.value=String(whole); box.say(whole); };
    r.addEventListener('input',function(){ box.say(Math.round(+r.value)); });
    box.put(o.value==null?0:o.value);
    return box;
  }
  function acctMore(box, a){
    readParty().then(function(cat){ if(box.isConnected) drawMore(box, a, cat||{}); }, function(){ if(box.isConnected){ box.textContent=''; box.appendChild(el('p','amb-field__hint anote bad amb-neg','Their prices could not be read.')); } });
  }
  function drawMore(box, a, cat){
    box.textContent='';
    var code=a.code, partner=(cat.partners||[]).indexOf(code)>=0, waiting=(cat.partnerWaiting||[]).indexOf(code)>=0;
    var books=(cat.products||[]).filter(function(x){ return x.drift; }).map(function(x){ return x.product; });
    if(books.length&&(cat.driftCustomers||[]).indexOf(code)>=0) box.appendChild(pctSection(a, cat, books, partner));
    var cust=el('section','asec acust'), rwd=el('section','asec arwd'); cust.setAttribute('aria-label','This customer'); rwd.setAttribute('aria-label','Associate reward');
    cust.hidden=rwd.hidden=true; box.appendChild(cust); box.appendChild(rwd);
    readingOf('customer-of', code, function(r){ paintCust(cust, r); });
    readingOf('reward-of', code, function(r){ paintRwd(rwd, r); });
    if(books.length&&(partner||waiting||(cat.driftCustomers||[]).indexOf(code)>=0&&/^C/.test(code)&&!/-Gen$/.test(code))) box.appendChild(partnerSection(a, partner, waiting));
    var rs=refundSection(a, cat); if(rs) box.appendChild(rs);
  }
  /* 29 OCT 2026 (S5f-5, his answer to Ask A): a refund the book still owes them, marked paid or taken off as stale. Each asks once and goes to Approve as an edit; nothing here moves cash. The refund is named by its day and amount, as the Desk holds it. */
  function refundSection(a, cat){
    var mine=(cat.openRefunds||[]).filter(function(r){ return r.party===a.code||r.party===a.code+'-R'; });
    if(!mine.length) return null;
    var s=el('section','asec arefund'); s.setAttribute('aria-label','Refunds');
    s.appendChild(el('h2','amb-section','Refunds'));
    mine.forEach(function(r){
      var waits=(cat.editWaiting||[]).some(function(w){ return w.party===r.party&&w.since===r.since&&+w.amount===+r.amount; });
      /* a refund is its own group: its line a read row, then its two actions, the answer its foot where makerButton looks for it */
      var row=aGroup(null,'arefund__row');
      row.add(aLine(rm(r.amount)+' to '+r.party+', '+r.since, waits?'Waiting under Approve':'Paid marks it returned')).classList.add('arefund__line');
      s.appendChild(row); if(waits) return;
      var answer=row.foot(''); answer.className='amb-settings__foot anote aanswer'; answer.setAttribute('role','status');
      [['Mark paid today','refundPaid','Sent. It is marked paid once you approve it.'],['Remove as stale','refundRemove','Sent. It comes off the book once you approve it.']].forEach(function(k){
        var armed=null, at=null, b=aActBtn(row,[k[0],'acct.refund',a.code+':'+r.since+':'+r.amount+':'+k[1]],async function(send){
          if(!armed){ b.textContent='Tap again to confirm'; armed=setTimeout(function(){ armed=null; b.textContent=k[0]; }, 4000); return; }
          clearTimeout(armed); armed=null; b.textContent=k[0];
          var body={kind:k[1],party:r.party,since:r.since,amount:r.amount};
          if(k[1]==='refundPaid') body.paidOn=new Date(Date.now()+8*36e5).toISOString().slice(0,10);
          if(!at) at=new Date().toISOString();
          body.at=at;
          /* 20 Nov 2026 (CM4-TO's and CD4-DAM's credits): sent straight to the Desk, as the market's edits are. Through send() it was kept on the phone first,
             and the kept-entry check (vaultPendingOk) names no edit path, so every tap said it could not be sent and nothing left; the Desk files it for Approve */
          try{ await refs('/all/maker/inputs/edit',body); answer.textContent=k[2]; loadMaker(); }
          catch(error){ refusal(answer,error); }
        },function(){ at=null; },k[1]==='refundRemove');
      });
    });
    return s;
  }
  function readingOf(kind, code, paint){
    var k=kind+'/'+code;
    if(ofReads[k]&&!ofReads[k].reading){ paint(ofReads[k]); return; }
    /* 1 Nov 2026: a redraw while the read is out draws new boxes, and each waits for the read, so none is left hidden */
    if(ofReads[k]){ (ofWait[k]=ofWait[k]||[]).push(paint); return; }
    ofReads[k]={reading:true};
    refs('/all/maker/'+kind+'/'+encodeURIComponent(code)).then(function(j){ ofReads[k]=j&&j.reading||{}; }, function(){ ofReads[k]={}; })
      .then(function(){ var r=ofReads[k], wait=ofWait[k]||[]; delete ofWait[k]; [paint].concat(wait).forEach(function(f){ f(r); }); delete r.reading; setTimeout(function(){ delete ofReads[k]; }, 60000); });
  }
  function pctSection(a, cat, books, partner){
    var s=el('section','asec apct'); s.setAttribute('aria-label','Their %');
    s.appendChild(el('h2','amb-section','Their %'));
    if(partner){ var pl=aGroup(null,'apct__partner'); pl.add(aLine('Pays the Floor')); pl.foot('A partner has no % to set.'); s.appendChild(pl); return s; }
    var code=a.code, st=pctOn[code]||(pctOn[code]={book:books[0], pct:{}});
    if(books.indexOf(st.book)<0) st.book=books[0];
    var tabs=el('div','amb-segment apct__books'+(books.length>4?' amb-segment--wrap':'')); tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','Book');
    books.forEach(function(b){
      var t=actOn(el('button','amb-segment__opt'),'acct.pct.book',b); t.type='button'; t.setAttribute('aria-pressed', b===st.book?'true':'false'); t.appendChild(bookChip(b));   /* a book is its chip, its name in ink */
      t.addEventListener('click', function(){ st.book=b; s.replaceWith(pctSection(a, cat, books, partner)); }); tabs.appendChild(t);
    });
    s.appendChild(tabs);
    var card=(cat.driftCards||[]).filter(function(x){ return x.code===code&&x.product===st.book; })[0]||{};
    /* 10 Nov 2026: the stepper runs the book's own range (salt's band -100 to +100, a board -30 to +30) and sends the book's unit */
    var pbook=(cat.products||[]).filter(function(x){ return x.product===st.book; })[0]||{}, lim={min:typeof pbook.driftMin==='number'?pbook.driftMin:-30, max:typeof pbook.driftMax==='number'?pbook.driftMax:30}, punit=pbook.driftUnit||'pct';
    var held=card.held?Math.round(+card.value*100):0, sug=typeof card.suggest==='number'?Math.round(card.suggest*100):null;
    if(st.pct[st.book]==null) st.pct[st.book]=held;
    var L=aGroup(null,'apct__list');
    L.add(aLine('Suggested', sug==null?'None':pctWord(sug)));
    if(sug!=null&&card.why) L.foot(card.why.charAt(0).toUpperCase()+card.why.slice(1));
    s.appendChild(L);
    /* 18 Nov 2026 (his word): the slider moves in steps of 5 inside the book's range; a figure set off a step (an older place) is said as it stands until he moves it */
    var fld=pctSlider({label:['Set to','acct.pct.value'],min:lim.min,max:lim.max,value:st.pct[st.book]}), inp=fld.input;
    fld.classList.add('apct__step'); s.appendChild(fld);
    var prev=el('div','apct__prev'); s.appendChild(prev);
    var acts=aGroup(null,'apct__acts'), answer=acts.foot(''); answer.className='amb-settings__foot anote aanswer apct__answer'; answer.setAttribute('role','status');
    var at=null, sig='';
    var sendB=aActBtn(acts,['Send','acct.pct.send',code],async function(send){
      var whole=st.pct[st.book]; if(whole===held) return;
      var body={code:code,product:st.book,tier:Number((whole/100).toFixed(2)),unit:punit}, check=JSON.stringify(body);
      if(check!==sig){ sig=check; at=new Date().toISOString(); }
      body.at=at;
      try{ await send('/all/maker/inputs/tier-set',body); answer.textContent='Sent. Their % changes once you approve it.'; loadMaker(); }
      catch(error){ refusal(answer,error); }
    },function(){ at=null; sig=''; });
    var use=aBtn(sug==null?'No suggestion':'Use '+pctWord(sug),'amb-action','acct.pct.suggest'); use.disabled=sug==null;
    use.addEventListener('click', function(){ if(sug!=null){ st.pct[st.book]=sug; pctPaint(); } });
    acts.add(use);
    if(card.held){
      var clr=aActBtn(acts,['Set back to 0','acct.pct.clear',code],async function(send){
        var body={code:code,product:st.book,tier:null,unit:punit}, check=JSON.stringify(body);
        if(check!==sig){ sig=check; at=new Date().toISOString(); }
        body.at=at;
        try{ await send('/all/maker/inputs/tier-set',body); answer.textContent='Sent. Their % goes back to 0 once you approve it.'; loadMaker(); }
        catch(error){ refusal(answer,error); }
      },function(){ at=null; sig=''; });
      clr.classList.add('apct__clear');
    }
    /* the answer stands inside the buttons' own group, where makerButton looks for it, so a refused retry is said on the card, never let go */
    s.appendChild(acts);
    function pctDraw(j){
      prev.textContent='';
      if(!j||!j.rows||!j.rows.length) return;
      var say=pctWord(st.pct[st.book]), table=el('table','amb-table amb-table--stack apct__table'), hr=el('tr'), body=el('tbody'), heads=['Units','Now','At '+say,'Floor'];
      table.appendChild(el('caption','amb-vh',code+' at '+say+': their prices before anything goes to Approve'));
      heads.forEach(function(t, i){ var th=el('th',i?'is-num':null,t); th.setAttribute('scope','col'); hr.appendChild(th); });
      table.appendChild(el('thead')).appendChild(hr); table.appendChild(body);
      j.rows.forEach(function(r){
        var tr=el('tr');
        [[units(r.q),null],[rmShort(r.now),'is-num'],[rmShort(r.at),'is-num apct__at'],[rmShort(r.floor),'is-num apct__floor']].forEach(function(x,i){ var td=el('td',x[1],x[0]); td.setAttribute('data-label',heads[i]); tr.appendChild(td); });
        body.appendChild(tr);
      });
      prev.appendChild(table);
      var usual=j.rows.filter(function(r){ return r.usual; })[0];
      if(usual) prev.appendChild(el('p','amb-settings__foot','Their usual is '+units(usual.q)+', and a change goes to Approve first.'));
    }
    function pctPaint(){
      var whole=st.pct[st.book];
      fld.put(whole);
      sendB.textContent='Send '+pctWord(whole); sendB.disabled=whole===held;
      var key=code+'/'+st.book+'/'+whole;
      if(pctReads[key]){ pctDraw(pctReads[key]); return; }
      refs('/all/maker/drift-preview/'+key).then(function(j){ pctReads[key]=j.preview; if(st.pct[st.book]===whole&&s.isConnected) pctDraw(j.preview); }, function(error){ if(st.pct[st.book]===whole) refusal(answer,error); });
    }
    /* a release or a key: a whole % inside the book's range, read off the Desk once it rests */
    inp.addEventListener('change', function(){
      var v=Math.round(+inp.value); if(!isFinite(v)) v=st.pct[st.book];
      v=Math.max(lim.min,Math.min(lim.max,v)); if(v===st.pct[st.book]){ fld.put(v); return; }
      st.pct[st.book]=v; pctPaint();
    });
    pctPaint();
    return s;
  }
  /* 3 Nov 2026: This customer and the associate reward are groups under a head with the book's chip; the line of their rates, the meter and the figures are its rows, what it means the grey line under it */
  function acctHead(box, t){ var h=el('h2','amb-section ahead2',t); h.appendChild(document.createTextNode(' ')); h.appendChild(bookChip('salt')); box.appendChild(h); }
  /* a measure with its words, as Ambient's meter row: the words over the bar */
  function meterRow(title, sub, value){
    var li=el('li','amb-row amb-row--meter ameterrow'), tx=el('span','amb-row__text'), p=el('progress','amb-meter');
    tx.appendChild(el('span','amb-row__title',title)); if(sub) tx.appendChild(el('span','amb-row__sub',sub)); li.appendChild(tx);
    p.max=100; p.value=Math.max(0,Math.min(100,value)); p.setAttribute('aria-label',title+(sub?', '+sub:'')); li.appendChild(p);
    var ul=el('ul','amb-list'); ul.appendChild(li); return ul;
  }
  /* 13 Nov 2026 (the price band's version 3): THEIR HABIT AND THE SIZE WARNING, from the snapshot's habit (never priced): how often and how much, and how late; what a bigger lot or ten points off would do to what they earn him a month */
  function habitRows(L, h){
    if(!h||!(+h.gap>0)) return;
    var late=Math.round((+h.since||0)-(+h.gap)), said='Every '+(+h.gap)+' d, usually '+units(h.usual)+(h.state!=='early'&&late>0?'; late '+late+' d':'');
    var hr=acctLine(L,'Habit',said); hr.setAttribute('data-habit',h.state||'');
    var w=h.warn||{};
    if(w.bigger&&+w.bigger.less30>0){ var bw=aLine('A '+(+w.bigger.q)+'-unit lot earns '+rmShort(+w.bigger.less30)+' less a month'); bw.setAttribute('data-warn','bigger'); L.add(bw); }
    if(w.tenOff&&+w.tenOff.less30>0){ var tw=aLine('10% off costs '+rmShort(+w.tenOff.less30)+' a month'); tw.setAttribute('data-warn','tenOff'); L.add(tw); }
  }
  function paintCust(box, r){
    box.textContent='';
    if(!r||r.reading||!r.customer||r.error){ box.hidden=true; return; }
    box.hidden=false;
    acctHead(box,'This customer');
    if(r.rates&&r.rates.length>1){
      var lo=Math.min.apply(null,r.rates.map(function(x){ return x.rate; })), hi=Math.max.apply(null,r.rates.map(function(x){ return x.rate; })), span=hi-lo||1;
      var NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg'), tile=el('div','amb-tiles acust__tiles'), tl=el('div','amb-tile acust__tile');
      svg.setAttribute('viewBox','0 0 120 36'); svg.setAttribute('preserveAspectRatio','none'); svg.setAttribute('class','amb-tile__spark acust__spark');
      svg.setAttribute('role','img'); svg.setAttribute('aria-label','Their price a unit, '+r.rates.map(function(x){ return rmShort(x.rate); }).join(', '));
      var pl=document.createElementNS(NS,'polyline');
      pl.setAttribute('points',r.rates.map(function(x,i){ return (i*120/(r.rates.length-1)).toFixed(1)+','+(32-(x.rate-lo)/span*28).toFixed(1); }).join(' '));
      svg.appendChild(pl);
      tl.appendChild(el('span','amb-tile__label','Last '+r.rates.length+' rates')); tl.appendChild(el('span','amb-tile__figure',rmShort(lo)+' to '+rmShort(hi))); tl.appendChild(svg); tile.appendChild(tl); box.appendChild(tile);
    }
    var y=r.loyal||{}, share=Math.max(0,Math.min(100,Math.round((+y.units||0)/(+y.every||20)*100)));
    box.appendChild(meterRow('Loyalty', (+y.units||0)+' of '+(y.every||20)+' units, they see '+share+'%', share));
    var L=aGroup(null,'acust__list');
    if(r.unitNow!=null) acctLine(L,'A unit now',rmShort(r.unitNow));
    if(r.highest!=null) acctLine(L,'Highest',rmShort(r.highest));
    if(r.cadence) acctLine(L,'Orders every',r.cadence.every+' days');
    if(r.dueIn!=null) acctLine(L,'Next order due',r.dueIn>0?'in '+r.dueIn+(r.dueIn===1?' day':' days'):r.dueIn===0?'today':(-r.dueIn)+(r.dueIn===-1?' day':' days')+' late');
    habitRows(L,r.habit);
    if(y.paused) L.add(aLine('Loyalty paused', y.why==='writeoff'?'A write-off':'A late payment'));
    L.foot('1 unit at cost every '+(y.every||20)+(r.cost!=null?' ('+rmShort(r.cost)+' to you)':'')+'.');
    box.appendChild(L);
  }
  function paintRwd(box, r){
    box.textContent='';
    if(!r||r.reading||!r.associate||r.error||!(r.step>0)){ box.hidden=true; return; }
    box.hidden=false;
    acctHead(box,'Associate reward');
    box.appendChild(meterRow('Reward', 'Margin '+rmShort(r.progress)+', next unit '+rmShort(r.step), Math.round(r.progress/r.step*100)));
    var L=aGroup(null,'arwd__list');
    acctLine(L,'Step, '+r.times+' units’ cost',rmShort(r.step)); acctLine(L,'Given under Median Price',rmShort(r.given)); acctLine(L,'A unit, net to you',rmShort(r.net));
    /* R3 (plan version 6): each person they brought in, their first week's last day and the orders of it counted */
    (Array.isArray(r.r3)?r.r3:[]).forEach(function(w){ if(w&&w.code) acctLine(L,'Brought in '+w.code,w.orders+' counted, to '+dayMon(w.last)); });
    L.foot('Counted once paid, and they see no figure.');
    box.appendChild(L);
  }
  function partnerSection(a, partner, waiting){
    /* 3 Nov 2026: where they stand a row, Make partner an action row under it that still asks with a second tap, what it means the grey line */
    var s=el('section','asec apart'); s.setAttribute('aria-label','Partner');
    s.appendChild(el('h2','amb-section','Partner'));
    var list=aGroup(null,'apart__list'); s.appendChild(list);
    var st=aLine('Status', partner?'Partner':waiting?'Waiting under Approve':'Not a partner'); list.add(st);
    if(partner||waiting){ list.foot('Pays the Floor on every book.'); return s; }
    var answer=list.foot('Pays the Floor on every book.'); answer.setAttribute('role','status'); answer.classList.add('aanswer');
    var armed=null, at=null, sig='', b=aActBtn(list,['Make partner','acct.partner',a.code],async function(send){
      if(!armed){ b.textContent='Tap again to confirm'; armed=setTimeout(function(){ armed=null; b.textContent='Make partner'; }, 4000); return; }
      clearTimeout(armed); armed=null; b.textContent='Make partner';
      var body={code:a.code}, check=JSON.stringify(body);
      if(check!==sig){ sig=check; at=new Date().toISOString(); }
      body.at=at;
      try{ await send('/all/maker/inputs/partner',body); answer.textContent='Sent. They pay the Floor once you approve it.'; loadMaker(); }
      catch(error){ refusal(answer,error); }
    },function(){ at=null; sig=''; });
    b.classList.add('apart__go');
    return s;
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
  /* 3 Nov 2026 (the account on Shop's grid): a loan is a row that opens Repayment (what was lent and when, what is left at the right), the reward a row */
  function drawBooks(box, a){
    box.textContent='';
    box.appendChild(el('h2','amb-section','Loans and reward'));
    var body=aGroup(null,'aloans'), rd=aLine('Reading'); rd.classList.add('aloans__reading');
    box.appendChild(body); body.add(rd);
    readParty().then(function(cat){
      if(!box.isConnected) return;
      body.list.textContent='';
      var mine=(cat.loans||[]).filter(function(item){ return item.party===a.code; });
      var reward=(cat.rewards||[]).filter(function(item){ return item.code===a.code; })[0];
      mine.forEach(function(item){
        var cash=item.form==='cash', fmt=cash?rm:units, on=fmtWhen(item.date);
        /* what was lent and what is left say what was repaid; the second line is the day, or what was repaid when no day is kept */
        var sub=on||(item.repaid!=null?'Repaid '+fmt(item.repaid):'');
        var go=aOpens((item.direction==='in'?'Borrowed':'Lent')+(item.value!=null?' '+fmt(item.value):'')+(sub?', '+sub:''), item.remaining!=null?fmt(item.remaining)+' left':'', 'acct.repay', item.rid);
        go.classList.add('aloan'); go.setAttribute('data-loan', item.rid);
        go.addEventListener('click', function(){ repayFor(item.rid); });
        body.add(go);
      });
      if(!mine.length) body.add(aLine('Loans','None'));
      var rw=aLine('Reward', reward?units(reward.held)+' held'+(reward.departed?', while away':reward.free<reward.held?', '+units(reward.free)+' free':''):'None');
      if(reward) rw.setAttribute('data-reward',a.code);
      body.add(rw);
    }).catch(function(){ if(box.isConnected){ body.list.textContent=''; body.add(aLine('Not read','Their loans could not be read.')); } });
  }
  /* Repayment opens Record's own form for that loan: the form is the one that sends, so a repayment waits under Approve like any other. A form not built yet is
     filled when it is (repayWant, applied once Record's forms are drawn). */
  var repayWant=null, tipWant=null;
  /* 9 Nov 2026: Desk reminders with one chosen, from a Noticed card's Hide on Salt Admin; a reminder the Desk no longer shows opens the form as it is */
  function applyTip(){
    if(!tipWant) return;
    var form=document.querySelector('#makerInputs [data-form="desk-reminders"]'); if(!form) return;
    var pick=form.querySelector('[data-act="record.tip.tip"]');
    if(pick&&[].some.call(pick.options,function(o){ return o.value===tipWant; })){ pick.value=tipWant; pick.dispatchEvent(new Event('change',{bubbles:true})); }
    tipWant=null; openForm('desk-reminders');
  }
  function tipFor(id){ tipWant=id; showPlace('record','pricing',{fresh:true,push:true}); applyTip(); }
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
  function openAcct(a, acting){
    if(!OWNER) return;
    if(sheet&&sheet[a.username]&&sheet[a.username].account===false){ say(waitLine(),'bad'); return; }
    if(!OWNER.master){ say('This page cannot open accounts yet.','bad'); return; }
    if(busy) return;
    un.value=a.username; pw.value=OWNER.master; actWant=!!acting;   /* v1377: Order as them opens it with ordering live, View as them read only */
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
  /* v1377, ORDER AS THEM: the page's Place and its slip key read, through his own route behind /all's two locks, answered in the page's
     own api() shape so the sheet reads a refusal, a moved list (409 with the list) and an order exactly as on their road */
  async function actPlace(u,body){
    try{ return {status:200, body:await refs('/all/maker/customers/'+encodeURIComponent(u)+'/orders', body)}; }
    catch(e){ return {status:e.status||0, body:Object.assign({ok:false, error:e.raw||e.message}, e.detail||{})}; }
  }
  /* plan version 4, part 3e: their customers by code for an associate's order for a friend, Record's own list (the Desk's catalogue, less the resale
     accounts), read once a minute at most */
  async function actParties(){
    try{ var c=await readParty(); return (c.parties||[]).filter(function(code){ return !/[-]R$/.test(code); }); }
    catch(e){ return []; }
  }
  async function actKey(){
    try{ return {status:200, body:await refs('/all/maker/slip/key')}; }
    catch(e){ return {status:e.status||0, body:{ok:false}}; }
  }
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
  /* 16 Nov 2026 (the move to Ambient, place G): a chip is Ambient's, the older tone words mapped (ember the loss, verdigris the gain, copper and brass a warning, the rest plain) */
  function chip(tone, t){ var k={ember:' amb-chip--neg',verdigris:' amb-chip--pos',copper:' amb-chip--warn',brass:' amb-chip--warn'}[tone]||''; return el('span','amb-chip'+k, t); }
  /* 25 OCT 2026 (canvas Salt Admin Customers, P1; his yes to Asks A to J): AN ACCOUNT IS NEEDS YOU'S CARD. Where it stands, in a word and an age (Owed and
     how late, Refund, Locked to HH:MM, Not sent, No account, Not opened, Opened, Practice), the code and the username, its one way and the sum: what they
     owe, or what he owes back in ember. To do is his to act on (owed past its term, a refund, locked out, not sent, no account), Pending theirs (owed
     within term, not opened), FYI the rest; within each the largest sum first. A tap anywhere but its way opens the account. */
  function owedOf(a){ var m=owed&&owed.money&&a.code?owed.money.filter(function(x){ return x.party===a.code; })[0]:null; return m||null; }
  function acctState(a){
    var t=a.t||{}, m=owedOf(a), late=m&&Date.parse(m.due)<Date.now()?ageOf(m.due):'';
    if(a.test) return {sev:'watch', word:'Practice', age:a.state==='locked'?'locked':'open', act:'open'};
    if(a.account===false) return {sev:'now', word:'No account', age:'', act:'show'};
    if(a.flag==='owes') return {sev:late?'now':'soon', word:'Owed', age:late?late+' late':m&&m.due?'due '+dayMon(m.due):'', late:!!late, rm:+t.owed||0, act:'message'};
    if(a.flag==='refund') return {sev:'now', word:'Credit', age:'', rm:+t.refund||0, mine:true, act:'open'};
    if(a.flag==='goods') return {sev:'now', word:'Goods', age:units(Math.round((+t.toGet||0)*100)/100), act:'open'};
    if(a.locked) return {sev:'now', word:'Locked', age:a.locked.until?'to '+hm(a.locked.until):'', act:'send'};
    if(!a.sent) return {sev:'now', word:'Not sent', age:a.issued?ageOf(a.issued):'', act:'send'};
    if(!(a.seen&&a.seen.opens)) return {sev:'soon', word:'Not opened', age:ageOf(a.sent), act:'send'};
    if(a.flag==='pend') return {sev:'soon', word:'Agreed', age:dayMon(a.seen.last), rm:+t.pend||0, act:'open'};
    return {sev:'watch', word:'Opened', age:dayMon(a.seen.last), act:'open'};
  }
  /* 16 Nov 2026, THE MOVE TO AMBIENT (place H, Customers): THE ACCOUNTS ARE AMBIENT'S ROWS under a head each, To do, Pending and FYI, the largest sum first; the same on a
     phone and wide (the list stands beside the open account from 960px, in its place below it). A row is a tap anywhere on its text, which opens the account, and its one
     way as a small pill at the trail: Message, Send, Show or Open, each keeping its act and the request it had. The state is a word of the second line (ember while it waits
     on him or is late), then its age and the sum; his own credit in ember. A move's answer stands under its row. */
  function aBtn(word, cls, act, key){ var b=actOn(el('button',cls,word),act,key); b.type='button'; return b; }
  function aPill(word, act, key, sm, quiet){ return aBtn(word,'amb-pill'+(sm?' amb-pill--sm':'')+(quiet?' amb-pill--quiet':''),act,key); }
  /* an action row of a settings list: the one that ends or removes in ember */
  function aAct(b, danger){
    [].slice.call(b.classList).forEach(function(c){ if(/^(amb-pill|amb-circle|btn$)/.test(c)) b.classList.remove(c); });
    b.classList.add('amb-action'); if(danger) b.classList.add('amb-action--danger'); return b;
  }
  /* a group of settings: its head, its list (add puts a node in a row of it), and the one line under it */
  function aGroup(head, cls){
    var box=el('div','amb-settings'+(cls?' '+cls:'')), ul=el('ul','amb-settings__list');
    box.setAttribute('data-amb','');   /* a makerButton in it draws the system's own small pill, which the group's action rows then take */
    if(head) box.appendChild(el('h3','amb-settings__head',head));
    box.appendChild(ul); box.list=ul;
    box.add=function(n){ var li=el('li'); li.appendChild(n); ul.appendChild(li); return n; };
    box.foot=function(t){ var p=el('p','amb-settings__foot',t); box.appendChild(p); return p; };
    return box;
  }
  /* a line read only: its name and what it says; hot is ember */
  function aLine(name, value, hot){
    var r=amb.node(amb.setting(name, value==null?'':value));
    if(value==null) r.removeChild(r.querySelector('.amb-setting__value'));
    else if(hot) r.querySelector('.amb-setting__value').classList.add('amb-neg');
    return r;
  }
  /* a line that opens: its name, what it says, the chevron */
  function aOpens(name, value, act, key){
    var at={'data-act':act}; if(key!=null&&key!=='') at['data-key']=String(key);
    return amb.node(amb.setting(name, value, at));
  }
  function acctRowNodes(a){
    var s=acctState(a), who=a.test?testName(a):(a.code||a.username), li=el('li','amb-row arow'), mv=null;
    var tail=el('li','oask'); tail.setAttribute('data-rowof',a.username); tail.setAttribute('role','status');
    var c={_body:tail, _grow:function(){}, _add:function(b){ if(!mv){ mv=b; if(!mv.getAttribute('data-key')) mv.setAttribute('data-key',a.username); } }};
    li.setAttribute('data-u',a.username);
    if(s.act==='message'&&a.username){ var ms=aPill('Message','acct.message',a.username,true,true); ms.addEventListener('click', function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(a.username); }); c._add(ms); }
    else if(s.act==='send'){ c._add(linkButton(a, noteOf(c))); mv.className='amb-pill amb-pill--sm amb-pill--quiet'; }
    else if(s.act==='show') acctShow(a, c);
    else { var op=aPill('Open','acct.open-card',a.username,true,true); op.addEventListener('click', function(){ openCard(a.username); }); c._add(op); }
    var open=actOn(el('button','amb-row__main arow__open'),'acct.open','a:'+a.username); open.type='button';
    var tx=el('span','amb-row__text'), ti=el('span','amb-row__title'), sub=el('span','amb-row__sub');
    ti.appendChild(whoTag(el('span','acode',who),who)); tx.appendChild(ti);
    sub.appendChild(el('span',s.sev==='now'||s.late?'amb-neg':null,s.word));
    if(s.age) sub.appendChild(document.createTextNode(', '+s.age));
    if(+s.rm>0.004){ sub.appendChild(document.createTextNode(', ')); sub.appendChild(el('span',s.mine?'amb-neg':null,rmShort(s.rm))); }
    tx.appendChild(sub); open.appendChild(tx);
    open.setAttribute('aria-label', s.word+(s.age?', '+s.age:'')+': '+who+(a.test?'':', '+a.username)+(s.rm?', '+rmShort(s.rm):''));
    if(aOpen===a.username){ open.setAttribute('aria-current','true'); li.setAttribute('aria-current','true'); }
    open.addEventListener('click', function(){ openCard(a.username); });
    li.appendChild(open);
    if(mv){ var tr=el('span','amb-row__trail'); tr.appendChild(mv); li.appendChild(tr); }
    /* the tail is shown only while it holds an answer or the guest list: the note under the Send button fills as it is tapped */
    var sync=function(){ tail.hidden=!tail.textContent&&!tail.querySelector('figure'); };
    sync(); if(window.MutationObserver) new MutationObserver(sync).observe(tail,{childList:true,characterData:true,subtree:true});
    return [li, tail];
  }
  /* Show, for an ID with no account: the standing guest link, its code in the system's frame and Copy link, under the row it was asked on */
  function acctShow(a, c){
    var sh=aPill('Show','acct.show-link',null,true,true); sh.setAttribute('aria-label','Show the guest price list');
    c._add(sh);
    var note=noteOf(c);
    function openSilver(){
      var r=strangerLink();
      if(!r){ note.textContent='The guest link is not made yet. Open Links once, then try again.'; return; }
      silverOpen[a.username]=true;
      var box=el('figure','amb-codeframe ashow'), fld=el('div','amb-codeframe__field'), img=document.createElement('img'), cap=el('figcaption','amb-codeframe__caption');
      img.src=r.qr; img.alt='QR to the guest price list'; img.width=180; img.height=180; fld.appendChild(img); box.appendChild(fld);
      cap.appendChild(el('code','gu',r.url)); box.appendChild(cap);
      var cp=aPill('Copy link','acct.copy-link',null,true,true);
      cp.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); note.textContent='Copied.'; }catch(e){ note.textContent='Copy failed.'; }
      });
      c._body.insertBefore(cp, note); c._body.insertBefore(box, cp); sh.disabled=true;
    }
    sh.addEventListener('click', openSilver);
    if(silverOpen[a.username]) openSilver();
  }
  /* the notice over the list, one sentence, money first: what is owed to him and how much of it is late, what he owes back, the sign-ins waiting */
  function drawALead(pool){
    var wrap=document.getElementById('alead'), box=document.getElementById('aleadT'); if(!box) return;
    var real=pool.filter(function(a){ return !a.test; }), owedRM=0, lateRM=0, back=0, wait=0;
    real.forEach(function(a){
      var t=a.t||{}, s=acctState(a);
      if(a.flag==='owes'){ owedRM+=+t.owed||0; if(s.late) lateRM+=+t.owed||0; }
      if(a.flag==='refund') back+=+t.refund||0;
      if((a.account!==false&&!a.sent)||a.locked) wait++;
    });
    box.textContent='';
    var bits=[];
    function b(t){ return el('b',null,t); }
    function join(nodes){ var span=document.createDocumentFragment(); nodes.forEach(function(n){ span.appendChild(typeof n==='string'?document.createTextNode(n):n); }); return span; }
    if(owedRM>0.004) bits.push(join([b(rmShort(owedRM)),' is owed to you'+(lateRM>0.004?', '+rmShort(lateRM)+' of it late':'')]));
    if(back>0.004) bits.push(join([b(rmShort(back)),' owed back']));
    if(wait) bits.push(join([b(wait+(wait===1?' account':' accounts')),(wait===1?' awaits':' await')+' a sign-in']));
    bits.forEach(function(n, i){ if(i) box.appendChild(document.createTextNode('; ')); box.appendChild(n); });
    if(bits.length) box.appendChild(document.createTextNode('.'));
    else box.textContent='Nothing is owed either way, and every account has its sign-in.';
    wrap.hidden=!sheet;
  }
  function drawRoster(){
    if(!OWNER) return;
    var q=(rq.value||'').toLowerCase().replace(/\\s+/g,''), f=FILTER[aFilter]||FILTER.all;
    /* 17 Nov 2026, the move to Ambient (Fable's review, item 3): the pane's head (notice, find, count) stays; the groups are drawn afresh */
    [].slice.call(rlist.children).forEach(function(c){ if(!c.classList.contains('afhead')) rlist.removeChild(c); });
    var pool=sheet?sheetRows:OWNER.accounts;
    /* each filter counts its accounts beside its word, and one with none is dimmed and cannot be chosen; the one in use is let go when none is left in it */
    [].slice.call(document.querySelectorAll('#afil button[data-f]')).forEach(function(x){
      var k=x.getAttribute('data-f'), n=pool.filter(FILTER[k]||FILTER.all).length, c=x.querySelector('.amb-segment__count');
      if(c) c.textContent=sheet?String(n):'';
      if(k!=='all'&&!n) x.setAttribute('aria-disabled','true'); else x.removeAttribute('aria-disabled'); });   /* dimmed, as Ambient says it: aria-disabled with its count at 0 */
    if(aFilter!=='all'&&!pool.some(FILTER[aFilter])){ aFilter='all'; f=FILTER.all; filterMark(); }
    var hits=pool.filter(function(a){
      return f(a)&&(!q||((a.code||'')+' '+a.username).toLowerCase().replace(/\\s+/g,'').indexOf(q)>=0);
    });
    countSent(); drawALead(pool);
    if(!hits.length){ rlist.appendChild(el('p','amb-empty','Nothing matches that.')); return; }
    var rm=function(a){ var s=acctState(a); return +s.rm||0; }, groups=[];
    SEVS.forEach(function(s){
      var group=hits.map(function(a, i){ return [a, i]; }).filter(function(x){ return acctState(x[0]).sev===s[0]; })
        .sort(function(x, y){ return (rm(y[0])-rm(x[0]))||(x[1]-y[1]); }).map(function(x){ return x[0]; });
      if(group.length) groups.push({sev:s[0], head:s[1], rows:group});
    });
    groups.forEach(function(g){
      var sec=el('section','agroup'), list=el('ul','amb-list amb-list--ruled');
      sec.setAttribute('data-sev',g.sev); sec.setAttribute('aria-label',g.head);
      sec.appendChild(el('h2','amb-section',g.head));
      g.rows.forEach(function(a){ acctRowNodes(a).forEach(function(n){ list.appendChild(n); }); });
      sec.appendChild(list); rlist.appendChild(sec);
    });
  }
  function filterMark(){
    [].slice.call(document.querySelectorAll('#afil button[data-f]')).forEach(function(x){
      x.setAttribute('aria-pressed', x.getAttribute('data-f')===aFilter?'true':'false'); });
  }
  function filterBy(f){
    aFilter=FILTER[f]?f:'all';
    filterMark();
    drawRoster();
  }
  /* the way back from an open account, below 960px where it takes the list's place: one pill named for where it goes */
  function acctBack(){
    var b=aBtn('','amb-pill amb-pill--quiet amb-pill--sm aback','acct.back'); b.setAttribute('data-back','accounts');
    b.appendChild(ambIcon('back','amb-icon--sm')); b.appendChild(document.createTextNode(' All accounts')); b.setAttribute('aria-label','All accounts'); return b;
  }
  /* the open account: its way back, then the account's card, which ends in the one main action, pinned at the pane's foot */
  function openCard(u){
    var a=u&&((sheet&&sheet[u])||OWNER.accounts.filter(function(x){ return x.username===u; })[0]);
    aOpen=a?u:null;
    oAccts.classList.toggle('open', !!a);
    aopen.hidden=!a; aopen.textContent='';
    var none=document.getElementById('anone'); if(none) none.hidden=!!a;
    [].slice.call(rlist.querySelectorAll('[data-u]')).forEach(function(r){
      if(r.getAttribute('data-u')===aOpen) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
    if(!a) return;
    var back=acctBack();
    aopen.appendChild(back);
    acctPane(aopen, a);
    /* below 960px the account takes the list's place with its way back showing, so he is taken to the top of it; from 960px the panes scroll apart, so only the pane's own top */
    try{
      if(window.getComputedStyle(back).display!=='none') pageTop();
      else { var side=document.getElementById('aside'); if(side) side.scrollTop=0; }
    }catch(e){}
  }
  /* an account as it opens (S9 9.3) */
  function acctPane(box, a){ box.appendChild(acctCard(a)); }
  /* 15 Nov 2026 (Ambient 0.7.2): the count on a place's tab, through the page's tabCount: its figure, hidden at nought, and the tab's name */
  function setCount(m, n){ [].slice.call(document.querySelectorAll('[data-count="'+m+'"]')).forEach(function(c){ tabCount(c,n); }); }
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
  /* 18 Oct 2026: the price levels are gone, so every link opens the one guest board and none is named by a level. The standing
     link for strangers stands at the top; anything minted against a customer sits below under its own heading. */
  function drawLinks(){
    var glist=document.getElementById('glist');
    glist.textContent='';
    if(!links.length){ glist.appendChild(el('p','amb-empty','No links yet.')); return; }
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
    if(standing.length){ heads[seq.length]='Standing link'; seq=seq.concat(standing); }
    if(assoc.length){ heads[seq.length]='Made by associates'; seq=seq.concat(assoc); }
    if(older.length){ heads[seq.length]='Older links'; seq=seq.concat(older); }
    /* 16 Nov 2026, THE MOVE TO AMBIENT (place H): A LINK IS AMBIENT'S ROW under Waiting on you, Standing link, Made by associates and Older links: who it is for in words (Made by or Via a code, the
       note alone), its state and its age (Waiting, Standing, Opened, Never opened, Declined, Withdrawn) and how often it was opened, and its one way as a small pill (Approve while it waits,
       Restore once withdrawn, else Copy). A tap on the row opens its address, its code in the system's frame and every move under it; it stays open across a redraw, and opens at once
       for the answer to a move made on it. */
    var group=null, list=null, gname=null;
    seq.forEach(function(r,i){
      if(heads[i]){ gname=heads[i]; group=el('section','agroup glinks'); group.setAttribute('aria-label',heads[i]); group.appendChild(el('h2','amb-section ghead',heads[i])); list=el('ul','amb-list amb-list--ruled'); group.appendChild(list); glist.appendChild(group); }
      var declined=r.declined===true, pending=r.approved===false&&!declined&&!r.revoked, shut=pending||declined;   /* 16 Nov 2026 (the red fix): a pending link its associate withdrew waits on nobody, and its way is Restore */
      var word=pending?'Waiting':declined?'Declined':r.revoked?'Withdrawn':r.standing?'Standing':r.opens?'Opened':'Never opened';
      var age=pending?ageOf(r.made):r.opens?stampDay(r.last):stampDay(r.made);
      var lead=r.standing?'':isAssoc(r)?(shut?'Made by ':'Via '):'', who=r.standing?'Median Price list':isAssoc(r)?codeByUser(r.by):(r.label||'Link');
      var open=!!(openLinks[r.id]||(moved&&moved.id===r.id)||(linkSaid&&linkSaid.id===r.id));
      var row=el('li','amb-row glrow'+(r.revoked?' off':'')), main=actOn(el('button','amb-row__main need-tap'),'link.open','g:'+r.id), tx=el('span','amb-row__text'), ti=el('span','amb-row__title'), sub=el('span','amb-row__sub');
      main.type='button'; row.setAttribute('data-glink', r.id);
      if(lead) ti.appendChild(el('span','need-lead',lead)); ti.appendChild(el('span','need-who',who)); tx.appendChild(ti);
      sub.appendChild(el('span',pending?'amb-neg':null,word)); sub.appendChild(document.createTextNode(', '+age+(shut?'':', opened '+(r.opens||0)+(+r.opens===1?' time':' times')))); tx.appendChild(sub);
      main.appendChild(tx); main.setAttribute('aria-expanded',open?'true':'false'); row.appendChild(main);
      var go;
      if(pending){ go=aPill('Approve','link.approve-card',r.id,true,true); go.addEventListener('click', function(){ moveLink(r,'approve'); }); }
      else if(r.revoked){ go=aPill('Restore','link.restore-card',r.id,true,true); go.addEventListener('click', function(){ moveLink(r,'restore'); }); }
      else { go=aPill('Copy','link.copy-card',r.id,true,true); go.addEventListener('click', async function(){ try{ await navigator.clipboard.writeText(r.url); go.textContent='Copied'; }catch(e){ go.textContent='Not copied'; } setTimeout(function(){ go.textContent='Copy'; }, 1500); }); }
      var tr=el('span','amb-row__trail'); tr.appendChild(go); row.appendChild(tr);
      list.appendChild(row);
      var card=el('li','glpanel'); card.setAttribute('data-link',r.id); card.open=open; card.hidden=!open;
      main.addEventListener('click', function(){ card.open=!card.open; card.hidden=!card.open; if(card.open) openLinks[r.id]=true; else delete openLinks[r.id]; main.setAttribute('aria-expanded',card.open?'true':'false'); });
      card.appendChild(el('p','amb-field__hint gwho',r.standing?'For strangers, opens the Median Price list'
        :declined?('Made by '+(r.by?codeByUser(r.by):'an associate')+', not approved, so it stays shut')
        :(pending?('Made by '+(r.by?codeByUser(r.by):'an associate')+', shut until you approve it')
        :isAssoc(r)?('Made by '+codeByUser(r.by))
        :(r.label||'(no note)'))));
      var fig=el('figure','amb-codeframe'), fld=el('div','amb-codeframe__field'), img=document.createElement('img'), cap=el('figcaption','amb-codeframe__caption');
      img.src=r.qr; img.alt=r.standing?'QR to the guest price list':'QR to the guest price list for '+(r.label||r.id); img.width=180; img.height=180;
      fld.appendChild(img); fig.appendChild(fld); cap.appendChild(el('code','gu',r.url)); fig.appendChild(cap); card.appendChild(fig);
      var acts=aGroup(null,'grow');
      var copy=aBtn('Copy link','amb-action','link.copy');
      copy.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); copy.textContent='Copied'; }
        catch(e){ copy.textContent='Copy failed'; }
        setTimeout(function(){ copy.textContent='Copy link'; }, 1500);
      });
      acts.add(copy);
      /* v709: his word on one an associate minted. A tier he does not set leaves it following the associate, which is what "if need be" means. */
      if(!r.standing&&r.by&&r.approved===false&&!r.revoked){
        /* a declined link keeps Approve, which is how a decline is taken back, and loses Decline;
           a withdrawn one has neither, Restore being the way back */
        var ap=aBtn('Approve','amb-action','link.approve'); ap.setAttribute('data-move','');
        ap.addEventListener('click', function(){ moveLink(r,'approve'); });
        acts.add(ap);
        if(!declined){
          var de=aBtn('Decline','amb-action amb-action--danger','link.decline'); de.setAttribute('data-move','');
          de.addEventListener('click', function(){ moveLink(r,'decline'); });
          acts.add(de);
        }
      }
      var rev=aBtn(r.revoked?'Restore':'Withdraw','amb-action'+(r.revoked?'':' amb-action--danger'),r.revoked?'link.restore':'link.withdraw'); rev.setAttribute('data-move','');
      rev.addEventListener('click', function(){ moveLink(r, r.revoked?'restore':'revoke'); });
      acts.add(rev);
      card.appendChild(acts);
      if(moved&&moved.id===r.id){ var mv=el('p','amb-settings__foot msg',moved.t); mv.setAttribute('role','status'); card.appendChild(mv); }
      if(linkSaid&&linkSaid.id===r.id){ var ls=el('p','amb-settings__foot msg'); ls.setAttribute('role','status'); saidOn(r, ls); card.appendChild(ls); }
      list.appendChild(card);
    });
  }
  /* S9 9.7, HIS D13: WHEN ACCESS LAPSES, SAY SO. A request under /all after the Access session has ended is
     sent to the Access login, a redirect a fetch cannot follow, and every tap read "Failed to fetch". Asked not
     to follow it, the fetch answers an opaque redirect, and that or the Worker's own 401 is the sign-in ending:
     the page gives way to Sign in again, which loads /all and so the Access login. A fetch that throws is the
     connection, and says so. */
  var ENDED='Your sign-in has ended.';
  function ended(){
    ynShut(true);   /* 12 Oct 2026: and so does a yes or no left open, as lapsed() and lock() take it, never left standing over the lapse screen */
    makerVaultLock();   /* and every key, name, place and picture the one unlock holds (Phase 4b) */
    document.getElementById('aEnded').hidden=false; document.body.classList.add('ended'); barDraw();
    /* the Needs poll ends with the sign-in: every poll after a lapse would send seven requests to the login and fail each */
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
    /* 12 Nov 2026: the map link opener's own words (stmt/place.js mapsOpen), which fell to the general sentence on Place on the map */
    'The link did not lead to a point.':'That link did not lead to a map point. Paste the full link, or tap Use my location.',
    'The link did not answer.':'The map link did not answer. Try again, or paste the full link.',
    'Only a Google Maps or Apple Maps link is opened here.':'Only a Google Maps or Apple Maps link is opened here.',
    'A public locality must be on the official place list or gazetteer; exact addresses stay encrypted.':'That place cannot be filed beside a point. Choose another from the list.',
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
    'Choose a buyer on the roster. Register a new buyer under Salt Admin > Add ID first, then pick the code.':'Choose a customer from the list. A new customer is added under Record, New customer, first.',
    'Choose a supplier on the roster. Register a new supplier under Salt Admin > Add ID first, then pick the code.':'Choose a supplier from the list. A new supplier is added under Record, New customer, first.',
    'Choose an end buyer on the roster, or leave End customer as Not named. Register a new end buyer under Salt Admin > Add ID first, then pick the code.':'Choose their customer from the list, or leave it as Not named. A new customer is added under Record, New customer, first.',
    'Choose a referrer on the roster. Register a new referrer under Salt Admin > Add ID first, then pick the code.':'Choose who introduced the buyer from the list. A new one is added under Record, New customer, first.',
    'Choose an associate on the roster. Register a new associate under Salt Admin > Add ID first, then pick the code.':'Choose an associate from the list. A new one is added under Record, New customer, first.',
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
    'This book has no Set Price to put a % on.':'This book has no Median Price to put a % on.',
    'A supplier has no % on the Median Price.':'A supplier has no % on the Median Price.',
    'Choose a % from -100% to +100% (-1 to 1), or clear it.':'Choose a % from -100 to +100, or clear it.',
    'Choose a % from -30% to +30% (-0.3 to 0.3), or clear it.':'Choose a % from -30 to +30, or clear it.',
    'Choose the sizes to hide from the board.':'Choose the sizes to leave off the printed list.',
    "A size to hide must be one of this book's board sizes.":"Choose sizes from this book's printed list.",
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
    'Only a customer, reseller or referral holds a starting %.':'Only a customer, a reseller or an introducer starts with a %.',
    'A starting % must name an active book with a Median Price.':'Start a % only on a book that has a Median Price.',
    'A starting % is a number from -1 to 1 (-100% to +100%).':'A starting % is from -100 to +100.',
    'A starting % is a number from -0.3 to 0.3 (-30% to +30%).':'A starting % is from -30 to +30.',
    'Each map point must belong to a roster party and remain inside Malaysia.':'Each point must belong to a customer and sit inside Malaysia.',
    'Set hours or mark closed for each day of the week.':'Set hours, or mark closed, for each day.',
    'Each day must be closed or have opening and closing times.':'Each day is closed, or has an opening and a closing time.',
    'Use valid 24-hour times.':'Use 24-hour times.',
    'A day cannot open and close at the same time.':'Opening and closing at the same time: choose Closed, or another time.',
    "A day's hours cannot run for more than 24 hours.":'A day holds 24 hours at most: open all day is 00:00 to 24:00.',
    'Each date must be closed or have opening and closing times.':'Each date is closed, or has its hours.',
    'Keep to 40 dates at a time.':'40 dates at a time at most: remove one first.',
    'Use a real date for each dated day.':'Choose a real date.',
    'Set dates from today to 90 days ahead.':'Choose a date from today to 90 days ahead.',
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
    /* 17 Nov 2026 (TA95-7J2): Change the order's own refusals (the Desk's restateTap, the order book's restate), which all fell to the general sentence */
    'the size has to be a figure above nothing':'Units must be above zero.',
    "the goods' price has to be a figure above nothing":'The price must be above zero.',
    'the delivery charge has to be a figure from nothing':'Delivery is zero or more.',
    'the way is collect or deliver':'Choose Collect or Deliver.',
    'The way is collect or deliver.':'Choose Collect or Deliver.',
    'a collection carries no delivery charge':'A collection has no delivery charge. Choose Deliver to charge one.',
    'the delivery charge is a figure from nothing, and nothing on a collection':'A collection has no delivery charge. Choose Deliver to charge one.',
    'that is what the order already says':'That is what the order already says.',
    'the order was closed at what was handed over, so its size stays; amend the price or the delivery':'The order was closed at what was handed over, so change the price or the delivery.',
    'a payment they say they sent waits on this order: answer it first, Received or Not found':'A payment they sent waits on this order. Answer it first.',
    'an earlier amendment of this order is not on the book yet: wait for it to land':'An earlier change to this order is not on the book yet. Wait for it to land.',
    'an earlier amendment of this order is waiting to be drafted':'An earlier change to this order is still being drafted.',
    'an undo puts back figures, never the way':'An undo puts back figures, never the way.',
    'a group order is collect only':'A group order is collect only.',
    'they have taken your offer already: its row is drafted at it':'They have already taken your offer. Its row is drafted at that price.',
    'this raises their price or changes their window: send it to them for their yes':'This raises their price or changes their window. Send it to them for their yes.',
    'nothing here needs their yes: Accept it':'Nothing here needs their yes. Accept it.',
    /* 18 Nov 2026 (order change V3): the refusals of a change of units or way on a placed order */
    'these terms need their yes: send them an offer':'These terms need their yes. Send them an offer.',
    'the size has to be a number above zero':'Units must be above zero.',
    'a group order keeps its size and way':'A group order keeps its size and way.',
    'a trip keeps one way across its orders':'A trip keeps one way across its orders.',
    "the offer's terms are not valid":'Those terms cannot be offered. Read the figures again.',
    'they said yes before your withdraw reached them: its row is drafted at your offer':'They said yes before your Withdraw, so its row is drafted at your offer.',
    'no offer of yours is open on this order':'You have no offer open on this order.',
    'that Withdraw was answered already, and a newer offer of yours is open':'Your newer offer is still open, so tap Withdraw again.',
    'this order has already been approved for a row and cannot be changed':'This order is already approved for a row and cannot be changed.',
    'this order is already under review or agreed':'This order is already under review or agreed.',
    'an offer is open on this order':'An offer is open on this order. Withdraw it first.',
    /* 11 Nov 2026: the Desk's Negotiate refusals, which fell to the general sentence (2MHS-H9Y's Agree, refused seven times as "could not do that") */
    'they asked for a price on this order: send them an offer, which they take or decline':'They asked for a better price. Send them an offer.',
    'they have taken your offer: its row is drafted at it, so there is nothing to accept here':'They have taken your offer. Its row is drafted at that price.',
    'they have said yes already: its row is drafted at it':'They have already said yes. Its row is drafted at that price.',
    'the ask is closed: the order stands at its listed price, so Accept or decline it':'Their ask is closed. Agree it at the list price, or decline it.',
    'an offer is open on this order, waiting on their answer':'Your offer is open, waiting on their answer.',
    /* 11 Nov 2026: and every other sentence Accept, offer and Withdraw refuse with (test/admin-price-ask.mjs reads them off src/orders.js) */
    'no desk code is mapped to this account yet: publish the statements again':'This account is not on the Desk yet. Publish the statements, then try again.',
    'the desk has no ledger binding, so no row can be drafted':'The Desk cannot draft a row just now. Try again shortly.',
    'Accept answers a preview: send the digest the preview gave':'Read the figures again, then agree.',
    'an offer answers a preview: send the digest the preview gave':'Read the figures again, then offer.',
    'its row is on the book already, so there is nothing to accept again':'Its row is on the book already.',
    'its row is being drafted: look again in a moment':'Its row is being drafted. Look again in a moment.',
    'its row differs from what you saw and waits under Approve':'Its row came out different, so it waits under Approve.',
    'a sheet of several lines is agreed by one Accept: lower it to what they placed, keep their window, or Decline':'A sheet of several orders is agreed in one go: keep their price and window, or decline it.',
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
    var s=String(raw==null?'':raw), left, floor;
    if(Object.prototype.hasOwnProperty.call(REFUSALS,s)) return REFUSALS[s];
    if(s.indexOf('this order is ')===0) return 'This order has moved on. Read the orders again.';
    if(s.indexOf('Money is already on its way to this row.')===0) return 'Money is already on its way to this row. Decide that first.';
    /* 19 Nov 2026 (s395): a change that would give the row another row's name (engine/stages.mjs keyClash); the row it names stays in Details */
    if(s.indexOf('a sale of theirs on the book')===0&&s.indexOf(' is on that day at that figure, and the book keeps one row of it a day: ')>0) return 'Another sale of theirs that day is already at that figure, and the book keeps one row a day at one figure. Choose another figure.';
    left=/^This row can still take RM ([0-9][0-9,]*[.][0-9]+)/.exec(s);
    if(left) return 'This row can only take RM '+left[1]+' more.';
    floor=/^RM ([0-9][0-9,]*[.]?[0-9]*) is under the floor of RM ([0-9][0-9,]*[.]?[0-9]*) at ([0-9][0-9.]*) unit, so it cannot be set$/.exec(s);
    if(floor) return 'RM '+floor[1]+' is below the Floor of RM '+floor[2]+' for '+floor[3]+' unit'+(Number(floor[3])===1?'':'s')+'. Enter RM '+floor[2]+' or more.';
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
    detail=el('details','rdet'); summary=actOn(el('summary','amb-pill amb-pill--sm amb-pill--quiet','Details'),'refusal.details');
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
    try{ r = await fetch(path, o); }catch(e){ if(path===BAR_READ){ barNet=false; barDraw(); } throw new Error('Not sent. Check the connection and try again.'); }
    if(path===BAR_READ&&!barNet){ barNet=true; barDraw(); }
    if(r.type==='opaqueredirect'||r.status===401){ ended(); throw new Error(ENDED); }
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok) throw refused(j.error, j, r.status);
    return j;
  }
  var makerData=null, makerQuotes={}, makerPv={}, makerFee={}, makerWin={}, makerHours=null, makerBusy=false;
  /* 19 Oct 2026, his word: THE BAR SAYS WHERE THINGS STAND, as the Desk's line does. Live while this device is on line and his last read of the hours reached the
     Counter, else Offline; Offline too once the sign-in has ended. Then Open until, or Closed and when it opens, off the hours this page already reads
     (Needs you's poll and Shop), and nothing once that moment has passed, until the next read. It sends nothing of its own. */
  /* Live follows the hours read alone, so a tick where some reads fail and others get through does not flip it back and forth */
  var barNet=navigator.onLine!==false, BAR_READ='/all/maker/hours';
  function barWhen(iso){
    var f=function(d){ var p={}; new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short',weekday:'short',hourCycle:'h23'})
      .formatToParts(d).forEach(function(x){ p[x.type]=x.value; }); return p; };
    /* 22 Oct 2026: today its time, within six days the weekday and the time (Thu 09:00), further off the day */
    try{ var t=new Date(iso), a=f(t), n=f(new Date()), hm=a.hour+':'+a.minute;
      return a.day===n.day&&a.month===n.month?hm:t.getTime()-Date.now()<6*86400000?a.weekday+' '+hm:a.day+' '+a.month; }catch(e){ return ''; }
  }
  function barDraw(){
    var live=document.getElementById('aBarLive'), hrs=document.getElementById('aBarHours'); if(!live||!hrs) return;
    var on=barNet&&navigator.onLine!==false&&!document.body.classList.contains('ended');
    /* a tick that finds the same answer changes nothing on the page (R4): each part is written only when it differs. 15 Nov 2026: the line
       stands in every place's hero (data-barlive), a word on the mesh, which carries the ink alone */
    [].forEach.call(document.querySelectorAll('[data-barlive]'), function(lv){
      if(lv.getAttribute('data-on')===String(on)) return;
      lv.setAttribute('data-on',String(on));
      lv.className='abarlive '+(on?'on':'off');
      lv.title=on?'Online: the Counter answered his last read.':'Offline: this device cannot reach the Counter just now.';
      lv.innerHTML='<span>'+(on?'Live':'Offline')+'</span>';
    });
    var h=makerHours&&makerHours.status, at=h&&(h.open?h.nextChange:h.nextOpen), txt='', tone='';
    if(h&&typeof h.open==='boolean'&&!(at&&Date.parse(at)<=Date.now())){
      /* 22 Oct 2026 (canvas Needs you): Open, Closed, or Paused for a shop shut by his override for now, each to its next change */
      var w=at?barWhen(at):'', paused=!h.open&&h.source==='manual';
      tone=h.open?'':paused?' ashop--paused':' ashop--closed';
      txt=(h.open?'Open':paused?'Paused':'Closed')+(w?' to '+w:'');
    }
    /* 17 Nov 2026: under his maintenance switch the chip says so, to when it lifts */
    var mu=maintUntil(); if(mu){ var mw=barWhen(mu); tone=' ashop--paused'; txt='Maintenance'+(mw?' to '+mw:''); }
    /* the glowing dot and the words, named with what a tap does */
    /* 15 Nov 2026: a glass chip in Needs you's hero, its dot for something live; Open, Closed or Paused said in its word, the mesh carrying no colour of state */
    /* 18 Nov 2026 (his answer B): every place's bar carries the chip (data-barhours), one status wherever he is; Needs you's is the one a phone shows */
    [].forEach.call(document.querySelectorAll('[data-barhours]'), function(hb){
      if(hb.getAttribute('data-txt')!==txt+tone){
        hb.setAttribute('data-txt',txt+tone); hb.className='amb-chip amb-chip--glass ashop'+tone;
        hb.innerHTML='<span class="amb-chip__dot"></span>';
        hb.appendChild(document.createTextNode(txt));
        hb.setAttribute('aria-label',txt+'. Tap to change');
      }
      if(hb.hidden===!!txt) hb.hidden=!txt;
    });
  }
  /* a tap takes him to Shop hours, to the shop held for now */
  [].forEach.call(document.querySelectorAll('[data-barhours]'), function(hb){ hb.addEventListener('click',function(){
    showPlace('shop','hours',{fresh:true,push:true});
    try{ var t=document.getElementById('makerNowCard'); if(t&&t.scrollIntoView) t.scrollIntoView({block:'start'}); }catch(e){}
  }); });
  window.barDraw=barDraw;
  window.addEventListener('online',function(){ barNet=true; barDraw(); });
  window.addEventListener('offline',barDraw);
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
  /* 22 Oct 2026: a window's day in the one When choice: Today and Tomorrow in Kuala Lumpur, then the weekday and the day (Fri 24 Oct) */
  function makerWinDay(d,now){
    var today=new Date(now+8*3600000).toISOString().slice(0,10), next=new Date(now+8*3600000+86400000).toISOString().slice(0,10);
    return d===today?'Today':d===next?'Tomorrow':day3('en')[new Date(d+'T00:00:00Z').getUTCDay()]+' '+mwDayLabel(d);
  }
  function makerWinOn(day,now){
    return [0,4,8,12,16,20].map(function(w){ return [day+'T'+mwPad(w),mwPad(w)+':00 to '+mwPad(w+4)+':00',Date.parse(day+'T00:00:00Z')+(w-8)*3600000]; })
      .filter(function(x){ return x[2]>now; });
  }
  function makerWinDays(now){
    var out=[]; for(var i=0;i<8;i++){ var d=new Date(now+8*3600000+i*86400000).toISOString().slice(0,10); if(makerWinOn(d,now).length) out.push(d); }
    return out;
  }
  /* what needs their yes, the Worker's needsYes: goods above what they placed it at, or a window other than theirs */
  function makerNeedsYes(order,total,slot,qty,mode){ return (total>(+order.total||0)+0.004)||(!!slot&&!!order.slot&&slot!==order.slot)
    ||(typeof qty==='number'&&Math.abs(qty-(+order.qty||0))>0.0004)||(typeof mode==='string'&&mode!==order.mode); }
  /* an offer of his on the order, open or said yes to: the order waits on them, or on its row. 11 Nov 2026: his answer to THEIR ASK too (Negotiate, a
     price the customer asked for, from not accept), which Salt Admin never drew, so an asked order showed Agree and the Desk refused it */
  function makerAccHeld(order){ var p=order&&order.price; return !!p&&(p.state==='taken'||(p.state==='offered'&&!!p.offer&&new Date().toISOString()<=String(p.offer.until))); }
  /* 11 Nov 2026: THEY ASKED FOR A PRICE (the Counter's Negotiate) and no offer of his holds the order. The Desk agrees it only by an offer they take
     (src/orders.js acceptOrder refuses Accept while the ask is open), so the card's pill is Offer them, never Agree. An offer of his that lapsed
     reopens the ask; their No thanks or his Take back closes it (passed, withdrawn), and Agree at the listed price is his again */
  /* Fable, 11 Nov 2026: an ask past the grid has no list price, and the order book cancels it when his offer is taken back with nothing paid */
  function makerWithdrawSaid(o){ return !(+o.total>0)&&!(+o.paid>0)?'Offer withdrawn. With no list price, the order is cancelled.':'Offer withdrawn. The order stands as they placed it.'; }
  function makerAsked(order){ var p=order&&order.price; return !!p&&p.from!=='accept'&&(p.state==='asked'||p.state==='offered')&&!makerAccHeld(order); }
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
      vaultSheetEl=document.getElementById('vaultSheet'), vaultPass=document.getElementById('vaultPass'),
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
    makerSpotGen++; makerSpotOpened={}; document.querySelectorAll('[data-maker-pin]').forEach(function(node){ node.remove(); });
    pairDrafts.forEach(function(d){ d.clear(); });
    joinForget();
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
      var ask=actOn(el('button','amb-pill amb-pill--quiet amb-pill--sm','Unlock'),'vault.unlock'); ask.type='button'; ask.onclick=function(){ vaultAsk(ask); }; gate.appendChild(ask);
    }
    if(gate.extra) gate.extra(gate);
  }
  /* every gate, the Shop row and the names beside the codes follow the lock */
  function makerVaultNotify(){
    [].forEach.call(document.querySelectorAll('[data-vault-gate]'),makerVaultDraw);
    [].forEach.call(document.querySelectorAll('[data-pin-gate]'),function(b){ if(b._draw) b._draw(); });
    kmRepaint();
    var state=document.getElementById('vaultState'), on=document.getElementById('vaultOn'), off=document.getElementById('vaultOff');
    if(state) state.textContent=makerVault?'Open on this phone':'Locked';
    if(on) on.hidden=!!makerVault;
    if(off) off.hidden=!makerVault;
    var vsw=document.getElementById('vaultSwitch'); if(vsw) vsw.checked=!!makerVault;
    makerVaultPaint();
    if(makerVault&&joinWant) joinOpenNow();
    if(joinTried&&Object.keys(joinTried).length) drawNeeds();
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
    sheetDown(vaultSheetEl); vaultPass.value=''; vaultSay.textContent=''; joinWant=null;
    if(!quiet){ try{ if(vaultBack&&vaultBack.isConnected&&vaultBack.focus) vaultBack.focus({preventScroll:true}); }catch(x){} }
  }
  function vaultAsk(opener){
    if(makerVault||!vaultSheetEl) return;
    vaultBack=opener||document.activeElement; vaultSay.textContent=''; vaultPass.value='';
    sheetUp(vaultSheetEl);
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
    [document.getElementById('vaultX'),document.getElementById('vaultKeep')].forEach(function(n){ n.addEventListener('click',function(){ vaultShut(false); }); });
    sheetWire(vaultSheetEl,function(){ vaultShut(false); });
    document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') vaultShut(false); });
    vaultSheetEl.addEventListener('keydown',function(ev){
      if(ev.key!=='Tab') return;
      var f=[].slice.call(vaultSheetEl.querySelectorAll('button,input')).filter(function(c){ return !c.disabled; }), i=f.indexOf(document.activeElement);
      if(ev.shiftKey&&i<=0){ ev.preventDefault(); f[f.length-1].focus(); }
      else if(!ev.shiftKey&&i===f.length-1){ ev.preventDefault(); f[0].focus(); }
    });
    /* Shop > This device holds the control that is always in reach: Unlock while shut, Lock while open */
    /* 26 Oct 2026, his word: Show names is a Switch; on asks for the password in the one Sheet, off locks */
    var vaultSw=document.getElementById('vaultSwitch');
    if(vaultSw) vaultSw.addEventListener('click',function(){ vaultSw.checked=!!makerVault; if(makerVault) makerVaultLock(); else vaultAsk(vaultSw); });
  }
  function makerClaimButton(parent,label,action,primary){
    var L=labOf(label), button=actOn(el('button',primary?'amb-pill':'amb-pill amb-pill--quiet amb-pill--sm',L[0]),L[1],L[2]);
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
    }catch(error){ nGot('claims', error); apply=failNew('claims', error)||!poll; if(show&&!poll) refusal(root,error); }
    finally{ claimsReading=false; if(apply){ paintOrdCounts(); drawNeeds(); } }
  }
  /* the claims drawn from the read that stands: a row each, and the card of the one opened under its row. A redraw lets every picture go first, and
     a claim answered meanwhile closes its card. */
  /* 16 Nov 2026 (the move to Ambient, place G): THE PAYMENTS THEY SAY THEY SENT ARE TWO PANES, the claims as Ambient's rows in the first and the one opened, its card, in the second, which ends in its
     one main action as its foot; from 960px they stand side by side, below it the card takes the list's place. */
  function drawMakerClaims(){
    var root=document.getElementById('makerClaims'); if(!root) return;
    makerSlipClose(); makerSlipDraw=null; dirty.makerClaims=false; root.textContent='';
    var waiting=makerClaims.filter(function(c){ return c.state==='waiting'; });
    if(makerClaimOpen&&!waiting.some(function(c){ return c.u+':'+c.id===makerClaimOpen; })) makerClaimOpen=null;
    var queue=el('div','amb-stack'), rec=el('div','amb-stack');
    if(makerClaimSaid){ var said=amb.node(amb.notice(makerClaimSaid)); said.setAttribute('role','status'); queue.appendChild(said); }
    if(!waiting.length) queue.appendChild(el('p','amb-empty rnone','No payments waiting.'));
    else{
      var ul=el('ul','amb-list amb-list--ruled');
      waiting.forEach(function(claim){ var li=el('li'); li.appendChild(makerClaimRow(claim,claim.u+':'+claim.id)); ul.appendChild(li); });
      queue.appendChild(ul);
    }
    root.appendChild(queue); root.appendChild(rec);
    root.classList.toggle('open', !!makerClaimOpen);
    if(makerClaimOpen){ var open=waiting.filter(function(c){ return c.u+':'+c.id===makerClaimOpen; })[0]; if(open){ rec.appendChild(ordBack('claims','All payments','claim.back')); makerClaimCard(rec,open,makerClaimOpen); } }
    else rec.appendChild(el('p','amb-empty','Choose a payment.'));
  }
  /* a row reads nothing: who, that they say they sent it, the slip if one is attached, how long ago and how much */
  function makerClaimRow(claim,key){
    var sub=el('span',null); sub.appendChild(chip('ember','Says sent')); if(claim.test) sub.appendChild(chip('mist','Practice'));
    sub.appendChild(document.createTextNode(' '+(claim.slip?'Slip attached':'No slip')));
    var b=hRow({title:whoTag(el('span',null,codeByUser(claim.u)),codeOfUser(claim.u)), sub:sub, age:ageOf(claim.at), amount:rm(claim.amount)});
    actOn(b,'claim.open',key); b.setAttribute('aria-expanded',makerClaimOpen===key?'true':'false');
    if(makerClaimOpen===key) b.setAttribute('aria-current','true');
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
  function makerClaimAskRow(claim){ return askRow(codeByUser(claim.u), rm(claim.amount), 'Says they paid it'+(claim.test?', practice':'')); }
  /* the Sheet a claim's Received or Not found asks on, in place of the native confirm. As makerAsk's: one action sends what the confirm let through, and
     the ghost, the close control, the scrim and Escape send nothing. q: title, say (lines), extra (nodes), go, keep, plain, yes. */
  function makerClaimAsk(claim,key,opener,kind,q){
    ynOpen({title:q.title, opener:opener, again:ynFind('claim:'+key+':'+kind), go:q.go, keep:q.keep, yes:q.yes,
      body:[makerClaimAskRow(claim)].concat(q.say.map(function(s){ return el('p',null,s); })).concat(q.extra||[])});
    var go=document.getElementById('ynGo');
    actOn(go,'claim.ask-go',key); actOn(document.getElementById('ynKeep'),'claim.ask-keep',key); actOn(document.getElementById('ynX'),'claim.ask-close',key);
    go.classList.toggle('amb-pill--danger',!q.plain); go.classList.toggle('amb-pill--accent',!!q.plain);
  }
  /* a claim's rows, one line each, as the card and the Received sheet show them */
  function makerClaimRowLine(row){ return (fmtWhen(row.date)||'Undated')+': '+rm(row.rm)+' of '+rm(row.owed); }
  /* the one send of a claim's answer, under the request id it was first given: the card's Sheet and Needs you's card both call it */
  async function sendClaimAnswer(claim,key,pending){
    var who=codeByUser(claim.u);
    await refs('/all/maker/claims/'+claim.u+'/'+claim.id+'/'+pending.action,pending.body); delete makerClaimRequests[key];
    makerClaimSaid=pending.action==='notfound'?'Answered Not found. '+who+' is told.':pending.body.covered?'Already recorded. '+who+' is told.':'Recorded. '+who+' is told.';
    makerClaimOpen=null; await loadMakerClaims(); await loadMaker();
  }
  function makerClaimCard(root,claim,key){
    var card=makerCard(root,'claim:'+key), route='/all/maker/claims/'+claim.u+'/'+claim.id, acts=el('div','maker-foot__acts'), who=codeByUser(claim.u);
    var turn=0, preview=null, said=el('p','amb-field__hint'), note=el('div','maker-quote amb-stack');
    card.setAttribute('data-key',key);
    var claimHead=el('h3','amb-section'); claimHead.appendChild(whoTag(el('span',null,who),codeOfUser(claim.u))); claimHead.appendChild(document.createTextNode(' says they paid '+rm(claim.amount)));
    card.appendChild(claimHead);
    card.appendChild(el('p','amb-field__hint maker-facts','Sent '+fmtWhen(claim.at)+(ageOf(claim.at)?', '+ageOf(claim.at)+' ago':'')+(claim.test?'. A practice account.':'')));
    card.appendChild(detailBox('claim.details',key,[['Reference',claim.id],['Sent',fmtWhen(claim.at)],['Slip',claim.slip?'Attached':'None'],['Practice',claim.test?'Yes':'']]));
    said.setAttribute('role','status'); card.appendChild(said); card.appendChild(note);
    if(claim.slip) makerSlipControl(card,claim.u,claim.slip,key);
    var receipt=makerClaimButton(acts,['Yes, received '+rm(claim.amount),'claim.received',key],function(){ return claimAsk(false,false); },true);
    var covered=makerClaimButton(acts,['Already recorded','claim.received-booked',key],function(){ return claimAsk(true,false); },false);
    var lost=makerClaimButton(acts,['Not found','claim.not-found',key],function(){ return claimAsk(false,true); },false);
    receipt.disabled=true; covered.disabled=true;
    receipt.setAttribute('data-yn','claim:'+key+':received'); covered.setAttribute('data-yn','claim:'+key+':received-booked'); lost.setAttribute('data-yn','claim:'+key+':notfound');
    makerCardFoot(card,acts,'claim:'+key,false,true);
    card.querySelector('.maker-foot').classList.add('amb-foot');
    var answer=card.querySelector('.maker-foot .maker-say');
    function claimShow(result){
      preview=result; said.className='amb-field__hint'; said.textContent='Rows read. Check them before you answer.';
      note.textContent='';
      (result.rows||[]).forEach(function(row){
        note.appendChild(el('p','maker-row',makerClaimRowLine(row)));
        (row.flags||[]).forEach(function(flag){ note.appendChild(el('p','amb-field__hint',typeof flag==='string'?noBook(flag):rowValue('flag',flag))); });
      });
      note.appendChild(el('p','amb-field__hint',result.booked?'Already recorded: Yes only tells them.':
        result.left>0.004?rm(result.left)+' more than the rows: do not record it twice.':'These rows are settled together.'));
      receipt.disabled=result.left>0.004; covered.disabled=!(result.left>0.004);
    }
    /* the rows are read when the card is drawn, which is when it is opened, and again by Read the rows again when that failed; Received waits for them */
    function claimRead(){
      var mine=++turn; preview=null;
      said.className='amb-field__hint'; said.textContent='Reading the rows.'; note.textContent='';
      refs(route+'/preview',{}).then(function(result){
        if(mine!==turn||!card.isConnected) return;
        claimShow(result);
      }).catch(function(error){
        if(mine!==turn||!card.isConnected) return;
        said.className='amb-field__hint msg bad'; refusal(said,error);
        makerClaimButton(note,['Read the rows again','claim.reread',key],claimRead,false);
      });
    }
    async function claimPost(pending){
      if(pending.busy) return; pending.busy=true; [receipt,covered,lost].forEach(function(b){ b.disabled=true; });
      try{
        await sendClaimAnswer(claim,key,pending);
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
  /* Salt Admin A to C (20 Oct 2026), P4: ONE OPEN for what a customer's phone seals to the slip key (stmt/slip.js, stmt/pin.js): ECDH with the
     slip key the one unlock holds, HKDF under the kind's own info ('salt-slip v1' or 'salt-pin v1', so neither opens as the other), AES-GCM */
  async function makerSealedOpen(privateKey,sealed,info){
    var epk=await crypto.subtle.importKey('raw',makerFrom64(sealed.epk),{name:'ECDH',namedCurve:'P-256'},false,[]);
    var bits=await crypto.subtle.deriveBits({name:'ECDH',public:epk},privateKey,256);
    var hk=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
    var aes=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:new TextEncoder().encode(info)},
      hk,{name:'AES-GCM',length:256},false,['decrypt']);
    return crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(sealed.iv)},aes,makerFrom64(sealed.ct));
  }
  /* Salt Admin A to C (20 Oct 2026), P4, HIS ANSWER: THE DELIVERY ADDRESS, their sealed spot, opened here too after the one unlock (it was the
     Desk's alone). Sealed while shut, with Unlock; open, the Address (the spot's name), its floor or unit and Maps from the point, each from the
     seal and nothing stored but in page memory (11 Nov 2026: the Name, then the Address as they typed it, with Maps searching it): the opened part carries data-maker-pin, and makerVaultLock (the lock, a hidden page, a lapse)
     takes it off and lets the held copy go. A unit alone has no Maps. Filing it as their place
     was the Desk's alone until 17 Nov 2026 (his yes to the one place field plan, D4): makerFileSpot files it from here too. */
  async function makerFileSpot(code,p){
    var label=makerGeo.locality(+p.lat,+p.lng);
    if(!label) throw new Error('No listed locality near that point. File it from Place on the map, choosing one.');
    var coords=await makerLocalityPoint(label);
    var filed={addr:typeof p.addr==='string'&&p.addr?p.addr.slice(0,1000):null,lat:Math.round(+p.lat*1e6)/1e6,lng:Math.round(+p.lng*1e6)/1e6,src:'pin',at:new Date().toISOString()};
    var draft=await makerPairPrepare(makerVaultBase(),function(maps){ maps.places[code]=filed; },null);
    delete draft.placeMap;
    var body={at:new Date().toISOString(),places:{}}; body.places[code]=coords;
    if(draft.places) body.addrVault=draft.places;
    makerPairBody(body,draft);
    var result=await refs('/all/maker/inputs/place',body);
    if(!result||result.ok!==true) throw new Error('The Desk did not confirm. Nothing is lost; tap again.');
    makerVaultRefresh();
    return result;
  }
  function spotHref(lat,lng){
    var ua=(navigator&&navigator.userAgent)||'', ll=lat+','+lng;
    if(/iPhone|iPad|iPod|Macintosh/.test(ua)) return 'https://maps.apple.com/?ll='+ll+'&q=Their%20spot';
    if(/Android/.test(ua)) return 'geo:'+ll+'?q='+ll+'(Their%20spot)';
    return 'https://www.google.com/maps/search/?api=1&query='+ll;
  }
  /* Fable's review of P4: the spot keeps its own generation, bumped by the lock alone (a tap that closes a claim's slip leaves it be), and the spot
     opened once is held here until the lock, so a redraw of the card (each poll) neither fetches nor opens it again */
  var makerSpotGen=0, makerSpotOpened={};
  function makerSpotControl(parent,order){
    /* 16 Nov 2026 (the move to Ambient, place G): the spot is a settings group, its head and chip, a row a line it says, Maps and Lock as action rows, the one line under it */
    var box=el('div','amb-settings adspot'), note=el('p','amb-settings__foot msg adspot__note'), key=order.id, body=null;
    box.setAttribute('aria-label','Delivery address'); box.setAttribute('data-pin-gate','');
    note.setAttribute('aria-live','polite');
    parent.appendChild(box);
    function head(sealed){
      box.textContent='';
      var h=el('h3','amb-settings__head','Delivery address'); if(sealed) h.appendChild(chip('mist','Sealed'));
      box.appendChild(h);
      body=el('ul','amb-settings__list'); box.appendChild(body);
    }
    function bodyRow(n){ var li=el('li'); li.appendChild(n); body.appendChild(li); return n; }
    function sealedDraw(){
      head(true);
      var b=aAct(aBtn('Unlock','amb-action','vault.unlock','spot:'+key)); b.addEventListener('click',function(){ vaultAsk(b); }); bodyRow(b);
    }
    function said(text){ head(false); note.textContent=text; box.appendChild(note); }
    function adSpotPaint(p){
      head(false);
      var label=typeof p.label==='string'?p.label.slice(0,24):'', unit=typeof p.unit==='string'?p.unit.slice(0,40):'', addr=typeof p.addr==='string'?p.addr.slice(0,1000):'', mark=null;
      var hasPt=p.src!=='unit'&&p.lat!=null&&p.lng!=null&&isFinite(p.lat)&&isFinite(p.lng)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lng)<=180;
      var code=codeOfUser(order.u), fileable=!!code&&!/-R$/.test(code), held=makerSpotOpened[order.u+'/'+order.pin];
      body.setAttribute('data-maker-pin','');
      /* 11 Nov 2026: a spot is a name and its typed address, or a point; one filed before carried a floor or unit */
      if(label) bodyRow(aLine('Name',label));
      if(addr) bodyRow(aLine('Address',addr));
      if(unit) bodyRow(aLine('Floor or unit',unit));
      if(hasPt){
        var a=el('a','amb-action adspot__maps'); a.href=spotHref(+p.lat,+p.lng); a.setAttribute('data-spot-maps','');
        if(/^https:/.test(a.getAttribute('href'))){ a.target='_blank'; a.rel='noopener'; }
        a.appendChild(document.createTextNode('Maps')); bodyRow(a);
      }else if(p.src==='addr'&&addr){
        /* 17 Nov 2026 (his yes to the one place field plan, D1): what the app could not read reaches him whole; a link of theirs opens as it is */
        var their=/https:[/][/][^ ]+/.exec(addr), q=el('a','amb-action adspot__maps');
        q.href=their?their[0].split(String.fromCharCode(10))[0]:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(addr); q.target='_blank'; q.rel='noopener'; q.setAttribute('data-spot-maps','');
        q.appendChild(document.createTextNode(their?'Open their link':'Maps')); bodyRow(q);
      }else if(p.src!=='unit') mark='Their link could not be opened to a point just now.';
      var lk=aAct(aBtn('Lock','amb-action','vault.lock','spot:'+key)); lk.addEventListener('click',function(){ makerVaultLock(); }); bodyRow(lk);
      /* NEEDS PLACING (D3): an address with no point is placed here once, from Maps' own link, figures, a place found or his location; the point
         measures this order's distance on this page and may then be filed as their place */
      if(!hasPt&&p.src==='addr'&&addr){
        var pin=actOn(el('input','amb-input'),'spot.place',key); pin.type='text';
        box.appendChild(sField('Place it',pin));
        placeAssist(pin,{id:'adspotPlace'+String(key).replace(/[^A-Za-z0-9]/g,''),act:'spot.place',keep:true});
        var use=aPill('Use this point','spot.place.use',key,true,true); box.appendChild(use);
        use.addEventListener('click',async function(){
          var at=null; use.disabled=true;
          try{ at=await pointPlace(pin.value); }catch(e){ at=null; }
          use.disabled=false;
          if(!at){ note.textContent='Paste the link Maps gives, two figures, or pick a place from the list.'; return; }
          var placed=Object.assign({},p,{lat:at.lat,lng:at.lng,placed:true});
          makerSpotOpened[order.u+'/'+order.pin]=placed; kmRepaint(); adSpotPaint(placed);
        });
      }
      /* FILED FROM HERE TOO (D4): the point, theirs or placed, files as their place for his Approve, as Place on the map files one */
      var had=fileable&&makerVault&&makerVault.places&&makerVault.places[code], same=!!had&&had.lat!=null&&had.lng!=null&&haversineKm({lat:+had.lat,lng:+had.lng},{lat:+p.lat,lng:+p.lng})<0.05;
      if(hasPt&&fileable&&!same&&!(held&&held.filed)){
        var file=aAct(aBtn('File as their place','amb-action','spot.file',key)); bodyRow(file);
        file.addEventListener('click',async function(){
          file.disabled=true; note.textContent='Filing their place.';
          try{ await makerFileSpot(code,p); var h=makerSpotOpened[order.u+'/'+order.pin]; if(h) h.filed=true; adSpotPaint(h||Object.assign({},p,{filed:true})); note.textContent='Sent. It is their place once you approve it.'; }
          catch(error){ file.disabled=false; refusal(note,error); }
        });
      }
      note.textContent=(mark?mark+' ':'')+(same?'This is the place filed for them.':p.filed?'Sent. It is their place once you approve it.':!hasPt&&p.src==='addr'&&addr?'No point yet: place it to measure the distance.':'');
      box.appendChild(note);
    }
    async function adSpotOpen(){
      var generation=makerSpotGen, held=makerSpotOpened[order.u+'/'+order.pin];
      /* a link that did not open is held five minutes, then asked again, so each minute's redraw does not open it afresh (Fable) */
      if(held&&!(held.missAt&&Date.now()-held.missAt>300000)){ adSpotPaint(held); return; }
      said('Opening the address.');
      try{
        if(!makerVault.slip) throw new Error('No slip key is filed.');
        var j=await refs('/all/maker/pins/'+order.u+'/'+order.pin);
        if(generation!==makerSpotGen||!makerVault) return;
        var b=await makerSealedOpen(makerVault.slip,j.pin,'salt-pin v1');
        if(generation!==makerSpotGen||!makerVault||document.hidden) return;
        var p=null; try{ p=JSON.parse(new TextDecoder().decode(b)); }catch(e){ p=null; }
        if(!p||typeof p!=='object') throw new Error('It holds nothing this page reads.');
        /* 4 Nov 2026 (his report that the exact location did not work): a shared short link holds no point until it is opened, so it is
           opened here as Shop's points open one (pointPlace, /all/maker/geo/open, Google and Apple only, nothing kept) */
        var landed=true;
        if(typeof p.link==='string'&&!(isFinite(p.lat)&&isFinite(p.lng))){
          var lp=null; try{ lp=await pointPlace(p.link); }catch(e){ lp=null; }
          if(generation!==makerSpotGen||!makerVault||document.hidden) return;
          if(lp) p=Object.assign({},p,{lat:lp.lat, lng:lp.lng});
          else { landed=false; p=Object.assign({},p,{missAt:Date.now()}); }
        }
        makerSpotOpened[order.u+'/'+order.pin]=p; if(landed) kmRepaint();
        if(box.isConnected) adSpotPaint(p);
      }catch(error){
        if(generation===makerSpotGen) said(/not kept/.test(String(error&&error.message))?'The address they shared is no longer kept.':'The address could not be opened: '+(error&&error.message||error));
      }
    }
    box._draw=function(){ if(!box.isConnected) return; if(!makerVault) sealedDraw(); else adSpotOpen(); };
    box._draw();
  }
  /* THE SLIP of a claim: sealed until the page holds the slip key (the one unlock, above), a thumbnail once it does, and the thumbnail is the control that enlarges
     it. The picture is a blob: URL, let go on the lock, on a page hidden, and when its card closes; the ciphertext is fetched only once there is a key to open it. */
  function makerSlipControl(parent,u,id,key){
    var box=el('div','maker-slipbox'), note=el('p','amb-field__hint msg'); parent.appendChild(box);
    note.setAttribute('role','status');
    function slipSealed(){
      box.textContent=''; box.classList.remove('open');
      note.textContent='Unlock names and places to see the slip on this phone.'; box.appendChild(note);
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
        var bytes=await makerSealedOpen(privateKey,sealedSlip,'salt-slip v1');
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
  var chatMs=2000;   /* Speed Wave 2 L2: a minute while the live socket is up */
  /* 15 NOV 2026, THE MOVE TO AMBIENT: THE SCREEN SCROLLS. His page is one Ambient shell, the height of the display, and its screen is the one box
     that scrolls (the salt-ds frame and the script that measured its panes are gone); a split of panes (amb-split--panes) holds still and scrolls each pane
     by itself from 960px, with no script. framed() is that width, read off the shell as Ambient reads it. */
  function frameEl(){ return document.querySelector('#roster > .amb-screen'); }
  function framed(){ var r=document.getElementById('roster'); return !!(r&&r.clientWidth>=960); }
  function pageTop(){ try{ window.scrollTo(0,0); }catch(e){} var m=frameEl(); if(m) m.scrollTop=0; }
  /* what a thread scrolls in: its pane in the frame, the page under 1080px */
  function threadBox(){ var p=document.getElementById('makerChatOpen'), sc=function(x){ return !!x&&x.scrollHeight>x.clientHeight&&/auto|scroll/.test(window.getComputedStyle(x).overflowY); };
    return sc(p)?p:(frameEl()||document.scrollingElement||document.documentElement); }
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
    },chatMs);
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
      drawThreadList();
      var waiting=makerThreads.filter(function(thread){return !thread.test&&makerThreadAsked(thread);});
      status.textContent=!makerThreads.length?'No messages yet.':!waiting.length?'Nothing waits for your reply.':waiting.length+(waiting.length===1?' waits':' wait')+' for your reply.';
      if(makerThreadUser) drawMakerThreadLines();
    }catch(error){ nGot('threads', error); apply=failNew('threads', error)||quiet!==true; if(apply) refusal(status,error); }
    finally{ makerThreadsReading=false; if(apply) drawNeeds(); }
  }
  /* 16 Nov 2026, THE MOVE TO AMBIENT (place H, Messages): A THREAD IS AMBIENT'S ROW. Waiting (theirs last) under To do, Answered under FYI, each a head over ONE list; within each what they owe
     first, then the oldest. The code over one line, the state and its age and the last line said, cut to the row (ember while it waits); Reply, a small pill, only on one waiting;
     a tap anywhere on the text opens it. 5 Nov 2026: what they owe stands in the second line. */
  function drawThreadList(){
    var list=document.getElementById('makerChatList'); if(!list) return;
    list.textContent='';
    var acc=function(u){ return sheet&&sheet[u]||null; }, owedOn=function(u){ var a=acc(u); return a&&a.flag==='owes'&&a.t?+a.t.owed||0:0; };
    var groups=[['now','To do'],['watch','FYI']];
    groups.forEach(function(g){
      var rows=makerThreads.map(function(th, i){ return [th, i]; }).filter(function(x){ return (makerThreadAsked(x[0])&&!x[0].test?'now':'watch')===g[0]; })
        .sort(function(x, y){ return (owedOn(y[0].u)-owedOn(x[0].u))||(x[1]-y[1]); }).map(function(x){ return x[0]; });
      if(!rows.length) return;
      var box=el('section','athreads'), ul=el('ul','amb-list amb-list--ruled');
      box.setAttribute('data-sev', g[0]); box.setAttribute('aria-label', g[1]); box.appendChild(el('h2','amb-section',g[1]));
      rows.forEach(function(th){
        var ms=th.msgs||[], last=ms[ms.length-1]||{}, asked=g[0]==='now', who=th.test?'Practice':codeByUser(th.u), owe=owedOn(th.u), age=last.at?ageOf(last.at):'';
        var row=el('li','amb-row athrow'), open=actOn(el('button','amb-row__main'),'chat.open',th.u), tx=el('span','amb-row__text'), ti=el('span','amb-row__title'), sub=el('span','amb-row__sub athrow__line');
        open.type='button';
        row.setAttribute('data-thread', th.u); row.setAttribute('data-sev', g[0]); if(th.test) row.setAttribute('data-practice','');
        ti.appendChild(whoTag(el('span','acode',who),who)); tx.appendChild(ti);
        sub.appendChild(el('span',asked?'amb-neg':null,(asked?'Waiting':'Answered')+(age?' '+age:'')));
        if(owe>0.004) sub.appendChild(document.createTextNode(', owes '+rmShort(owe)));
        var said=(last.by==='desk'?'You: ':'')+cut(last.text||''); if(said) sub.appendChild(document.createTextNode(' · '+said));
        tx.appendChild(sub); open.appendChild(tx); row.appendChild(open);
        open.setAttribute('aria-label',(asked?'Waiting':'Answered')+(age?', '+age:'')+': '+who+(last.text?', '+cut(last.text):'')+(owe>0.004?', owes '+rmShort(owe):''));
        open.addEventListener('click', function(){ openMakerThread(th.u); });
        if(asked){ var tr=el('span','amb-row__trail'), b=aPill('Reply','chat.reply-open',th.u,true,true); b.addEventListener('click', function(){ openMakerThread(th.u); }); tr.appendChild(b); row.appendChild(tr); }
        if(makerThreadUser===th.u){ row.setAttribute('aria-current','true'); open.setAttribute('aria-current','true'); }
        ul.appendChild(row);
      });
      box.appendChild(ul); list.appendChild(box);
    });
  }
  /* 5 NOV 2026, his word: A THREAD OPENS AT ITS NEWEST LINE, as Messages does, older lines a scroll up. A line that lands while he reads the newest
     keeps him there; one that lands while he has scrolled up to read leaves him where he is (the poll redraws every line every 2 seconds). 16 Nov 2026: the lines are Ambient's Thread. */
  function drawMakerThreadLines(first){
    var root=document.getElementById('makerChatLines');
    if(!root) return;
    var box=threadBox(), end=first===true||box.scrollHeight-box.scrollTop-box.clientHeight<48, keep=box.scrollTop;
    root.textContent='';
    var thread=makerThreads.filter(function(value){ return value.u===makerThreadUser; })[0];
    (thread&&thread.msgs||[]).forEach(function(line){
      var mine=line.by==='desk', b=el('li','amb-msg'+(mine?' amb-msg--mine':'')), meta=el('p','amb-msg__meta'), tm=el('time',null,stampDay(line.at));
      b.appendChild(el('p','amb-msg__text maker-row',line.text));
      meta.appendChild(el('span','maker-facts',mine?'You':codeByUser(makerThreadUser)));
      if(line.at){ var d=new Date(line.at); if(!isNaN(d)) tm.setAttribute('datetime',d.toISOString()); }
      meta.appendChild(tm);
      if(mine) meta.appendChild(el('span','amb-msg__state','Sent'));
      b.appendChild(meta);
      root.appendChild(b);
    });
    box.scrollTop=end?box.scrollHeight:keep;
  }
  function openMakerThread(user){
    makerThreadUser=user;
    var root=document.getElementById('makerChatOpen');root.hidden=false;root.textContent='';
    var grid=root.closest('.chatgrid'), none=document.getElementById('chatnone');
    if(grid) grid.classList.add('open'); if(none) none.hidden=true; drawThreadList();
    root.setAttribute('data-key',user);
    var ah=el('div','chathead'), aw=el('div','chathead__who'), ac=sheet&&sheet[user], owe=ac&&ac.flag==='owes'&&ac.t?+ac.t.owed||0:0;
    aw.appendChild(whoTag(el('h2','amb-section chathead__code',codeByUser(user)),codeOfUser(user)));
    if(owe>0.004) aw.appendChild(el('p','amb-field__hint ahead__fig','They owe '+rmShort(owe)));
    ah.appendChild(aw);
    root.appendChild(ah);
    var lines=el('ol','amb-thread');lines.id='makerChatLines';lines.setAttribute('role','log');lines.setAttribute('aria-label','The thread with '+codeByUser(user));root.appendChild(lines);
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
    /* after the lines what else he may do, then the answer, then the foot, pinned: his box and Send, the pane's one main action */
    var more=el('div','chatmore'), status=el('p','amb-field__hint msg'), foot=el('div','amb-foot chatfoot'), form=el('form','amb-compose');
    form.addEventListener('submit',function(ev){ ev.preventDefault(); });
    var text=el('textarea','amb-input');text.rows=1;text.maxLength=200;text.value=draft.text;text.placeholder='Answer them';text.setAttribute('aria-label','Answer them');
    text.setAttribute('data-thread-reply',user);actOn(text,'chat.reply');text.oninput=function(){draft.text=text.value;};
    status.setAttribute('role','status');
    var send=el('button','amb-circle amb-circle--lg'),
      quiet=el('button','amb-pill amb-pill--quiet amb-pill--sm','No reply needed'),cancel=el('button','amb-pill amb-pill--quiet amb-pill--sm','Discard unsent reply'),
      restore=el('button','amb-pill amb-pill--quiet amb-pill--sm','Open unsent reply'),close=el('button','amb-pill amb-pill--quiet amb-pill--sm','Close');
    send.appendChild(ambIcon('send'));send.setAttribute('aria-label','Send');
    [send,quiet,restore,cancel,close].forEach(function(button){button.type='button';});
    form.appendChild(text); form.appendChild(send); foot.appendChild(form);
    [quiet,restore,cancel,close].forEach(function(button){more.appendChild(button);});
    root.appendChild(more); root.appendChild(status); root.appendChild(foot);
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
      send.setAttribute('aria-label',draft.pending&&draft.pending.message!==undefined?'Send again':'Send');
      quiet.textContent=draft.pending&&draft.pending.noReply?'Send it again':'No reply needed';
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
          if(!OWNER.master) throw new Error('Reload Salt Admin, then send the reply again.');
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
        if(!OWNER.master) throw new Error('Reload Salt Admin to open the unsent reply.');
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
    close.onclick=function(){makerThreadUser=null;root.hidden=true;var g=root.closest('.chatgrid'),n=document.getElementById('chatnone');if(g) g.classList.remove('open');if(n) n.hidden=false;stopMakerChat();drawThreadList();};
    if(draft.storageError) draft.note=draft.storageError;
    else if(draft.saved&&!draft.pending) draft.note='An unsent reply is kept on this phone. Open it to send it again, or discard it.';
    makerChatState();drawMakerThreadLines(true);startMakerChat();
  }
  /* 16 Oct 2026: THE MINI LEDGER. Open orders, Pending orders and the latest twenty, read off the Desk's mirror of the folded book by the engine's own rules (GET
     /all/maker/ledger: txStat for the stage, txOwed, txPaid and txAdvance for what is owed, txEffDeliv for what was handed over). This page states no status
     or price and sorts nothing; it draws what it is given, a book as its mark and a customer as its code. An order the site has not yet put on the book is under Orders, not here. */
  /* 16 Nov 2026 (the move to Ambient, place G): THE THREE TABLES ARE AMBIENT'S, one set of nine columns, each cell carrying its column's heading (data-label), so under 720px a row is a stack of labelled
     lines and the table never scrolls sideways; a figure stands right (is-num). */
  var LEDGER_COLS=[['Order',''],['Date',''],['Customer',''],['Book',''],['Units','n'],['Total','n'],['Owed','n'],['Handed over',''],['Stage','']];
  var LEDGER_TABLES=[['open','Open orders','No open orders.'],['pending','Pending orders','No pending orders.'],['recent','Latest 20 orders','No orders on the book.']];
  function ledgerCells(r){
    var cell=function(i,v){ var td=el('td',LEDGER_COLS[i][1]?'is-num':'',v==null?'':v); td.setAttribute('data-label',LEDGER_COLS[i][0]); return td; };
    var owed=cell(6,rm(r.owed)); if(r.advance>0.009) owed.appendChild(el('span','amb-table__sub','goods out, '+rm(r.advance)));
    var book=cell(3); book.appendChild(bookChip(r.product));
    /* 27 Oct 2026, his word: a row opens in the sale form from here, its reference the tap */
    var ref=cell(0), open=actOn(el('button','amb-pill amb-pill--sm amb-pill--quiet lopen',r.rid),'ledger.open',r.rid); open.type='button';
    open.setAttribute('aria-label','Open '+r.rid+' to change it'); open.onclick=function(){ amendFor(r.rid); }; ref.appendChild(open);
    return [ref, cell(1,r.date?fmtWhen(r.date):'Undated'), cell(2,r.customer), book, cell(4,String(+r.qty)), cell(5,rm(r.total)),
      owed, cell(7,String(+r.moved)+' of '+String(+r.qty)), cell(8,r.stage)];
  }
  function drawLedger(j){
    LEDGER_TABLES.forEach(function(t){
      var root=document.getElementById('led-'+t[0]), rows=j[t[0]]||[]; if(!root) return;
      root.textContent='';
      var h=document.getElementById('led-'+t[0]+'-h'); if(h) h.textContent=t[1]+' · '+rows.length;
      if(!rows.length){ root.appendChild(el('p','amb-empty rnone',t[2])); return; }
      var table=el('table','amb-table amb-table--stack ledtable'), head=el('tr'), body=el('tbody');
      LEDGER_COLS.forEach(function(c){ var th=el('th',c[1]?'is-num':'',c[0]); head.appendChild(th); th.setAttribute('scope','col'); });
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
    status.textContent='The folded book: '+j.orders+(j.orders===1?' order':' orders')+'. A site order not yet on the book is under Received.';
    drawLedger(j);
    drawTieout(j.tieout);
    ledgerTie=j.tieout||null; ledgerAt=Date.now(); ledgerPaint();
  }
  /* 18 Nov 2026 (his answer D): LEDGER CHECK IN EVERY PLACE'S BAR. It says the tie-out as the Desk last ran it (after each version and every six hours, or his Check now), read
     with the page and again when he changes place once ten minutes have passed: a tick while every site order matches its row, the count of differences while they do not, the
     word alone while there is no check to read. It runs no check of its own, and a tap opens the part that Check now stands in. */
  var ledgerTie=null, ledgerAt=0, ledgerBusy=false;
  function ledgerPaint(){
    var t=ledgerTie, known=!!(t&&t.ok), n=known&&!t.clean?(t.faults||[]).length:0;
    var say='Ledger check: '+(!known?'not checked yet':t.clean?'every order matches the book':n===1?'one difference between the orders and the book':n+' differences between the orders and the book');
    [].forEach.call(document.querySelectorAll('[data-ledger]'), function(b){
      var ok=b.querySelector('[data-ledger-ok]'), c=b.querySelector('[data-ledger-n]');
      if(ok&&ok.hidden!==!(known&&t.clean)) ok.hidden=!(known&&t.clean);
      if(c){ var v=n?String(n):''; if(c.textContent!==v) c.textContent=v; if(c.hidden!==!n) c.hidden=!n; }
      if(b.getAttribute('aria-label')!==say){ b.setAttribute('aria-label',say); b.title=say; }
    });
  }
  async function ledgerRead(){
    if(TESTING||ledgerBusy||!document.querySelector('[data-ledger]')) return;
    ledgerBusy=true;
    try{ var j=await refs('/all/maker/ledger'); ledgerTie=j.tieout||null; ledgerAt=Date.now(); ledgerPaint(); }catch(e){ ledgerAt=Date.now()-540000; }   /* a read that failed is tried again after a minute, never on every tap */
    ledgerBusy=false;
  }
  /* 17 Oct 2026, HIS FLOW: THE TIE-OUT. Every site order against its row, read by the Desk after each version and every six hours: clean, or each
     difference by order and row; a difference a move on its way explains is listed apart, as waiting. Check now asks the Desk for a fresh one. */
  /* 20 Nov 2026 (his word, "why is it not in plain language"): a difference names its order as he knows it (the Desk's who: code, book, size, total, day), never by the order's id or
     its key; the id stands only for a check filed before the Desk said who. A difference with no order (the orders behind the book) is its plain sentence (say). */
  function tieLine(f){
    var who=f.who||f.order||'', said=f.order||Array.isArray(f.what)?[].concat(f.what||[]).join('; '):(f.say||f.why||String(f.what||''));
    return (who?who+(f.rid?' · '+f.rid:'')+': ':'')+said+'.';
  }
  function tieBook(v){ var m=/^book@([0-9]+)$/.exec(String(v||'')); return m?'book revision '+m[1]:'book '+v; }
  function drawTieout(t){
    var root=document.getElementById('led-tie'); if(!root) return;
    root.textContent='';
    root.appendChild(el('h2','amb-section','Order and book'));
    if(!t) root.appendChild(el('p','amb-field__hint','Not checked yet. The Desk checks after each version.'));
    else if(!t.ok) root.appendChild(el('p','amb-field__hint amb-neg msg bad','Not checked: '+(t.error||'the Desk could not read it')+'.'));
    else{
      root.appendChild(el('p',t.clean?'amb-field__hint':'amb-field__hint amb-neg msg bad',(t.clean?'Every site order matches its row on the book':(t.faults.length===1?'One difference':t.faults.length+' differences')+' between the orders and the book')
        +', '+t.orders+(t.orders===1?' order':' orders')+' checked against '+tieBook(t.v)+' at '+fmtWhen(t.at)+'.'));
      [['faults','Differences'],['waiting','Waiting on a move under Approve']].forEach(function(g){
        if(!(t[g[0]]||[]).length) return;
        root.appendChild(el('h3','amb-settings__head',g[1]));
        t[g[0]].forEach(function(f){ root.appendChild(el('p','amb-field__hint maker-facts',tieLine(f))); });
      });
    }
    var said=el('p','amb-field__hint msg'); said.setAttribute('role','status'); root.appendChild(said);
    makerButton(root,['Check now','ledger.tieout'],async function(){
      said.textContent='Checking.';
      var j=await refs('/all/maker/ledger',{}); drawLedger(j); drawTieout(j.tieout); ledgerTie=j.tieout||null; ledgerAt=Date.now(); ledgerPaint();
    },false);
  }
  /* A GROUP ORDER (the pool): open one, see who is in by units, and Close. Close closes it, tells each joiner once and sends
     each joined order for acknowledgement; one the Desk would not accept is listed under the pool with its reason, and Close
     again retries those alone. Reaching the target closes nothing: only this does. */
  async function loadMakerPools(){
    var root=document.getElementById('makerPools'); if(!root||placeNow!=='shop'||partNow!=='group') return;
    var result;
    try{ result=await refs('/all/maker/pools'); }catch(error){ refusal(root,error); return; }
    if(!root.isConnected||placeNow!=='shop'||partNow!=='group') return;
    root.textContent='';
    var note=el('p','amb-field__hint msg',''); note.setAttribute('role','status');
    function field(label,type,attrs){
      var L=labOf(label), l=el('label','amb-field'); l.appendChild(el('span','amb-field__label',L[0]));
      var i=actOn(el('input','amb-input'),L[1],L[2]); i.type=type; Object.keys(attrs||{}).forEach(function(k){ i.setAttribute(k,attrs[k]); });
      l.appendChild(i); root.appendChild(l); return i;
    }
    /* the book is chosen by its mark, never typed: a name typed here would be a name drawn (his word of 12 Oct 2026); the books are the ones that have a mark */
    var product=makerTilesIn(root,['Book','pool.product'],Object.keys(PLET).map(bookItem)), size=field(['Units each','pool.size'],'number',{min:'0',step:'any'}),
        target=field(['Target, units','pool.target'],'number',{min:'0',step:'any'}), closes=field(['Closes on (optional)','pool.closes-on'],'date',{});
    var open=el('button','amb-pill','Open group order'); open.type='button'; actOn(open,'pool.open');
    open.onclick=async function(){
      open.disabled=true;
      try{
        var body={product:product.value,q:Number(size.value),target:Number(target.value)};
        if(closes.value) body.closesOn=closes.value;
        await refs('/all/maker/pools',body); await loadMakerPools();
      }catch(error){ refusal(note,error); open.disabled=false; }
    };
    root.appendChild(open); root.appendChild(note);
    /* a pool is Ambient's task: its book's chip and state, what is in and who joined, and the one move it has */
    (result.pools||[]).forEach(function(p){
      var card=amb.node(amb.task({kind:'Group order', title:units(p.q)+' each', tone:p.state==='open'?'pos':'', state:p.state==='open'?'Open':'Closed',
        figures:[['In',p.unitsIn+' of '+p.target+' units'],['Joined',String((p.joins||[]).length)]],
        text:p.closesOn?'Closes '+fmtWhen(p.closesOn)+'.':''}));
      card.classList.add('maker-card'); card.setAttribute('data-key',p.id);
      var head=card.querySelector('.amb-task__head'); head.insertBefore(bookChip(p.product),head.firstChild);
      (p.closeLeft||[]).forEach(function(x){ card.appendChild(el('p','amb-task__text','One order was not agreed: '+noBook(x.why)+'.')); });
      if(p.state==='open'||(p.closeLeft||[]).length){
        var close=el('button','amb-pill amb-pill--sm',p.state==='open'?'Close':'Close again'); close.type='button'; actOn(close,'pool.close',p.id);
        ynTag(close,'pool:'+p.id);
        var closePool=async function(){
          close.disabled=true;
          try{
            var r=await refs('/all/maker/pools/'+encodeURIComponent(p.id)+'/close',{});
            await loadMakerPools();
            var again=document.getElementById('makerPools'); if(again){ var m=el('p','amb-field__hint msg',r.accepted.length+' sent to you to agree'+(r.left.length?', '+r.left.length+' left':'')+'.'); m.setAttribute('role','status'); again.insertBefore(m,again.firstChild); }
          }catch(error){ refusal(note,error); close.disabled=false; }
        };
        close.onclick=function(){
          if(p.state!=='open'){ closePool(); return; }
          ownerAsk(close,'pool:'+p.id,{title:'Close this group order?', row:askRow('each', p.unitsIn+' of '+p.target+' units', (p.joins||[]).length+' joined', bookTile(p.product,p.q)),
            say:['Each joined order comes to you to agree, and every joiner is told once.'], go:'Close the group order', keep:'Keep it open'})
            .then(function(yes){ if(yes) closePool(); });
        };
        var acts=el('div','amb-task__acts'); acts.appendChild(close); card.appendChild(acts);
      }
      root.appendChild(card);
    });
  }
  /* Up now: the first line on the recipe, a dot a line, every line in the list, the count in the chip; none, a line says so */
  /* Up now: a row a line, in the words customers read; None while nothing is up; Clear the notice only while something is */
  function drawNoticeUp(list){
    list=list||[];
    var cur=document.getElementById('makerBulletinCurrent'), none=document.getElementById('makerBulletinNone'), clr=document.querySelector('[data-act="notice.clear"]'), foot=document.getElementById('makerBulletinFoot');
    if(!cur) return;
    cur.textContent=''; list.forEach(function(l){ var r=el('div','amb-setting'); r.appendChild(el('span','amb-setting__name',l)); cur.appendChild(sLi(r)); });
    if(none) none.hidden=!!list.length; if(clr) clr.hidden=!list.length; if(foot) foot.textContent=list.length?'Shown one at a time on every account.':'';
  }
  async function loadMakerBulletin(){
    var root=document.getElementById('makerBulletin'), status=document.getElementById('makerBulletinStatus');
    if(!root) return;
    var text=root.querySelector('textarea');
    if(!text){
      /* 26 Oct 2026, his word (Notice "based on the same design language" as This device, iPad and Mac included): UP NOW, a list of the lines
         customers read, None while nothing is up, and Clear the notice in ember, asking first; NEW NOTICE, the box filling its cell and one grey
         line, then Set the notice, the one pill. Read it again stands only when a send left the notice unknown. */
      var upG=sGroup('Up now','anotice-up'), current=upG.list;current.classList.add('anotice-lines');current.id='makerBulletinCurrent';current.setAttribute('role','list');current.setAttribute('aria-label','Every line');
      var none=sFoot('None'); none.id='makerBulletinNone'; upG.appendChild(none);
      var actG=sGroup(null,'anotice-acts'), refresh=sAction('Read it again'), clear=sAction('Clear the notice',null,null,true); refresh.classList.add('anotice-again'); refresh.hidden=true; clear.hidden=true;
      actG.list.appendChild(sLi(refresh)); actG.list.appendChild(sLi(clear));
      var upFoot=sFoot(''); upFoot.id='makerBulletinFoot'; actG.appendChild(upFoot);
      root.appendChild(upG); root.appendChild(actG);
      root.appendChild(el('h3','amb-section','New notice'));
      text=actOn(el('textarea','amb-input'),'notice.text');text.rows=4;text.placeholder='One line each';text.setAttribute('aria-label','New notice, one line each');
      root.appendChild(sField('Notice',text,'Every customer is notified.'));
      var retained=el('div','');retained.hidden=true;root.appendChild(retained);
      var set=el('button','amb-pill amb-pill--block anotice-set','Set the notice'), busy=false, needsRead=false, intended=null;
      [set,clear,refresh].forEach(function(button){button.type='button';});
      /* 5 Nov 2026 (the pane): Set the notice is the part's foot, pinned at the screen's foot */
      var setFoot=el('div','amb-foot anotice-foot'); setFoot.appendChild(set); root.appendChild(setFoot);
      actOn(set,'notice.set');actOn(clear,'notice.clear');actOn(refresh,'notice.read');ynTag(set,'notice:set');ynTag(clear,'notice:clear');
      function state(){set.disabled=busy||needsRead;clear.disabled=busy||needsRead;refresh.disabled=busy;refresh.hidden=!needsRead;text.disabled=busy;}
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
          drawNoticeUp(result.lines); makerNotice=result.lines||[];
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
      drawNoticeUp(result.lines);
      status.textContent='';
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
    var row=el('div','amb-drawer ometrics');
    pairs.forEach(function(p){ row.appendChild(amb.node(amb.stat(p[0],p[1]))); });
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
    if(reading.reasoning) parent.appendChild(el('p','amb-field__hint',noBook(reading.reasoning)));
    (reading.flags||[]).forEach(function(flag){ parent.appendChild(el('p','amb-field__hint',noBook(flag))); });
    if(reading.row) parent.appendChild(detailBox('row.proposed',key,rowPairs(reading.row)));
  }
  /* the placed-order preview's own native comparison, mirroring ordPvBlock on the Desk: their card today, margin,
     floor and their usual, read off the preview the server drafted (src/orders.js previewAck), never raw row JSON */
  /* AN EXAMPLE ORDER'S PAY FIRST (his Ask 6 of 18 Oct 2026): the Desk decides pay-first off the real book, which a fixture is not, so an
     example order's Accept carries his switch, and both ways can be walked */
  var makerPayFirst={};
  function makerPlacedReading(parent, result){
    var note=function(text){ return el('span',null,text); };
    var tiles=el('div','amb-tiles ofigs'), card=typeof result.card==='number'?result.card:null,
        floor=result.floor&&typeof result.floor.rm==='number'?result.floor.rm:null,
        margin=result.margin&&typeof result.margin.rm==='number'?result.margin:null,
        usual=result.usual&&typeof result.usual.rate==='number'?result.usual.rate:null,
        quote=typeof result.quote==='number'?result.quote:null;
    /* 16 Nov 2026 (the move to Ambient, place G): a figure is Ambient's tile, its code in a unit, what it means the delta under it (the gain, the loss or plain) */
    function kpiTile(tone,label,value,nt){
      var t=el('div','amb-tile'), fig=el('span','amb-tile__figure'), m=/^RM\s(.+)$/.exec(String(value)), d=el('span','amb-tile__delta '+({verdigris:'amb-pos',ember:'amb-neg',copper:'amb-neg'}[tone]||'amb-muted'));
      t.appendChild(el('span','amb-tile__label',label));
      if(m){ fig.appendChild(el('span','amb-unit','RM')); fig.appendChild(document.createTextNode(' '+m[1])); } else fig.textContent=value;
      t.appendChild(fig); d.appendChild(nt); t.appendChild(d); return t;
    }
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
    parent.appendChild(el('p','amb-field__hint',flags.length?(flags.length===1?'1 thing':flags.length+' things')+' to check:':'Nothing to check.'));
    flags.forEach(function(flag){ parent.appendChild(el('p','amb-field__hint',noBook(flag))); });
    /* 27 Oct 2026 (docs/plan-refund-credit.html P5): their credit this Accept spends, the Desk's own figure */
    if(+result.credit>0.004){ var crp=el('p','amb-field__hint','Less '+rm(+result.credit)+' credit: their open refunds, paid on this order now and closed when it folds.'); crp.setAttribute('data-credit',String(+result.credit)); parent.appendChild(crp); }
    if(result.owedWith!=null&&result.ceiling!=null){
      var over=result.owedWith>result.ceiling+0.004, lateRun=result.late&&typeof result.late.run==='number'&&typeof result.late.need==='number'?'paid late before, '+result.late.run+' of '+result.late.need+' on time since; ':'';
      parent.appendChild(el('p','amb-field__hint',result.prepay
        ?'They pay first: '+lateRun+rm(result.owedWith)+(over?' owed and this takes them past ':' owed with this, within ')+rm(result.ceiling)+'.'
        :'On credit: '+rm(result.owedWith)+' owed with this, '+(over?'over ':'within ')+rm(result.ceiling)+'.'));
    }
  }
  function makerButton(parent, label, action, primary, onSuccess){
    /* 16 Nov 2026 (Ambient, place I): in Record's forms and Shop's feet a main action is the pill, any other a quiet small one */
    var L=labOf(label), b=actOn(el('button',primary?'amb-pill':'amb-pill amb-pill--quiet amb-pill--sm',L[0]),L[1],L[2]);
    var busy=false, pending=null, cancel=el('button','amb-pill amb-pill--quiet amb-pill--sm','Discard');
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
        if(error.status===400&&(path==='/all/maker/inputs/hush'||path==='/all/maker/inputs/partner')){makerClear(path);pending=null;cancel.hidden=true;}
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
          if(action.after) await action.after(send);   /* 27 Oct 2026 (Fable): an action of two entries sends its second after a retried first */
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
    });
    /* 5 Nov 2026 (the pane): a form's one filled pill, and its Discard while an entry is half sent, are the form's foot, pinned at the foot of
       the open form; every other button stands where it was drawn */
    var host=parent;
    if(primary&&parent.matches&&parent.matches('section.maker-input,#makerInputs')){ host=el('div','amb-foot mfoot'); parent.appendChild(host); b.classList.add('amb-pill--block'); }
    else if(parent.classList&&parent.classList.contains('amb-foot')) b.classList.add('amb-pill--block');
    host.appendChild(b);host.appendChild(cancel);return b;
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
        'tier-set':'price setting','partner':'partner','house-sizes':'set of printed sizes','hush':'reminder','loan':'loan','repay':'repayment','gift':'gift','redeem':'reward','ledger-amend':'correction','offset':'offset'};
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
          unsentParts();
          var bar=document.getElementById('unsentBar'); if(!bar) return;
          var list=unsentList(), n=list.length;
          bar.textContent=''; bar.hidden=!n;
          /* 16 Nov 2026 (the move to Ambient): the banner stands under the hero of the place he is in, as Ambient's Notice does */
          var hostId={needs:'mHome',orders:'oOrders',customers:'oCustomers',record:'oRecord',shop:'oShop'}[placeNow], host=hostId&&document.getElementById(hostId), hero=host&&host.querySelector(':scope > .amb-hero');
          if(hero&&bar.previousElementSibling!==hero) hero.parentNode.insertBefore(bar, hero.nextSibling);
          if(!n) return;
          var one=n===1, c=bannerCard({sev:'soon', kind:'rows', word:'Unsent', key:'unsent', at:list[0].at, act:'unsent.open', who:n+' unsent '+(one?'entry':'entries'), what:'on this phone',
            why:one?unsentSaid(list[0])+' Open it to send it again, update it or discard it.':'They were sent from this phone and not confirmed. Open them to send them again, update them or discard them.',
            open:function(){ unsentOpen(list[0]); }, keepOpen:true});
          c.removeAttribute('data-need'); c.removeAttribute('data-kind');
          bar.appendChild(c);
        }catch(e){}
      }
      /* 25 Oct 2026 (Record redesign P2, his canvas and Ask C): AN UNSENT ENTRY IS A CARD OF NEEDS YOU'S ONE SHAPE, under Unsent on this phone in its part: the
         entry's kind and age, the book's typed tag and the code, one pill, Resend (it was Send again), and the figure last. A tap on the card opens it: the plan's
         sentence, the one unlock where the entry holds a name or a place, and the second choices, Update and send and Discard; a refusal opens it to say why. */
      function makerRecovery(parent){
        var keys=Object.keys(localStorage).filter(function(key){return key.indexOf('saltMakerPending:')===0;}), headed={};
        keys.sort(function(a,b){ var x=unsentRead(a).at||'~', y=unsentRead(b).at||'~'; return x<y?-1:x>y?1:(a<b?-1:1); });
        keys.forEach(function(key){
          var path=key.slice('saltMakerPending:'.length),saved,part=retainedPart(path),u=unsentRead(key),body={};
          if(!headed[part]){ headed[part]=true; var head=el('h2','amb-section ghead unsent-head','Unsent'); head.setAttribute('data-in','record.'+part); head.setAttribute('data-formmenu',''); parent.appendChild(head); }
          var section=makerForm(part);section.classList.add('unsent');section.setAttribute('data-key',path.split('/').pop());section.setAttribute('data-formmenu','');section.appendChild(el('h3','sr','Unsent entry'));
          try{ body=(JSON.parse(localStorage.getItem(key))||{}).body||{}; }catch(e){}
          /* 16 Nov 2026, the move to Ambient (end pass): an unsent entry is Ambient's task, as Needs you's card is: its kind and age and the state's chip, the title its one button
             (the whole card is its tap, site.css), the book's chip before the code, the sum as the one figure, Resend its one pill; the second choices wait in the card opened */
          var word=unsentWord(u), card=el('article','amb-task amb-task--warn ntask unsent-card'), head2=el('div','amb-task__head'), kind=el('span','amb-task__kind nkind',word.charAt(0).toUpperCase()+word.slice(1));
          var age=u.at?ageOf(u.at):''; if(age){ kind.appendChild(document.createTextNode(' · ')); kind.appendChild(el('span','nage',age)); }
          var title=el('h3','amb-task__title'), tap=actOn(el('button','need-title need-tap'),'record.retained.open',path.split('/').pop()), go=el('div','amb-task__acts ngo');
          tap.type='button'; tap.setAttribute('aria-expanded','false');
          if(typeof body.product==='string'&&body.product) tap.appendChild(bookChip(body.product));
          tap.appendChild(whoTag(el('span','need-who'+(u.who?' need-who--code':''),u.who||'Unsent '+word),u.who));
          tap.setAttribute('aria-label','Unsent '+word+(u.who?' for '+u.who:'')+(age?', '+age:''));
          head2.appendChild(kind); head2.appendChild(el('span','amb-chip amb-chip--warn','Unsent')); card.appendChild(head2);
          title.appendChild(tap); card.appendChild(title);
          if(+body.total>0.004){ var figs=el('div','amb-task__figures'), fig=amb.node(amb.stat('Amount',rmShort(body.total))); fig.classList.add('nfig'); figs.appendChild(fig); card.appendChild(figs); }
          card.appendChild(go);
          section.appendChild(card);
          var open=el('div','unsent-open'); open.hidden=true; section.appendChild(open);
          var shut=function(on){ open.hidden=!on; tap.setAttribute('aria-expanded',on?'true':'false'); };
          var gone=function(){ section.remove(); if(!parent.querySelector('.maker-input.unsent[data-in="record.'+part+'"]')){ var h=parent.querySelector('.unsent-head[data-in="record.'+part+'"]'); if(h) h.remove(); } };
          tap.addEventListener('click',function(){ shut(open.hidden); });
          var status=makerStatus(open), ways=el('div','amb-settings unsent-ways'), waysList=el('ul','amb-settings__list'); ways.appendChild(waysList);
          parent.appendChild(section);
          try{saved=makerSaved(path);status.textContent=unsentSaid(u)+' Send it again, or update it first.';}
          catch(error){refusal(status,error);}
          /* an unsent name or place opens on the one unlock before it is sent again or updated; any other entry needs none */
          if(saved&&saved.body&&(saved.body.pair||saved.body.vault||saved.body.addrVault))makerVaultGate(open);
          open.appendChild(ways);
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
              makerClear(saved.path);gone();await loadMaker();
              if(saved.body.pair||saved.body.vault||saved.body.addrVault)makerVaultRefresh();
            }catch(error){refusal(status,error);shut(true);}
          };
          ['Resend','Update and send','Discard'].forEach(function(label,index){
            var act=['record.retained.retry','record.retained.review','record.retained.cancel'][index], button=index?aAct(aBtn(label,'',act),index===2):aPill(label,act,undefined,true);
            if(!index) button.setAttribute('aria-label','Send again');
            button.onclick=async function(){
              if(index===2){
                retainedCancel(ynTag(button,'retained:'+path),'If the Desk already took it, it stays.',function(){ makerClear(path);gone(); });
                return;
              }
              var controls=section.querySelectorAll('button');controls.forEach(function(control){control.disabled=true;});
              try{await run(index===1);}finally{controls.forEach(function(control){control.disabled=false;});}
            };if(index){ var li=el('li'); li.appendChild(button); waysList.appendChild(li); } else go.appendChild(button);
          });
        });
      }
  /* 16 Nov 2026, the move to Ambient (place I): Record's and Shop's rows are Ambient's settings. A group is div.amb-settings (an optional head, one ul.amb-settings__list,
     an optional foot); a row is an li holding one .amb-setting (a name and one control or value) or one .amb-action. Switches are input.amb-switch, checked is the state. */
  function sUl(cls){ return el('ul','amb-settings__list'+(cls?' '+cls:'')); }
  function sGroup(head,cls){
    var box=el('div','amb-settings'+(cls?' '+cls:'')); if(head) box.appendChild(el('h3','amb-settings__head',head));
    box.list=sUl(); box.appendChild(box.list); return box;
  }
  function sFoot(text,cls){ return el('p','amb-settings__foot'+(cls?' '+cls:''),text); }
  function sLi(node,cls){ var li=el('li',cls||null); li.appendChild(node); return li; }
  function sRead(name,value,cls){ var d=el('div','amb-setting'+(cls?' '+cls:'')); d.appendChild(el('span','amb-setting__name',name)); if(value!=null) d.appendChild(el('span','amb-setting__value',value)); return d; }
  function sSwitch(act,key,on,label){
    var sw=actOn(el('input','amb-switch'),act,key); sw.type='checkbox'; sw.setAttribute('role','switch'); sw.checked=!!on; sw.setAttribute('aria-label',label); return sw;
  }
  function sSwitchRow(label,act,key,on){ var row=el('label','amb-setting'), sw=sSwitch(act,key,on,label); row.appendChild(el('span','amb-setting__name',label)); row.appendChild(sw); row.sw=sw; return row; }
  function sAction(label,act,key,danger){
    var b=actOn(el('button','amb-action'+(danger?' amb-action--danger':''),label),act,key); b.type='button'; return b;
  }
  function sOpen(name,value,act,key){
    var b=actOn(el('button','amb-setting'),act,key); b.type='button'; b.appendChild(el('span','amb-setting__name',name)); if(value!=null) b.appendChild(el('span','amb-setting__value',value));
    b.appendChild(amb.node(amb.glyph('next','sm'))); return b;
  }
  /* a field of a Shop form: label above, the native control in the Ambient input */
  function sField(label,control,hint){
    var f=el('label','amb-field'); f.appendChild(el('span','amb-field__label',label)); f.appendChild(control); if(hint) f.appendChild(el('span','amb-field__hint',hint)); return f;
  }
  function sSelect(select){
    select.classList.add('amb-input'); var w=el('span','amb-select'); w.appendChild(select); w.appendChild(amb.node(amb.glyph('chevron','sm'))); return w;
  }
  /* 11 Oct 2026: a Record form is a section that shows in one part of Record, Entry, Customers or Pricing (data-in); a retained input
     shows in the part its route belongs to */
  function makerForm(part){ var section=el('section','maker-input amb-stack'); section.setAttribute('data-in','record.'+part); return section; }
  function retainedPart(path){
    var k=path.split('/').pop();
    return ['add-id','amend-id','appoint-existing','place'].indexOf(k)>=0?'customers':['house-sizes','hush','tier-set','partner'].indexOf(k)>=0?'pricing':'entry';
  }
  /* 12 Oct 2026 (PHASE 4a): OPTION TILES for the few, fixed choices of a form (a book, a direction, a handover, a kind, a role, a level, yes or no): the system's
     Option recipe, a real radio each, so the group is one tab stop, the arrows move the choice and a tile is 44px. The group is a fieldset that answers where the
     select it replaces did: .value is the tile chosen ('' when none is), .disabled is the fieldset's own and shuts every tile, the radios' change bubbles to it,
     and fill(items) draws the tiles again, keeping the choice while it is still offered, else the first tile (or none, when none is true). Each radio keeps the
     select's act, keyed by its value ('none' for the empty one) and, for a group drawn once for each book, by that book first. What a form sends is the value. */
  var tileSeq=0, menuOffers=null;
  /* 16 Nov 2026, the move to Ambient (place I): INSIDE RECORD A FIELD IS AMBIENT'S FIELD (its label above, the control in the Ambient input), a choice of two or three
     plain words is a Segment, a choice of more, or with a note under each, is a Choice (fieldset.amb-options, a real radio each, the one chosen marked by its edge and
     its filled mark), a figure walked in sizes is the stepper over values, and the lists of settings are for what is read or done. The group answers where the select
     it replaces did: .value is the choice made ('' when none is), .disabled shuts every one, the radios' change bubbles to it, and fill(items) draws the choices again,
     keeping the one chosen while it is still offered, else the first (or none, when none is true). Each radio keeps the select's act, keyed by its value ('none' for the
     empty one) and, for a group drawn once for each book, by that book first. What a form sends is the value. A book is a chip with its dot in the book's hue, its name in ink. */
  function bookChip(product){ var k=String(product||''); return amb.node(amb.kindChip(k,k.charAt(0).toUpperCase()+k.slice(1))); }
  function makerTiles(label,items,none){
    var L=labOf(label), set=el('fieldset','amb-options maker-tiles'), name='tiles'+(++tileSeq), legend=el('legend','amb-field__label',L[0]);
    if(L[3]){ legend.appendChild(document.createTextNode(' ')); legend.appendChild(bookChip(L[3])); }   /* a legend about a book ends in its chip: [words, act, key, book] (25 Oct 2026) */
    set.appendChild(legend);
    Object.defineProperty(set,'value',{
      get:function(){ var on=set.querySelector('input:checked'); return on?on.value:''; },
      set:function(v){ [].forEach.call(set.querySelectorAll('input'),function(r){ r.checked=r.value===String(v); }); }
    });
    set.fill=function(list){
      var on=set.querySelector('input:checked'), kept=on?on.value:null, offered=list.some(function(item){ return String(item.value)===kept; });
      [].slice.call(set.querySelectorAll('label.amb-option')).forEach(function(n){ n.remove(); });
      list.forEach(function(item,i){
        var lab=el('label','amb-option'), radio=el('input','amb-vh amb-option__input'), mark=el('span','amb-option__mark'), title=el('span','amb-option__title');
        radio.type='radio'; radio.name=name; radio.value=String(item.value); if(item.aria) radio.setAttribute('aria-label',item.aria);
        actOn(radio,L[1],(L[2]?L[2]+'-':'')+(String(item.value)===''?'none':item.value));
        radio.checked=offered?String(item.value)===kept:(!none&&i===0);
        mark.setAttribute('aria-hidden','true');
        if(item.mark) title.appendChild(bookChip(item.mark)); else title.textContent=item.label;   /* a book's tile is its chip on Salt Admin (his decision of 22 Oct 2026; Record from 25 Oct) */
        lab.appendChild(radio); lab.appendChild(mark); lab.appendChild(title);
        if(item.detail) lab.appendChild(el('span','amb-option__sub',item.detail));   /* a tile with its note under its words (25 Oct 2026) */
        set.appendChild(lab);
      });
    };
    set.fill(items); return set;
  }
  /* 27 Oct 2026 (his answers: Record's forms in the language of Shop's This device): INSIDE ONE OF RECORD'S FORMS, A CHOICE OF TWO OR THREE PLAIN WORDS
     (Sale or Purchase, Goods or Cash, the handover) IS A SEGMENT, as Hours' Hold as is; it answers as the tiles did (.value, .disabled, .hidden,
     fill, a change that bubbles), each option keeping the tile's act and key. Books keep their chips as a Choice, and so do
     choices with a note under them, more than three, or none chosen at first; a choice ends the list above it. */
  function makerSegFits(items,none){ return !none&&items.length>=2&&items.length<=3&&items.every(function(item){ return !item.mark&&!item.detail&&String(item.label).length<=11; }); }
  var segSeq=0;
  function makerSegRow(root,label,items){
    var L=labOf(label), row=el('div','amb-field mrow'), name=el('span','amb-field__label',L[0]), s=el('div','amb-segment mseg'), cur='', dis=false;
    name.id='mseg'+(++segSeq); row.appendChild(name); row.appendChild(s); root.appendChild(row);
    s.setAttribute('role','group'); s.setAttribute('aria-labelledby',name.id);
    var pick=function(v){ cur=''; [].forEach.call(s.children,function(b){ var on=b.getAttribute('data-value')===v; b.setAttribute('aria-pressed',String(on)); if(on) cur=v; }); };
    Object.defineProperty(s,'value',{ get:function(){ return cur; }, set:function(v){ pick(String(v)); } });
    Object.defineProperty(s,'disabled',{ get:function(){ return dis; }, set:function(v){ dis=!!v; [].forEach.call(s.children,function(b){ b.disabled=dis; }); } });
    Object.defineProperty(s,'hidden',{ get:function(){ return row.hidden; }, set:function(v){ row.hidden=!!v; } });
    s.fill=function(list){
      /* the choice kept is the option shown chosen, never the empty value before any is (For good is the empty value: the first fill falls to 7 days, as the tiles did) */
      var on=s.querySelector('[aria-pressed="true"]'), kept=on?on.getAttribute('data-value'):null, offered=list.some(function(item){ return String(item.value)===kept; });
      s.textContent='';
      list.forEach(function(item){
        var b=actOn(el('button','amb-segment__opt',item.label),L[1],(L[2]?L[2]+'-':'')+(String(item.value)===''?'none':item.value));
        b.type='button'; b.setAttribute('data-value',String(item.value)); b.setAttribute('aria-pressed','false'); b.disabled=dis; if(item.aria) b.setAttribute('aria-label',item.aria);
        b.addEventListener('click',function(){ if(dis) return; pick(String(item.value)); s.dispatchEvent(new Event('change',{bubbles:true})); });
        s.appendChild(b);
      });
      pick(offered?kept:(list.length?String(list[0].value):''));
    };
    s.fill(items); return s;
  }
  function makerTilesIn(root,label,items,none){
    if(makerSegFits(items,none)) return makerSegRow(root,label,items);
    var set=makerTiles(label,items,none); root.appendChild(set); return set;
  }
  /* 16 Nov 2026 (the move to Ambient, places I and G): a field is Ambient's field, its label above and the control in the Ambient input, on a form and on an order's card alike */
  function makerRow(parent,words,control){
    var wrap=el(control&&(control.tagName==='SELECT'||control.tagName==='INPUT')?'label':'div','amb-field mrow');
    wrap.appendChild(el('span','amb-field__label',words));
    if(control) wrap.appendChild(control.tagName==='SELECT'?sSelect(control):control);
    parent.appendChild(wrap); return wrap;
  }
  function makerField(parent, label, type, value, step){
    var L=labOf(label), af=el('label','amb-field'), at=el('span','amb-field__label',L[0]), ai=actOn(el('input','amb-input'),L[1],L[2]);
    if(L[3]){ at.appendChild(document.createTextNode(' ')); at.appendChild(bookChip(L[3])); }   /* a field about a book ends in its chip: [words, act, key, book] */
    ai.type=type; ai.value=value==null?'':String(value);
    if(type==='number'){ ai.step=step||'0.01'; ai.min='0'; ai.inputMode='decimal'; }
    af.appendChild(at); af.appendChild(ai); parent.appendChild(af); return ai;
  }
  /* 27 Oct 2026, his word: units turn on a wheel of the sizes, from a quarter of a unit to 25 in quarters, then whole units to 200; a figure off the wheel (an older
     row's) is put on it when set. 16 Nov 2026 (Ambient 0.7.2): the wheel is the stepper over values, the sizes its list (data-amb-values), the minus and plus walking it. */
  function makerUnitSteps(from){ var a=[], q; if(from===0) a.push(0); for(q=1;q<=100;q++) a.push(q/4); for(q=26;q<=200;q++) a.push(q); return a; }
  function makerWheelSet(s,v){
    var t=v===''||v==null||!(+v>=0)?'':String(+v);
    if(t){ var list=String(s.getAttribute('data-amb-values')||'').split(' ').filter(Boolean); if(list.indexOf(t)<0){ list.push(t); list.sort(function(a,b){ return +a-+b; }); s.setAttribute('data-amb-values',list.join(' ')); s.max=String(Math.max(+s.max||0,+t)); } }
    s.value=t;
  }
  function makerHoverStep(ctl,step){
    ctl.addEventListener('wheel',function(e){
      if(ctl.disabled||!e.deltaY) return; e.preventDefault(); step(e.deltaY>0?1:-1);
      ctl.dispatchEvent(new Event('input',{bubbles:true})); ctl.dispatchEvent(new Event('change',{bubbles:true}));
    },{passive:false});
  }
  function makerWheel(parent,label,value,from){
    var L=labOf(label), vals=makerUnitSteps(from), s=actOn(el('input','amb-input'),L[1],L[2]), id='mwheel'+(++tileSeq), wrap=el('div','amb-field mrow'), lab=el('label','amb-field__label',L[0]), st=el('div','amb-stepper');
    lab.setAttribute('for',id); s.id=id; s.type='number'; s.setAttribute('inputmode','decimal'); s.step='any'; s.min=String(vals[0]); s.max=String(vals[vals.length-1]); s.setAttribute('data-amb-values',vals.join(' '));
    st.appendChild(actOn(amb.node('<button type="button" class="amb-circle amb-circle--lg" data-amb-step="-1" aria-label="'+esch(L[0])+', one size smaller">'+amb.glyph('minus')+'</button>'),L[1]+'.down',L[2]));
    st.appendChild(s);
    st.appendChild(actOn(amb.node('<button type="button" class="amb-circle amb-circle--lg" data-amb-step="1" aria-label="'+esch(L[0])+', one size larger">'+amb.glyph('plus')+'</button>'),L[1]+'.up',L[2]));
    wrap.appendChild(lab); wrap.appendChild(st); makerWheelSet(s,value); parent.appendChild(wrap);
    return s;
  }
  function makerDayStep(input){
    makerHoverStep(input,function(d){ var t=Date.parse((input.value||tripToday())+'T00:00:00Z'); if(!isNaN(t)) input.value=new Date(t+d*86400000).toISOString().slice(0,10); });
    return input;
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
  /* 25 Oct 2026 (Record redesign P5, his Ask F): what each choice does, under its words on its tile (the three notes the form opened with, and one for each of a purchase's) */
  var KINDD={Correction:'Restate what was typed on the row.', Fulfilment:'What was handed over or paid.', Cancellation:'Only while nothing has moved.',
    Payment:'What you paid the supplier.', Receipt:'What arrived from the supplier.', Default:'The lot never came.'};
  function makerStatus(parent){
    var status=el('p','msg'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    parent.appendChild(status); return status;
  }
  var makerPlaceListId=0;
  function makerLocalityField(parent, act){
    var input=makerField(parent,['Locality',act],'text','');
    var list=el('datalist'), key='makerPlaces'+(++makerPlaceListId);
    list.id=key;input.setAttribute('list',key);
    makerGeo.picks().forEach(function(point,label){
      var option=el('option');option.value=label;list.appendChild(option);
    });
    input.parentNode.appendChild(list);return input;
  }
  /* 17 Nov 2026 (his yes to the one place field plan, D5): THE LOCALITY IS WORKED OUT FROM WHERE. A point in Where (a link read or opened, figures,
     a place picked from the search, his location) fills Locality with the listed locality nearest it in its district (makerGeo.locality, the
     Desk's localityFor), said under it; what he typed or picked there himself stands, and Change is the list itself */
  function makerLocalityFrom(where,locality){
    var hint=el('p','amb-field__hint mlocal'); hint.setAttribute('role','status'); locality.closest('label').after(hint);
    var seq=0, auto='', timer=null;
    var fill=async function(){
      var mine=++seq, v=where.value.trim(), p=null;
      if(!v){ if(auto&&locality.value===auto){ locality.value=''; auto=''; locality.dispatchEvent(new Event('input',{bubbles:true})); } hint.textContent=''; return; }
      try{ p=await pointPlace(v); }catch(e){ p=null; }
      if(mine!==seq||!p) return;
      var l=makerGeo.locality(p.lat,p.lng);
      if(locality.value.trim()&&locality.value!==auto) return;
      if(!l){ hint.textContent='No listed locality near that point. Choose one, or leave it blank.'; return; }
      locality.value=l; auto=l; locality.dispatchEvent(new Event('input',{bubbles:true}));
      hint.textContent='Worked out from Where. Choose another if it is wrong.';
    };
    where.addEventListener('input',function(){ clearTimeout(timer); timer=setTimeout(fill,450); });
    where.addEventListener('change',function(){ clearTimeout(timer); fill(); });
    locality.addEventListener('input',function(e){ if(e.isTrusted&&locality.value!==auto) hint.textContent=''; });
    return function(){ seq++; auto=''; hint.textContent=''; };
  }
  async function makerLocalityPoint(value){
    var picked=makerGeo.picks().get(value);
    var result=picked?{point:picked}:await makerGeo.find(value);
    if(!result.point)throw new Error(result.how==='ambiguous'
      ?'That place matches more than one. Choose its district from the list.'
      :'That locality is not on the list. Put the place in Where and it is worked out, choose one from the list, or leave it blank.');
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
    /* 17 Nov 2026 (his yes to the one place field plan): words no reader takes, an address typed and not picked or a link of another
       maker, are filed as the address alone, as he wrote them, for him to place later; nothing he types is refused for its form */
    var words=value.replace(/[ ]+/g,' ').trim();
    if(!reading&&words.length>=5&&/[A-Za-z]/.test(words))
      return {addr:words.slice(0,1000),lat:null,lng:null,src:'addr',at:new Date().toISOString()};
    if(!reading||reading.lat==null&&!reading.addr)
      throw new Error('Search for the place, paste a map link, or leave it empty.');
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
    makerGeo.configure(catalog.placed); makerPlaced=catalog.placed||{};
    var today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
    var idCanStart=function(kind){return kind==='customer'||kind==='reseller'||kind==='referral';};
    var parties=(catalog.parties||[]).filter(function(code){return !code.endsWith('-R');});
    var books=catalog.products||[];
    var addSelect=function(root,label,items){
      var L=labOf(label), select=actOn(el('select'),L[1],L[2]);
      items.forEach(function(item){var option=el('option',null,item.label);option.value=item.value;select.appendChild(option);});
      makerRow(root,L[0],select); return select;
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
    /* 25 Oct 2026 (Record redesign P6): a reward held or an offset offered is Needs you's card, its kind, the code, one short pill (its full words spoken)
       and its figure; a refusal stands under the code and the card grows to hold it */
    var listCard=function(cls,kind,code,fig){
      /* 16 Nov 2026 (Ambient): the card is a task, its kind, the code, the figure and its one small pill */
      var c=el('article','amb-task ncard '+cls), head=el('div','amb-task__head'), title=el('h3','amb-task__title'), body=el('div','amb-task__text'), figs=el('div','amb-task__figures'), go=el('div','amb-task__acts');
      head.appendChild(el('span','amb-task__kind nkind',kind)); title.appendChild(whoTag(el('span','need-who need-who--code',code),code));
      figs.appendChild(amb.node(amb.stat(cls==='maker-reward'?'Held':'Offset',fig))); figs.firstChild.classList.add('nfig'); go.setAttribute('data-amb','');
      c.appendChild(head); c.appendChild(title); c.appendChild(body); c.appendChild(figs); c.appendChild(go);
      c._body=body; c._go=go; return c;
    };
    var cardPill=function(b,said){ b.classList.add('amb-pill--sm','nbtn'); if(said) b.setAttribute('aria-label',said); return b; };
    var partyItems=parties.map(function(code){return {value:code,label:code};});
    var productItems=books.map(function(item){return bookItem(item.product);});
    var loan=makerForm('entry');loan.appendChild(el('h3','amb-section','Loan'));
    loan.appendChild(el('p','msg','Cash or goods lent or borrowed.'));
    parent.appendChild(loan);
    var loanForm=makerTilesIn(loan,['Loan of','record.loan.form'],[{value:'salt',label:'Goods'},{value:'cash',label:'Cash'}]);
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
    var gift=makerForm('entry');gift.appendChild(el('h3','amb-section','Gift'));
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
    var repay=makerForm('entry');repay.appendChild(el('h3','amb-section','Repayment'));
    repay.appendChild(el('p','msg','Part or all of a loan, paid back.'));
    parent.appendChild(repay);
    var loanItems=(catalog.loans||[]).map(function(item){
      var left=item.form==='cash'?rm(item.remaining):units(item.remaining), on=fmtWhen(item.date);
      return {value:item.rid,label:item.direction==='in'?'You owe '+item.party+' '+left+(on?' (borrowed '+on+')':''):item.party+' owes '+left+(on?' (lent '+on+')':'')};});
    var repayLoan=addSelect(repay,['Which loan','record.repay.loan'],loanItems), repayDate=makerField(repay,['Date','record.repay.date'],'date',today),
      repayAmount=makerField(repay,['Amount','record.repay.amount'],'number','1'), repayStatus=makerStatus(repay);
    /* 25 Oct 2026 (Record redesign P6): what is left on the loan chosen, under the choice; 27 Oct 2026: a row of the form's list, its figure the row's value */
    var repayLeft=el('p','amb-field__hint repay-left'); repayLoan.closest('label').after(repayLeft);
    var drawLeft=function(){ repayLeft.textContent=''; var item=(catalog.loans||[]).find(function(x){return x.rid===repayLoan.value;}); repayLeft.hidden=!item; if(!item) return;
      repayLeft.appendChild(el('span','repay-left__label','Left to repay '));
      repayLeft.appendChild(el('strong','repay-left__value',item.form==='cash'?rm(item.remaining):units(item.remaining))); };
    repayLoan.addEventListener('change',drawLeft); drawLeft();
    makerButton(repay,['Send the repayment','record.repay.send'],async function(send){
      repayStatus.textContent='Sending.';
      try{await send('/all/maker/inputs/repay',{at:new Date().toISOString(),loan:repayLoan.value,
        date:repayDate.value,amount:Number(repayAmount.value)});
        repayStatus.textContent='Sent. It waits under Approve.';loadMaker();}
      catch(error){refusal(repayStatus,error);}
    },true);
    var redeem=makerForm('entry');redeem.appendChild(el('h3','amb-section','Rewards'));
    redeem.appendChild(el('p','msg','A reward settles what they owe first; if nothing is owed it is given as goods.'));
    parent.appendChild(redeem);
    var redeemDate=makerField(redeem,['Date','record.redeem.date'],'date',today), redeemStatus=makerStatus(redeem),
      redeemList=el('div','maker-rewards');
    redeem.appendChild(redeemList);
    function drawMakerRewards(rewards){
      redeemList.textContent='';
      if(!rewards.length)redeemList.appendChild(el('p','msg','No rewards held.'));
      rewards.forEach(function(offer){
        var row=listCard('maker-reward',(offer.associate?'Associate · held':'Held')+(offer.departed?' · away':offer.free<offer.held?' · '+units(offer.free)+' free':''),offer.code,units(offer.held));
        row.setAttribute('data-reward-holder',offer.code);
        if(offer.action){
          var status=makerStatus(row._body); status.classList.add('nnote');
          var said=offer.action==='Redeem'?(offer.associate?'Give '+offer.code+' their reward':'Give '+offer.code+' 1 unit'):'Take 1 unit off what '+offer.code+' owes';
          cardPill(makerButton(row._go,[offer.action==='Redeem'?'Give':'Take off','record.redeem.send'],async function(send){
            status.textContent='Checking.';
            try{
              await send('/all/maker/inputs/redeem',{at:new Date().toISOString(),code:offer.code,date:redeemDate.value});
              redeemStatus.textContent='Sent. It waits under Approve.';
              var read=await refs('/all/maker/inputs');drawMakerRewards(read.catalog.rewards||[]);loadMaker();
            }catch(error){refusal(status,error);}
          },true),said);
        }
        redeemList.appendChild(row);
      });
    }
    drawMakerRewards(catalog.rewards||[]);
    makerButton(redeem,['Read again','record.redeem.read'],async function(){
      try{var read=await refs('/all/maker/inputs');drawMakerRewards(read.catalog.rewards||[]);redeemStatus.textContent='Read.';}
      catch(error){refusal(redeemStatus,error);}
    },false);
    var offsets=makerForm('entry');offsets.appendChild(el('h3','amb-section','Offsets'));
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
          var kind=offer.associate===false?'customer':'reward', row=listCard('maker-offer',units(offer.units)+' off · '+(fmtWhen(offer.saleDate)||'undated'),offer.code,rmShort(offer.rm));
          row.setAttribute('data-key',offer.rid);
          cardPill(makerButton(row._go,['Add','record.offset.send'],async function(send){
            offerStatus.textContent='Sending.';
            try{
              await send('/all/maker/inputs/offset',{at:new Date().toISOString(),code:offer.code,rid:offer.rid,date:offerDate.value});
              await offerLoad();
              offerStatus.textContent='Sent. It waits under Approve.';
              loadMaker();
            }catch(error){refusal(offerStatus,error);}
          },true),'Add '+units(offer.units)+' off the order of '+(fmtWhen(offer.saleDate)||'an undated day')+' for '+offer.code);
          offerLists[kind].appendChild(row);
        });
        ['customer','reward'].forEach(function(k){ if(!offerLists[k].childElementCount) offerLists[k].appendChild(el('p','rnone','None to offer.')); });
        menuOffers=read.offers.length; menuCount('offsets',menuOffers);
      }catch(error){refusal(offerStatus,error);}
    };
    offerLoad();
    var editor=makerForm('entry');editor.appendChild(el('h3','amb-section','Correct a row'));
    parent.appendChild(editor);
    /* 25 Oct 2026 (Record redesign P5, his Ask F): the row is named by its reference, who and when; the card under the choice carries its book, its units and its total */
    var rows=catalog.rows||[], rowItems=rows.map(function(row){return {value:row.rid,
      label:row.rid+' · '+row.party+' · '+(fmtWhen(row.date)||'undated')+(row.defaulted?', defaulted':'')};});
    /* no row is chosen until he picks one, so a movement never goes out against the book's first row by default */
    var editRow=addSelect(editor,['Which row','record.amend.row'],[{value:'',label:rows.length?'Choose a row':'No row to correct'}].concat(rowItems)),
      rowCard=el('div','amb-pane rowcard'),
      editKind=makerTilesIn(editor,['What to do','record.amend.kind'],[{value:'Correction',label:KINDW.Correction},
        {value:'Fulfilment',label:KINDW.Fulfilment},{value:'Cancellation',label:KINDW.Cancellation}]),
      editDate=makerField(editor,['On','record.amend.date'],'date',today);
    rowCard.setAttribute('aria-label','The row chosen'); editor.insertBefore(rowCard,editKind);
    var drawRowCard=function(){
      rowCard.textContent=''; var row=rows.find(function(item){return item.rid===editRow.value;}); rowCard.hidden=!row; if(!row) return;
      var kind=el('span','rowcard__kind'); kind.appendChild(el('span','rowcard__rid',row.rid)); kind.appendChild(document.createTextNode(' · '+units(row.qty)+(row.direction==='BUY'?' bought':'')+' · '+(fmtWhen(row.date)||'undated')+(row.defaulted?' · defaulted':'')));
      var who=el('span','rowcard__who'); if(row.product) who.appendChild(bookChip(row.product)); who.appendChild(whoTag(el('span','rowcard__code',row.party),row.party));
      rowCard.appendChild(kind); rowCard.appendChild(who); rowCard.appendChild(el('strong','rowcard__fig',rmShort(row.total)));
    };
    var movement=el('div','maker-fields');editor.appendChild(movement);
    var editCash=makerField(movement,['RM','record.amend.cash'],'number','0'), editUnits=makerField(movement,['Units','record.amend.units'],'number','0');
    var patch=el('div','maker-fields');editor.appendChild(patch);
    var definitions=catalog.correctionFields||[];
    var editField=addSelect(patch,['What to change','record.amend.field'],definitions.map(function(item){return {value:item.field,label:fieldWord(item.field)};}));
    var valueBox=el('div','maker-fields');patch.appendChild(valueBox);
    var editValue=null, changes={}, patchList=el('div','maker-changes');patch.appendChild(patchList);
    /* the changes made ready, a ledger of the field and its new value (25 Oct 2026); none, and nothing is drawn */
    var drawChanges=function(){
      patchList.textContent=''; var keys=Object.keys(changes); if(!keys.length) return;
      var sg=sGroup('Ready to send');
      keys.forEach(function(k){ var v=changes[k], row=sRead(fieldWord(k),v===null?'Cleared':v===true?'Yes':v===false?'No':String(v)); row.setAttribute('data-change',k); sg.list.appendChild(sLi(row)); });
      patchList.appendChild(sg);
    };
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
      drawChanges();
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    makerButton(patch,['Clear it','record.amend.clear-field'],function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||definition.required)throw new Error('This field cannot be empty. Enter a new value.');
      changes[definition.field]=null;drawChanges();
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    editRow.addEventListener('change',function(){changes={};drawChanges();drawRowCard();});drawRowCard();
    /* plan 4: the row picked has its History, and Undo on its newest move */
    var editHist=el('div','maker-fields');editor.appendChild(editHist);
    var drawHist=function(){editHist.replaceChildren();if(editRow.value&&rows.some(function(item){return item.rid===editRow.value&&item.direction!=='BUY';}))historyBlock(editHist,{rid:editRow.value},'row:'+editRow.value,null,'row:'+editRow.value);};
    editRow.addEventListener('change',drawHist);drawHist();
    var kindsFor=function(){
      var row=rows.find(function(item){return item.rid===editRow.value;}), kept=editKind.value;
      var names=row&&row.defaulted?['Correction']:row&&row.direction==='BUY'?['Correction','Fulfilment','Cancellation','Payment','Receipt','Default']:['Correction','Fulfilment','Cancellation'];
      editKind.fill(names.map(function(name){return {value:name,label:KINDW[name]||name,detail:KINDD[name]};}));
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
    amendPick=function(rid,kind){ if(!rows.some(function(item){return item.rid===rid;}))return false; editRow.value=rid; changes={}; drawChanges(); drawRowCard(); kindsFor(); editKind.value=kind||'Fulfilment'; drawKind(); drawHist(); editorReady(); return true; };
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
        changes={};drawChanges();editStatus.textContent='Sent as an amendment of their order, so the order and the row change together.';
        await loadMaker();
        return;
      }
      changes={};drawChanges();editStatus.textContent='Sent. The row changes once you approve it.';
      await loadMaker();
    },true);
    var editorReady=function(){editorButton.disabled=!rows.length||!editRow.value;};
    editRow.addEventListener('change',editorReady);editorReady();
    if(!rows.length)editStatus.textContent='No row to correct.';
    var revive=makerForm('entry');revive.appendChild(el('h3','amb-section','Reopen a cancelled order'));
    revive.appendChild(el('p','msg','Reopens an order you cancelled, if nothing was paid or handed over.'));
    parent.appendChild(revive);
    var revivable=(catalog.revivable||[]).filter(function(row){return !(row.paid>0.009)&&!(row.movedUnits>0.009);});
    /* 25 Oct 2026 (Record redesign P5): the order named by its reference, who and when it was cancelled, and its card under the choice */
    var reviveRow=addSelect(revive,['Which order','record.revive.row'],revivable.map(function(row){return {value:row.rid,
      label:row.rid+' · '+row.party+' · '+(row.cancelledOn?'cancelled '+fmtWhen(row.cancelledOn):fmtWhen(row.date)||'undated')};}));
    var reviveCard=el('div','amb-pane rowcard'); reviveCard.setAttribute('aria-label','The order chosen'); revive.appendChild(reviveCard);
    var drawReviveCard=function(){
      reviveCard.textContent=''; var row=revivable.find(function(item){return item.rid===reviveRow.value;}); reviveCard.hidden=!row; if(!row) return;
      var kind=el('span','rowcard__kind'); kind.appendChild(el('span','rowcard__rid',row.rid)); kind.appendChild(document.createTextNode(' · '+units(row.qty)+' · '+(fmtWhen(row.date)||'undated')));
      var who=el('span','rowcard__who'); if(row.product) who.appendChild(bookChip(row.product)); who.appendChild(whoTag(el('span','rowcard__code',row.party),row.party));
      reviveCard.appendChild(kind); reviveCard.appendChild(who); reviveCard.appendChild(el('strong','rowcard__fig',rmShort(row.total)));
    };
    reviveRow.addEventListener('change',drawReviveCard); drawReviveCard();
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
    var id=makerForm('customers');id.appendChild(el('h3','amb-section','New customer'));
    id.appendChild(el('p','msg','The name and place are locked on this phone before anything is sent; only a short code travels.'));
    parent.appendChild(id);
    var idKind=makerTilesIn(id,['Role','record.add-id.role'],[{value:'customer',label:'Customer'},{value:'supplier',label:'Supplier'},
      {value:'reseller',label:'Associate who resells'},{value:'referral',label:'Associate who introduces'},
      {value:'downstream',label:'Customer of an associate'},{value:'bucket',label:'Associate’s resale account'}]);
    var idParentItems=(catalog.associates||[]).map(function(item){return {value:item.code,label:item.code};});
    var idParent=addSelect(id,['Their associate','record.add-id.parent'],idParentItems);
    /* 17 Nov 2026 (his yes to the one place field plan): Where first, any address, link, figures or his location; Locality worked out from it */
    var idName=makerField(id,['Name','record.add-id.name'],'text','');
    var idLink=makerField(id,['Where','record.add-id.link'],'text','');placeAssist(idLink,{id:'makerIdLink',act:'record.add-id.link'});
    var idPlace=makerLocalityField(id,'record.add-id.place');
    idPlace.placeholder='TBC if blank';   /* 27 Oct 2026: the row holds its field alone; the hint is the field's */
    var idLocal=makerLocalityFrom(idLink,idPlace);
    var idGate=makerVaultGate(id);
    var driftBooks=books.filter(function(item){return item.drift;});
    var idDrifts=driftBooks.map(function(item){
      var presets=item.driftPresets||[];
      /* 18 Nov 2026 (his word: a smooth slider in steps of 5, never the long list of tiles): Set a starting % is a switch, off for Not set, and the % a slider
         from the book's low to its high (salt -100 to +100, a board -30 to +30); a preset's name is said where the slider rests on it (Median Price at 0 on salt) */
      var lo=typeof item.driftMin==='number'?item.driftMin:-30, hi=typeof item.driftMax==='number'?item.driftMax:30;
      var named=function(whole){ var p=presets.filter(function(x){ return Math.round(+x.value*100)===whole; })[0]; return p&&p.name?p.name:pctWord(whole); };
      var on=sSwitchRow('Set a starting %','record.add-id.drift-on',item.product,false), grp=sGroup(null,'mslide__on');
      on.firstChild.appendChild(document.createTextNode(' ')); on.firstChild.appendChild(bookChip(item.product));   /* a row about one book ends in its chip, never its name */
      grp.list.appendChild(sLi(on)); id.appendChild(grp);
      var bar=pctSlider({label:['Starting %','record.add-id.drift',item.product,item.product],min:lo,max:hi,value:0,say:named}); id.appendChild(bar);
      var r=bar.input, dis=false;
      var paint=function(){ var set=on.sw.checked; r.disabled=dis||!set; if(set) bar.say(Math.round(+r.value)); else bar.say(0,'Not set'); };
      /* the control the form reads: .value '' while nothing is set, else the fraction it sends (0.3 for +30%); .disabled; a change that bubbles */
      var select={product:item.product};
      Object.defineProperty(select,'value',{ get:function(){ return on.sw.checked?String(Number((Math.round(+r.value)/100).toFixed(2))):''; },
        set:function(v){ var t=String(v==null?'':v); if(t===''){ on.sw.checked=false; } else { on.sw.checked=true; r.value=String(Math.round(Number(t)*100)); } paint(); } });
      Object.defineProperty(select,'disabled',{ get:function(){ return dis; }, set:function(v){ dis=!!v; on.sw.disabled=dis; paint(); } });
      select.dispatchEvent=function(e){ return r.dispatchEvent(e); };
      on.sw.addEventListener('change',function(){ paint(); });
      r.addEventListener('input',paint);
      paint();
      /* 11 Nov 2026, his word (always start a stranger at +30%): salt's starting % is +30% unless he chooses another; the Median Price and every other place stay his to pick */
      if(item.product==='salt'&&presets.some(function(p){ return String(p.value)==='0.3'; })){ select.value='0.3'; id.appendChild(el('p','amb-field__hint ostart30','Starts at +30%.')); }
      return {product:item.product,select:select,switchRow:on,slider:bar,lo:lo/100,hi:hi/100};
    });
    /* 25 Oct 2026 (Record redesign P7, his Ask J): the code they will get, worked out as Add the customer works it out, shown as the name and place are typed;
       nothing is shown until there is a code to show */
    var codeLine=function(form,label){ var box=sGroup(null,'codeline'), v=el('span','amb-setting__value codeline__code'), row=el('div','amb-setting');
      row.appendChild(el('span','amb-setting__name',label)); row.appendChild(v); box.list.appendChild(sLi(row)); box.hidden=true; form.appendChild(box);
      return function(text){ v.textContent=text||''; box.hidden=!text; }; };
    var idCode=codeLine(id,'Their code');
    var drawIdCode=function(){ var kind=idKind.value, parentCode=(kind==='bucket'||kind==='downstream')?idParent.value:null;
      idCode(kind==='bucket'?(parentCode?parentCode+'-R':''):makerDerivedCode(idName.value.trim(),idPlace.value.trim(),kind,catalog.parties||[],null,parentCode)); };
    id.addEventListener('input',drawIdCode); id.addEventListener('change',drawIdCode);
    var idStatus=makerStatus(id), idBusy=false;
    idKind.addEventListener('change',function(){
      var bucket=idKind.value==='bucket', needsParent=bucket||idKind.value==='downstream';
      idName.disabled=bucket;idPlace.disabled=bucket;idGate.hidden=bucket;idLink.disabled=bucket;
      idParent.disabled=!needsParent;
      var canStart=idCanStart(idKind.value);
      idDrifts.forEach(function(item){item.select.disabled=!canStart;});
    });
    idKind.dispatchEvent(new Event('change'));
    joinForm={kind:idKind,name:idName,place:idPlace,status:idStatus,drifts:idDrifts,filled:false};
    /* Fable's re-check: the link is told its code only while the name is the one it sealed, so a name typed over it (in one go or after emptying) is another
       customer and is never told; the place stays his to correct, and a nickname is put right afterwards by Amend ID */
    idName.addEventListener('input',function(){ if(joinForm&&joinForm.name===idName) joinForm.filled=!!joinHold&&idName.value.trim()===joinHold.name; });
    var idDraft=null;
    pairDrafts.push({draft:function(){return idDraft;},clear:function(){idDraft=null;}});
    id.addEventListener('input',function(){idDraft=null;});
    id.addEventListener('change',function(){idDraft=null;});
    makerButton(id,['Add the customer','record.add-id.send'],async function(send){
      if(idBusy)return;idBusy=true;idStatus.textContent='Locking the name and place.';
      var kind=idKind.value, parentCode=(kind==='bucket'||kind==='downstream')?idParent.value:null;
      var tiers={};
      if(idCanStart(kind)){
        for(var driftIndex=0;driftIndex<idDrifts.length;driftIndex++){
          var driftItem=idDrifts[driftIndex], choice=driftItem.select.value, driftValue;
          /* the slider holds the book's own ends (salt -1 to 1 on the band, a board -0.3 to 0.3), so what it gives is always inside them */
          if(choice!=='')driftValue=Number(choice);
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
        if(tiers)idBody.unit='band';
         if(geo)idBody.geo=geo;
        if(addrEnvelope)idBody.addrVault=addrEnvelope;
        if(idDraft)makerPairBody(idBody,idDraft);
        if(joinHold&&joinForm&&joinForm.filled&&kind==='customer'){
          joinTried[joinHold.id]=code;
          var introBy=codeOfUser(joinHold.by); if(introBy)idBody.introducer=introBy;   /* R3: the associate whose link brought them; their first week counts for them */
        }
        await send('/all/maker/inputs/add-id',idBody,idDraft);
        idDraft=null;
        var joinNote=await joinTold(name,locality,kind,code);
        idName.value='';idPlace.value='';idLink.value='';idLocal();
        if(kind!=='bucket')makerVaultRefresh();
        try{
          await refreshTradeCatalog();
          idStatus.textContent='Sent. '+code+' waits under Approve, and can be chosen already.';
        }catch(refreshError){
          idStatus.textContent='Sent. '+code+' waits under Approve, but the lists could not be refreshed: '+refreshError.message;
        }
        if(joinNote)idStatus.textContent+=' '+joinNote;
        loadMaker();
      }catch(error){refusal(idStatus,error);}
      idBusy=false;
    },true);
    var appointment=makerForm('customers');appointment.appendChild(el('h3','amb-section','Make an associate'));
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
    var amend=makerForm('customers');amend.appendChild(el('h3','amb-section','Change a name or place'));
    amend.appendChild(el('p','msg','The name and place are locked on this phone first. Only the short code and the rounded place travel.'));
    parent.appendChild(amend);
    var amendParty=addSelect(amend,['Who','record.amend-id.party'],partyItems), amendName=makerField(amend,['Name','record.amend-id.name'],'text','');
    var amendLink=makerField(amend,['Where','record.amend-id.link'],'text','');placeAssist(amendLink,{id:'makerAmendLink',act:'record.amend-id.link'});
    var amendPlace=makerLocalityField(amend,'record.amend-id.place'), amendLocal=makerLocalityFrom(amendLink,amendPlace), amendGate=makerVaultGate(amend),
      amendStatus=makerStatus(amend), amendBusy=false;
    /* the code after the change, as Save the change works it out (25 Oct 2026, his Ask J): unchanged where the name and place keep it */
    var amendCode=codeLine(amend,'Code after');
    var drawAmendCode=function(){ var from=amendParty.value, to=amendName.value.trim()&&amendPlace.value.trim()?makerDerivedCode(amendName.value.trim(),amendPlace.value.trim(),from.charAt(0)==='S'?'supplier':'customer',catalog.parties||[],from):null;
      amendCode(to?(to===from?from+', unchanged':to):''); };
    amend.addEventListener('input',drawAmendCode); amend.addEventListener('change',drawAmendCode);
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
        amendName.value='';amendPlace.value='';amendLink.value='';amendLocal();
        makerVaultRefresh();
        amendStatus.textContent=result.vaultOnly?'Saved. The code stays '+from+'.'
          :'Sent. The code changes from '+from+' to '+to+' once you approve it.';
        loadMaker();
      }catch(error){refusal(amendStatus,error);}
      amendBusy=false;
    },true);
    var placement=makerForm('customers');placement.appendChild(el('h3','amb-section','Place on the map'));
    placement.appendChild(el('p','msg','Keep the filed point, or put a new place in Where.'));
    parent.appendChild(placement);
    var placeParty=addSelect(placement,['Who','record.place.party'],partyItems),
      placeGate=makerVaultGate(placement,function(gate){
        /* open, the gate says whether a place is filed for the one chosen, from the places the unlock holds; never where */
        if(!makerVault||!placeParty.value) return;
        gate.appendChild(el('p','msg',Object.hasOwn(makerVault.places,placeParty.value)?'A place is filed for them'+makerPlaceSaid(makerVault.places[placeParty.value])+' Filing a new link replaces it.':'No place is filed for them yet.'));
      }), placeStatus=makerStatus(placement), placeBusy=false;
    var placeLink=makerField(placement,['Where','record.place.link'],'text','');placeAssist(placeLink,{id:'makerPlaceLink',act:'record.place.link'});
    var placeLocality=makerLocalityField(placement,'record.place.locality'), placeLocal=makerLocalityFrom(placeLink,placeLocality);
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
        placeLocality.value='';placeLink.value='';placeLocal();
        makerVaultRefresh();
        placeStatus.textContent='Sent. The exact address stays locked.';
        loadMaker();
      }catch(error){refusal(placeStatus,error);}
      /* a place that is not on the list throws after the pair is prepared, so the plain places map is stripped here whichever way the tap ended */
      finally{ if(placeDraft) delete placeDraft.placeMap; placeBusy=false; }
    },true);
  }
  function makerCard(parent,key,recipe){
    var card=el('article',(recipe?recipe+' ':'')+'maker-card');
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
    [].forEach.call(document.querySelectorAll('#makerReview [data-maker-say], #makerDrafts [data-maker-say], #nopen [data-maker-say]'),function(node){ if(node.getAttribute('data-maker-say')===key) line=node; });
    /* 13 Oct 2026 (stress, Medium): a card that has gone (the order moved on, the row was decided) hands its answer to the list's line at the head of the
       part, which the page may be scrolled well below: it is brought into reach, as a card's own line is */
    if(line){ line.textContent=text; withDetails(line,error); if(line.scrollIntoView) line.scrollIntoView({block:'nearest'}); }
    else if(list){ list.textContent=text; withDetails(list,error); if(list.scrollIntoView) list.scrollIntoView({block:'nearest'}); }
  }
  function makerAction(path, body, message, key){
    if(makerBusy) return Promise.resolve();
    makerBusy=true;
    delete makerOutside[key];
    return refs(path,body).then(function(result){
      makerBusy=false;
      return loadMaker().then(function(){
        makerSay(key,result.differs?'The row differs from what you saw and waits under Approve.'
          :result.waiting?'The row is still being made. Check Approve in a moment.'
          :result.dropped&&result.row?'Taken off. The money is on '+result.row+'.'
          :result.preapproval&&result.preapproval.says?result.preapproval.says:(message||'Saved.')+sheetSaid(result.sheet));
        return true;
      });
    },function(error){
      makerBusy=false;
      if(error&&error.detail&&error.detail.fresh) makerFresh[key]=true;
      if(error&&error.detail&&error.detail.outside){ makerOutside[key]={outside:error.detail.outside, say:error.raw}; makerSay(key,error.raw); return false; }
      makerSay(key,error.message,error);
      return false;
    });
  }
  /* plan version 3, part 3d: what the sheet's other lines did when his Agree on its first went on to them, in one sentence */
  function sheetSaid(sheet){
    if(!Array.isArray(sheet)||!sheet.length) return '';
    var ok=sheet.filter(function(x){ return x&&x.accepted; }).length, left=sheet.filter(function(x){ return x&&!x.accepted; });
    return ' '+(ok?ok+' other line'+(ok>1?'s':'')+' agreed with it, one trip and one delivery.':'')
      +(left.length?(ok?' ':'')+left.length+' still to agree: '+String(left[0].why||'').replace(/[.]$/,'')+'.':'');
  }
  /* one request id per move until it lands, so a retry after a lost answer is the same request */
  var makerRids={};
  /* 1 Nov 2026: a refusal marked fresh (a Withdraw's id answered once, now over a newer offer) drops the id, so the next tap is a new request */
  var makerFresh={};
  /* 10 Nov 2026 (his ask D): A PRICE OUTSIDE THE BAND IS ASKED ONCE. The Desk refuses a goods total he types under the Floor or over the Ceiling of a book with a
     price band (409, outside) and says by how much; the card shows its sentence, a Reason field and Let it stand, which sends the same figures again with his
     reason (oneOff), and the row then stands as a marked one-off. makerOutside keeps the refusal a tap was given, by the card's key, for the Sheet that asks;
     makerOneOff the reason he gave on a placed order, by its id, until its goods total changes. The reason is his alone: it goes to the Desk, never to a customer. */
  var makerOutside={}, makerOneOff={}, makerOneDraft={};
  var ONE_OFF_WORDS={reason:'Reason', give:'Give a reason', go:'Let it stand', title:'Let this price stand?', keep:'Not now', sent:'Change sent. You approve it next, under Approve.'};
  function oneOffOk(text){ var t=String(text==null?'':text).trim(); return t.length>=3&&t.length<=120; }
  function makerMove(order,body,message){
    var key=order.id+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+(body.claim?'notfound':'move'),
      Object.assign({rid:rid},body),message,order.id).then(function(done){ if(done) delete makerRids[key]; return done; });   /* 28 Oct 2026: says how it went, as makerTap does */
  }
  /* a handover, a close, cash, a Received or a move offered again, under one request id until it lands, as a move is */
  function makerTap(order,action,body,message){
    var key=order.id+action+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+action,
      Object.assign({rid:rid},body),message,order.id).then(function(done){ if(done||makerFresh[order.id]){ delete makerRids[key]; delete makerFresh[order.id]; } return done; });
  }
  /* a claim above what the order still owes is money he recorded another way; orderReceived is the one send of a claim's Received, the card's Sheet and Needs you's card alike */
  /* 28 Oct 2026: WHAT AN ORDER STILL OWES IS THE SITE'S dueOf, goods and delivery less what is paid AND their credit his Accept spent (v1284), which the
     order keeps apart from paid; every reading of an order's money on this page goes through it, so a credit is never shown as owed */
  function ordPaidAll(o){ return (+(o&&o.paid)||0)+(+(o&&o.credit)||0); }
  function ordDue(o){ return +((+(o&&o.total)||0)+(+(o&&o.delivery)||0)-ordPaidAll(o)).toFixed(2); }
  function payOnBook(order,payment){ return Number(payment.amount)>ordDue(order)+0.004; }
  function orderReceived(order,payment){
    var onBook=payOnBook(order,payment);
    return makerTap(order,'received',onBook?{amount:payment.amount,claim:payment.at,covered:true}:{amount:payment.amount,claim:payment.at},
      onBook?'Already recorded. Nothing more is recorded.':'Sent to the Desk.');
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
        makerCashSaid[id]='Recorded: '+rm(held.amount)+' in cash. '+rm(Math.max(0,ordDue(order)))+' still owed.';
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
    /* 28 Oct 2026: the Desk's own measure (cashTap): what is owed less their credit and less what they say they sent */
    var due=+(ordDue(order)-(+order.claimed||0)).toFixed(2);
    /* 27 Oct 2026, his word: cash past what they owe is taken, the excess a refund to them; beside a claim of theirs, or with nothing owed, it is not */
    var claimed=(order.payments||[]).some(function(p){ return p&&p.claim==='waiting'; })||(+order.claimed||0)>0.004;
    if(!Number.isFinite(amount)||amount<=0.004||(amount>due+0.004&&(claimed||due<=0.004))){
      makerCashSaid[order.id]='That is not a figure above RM 0 and up to the '+rm(due)+' owed'+(claimed?' beside what they say they sent':'')+'. Nothing was sent.';drawMaker();return;
    }
    var held={amount:amount,beforePaid:Number(order.paid||0),until:Date.now()+MAKER_CASH_MS,sent:false,busy:false,over:amount>due+0.004?+(amount-due).toFixed(2):0};
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
      var refund=result.preapproval&&+result.preapproval.refund||0;
      makerCashSaid[id]='Recorded.'+(refund>0.004?' '+rm(refund)+' over what they owe opens as a refund to them once it folds.':'')+' Refresh to see it.';
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
    var held=makerCashHeld[order.id], note=el('p','amb-field__hint');
    note.setAttribute('role','status');note.setAttribute('data-maker-cash-status',order.id);
    if(held){
      card.querySelectorAll('button,input,select').forEach(function(node){node.disabled=true;});
      /* 2 Nov 2026 (his Orders canvas, page 2): Undo and Retry are rows of a list, the card's one pill being the stage's */
      var heldRows=aGroup(null,'ocashrows'); card.appendChild(heldRows);
      if(!held.sent){
        note.appendChild(document.createTextNode('Cash received, '+rm(held.amount)+(held.over?', '+rm(held.over)+' over what they owe, a refund to them':'')+': it goes in '));
        var left=el('span',null,String(makerCashLeft(order.id)));left.setAttribute('data-maker-cash-left',order.id);
        note.appendChild(left);note.appendChild(document.createTextNode(' s. Undo sends nothing.'));
        aAct(makerClaimButton(heldRows,['Undo','order.cash-undo'],function(){makerCashUndo(order.id);},false)); heldRows.add(heldRows.lastChild).setAttribute('data-maker-cash-undo','');
      }else{
        note.textContent=makerCashSaid[order.id]||'Sending.';
        var retry=aAct(makerClaimButton(heldRows,[held.confirmed?'Refresh cash':'Retry cash','order.cash-retry'],function(){
          return held.confirmed?loadMaker():makerCashGo(order.id);
        },false)); heldRows.add(retry);
        retry.disabled=held.busy;retry.setAttribute('data-maker-cash-retry','');
      }
    }else if(makerCashStorageError){
      card.querySelectorAll('button,input,select').forEach(function(node){node.disabled=true;});
      note.textContent=makerCashStorageError;
    }else{
      note.textContent=makerCashSaid[order.id]||'';   /* 17 Nov 2026: the amount itself is the Change sheet's (version 2) */
    }
    card.appendChild(note);
  }
  /* 16 Oct 2026 (plan 5, part 1) to 17 Nov 2026: Bank and Cash over one amount were a control of their own on the card (makerPayControl); since the
     order-changes plan's version 2 they are the Change sheet's Received now and Paid by (amendOpen), sending what it sent: Bank the order's received
     under one request id until it lands, Cash held ten seconds with its Undo (makerCashHold). No road is new. */
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
  function makerAcceptAgain(card,order,acts,into){
    var route='/all/maker/orders/'+encodeURIComponent(order.id), key=order.id+':again', sig=JSON.stringify(order), turn=0;
    var said=el('p','amb-field__hint'), figs=el('div','maker-quote amb-stack');
    said.setAttribute('role','status'); (into||card).appendChild(said); (into||card).appendChild(figs);
    /* 12 Oct 2026 (his decision 6 of 11 Oct): its figures read themselves when the order is opened, as a placed order's do, and Preview Accept again is retired */
    function againShow(result){
      said.className='amb-field__hint'; said.textContent='Figures read: check them before you agree again.';
      figs.textContent=''; makerReading(figs,result,'preview');
      var old=card.querySelector('[data-accept-again]'); if(old) old.remove();
      var again=makerButton(acts,['Check and agree again','order.accept-again'],function(){
        makerAction(route+'/accept',{hash:result.hash},'Agreed again and sent to the Desk.',order.id);
      },true);
      again.setAttribute('data-accept-again',''); acts.insertBefore(again,acts.firstChild);
    }
    function againRead(){
      var mine=++turn, old=card.querySelector('[data-accept-again]'); if(old) old.remove();
      said.className='amb-field__hint'; said.textContent='Reading the figures.'; figs.textContent='';
      var pv=makerPv[key]; if(!pv) pv=makerPv[key]={p:refs(route+'/preview',{})};
      pv.p.then(function(result){
        if(makerPv[key]===pv) delete makerPv[key];
        if(mine!==turn||!card.isConnected) return;
        makerQuotes[key]={sig:sig,result:result}; againShow(result);
      }).catch(function(error){
        if(makerPv[key]===pv) delete makerPv[key];
        if(mine!==turn||!card.isConnected) return;
        said.className='amb-field__hint msg bad'; refusal(said,error);
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
  /* 16 Nov 2026 (the move to Ambient, place G): a Sheet restates what it asks about as Ambient's row, the mark as its thumb, the code its title, the size and stage under it, the figure at the right */
  function makerAskRow(order){
    return askRow(codeByUser(order.u), rm(Number(order.total||0)+Number(order.delivery||0)), units(order.qty)+', '+String((ORD_STAGE[order.status]||['',order.status])[1]).toLowerCase(), bookTile(order.product,order.qty));
  }
  /* the control that asks carries its data-yn from the moment it is drawn, so a card redrawn while its sheet is open still has the control to give focus back to */
  function makerAskKey(order,kind){ return 'order:'+order.id+':'+kind; }
  function makerAskTag(order,btn,kind){ btn.setAttribute('data-yn',makerAskKey(order,kind)); return btn; }
  /* COUNTER BATCH A: WHICH POINT. Ready to collect and Change point open the page's Sheet over his points (the test accounts' own on an
     example order), the one used last first, one 44px button each; a tap sends the move under its own request id, so another point is
     another move. With no point on the list, the Sheet says where to add one and sends nothing. */
  function pointLast(code){
    var at='';
    ((makerData&&makerData.orders)||[]).forEach(function(o){ (o.history||[]).forEach(function(h){ if(h&&h.point===code&&String(h.at)>at) at=String(h.at); }); });
    return at;
  }
  async function pointPick(order,opener,kind){
    if(!makerPoints){ try{ makerPoints=await refs('/all/maker/points'); }catch(error){ makerSay(order.id,error.message,error); return; } }
    var list=(order.test?makerPoints.examples:makerPoints.points&&makerPoints.points.list)||[];
    if(kind==='change') list=list.filter(function(p){ return p.code!==order.point; });
    list=list.slice().sort(function(a,b){ var x=pointLast(a.code), y=pointLast(b.code); return x<y?1:x>y?-1:a.code<b.code?-1:1; });
    var grid=el('div','maker-point-pick amb-stack');
    list.forEach(function(p){
      var b=actOn(el('button','amb-pill amb-pill--quiet amb-pill--block','Point '+p.code),'order.point',p.code); b.type='button';
      b.addEventListener('click',function(){
        ynShut();
        makerMove(order,kind==='ready'?{status:'ready',mode:'collect',point:p.code}:{point:p.code},
          kind==='ready'?'Order marked ready to collect at Point '+p.code+'.':'Collection point changed to Point '+p.code+'.');
      });
      grid.appendChild(b);
    });
    makerAsk(order,opener,'point',{title:kind==='ready'?'Ready to collect at which point?':'Move it to which point?', plain:true, go:'Choose a point', keep:'Not yet',
      say:[list.length?'They are told where, with a pin that opens their maps app.':(kind==='ready'?'No point is on the list yet.':'No other point is on the list.')+' Add one under Settings, Shop hours.'], extra:[grid]});
    var go=document.getElementById('ynGo'); if(go) go.hidden=true;
  }
  function makerAsk(order,opener,kind,q){
    ynOpen({title:q.title, opener:opener, again:ynFind(makerAskKey(order,kind)), go:q.go, keep:q.keep, yes:q.yes,
      body:[makerAskRow(order)].concat(q.say.map(function(s){ return el('p',null,s); })).concat(q.extra||[])});
    var go=document.getElementById('ynGo');
    actOn(go,'order.ask-go',order.id); actOn(document.getElementById('ynKeep'),'order.ask-keep',order.id); actOn(document.getElementById('ynX'),'order.ask-close',order.id);
    if(q.plain||q.primary){ go.classList.remove('amb-pill--danger'); go.classList.add('amb-pill--accent'); }
  }
  /* 12 Oct 2026 (Phase 2c, his decision 4 of 11 Oct): EVERY OTHER YES OR NO ON THIS PAGE IS THE SAME SHEET, and no native confirm is left in this script. ownerAsk opens
     ynOpen and answers a promise: true when the one action is tapped, false on the ghost, the close control, the scrim, Escape or a lapse. The Sheet tells the promise it
     has come down (the shut hook) a microtask later, so the action, which runs just after it, is read first; a flow that awaits the answer carries on as it did when the
     confirm said no, and a second tap on the action finds the Sheet gone and answers nothing. key names what is asked: its opener carries it as data-yn (ynTag), so a card
     redrawn meanwhile still has the control to give focus back to, and the Sheet's three controls carry it as their data-key. q: title, row (a node restating what is
     asked), say (lines), extra (nodes), go, keep, plain (not a danger action), primary (filled pill). */
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
      go.classList.toggle('amb-pill--danger',q.plain!==true); go.classList.toggle('amb-pill--accent',q.plain===true);
    });
  }
  /* what a Sheet restates: a mark if there is one (its thumb), a label, a figure, and a line under them, as Ambient's row */
  function askRow(label,value,flag,tile){
    return hList([hRow({tag:'div', thumb:tile||null, title:label, sub:flag||'', amount:value||''})]);
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
  function detailList(pairs){ return apPairs(pairs); }
  function detailBox(act,key,pairs){
    var box=el('details','rdet');
    box.appendChild(actOn(el('summary','amb-pill amb-pill--sm amb-pill--quiet','Details'),act,key));
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
    var set=el('fieldset','amb-options'), wrap=el('label','amb-field'), field=el('input','amb-input');
    set.appendChild(el('legend','amb-field__label','Tell them why (optional)'));
    MAKER_WHY.filter(function(w){ return w[0]!=='place'||order.mode==='deliver'; }).forEach(function(w){
      var label=el('label','amb-option'), radio=el('input','amb-vh amb-option__input'), mark=el('span','amb-option__mark'), title=el('span','amb-option__title',w[2]);
      radio.type='radio'; radio.name='makerWhy-'+order.id; radio.value=w[0]; actOn(radio,'order.reason-'+w[0],order.id); mark.setAttribute('aria-hidden','true');
      radio.addEventListener('change',function(){ field.value=w[1]; });
      label.appendChild(radio); label.appendChild(mark); label.appendChild(title); set.appendChild(label);
    });
    field.type='text'; actOn(field,'order.reason',order.id);
    field.addEventListener('input',function(){ [].forEach.call(set.querySelectorAll('input'),function(r){ r.checked=false; }); });
    wrap.appendChild(el('span','amb-field__label','Or in your own words')); wrap.appendChild(field);
    return {nodes:[set,wrap], note:function(){ var v=field.value.trim(); return v?{note:v}:{}; }};
  }
  /* replyOnly is a closed order: only his answer to their question, and no Decline, Cancel or reason */
  function makerOrderMoves(card,order,replyOnly,acts){ ordMessages(card,order); ordEnd(card,order); }
  /* 2 Nov 2026 (his Orders canvas, page 2, answer 4): THE THREAD AND ITS COMPOSER ARE THE COUNTER'S (oThreadOf, oComposerOf in stmt/page.js): every line of
     the order, his on the right and theirs on the left, his quick replies above the box, and Save this line and No reply needed as rows under it. Send sends
     what the fold's Send sent, the order's move with his message, and nothing is sent empty. The fold Answer is gone: the box stands in view. */
  function ordMessages(card,order){
    var lines=((order&&order.msgs)||[]).filter(function(m){ return m&&m.text; }).map(function(m){
      var his=m.by==='desk'; return bubble(his?'mine':'theirs',m.text,(his?'You, ':'They wrote, ')+fmtWhen(m.at),'',false);
    });
    var sec=oThreadOf('Messages',lines,'Messages on this order');
    if(!lines.length) sec.appendChild(el('p','onote omsgs__none','No messages yet.'));
    var th=sec, quick=el('div','oquick oact'), f=oComposerOf('Your line','Send'), said=f.field;
    actOn(said,'order.reply-text'); actOn(f.sendButton,'order.reply');
    makerQuick().forEach(function(line,i){
      makerButton(quick,[line,'order.quick-reply',i],function(){ said.value=line; keepWord(); },false).setAttribute('data-quick','');
    });
    th.appendChild(quick); th.appendChild(f);
    f.addEventListener('submit',function(ev){
      ev.preventDefault();
      if(!said.value.trim()) return;
      makerMove(order,{message:said.value.trim()},'Reply sent.');
    });
    var rows=aGroup(null,'omsgs__rows');
    var keep=aActBtn(rows,['Save this line','order.quick-keep'],function(){
      makerSay(order.id,makerQuickKeep(said.value));
      keepWord();
    });
    keep.setAttribute('data-keep','');
    function keepWord(){ var t=said.value.trim().replace(/[ ]+/g,' '); keep.textContent=t&&makerQuick().indexOf(t)>=0?'Forget it':'Save this line'; }
    said.addEventListener('input',keepWord);
    aActBtn(rows,['No reply needed','order.no-reply'],function(){ makerMove(order,{noReply:true},'No reply needed recorded.'); });
    sec.appendChild(rows);
    card.appendChild(sec);
  }
  /* his decision 4 of 11 Oct 2026: a Decline or a Cancel asks on the page's Sheet, and the reason is asked there, on tiles. 2 Nov 2026 (his canvas): what
     ends the order is an ember row at the card's end, last, alone in its list */
  function ordEnd(card,order){
    var tail=aGroup(null,'ordend');
    if(order.status==='placed'){
      var dec=aActBtn(tail,['Decline the order','order.decline'],function(){
        var why=makerWhy(order);
        makerAsk(order,dec,'decline',{title:'Decline this order?', go:'Decline the order', keep:'Keep the order', extra:why.nodes,
          say:['It is declined and goes no further. The customer is told, with your reason if you give one.'],
          yes:function(){ makerMove(order,Object.assign({status:'declined'},why.note()),'Order declined.'); }});
      },null,true);
      makerAskTag(order,dec,'decline');
    }else if((order.status==='acknowledged'||order.status==='ready')&&!order.closed&&!(+order.claimed>0)&&!(+order.moved>0)){
      var can=aActBtn(tail,['Cancel the order','order.cancel'],function(){
        var why=makerWhy(order);
        makerAsk(order,can,'cancel',{title:'Cancel this order?', go:'Cancel the order', keep:'Keep the order', extra:why.nodes,
          say:[+order.paid>0?rm(+order.paid)+' is paid on it, so a refund to the customer opens for you to return.':'Nothing is paid on it.'],
          yes:function(){ makerMove(order,Object.assign({status:'cancelled'},why.note()),'Order cancelled.'); }});
      },null,true);
      makerAskTag(order,can,'cancel');
    }else if((order.status==='acknowledged'||order.status==='ready')&&!order.closed&&!(+order.claimed>0)&&+order.moved>0&&+order.moved<+order.qty-0.0004){
      /* his answer of 17 Oct 2026: A CANCEL ONCE GOODS ARE OUT CANCELS THE REST. The order closes at what was handed over, the Desk restating its total
         (the close Finish at fewer units sends), and anything paid above that opens as a refund */
      var rest=aActBtn(tail,['Cancel the rest','order.cancel-rest'],function(){
        var n=+(+order.moved).toFixed(3);
        makerAsk(order,rest,'cancel-rest',{title:'Cancel the rest of this order?', go:'Cancel the rest', keep:'Keep the order',
          say:['The order ends at the '+units(n)+' handed over, and the Desk restates its total. Anything they paid above it opens as a refund for you to return.'],
          yes:function(){ makerTap(order,'handed',{qty:n,close:true},'Sent to the Desk: the order ends at what was handed over.'); }});
      },null,true);
      makerAskTag(order,rest,'cancel-rest');
    }
    if(tail.querySelector('button')) card.appendChild(tail);
  }
  /* WHERE NEXT: This customer opens their account on Customers; the Order log is the order's History fold (historyBlock), its summary a row */
  function ordNext(card,order,withLog){
    var list=aGroup(null,'onext');
    var who=actOn(el('button','amb-setting ocustrow'),'order.customer',order.id); who.type='button';
    who.appendChild(el('span','amb-setting__name','This customer')); who.appendChild(el('span','amb-setting__value',codeByUser(order.u))); who.appendChild(amb.node(amb.glyph('next','sm')));
    who.addEventListener('click',function(){ showPlace('customers','accounts',{fresh:true,push:true}); openCard(order.u); });
    list.add(who);
    card.appendChild(list);
    /* 16 Nov 2026 (Ambient, place G): the Order log is the Journal under its own fold, a count beside its name */
    if(withLog) historyBlock(card,{order:order.id},'order:'+order.id,order,order.id);
  }
  /* PHASE 1c (11 Oct 2026): RECORD'S FORMS ARE A MENU. Entry, Customers and Pricing each list their forms by name, a row of the system's
     Inbox row for each, and a row opens that form alone with a way back. The forms are the sections they were, moved and never drawn
     again: what is typed in one, its retained send and its request ids are kept by closing it, as by opening another. A retained input
     stays on the menu, above the rows. */
  function formSlug(name){ return String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  var ENTRY_GROUPS=[['Everyday',['sale-or-purchase','repayment','stock-count']],['Now and then',['gift','loan','rewards','offsets']]];   /* 27 Oct 2026, his word: Fixing left; a row is changed in the sale form, from Row or the Ledger */
  /* 25 Oct 2026 (Record redesign P1, his canvas Salt Admin Record): a form's row says what the form is for in one line, and counts what it holds where the read that
     drew it has the figure (the loans to repay, the rewards held, the cancelled orders that can come back; the offsets once their own read lands); a row with none is bare */
  var FORM_WHAT={'sale-or-purchase':'Goods and delivery are entered separately.','repayment':'Part or all of a loan, paid back.','stock-count':'Units on the shelf, by book.',
    'gift':'A gift leaves stock at cost.','loan':'Cash or goods lent or borrowed.','rewards':'Settles what they owe first, else goods.','offsets':'Units off an order they already have.',
    'correct-a-row':'Restate, record what moved, or cancel.','reopen-a-cancelled-order':'Only if nothing was paid or handed over.',
    'new-customer':'Name and place locked on this phone first.','make-an-associate':'Their name and place stay as they are.','change-a-name-or-place':'The code changes only with them.',
    'place-on-the-map':'Keep the filed point, or file a new link.',
    'printed-sizes':'Sizes on the printed price list.','desk-reminders':'Hide a reminder for a while.'};
  var PRICING_ORDER=['printed-sizes','desk-reminders'];   /* Their % and Partner moved to the account card on 26 Oct 2026 */
  /* 27 Oct 2026 (his answers: forms, menus and words in the language of Shop's This device): a row's name is three words at most; the form keeps its own heading */
  var MENU_NAME={'reopen-a-cancelled-order':'Reopen an order','change-a-name-or-place':'Name or place','place-on-the-map':'Map point'};
  function menuCount(slug,n){
    var row=document.querySelector('#makerMenu [data-act="record.form"][data-key="'+slug+'"] .mfig');
    if(row) row.textContent=n>0?String(n):'';
  }
  function recordMenu(box,note,catalog){
    fOpen=null;
    var back=amb.node(amb.circle('All forms','back',{'data-back':'form'})); back.id='makerFormBack'; back.setAttribute('data-formback','');
    back.setAttribute('data-in','record.entry record.customers record.pricing'); actOn(back,'record.form-back');
    box.insertBefore(back,note.nextSibling);
    var menu=el('div','formmenu'), lists={}, anchor=back, entryRows={};
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
      /* 27 Oct 2026: A FORM'S ROW IS A SETTINGS ROW, as Shop's This device draws one: its name, the count where its read holds one, the chevron. The line saying
         what it is for moves into the form, under its heading, where a form had none of its own. */
      var row=sOpen(MENU_NAME[slug]||name,'','record.form',slug), li=sLi(row);
      row.classList.add('formrow'); row.querySelector('.amb-setting__value').classList.add('mfig');
      var head=form.querySelector('h3'), said=head.nextElementSibling;
      if(FORM_WHAT[slug]&&!(said&&said.matches('p.msg'))) head.parentNode.insertBefore(el('p','msg formwhat',FORM_WHAT[slug]),head.nextSibling);
      row.addEventListener('click', function(){ openForm(slug); });
      if(part==='entry') entryRows[slug]=li; else (lists[part].firstChild||lists[part].appendChild(sGroup(null))).list.appendChild(li);
    });
    /* 18 Oct 2026, CLARITY PART 4: Entry's forms are grouped by how often he uses them, each group under a small eyebrow. A form not listed goes at the end of Fixing. */
    var seen={};
    ENTRY_GROUPS.forEach(function(g){
      var have=g[1].filter(function(s){ return entryRows[s]; }); if(!have.length) return;
      /* 27 Oct 2026: each group a settings list under its head */
      var group=sGroup(g[0]); group.querySelector('.amb-settings__head').setAttribute('data-group',formSlug(g[0])); lists.entry.appendChild(group);
      have.forEach(function(s){ seen[s]=1; group.list.appendChild(entryRows[s]); });
    });
    /* 27 Oct 2026, his word: Correct a row and Reopen are no rows of the menu (the sale form's Other fields and a cancelled row's Reopen reach them); any other form not listed goes at the end */
    var OFF_MENU={'correct-a-row':1,'reopen-a-cancelled-order':1};
    Object.keys(entryRows).forEach(function(s){ if(OFF_MENU[s]){ entryRows[s].remove(); return; } if(!seen[s]) (lists.entry.lastElementChild||lists.entry.appendChild(sGroup(null))).list.appendChild(entryRows[s]); });
    /* 25 Oct 2026 (Record redesign P8, his Ask G): Pricing in his order, Printed sizes then Desk reminders since Their % and Partner left (26 Oct); a form not named keeps its place after them */
    PRICING_ORDER.slice().reverse().forEach(function(s){ var row=lists.pricing.querySelector('[data-key="'+s+'"]'); if(row){ var li=row.closest('li'); li.parentNode.insertBefore(li,li.parentNode.firstChild); } });
    /* PHASE 4a (12 Oct 2026): THE FORM OPEN IS A PANE. The retained input and the menu are one column and the forms the pane beside it, moved into
       them and never drawn again; the grid is one column below 860px, where the form takes the menu's place and has its way back. */
    var grid=el('div','amb-split amb-split--panes recgrid'), list=el('div','amb-stack reclist'), pane=el('div','amb-stack recpane');
    grid.id='makerFormGrid'; var none=sGroup('No form open','rnone recnone'); none.list.appendChild(sLi(sRead('Choose a form to open it here.'))); pane.appendChild(none);   /* 17 Nov 2026, the move to Ambient (Fable's review, item 10): Shop's empty pane, a head over a one-row card */
    grid.appendChild(list); grid.appendChild(pane); box.insertBefore(grid,back.nextSibling);
    [].slice.call(box.children).forEach(function(n){
      if(n.hasAttribute('data-formmenu')) list.appendChild(n); else if(n.hasAttribute('data-form')) pane.appendChild(n);
    });
    applyRepay(); applyAmend(); applyTip();
    catalog=catalog||{};
    menuCount('repayment',(catalog.loans||[]).length);
    menuCount('rewards',(catalog.rewards||[]).filter(function(offer){ return offer.action; }).length);
    menuCount('reopen-a-cancelled-order',(catalog.revivable||[]).filter(function(row){return !(row.paid>0.009)&&!(row.movedUnits>0.009);}).length);
    if(menuOffers!=null) menuCount('offsets',menuOffers);
    unsentParts();
    joinApply();   /* a join waiting to be added fills New customer and opens it once the forms stand */
  }
  /* the count beside a part's word is what waits unsent on this phone in that part */
  function unsentParts(){
    var n={};
    try{ unsentList().forEach(function(u){ var p=retainedPart(u.path); n[p]=(n[p]||0)+1; }); }catch(e){}
    [].forEach.call(document.querySelectorAll('.aparts[data-place="record"] [data-part]'),function(b){
      var c=b.querySelector('.amb-segment__count'); if(c){ c.textContent=n[b.getAttribute('data-part')]?String(n[b.getAttribute('data-part')]):''; if(c.classList.contains('amb-segment__count')) c.hidden=!c.textContent; } });
  }
  function openForm(slug){
    var form=document.querySelector('#makerInputs [data-form="'+slug+'"]');
    if(!form) return;
    fOpen=slug; sweep();
    /* below 860px the form takes the menu's place and has its way back showing, so he is taken to the top of it; from 860px the menu is the
       page's scroll and the form stands beside it, so a tap on a low row only brings the pane into view */
    try{
      var back=document.getElementById('makerFormBack');
      back.focus();
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
      var date=makerField(box,['Counted on','record.count.date'],'date',''), qty=makerField(box,['On the shelf','record.count.units'],'number','', '0.01');
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
      var countForm=makerForm('entry'); countForm.appendChild(el('h3','amb-section','Stock count'));
      [].slice.call(box.children,countFrom).forEach(function(n){ countForm.appendChild(n); });
      box.appendChild(countForm);
      var catalog=context.catalog||{}, tradeSection=makerForm('entry');
      tradeSection.appendChild(el('h3','amb-section','Sale or purchase'));
      tradeSection.appendChild(el('p','msg','Goods and delivery are entered separately.'));
      /* plan version 4, part 4b (his answer of 03 Nov 2026, "Remove it now"): A NEW SALE IS PLACED ON THEIR OWN PAGE, Order for them with Handed over and
         paid now, so with no row chosen this form records a purchase alone; a sale's row still changes here. The server's road stays, unreached, as
         recovery, as the raw queue does */
      var newSaleNote=el('p','amb-field__hint','A new sale is placed on their own page: open their account under Customers, then Order for them.');
      newSaleNote.setAttribute('data-new-sale',''); tradeSection.appendChild(newSaleNote);
      box.appendChild(tradeSection);
      var direction=makerTilesIn(tradeSection,['Type','record.trade.direction'],[{value:'sale',label:'Sale'},{value:'purchase',label:'Purchase'}]);
      var tradeProduct=makerTilesIn(tradeSection,['Book','record.trade.book'],[]), tradeParty=actOn(el('input','amb-input mwho'),'record.trade.party'), whoList=el('datalist');
      /* 27 Oct 2026, his word: Who is typed, the codes suggested as he types (a list the browser draws), and must be one of them */
      tradeParty.type='text'; whoList.id='makerWhoList'; tradeParty.setAttribute('list',whoList.id); tradeParty.autocomplete='off'; tradeParty.spellcheck=false;
      tradeParty.setAttribute('autocapitalize','characters'); tradeParty.placeholder='Type a code'; tradeSection.appendChild(whoList);
      var partyLabel=makerRow(tradeSection,'Who',tradeParty);   /* 27 Oct 2026: a row of the form's list, Date under it */
      var tradeDate=makerDayStep(makerField(tradeSection,['Date','record.trade.date'],'date','')), tradeQty=makerWheel(tradeSection,['Units','record.trade.units'],1);
      var tradeTotal=makerField(tradeSection,['Price','record.trade.total'],'number','','0.01');
      var tradeCash=makerField(tradeSection,['Cash paid','record.trade.cash'],'number','0','0.01');
      var tradeMoved=makerWheel(tradeSection,['Handed over','record.trade.moved'],0,0);
      var handover=makerTilesIn(tradeSection,['Handover','record.trade.handover'],[{value:'',label:'Not yet'},{value:'collected',label:'Collected'},{value:'delivered',label:'Delivered'}]);
      var carriage=makerField(tradeSection,['Delivery','record.trade.delivery'],'number','0','0.01');
      var attribution=el('div','maker-trade-attribution'); tradeSection.appendChild(attribution);   /* 27 Oct 2026: in the form first, so its rows are the form's; moved before Who below */
      var tradeStream=makerTilesIn(attribution,['Associate','record.trade.stream'],[{value:'',label:'No'},{value:'R2',label:'Resells',aria:'They resell'},{value:'R3',label:'Referred',aria:'They introduced the buyer'}]);
      var tradeAssoc=actOn(el('select'),'record.trade.associate'), tradeDown=actOn(el('select'),'record.trade.end-customer');
      var assocLabel=makerRow(attribution,'Which associate',tradeAssoc), downLabel=makerRow(attribution,'Their customer',tradeDown);   /* 27 Oct 2026: rows; Not named says it is optional */
      var attributionNote=el('p','msg'); attribution.appendChild(attributionNote);
      /* 25 Oct 2026 (Record redesign P4, his Ask D): the resale choice stands before Who, since it says what Who is (hidden for a resale, Buyer for an introduction) */
      tradeSection.insertBefore(attribution,partyLabel);
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
        var row=sGroup(null,'maker-cover-row'), wrap=el('label','amb-setting maker-cover'), check=actOn(el('input','amb-switch'),acts[0]), words=el('span','maker-cover__words'), fig=el('span','amb-setting__value maker-cover__fig'), held=el('span','maker-cover__held'),
          retry=actOn(el('button','amb-pill amb-pill--quiet amb-pill--sm','Read again'),acts[1]), note=el('p','msg'), revision=0;
        check.type='checkbox';check.setAttribute('role','switch');check.setAttribute('aria-label','Use their reward');check.setAttribute('data-reward-cover','');check.disabled=true;retry.type='button';retry.hidden=true;
        var said=el('span','amb-setting__name maker-cover__said'); said.appendChild(words); said.appendChild(held);
        wrap.hidden=true;wrap.appendChild(said);wrap.appendChild(fig);wrap.appendChild(check);row.list.appendChild(sLi(wrap));row.appendChild(retry);
        root.appendChild(row);root.appendChild(note);
        async function readCoverChoice(){
          var ticket=++revision;check.checked=false;check.disabled=true;retry.hidden=true;note.textContent='';fig.textContent='';held.textContent='';
          if(tradeEditing||direction.value!=='sale'||tradeStream.value==='R2'||goodsControl.value===''||!(Number(unitsControl.value)>0)){wrap.hidden=true;return;}   /* a row open to change spends no reward: the cover is a new sale's */
          if(wrap.hidden)note.textContent='Reading.';else words.textContent='Checking.';
          try{
            var result=await refs('/all/maker/trade-cover',{product:bookControl.value,party:tradeParty.value,
              qty:Number(unitsControl.value),total:Number(goodsControl.value),stream:tradeStream.value||null});
            if(ticket!==revision||!root.isConnected)return;
            note.textContent='';
            if(result.cover){
              /* 25 Oct 2026 (Record redesign P4): the use in words, the figure at the right, what they hold under it */
              words.textContent='Use '+units(result.cover.units)+' of their reward'; fig.textContent=rm(result.cover.rm)+' off'; held.textContent='They hold '+units(result.cover.free);
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
      /* 25 Oct 2026 (Record redesign P4, his Ask E): the reading is a ledger, the label and its figure on one line, what stands behind the figure under it; the same facts
         as the sentences were, and a loss in ember */
      var readingRows=null;
      function readingRow(label,value,flag,bad){
        if(!readingRows||!readingRows.isConnected){ var rg=sGroup('Reading','reading-rows'); readingBox.appendChild(rg); readingRows=rg.list; }
        var row=sRead(label,value,bad?'reading-bad':'');
        row.setAttribute('data-reading',label);
        if(flag) row.appendChild(el('span','amb-field__hint reading-flag',flag)); readingRows.appendChild(sLi(row)); return row;
      }
      function knownParty(v){ return (catalog.parties||[]).indexOf(v)>=0; }
      /* 27 Oct 2026, his word: the price is there once who and the units are chosen: their price at that size, read off the Desk (the engine's cardAt
         over the pricing snapshot), never worked out here. A price he types stands; clearing it brings theirs back. */
      function theirPrice(productCtl,qtyCtl,totalCtl){
        var own=false, ticket=0;
        totalCtl.addEventListener('input',function(){ own=totalCtl.value!==''; totalCtl.removeAttribute('data-their'); if(!own) fillPrice(); });
        async function fillPrice(){
          var t=++ticket, who=tradeStream.value==='R2'?tradeAssoc.value:tradeParty.value;
          var auto=totalCtl.hasAttribute('data-their'), clear=function(){ if(auto){ totalCtl.value=''; totalCtl.removeAttribute('data-their'); totalCtl.dispatchEvent(new Event('change',{bubbles:true})); } };
          if(own) return;
          if(direction.value!=='sale'||!productCtl.value||!(Number(qtyCtl.value)>0)||!knownParty(who)){ clear(); return; }
          var got=null;
          try{ got=(await refs('/all/maker/trade-reading',{direction:'sale',product:productCtl.value,qty:Number(qtyCtl.value),party:who})).reading; }catch(error){ got=null; }
          if(t!==ticket||own||!totalCtl.isConnected) return;
          if(!got||!got.card){ clear(); return; }
          totalCtl.value=String(got.card.rm); totalCtl.setAttribute('data-their','');
          totalCtl.dispatchEvent(new Event('change',{bubbles:true}));
        }
        [productCtl,qtyCtl,tradeParty,tradeStream,tradeAssoc,direction].forEach(function(c){ c.addEventListener('change',fillPrice); });
        tradeParty.addEventListener('input',fillPrice);
        return {fill:fillPrice, mine:function(v){ own=!!v; if(v) totalCtl.removeAttribute('data-their'); }};
      }
      var tradePrice=theirPrice(tradeProduct,tradeQty,tradeTotal);
      async function readTrade(){
        var ticket=++readingRevision, isSale=direction.value==='sale';
        readingBox.textContent='';
        if(!(Number(tradeQty.value)>0)||tradeTotal.value===''||!tradeProduct.value){readingBox.hidden=true;return;}
        readingBox.hidden=false; readingLine('Reading.');
        var ask={direction:direction.value,product:tradeProduct.value,qty:Number(tradeQty.value),total:Number(tradeTotal.value)};
        if(tradeDate.value)ask.date=tradeDate.value;
        if(isSale){ if(knownParty(tradeParty.value)&&tradeStream.value!=='R2')ask.party=tradeParty.value; }
        else if(carriage.value!=='')ask.freight=Number(carriage.value);
        try{
          var got=(await refs('/all/maker/trade-reading',ask)).reading;
          if(ticket!==readingRevision||!readingBox.isConnected)return;
          readingBox.textContent=''; readingRows=null;
          var c=got.cogs||{};
          if(c.rate==null) readingLine('No cost to read against.'); else readingRow('Cost a unit',rm(c.rate),'From '+c.source+'.');
          if(!isSale){
            if(got.purchase.versusCogs!=null)readingRow('This buy, a unit',rm(got.purchase.perUnit),(got.purchase.versusCogs>=0?rm(got.purchase.versusCogs)+' above':rm(-got.purchase.versusCogs)+' under')+' the current cost.');
            return;
          }
          if(got.margin){
            readingRow('Goods, a unit',rm(got.price),'Goods '+rm(got.goods)+'.');
            readingRow('Margin over cost',rm(got.margin.rm)+(got.margin.pct==null?'':' · '+Math.round(got.margin.pct)+'%'),'',got.margin.belowCost);
          }
          if(got.floor) readingRow('Floor for '+units(got.qty),rm(got.floor.rm),got.floor.nrs?'Cost plus '+(Math.round(got.floor.nrs*1000)/10)+'% for unpaid units, times the size.':'Cost times the size.');
          if(got.card) readingRow('Their price',rm(got.card.rm),'Their % on the Median Price.');
          var h=got.history;
          if(h)readingRow('Their usual a unit',rm(h.median),h.count+' order'+(h.count===1?'':'s')+', '+rm(h.low)+' to '+rm(h.high)
            +(h.offMedianPct==null?'':': this is '+(h.offMedianPct>=0?h.offMedianPct+'% above':(-h.offMedianPct)+'% below'))+'. Recent: '
            +h.recent.map(function(r){return rm(r.rate);}).join(', ')+'.');
          if(got.margin&&got.margin.belowCost&&!(got.floor&&got.floor.warn))readingLine('Below cost: every unit loses '+rm(c.rate-got.price)+'.',true);
          if(got.floor&&got.floor.warn)readingLine(got.floor.warn,true);
          if(!h&&ask.party)readingLine('No earlier price of theirs on this book.');
        }catch(error){
          if(ticket===readingRevision){readingBox.textContent='';refusal(readingLine('',true),error,'Reading not available. ');}
        }
      }
      [direction,tradeProduct,tradeQty,tradeTotal,carriage,tradeParty,tradeStream,tradeDate].forEach(function(control){
        control.addEventListener('input',readTrade);control.addEventListener('change',readTrade);
      });
      var extraBooks=el('div','maker-extra-books'), extraTrades=[], extraSeq=0;
      tradeSection.appendChild(extraBooks);
      var tripGroup=sGroup(null,'maker-trip'), tripList=tripGroup.list, tripNote=el('p','amb-field__hint','Same buyer, same day; delivery charged once; approved in one tap.');
      tradeSection.appendChild(tripGroup); tradeSection.appendChild(tripNote);
      /* 27 Oct 2026: a ghost in a form is a row of its list (Shop's Add point, Remove this date), its words three or four */
      var asRow=function(b,words,list,danger){ var ul=list.tagName==='UL'?list:(list._ul&&list.contains(list._ul)?list._ul:(list._ul=list.appendChild(sGroup(null)).list)); b.className='amb-action'+(danger?' amb-action--danger':''); b.textContent=words; ul.appendChild(sLi(b)); return b; };
      function extraChoices(tiles){
        tiles.fill((catalog.products||[]).filter(function(item){
          return item.product!==tradeProduct.value&&(direction.value==='sale'?item.saleReady:item.purchaseReady);
        }).map(function(item){ return bookItem(item.product); }));
      }
      asRow(makerButton(tradeSection,['Add a book','record.trade.add-book'],function(){
        var row=el('section','maker-extra-trade'); row.setAttribute('data-key','extra'+(++extraSeq)); row.appendChild(el('h4','amb-section','Another book')); extraBooks.appendChild(row);
        var select=makerTilesIn(row,['Book','record.trade.extra-book'],[]); extraChoices(select);
        var extra={row:row,product:select,qty:makerWheel(row,['Units','record.trade.extra-units'],1),
          total:makerField(row,['Price','record.trade.extra-total'],'number','','0.01'),
          cash:makerField(row,['Cash paid','record.trade.extra-cash'],'number','0','0.01'),
          movedUnits:makerWheel(row,['Handed over','record.trade.extra-moved'],0,0)};
        extraTrades.push(extra); extra.price=theirPrice(select,extra.qty,extra.total);
        extra.cover=coverChoice(row,select,extra.qty,extra.total,['record.trade.extra-cover','record.trade.extra-cover-retry']);
        asRow(makerButton(row,['Remove this book','record.trade.remove-book'],function(){
          extraTrades.splice(extraTrades.indexOf(extra),1);coverChoices.splice(coverChoices.indexOf(extra.cover),1);row.remove();
        },false),'Remove this book',row.appendChild(sGroup(null,'maker-remove')).list,true);
      },false),'Add a book',tripList);
      /* 27 Oct 2026, his word: the handover and its cost come after every book, then what was handed over and paid, just above the pill */
      var tradeTail=el('div','maker-trade-tail');   /* not maker-tail, which is the hours chart's bar */ tradeSection.appendChild(tradeTail);
      [handover,carriage,tradeMoved,tradeCash].forEach(function(c){ var r=c.closest('.amb-field')||c; tradeTail.appendChild(r); });
      var tradeAnswer=el('p','msg'); tradeAnswer.setAttribute('role','status'); tradeSection.appendChild(tradeAnswer);
      var tradePending=false, tradeAt=null, tradeSignature='';
      function fillTradeChoices(){
        var isSale=direction.value==='sale';
        tradeProduct.fill((catalog.products||[]).filter(function(item){ return isSale?item.saleReady:item.purchaseReady; }).map(function(item){ return bookItem(item.product); }));
        whoList.textContent='';
        (catalog.parties||[]).forEach(function(code){ var option=el('option'); option.value=code; whoList.appendChild(option); });
        carriage.parentNode.querySelector('.amb-field__label').textContent=isSale?'Delivery':'Freight';
        extraTrades.forEach(function(extra){extraChoices(extra.product);});
        fillAttribution();
        if(editPick) fillEditPick();   /* the row list is drawn once its picker stands */
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
        if(tradeEditing){ tradePending=true; try{ await submitEdit(send); } catch(error){ refusal(tradeAnswer,error); } tradePending=false; return; }
        var isSale=direction.value==='sale';
        if(isSale){ tradeAnswer.textContent='A new sale is placed on their own page: Order for them.'; return; }   /* plan version 4, part 4b */
        var body={product:tradeProduct.value,party:tradeParty.value,date:tradeDate.value,
          qty:tradeQty.value===''?null:Number(tradeQty.value),total:tradeTotal.value===''?null:Number(tradeTotal.value),
          cash:tradeCash.value===''?null:Number(tradeCash.value),movedUnits:tradeMoved.value===''?null:Number(tradeMoved.value),
          handover:handover.value||null};
        body[isSale?'delivery':'freight']=carriage.value===''?null:Number(carriage.value);
        if(!(isSale&&tradeStream.value==='R2')&&!knownParty(body.party)){ tradeAnswer.textContent='Choose who from the list.'; return; }
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
      var tradeAction=function(send){ return submitTrade(null,send); };
      tradeAction.after=async function(send){ if(!editAfter) return; var b=editAfter; editAfter=null; await send('/all/maker/inputs/ledger-amend',b); };
      var tradeSend=makerButton(tradeSection,['Record the purchase','record.trade.send'],tradeAction,true,function(){
        tradeAt=null;tradeSignature='';coverChoices.forEach(function(choice){choice.read();});
      });
      direction.addEventListener('change',function(){ if(!tradeEditing) tradeSend.textContent='Record the '+direction.value; });
      /* 27 Oct 2026, his word: EVERY CHANGE OF A ROW IS MADE IN THIS FORM, so it is always in the shape he recorded it in. A row chosen under Row, or tapped
         on Orders > Ledger, or an owed card on Needs you, fills the form; Record the change sends what differs as one Correction and what was handed over
         or paid since as one Fulfilment, the two kinds Correct a row sent; Cancel this sale and Reopen are its own rows; History and Undo sit under it.
         A customer's site order still changes through its order (restate), as Correct a row's did. Nothing here prices or books: the drafter does. */
      var tradeEditing=null, editAfter=null, editPick=actOn(el('select'),'record.trade.edit'), editHolder=el('div','maker-edit');
      tradeSection.appendChild(editHolder); makerRow(editHolder,'Row',editPick); tradeSection.insertBefore(editHolder,direction.closest('.amb-field')||direction);
      var editMore=el('div','maker-edit-more'), editHist=el('div','maker-fields maker-edit-hist');
      tradeSection.appendChild(editMore); tradeSection.appendChild(editHist);
      function editRows(){
        return (catalog.rows||[]).concat((catalog.revivable||[]).map(function(r){ return Object.assign({cancelledRow:true},r); }))
          .slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||''))||String(b.rid).localeCompare(String(a.rid)); });
      }
      function fillEditPick(){
        var kept=tradeEditing?tradeEditing.rid:'';
        editPick.textContent=''; var none=el('option',null,'New'); none.value=''; editPick.appendChild(none);
        editRows().forEach(function(r){ var o=el('option',null,r.rid+' · '+r.party+' · '+(fmtWhen(r.date)||'undated')+(r.cancelledRow?' · cancelled':r.defaulted?' · defaulted':'')); o.value=r.rid; editPick.appendChild(o); });
        editPick.value=Array.from(editPick.options).some(function(o){ return o.value===kept; })?kept:'';
      }
      function tradeControls(){ return [tradeProduct,tradeParty,tradeDate,tradeQty,tradeTotal,carriage,handover,tradeMoved,tradeCash,tradeStream,tradeAssoc,tradeDown]; }
      function editDraw(){
        var r=tradeEditing, word=r&&r.direction==='BUY'?'purchase':'sale';
        direction.hidden=!r; newSaleNote.hidden=!!r;
        if(!r&&direction.value!=='purchase'){ direction.value='purchase'; fillTradeChoices(); }
        direction.disabled=!!r; tripList.hidden=!!r; tripNote.hidden=!!r;
        coverChoices.forEach(function(c){ var row=c.check.closest('.maker-cover-row'); if(row) row.hidden=!!r; });
        tradeControls().forEach(function(c){ c.disabled=!!(r&&r.cancelledRow); });
        if(r&&r.defaulted){ tradeMoved.disabled=true; tradeCash.disabled=true; }   /* a defaulted row takes a correction only, as Correct a row offered */
        tradeSend.textContent=!r?'Record the '+direction.value:r.cancelledRow?'Reopen this '+word:'Record the change';
        editMore.textContent=''; editHist.textContent='';
        if(!r) return;
        if(r.cancelledRow){
          if(r.paid>0.009||r.movedUnits>0.009) editMore.appendChild(el('p','amb-field__hint','Cancelled after money or goods moved, so it cannot be reopened.'));
          return;
        }
        asRow(makerButton(tradeSection,['Other fields','record.trade.other'],function(){
          if(amendPick&&amendPick(r.rid,'Correction')) openForm('correct-a-row');
        },false),'Other fields',editMore);
        if(r.cancellation) asRow(makerButton(tradeSection,['Cancel this '+word,'record.trade.cancel'],async function(send){
          var c=r.cancellation;
          if(!await ownerAsk(send.button,'cancel:'+r.rid,{title:'Cancel '+r.rid+'?', say:['After: '+c.pay+', '+c.deliv+', '+c.order+'.'].concat(c.refundRM!=null?[rm(c.refundRM)+' already paid becomes a refund you owe '+r.party+'.']:[]),
            go:'Cancel this '+word, keep:'Keep it'})) return;
          tradeAnswer.textContent='Sending.';
          await send('/all/maker/inputs/ledger-amend',{at:new Date().toISOString(),rid:r.rid,kind:'Cancellation',date:tripToday()});
          tradeAnswer.textContent='Sent. It is cancelled once you approve it.'; loadMaker();
        },false),'Cancel this '+word,editMore,true);
        if(r.direction!=='BUY') historyBlock(editHist,{rid:r.rid},'row:'+r.rid,null,'row:'+r.rid);
      }
      function editLoad(rid){
        var r=editRows().find(function(x){ return x.rid===rid; }); if(!r) return false;
        extraTrades.slice().forEach(function(x){ coverChoices.splice(coverChoices.indexOf(x.cover),1); x.row.remove(); }); extraTrades.length=0;
        var sale=r.direction==='SELL', r2=sale&&r.stream==='R2';
        tradeEditing=r; editAfter=null; direction.value=sale?'sale':'purchase'; fillTradeChoices(); fillEditPick();
        tradeProduct.value=r.product||'salt';
        tradeStream.value=sale?(r.stream||''):''; fillAttribution();
        if(sale&&r.stream) tradeAssoc.value=r.assoc||'';
        if(r2) tradeDown.value=r.downstream||'';
        tradeParty.value=r2?'':r.party; tradeDate.value=r.date||''; makerWheelSet(tradeQty,r.qty);
        tradeTotal.value=String(+(+r.total||0).toFixed(2)); tradePrice.mine(true);
        carriage.value=String(+(+(sale?r.delivery:r.freight)||0).toFixed(2)); handover.value=r.handover||'';
        makerWheelSet(tradeMoved,+(+r.movedUnits||0).toFixed(4)); tradeCash.value=String(+(+(r.cancelledRow?r.paid:r.cash)||0).toFixed(2));
        tradeAt=null; tradeSignature=''; tradeAnswer.textContent='';
        editDraw(); readTrade(); return true;
      }
      function editClear(){
        tradeEditing=null; editAfter=null; fillEditPick();
        tradeParty.value=''; tradeDate.value=''; makerWheelSet(tradeQty,1); tradeTotal.value=''; tradePrice.mine(false);
        carriage.value='0'; handover.value=''; makerWheelSet(tradeMoved,0); tradeCash.value='0'; tradeStream.value=''; fillAttribution();
        tradeAt=null; tradeSignature=''; tradeAnswer.textContent=''; editDraw(); readTrade();
      }
      editPick.addEventListener('change',function(){ if(editPick.value) editLoad(editPick.value); else editClear(); });
      tradeEditPick=function(rid){ return editLoad(rid); }; fillEditPick(); editDraw();
      async function submitEdit(send){
        var r=tradeEditing, sale=r.direction==='SELL', same=function(a,b){ return Math.abs((+a||0)-(+b||0))<0.005; };
        if(r.cancelledRow){
          if(r.paid>0.009||r.movedUnits>0.009) throw new Error('Cancelled after money or goods moved, so it cannot be reopened.');
          tradeAnswer.textContent='Sending.';
          await send('/all/maker/inputs/ledger-amend',{at:new Date().toISOString(),rid:r.rid,kind:'Correction',date:tripToday(),fields:{cancelled:false,cancelledOn:null}});
          tradeAnswer.textContent='Sent. It is back once you approve it.'; loadMaker(); return;
        }
        if(tradeTotal.value===''||!(Number(tradeTotal.value)>=0)) throw new Error('Enter the price.');
        var r2=sale&&tradeStream.value==='R2', f={};
        if(!r2&&!knownParty(tradeParty.value)) throw new Error('Choose who from the list.');
        if(sale&&tradeStream.value&&!tradeAssoc.value) throw new Error('Choose an associate first.');
        if(tradeProduct.value!==(r.product||'salt')) f.product=tradeProduct.value;
        if(!r2&&tradeParty.value!==r.party) f.party=tradeParty.value;
        if((tradeDate.value||null)!==(r.date||null)) f.date=tradeDate.value||null;
        if(!same(tradeQty.value,r.qty)) f.qty=Number(tradeQty.value);
        if(!same(tradeTotal.value,r.total)) f.total=Number(tradeTotal.value);
        if(!same(carriage.value,sale?r.delivery:r.freight)) f[sale?'delivery':'freight']=Number(carriage.value||0);
        if((handover.value||null)!==(r.handover||null)) f.handover=handover.value||null;
        if(sale){
          if((tradeStream.value||null)!==(r.stream||null)) f.stream=tradeStream.value||null;
          var assocNow=tradeStream.value?tradeAssoc.value:null, assocWas=r.stream?(r.assoc||null):null;
          if(assocNow!==assocWas) f.assoc=assocNow;
          if(r2&&(tradeDown.value||null)!==(r.downstream||null)) f.downstream=tradeDown.value||null;
        }
        /* what was handed over and paid since is a movement, the difference; less than the book holds is taken back with Undo, never typed down */
        var dCash=+(Number(tradeCash.value||0)-(+r.cash||0)).toFixed(2), dUnits=+(Number(tradeMoved.value||0)-(+r.movedUnits||0)).toFixed(4);
        if(dCash<-0.004||dUnits<-0.00005) throw new Error('That is less than the book holds. Take it back with Undo under History.');
        var moved=dCash>=0.005||dUnits>=0.00005;
        if(!Object.keys(f).length&&!moved) throw new Error('Nothing has changed.');
        tradeAnswer.textContent='Sending.';
        var said=[], at=Date.now();
        /* the movement waits as editAfter while the change goes, so a retry of the change sends it too (tradeAction.after) */
        editAfter=moved?{at:new Date(at+1).toISOString(),rid:r.rid,kind:'Fulfilment',date:tripToday(),cash:dCash,movedUnits:dUnits}:null;
        if(Object.keys(f).length){
          try{ await send('/all/maker/inputs/ledger-amend',{at:new Date(at).toISOString(),rid:r.rid,kind:'Correction',date:tripToday(),fields:f}); said.push('The change'); }
          catch(error){
            /* a customer's order: the Desk names it, and the change goes as the order's Amend, so the order and the row change together */
            var rs=error.detail&&error.detail.restate;
            if(!rs||!(/^[0-9]{14}-[a-z0-9]{1,8}$/).test(rs.order)) throw error;
            await refs('/all/maker/orders/'+encodeURIComponent(rs.order)+'/restate',{rid:mintRid(),qty:rs.qty,total:rs.total,delivery:rs.delivery});
            said.push('The change, as an amendment of their order,');
          }
        }
        if(editAfter){
          var b=editAfter; editAfter=null; await send('/all/maker/inputs/ledger-amend',b);
          said.push(said.length?'and what moved':'What moved');
        }
        tradeAnswer.textContent=said.join(' ')+(said.length>1?' wait':' waits')+' under Approve.'; loadMaker();
      }
      /* 26 Oct 2026 (Salt Admin Customers, P3; his yes to Ask A): Their % and Make partner left Record for the customer's own card on Customers */
      /* A6: the Desk's Make it the house board. Which sizes the board prints, never a price: the ask is the ladder's. */
      var houseSection=makerForm('pricing');
      houseSection.appendChild(el('h3','amb-section','Printed sizes'));
      houseSection.appendChild(el('p','msg','Choose the sizes on the printed price list. Prices do not change.'));
      var houseBooks=(catalog.products||[]).filter(function(item){ return catalog.houseBoards&&catalog.houseBoards[item.product]&&catalog.houseBoards[item.product].sizes.length>1; });
      if(!houseBooks.length){
        houseSection.appendChild(el('p','msg','No book has sizes to choose between.'));
      }else{
        var houseProduct=makerTilesIn(houseSection,['Book','record.house.book'],houseBooks.map(function(item){ return bookItem(item.product); })), houseBoxes=sGroup('Sizes to print','maker-sizes'), houseGrid=houseBoxes.list;
        /* 12 Oct 2026 (PHASE 4a): the sizes are a grid of the system's Option tiles, a size a tile, ticked while it is printed; the same ticks, acts and body as the list was */
        houseSection.appendChild(houseBoxes);
        var houseTicks=[];
        function fillHouse(){
          var board=catalog.houseBoards[houseProduct.value]; houseGrid.textContent=''; houseTicks=[];
          board.sizes.forEach(function(size){
            var trow=sSwitchRow(units(size),'record.house.size',size,board.hidden.every(function(h){ return Math.abs(h-size)>=0.009; })), tick=trow.sw;
            tick.value=String(size); houseGrid.appendChild(sLi(trow)); houseTicks.push(tick);
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
      tipSection.appendChild(el('h3','amb-section','Desk reminders'));
      tipSection.appendChild(el('p','msg','Hide a reminder for a while.'));
      tradeSection.parentNode.insertBefore(tipSection,tradeSection.nextSibling);
      var tips=catalog.tips||[];
      if(!tips.length){
        tipSection.appendChild(el('p','msg','The Desk is showing no reminder to hide.'));
      }else{
        var tipId=actOn(el('select'),'record.tip.tip');
        tips.forEach(function(tip){ var option=el('option',null,tip.title+(tip.hush===null?' (hidden for good)':tip.hush?' (hidden until '+fmtWhen(tip.hush)+')':'')); option.value=tip.id; tipId.appendChild(option); });
        makerRow(tipSection,'Reminder',tipId);   /* 27 Oct 2026: a row of a settings list */
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
      recordMenu(box,note,catalog);
    }catch(error){ refusal(note,error); note.dataset.retry='true';
      makerButton(box,['Try again','record.retry'],function(){ box.removeAttribute('data-read'); while(box.children.length) box.lastChild.remove(); loadMakerInputs(); }); }
    finally{ sweep(); }
  }
  /* v1377, ORDER AS THEM (his answer A of 02 Nov 2026): their own page, opened by the master as View as them opens it, with ordering live
     (stmt/page.js act): Prices, the basket and the order sheet as theirs, Place through his own route. The box of his own that stood here
     (a size, a way and a place) is gone. */
  function makerForAccount(account){ openAcct(account, true); }
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
      /* 2 Nov 2026: Approve's line says Reading only while Approve is the part in view; a hidden line is never left on it */
      if(rows&&partNow==='approve') rows.textContent='Reading.';
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
      nGot('review', error); apply=failNew('review', error)||!poll;
      if(!poll){
        drawMaker();if(status) refusal(status,error); if(rows) refusal(rows,error);
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
  /* 2 Nov 2026: the part an order is listed in: To do when it waits on him, else its stage's (Open for Agreed, Ready and Out or paid) */
  function ordPartFor(stage,waits){ return waits?'todo':ORD_PART_OF[stage]||'ended'; }
  /* 17 Oct 2026, HIS FLOW: an agreed order whose goods are all out, or that is paid in full, is Delivered or paid until it is both (the Desk's flowStage
     for a row of the book, the same rule) */
  function orderPartsOf(order){
    if(!ordOpen(order)&&order.test) return '';
    if(order.writtenOff) return 'orders.ended';   /* written off on the book: it ended there (17 Oct 2026) */
    var st=STAGE_OF[order.status]||'ended';
    if(st==='confirmed'||st==='ready'){
      var q=Number(order.qty)||0, out=q>0&&Number(order.moved||0)>=q-0.0005, paid=ordPaidAll(order), owed=ordDue(order);
      if(out||(owed<=0.004&&paid>0.004)) st='paid';
    }
    return 'orders.'+st;
  }
  /* PHASE 1c (11 Oct 2026): ORDERS ARE A LIST AND A DETAIL. #makerOrderList holds a row for each order of the part showing, the system's
     Inbox row: who by code, the mark and its units, the stage and what is asked of him, the figure and the age. A row opens that order's
     card in #makerReview, today's card with every control, request and guard as it was, drawn for the order opened and no other. From 860px
     the list stands beside the card; below it the card takes the list's place, with a way back. A row has no preview: that read is the
     card's. Leaving the place or the part closes the card. */
  var ordOpened=null, ordEntries={}, makerOpenOrders=[], ordFocus=null, ordMore={};
  function ordShown(st){ return ordMore[st]||50; }
  var ORD_STAGE={placed:['copper','Waiting on you','dot'], acknowledged:['brass','Agreed','tick'], ready:['verdigris','Ready','tick'], done:['mist','Done','ticks'], declined:['mist','Declined','cross'], cancelled:['mist','Cancelled','cross']};
  function stageChip(st){
    var c=chip(st[0],null); c.insertBefore(el('span','amb-chip__dot'),null); c.appendChild(document.createTextNode(st[1])); return c;
  }
  function ordInPart(e){ return e.parts.split(' ').indexOf('orders.'+partNow)>=0; }
  /* 25 Oct 2026 (canvas Salt Admin Orders, his yes to Asks F, G and I), redrawn 2 Nov 2026 on his second canvas (ordRowNodes below): a row says why it waits on him in
     copper (asked, says sent, send again, their yes), the book's typed tag and the code, the stage's move as a lit ghost and the figure, large. The row is still the
     one link that opens the order (its act, its aria-current); from 1080px the same parts stand as a plain table's columns, Code, Book, Way, Units, Waiting and Total. */
  function ordWayWord(o,st){
    if(o.status==='declined') return 'Declined';
    if(o.status==='cancelled') return 'Cancelled';
    var d=o.mode==='deliver', out=(+o.qty||0)>0&&(+o.moved||0)>=(+o.qty||0)-0.0005;
    if(st==='done') return d?'Delivered':'Collected';
    if(st==='paid'&&out) return 'Out';
    return d?'Deliver':o.mode==='collect'?(o.point?'Collect at '+o.point:'Collect'):'';
  }
  /* the stage's move, said on the lit ghost: the next step of the goods, or of the money once the goods are out */
  function ordMove(o){
    if(o.test) return '';
    var owed=ordDue(o), out=(+o.qty||0)>0&&(+o.moved||0)>=(+o.qty||0)-0.0005;
    if(o.status==='placed') return makerAccHeld(o)&&o.price.state==='offered'?'Withdraw':makerAccHeld(o)?'':makerAsked(o)?'Offer':'Agree';
    if(o.status!=='acknowledged'&&o.status!=='ready') return '';
    if(ordPays(o).length) return 'Received';
    if(!out) return o.status==='acknowledged'?'Ready':'Handed';
    return owed>0.004?'Message':'';
  }
  /* 2 Nov 2026 (his Orders canvas, his four answers of 31 Oct 2026): THE LIST IS THE SYSTEM'S SETTINGS LIST BELOW 1080px AND ONE PLAIN TABLE FROM IT. An order is a row: the
     book's typed tag (the first and a +N for an order of several books) and the code over what it is and how long, copper when it waits on him and ember when late, the
     total, and the stage's move as a lit ghost (the one filled pill lives in the open order alone). The row is still the one link that opens the order (its act, its
     data-key); the move still asks once and sends what it sent. A group is a head over ONE list: To do's Orders and each sheet, Open's Agreed, Ready and Out or paid, a
     month in Done and Ended. Only one drawing stands at a time (ordWide), so a control is never drawn twice. */
  var ORD_PART_OF={placed:'todo',confirmed:'open',ready:'open',paid:'open',done:'done',ended:'ended'};
  var ORD_HEAD={confirmed:'Agreed',ready:'Ready',paid:'Out or paid'};
  var ORD_WORD={todo:'To do',open:'Open',done:'Done',ended:'Ended'};
  var ORD_NONE={todo:'Nothing waits on you.',open:'No open orders.',done:'No done orders.',ended:'No ended orders.'};
  var ORD_MONTH=['January','February','March','April','May','June','July','August','September','October','November','December'];
  function ordWide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:1080px)').matches); }
  function bookWord(p){ var k=String(p||'').toLowerCase().replace(/[^a-z]/g,''); return k.charAt(0).toUpperCase()+k.slice(1); }
  /* the moment a done or ended order is filed under: its stage's own, else the day it was placed; a row of the book has its date */
  function ordStamp(e){
    var o=e.order;
    if(o){ var h=(o.history||[]).filter(function(x){ return x&&x.status===o.status&&x.at; }).pop(); return (h&&h.at)||o.at||''; }
    var g=e.row||e.trip||e.day; return (g&&g.date)||'';
  }
  function ordYM(s){
    s=String(s||'');
    if(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return [s.slice(0,4),+s.slice(5,7)];
    try{ var p=klBits(s); return p.year?[p.year,+p.month]:null; }catch(x){ return null; }
  }
  function ordMonth(e){
    var ym=ordYM(ordStamp(e)); if(!ym||!ORD_MONTH[ym[1]-1]) return '';
    var now=ordYM(new Date().toISOString());
    return ORD_MONTH[ym[1]-1]+(now&&now[0]!==ym[0]?' '+ym[0]:'');
  }
  function ordDay(e){
    var s=ordStamp(e); if(!s) return '';
    return (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)?fmtWhen(s):dayMon(s)).replace(/ [0-9]{4}$/,'');
  }
  function ordLateAge(party,owedRM){
    if(!(owedRM>0.004)||!party) return '';
    var m=owedOf({code:party});
    return m&&Date.parse(m.due)<Date.now()?ageOf(m.due):'';
  }
  /* what a row says, one place for both drawings: the books, the code, the way, the units, why it waits on him or what it still owes, how long, the total and the move */
  function ordFacts(e){
    var o=e.order, st=e.stage, f={tags:[], code:'', who:'', way:'', units:'', why:'', age:'', owed:0, late:'', total:0, move:'', placed:false};
    if(o){
      var held=makerAccHeld(o)&&o.price.state==='offered', sent=ordPays(o).reduce(function(s,p){ return s+(+p.amount||0); },0);
      f.tags=[o.product]; f.code=codeByUser(o.u); f.who=codeOfUser(o.u); f.way=ordWayWord(o,st); f.units=units(o.qty);
      f.why=o.test?'Practice':makerCashHeld[e.id]?'Cash held':held?'Offered, their yes':orderAsked(o)?'Asked a question':ordPays(o).length?'Says sent '+rmShort(sent):o.again&&o.again.length?'Send again':o.againOf?orderRef(o.againOf)+' again':st==='placed'&&o.history&&o.history[0]&&o.history[0].by==='desk'?'You placed':'';   /* v1377: one he placed on their page */
      f.placed=st==='placed'&&!f.why;
      f.total=(+o.total||0)+(+o.delivery||0); f.owed=Math.max(0,ordDue(o));
      /* 28 Oct 2026: cash held for the order shuts every control of its card, so the row offers no move beside it either */
      f.move=makerCashHeld[e.id]||makerCashStorageError?'':ordMove(o);
      f.age=st==='done'||st==='ended'?ordDay(e):ageOf(o.at);
    }else if(e.row){
      /* a row of the book: the buyer's code, its book and units, the Desk's figures. Its way is a word, never the row's id. */
      var r=e.row;
      f.tags=[r.product]; f.code=r.party; f.who=r.party; f.units=units(r.qty);
      f.way={confirmed:'Agreed',ready:'Ready',paid:'Out',done:'Handed over'}[st]||(r.cancelled?'Cancelled':r.writtenOff?'Written off':'Closed');
      f.why=r.waiting>0?'Waits under Approve':r.reward?REWARD_WORD[r.reward]:'';
      f.total=(+r.total||0)+(+r.delivery||0); f.owed=+r.owed||0;
      f.age=st==='done'||st==='ended'?ordDay(e):r.date?fmtWhen(r.date):'Undated';
    }else if(e.trip||e.day){
      /* an order of several books: the first tag and a +N, and what the order comes to */
      var g=e.trip||e.day;
      f.tags=g.lines.map(function(l){ return l.product; }); f.code=g.party; f.who=g.party; f.way=e.trip?'One order':'Same day'; f.why=e.trip?'':'Not one order';
      f.total=g.lines.reduce(function(s,l){ return s+(+l.total||0)+(+l.delivery||0); },0); f.owed=+g.owed||0;
      f.age=st==='done'||st==='ended'?ordDay(e):g.date?fmtWhen(g.date):'Undated';
    }else{ f.code=e.id; f.why='Waiting on you'; }
    if(st==='paid') f.late=ordLateAge(f.who||f.code,f.owed);
    var owes=st==='paid'&&f.owed>0.004?'owes '+rmShort(f.owed):'';
    /* the Waiting cell: why it waits on him in copper, else what is still owed (ember when late), else how long */
    f.cell=f.why||(f.placed?'Placed':owes||f.age); f.cellTone=f.why||f.placed?'copper':owes&&f.late?'ember':'';
    /* the second line of a phone row */
    var wu=f.way&&f.units?f.way+(/ |^Out$/.test(f.way)?' · ':' ')+f.units:f.way||f.units;
    f.sub=f.why?[f.why,f.age].filter(Boolean).join(' · ')
      :f.placed?['Placed',(f.way?f.way.toLowerCase()+' ':'')+f.units,f.age].filter(Boolean).join(' · ')
      :[wu,owes?(f.late?f.late+' late':owes):f.age].filter(Boolean).join(' · ');
    f.subTone=f.why||f.placed?'why':owes&&f.late?'late':'';
    f.aria=[f.code,f.tags.map(bookWord).join(', '),f.way,f.units,f.cell,rmShort(f.total)].filter(Boolean).join(', ');
    return f;
  }
  /* 16 Nov 2026, the move to Ambient (place G): AN ORDER IS AMBIENT'S ROW in one list, the same on a phone and wide (the queue is the first pane, the open order the second). The book's mark
     is the thumb (a trip's others a +N chip), the code the title, why it waits on him or what it owes and how long the second line (the late amount in the loss colour), the total at the
     trail and the stage's move as a small pill; the row's one control is still the link that opens the order (its act, its data-key), and a move still asks once and sends what it sent. */
  function ordTagNodes(f,into){
    if(f.tags.length>1) into.appendChild(el('span','amb-chip omore','+'+(f.tags.length-1)));
  }
  function ordMoveGhost(e,f){
    if(!f.move) return null;
    var g=aPill(f.move,'order.move',e.id,true,true);
    g.addEventListener('click', function(){ ordMoveTap(e,f.move); });
    if(ordAsk[e.id]||ordBusy[e.id]) g.hidden=true;
    return g;
  }
  /* 25 Oct 2026 (his yes to Ask D): a move that sends asks once on the row; its answer stands under the row, a line of the list */
  function ordAskNodes(e,o){
    var box=el('li','oask'); box.setAttribute('data-rowof',e.id); box.setAttribute('role','status');
    if(ordAsk[e.id]||ordBusy[e.id]){
      box.appendChild(el('p','oask__q',ordAskWords(o,ordAsk[e.id]||ordBusy[e.id])));
      var yes=aPill('Yes','order.move-yes',e.id,true), no=aPill('Not now','order.move-no',e.id,true,true);
      if(ordBusy[e.id]){ yes.disabled=true; no.disabled=true; yes.textContent='Sending'; }
      yes.addEventListener('click', function(){ ordMoveSend(e,ordAsk[e.id]); });
      no.addEventListener('click', function(){ delete ordAsk[e.id]; ordRowRedraw(e); });
      var acts=el('div','oact'); acts.appendChild(yes); acts.appendChild(no); box.appendChild(acts);
    }else box.appendChild(el('p','oask__q',ordNote[e.id]));
    return box;
  }
  /* a row's nodes: the row, and the ask or the answer when there is one, a line under it */
  function ordRowNodes(e){
    var f=ordFacts(e), o=e.order, row=el('li','amb-row ordcard'), out=[row];
    row.setAttribute('data-rowof',e.id);
    var open=el('a','amb-row__main ordrow'); open.setAttribute('href','#orders'); open.setAttribute('data-order',e.id); actOn(open,'order.open',e.id); open.setAttribute('aria-label',f.aria);
    if(f.tags[0]) open.appendChild(markThumb(f.tags[0],'md'));
    var tx=el('span','amb-row__text'), ti=el('span','amb-row__title'), sub=el('span','amb-row__sub'+(f.subTone==='late'?' amb-neg':f.subTone==='why'?' ordwhy':''),f.sub);
    ti.appendChild(whoTag(el('span','ocode',f.code),f.who)); ordTagNodes(f,ti); tx.appendChild(ti); tx.appendChild(sub); open.appendChild(tx);
    row.appendChild(open);
    var tr=el('span','amb-row__trail'); tr.appendChild(el('span','amb-row__amount',rmShort(f.total)));
    var g=ordMoveGhost(e,f); if(g) tr.appendChild(g);
    row.appendChild(tr);
    if(ordOpened===e.id){ open.setAttribute('aria-current','true'); row.setAttribute('aria-current','true'); }
    open.addEventListener('click', function(ev){ ev.preventDefault(); openOrder(e.id); });
    if(o&&(ordAsk[e.id]||ordBusy[e.id]||ordNote[e.id])){ out.push(ordAskNodes(e,o)); }
    return out;
  }
  var ordAsk={}, ordBusy={}, ordNote={};
  function ordRowRedraw(e){
    var list=document.getElementById('makerOrderList'), olds=list?[].slice.call(list.querySelectorAll('[data-rowof="'+e.id+'"]')):[];
    if(!olds.length) return;
    var had=olds.some(function(x){ return x.contains(document.activeElement); }), at=olds[0], nodes=ordRowNodes(e);
    nodes.forEach(function(n){ at.parentNode.insertBefore(n,at); }); olds.forEach(function(x){ x.remove(); }); sweep();
    /* 28 Oct 2026: Yes while it asks, else the row's own move or the row, so focus is never dropped to the page after Not now or an answer */
    var n0=nodes[0], f=nodes.map(function(n){ return n.querySelector('[data-act="order.move-yes"]:not([disabled])'); }).filter(Boolean)[0]||(had?n0.querySelector('[data-act="order.move"]:not([hidden])')||n0.querySelector('.ordrow'):null); if(f&&f.focus) f.focus();
  }
  /* the groups of one part: To do's Orders and each sheet, Open's three stages, a month in Done and Ended (a sheet's orders, two or more at one stage, stand under their own head) */
  function ordGroups(part,pe){
    var out=[], idx={}, sheets={};
    function putGroup(key,head,e,sheet){ var g=idx[key]; if(!g){ g=idx[key]={key:key, head:head, rows:[], sheet:!!sheet}; out.push(g); } g.rows.push(e); }
    if(part==='todo'||part==='open') pe.forEach(function(e){ var o=e.order; if(o&&o.sheet) (sheets[o.u+'|'+o.sheet+'|'+e.stage]=sheets[o.u+'|'+o.sheet+'|'+e.stage]||[]).push(e); });
    pe.forEach(function(e){
      var o=e.order, sk=o&&o.sheet?o.u+'|'+o.sheet+'|'+e.stage:'';
      if(sk&&sheets[sk]&&sheets[sk].length>1){
        var os=sheets[sk].map(function(x){ return x.order; }).sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); }), first=os[0];
        putGroup('sheet:'+sk,'Sheet '+orderRef(first.id)+' · '+(first.mode==='deliver'?rmShort(+first.delivery||0)+' delivery':rmShort(os.reduce(function(s,x){ return s+(+x.total||0); },0))+' goods')+(part==='open'?' · '+ORD_HEAD[e.stage]:''),e,true);
      }else if(part==='todo') putGroup('orders','Orders',e);
      else if(part==='open') putGroup('stage:'+e.stage,ORD_HEAD[e.stage]||'Open',e);
      else{ var mo=ordMonth(e); putGroup('m:'+mo,mo||'Undated',e); }
    });
    out.forEach(function(g){ if(g.sheet) g.rows.sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); }); });
    var rank=function(g){ return g.sheet?9:part==='open'?['confirmed','ready','paid'].indexOf(g.key.slice(6)):0; };
    return out.map(function(g,i){ return [rank(g),i,g]; }).sort(function(a,b){ return a[0]-b[0]||a[1]-b[1]; }).map(function(x){ return x[2]; });
  }
  function ordListGroup(part,g){
    var sec=el('section','agroup'), ul=el('ul','amb-list amb-list--ruled');
    sec.setAttribute('data-in','orders.'+part); sec.setAttribute('aria-label',g.head);
    if(g.sheet) sec.setAttribute('data-sheet',g.rows[0].order.sheet);
    g.rows.forEach(function(e){ ordRowNodes(e).forEach(function(n){ ul.appendChild(n); }); });
    sec.appendChild(el('h2','amb-section',g.head)); sec.appendChild(ul); return sec;
  }
  /* what each move asks, in the words the order card and Needs you use */
  function ordAskWords(o,main){
    var who=codeByUser(o.u), pp=ordPays(o)[0];
    /* 28 Oct 2026: a part handed over asks for what is left */
    if(main==='Withdraw'){ var f=(o.price&&o.price.offer)||{}; return 'Take back your offer of '+rm((+f.total||0)+(+f.delivery||0))+' to '+who+'?'; }
    if(main==='Ready') return 'Mark '+who+"'s order ready to deliver?";
    if(main==='Handed'){ var left=+((+o.qty||0)-(+o.moved||0)).toFixed(3); return (left<(+o.qty||0)-0.0004?'Hand over the last '+units(left):'Hand over '+units(o.qty))+' to '+who+'?'; }
    if(main==='Received') return 'Confirm '+rm(pp?pp.amount:0)+' received from '+who+'?';
    return '';
  }
  function ordMoveTap(e,main){
    var o=e.order; delete ordNote[e.id];
    if(!o){ openOrder(e.id); return; }
    /* 2 Nov 2026: the box stands in view on the card, so Message opens the order at it */
    if(main==='Message'){ openOrder(e.id); ordFocus={id:e.id, at:'[data-act="order.reply-text"]'}; focusOrderAt(); if(!reviewReading) ordFocus=null; return; }
    /* Agree reads its figures on the card; a collection is made ready at one of his points, chosen on the card's Sheet; two payments are read on the card */
    /* 28 Oct 2026 (Fable): a claim past what is owed is Already recorded, which books nothing; it is answered on the card, its Sheet saying so beside Not found */
    if(main==='Agree'||main==='Offer'||(main==='Ready'&&o.mode!=='deliver')||(main==='Received'&&(ordPays(o).length!==1||payOnBook(o,ordPays(o)[0])))){ openOrder(e.id); return; }
    ordAsk[e.id]=main; ordRowRedraw(e);
  }
  function ordMoveSend(e,main){
    var o=e.order; if(!o||!main||ordBusy[e.id]) return;
    /* Fable's re-check, 28 Oct 2026: a read since the ask may have left the claim past what is owed; that is the card's to answer, never the row's */
    if(main==='Received'&&(ordPays(o).length!==1||payOnBook(o,ordPays(o)[0]))){ delete ordAsk[e.id]; openOrder(e.id); return; }
    delete ordAsk[e.id]; ordBusy[e.id]=main; ordRowRedraw(e);
    var done=main==='Withdraw'?makerTap(o,'withdraw',{},makerWithdrawSaid(o))
      :main==='Ready'?makerMove(o,{status:'ready',mode:'deliver'},'Order marked ready to deliver.')
      :main==='Handed'?makerTap(o,'handed',{qty:Number(o.qty)},'Handover sent to the Desk.')
      :main==='Received'?orderReceived(o,ordPays(o)[0]):Promise.resolve(false);
    Promise.resolve(done).then(function(ok){
      delete ordBusy[e.id];
      /* 28 Oct 2026: Ready's answer is read as every move's: a refusal or a busy page was said as "Marked ready" */
      ordNote[e.id]=ok===false?(makerSaid[o.id]||'Not sent. Try again.'):ok===undefined?'Busy, try again.':({Withdraw:'Offer withdrawn.',Ready:'Marked ready to deliver.',Handed:'Handover sent to the Desk.',Received:'Sent to the Desk.'})[main];
      var now=ordEntries[e.id]; if(now&&document.querySelector('#makerOrderList [data-order="'+e.id+'"]')) ordRowRedraw(now);
    });
  }
  /* 18 Oct 2026: the line over the list counts the stage in view, every card it holds (a book row and an order of several books too), never
     the site's open orders across every stage, which read "2 open orders" over one card */
  /* 25 Oct 2026 (canvas Salt Admin Orders, Ask H): THE LINE IS THE STAGE'S MONEY FIRST, one Insight: on Placed what waits on his Agree and what is offered
     and waits on their yes; on the open stages what is still owed and what they say they sent; on Done what was settled; on Ended how many ended and how.
     A stage with nothing in it says nothing here, its list's own line saying so. */
  function ordLead(st,list){
    var n=list.length, plural=function(k,w){ return k+' '+w+(k===1?'':'s'); }, sum=function(a,f){ return a.reduce(function(s,e){ return s+(f(e)||0); },0); };
    var due=function(e){ var o=e.order, r=e.row, g=e.trip||e.day; return o?(+o.total||0)+(+o.delivery||0):r?(+r.total||0)+(+r.delivery||0):g?+g.owed||0:0; };
    var owed=function(e){ var o=e.order, r=e.row, g=e.trip||e.day; return o?Math.max(0,ordDue(o)):r?+r.owed||0:g?+g.owed||0:0; };
    /* 2 Nov 2026 (his Orders canvas): To do is every order that waits on him, one sentence, money first: what waits on his Agree or Received, and what rides on their yes */
    if(st==='todo'){
      var held=list.filter(function(e){ return e.order&&makerAccHeld(e.order)&&e.order.price.state==='offered'; });
      var mine=sum(list,function(e){ var o=e.order; if(!o||held.indexOf(e)>=0) return 0; return o.status==='placed'?due(e):ordPays(o).reduce(function(s,p){ return s+(+p.amount||0); },0); });
      var theirs=sum(held,function(e){ var f=e.order.price.offer||{}; return (+f.total||0)+(+f.delivery||0); });
      /* 3 Nov 2026: with both sums the count goes, so the line fits one line at 390 (no text wraps on Salt Admin) */
      return (mine>0.004?rmShort(mine)+' waits on you'+(theirs>0.004?'':' across '+plural(n,'order')):plural(n,'order')+(n===1?' waits':' wait')+' on you')+(theirs>0.004?', '+rmShort(theirs)+' more on their yes':'')+'.';
    }
    if(st==='done') return rmShort(sum(list,due))+' settled on '+plural(n,'done order')+' shown, the newest first.';
    if(st==='ended'){
      /* 2 Nov 2026: every order is counted into a word (the line said "50 ended: 5 declined, 19 cancelled" and left 26 unsaid): a cancelled or written-off
         book row counts as the order does, and what is left ended on the book */
      var dec=list.filter(function(e){ return e.order&&e.order.status==='declined'&&!e.order.writtenOff; }).length;
      var wo=list.filter(function(e){ return (e.order&&e.order.writtenOff)||(e.row&&e.row.writtenOff); }).length;
      var can=list.filter(function(e){ return (e.order&&e.order.status==='cancelled'&&!e.order.writtenOff)||(e.row&&e.row.cancelled&&!e.row.writtenOff); }).length;
      var rest=n-dec-wo-can;
      return plural(n,'ended order')+' shown'+(n?': '+[dec?dec+' declined':'',can?can+' cancelled':'',wo?wo+' written off':'',rest?rest+' closed on the book':''].filter(Boolean).join(', '):'')+'.';
    }
    /* Open: what is still owed on the orders in it, and how much of that is late (the buyer's account past its term) */
    var lateRM=sum(list,function(e){ return e.stage==='paid'&&ordLateAge(codeOfParty(e),owed(e))?owed(e):0; });
    return rmShort(sum(list,owed))+' owed on '+plural(n,'open order')+(lateRM>0.004?', '+rmShort(lateRM)+' of it late':'')+'.';
  }
  function codeOfParty(e){ var o=e.order, g=e.row||e.trip||e.day; return o?codeOfUser(o.u)||codeByUser(o.u):g?g.party:''; }
  function paintOrdStatus(){
    var status=document.getElementById('makerReviewStatus'); if(!status) return;
    var list=Object.keys(ordEntries).map(function(k){ return ordEntries[k]; }).filter(function(e){ return e.parts==='orders.'+partNow; });
    status.hidden=!list.length;
    status.textContent=list.length?ordLead(partNow,list):'';
  }
  /* 2 Nov 2026: the count on To do is the orders that wait on him, and the one beside Payments they sent the payments they say they sent; a practice order is not counted, as the rail does not */
  /* 16 Nov 2026 (Ambient, place G): EACH OF THE FOUR STAGES SAYS HOW MANY ORDERS IT HOLDS, and one with none is dimmed as Ambient says it (aria-disabled, its count 0), the one in use never, so it stays
     read. A closed stage shows its true count when the list is cut at fifty (ordClosedAll). Nothing is drawn until the orders are read. */
  var ordCountN=null;
  function ordSegPaint(){
    [].forEach.call(document.querySelectorAll('.aparts[data-place="orders"] [data-part]'),function(b){
      var k=b.getAttribute('data-part'), c=b.querySelector('.amb-segment__count'), v=ordCountN?ordCountN[k]||0:0;
      if(c){ c.textContent=ordCountN?String(v):''; c.hidden=!ordCountN; }
      if(ordCountN&&!v&&b.getAttribute('aria-pressed')!=='true') b.setAttribute('aria-disabled','true'); else b.removeAttribute('aria-disabled');
    });
  }
  function paintOrdCounts(){
    var n={todo:0,open:0,done:0,ended:0};
    Object.keys(ordEntries).forEach(function(k){
      var e=ordEntries[k]; if(e.order&&e.order.test) return;
      var st=String(e.parts||'').replace('orders.',''); if(Object.prototype.hasOwnProperty.call(n,st)) n[st]++;
    });
    ['done','ended'].forEach(function(st){ if(n[st]>=ordShown(st)&&(ordClosedAll[st]||0)>n[st]) n[st]=ordClosedAll[st]; });
    ordCountN=n; ordSegPaint();
  }
  /* 3 Nov 2026 (his word: CN3-WM's book row and trip stood in Open and were never counted): THE ORDERS COUNT IS EVERY OPEN ORDER THE LIST HOLDS, a site order
     still open and, since 17 Oct 2026, a row of the book, an order of several books or a buyer's same day not done or ended (the Desk's flowStage), as
     drawOrderList files them. Painted by drawCounts, which every read of the orders runs after the list; a practice order is not counted. */
  function ordOpenCount(){
    var m=makerData||{}, live=function(g){ return !!g&&g.stage!=='done'&&g.stage!=='ended'; };
    return (m.orders||[]).filter(function(o){ return !o.test&&ordOpen(o); }).length+[].concat(m.rows||[],m.trips||[],m.sameDay||[]).filter(live).length;
  }
  function markOrderRows(){
    [].forEach.call(document.querySelectorAll('#makerOrderList [data-order], #makerOrderList [data-rowof]'), function(r){
      if((r.getAttribute('data-order')||r.getAttribute('data-rowof'))===ordOpened&&!r.classList.contains('oask')) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
  }
  /* the card of the order opened, drawn from the read that stands; it closes when its order has left the part showing (the answer to a tap
     that moved it is then on the list's line, as a card that had gone always left it) */
  function drawOrderPane(){
    var root=document.getElementById('makerReview'), split=document.getElementById('oSplit');
    if(!root) return;
    root.textContent=''; dirty.makerReview=false;
    var e=ordOpened&&placeNow==='orders'&&ordEntries[ordOpened];
    if(e&&!ordInPart(e)) e=null;
    /* 16 Nov 2026 (Ambient, place G): the second pane says Choose an order until one is opened; nothing opens by itself */
    if(!e) ordOpened=null;
    if(split) split.classList.toggle('open', !!e);
    var none=document.getElementById('ordnone'); if(none) none.hidden=!!e;
    markOrderRows();
    if(!e) return;
    root.appendChild(ordBack('orders','All orders','order.back'));
    /* 20 Oct 2026 (canvas V35): no back link; the rail or the app bar's Orders is the way back, a tap on it closing the order. 16 Nov 2026: below 960px the order takes the list's place and has a way back too */
    if(e.order&&ordOpen(e.order)) orderCard(root,e.order,{parts:e.parts}); else if(e.row) rowCard(root,e); else if(e.trip) tripCard(root,e); else if(e.day) dayCard(root,e); else orderPlainCard(root,e);
    focusOrderAt();
  }
  /* the way back from an open record below 960px, where it takes the list's place: one pill named for where it goes (the panes stand side by side from 960px, and the pill is hidden there) */
  function ordBack(way,label,act){
    var b=aBtn('','amb-pill amb-pill--quiet amb-pill--sm aback',act); b.setAttribute('data-back',way);
    b.appendChild(ambIcon('back','amb-icon--sm')); b.appendChild(document.createTextNode(' '+label)); b.setAttribute('aria-label',label); return b;
  }
  /* where the list stands beside the order: the shell's two panes, from 960px */
  function ordPanes(){ return !!(window.matchMedia&&window.matchMedia('(min-width:960px)').matches); }
  function openOrder(id){
    var e=ordEntries[id];
    if(!e||placeNow!=='orders'||!ordInPart(e)) return;
    /* an order opened reads its figures afresh: the card draws from no earlier quote */
    [id,id+':again'].forEach(function(k){ delete makerQuotes[k]; delete makerPv[k]; });
    ordOpened=id; drawOrderPane(); sweep();
    /* below 860px the card takes the list's place and has its way back showing, so he is taken to the top of it; from 860px the list is the
       page's scroll and the card stands beside it, sticky, so a tap on a low row leaves the page where it is and only brings the card into view */
    try{
      var card=document.getElementById('makerReview');
      if(card){ if(!card.hasAttribute('tabindex')) card.setAttribute('tabindex','-1'); if(card.focus) card.focus({preventScroll:true}); }
      if(!ordPanes()) pageTop();
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
    /* a Their % row says its figure, its book the typed tag (no book is named in words on Salt Admin) */
    var ts=tierSets(item);
    return askRow((rid?rid+' · ':'')+(draftParty(item)||'no code'), item.amends||noFigure(item)?'':rm(item.total), [moveWord(item), item.amends||item.qty==null?'':units(item.qty)].concat(ts.map(function(s){ return (ts.length>1?s.code+' ':'')+tierWord(s.v); })).filter(Boolean).join(', '),ts.length===1?bookTile(ts[0].product):item.product&&item.qty!=null&&!item.amends?bookTile(item.product,item.qty):null);
  }
  function deskAskRows(draft){ return groupOf(draft).drafts.map(deskAskRow); }
  /* a row's Approve and Reject, and a trip's: Approve, or Approve both for two books and Approve all for more */
  function approveWord(n){ return n?(n===2?'Approve both':'Approve all'):'Approve'; }
  function rejectWord(n){ return n?(n===2?'Reject both':'Reject all'):'Reject'; }
  /* 2 Nov 2026: the list is drawn from the entries alone, so a change across 1080px draws it again without touching the open card or what is typed in it */
  var ordClosedAll={}, ordTripsError='';
  function drawOrderList(list,entries){
    list.textContent='';
    /* 2 Nov 2026 (his Orders canvas): each part draws its groups; a part with nothing in it says so in one line. 16 Nov 2026 (Ambient, place G): a group is a head over Ambient's rows, the same at every width */
    ['todo','open','done','ended'].forEach(function(part){
      var pe=entries.filter(function(e){ return e.parts==='orders.'+part; }), gs=ordGroups(part,pe);
      if(!gs.length){ var none=el('p','amb-empty',ORD_NONE[part]); none.setAttribute('data-in','orders.'+part); list.appendChild(none); }
      else gs.forEach(function(g){ list.appendChild(ordListGroup(part,g)); });
    });
    /* a done or ended part lists the orders with nothing asked of him (fifty at most) and every one that waits on him, which is never dropped; the note
       counts what the list shows against every order of the stage */
    ['done','ended'].forEach(function(st){
      var shownN=entries.filter(function(e){ return e.stage===st; }).length;
      if(shownN<(ordClosedAll[st]||0)){
        var more=el('p','amb-field__hint',shownN+' of '+ordClosedAll[st]+' closed orders are shown.'); more.setAttribute('data-in','orders.'+st); list.appendChild(more);
        /* 17 Oct 2026: Completed is paged, fifty more a tap */
        var next=el('button','amb-pill amb-pill--quiet amb-pill--sm','Show 50 more'); next.type='button'; next.setAttribute('data-in','orders.'+st); actOn(next,'orders.more',st);
        next.addEventListener('click',function(){ ordMore[st]=ordShown(st)+50; drawMaker(); }); list.appendChild(next);
      }
    });
    if(ordTripsError){ var te=el('p','amb-field__hint amb-neg',ordTripsError); te.setAttribute('data-in','orders.open orders.done orders.ended'); te.setAttribute('data-trips-error',''); list.appendChild(te); }
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
    /* 12 Nov 2026 (his Approve review): the list's head counts the cards he decides, so the lead no longer counts rows beside it; it keeps only Reading, a refusal or an answer, and is not drawn while empty */
    if(draftStatus) draftStatus.textContent='';
    /* a row for each order of its stage, a done or ended one (fifty a stage at most) as well; an order whose cash is held is marked Waiting on you
       with its Undo, whatever else it is, and a held cash with no order on the read is a row of its own, in Placed */
    var held=Object.keys(makerCashHeld), entries=[], known={}, settled={}, closedAll={};
    (makerData.orders||[]).forEach(function(o){
      known[o.id]=true;
      var parts=orderPartsOf(o);
      if(!parts) return;
      var waits=orderWaits(o)||held.indexOf(o.id)>=0, stage=parts.replace('orders.','');
      if(!ordOpen(o)){
        closedAll[stage]=(closedAll[stage]||0)+1;
        if(!waits&&(settled[stage]=(settled[stage]||0)+1)>ordShown(stage)) return;
      }
      /* 2 Nov 2026: cash held for an order marks it, but never moves it to To do, so the card it is held in (and its Undo) stays where it is for the ten seconds */
      entries.push({id:o.id, order:o, stage:stage, parts:'orders.'+ordPartFor(stage,orderWaits(o)), waits:waits});
    });
    /* 17 Oct 2026, HIS FLOW: every live row of the book with no live site order is an order here, at the stage the Desk read off its figures */
    /* 18 Oct 2026: an order of several books and a buyer's same-day rows are filed the same way, at the stage the Desk read off their lines */
    function bookEntry(id,key,g){
      var stage=g.stage==='done'||g.stage==='ended'||g.stage==='paid'?g.stage:'confirmed';
      if(stage==='done'||stage==='ended'){
        closedAll[stage]=(closedAll[stage]||0)+1;
        if((settled[stage]=(settled[stage]||0)+1)>ordShown(stage)) return;
      }
      var e={id:id, stage:stage, parts:'orders.'+ordPartFor(stage,false), waits:false}; e[key]=g; entries.push(e);
    }
    (makerData.rows||[]).forEach(function(r){ bookEntry('row:'+r.rid,'row',r); });
    held.filter(function(id){ return !known[id]; }).forEach(function(id){ entries.push({id:id, order:null, stage:'placed', parts:'orders.todo', waits:true}); });
    /* plan 3 (16 Oct 2026): an order of several books on the book is one card for all its lines; a buyer's same-day rows that could be one stand beside it */
    (makerData.trips||[]).forEach(function(t){ bookEntry('trip:'+t.trip,'trip',t); });
    (makerData.sameDay||[]).forEach(function(t){ bookEntry('day:'+t.rids.join('+'),'day',t); });
    ordEntries={}; entries.forEach(function(e){ ordEntries[e.id]=e; });
    if(status) paintOrdStatus();
    ordClosedAll=closedAll; ordTripsError=makerData.tripsError||'';
    drawOrderList(list,entries);
    paintOrdCounts();
    drawOrderPane();
    drawDeskRows(draftRoot,queueRoot,pendingRows);
    apBarDraw();
    sweep();
    /* the order's card beside Needs you follows a redraw of the orders (a cash held, a tap answered) */
    if(placeNow==='needs') drawNeedOpen(false);
  }
  /* an order's head, as every card of an order says it: who by code, what and for how much; its stage as a chip, the four money words, and its reference small */
  /* 18 Oct 2026 (his word: the customer's order card is the design): THE HEAD IS THE CUSTOMER'S. The book's tile with its size, the stage and who and when beside
     it, the goods' track (Placed, Confirmed, Ready, Collected or Delivered), then the money on its own lines, the classes the Counter's order screen draws (oHead,
     oSteps, oMoney in stmt/page.js), so the two read alike. Admin keeps what is his alone: the code, Owed, what they say they sent, and Handed while goods remain. */
  /* 19 Oct 2026 (his word): the track is the Counter's own, Batch A's marked steps (oSteps in stmt/page.js): a drawn mark a step, its moment under
     its name and Next on the step to come, so the two cards draw one chart and a change to it reaches both */
  /* 20 Oct 2026 (canvas V17, V29, V30): HIS FIVE STEPS, the Counter's marked steps with Paid fourth: Placed, Agreed, Ready, Paid, Delivered or
     Collected. The goods move along Placed to Delivered as the Counter's do (oSteps); Paid is done once nothing is owed, which may come before
     the goods go on an order paid first, and part paid it says how much of what, "RM 40/70". On his page only. */
  function ordSteps(order){
    /* 2 Nov 2026 (his Orders canvas, page 2): the Counter's own Steps (oStepsOf in stmt/page.js), his words */
    var ol=oStepsOf(order,{aria:'Where the goods are', goods:['Placed','Agreed','Ready',order.mode==='deliver'?'Delivered':'Collected'], paid:'Paid'},'Next');
    ol.classList.add('ordsteps');
    return ol;
  }
  /* 20 Oct 2026 (his answer, option a): THE ROAD DISTANCE under Delivery cost, never the cost itself (his figure): his base (the places vault's
     _base) to their sealed spot opened here, else their filed point, else their locality (said so), the one distance (engine/geo.mjs) times
     the Desk's road factor off the review read. Measured in this browser after the one unlock; nothing without both points. */
  var makerPlaced={};
  function ordKm(order){
    var f=makerData&&makerData.roadFactor, v=makerVault&&makerVault.places;
    if(order.mode!=='deliver'||!v||!(typeof f==='number'&&f>0)) return null;
    var base=v._base, ok=function(p){ return !!p&&typeof p.lat==='number'&&typeof p.lng==='number'&&isFinite(p.lat)&&isFinite(p.lng); };
    if(!ok(base)) return null;
    var code=codeOfUser(order.u), spot=order.pin&&makerSpotOpened[order.u+'/'+order.pin], loc=makerPlaced[code], pt=null, area=false;
    if(spot&&spot.src!=='unit'&&ok(spot)) pt=spot;
    else if(ok(v[code])) pt=v[code];
    else if(Array.isArray(loc)&&isFinite(loc[0])&&isFinite(loc[1])){ pt={lat:+loc[0],lng:+loc[1]}; area=true; }
    if(!pt) return null;
    return {km:haversineKm({lat:base.lat,lng:base.lng},{lat:pt.lat,lng:pt.lng})*f, area:area};
  }
  function kmPaint(node,order){
    var k=ordKm(order);
    node.textContent=!k?'':k.area?'Distance about '+Math.round(k.km)+' km, area':'Distance '+(Math.round(k.km*10)/10).toFixed(1)+' km';
  }
  function kmRepaint(){
    var os=(makerData&&makerData.orders)||[];
    [].forEach.call(document.querySelectorAll('[data-km]'),function(n){ var o=os.filter(function(x){ return x.id===n.getAttribute('data-km'); })[0]; if(o) kmPaint(n,o); });
  }
  /* 20 Oct 2026 (canvas V22, V27, his rule: a figure that does not add up has no line of its own): WHAT THE GOODS COST, under Goods, "Cost RM 36,
     incl. freight": the Desk's trade reading (the engine's latestCogs, the latest purchase's quote and trip freight over its units, through the
     hop the trade form reads) a unit, times the order's units. Read once an order, held by its id; nothing when the book has no cost, or the
     read fails. A GET, so it sends nothing. His page only: owner.js travels behind /all. */
  var billCosts={};
  function billCostWords(order){
    var c=billCosts[order.id], cost=c&&c.rate!=null&&isFinite(c.rate)?'cost '+rm(c.rate*(+order.qty||0))+', incl. freight':'';
    if(order.status==='placed') return 'At the list price'+(cost?' · '+cost:'');
    return cost?cost.charAt(0).toUpperCase()+cost.slice(1):'';
  }
  function billCost(order,node){
    node.textContent=billCostWords(order);
    if(billCosts[order.id]||!order.product||!(+order.qty>0)) return;
    billCosts[order.id]={rate:null, reading:true};
    /* Fable's review: an agreed order is costed at the lot of the day it was agreed (Kuala Lumpur), the day its row is booked on, as the
       engine costs a sale; a placed one at today's */
    var ask={direction:'sale',product:order.product,qty:+order.qty,total:+order.total||0}, ackAt=firstAt(order,'acknowledged');
    if(order.status!=='placed'&&ackAt){ try{ var kb=klBits(ackAt); ask.date=kb.year+'-'+('0'+kb.month).slice(-2)+'-'+('0'+kb.day).slice(-2); }catch(e){} }
    refs('/all/maker/trade-reading?'+Object.keys(ask).map(function(k){ return k+'='+encodeURIComponent(ask[k]); }).join('&')).then(function(j){
      var r=j&&j.reading&&j.reading.cogs&&j.reading.cogs.rate;
      billCosts[order.id]={rate:typeof r==='number'&&isFinite(r)?r:null};
    },function(){ billCosts[order.id]={rate:null}; }).then(function(){
      [].forEach.call(document.querySelectorAll('[data-cost="'+order.id+'"]'),function(n){ n.textContent=billCostWords(order); });
    });
  }
  /* Salt Admin A to C (20 Oct 2026), P3: HIS USUAL, the figure a customer reads (stmt/confirm.js confirmView: ten or more measured, the
     cron's figure under three hours old), and the minutes a placed order has waited. No clock on a practice order, one with a price or a
     group order, which the measure leaves out. */
  function confirmUsual(){
    var c=makerHours&&makerHours.confirm, at=c&&Date.parse(c.at);
    if(!c||!(at>0)||Date.now()-at>3*3600e3||!(c.n>=10)||!(c.mins>=15)) return null;
    return c.mins;
  }
  function clockOf(order){
    if(!order||order.status!=='placed'||order.test||order.price||order.pool) return null;
    var t=Date.parse(order.at); if(!(t>0)) return null;
    /* 20 Oct 2026 (his answer): in Counter hours, as the usual is measured, off the review's read; the wall clock only where none is measured */
    var w=typeof order.waitedOpen==='number'&&order.waitedOpen>=0?order.waitedOpen:Math.max(0,Math.floor((Date.now()-t)/60000)), u=confirmUsual();
    return {waited:w, usual:u, late:u!=null&&w>u};
  }
  /* 20 Oct 2026 (canvas V11): the minutes waited as the system's meter against his usual, ember past it; with no usual yet, an empty track */
  function orderClock(order){
    var k=clockOf(order); if(!k) return null;
    var box=el('div','oclock'+(k.late?' oclock--late':''));
    box.setAttribute('data-clock','');
    box.appendChild(meterRow('Waited in hours', k.waited+' min'+(k.usual!=null?', usually '+k.usual+' min':', no usual yet'), k.usual?Math.min(100,Math.round(k.waited/k.usual*100)):0));
    return box;
  }
  /* 20 Oct 2026 (canvas V51, V52): THE ASSOCIATE REWARD on an associate's salt order, his page only. Placed, the figures are the preview's
     (the Desk's previewAck reading); agreed and after, his reading by the order's ledgerKey (GET /all/maker/reward/<key>, behind Access and the
     bridge key), read once an order and held by its id. Whether this order takes them over the next reward, the meter of what is carried and
     what this order adds against the step, and what the unit comes to: its landed cost less what he gave under their own price since the last
     reward, never under nought. Nothing here prices, and a customer is told one word on their page, never a figure. Hidden on oil, candy and
     rice, on a practice order, and for anyone the Desk does not read as an associate. */
  var rwdReads={};
  function rewardOfOrder(order){
    if(order.status==='placed'){ var q=makerQuotes[order.id]; return q&&q.result&&q.result.reward||null; }
    return rwdReads[order.id]||null;
  }
  function rewardCard(card,order){
    if((order.product||'salt')!=='salt'||order.test||['declined','cancelled'].indexOf(order.status)>=0) return;
    var box=el('div','amb-stack orwdcard'); box.setAttribute('data-reward',order.id); card.appendChild(box);
    rewardPaint(box,order);
    if(order.status!=='placed'&&order.ledgerKey&&!rwdReads[order.id]){
      rwdReads[order.id]={reading:true};
      refs('/all/maker/reward/'+encodeURIComponent(order.ledgerKey)).then(function(j){ rwdReads[order.id]=j&&j.reading||{}; },function(){ rwdReads[order.id]={}; })
        .then(function(){ [].forEach.call(document.querySelectorAll('[data-reward="'+order.id+'"]'),function(n){ rewardPaint(n,order); }); });
    }
  }
  function rewardPaint(box,order){
    box.textContent='';
    var r=rewardOfOrder(order);
    /* R3 (plan version 6): a referee's order in their first week counts toward the associate who brought them in */
    if(r&&!r.reading&&!r.associate&&r.r3For&&r.r3For.counts){ box.hidden=false; acctHead(box,'Associate reward');
      box.appendChild(el('p','amb-field__hint orwdnote','Counts toward '+r.r3For.by+'’s reward once paid: their first week, to '+dayMon(r.r3For.last)+'.')); return; }
    if(!r||r.reading||!r.associate||r.error||!(r.step>0)){ box.hidden=true; return; }
    box.hidden=false;
    acctHead(box,'Associate reward');
    if(r.unit){ box.appendChild(el('p','amb-field__hint orwdnote',r.unit.delivered?'1 reward unit on this delivery, '+rm(r.unit.net)+' net.'
      :'1 reward unit raised: it goes with '+(+order.moved>=(+order.qty||0)-0.0004?'their next salt delivery':'this delivery')+', '+rm(r.unit.net)+' net.')); return; }
    var o=r.order||{margin:0,reaches:false,short:Math.max(0,r.step-r.progress)}, add=o.paid?0:(+o.margin||0);
    box.appendChild(o.reaches?chip('brass','Reaches a reward'):o.paid?chip('mist','Counted, paid'):chip('mist',rm(o.short)+' short'));
    box.appendChild(meterRow('Next reward', (order.ledgerKey?String(order.ledgerKey).split('|')[0]+' ':'')+rm(r.progress)+(add?' + '+rm(add):'')+' of '+r.times+' units’ cost', Math.round((r.progress+add)/r.step*100)));
    box.appendChild(el('p','amb-field__hint orwdnote','Margin past '+r.times+' units at landed cost ('+rm(r.step)+' at '+rm(r.rate)+' today). Once paid, 1 unit joins this order at cost, one delivery: '
      +rm(r.rate)+', less '+rm(r.given)+' given under their Median Price since the last reward, '+rm(r.net)+' net. Salt only.'));
  }
  /* 21 Oct 2026 (the loyalty plan's This customer card, canvas V55): ON A CUSTOMER'S SALT ORDER, his page only, read once an order by its ledgerKey
     (GET /all/maker/customer-reading/<key>, behind Access and the bridge key) and held by its id: their last six rates as a line, a unit now at their
     card, the highest, how often they order and when the next is due, the loyalty meter, and the suggested % with its two halves, the % on his tap
     and the unit's cost. Use it sends that % as tier-set, for review under Approve, as Their % does; nothing here prices. Hidden on oil, candy and
     rice, on a practice order, on a declined or cancelled one, and for an associate, a partner or a supplier. */
  var custReads={};
  function customerCard(card,order){
    if(order.test||(order.product||'salt')!=='salt'||!order.ledgerKey||['declined','cancelled'].indexOf(order.status)>=0) return;
    var box=el('div','amb-stack ocustcard'); box.setAttribute('data-customer',order.id); card.appendChild(box);
    customerPaint(box,order);
    if(!custReads[order.id]){
      custReads[order.id]={reading:true};
      refs('/all/maker/customer-reading/'+encodeURIComponent(order.ledgerKey)).then(function(j){ custReads[order.id]=j&&j.reading||{}; },function(){ custReads[order.id]={}; })
        .then(function(){ [].forEach.call(document.querySelectorAll('[data-customer="'+order.id+'"]'),function(n){ customerPaint(n,order); }); });
    }
  }
  function custPct(v){ var n=Math.round(Number(v)*100); return (n>0?'+':'')+n+'%'; }
  function customerPaint(box,order){
    box.textContent='';
    var r=custReads[order.id];
    if(!r||r.reading||!r.customer||r.error){ box.hidden=true; return; }
    box.hidden=false;
    acctHead(box,'This customer');
    if(r.rates&&r.rates.length>1){
      var lo=Math.min.apply(null,r.rates.map(function(x){ return x.rate; })), hi=Math.max.apply(null,r.rates.map(function(x){ return x.rate; })), span=hi-lo||1;
      var NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg'), tile=el('div','amb-tiles acust__tiles'), tl=el('div','amb-tile acust__tile');
      svg.setAttribute('viewBox','0 0 120 36'); svg.setAttribute('preserveAspectRatio','none'); svg.setAttribute('class','amb-tile__spark ocust__spark');
      svg.setAttribute('role','img'); svg.setAttribute('aria-label','Their price a unit, '+r.rates.map(function(x){ return rm(x.rate); }).join(', '));
      var pl=document.createElementNS(NS,'polyline');
      pl.setAttribute('points',r.rates.map(function(x,i){ return (i*120/(r.rates.length-1)).toFixed(1)+','+(32-(x.rate-lo)/span*28).toFixed(1); }).join(' '));
      svg.appendChild(pl);
      tl.appendChild(el('span','amb-tile__label','Last '+r.rates.length+' orders')); tl.appendChild(el('span','amb-tile__figure',rmShort(lo)+' to '+rmShort(hi))); tl.appendChild(svg); tile.appendChild(tl); box.appendChild(tile);
    }
    var y=r.loyal||{}, share=Math.max(0,Math.min(100,Math.round((+y.units||0)/(+y.every||20)*100)));
    var due=r.dueIn!=null?(r.dueIn>0?'Next order due in '+r.dueIn+(r.dueIn===1?' day':' days'):r.dueIn===0?'Next order due today':'Next order '+(-r.dueIn)+(r.dueIn===-1?' day':' days')+' past due'):'';
    box.appendChild(meterRow('Loyalty', (+y.units)+' of '+y.every+' units'+(due?', '+due:''), share));
    var L=aGroup(null,'ocust__figs');
    if(r.unitNow!=null) acctLine(L,'A unit now',rm(r.unitNow));
    if(r.highest!=null) acctLine(L,'Highest',rm(r.highest));
    if(r.cadence) acctLine(L,'Orders every',r.cadence.every+' days');
    box.appendChild(L);
    if(y.unit) box.appendChild(chip('verdigris',y.unit.delivered?'Loyalty unit on this delivery':'Loyalty unit raised, goes with this order'));
    else if(y.order&&y.order.reaches) box.appendChild(chip('brass','Brings the next unit'));
    if(y.paused) box.appendChild(chip('mist',y.why==='writeoff'?'Paused: a write-off':'Paused: a late payment'));
    box.appendChild(el('p','amb-field__hint ocust__note','1 unit at cost every '+y.every+' at or above their price'+(r.cost!=null?' ('+rm(r.cost)+' to you)':'')+'. They see '
      +share+'%. Paused by a late payment or a write-off.'));
    if(!r.suggest||!(Math.abs(r.suggest.pct-(+r.held||0))>1e-9)) return;
    var s=el('div','ocust__sug amb-stack');
    s.appendChild(el('h3','amb-section ocust__sughead','Suggested '+custPct(r.suggest.pct)+(r.suggest.why?', '+r.suggest.why:'')));
    if(r.gain&&r.pair) s.appendChild(el('p','amb-field__hint ocust__gain',custPct(r.suggest.pct)+': '+rm(r.gain.pct)+' more per 20 units · the loyalty unit '+rm(r.gain.unit)+' · net '+rm(r.gain.net)));
    var answer=el('p','amb-field__hint ocust__answer'); answer.setAttribute('role','status');
    var at=null;
    makerButton(s,['Use it','order.customer.use',order.id],async function(send){
      if(!at) at=new Date().toISOString();
      try{ await send('/all/maker/inputs/tier-set',{code:r.code,product:'salt',tier:Number((+r.suggest.pct).toFixed(2)),unit:'band',at:at}); answer.textContent='Sent. Their % changes once you approve it.'; delete custReads[order.id]; loadMaker(); }
      catch(error){ refusal(answer,error); }
    },false,function(){ at=null; });
    s.appendChild(answer);
    box.appendChild(s);
  }
  /* Salt Admin A to C, P1, and the band of 20 Oct 2026: how the goods go, in a glance */
  function ordWay(order){
    if(order.mode==='deliver') return (order.place||'Their place')+' · '
      +(order.slot&&order.slotSpan?String(order.slotSpan).replace('-',' to ')+' on '+fmtWhen(String(order.slot).slice(0,10)):'ASAP')
      +(+order.delivery>0?' · +'+rm(order.delivery)+' delivery':'');
    return order.point?'Collect at '+order.point:'Collection';
  }
  /* 20 Oct 2026 (canvas V11): the band's action chip, said by stage, and the moment of the stage it stands at, "10:14, 18 Oct" */
  function ordAction(order){
    var s=order.status, dl=order.mode==='deliver';
    if(order.writtenOff) return ['mist','Written off','cross'];
    if(s==='placed') return makerAccHeld(order)?['brass','Their yes','dot']:['copper','To agree','dot'];
    if(s==='acknowledged') return ['brass','To make ready','tick'];
    /* 2 Nov 2026: a ready order whose goods are all out is not "to hand over" (the list calls it Out and its steps say Collected) */
    if(s==='ready'&&(+order.qty||0)>0&&(+order.moved||0)>=(+order.qty||0)-0.0005) return ['verdigris',dl?'Delivered':'Collected','ticks'];
    if(s==='ready') return ['brass',dl?'To deliver':'To hand over','tick'];
    if(s==='done') return ['verdigris',dl?'Delivered':'Collected','ticks'];
    return ['mist',{declined:'Declined',cancelled:'Cancelled'}[s]||String(s||''),'cross'];
  }
  function ordMoment(order){
    if(order.status==='ready'&&order.movedOn&&(+order.qty||0)>0&&(+order.moved||0)>=(+order.qty||0)-0.0005) return (order.mode==='deliver'?'Delivered ':'Collected ')+ymdDay(order.movedOn);
    var h=(order.history||[]).filter(function(x){ return x&&x.status===order.status&&x.at; }).pop(), at=order.status==='placed'||!h?order.at:h.at;
    var w={placed:'Placed ',acknowledged:'Agreed ',ready:'Ready ',done:'Done ',declined:'Declined ',cancelled:'Cancelled '}[order.status]||'';
    if(!at) return w.trim();
    return w+hm(at)+', '+dayMon(at).replace(/ [0-9]{4}$/,'');
  }
  var BAND_PIN='M12 21 C12 21 5 14.6 5 9.6 A7 7 0 0 1 19 9.6 C19 14.6 12 21 12 21 Z M12 7.4 A2.2 2.2 0 1 0 12 11.8 A2.2 2.2 0 1 0 12 7.4',
      BAND_CLOCK='M12 3.5 A8.5 8.5 0 1 0 12 20.5 A8.5 8.5 0 1 0 12 3.5 M12 7.5 V12 L15 14';
  function orderHead(card,order){
    /* Salt Admin A to C (20 Oct 2026), P1: THE HEAD IS THE COUNTER'S BAND. 2 Nov 2026 (his Orders canvas, page 2, answer 4): it is the Counter's own band
       (oBandOf in stmt/page.js), on the 16px line: his state as a chip beside the short reference the customer sees, the moment and the way in one line (the
       way the link to the maps app while a collection waits at his point), and a foot of the book's typed tag, the buyer's code and the units; then, on a
       placed order, the meter of the minutes waited against his usual, and the sheet's link. The goods' total is the Bill's. */
    var act=ordAction(order), waits=order.point&&order.status==='ready'&&order.mode==='collect'&&(+order.moved||0)<(+order.qty||0)-0.0004, wayNode;
    if(waits&&order.pointAt&&isFinite(order.pointAt.lat)&&isFinite(order.pointAt.lng)){
      wayNode=el('a','oway oway--link',ordWay(order)); wayNode.href=pointHref(order.point,order.pointAt.lat,order.pointAt.lng);
      if(/^https:/.test(wayNode.getAttribute('href'))){ wayNode.target='_blank'; wayNode.rel='noopener'; }
      wayNode.setAttribute('aria-label','Point '+order.point+' in maps');
    }else wayNode=el('span','oway',ordWay(order));
    var who=whoTag(el('span','ogoods__who',codeByUser(order.u)),codeOfUser(order.u));
    var head=oBandOf(order,{aria:'The order', chip:stageChip(act), when:[el('span','omoment',ordMoment(order)),' · ',wayNode],
      foot:[mtile(order.product,order.qty), who]});
    head.classList.add('ohead'); if(order.status==='placed'&&!order.writtenOff) head.classList.add('ohead--placed');
    /* P6: placed again from an order of theirs, which the band names by its short reference */
    if(order.againOf){ var ag=el('p','obagain'); ag.setAttribute('data-again',''); ag.appendChild(chip('brass','Again')); ag.appendChild(el('span',null,orderRef(order.againOf)+' again')); head.appendChild(ag); }
    var clock=orderClock(order); if(clock) head.appendChild(clock);
    /* P5 (canvas V13, V19): an order of a sheet says which of it, a link to the sheet's group on Orders */
    var shOf=sheetOf(order);
    if(shOf.length>1){
      var sl=actOn(el('button','amb-pill amb-pill--sm amb-pill--quiet osheetlink'),'order.sheet',order.id); sl.type='button';
      sl.appendChild(el('span',null,'Sheet '+(shOf.indexOf(order)+1)+' of '+shOf.length)); sl.appendChild(ambIcon('next','amb-icon--sm'));
      sl.addEventListener('click',function(){ var sh=order.sheet; closeOrder();
        try{ var gr=document.querySelector('#makerOrderList [data-sheet="'+sh+'"]'); if(gr&&gr.scrollIntoView) gr.scrollIntoView({block:'nearest'}); }catch(e){} });
      head.appendChild(sl);
    }
    card.appendChild(head);
    if(!order.writtenOff&&order.status!=='declined'&&order.status!=='cancelled'){ var st=ordSteps(order); card.appendChild(st); }
    var bill=ordBill(order); card.appendChild(bill);
    rewardCard(card,order);   /* 20 Oct 2026: the associate reward, under the Bill */
    customerCard(card,order);   /* 21 Oct 2026: and This customer, the loyalty unit and the suggested %, for a customer */
    /* 17 Oct 2026: an ended order's last move is under Approve until he decides it, and the book keeps its row live until then */
    var waitN=((makerData&&makerData.drafts)||[]).filter(function(d){ return d.status==='pending'&&d.entry&&d.entry.orderId===order.id; }).length;
    if(waitN&&!ordOpen(order)) bill.appendChild(el('p','amb-field__hint obillnote',(waitN===1?'Its move waits':'Its '+waitN+' moves wait')+' under Approve: the book keeps the row as it was until you approve.'));
    /* 17 Oct 2026: a refund the book still owes them on this order's row */
    var owes=makerData&&makerData.refunds&&order.ledgerKey&&makerData.refunds[order.ledgerKey];
    if(+owes>0.004) bill.appendChild(el('p','amb-field__hint obillnote',rm(owes)+' refund here is their credit, spent at your next Accept or repaid by hand on the Desk.'));
  }
  /* 20 Oct 2026 (canvas V21, V23, V24, V27, V28): THE BILL, headed so: Goods (at the list price while placed), Delivery cost, the Total they owe (goods and
     delivery, the engine's txOwed), then what is paid and what is owed or settled. 2 Nov 2026 (his Orders canvas, page 2): the Counter's own Bill (oBillOf),
     a settings list, every figure at the right, the cost and the distance as a row's second line, what is owed in ember */
  function ordBill(order){
    var agreed=['acknowledged','ready','done'].indexOf(order.status)>=0, moved=Math.round((+order.moved||0)*100)/100, paid=+order.paid||0, owed=Math.max(0,ordDue(order)), R=[];
    var gsub=el('span','ocost'); gsub.setAttribute('data-cost',order.id); billCost(order,gsub);
    R.push({k:'Goods', v:rm(order.total), sub:gsub});
    if(agreed&&typeof order.asked==='number'&&Math.abs(order.asked-(+order.total||0))>0.004) R.push({k:'They placed it at', v:rm(order.asked), sub:'Set when you agreed it', at:['data-asked','']});
    if(order.mode==='deliver'&&(agreed||order.delivery)){
      var km=el('span','okm'); km.setAttribute('data-km',order.id); kmPaint(km,order);
      R.push({k:'Delivery cost', v:rm(order.delivery||0), sub:km});
    }
    R.push({k:'Total', v:rm((+order.total||0)+(+order.delivery||0)), total:true, cls:'abtotal', at:['data-total','']});
    /* Salt Admin A to C, P2: THE RECEIPT, as the customer's: each payment received with its way and its day where they add up to what is paid, else one line */
    var conf=(order.payments||[]).filter(function(x){ return x&&(!x.claim||x.claim==='received')&&+x.amount>0; }),
        csum=conf.reduce(function(s,x){ return s+(+x.amount); },0);
    if(paid>0&&conf.length&&Math.abs(csum-paid)<0.005) conf.forEach(function(x){ R.push({k:'Paid', v:rm(+x.amount), sub:(x.method?methodWord(x.method,x.account)+', ':'')+fmtWhen(x.at), at:['data-pay','']}); });
    else if(agreed||paid>0) R.push({k:'Paid', v:rm(paid)});
    /* 28 Oct 2026: their credit his Accept spent is paid too, on its own line, so Paid and Credit add up to what is settled */
    if(+order.credit>0.004) R.push({k:'Credit', v:rm(+order.credit), sub:'Their refunds, spent at your Agree', at:['data-credit','']});
    if(+order.claimed>0) R.push({k:'Says sent', v:rm(order.claimed), sub:'Waiting for your Received'});
    if(agreed&&owed>0.004) R.push({k:'Owed', v:rm(owed), due:true, vcls:'odue', cls:'obill--due'});
    else if(agreed||order.status==='done') R.push({k:'Settled', v:rm(0), vcls:'osettled'});
    if(agreed&&moved<(+order.qty||0)-0.0004) R.push({k:'Handed', v:moved+' of '+units(order.qty)});
    return oBillOf('Bill',R);
  }
  /* Salt Admin A to C: the orders one sheet of theirs placed together, in the order the Desk asks the delivery on (the first by id) */
  function sheetOf(order){
    if(!order||!order.sheet) return [order];
    return ((makerData&&makerData.orders)||[]).filter(function(o){ return o.u===order.u&&o.sheet===order.sheet; }).sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); });
  }
  /* the card of an open order: every control it had, on the order opened alone */
  function orderCard(root,order,opts){
    var open=makerOpenOrders, inline=!!(opts&&opts.inline);
    {
      /* 2 Nov 2026 (his Orders canvas, page 2, "The open order, both sides"; his answer 4 of 31 Oct and "accept all asks as recommended"): THE OPEN ORDER IS
         THE COUNTER'S CARD WITH HIS SIDE ADDED, on Shop's grid and in Shop's order, with no card around it: the state (the band and the Steps), what he reads
         (the four figures), what he sets as settings lists with its one filled pill, the record (the Bill, the messages), where next (This customer, the
         Order log), and what ends it, last, in ember, asking first. Every control keeps its act and sends what it sent. */
      /* 2 Nov 2026: on Orders the card is in the part its row is in (To do, Open, Done, Ended, the entry's parts), never the stage's name, which v1376's
         four parts no longer carry, so the order he opened was swept hidden */
      var card=makerCard(root,order.id,'ocard'), acts=el('div','maker-foot__acts'), cashed=false; card.setAttribute('data-in',(opts&&opts.parts)||orderPartsOf(order));
      orderHead(card,order);
      var dec=el('div','odecide'); card.insertBefore(dec,card.querySelector(':scope > .obill'));
      /* a part of his decision: its grey head, then what the stage draws into it */
      function part(name,cls){ var p=el('section','odecide__part amb-stack'+(cls?' '+cls:'')); if(name){ p.setAttribute('aria-label',name); p.appendChild(el('h2','amb-section',name)); } dec.appendChild(p); return p; }
      /* 10 Oct 2026: the delivery time they asked for, the part of its window inside the hours, while goods are still to go */
      if(order.mode==='deliver'&&order.slot&&order.slotSpan&&!((+order.moved||0)>=(+order.qty||0)-0.004))
        dec.appendChild(el('p','amb-field__hint maker-facts','Wanted '+String(order.slotSpan).replace('-',' to ')+' on '+fmtWhen(String(order.slot).slice(0,10))+'.'));
      /* Salt Admin A to C, P4: their exact spot, opened here after the one unlock; a practice order's is never filed, so it offers nothing */
      if(order.mode==='deliver'&&order.pin&&!order.test) makerSpotControl(dec,order);
      else if(order.mode==='deliver'&&order.pin) dec.appendChild(el('p','amb-field__hint maker-facts','A practice spot is never filed.'));
      /* the stage's one filled pill stands in lead, 16px under its group; the stage's other moves are rows under it */
      var againAck=makerAgainAck(order), quoteStart=null, lead=el('div','amb-foot ofoot ordlead'), stageRows=aGroup(null,'ostagerows'), stage=null;
      function stageOf(name,cls){ stage=part(name,cls); return stage; }
      /* 5 Nov 2026 (the pane): the stage's one pill is the card's foot, pinned at the foot of the open order, its other moves rows of the stage */
      function stageEnd(){ var p=stage||part(null); if(!lead.parentNode) card.appendChild(lead); p.appendChild(stageRows); }
      /* his decision of 06 Oct 2026: the size, the goods' price and the delivery charge stay amendable after Accept, one Correction for approval.
         16 Oct 2026 (plan 5, part 2): Change the order stands under the head, where the figures it changes are read, in place of below the money; it opens
         the same Sheet and sends the same restate (stage amend), so nothing about what it books moved */
      var change=null;
      if(!againAck&&(order.status==='acknowledged'||order.status==='ready')){
        change=aActBtn(stageRows,['Change','order.amend'],function(){ amendOpen(order,change); });
        change.setAttribute('data-amend',''); makerAskTag(order,change,'amend');
      }
      if(order.status==='placed'&&makerAccHeld(order)){
        var ap=order.price, apf=ap.offer||{};
        stageOf(ap.state==='taken'?'Their yes':'Waiting for them').appendChild(el('p','amb-field__hint maker-facts',(ap.state==='taken'?'They agreed to ':'Waiting for their yes to ')+rm(apf.total)
          +(order.mode==='deliver'&&typeof apf.delivery==='number'?' + '+rm(apf.delivery):'')+(apf.slot&&apf.slotSpan?', '+String(apf.slotSpan).replace('-',' to ')+' on '+mwDayLabel(String(apf.slot).slice(0,10)):'')
          +(ap.state==='taken'?'. The row waits under Approve.':', until '+fmtWhen(apf.until)+'.')));
        if(ap.state!=='taken') aActBtn(stageRows,['Take back the offer','order.withdraw-offer'],function(){ makerTap(order,'withdraw',{},makerWithdrawSaid(order)); }).setAttribute('data-withdraw','');
      }else if(order.status==='placed'){
        /* 22 Oct 2026 (canvas Needs you, his word): THE AGREE INPUTS TWO BY TWO, Goods and Delivery side by side, then When across both: the goods' price, the
           delivery charge (none chosen until he chooses) and the one choice of when, ASAP needing no day and each window carrying its own */
        /* 2 Nov 2026 (his canvas): the four figures under their head, then Agree as a settings list (Goods, Delivery, When) and its one pill */
        var figs=part('The figures','ofigsec');
        var quote=makerQuotes[order.id]||(makerPv[order.id]&&makerPv[order.id].payload)||{}, form=el('div','oagree amb-stack');
        var sheetOrders=((makerData&&makerData.orders)||[]).filter(function(o){ return order.sheet&&o.u===order.u&&o.sheet===order.sheet&&o.status!=='cancelled'&&o.status!=='declined'; });
        var wayAllowed=(!order.sheet||sheetOrders.length<2)&&!order.pool, termsMode=order.mode||'collect';
        /* 11 Nov 2026: their ask is said first and the goods start at their figure, so one tap offers what they asked; he may type another */
        var asked=makerAsked(order), askRM=asked&&typeof order.price.proposed==='number'&&order.price.proposed>0?order.price.proposed:null;
        var agreeSec=stageOf(asked?'Offer':'Change','oagreesec');
        if(asked){ var askLine=el('p','amb-field__hint maker-facts',(askRM!=null?'They asked for '+rm(askRM)+'. ':'They asked for a better price. ')+(+order.total>0?'The list price is '+rm(order.total)+'.':'It has no list price.'));
          askLine.setAttribute('data-ask',''); agreeSec.appendChild(askLine); }
        agreeSec.appendChild(form);
        var refillGoods=false;
        var total=makerField(form,['Goods, RM','order.total'],'number',quote.total==null?(askRM!=null?askRM:order.total):quote.total);
        var quantity=makerField(form,['Units','order.qty'],'number',order.qty);
        quantity.min='0.001'; quantity.max='1000'; quantity.step='any'; quantity.disabled=!!order.pool;
        var way=el('select'); actOn(way,'order.mode'); [['collect','Collect'],['deliver','Deliver']].forEach(function(opt){ var op=el('option','',opt[1]); op.value=opt[0]; way.appendChild(op); });
        way.value=termsMode; way.disabled=!wayAllowed; makerRow(form,'Way',way);
        /* 18 Oct 2026 (Salt Admin clarity, part 3): THE CARD LEADS WITH THE ANSWER. Agree is the filled pill at the top, the terms it will send written beside
           it in one line and kept in step with the choices; the price, the delivery charge and the time are folded under Change terms, shut until a tap.
           Until the figures are read the pill is a stand-in, never a send: it asks for the charge (and opens it) or says it is reading. */
        /* 2 Nov 2026 (his canvas): the one pill, Agree, alone under the list; Decline is the card's last row */
        var row3=lead;
        var tf={body:stage, open:true};
        /* a sheet of several placed orders asks for the delivery charge once, on its first order (the Desk's ordPvDelivery):
           the others hide the chips and send nought */
        /* plan version 3, part 3d: the charge rides the sheet's first delivered line still standing, agreed or not, so a later line never asks it again */
        /* Fable's review: read off every order (as the Desk's tripLines), not the open list, so a first line at Out or paid still carries it; and a
           first line agreed on another day is another day's trip, so this line asks its own charge */
        var group=((makerData&&makerData.orders)||[]).filter(function(o){ return order.sheet&&o.u===order.u&&o.sheet===order.sheet&&o.mode==='deliver'&&o.status!=='cancelled'&&o.status!=='declined'; }).sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); });
        var lead0=group[0], leadAck=lead0?(lead0.history||[]).filter(function(h){ return h&&h.status==='acknowledged'; }).slice(-1)[0]:null;
        var leadToday=!!lead0&&(lead0.status==='placed'||!!leadAck&&new Date(leadAck.at).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'})===tripToday());
        var follower=order.mode==='deliver'&&group.length>1&&group[0].id!==order.id&&leadToday;
        var deliver=order.mode==='deliver'&&!follower;
        var chip=makerFee[order.id]||(makerFee[order.id]={value:'',other:''});
        var otherField=null, previewTurn=0, sig=JSON.stringify(order), feeSel=null, feeWrap=null, whenWrap=null, winDraw=null;
        /* 12 Oct 2026 (his decision 6 of 11 Oct): THE CARD READS ITS OWN PREVIEW, once, when its order is opened, and again when an input is
           changed; the Preview button is retired. A row of the list reads nothing (only the opened order draws a card), so the Desk is asked
           once for an order he opens. A redraw of the card (a read that changed, a tap) keeps the quote it has, or waits on the one in
           flight, and never asks again for the same figures. */
        var qsay=el('p','amb-field__hint'), qfigs=el('div','maker-quote amb-stack');
        qsay.setAttribute('role','status'); figs.appendChild(qsay); figs.appendChild(qfigs);
        function makerPlacedSay(text,bad,error){
          qsay.className=bad?'amb-field__hint msg bad':'amb-field__hint'; qsay.textContent=text; withDetails(qsay,error); qfigs.textContent='';
          var accept=card.querySelector('[data-accept]'); if(accept) accept.remove();
          waitDraw(bad);
        }
        /* 12 Nov 2026 (his screenshot of an ask under the Floor): THE STAND-IN SAYS WHAT IT WAITS FOR AND LEADS THERE. A figure outside the band is read
           and asked a reason, which the pill called Figures not read, greyed, with the Desk's sentence a screen above it: now it says Give a reason and
           its tap brings the Reason line into view; a read that failed is read again by the pill itself. It is grey only while a read is on its way. */
        function waitDraw(bad,ask){
          var old=lead.querySelector('[data-accept-wait]'); if(old) old.remove();
          var pick=makerPlacedDelivery()==null&&!follower&&termsMode==='deliver';
          var b=el('button','amb-pill',pick?'Choose the delivery charge':ask?ONE_OFF_WORDS.give:bad?'Read the figures again':'Reading the figures'); b.type='button';
          b.setAttribute('data-accept-wait',''); actOn(b,'order.accept-wait');
          if(pick) b.addEventListener('click',function(){ tf.open=true; if(feeSel&&feeSel.focus) feeSel.focus(); });
          else if(ask) b.addEventListener('click',function(){ var w=card.querySelector('[data-one-off]'); if(!w) return; if(w.scrollIntoView) w.scrollIntoView({block:'center'}); w.focus(); });
          else if(bad) b.addEventListener('click',makerPlacedRead);
          else b.disabled=true;
          row3.appendChild(b);
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
        function makerPlacedWin(){ return termsMode==='deliver'?((follower?(makerWin[group[0].id]||{}).value:win.value)||''):''; }
        function makerPlacedKey(){
          var d=makerPlacedDelivery();
          return d==null?'':JSON.stringify([{total:Number(total.value),delivery:d,qty:Number(quantity.value),mode:termsMode},makerPlacedWin()].concat(order.test?[(makerPayFirst[order.id]||{}).on===true]:[]).concat(makerOneOff[order.id]?[makerOneOff[order.id]]:[]));
        }
        function makerPlacedShow(q){
          qsay.className='amb-field__hint'; qsay.textContent='Figures read: check them before you agree.';
          qfigs.textContent='';
          if(q.result.test) qfigs.appendChild(el('p','amb-field__hint','A practice order: nothing is priced or checked, and '+(q.result.prepay?'they pay first.':'it goes on credit.')));
          else makerPlacedReading(qfigs,q.result);
          /* 13 Nov 2026 (the price band's version 3, the win-back): a lapsed regular's Accept is offered a Goods price under their own, his tap alone; Use fills the Goods field and the figures are read again, nothing is sent until his Accept */
          var wb=q.result.winBack;
          if(!q.result.test&&wb&&typeof wb.price==='number'&&wb.price>0){
            var wl=el('p','amb-field__hint','Lapsed '+(+wb.since)+' d: win back at '+rm(wb.price)+', '+Math.round(((+wb.from)-(+wb.to))*100)+'% under their price.'); wl.setAttribute('data-winback','');
            var use=aPill('Use','order.winback',order.id,true); use.addEventListener('click',function(){
              total.value=String(wb.price); total.dispatchEvent(new Event('input',{bubbles:true})); total.dispatchEvent(new Event('change',{bubbles:true}));
            });
            wl.appendChild(document.createTextNode(' ')); wl.appendChild(use); qfigs.appendChild(wl);
            var wf=el('p','amb-field__hint','Their order then reads under their price: it counts to no loyalty unit, and as given on an associate’s reward.'); wf.setAttribute('data-winback-foot',''); qfigs.appendChild(wf);
          }
          var old=card.querySelector('[data-accept]'); if(old) old.remove();
          var wait=lead.querySelector('[data-accept-wait]'); if(wait) wait.remove();
          /* a sheet's lines take its first order's window, as they take its one delivery charge */
          /* 11 Nov 2026: an open ask is answered by an offer whatever the figure (the Desk's offerOrder files it as Negotiate's, on the same preview's offer digest) */
          var wv=makerPlacedWin(), askOpen=makerAsked(order), yes=askOpen||q.result.needsYes===true||makerNeedsYes(order,q.total,wv,q.qty,q.mode);
          [].forEach.call(document.querySelectorAll('[data-reward="'+order.id+'"]'),function(n){ rewardPaint(n,order); });   /* the reward's figures come with the read */
          /* 25 Oct 2026 (canvas Salt Admin Orders): the pill says the one sum it sends, the goods and the delivery together, so it fits its half of the row; the terms stand above it */
          var accept=makerButton(row3,[(askOpen?'Offer them, ':yes?'Ask them, ':'Agree, ')+rmShort((+q.result.quote||0)+(+q.result.delivery||0)),yes?'order.send-yes':'order.accept'],function(){
            var s=makerQuotes[order.id]; if(!s||!s.hash) return;
            /* version 2: a raise or another window goes to them as an offer, for their yes; never on a sheet, which the Desk refuses. An answer to
               their ask carries no window: Negotiate's offer holds the goods and the charge alone */
            if(yes){ var ob={total:s.total,delivery:s.delivery,qty:s.qty,mode:s.mode,hash:s.offerHash};             if(s.mode==='deliver'&&wv&&!askOpen) ob.slot=wv;
              if(s.oneOff) ob.oneOff=s.oneOff;
              makerTap(order,'offer',ob,askOpen?'Offer sent. They take it or say no thanks.':'Sent to them for their yes.'); return; }
            var body={total:s.total,delivery:s.delivery,qty:s.qty,mode:s.mode,hash:s.hash};
            if(s.oneOff) body.oneOff=s.oneOff;
            if(order.test) body.prepay=s.prepay===true;
            if(s.mode==='deliver'&&wv) body.slot=wv;
            makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/accept',body,'Agreed and sent to the Desk.',order.id);
          },true); accept.setAttribute('data-accept',''); row3.appendChild(accept);
        }
        /* 13 Oct 2026 (stress, High): A CHOICE THAT DID NOT SAVE IS NOT SHOWN AS CHOSEN. The charge and the time are held on this card until the
           figures are read; a read that fails (a 500, no connection) leaves the radio he just pressed ticked over figures nobody read. The choice
           the last good read stood on is put back (chip.kept, win.kept), and the card's line says which did not save. The read itself is unchanged. */
        function makerPlacedRevert(){
          var k=chip.kept||{value:'',other:''}, said=[];
          if(chip.value!==k.value||(chip.value==='other'&&chip.other!==k.other)){
            chip.value=k.value; chip.other=k.other;
            if(feeSel) feeSel.value=chip.value;
            if(otherField){ otherField.value=chip.other; otherField.closest('label').hidden=chip.value!=='other'; }
            said.push('That charge did not save. '+(chip.value===''?'No charge is chosen.':'RM '+(chip.value==='other'?chip.other:chip.value)+' is still chosen.'));
          }
          if(winDraw&&win.value!==(win.kept||'')){ win.value=win.kept||''; winDraw(); said.push('That time did not save. The one before it stands.'); }
          return said.length?said.join(' ')+' ':'';
        }
        function makerPlacedRead(){
          var delivery=makerPlacedDelivery();
          if(delivery==null){ previewTurn++; makerPlacedSay('Choose the delivery charge, and the figures read themselves.'); return; }
          var refill=refillGoods, payload=refill?{}:{total:Number(total.value)}, key=makerPlacedKey(), turn=++previewTurn;
          payload.delivery=delivery; payload.qty=Number(quantity.value); payload.mode=termsMode;
          /* 18 Nov 2026: a changed size with no figure typed since asks for no total, and the Desk answers their price for it, which refills Goods */
          if(makerPlacedWin()) payload.slot=makerPlacedWin();
          if(makerOneOff[order.id]) payload.oneOff=makerOneOff[order.id];
          if(order.test) payload.prepay=(makerPayFirst[order.id]||{}).on===true;
          /* an in-flight preview is not yet usable: clear any existing quote/Accept at once, not only on success */
          delete makerQuotes[order.id];
          makerPlacedSay('Reading the figures.');
          var pv=makerPv[order.id];
          if(!pv||pv.key!==key) pv=makerPv[order.id]={key:key,payload:payload,p:refs('/all/maker/orders/'+encodeURIComponent(order.id)+'/preview',payload)};
          pv.p.then(function(result){
            if(makerPv[order.id]===pv) delete makerPv[order.id];
            if(turn!==previewTurn||!card.isConnected) return;
            if(refill){ var given=result&&result.terms&&result.terms.total; if(typeof given!=='number'){ makerPlacedSay('Their price for that size did not come back: type the goods.',true); return; }
              payload.total=given; total.value=String(given); refillGoods=false; key=makerPlacedKey(); }
            makerQuotes[order.id]={total:payload.total,delivery:payload.delivery,qty:payload.qty,mode:payload.mode,prepay:payload.prepay,hash:result.hash,offerHash:result.offerHash,result:result,key:key,sig:sig};
            if(payload.oneOff) makerQuotes[order.id].oneOff=payload.oneOff;
            chip.kept={value:chip.value,other:chip.other}; win.kept=win.value;
            makerPlacedShow(makerQuotes[order.id]);
          }).catch(function(error){
            if(makerPv[order.id]===pv) delete makerPv[order.id];
            if(turn!==previewTurn||!card.isConnected) return;
            delete makerQuotes[order.id];
            if(error&&error.detail&&error.detail.outside){ makerPlacedAsk(error); return; }
            var back=makerPlacedRevert();
            makerPlacedSay(back+error.message,true,error);
            if(makerPlacedDelivery()!=null) makerButton(qfigs,['Read the figures again','order.reread'],makerPlacedRead,false);
          });
        }
        /* the Desk asked for a reason: its sentence, one Reason line and Let it stand, which reads the figures again with it; a new goods total is asked afresh */
        function makerPlacedAsk(error){
          makerPlacedSay(error.raw,true); waitDraw(true,true);
          var why=makerField(qfigs,[ONE_OFF_WORDS.reason,'order.one-off-reason'],'text',makerOneDraft[order.id]||'');
          why.maxLength=120; why.required=true; why.setAttribute('data-one-off','');
          var go=makerButton(qfigs,[ONE_OFF_WORDS.go,'order.one-off'],function(){
            if(!oneOffOk(why.value)) return;
            makerOneOff[order.id]=why.value.trim(); delete makerOneDraft[order.id]; makerPlacedRead();
          },true);
          go.setAttribute('data-one-off-go',''); go.disabled=!oneOffOk(why.value);
          why.addEventListener('input',function(){ makerOneDraft[order.id]=why.value; go.disabled=!oneOffOk(why.value); });
        }
        total.addEventListener('input',function(){ refillGoods=false; delete makerOneOff[order.id]; delete makerOneDraft[order.id]; });
        total.addEventListener('input',makerPlacedInvalidate);
        total.addEventListener('change',makerPlacedRead);
        quoteStart=function(){
          var held=makerQuotes[order.id];
          if(held&&held.sig===sig&&held.key===makerPlacedKey()) makerPlacedShow(held); else makerPlacedRead();
        };
        if(deliver||wayAllowed){
          /* S11 11.3 on the Counter: the delivery charge is chosen where the order is agreed, RM 0, 10, 15 or his own
             figure, and NONE is chosen until he chooses, so a delivery is never agreed at a charge nobody set.
             22 Oct 2026 (canvas Needs you): one select beside Goods, its first line Choose, which sends nothing; Other opens his own figure under them */
          var dsel=el('select');
          actOn(dsel,'order.fee');
          [['','Choose'],['0','0'],['10','10'],['15','15'],['other','Other']].forEach(function(opt){
            var op=el('option','',opt[1]); op.value=opt[0]; op.selected=chip.value===opt[0]; dsel.appendChild(op);
          });
          dsel.value=chip.value;
          dsel.addEventListener('change',function(){
            chip.value=dsel.value;
            if(otherField) otherField.closest('label').hidden=chip.value!=='other';
            makerPlacedInvalidate(); makerPlacedRead();
          });
          feeWrap=makerRow(form,'Delivery, RM',dsel); feeWrap.classList.add('oagree__fee'); feeSel=dsel;
          otherField=makerField(form,['Other, RM','order.fee-other-amount'],'number',chip.other);
          otherField.closest('label').classList.add('oagree__wide'); otherField.closest('label').hidden=chip.value!=='other';
          otherField.addEventListener('input',function(){ chip.other=otherField.value; makerPlacedInvalidate(); });
          otherField.addEventListener('change',makerPlacedRead);
        }
        /* 13 Oct 2026 (stress, Medium): THE FIGURES STAND UNDER THE CHARGE, above the time. They were drawn after the whole Delivery time fieldset, 1,270px down a phone's
           card, so a charge pressed there had its answer a screen away (the status line of a read, its figures, its failure). The time still re-reads them, and is a
           fieldset's height below them. */
        if(order.test){
          var pay=makerPayFirst[order.id]||(makerPayFirst[order.id]={on:false}), pset=el('fieldset','amb-options');
          pset.appendChild(el('legend','amb-field__label','Payment'));
          [[false,'On credit'],[true,'Pay first']].forEach(function(opt){
            var label=el('label','amb-option'), radio=el('input','amb-vh amb-option__input'), mark=el('span','amb-option__mark'), text=el('span','amb-option__title',opt[1]);
            radio.type='radio'; radio.name='makerPay-'+order.id; radio.value=opt[0]?'first':'credit'; radio.checked=pay.on===opt[0]; actOn(radio,'order.pay-'+radio.value); mark.setAttribute('aria-hidden','true');
            radio.addEventListener('change',function(){ pay.on=opt[0]; makerPlacedInvalidate(); makerPlacedRead(); });
            label.appendChild(radio); label.appendChild(mark); label.appendChild(text); pset.appendChild(label);
          });
          tf.body.appendChild(pset);
        }
        /* 10 Oct 2026 (his Q3): a delivery that asked for no time may be answered with a window, sent with Accept; theirs stands */
        var win=makerWin[order.id]||(makerWin[order.id]={value:'',day:''});
        /* 11 Nov 2026 (Fable): an answer to their ask carries no window (Negotiate's offer is goods and charge), so no When is drawn while it is open */
        if((deliver||wayAllowed)&&!order.wantBy&&!makerAsked(order)){
          /* 22 Oct 2026 (canvas Needs you): ONE WHEN, across Goods and Delivery: theirs first (ASAP, which needs no day, or the window they chose), then every
             window still ahead on the days the Counter offers, each saying its own day (Today, Tomorrow, Fri 24 Oct). Its values are the slots the radios sent */
          var now=Date.now(), days=makerWinDays(now), theirs=order.slot?String(order.slot).slice(0,10):'';
          var ws=el('select');
          actOn(ws,'order.window'); ws.setAttribute('data-when','');
          var own=order.slot&&order.slotSpan?'Theirs, '+String(order.slotSpan).replace('-',' to ')+' on '+mwDayLabel(theirs):'ASAP';
          var wopts=[['',own]];
          days.forEach(function(d){ makerWinOn(d,now).filter(function(x){ return x[0]!==order.slot; }).forEach(function(x){ wopts.push([x[0], makerWinDay(d,now)+', '+x[1]]); }); });
          if(win.value&&!wopts.some(function(x){ return x[0]===win.value; })) win.value='';
          if(win.kept&&!wopts.some(function(x){ return x[0]===win.kept; })) win.kept='';   /* Fable's review: a passed window is never put back */
          wopts.forEach(function(opt){ var op=el('option','',opt[1]); op.value=opt[0]; op.selected=win.value===opt[0]; ws.appendChild(op); });
          ws.value=win.value;
          /* a window decides whether Accept goes to them for their yes, so a change reads the figures again */
          ws.addEventListener('change',function(){ win.value=ws.value; if(win.value) win.day=win.value.slice(0,10); makerPlacedInvalidate(); makerPlacedRead(); });
          winDraw=function(){ ws.value=win.value; };
          whenWrap=makerRow(form,'When',ws); whenWrap.classList.add('oagree__wide');
          win.showHint=el('p','amb-field__hint',order.slot?'They chose '+String(order.slotSpan||'').replace('-',' to ')+'; another asks them.'
            :'They want it ASAP; a window goes with Agree.');
          form.appendChild(win.showHint);
        }
        function makerPlacedDelivery(){
          if(termsMode!=='deliver') return 0;
          if(follower) return 0;
          if(!feeSel) return null;
          if(chip.value==='other'){ var v=Number(otherField.value); return otherField.value!==''&&v>=0?v:null; }
          if(chip.value==='0'||chip.value==='10'||chip.value==='15') return Number(chip.value);
          return null;
        }
        way.addEventListener('change',function(){
          termsMode=way.value;
          if(feeWrap) feeWrap.hidden=termsMode!=='deliver'||follower;
          if(otherField) otherField.closest('label').hidden=termsMode!=='deliver'||chip.value!=='other';
          if(whenWrap) whenWrap.hidden=termsMode!=='deliver';
          if(win.showHint) win.showHint.hidden=termsMode!=='deliver';
          makerPlacedInvalidate(); makerPlacedRead();
        });
        quantity.addEventListener('input',function(){
          /* a size that is not the order's has no figure until the Desk answers their price for it; put back, the figure is the order's again */
          if(Math.abs(Number(quantity.value)-(+order.qty||0))>0.0004){ refillGoods=true; total.value=''; }
          else if(refillGoods){ refillGoods=false; total.value=String(order.total); }
          makerPlacedInvalidate();
        });
        quantity.addEventListener('change',makerPlacedRead);
        if(feeWrap) feeWrap.hidden=termsMode!=='deliver'||follower;
        if(whenWrap) whenWrap.hidden=termsMode!=='deliver';
        if(win.showHint) win.showHint.hidden=termsMode!=='deliver';
        if(!wayAllowed) form.appendChild(el('p','amb-field__hint','Way cannot change on a sheet with several orders or a group order.'));
      }else if(againAck){
        quoteStart=makerAcceptAgain(card,order,acts,stageOf('Agree again'));
      }else if(order.status==='acknowledged'){
        /* Ready says how the goods go, as the Desk's card does; the order book records the mode at Ready. 2 Nov 2026: their way is the pill, the other a row */
        stageOf('Ready');
        [['collect','Ready to collect'],['deliver','Ready to deliver']].forEach(function(m){
          var mine=(order.mode||'collect')===m[0];
          var b=makerButton(mine?lead:stageRows,[m[1],'order.ready-'+m[0]],function(){
            /* Counter Batch A (his answer of 18 Oct 2026): a collection is ready at one of his points, chosen on a Sheet */
            if(m[0]==='collect'){ pointPick(order,b,'ready'); return; }
            makerMove(order,{status:'ready',mode:m[0]},'Order marked '+m[1].toLowerCase()+'.');
          },mine);
          if(!mine){ var cn=b.nextSibling; aAct(b); stageRows.add(b); if(cn&&cn.tagName==='BUTTON'){ aAct(cn); stageRows.add(cn); } stageRows.list.insertBefore(b.parentNode,stageRows.list.firstChild); }
          b.setAttribute('data-mode',m[0]); if(m[0]==='collect') makerAskTag(order,b,'point');
        });
      }else if(order.status==='ready'&&Number(order.moved||0)<Number(order.qty)-0.0004){
        /* Counter Batch A: where it waits, and Change point while goods are still to hand over */
        stageOf('Handover');
        if(order.mode==='collect'&&!order.point) stage.appendChild(el('p','msg maker-point-at','No collection point named.'));
        /* 17 Nov 2026 (the order-changes plan, version 2, his answer 8): the stage keeps its one pill, every unit handed over; part of them, a finish at
           fewer, and another point are the Change sheet's, which sends each by the same road */
        var handed=makerButton(lead,['Handed over, '+units(order.qty),'order.handed'],function(){
          makerTap(order,'handed',{qty:Number(order.qty)},'Handover sent to the Desk.');
        },true);
        handed.setAttribute('data-handed-all','');
      }
      stageEnd();
      /* 17 Nov 2026 (the order-changes plan, version 2): a payment he records is the Change sheet's; Money received is drawn for what waits on him alone,
         their claims and cash held with its Undo */
      var claimsWaiting=(order.payments||[]).some(function(p){ return p&&p.claim==='waiting'; }), cashHeld=!!(makerCashHeld[order.id]||makerCashStorageError||makerCashSaid[order.id]);
      if(!againAck&&(order.status==='acknowledged'||order.status==='ready')&&(claimsWaiting||(order.status==='ready'&&cashHeld))){
        /* 15 Oct 2026: MONEY RECEIVED IS ONE BLOCK, in the order the money comes: their claim answered, a payment into the bank, then cash at the handover (Ready only).
           Since 16 Oct 2026 the bank and the cash are one amount and two tiles (makerPayControl). 2 Nov 2026: a part of his decision, its claims rows */
        var money=part(null,'omoney'), moneyHead=el('h2','amb-section','Money received'), claims=aGroup(null,'oclaims');
        money.setAttribute('aria-label','Money received');
        moneyHead.setAttribute('data-sect','money'); moneyHead.tabIndex=-1; money.appendChild(moneyHead); money.appendChild(claims);
        (order.payments||[]).filter(function(payment){ return payment.claim==='waiting'; }).forEach(function(payment){
          /* a claim above what the order still owes is money he recorded another way: the Desk's Received, already recorded */
          var onBook=payOnBook(order,payment);
          /* 12 Oct 2026 (Phase 2b, his decision 4 of 11 Oct): a claim's Received and its Not found ask on the page's Sheet, restating who and how much, and
             one action sends what the tap sent, the same route, body and request id */
          var got=aActBtn(claims,[onBook?'Already recorded, '+rm(payment.amount):'Yes, I got '+rm(payment.amount),'order.claim-received',payment.at],function(){
            makerAsk(order,got,'claim-'+payment.at,{title:onBook?'Already recorded, '+rm(payment.amount)+'?':'Received '+rm(payment.amount)+' from '+codeByUser(order.u)+'?', plain:true,
              go:onBook?'Yes, already recorded':'Yes, received', keep:'Not yet',
              say:[onBook?rm(payment.amount)+' is more than this order still owes, so you recorded it another way. Nothing more is recorded, and the customer is told it arrived.'
                :'The Desk records '+rm(payment.amount)+' against this order, and the customer is told it arrived.'],
              yes:function(){ orderReceived(order,payment); }});
          });
          makerAskTag(order,got,'claim-'+payment.at);
          var lost=aActBtn(claims,['Not found, '+rm(payment.amount),'order.claim-not-found',payment.at],function(){
            makerAsk(order,lost,'lost-'+payment.at,{title:'Not found '+rm(payment.amount)+' from '+codeByUser(order.u)+'?', go:'Not found', keep:'Not yet',
              say:['The claim is answered Not found and nothing is recorded. The customer is told.'],
              yes:function(){ makerMove(order,{claim:payment.at,amount:payment.amount},'Claim answered Not found.'); }});
          });
          makerAskTag(order,lost,'lost-'+payment.at);
        });
        if(order.status==='ready'&&cashHeld){ makerCashControls(money,order); cashed=true; }
      }
      /* the stage he rejected, offered again, and Not needed: rows of his decision */
      makerAgain(card,order,acts);
      var againRows=[].filter.call(acts.children,function(b){ return b.matches('button.amb-pill--quiet')&&!/[.]cancel-retained$/.test(b.getAttribute('data-act')||''); });
      if(againRows.length){ var al=aGroup(null,'oagainrows'); againRows.forEach(function(b){ aAct(b); al.add(b); }); dec.appendChild(al); }
      ordMessages(card,order);
      /* plan 4: an agreed order's History, and Undo on its newest move, as the Order log row beside This customer */
      ordNext(card,order,['acknowledged','ready','done'].indexOf(order.status)>=0);
      ordEnd(card,order);
      /* cash held for the order shuts every control of the card, the reply's too, which is drawn after the cash block: its Undo or Retry alone stays live */
      if(cashed&&(makerCashHeld[order.id]||makerCashStorageError)) [].forEach.call(card.querySelectorAll('button,input,select'),function(n){
        if(!n.hasAttribute('data-maker-cash-undo')&&!n.hasAttribute('data-maker-cash-retry')) n.disabled=true; });
      makerCardFoot(card,acts,order.id,cashed,false);
      /* 16 Nov 2026 (Ambient, place G): the card's answer line and its acts stand in the record's one foot, over the stage's pill */
      var mfoot=card.querySelector(':scope > .maker-foot'); if(mfoot) lead.insertBefore(mfoot,lead.firstChild);
      card.appendChild(lead);
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
     until it lands, so a book short of stock holds only its own line; a line's field allows a part. One payment is split by the Desk, the other books first and salt last (27 Oct 2026), each part by the
     engine's claimAlloc, shown, and sent with the split he read (trip-pay); the Desk refuses it whole if the split moved or any share is more than its row can
     take. A buyer's same-day rows with no trip are offered as one order (trip-join), a Correction a row. All of it lands under Approve as one card. ---- */
  var tripHand={}, tripRead={};
  function tripToday(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}); }
  function tripHead(card,t){
    var title=el('h3','amb-section');
    title.appendChild(whoTag(el('span',null,t.party),t.party));
    title.appendChild(document.createTextNode(', '+t.lines.length+' books'+(t.date?', '+fmtWhen(t.date):'')));
    card.appendChild(title);
    card.appendChild(metrics([['Owed',rm(t.owed)],['Paid',rm(t.paid)],['Handed',t.handedLines+' of '+t.lines.length+' lines']]));
    /* the Desk reads the order as it will stand, so a move waiting under Approve is never asked for twice; it says so */
    if(t.waiting>0) card.appendChild(el('p','amb-field__hint','As it will stand once '+(t.waiting===1?'the move':'the '+t.waiting+' moves')+' waiting under Approve '+(t.waiting===1?'is':'are')+' approved.'));
  }
  function tripLines(card,t,more){
    var list=el('div','triplines amb-stack');
    t.lines.forEach(function(l){
      var row=el('div','tripline amb-stack'), p=el('p','maker-facts');
      row.setAttribute('data-line',l.rid);
      p.appendChild(bookChip(l.product));
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
      var handBtn=makerButton(hand,['Hand over all','trip.handover',t.trip],function(){ return tripHandover(t,key,fields,handSaid); },true);
      var relabel=function(){ handBtn.textContent=left.every(function(l){ return Number(fields[l.rid].value)===l.left; })?'Hand over all':'Hand over as typed'; };
      left.forEach(function(l){ fields[l.rid].addEventListener('input',relabel); });
      hand.appendChild(handSaid); card.appendChild(hand);
    }
    if(t.owed>0.004) tripPayBlock(card,t,key);
    var roads=t.lines.map(roadWord).filter(function(w,i,a){ return w&&a.indexOf(w)===i; });
    card.appendChild(detailBox('trip.details',key,[['Order',t.trip],['Day',t.date?fmtWhen(t.date):''],['Road',roads.join(', ')]].concat(t.lines.map(function(l){ return ['Row',l.rid]; }))));
    makerCardFoot(card,acts,key,false,false);
    return card;
  }
  /* 17 Oct 2026, HIS FLOW: A ROW OF THE BOOK WITH NO SITE ORDER IS AN ORDER HERE TOO, at the stage its figures put it (the Desk's flowStage). Its moves
     are Record's own (ledger-amend), each under Approve: a handover or a payment a Fulfilment, a change of units, price or delivery a Correction, a
     cancel a Cancellation; History and Undo are the row's. Every figure is the Desk's, as the row will stand once the moves waiting fold. */
  /* 22 Oct 2026 (his word): a unit the fold raised says which it is, on the row and its card */
  var REWARD_WORD={associate:'Associate reward', loyal:'Loyalty unit'};
  var ROW_STAGE={confirmed:['brass','Agreed','tick'], paid:['verdigris','Out or paid','ticks'], done:['mist','Done','ticks'], ended:['mist','Ended','cross']};
  /* 4 Nov 2026 (his answer A to the ledger conventions): THE ROAD AN ORDER CAME BY, the engine's ROADS word, on the row's card and the trip's details */
  var ROAD_WORD={site:'Site order', admin:'Salt Admin entry', desk:'Desk entry', hand:'Hand fold', fold:'Fold-raised unit'};
  function roadWord(r){ return (r&&ROAD_WORD[r.road])||''; }
  function rowCard(root,e){
    var r=e.row, key=e.id, card=makerCard(root,key), acts=el('div','maker-foot__acts'), live=!r.cancelled&&!r.writtenOff;
    card.setAttribute('data-in',e.parts); card.setAttribute('data-row',r.rid);
    var title=el('h3','amb-section');
    title.appendChild(whoTag(el('span',null,r.party),r.party)); title.appendChild(document.createTextNode(' ')); title.appendChild(bookChip(r.product));
    title.appendChild(document.createTextNode(' '+units(r.qty)+', '+rm(r.total)+(r.delivery>0.004?' + '+rm(r.delivery):'')));
    card.appendChild(title);
    var st=r.cancelled?['mist','Cancelled','cross']:r.writtenOff?['mist','Written off','cross']:ROW_STAGE[r.stage]||['mist',String(r.stage)], head=el('p','oband__head');
    head.appendChild(stageChip(st)); if(r.reward){ head.appendChild(document.createTextNode(' ')); head.appendChild(chip('verdigris',REWARD_WORD[r.reward])); }
    else if(roadWord(r)){ head.appendChild(document.createTextNode(' ')); var rc=chip('steel',roadWord(r)); rc.setAttribute('data-road',r.road); head.appendChild(rc); }
    card.appendChild(head);
    if(r.reward) card.appendChild(el('p','amb-field__hint',REWARD_WORD[r.reward]+' for '+r.rewardOf+', at cost and free to them: it goes with that order or their next salt handover.'));
    card.appendChild(metrics([['Owed',rm(r.owed)],['Paid',rm(r.paid)],['Handed',String(+(+r.handed||0).toFixed(3))+' of '+units(r.qty)]]));
    if(r.waiting>0) card.appendChild(el('p','amb-field__hint','As it will stand once '+(r.waiting===1?'the move':'the '+r.waiting+' moves')+' waiting under Approve '+(r.waiting===1?'is':'are')+' approved.'));
    if(+r.refund>0.004) card.appendChild(el('p','amb-field__hint',rm(r.refund)+' refund here is their credit, spent at your next Accept or repaid by hand on the Desk.'));
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
      card.appendChild(el('h3','amb-section','Change the order'));
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
    card.appendChild(el('h3','amb-section','Money received'));
    var held=tripRead[t.trip];
    var amount=makerField(pay,['Paid, RM, cash or bank','trip.pay-amount',t.trip],'number',held?held.amount:'');
    function drop(){ shown.textContent=''; if(rec){ var c=rec.nextSibling; if(c&&c.getAttribute&&c.getAttribute('data-act')==='trip.pay.cancel-retained'&&c.hidden) c.remove(); rec.remove(); rec=null; } }
    function draw(r){
      drop();
      r.split.shares.forEach(function(s){
        var p=el('p','amb-field__hint maker-facts'); p.setAttribute('data-share',s.rid); p.appendChild(bookChip(s.product));
        p.appendChild(document.createTextNode(' '+s.rid+', '+rm(s.rm)+(s.rm<s.owed-0.004?' of '+rm(s.owed)+' owed':s.rm>s.owed+0.004?', all it owes and '+rm(s.rm-s.owed)+' over, a refund to them':', all it owes')));
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
      said.textContent='The Desk pays the other books first and salt last. Check it before you record it.';
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
    card.appendChild(el('p','amb-field__hint','Entered apart on one day. As one order they are handed over and paid together, '
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
  function amendOpen(order,opener,tried){
    /* a collection waiting at Ready offers its point here: his points are read once, before the Sheet opens; a failed read opens it without a Point */
    if(order.status==='ready'&&!makerPoints&&!tried){   /* 18 Nov 2026: on a delivery too, which may become a collection here */
      refs('/all/maker/points').then(function(p){ makerPoints=p; },function(){}).then(function(){ amendOpen(order,opener,true); });
      return;
    }
    var base=[order.qty,order.total,order.delivery||0,order.mode].join(), memo=amendMemo[order.id], kept=memo&&memo.base===base?memo.vals:null;
    function one(label,act,value){
      var wrap=el('label','amb-field'), input=actOn(el('input','amb-input'),act,order.id);
      input.type='number'; input.step='0.01'; input.min='0'; input.inputMode='decimal'; input.value=String(value); input.setAttribute('data-amend-field','');
      wrap.appendChild(el('span','amb-field__label',label)); wrap.appendChild(input); return {wrap:wrap, input:input};
    }
    var aq=one('Units','order.amend-units',kept?kept[0]:order.qty), at=one('Price (goods)','order.amend-total',kept?kept[1]:order.total), ad=one('Delivery','order.amend-delivery',kept?kept[2]:order.delivery||0);
    /* 17 Nov 2026 (TA95-7J2): the way is changed here too, collect to deliver or back, on the same change as its charge; Collect empties the
       charge, which a collection never carries */
    var way=actOn(el('select',''),'order.amend-way',order.id);   /* 17 Nov 2026, the move to Ambient (merging v1525 and v1527): the Change sheet's fields are Ambient's (sField, sSelect) */
    [['collect','Collect'],['deliver','Deliver']].forEach(function(p){ var o=el('option','',p[1]); o.value=p[0]; way.appendChild(o); });
    way.value=kept&&kept[3]?kept[3]:(order.mode==='deliver'?'deliver':'collect'); way.setAttribute('data-amend-way','');
    var aw=sField('Way',sSelect(way));
    way.addEventListener('change',function(){ if(way.value==='collect') ad.input.value='0'; if(ptWrap) ptWrap.hidden=way.value!=='collect'; });
    /* 17 Nov 2026 (the order-changes plan, version 2, his answer 8): ONE SHEET FOR EVERY CHANGE OF AN AGREED ORDER. Beside the order's terms it holds the
       point a collection waits at, what is handed over and a payment received, each sent by the road its old control used: the point by the move, the
       units by the handover (a close when That is all), the money by Received (Bank) or the ten-second cash hold (Cash, at Ready). One Save sends them in
       that order, after the terms, each against the order as it then stands, and stops at the first that does not land. */
    var cur=function(){ return ((makerData&&makerData.orders)||[]).filter(function(o){ return o.id===order.id; })[0]||order; };
    var ready=order.status==='ready', out=Number(order.moved||0), left=Number(order.qty)-out>0.0004;
    var sofar=[], pt=null, hq=null, rest=null, pay=null, by=null;
    function sub(text){ var h=el('h2','amb-settings__head',text); h.setAttribute('data-change-group',text); return h; }
    if(ready&&order.mode==='collect'&&left&&!makerPoints) sofar.push(el('p','maker-facts','The points could not be read, so Point is not offered. Close this and open Change again.'));
    /* 18 Nov 2026 (the plan's version 4): a delivery at Ready that becomes a collection here waits at a point too, so its Point is drawn, shown with Collect */
    var ptWrap=null;
    if(ready&&left&&makerPoints){
      var plist=(order.test?makerPoints.examples:makerPoints.points&&makerPoints.points.list)||[];
      if(plist.length){
        pt=actOn(el('select',''),'order.change-point',order.id); pt.setAttribute('data-change-field','point');
        plist.forEach(function(p){ var o=el('option','','Point '+p.code); o.value=p.code; pt.appendChild(o); });
        if(!order.point){ var none=el('option','','Choose a point'); none.value=''; pt.insertBefore(none,pt.firstChild); }
        pt.value=order.point||''; ptWrap=sField('Point',sSelect(pt)); ptWrap.hidden=order.mode!=='collect'; sofar.push(ptWrap);
      }
    }
    /* 18 Nov 2026 (the plan's version 4, his answer 6): Handed over is drawn wherever goods are out as well, and goes down too: under what is out it is
       taken back, with his reason, a Correction for Approve; above it, at Ready with units left, it is the handover as before */
    if((ready&&left)||out>0.0004){
      hq=actOn(el('input','amb-input'),'order.change-handed',order.id); hq.setAttribute('data-change-field','handed');
      hq.type='number'; hq.step='0.25'; hq.min='0'; hq.max=String(ready&&left?order.qty:out); hq.inputMode='decimal'; hq.value=String(out);
      sofar.push(sField('Handed over, of '+units(order.qty),hq));
    }
    if(ready&&left){
      var rbox=el('div'); rest=makerTilesIn(rbox,['The rest','order.change-rest'],[{value:'more',label:'More to come'},{value:'all',label:'That is all'}]);
      rest.setAttribute('data-change-field','rest'); sofar.push(rbox);
    }
    /* and what is paid so far, which only comes down here; money in is Received now */
    var paidNow=Number(order.paid||0), lp=null, lw=null, lwWrap=null;
    if(paidNow>0.004){
      lp=actOn(el('input','amb-input'),'order.change-paid-so-far',order.id); lp.setAttribute('data-change-field','paidsofar');
      lp.type='number'; lp.step='0.01'; lp.min='0'; lp.max=String(paidNow); lp.inputMode='decimal'; lp.value=String(paidNow);
      sofar.push(sField('Paid so far, RM',lp));
    }
    if(lp||out>0.0004){
      lw=actOn(el('input','amb-input'),'order.change-why',order.id); lw.setAttribute('data-change-field','why');
      lw.type='text'; lw.maxLength=120;
      lwWrap=sField('Why it is taken back',lw); lwWrap.hidden=true; sofar.push(lwWrap);
    }
    function lowerPaid(){ return !!lp&&lp.value!==''&&Number(lp.value)<paidNow-0.004; }
    function lowerMoved(){ return !!hq&&hq.value!==''&&Number(hq.value)<out-0.0004; }
    /* 18 Nov 2026 (the plan's version 4, his answer 5): the window, on a delivery with goods to come: one earlier than theirs is told, a later one (or
       any, where they asked for none) asks their yes, theirs standing until they give it (the order book's winEarlier) */
    var ws=null, winAsk=order.winOffer&&order.winOffer.state==='offered'&&String(order.winOffer.until||'')>new Date().toISOString()?order.winOffer:null;
    function winEarlier(v){ return order.slot?v<order.slot:order.wantBy?v.slice(0,10)<=order.wantBy:false; }
    if(order.mode==='deliver'&&(order.status==='acknowledged'||ready)&&left){
      var wnow=Date.now(), wdays=makerWinDays(wnow);
      ws=actOn(el('select',''),'order.change-window',order.id); ws.setAttribute('data-change-field','window');
      var wown=order.slot&&order.slotSpan?'As now, '+String(order.slotSpan).replace('-',' to ')+' on '+mwDayLabel(String(order.slot).slice(0,10)):'As now, ASAP';
      var wo=el('option','',wown); wo.value=''; ws.appendChild(wo);
      wdays.forEach(function(dd){ makerWinOn(dd,wnow).filter(function(x){ return x[0]!==order.slot; }).forEach(function(x){ var op=el('option','',makerWinDay(dd,wnow)+', '+x[1]); op.value=x[0]; ws.appendChild(op); }); });
      sofar.push(sField('When',sSelect(ws)));
      if(winAsk){
        sofar.push(el('p','amb-field__hint','Asked of them: '+String(winAsk.slotSpan||'').replace('-',' to ')+' on '+mwDayLabel(String(winAsk.slot).slice(0,10))+'. Theirs stands until they say yes.'));
        var wbox=el('div');
        makerButton(wbox,['Withdraw the ask','order.change-win-withdraw',order.id],async function(){ await makerMove(cur(),{winWithdraw:true},'The window ask is withdrawn. Theirs stands.'); },false);
        sofar.push(wbox);
      }
    }
    /* 18 Nov 2026 (his answer to Ask 1 of version 4's audit): a Ready order with nothing handed over may go back to Agreed, told as changed */
    var stage=null;
    if(ready&&out<=0.0004){
      stage=actOn(el('select',''),'order.change-stage',order.id); stage.setAttribute('data-change-field','stage');
      [['','Ready, as now'],['back','Back to Agreed']].forEach(function(p){ var op=el('option','',p[1]); op.value=p[0]; stage.appendChild(op); });
      sofar.push(sField('Stage',sSelect(stage)));
    }
    if(order.status==='acknowledged'||ready){
      pay=actOn(el('input','amb-input'),'order.change-paid',order.id); pay.setAttribute('data-change-field','paid');
      pay.type='number'; pay.step='0.01'; pay.min='0'; pay.inputMode='decimal'; pay.value=''; pay.placeholder='0';
      sofar.push(sField('Received now, RM',pay));
      var bbox=el('div'); by=makerTilesIn(bbox,['Paid by','order.change-by'],[{value:'bank',label:'Bank'}].concat(ready?[{value:'cash',label:'Cash'}]:[]),ready);
      by.setAttribute('data-change-field','by'); sofar.push(bbox);
    }
    /* what Save will tell them, said before he taps: the order book's rule (stmt/orders.js tellOf), read here as it reads it */
    var told=el('p','amb-field__hint'); told.setAttribute('data-change-told','');
    function terms(){
      var b={}, q=Number(aq.input.value), t=Number(at.input.value), d=Number(ad.input.value);
      if(q!==Number(order.qty)) b.qty=q;
      if(t!==Number(order.total)) b.total=t;
      if(d!==Number(order.delivery||0)) b.delivery=d;
      if(way.value!==(order.mode==='deliver'?'deliver':'collect')) b.mode=way.value;
      if(b.qty!==undefined&&b.total===undefined) b.total=t;
      return b;
    }
    function tellDraw(){
      var b=terms(), bits=[];
      if(Object.keys(b).length){
        var q=Number(aq.input.value), before=Number(order.total)+Number(order.delivery||0), after=Number(at.input.value)+Number(ad.input.value);
        var lost=order.mode==='deliver'&&way.value==='collect';
        bits.push(after<before-0.004&&q>=Number(order.qty)-0.0004&&!lost?'They are told it is a discount.':'They are told their order has changed.');
      }
      if(pt&&pt.value&&pt.value!==(order.point||'')) bits.push('They are told the new point.');
      if(lowerPaid()||lowerMoved()) bits.push('Taken back: they are told their order has changed. You approve it next, under Approve.');
      /* Fable's review of version 4: a reward this order brought is counted on what was paid, so the book flags it stale, never withdrawn */
      if(lowerPaid()&&order.rwd) bits.push('This order brought a reward unit: the book flags it if it no longer holds.');
      if(lwWrap) lwWrap.hidden=!(lowerPaid()||lowerMoved());
      if(hq&&Number(hq.value)>out+0.0004) bits.push('They are told it was handed over.');
      if(stage&&stage.value==='back') bits.push('Back to Agreed: they are told their order has changed.');
      if(ws&&ws.value) bits.push(winEarlier(ws.value)?'They are told the earlier window.':'The later window asks their yes; theirs stands until they give it.');
      if(pay&&Number(pay.value)>0) bits.push('They are told the payment arrived.');
      told.textContent=bits.length?bits.join(' '):'Nothing is sent until you change something.';
      if(rest) rest.hidden=!(hq&&Number(hq.value)>out+0.0004&&Number(hq.value)<Number(order.qty)-0.0004);
    }
    [aq.input,at.input,ad.input,way,pt,hq,pay,by,rest,lp,lw,ws,stage].forEach(function(n){ if(n){ n.addEventListener('input',tellDraw); n.addEventListener('change',tellDraw); } });
    var extra=[sub('Order'),aw,aq.wrap,at.wrap,ad.wrap].concat(sofar.length?[sub('So far')].concat(sofar):[],[told]);
    makerAsk(order,opener,'amend',{title:'Change the order', plain:true, primary:true, go:'Send the change', keep:'Not now', say:['A change of its terms waits for you under Approve; the rest goes at once.'], extra:extra,
      yes:async function(){
        var body=terms(), np=pt&&pt.value&&pt.value!==(order.point||'')?pt.value:null, nh=hq&&Number(hq.value)>out+0.0004?Number(hq.value):null,
            np2=pay&&Number(pay.value)>0?Math.round(Number(pay.value)*100)/100:null, road=by?by.value:'';
        var lowering=lowerPaid()||lowerMoved(), nw=ws&&ws.value&&way.value==='deliver'?ws.value:null, goBack=!!stage&&stage.value==='back';
        if(ready&&left&&!goBack&&order.mode!=='collect'&&way.value==='collect'&&!pt){ makerSay(order.id,'A collection waits at a point, and none could be offered here: add one under Settings, Hours, then change the way. Nothing was sent.'); return; }
        if(ready&&left&&!goBack&&order.mode!=='collect'&&way.value==='collect'&&!pt.value){ makerSay(order.id,'Choose the point they collect at. Nothing was sent.'); return; }
        if(goBack&&((np&&order.mode==='collect')||nh!==null||lowering||(np2!==null&&road==='cash'))){ makerSay(order.id,'Back to Agreed goes with a change of terms or a bank payment alone. Nothing was sent.'); return; }
        if(!Object.keys(body).length&&!np&&nh===null&&np2===null&&!lowering&&!nw&&!goBack){ makerSay(order.id,'Change a figure first.'); return; }
        /* 18 Nov 2026 (Fable's review of version 4): a take-back is an amendment of its own, so it goes alone or with a point or a window */
        if(lowering&&(Object.keys(body).length||nh!==null||np2!==null)){ makerSay(order.id,'Take back on its own: send the other changes once it has gone. Nothing was sent.'); return; }
        if(lowering&&!oneOffOk(lw.value)){ makerSay(order.id,'Say why it is taken back, in one line. Nothing was sent.'); return; }
        if(np2!==null&&!road){ makerSay(order.id,'Choose Bank or Cash first. Nothing was sent.'); return; }
        /* what he typed of the terms is kept before any refusal, so Change opens again as he left it */
        if(Object.keys(body).length) amendMemo[order.id]={base:base, vals:[aq.input.value,at.input.value,ad.input.value,way.value]};
        /* Fable's review: a move already on its way answers nothing, so the Sheet waits for it rather than send part of itself */
        if(makerBusy||makerCashHeld[order.id]){ makerSay(order.id,'Another move on this page is on its way. Try again in a moment. Nothing was sent.'); return; }
        /* Fable's review: money above what is owed now waits for the change it rides on, which the row takes only once approved */
        var dueNow=ordDue(order), others=np||nh!==null||np2!==null;
        if(Object.keys(body).length&&np2!==null&&np2>dueNow+0.004){
          makerSay(order.id,'The change waits for your Approve, so record more than the '+rm(dueNow)+' owed now once it is approved. Nothing was sent.'); return;
        }
        if(Object.keys(body).length){
          var done=await makerTap(order,'restate',body,'Change sent. You approve it next, under Approve.');
          if(!makerRids[order.id+'restate'+JSON.stringify(body)]) delete amendMemo[order.id];
          var asked=makerOutside[order.id]; delete makerOutside[order.id];
          if(done!==true){
            if(asked){ amendWhy(order,opener,body,asked); if(others) makerSay(order.id,'Give the reason first. The point, handover and payment were not sent: send them with Change once it has gone.'); }
            return;
          }
        }
        if(lowering){
          var lb={why:lw.value.trim()};
          if(lowerPaid()) lb.paid=Math.round(Number(lp.value)*100)/100;
          if(lowerMoved()) lb.moved=Number(hq.value);
          if(await makerTap(order,'lower',lb,'Take-back sent. You approve it next, under Approve.')!==true) return;
        }
        if(goBack&&await makerMove(cur(),{back:true},'Back to Agreed. They are told.')!==true) return;
        if(np&&!goBack&&await makerMove(cur(),{point:np},'Collection point changed to Point '+np+'.')!==true) return;
        if(nh!==null){
          var ends=rest&&rest.value==='all'&&nh<Number(order.qty)-0.0004;
          if(await makerTap(cur(),'handed',ends?{qty:nh,close:true}:{qty:nh},ends?'Finish sent to the Desk.':'Handover sent to the Desk.')!==true) return;
        }
        if(np2!==null){
          if(road==='cash') makerCashHold(cur(),np2);
          else if(await makerTap(cur(),'received',{amount:np2},'Sent to the Desk.')!==true) return;
        }
        /* the window last, so a change of way has landed before it (Fable's review) */
        if(nw) await makerMove(cur(),{slot:nw},winEarlier(nw)?'Window moved earlier. They are told.':'The later window is sent for their yes.');
      }});
    tellDraw();
  }
  /* 10 Nov 2026 (his ask D): the change sits outside the price band, so the Desk asked for his reason: the same Sheet says its sentence and takes one Reason line,
     and Let it stand sends the same figures again with it, under a request id of its own */
  function amendWhy(order,opener,body,asked){
    var wrap=el('label','amb-field'), input=actOn(el('input','amb-input'),'order.amend-reason',order.id);
    input.type='text'; input.maxLength=120; input.required=true; input.setAttribute('data-one-off','');
    wrap.appendChild(el('span','amb-field__label',ONE_OFF_WORDS.reason)); wrap.appendChild(input);
    makerAsk(order,opener,'amend',{title:ONE_OFF_WORDS.title, plain:true, primary:true, go:ONE_OFF_WORDS.go, keep:ONE_OFF_WORDS.keep, say:[asked.say], extra:[wrap],
      yes:function(){
        if(!oneOffOk(input.value)) return;
        var sent=Object.assign({},body,{oneOff:input.value.trim()});
        makerTap(order,'restate',sent,ONE_OFF_WORDS.sent).then(function(done){ if(done) delete amendMemo[order.id]; });
      }});
    var go=document.getElementById('ynGo');
    if(go){ go.disabled=true; input.addEventListener('input',function(){ go.disabled=!oneOffOk(input.value); }); }
  }
  /* ---- 16 OCT 2026, PLAN 4 OF docs/plans-counter-admin.html: EASY REVERT (his answers: the newest move only; a site order's customer told by a banner) ----
     On an agreed order's card, on each line of an order of several books and on Correct a row, History reads a sale's booked moves from the Desk, newest
     first, and offers Undo on the newest alone, so undos peel back in order. The Desk says what undoing it sets and its Now and After, and why it waits when it
     does (money on its way, a move under Approve, the site's order not caught up); the Counter reckons nothing. Undo asks on the page's Sheet, Now and After
     and one action, and lands under Approve as one card: a Correction by Correct a row's road, or, for a change of a site order's terms, the order's own
     restate, so the order keeps its row. ---- */
  var undoRead={};
  function moveBits(m,handover){
    var bits=[];
    if(m.cash) bits.push(rm(m.cash)+' paid');
    if(m.kg) bits.push(units(Math.abs(m.kg))+(m.kg<0?' taken back':' '+(handover==='delivered'||handover==='collected'?handover:'handed over')));
    if(!bits.length) bits.push(m.kind==='Correction'?(m.changed&&m.changed.length?'Changed '+m.changed.map(function(k){ return fieldWord(k).toLowerCase(); }).join(', '):'A change')
      :m.kind==='Modification'?'Size and price restated':m.kind==='Cancellation'?'Cancelled':'A '+String(m.kind||'step').toLowerCase());
    return bits.join(', ')+(m.undone?', undone':'');
  }
  function moveSay(m,handover){
    var t=moveBits(m,handover), u=m.undone?', undone':'';
    return (u?t.slice(0,t.length-u.length):t)+(m.date?', '+fmtWhen(m.date):'')+u;
  }
  function moveStepKind(m){ return m.cash?'Payment':m.kg?'Handover':({Correction:'Correction',Modification:'Size and price',Cancellation:'Cancellation'})[m.kind]||'Step'; }
  function undoGo(h){
    var u=h.undo, a=u.after;
    if(u.kind==='terms') return 'Undo: '+h.rid+' at '+rm(a.total);
    if(u.kind==='hand') return 'Undo: '+h.rid+' '+handedSay(a)+' handed over';
    return 'Undo: '+h.rid+(a.owed>0.004?' owes '+rm(a.owed):' paid');
  }
  function historyBlock(card,ref,key,order,sayKey){
    /* 18 Oct 2026: the customer's fold (oHist in stmt/page.js), shut until a tap; opening it reads the moves once, and Read it again stays inside.
       16 Nov 2026 (Ambient, place G): the moves are the Journal, newest first, each its day, its reference and its kind over its sentence, Undo under the newest alone */
    var box=el('details','undohist'), sm=el('summary','amb-more'), cnt=el('span','amb-section__note undohist__n','·'), body=el('div','undohist__body amb-stack'),
        list=el('div','undolist amb-stack'), said=el('p','amb-field__hint msg'); said.setAttribute('role','status'); box.setAttribute('data-history',key);
    actOn(sm,'undo.fold',key); sm.appendChild(document.createTextNode(order?'Order log':'What happened, step by step')); sm.appendChild(cnt); box.appendChild(sm); box.appendChild(body);
    var read=makerButton(body,[undoRead[key]?'Read it again':'Read the moves','undo.history',key],async function(){
      said.textContent='Reading.';
      var j=await refs('/all/maker/undo',ref);
      undoRead[key]=j.history; drawHist(j.history); said.textContent=''; box.open=true;
    },false);
    box.addEventListener('toggle',function(){ if(box.open&&!undoRead[key]&&read&&read.click) read.click(); });
    function drawHist(h){
      list.textContent=''; cnt.textContent=String(h.moves.length);
      if(!h.moves.length) list.appendChild(el('p','amb-empty rnone','Nothing booked since the row was entered.'));
      else{
        var ol=el('ol','amb-journal');
        h.moves.forEach(function(m){
          var line=el('li','amb-journal__entry'), meta=el('p','amb-journal__meta'), when=el('time',null,m.date?fmtWhen(m.date):'Undated');
          line.setAttribute('data-move',String(m.i));
          if(m.date) when.setAttribute('datetime',String(m.date).slice(0,10));
          meta.appendChild(when); if(h.rid) meta.appendChild(el('span','amb-journal__ref',h.rid)); meta.appendChild(el('span','amb-journal__kind',moveStepKind(m)));
          line.appendChild(meta); line.appendChild(el('p','amb-journal__text',moveBits(m,h.handover)));
          if(h.undo&&h.undo.i===m.i&&!h.undo.blocked) undoButton(line,h,m,key,order,sayKey||key);
          ol.appendChild(line);
        });
        list.appendChild(ol);
      }
      if(h.undo&&h.undo.blocked){ var w=el('p','amb-field__hint',h.undo.blocked); w.setAttribute('data-undo-blocked',''); list.appendChild(w); }
      else if(!h.undo&&h.why&&h.moves.length){ var n=el('p','amb-field__hint','The newest move is not undone here: '+h.why+'.'); n.setAttribute('data-undo-none',''); list.appendChild(n); }
    }
    body.appendChild(list); body.appendChild(said); card.appendChild(box);
    if(undoRead[key]){ drawHist(undoRead[key]); box.open=true; }
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
    },false);
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
      /* 2 Nov 2026 (his Orders canvas, page 2): Change the order a row of its own list, and This customer and the Order log the rows that go on */
      if(order.status==='done'&&!order.test&&!makerAgainAck(order)){
        var redoList=aGroup(null,'ostagerows'); card.appendChild(redoList);
        var redo=aActBtn(redoList,['Change','order.amend'],function(){ amendOpen(order,redo); });
        redo.setAttribute('data-amend',''); makerAskTag(order,redo,'amend');
      }
      if(order.status==='done') ordNext(card,order,true);   /* plan 4 */
      if(makerAgainAck(order)) again=makerAcceptAgain(card,order,acts);
      makerAgain(card,order,acts);
      if(orderAsked(order)) makerOrderMoves(card,order,true);
    }else card.setAttribute('data-key',e.id);
    if(makerCashHeld[e.id]){ makerCashControls(card,order||{id:e.id}); cashed=true; }
    makerCardFoot(card,acts,e.id,cashed,!!again);
    if(again) again();
    return card;
  }
  /* the Desk's rows waiting for him and the entries the server holds, on Orders > Approve */
  /* 16 Oct 2026, PLAN 2 OF docs/plans-counter-admin.html: THE APPROVE CARD, FOR A PERSON. Still the system's approve card (salt-approve, carried whole by SITE_RECIPES and
     restated nowhere), now saying what the change does rather than what the order is. Its head is the row, the customer's code and the book's mark, and where the entry
     came from and when; then one plain verb; then Now and After, Paid, Owed and Handed over, read off the engine's figures the Desk sends with the draft (src/approve-figures.js)
     and computed nowhere here, only what changes marked; then at most two lines that ask a decision; then Approve, saying the result, Reject and Details, which keeps the
     drafter's whole note, every flag and the row. Every draft on one row, or on one trip, is one card and one Approve. */
  function draftAt(d){ return String(d&&d.id||''); }
  function isMarketDraft(d){ var p=((d.entry||{}).payload)||{}; return p.mode==='edit'&&Object.prototype.hasOwnProperty.call(MARKET_WORD,p.kind); }
  function draftParty(d){ var e=d.entry||{}, p=e.payload||{}; return d.party||e.party||p.party||''; }
  function draftRid(d){ var r=d.row||{}, f=d.figures||{}; return f.rid||r.rid||(/^[a-z]{1,3}[0-9]+$/i.test(String(d.amends||''))?d.amends:''); }
  /* where the entry came from: Salt Admin's own inputs carry their request, a site order's its id (his taps on it are the Desk's own), the laptop's queue holds the bare
     payload, and the phone typed the rest */
  function draftFrom(d){
    var e=d.entry||{};
    if(e.makerRequest) return 'Salt Admin';
    if(e.orderId) return e.by==='desk'||e.counter?'Salt Admin':'the site';
    if(!e.type&&e.payload) return 'laptop';
    return e.type?'phone':'';
  }
  /* a trip's rows (the Desk decides them in one batch) or every move on one row is one card, in the order entered. A customer's claim stands alone: it is answered
     on its order's card, never approved here, so it never shuts his own move on the same row (Fable's review of 16 Oct 2026) */
  function draftClaim(d){ var e=d.entry||{}; return !!(e.claim||e.fulfil&&e.fulfil.claim); }
  /* 20 Nov 2026 (his Received on CZ5-TM's claim, stranded): a claim's row his Received was given for, which came out other than he was shown, is a
     row like any other, as the Desk's decideDraft says; only a claim still waiting on his Received is answered on its payment card */
  function claimHeard(d){ return !!(d.preapproval&&d.preapproval.state==='differs'); }
  function claimAsks(d){ return draftClaim(d)&&!claimHeard(d); }
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
    if(k==='other'){ var ts=g.drafts.length===1?tierSets(g.lead):[]; return ts.length===1?'Approve '+tierWord(ts[0].v):'Approve'; }
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
    [/inventory the book puts at|owed out|unmeetable|a count of this book/i,'stock'],[/on the book by party, date, size and total/i,'twin'],
    [/^The Median at .* goes from/i,'median'],[/^Outside the band/i,'band']];
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
    var tb=el('table','amb-table apnow'), hd=el('tr'), body=el('tbody'), thead=el('thead');
    [['',''],['Now','col'],['After','col']].forEach(function(h,i){ var th=el('th',i?'is-num':'',h[0]); if(h[1]) th.setAttribute('scope','col'); hd.appendChild(th); });
    thead.appendChild(hd); tb.appendChild(thead);
    [['Paid',rm(fg.now.paid),rm(fg.after.paid)],['Owed',rm(fg.now.owed),rm(fg.after.owed)],['Handed over',handedSay(fg.now),handedSay(fg.after)]].forEach(function(r){
      var tr=el('tr'), th=el('th','',r[0]); th.setAttribute('scope','row'); tr.appendChild(th);
      tr.appendChild(el('td','is-num',r[1]));
      var td=el('td','is-num');
      if(r[1]!==r[2]){ td.className='is-num apchg'; td.appendChild(el('strong','',r[2])); } else td.textContent=r[2];
      tr.appendChild(td); body.appendChild(tr);
    });
    tb.appendChild(body); return tb;
  }
  /* 18 Oct 2026, CLARITY PART 4: a refusal is said with a verb. The reason's own words stay where no verb can be built from them. */
  var NOT_TAKEN=[[/YYYY-MM-DD/,'fix the date'],[/no date|date it|the date|a date/i,'add the date'],[/no cost/i,'add the cost'],[/reason/i,'add the reason'],[/quantity|units that|the units|ringgit/i,'add the amount'],[/no OPEN order|settled or cancelled/i,'check the order'],[/reseed/i,'reseed the mirror']];
  function notTaken(why){
    var w=noBook(why||'The Desk could not take this entry.');
    for(var i=0;i<NOT_TAKEN.length;i++) if(NOT_TAKEN[i][0].test(w)) return 'Not taken: '+NOT_TAKEN[i][1];
    return 'Not taken: '+w;
  }
  /* the waiting claim a claim draft answers, by the id its entry carries */
  function claimOf(d){
    var e=d.entry||{}, c=e.claim||(e.fulfil&&e.fulfil.claim)||e.claimId, id=c&&typeof c==='object'?c.id:c;
    return makerClaims.filter(function(x){ return String(x.id)===String(id); })[0]||null;
  }
  /* 16 Nov 2026 (the move to Ambient, place F): a list of read-only settings (Ambient's rows), the drafter's own words above it */
  function apPairs(pairs){
    var rows=pairs.filter(function(p){ return p[1]!=null&&p[1]!==''; }).map(function(p){ return amb.setting(p[0],String(p[1])); });
    return amb.node(amb.settings('',rows));
  }
  function apDetailBox(act,key,pairs){
    var box=el('details','rdet apdet');
    box.appendChild(actOn(el('summary','amb-pill amb-pill--sm amb-pill--quiet','Details'),act,key));
    box.appendChild(apPairs(pairs)); return box;
  }
  function apDetails(g,src){
    var panel=el('div','rdet rdet--row apdet'); panel.hidden=true;
    /* 18 Oct 2026, CLARITY PART 4: where the entry came from lives here, and the row's id in the list below; the head leads with the customer and the sale */
    if(src) panel.appendChild(el('p','amb-task__text apentry',src));
    g.drafts.forEach(function(d,i){
      if(g.drafts.length>1) panel.appendChild(el('h4','amb-section',(g.trip?'Row ':'Move ')+(i+1)+' of '+g.drafts.length+': '+moveWord(d)));
      if(d.reasoning) panel.appendChild(el('p','amb-task__text apreason',noBook(d.reasoning)));
      (d.flags||[]).forEach(function(f){ panel.appendChild(el('p','amb-task__text apnote',noBook(f))); });
      /* the draft's reference and the row in his words, and the row's id where the drafter left it off the row */
      panel.appendChild(apPairs(rowPairs(d.row,d.id).concat(d.row&&d.row.rid||!draftRid(d)?[]:[['Row reference',draftRid(d)]])));
    });
    return panel;
  }
  /* an entry waiting for the Desk, by its moment when it has one: Entry of 09 Oct 2026, 14:11 */
  function entryLine(entry){ var at=isoAt(entry.id)||entry.date||''; return 'Entry'+(at?' of '+fmtWhen(at):''); }
  /* 22 OCT 2026 (his multi-tick Approve, canvas Salt Admin Approve, docs/plan-approve-many.html): EVERY CARD IS TICKED, NOT DECIDED. Its Approve
     and Reject choose (one or the other, the card whole: a trip's rows, or every move on one order); Approve all chooses Approve on every card that
     can go; the bar counts both ways with Clear and Confirm, and Confirm asks once, listing every card, then sends them all in one request
     (decide-many), so they fold together. A card the Desk would not decide stays, with why and how to fix it; the rest go. A payment they say they
     sent is never ticked: it is answered on its order. A pick is kept by the card's first draft and let go when the card leaves. */
  var apPick={}, apRefused={}, apDone=null;
  function apTickable(g){ return !g.drafts.some(claimAsks); }
  /* a refusal is kept by every draft of its card, so a card whose first move went and whose lead has changed still says it */
  function apGone(g){ for(var i=0;i<g.drafts.length;i++){ if(apRefused[g.drafts[i].id]) return apRefused[g.drafts[i].id]; } return null; }
  function apGroups(){ return draftGroups(pendingRows()).filter(apTickable); }
  function apChose(g,v){ apPick[g.lead.id]=apPick[g.lead.id]===v?null:v; apDone=null; drawMaker(); }
  function apBarDraw(){
    var bar=document.getElementById('apBar'); if(!bar) return;
    var gs=apGroups(), A=gs.filter(function(g){ return apPick[g.lead.id]==='a'; }), R=gs.filter(function(g){ return apPick[g.lead.id]==='r'; });
    bar.textContent=''; bar.hidden=!(A.length+R.length);
    /* 17 Nov 2026, the move to Ambient (Fable's review, item 2): Ambient keeps a dock's save bar room clear even while it is hidden, so the class stands only while it shows */
    bar.classList.toggle('amb-savebar',!bar.hidden);
    try{ drawNeedOpen(false); }catch(e){}
    if(bar.hidden) return;
    bar.appendChild(el('span','amb-savebar__text apbar__line',[A.length?A.length+' to approve':'',R.length?R.length+' to reject':''].filter(Boolean).join(' \u00b7 ')));
    var acts=el('span','apbar__acts');
    var clear=actOn(el('button','amb-pill amb-pill--sm amb-pill--quiet','Clear'),'approve.clear'); clear.type='button';
    clear.addEventListener('click',function(){ apPick={}; drawMaker(); });
    var go=actOn(el('button','amb-pill amb-pill--sm amb-pill--accent','Confirm'),'approve.confirm'); go.type='button'; ynTag(go,'approve:confirm');
    go.addEventListener('click',function(){ apConfirm(go,A,R); });
    acts.appendChild(clear); acts.appendChild(go); bar.appendChild(acts);
  }
  /* 12 Nov 2026 (his Approve review): ticking a card and tapping Confirm is already the second look, so a batch of approvals goes on Confirm. The Sheet asks
     only when a Reject is among them: a rejected row a site order made is written onto that order, and that is asked first. */
  function apConfirm(go,A,R){
    var n=A.length+R.length, extra=[];
    if(A.length){ extra.push(el('p','amb-section apsheet apsheet--a',A.length+' to approve')); A.forEach(function(g){ g.drafts.forEach(function(d){ extra.push(deskAskRow(d)); }); }); }
    if(R.length){ extra.push(el('p','amb-section apsheet apsheet--r',R.length+' to reject')); R.forEach(function(g){ g.drafts.forEach(function(d){ extra.push(deskAskRow(d)); }); }); }
    var asked=R.length?ownerAsk(go,'approve:confirm',{title:'Decide '+n+(n===1?' card?':' cards?'), extra:extra, plain:true,
      say:['Each is decided as drafted. One that cannot go stays here with why and how to fix it; the rest go.'],
      go:'Confirm '+n, keep:'Not yet'}):Promise.resolve(true);
    return asked.then(function(yes){
      if(!yes||makerBusy) return;
      makerBusy=true; go.disabled=true;
      var ids=function(gs){ return [].concat.apply([],gs.map(function(g){ return g.drafts.map(function(d){ return d.id; }); })); };
      var lead={}, grp={}; A.concat(R).forEach(function(g){ g.drafts.forEach(function(d){ lead[d.id]=g.lead.id; grp[d.id]=g; }); });
      return refs('/all/maker/drafts/decide-many',{approve:ids(A), reject:ids(R)}).then(function(j){
        var went={}, refused=j.refused||[], hit={};
        (j.decided||[]).forEach(function(d){ went[lead[d.id]||d.id]=d.decision; });
        refused.forEach(function(r){ var k=lead[r.id]||r.id, said={why:noBook(r.error||''), fix:r.fix||''}; hit[k]=1;
          (grp[r.id]?grp[r.id].drafts:[{id:r.id}]).forEach(function(d){ apRefused[d.id]=said; }); });
        var a=A.filter(function(g){ return !hit[g.lead.id]&&went[g.lead.id]==='approved'; }).length, rj=R.filter(function(g){ return !hit[g.lead.id]&&went[g.lead.id]==='rejected'; }).length;
        apDone={a:a, r:rj, refused:Object.keys(hit).length};
        apPick={};
      },function(error){ apDone={error:error.message}; }).then(function(){ makerBusy=false; return loadMaker(); });
    });
  }
  function drawDeskRows(draftRoot,queueRoot,pendingRows){
    var live=draftGroups(pendingRows), liveIds={}, liveDrafts={};
    live.forEach(function(g){ liveIds[g.lead.id]=1; g.drafts.forEach(function(d){ liveDrafts[d.id]=1; }); });
    Object.keys(apPick).forEach(function(k){ if(!liveIds[k]) delete apPick[k]; });
    Object.keys(apRefused).forEach(function(k){ if(!liveDrafts[k]) delete apRefused[k]; });
    if(apDone){
      var dn;
      if(apDone.error) dn=amb.node(amb.notice(apDone.error,true));
      else {
        var parts=[apDone.a?apDone.a+' approved':'',apDone.r?apDone.r+' rejected':''].filter(Boolean);
        dn=amb.node(amb.notice(parts.length?parts.join(' and ')+(apDone.a?'. They fold together, one version.':'.'):'Nothing went. The refused cards say why below.',false,(apDone.a+apDone.r)+' decided'+(apDone.refused?', '+apDone.refused+' refused':'')));
      }
      dn.classList.add('apdone'); dn.setAttribute('role','status');
      draftRoot.appendChild(dn);
    }
    var ticks=live.filter(apTickable);
    if(ticks.length){
      var hr=el('div','aphead'); hr.appendChild(el('h2','amb-section aphead__n',ticks.length+' to decide'));
      /* 12 Nov 2026 (his Approve review): Approve all beside one card is that card's Approve, so it stands from two */
      if(ticks.length>1){
        var all=actOn(el('button','amb-pill amb-pill--sm amb-pill--quiet','Approve all'),'approve.all'); all.type='button';
        all.addEventListener('click',function(){ ticks.forEach(function(g){ if(!apGone(g)) apPick[g.lead.id]='a'; }); apDone=null; drawMaker(); });
        hr.appendChild(all);
      }
      draftRoot.appendChild(hr);
    }
    live.forEach(function(g){
      /* 16 Nov 2026 (the move to Ambient, place F): AN APPROVAL IS AMBIENT'S, the figures that decide first (the cost and his margin stay, the hard rule), then why it
         was flagged, then the two small pills: Approve and Reject choose, and the card says which in its chip */
      var draft=g.lead, pick=apPick[draft.id], gone=apGone(g), claim=g.drafts.some(claimAsks), heard=g.drafts.some(function(d){ return draftClaim(d)&&claimHeard(d); });
      var card=el('article','amb-task apcard'+(pick==='r'?' ap--r':pick==='a'?' ap--a':gone?' ap--r':'')), head=el('div','amb-task__head apphead');
      card.setAttribute('data-maker-card','draft:'+draft.id); draftRoot.appendChild(card);
      var rid=g.tripMoves?'':draftRid(draft), from=draftFrom(draft), when=fmtWhen(isoAt(draft.id)||draft.date||(draft.entry||{}).date||''), party=el('span','amb-task__kind apparty');
      /* the head: the customer's code, and the state of the card */
      party.appendChild(document.createTextNode(draftParty(draft)||(isMarketDraft(draft)?'Median Price':'no code')));
      if(g.tripMoves) party.appendChild(document.createTextNode(' \u00b7 '+tripMoveRows(g).length+' books, one order'));
      else if(draft.product&&(draft.collection==='sales'||draft.collection==='purchases')){ party.appendChild(document.createTextNode(' ')); party.appendChild(nBook(draft.product)); }
      head.appendChild(party);
      var kind=groupKind(g), verb=kind==='other'?entryWord(draft.entry||{}):AP_WORD[kind], fg=groupFigures(g), closed=kind==='close'?closeSay(g):'';
      if(gone) head.appendChild(el('span','amb-chip amb-chip--neg','Refused')); else if(pick) head.appendChild(el('span','amb-chip'+(pick==='a'?' amb-chip--pos':' amb-chip--neg'),pick==='a'?'To approve':'To reject'));
      card.appendChild(head);
      card.appendChild(el('h3','amb-task__title apverb',verb+(closed?': '+closed:'')));
      var figs=[];
      if(fg&&fg.now) card.appendChild(nowAfter(fg));
      else if(g.tripMoves) tripMoveRows(g).forEach(function(r){
        /* each line of the order: its mark and row, then its Now and After as the Desk sent them; nothing is added up here */
        var h=el('p','amb-task__text apline'); h.appendChild(nBook(r.product)); h.appendChild(document.createTextNode(' '+r.rid)); card.appendChild(h);
        if(r.fg) card.appendChild(nowAfter(r.fg));
      });
      else if(!draft.amends){
        g.drafts.forEach(function(d){
          if(tierSets(d).length){
            var many=Object.keys((d.row||{}).tiers||{}).length>1;
            tierSets(d).forEach(function(s){ var p=el('p','amb-task__text aptier'), was=tierWas(d,s); if(many) p.appendChild(document.createTextNode(s.code+' ')); p.appendChild(nBook(s.product)); p.appendChild(document.createTextNode(' '+tierWord(s.v)+(was?', was '+was:''))); card.appendChild(p); });
          }
          else if(noFigure(d)){ if(d.reasoning) card.appendChild(el('p','amb-task__text apsays',firstSentence(d.reasoning))); }
          else {
            var bl=el('p','amb-task__text apline');
            if(d.qty==null) bl.appendChild(document.createTextNode(rm(d.total)));
            else { bl.appendChild(document.createTextNode(units(d.qty)+(d.product?' ':''))); if(d.product) bl.appendChild(nBook(d.product)); bl.appendChild(document.createTextNode(', '+rm(d.total))); }
            card.appendChild(bl);
          }
          figs=figs.concat(readingFigures(d)); });
        if(figs.length){ var fr=el('div','amb-task__figures apfigs'); figs.forEach(function(f){ fr.appendChild(amb.node(amb.stat(f[0],f[1]))); }); card.appendChild(fr); }
        if(g.trip) card.appendChild(el('p','amb-task__text',g.drafts.length===2?'Two books, one trip: Approve decides both.':g.drafts.length+' books, one trip: Approve decides all of them.'));
      }
      if(fg&&fg.approvedBefore) card.appendChild(el('p','amb-task__text aphalf','Half approved: '+(fg.approvedBefore===1?'one move':fg.approvedBefore+' moves')+' on this row approved before, waiting to be booked; '+(g.drafts.length===1?'this one waits for you.':'these wait for you.')));
      var asks=askLines(g);
      if(asks.length){ var fl=el('ul','amb-task__flags apflags'); asks.forEach(function(line){ var li=el('li','apflag'); li.appendChild(el('span','amb-chip amb-chip--warn',line)); fl.appendChild(li); }); card.appendChild(fl); }
      /* the Book's own reason, when it refused his yes, is what he reads instead (shown.refused); and a claim against the account has no order to offer
         its move again, so a Reject would leave their page reading the money received and the book never holding it: Approve alone (Fable, 20 Nov 2026) */
      var heardWhy=heard?g.drafts.map(function(d){ var s=d.preapproval&&d.preapproval.shown; return s&&s.refused?String(s.refused).replace(/[.]+$/,''):''; }).filter(Boolean)[0]||'':'',
          heardAcct=heard&&g.drafts.some(function(d){ var e=d.entry||{}; return draftClaim(d)&&e.claimId&&!e.orderId; });
      if(heard&&!claim) card.appendChild(el('p','amb-task__text apheard',heardWhy?'Received given. The book would not take its row: '+heardWhy+'.':'Received given. Its row came out different from what you saw, so Approve books it.'));
      var panel=apDetails(g,[from?'from '+from:'',when].filter(Boolean).join(', '));
      var more=actOn(el('button','amb-pill amb-pill--sm amb-pill--quiet apmore','Details'),'row.proposed'); more.type='button'; more.setAttribute('aria-expanded','false');
      more.addEventListener('click',function(){ var open=more.getAttribute('aria-expanded')!=='true'; more.setAttribute('aria-expanded',String(open)); panel.hidden=!open; });
      head.appendChild(more);
      if(gone){
        var rb=amb.node(amb.notice('',true,'Refused')); rb.classList.add('aprefused');
        var rs=rb.querySelector('span');
        var w=el('span','aprefused__why'); w.appendChild(el('b',null,'Why: ')); w.appendChild(document.createTextNode(gone.why)); rs.appendChild(w);
        var fx=el('span','aprefused__fix'); fx.appendChild(el('b',null,'To fix: ')); fx.appendChild(document.createTextNode(gone.fix)); rs.appendChild(fx);
        card.appendChild(rb);
      }
      var acts=el('div','amb-task__acts apticks');
      if(claim){
        /* 18 Oct 2026, CLARITY PART 4: the claim's answer is on its payment card, and this opens that card (Orders > Payments, the claim's card open) */
        var to=actOn(el('button','amb-pill amb-pill--sm amb-pill--quiet aplink','Open the payment card'),'approve.to-payment',draft.id); to.type='button';
        to.addEventListener('click', function(){ var c=claimOf(draft); if(c) makerClaimOpen=c.u+':'+c.id; goPlace('orders','payments')(); });
        acts.appendChild(to);
      } else {
        acts.setAttribute('role','group'); acts.setAttribute('aria-label','Decide this card');
        var approve=actOn(el('button','amb-pill amb-pill--sm'+(pick==='a'?'':' amb-pill--quiet'),approveLabel(g)),'draft.approve'); approve.type='button'; approve.setAttribute('aria-pressed',String(pick==='a'));
        var reject=actOn(el('button','amb-pill amb-pill--sm'+(pick==='r'?'':' amb-pill--quiet'),g.trip?rejectWord(g.drafts.length):g.drafts.length>1?'Reject all':'Reject'),'draft.reject'); reject.type='button'; reject.setAttribute('aria-pressed',String(pick==='r'));
        approve.addEventListener('click',function(){ apChose(g,'a'); }); reject.addEventListener('click',function(){ apChose(g,'r'); });
        acts.appendChild(approve); if(!heardAcct||heardWhy) acts.appendChild(reject);
      }
      card.appendChild(acts);
      card.appendChild(panel);
      makerFoot(card,'draft:'+draft.id);
    });
    (makerData.refused||[]).filter(function(r){ return !suiteRow(r); }).forEach(function(refused){
      var card=el('article','amb-task amb-task--neg aprefusedrow'), rh=el('div','amb-task__head');
      rh.appendChild(el('span','amb-task__kind','The Desk')); rh.appendChild(el('span','amb-chip amb-chip--neg','Refused')); card.appendChild(rh); draftRoot.appendChild(card);
      card.appendChild(el('p','amb-task__text',notTaken(refused.why)));
    });
    if(!pendingRows.length&&!(makerData.refused||[]).filter(function(r){ return !suiteRow(r); }).length) draftRoot.appendChild(el('p','rnone','Nothing waits for your approval.'));
    if(queueRoot){
      /* 14 Oct 2026 (his screenshot): a copy a device still holds of an entry already approved or committed is not waiting for anything,
         so it is not listed; it leaves the device's key when that device next posts */
      queueRoot.textContent='';
      var held=(makerData.queue||[]).filter(function(e){ return e&&e.state!=='committed'&&e.state!=='approved'; }), counted=document.getElementById('makerQueueCount');
      /* the queue is a fold shut by default, titled and counted, so it is never read as missing: its count is read off the entries the server holds */
      if(counted) counted.textContent=String(held.length);
      /* plan 1: a queue key the Desk could not read is said first, by its name, and never read as an empty queue */
      var bad=unreadableKeys();
      /* 12 Nov 2026 (his Approve review): with nothing sent and no key unread the fold says nothing worth a line, so it is not drawn */
      var fold=document.getElementById('makerQueue'); if(fold) fold.hidden=!held.length&&!bad.length;
      if(bad.length){ var ub=el('p','msg bad',unreadableLine(bad)); ub.setAttribute('data-unreadable',''); queueRoot.appendChild(ub); }
      if(!held.length&&!bad.length) queueRoot.appendChild(el('p','rnone','Nothing is waiting for the Desk.'));
      held.forEach(function(entry){
        var card=el('article','amb-task apcard apqueued'+(entry.state==='refused'?' amb-task--neg':'')), title=entry.state==='refused'?'The Desk refused this entry':'Entry waiting for the Desk'; card.setAttribute('data-key',entry.id);
        queueRoot.appendChild(card);
        var qh=el('div','amb-task__head'); qh.appendChild(el('span','amb-task__kind','Queue')); qh.appendChild(el('span','amb-chip'+(entry.state==='refused'?' amb-chip--neg':''),entry.state==='refused'?'Refused':'Waiting')); card.appendChild(qh);
        card.appendChild(el('h3','amb-task__title',title));
        card.appendChild(el('p','amb-task__text',entryLine(entry)+', '+(entry.state==='refused'?'refused':'waiting for the Desk')+'.'));
        if(entry.device) card.appendChild(el('p','amb-task__text','From another device.'));
        if(entry.seenAt) card.appendChild(el('p','amb-task__text','Seen '+fmtWhen(entry.seenAt)+'.'));
        if(entry.why) card.appendChild(el('p','amb-task__text',noBook(entry.why)));
        card.appendChild(apDetailBox('queue.details',entry.id,[['Reference',entry.id],['Sent',fmtWhen(isoAt(entry.id)||entry.date)],['State',entry.state==='refused'?'Refused':'Waiting for the Desk']]));
        if(entry.unavailable) card.appendChild(el('p','msg',entry.unavailable));
        if(entry.canWithdraw||entry.canRetry){
          var note=el('p','msg'); note.setAttribute('role','status'); card.appendChild(note);
          var qacts=el('div','amb-task__acts'); card.appendChild(qacts);
          var action=makerClaimButton(qacts,[entry.canRetry?'Finish the withdrawal':'Withdraw this entry','queue.withdraw'],function(button){
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
          ambBtn(action,true); action.classList.add('maker-queue-action');
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
    try{ makerHours=await refs('/all/maker/hours'); hrsDraft=null; hrsEditing=null; hrsCopy=null; drawMakerHours(); }
    catch(error){ var s=document.getElementById('makerHoursStatus'); if(s) refusal(s,error); }
  }
  /* 20 Oct 2026 (his eight answers to Fable's design): THE MOST CONTROL OVER THE HOURS. The draft holds the week and the dated days, each
     day null (closed) or a list of spans; a weekday is keyed by its number (0 is Sunday), a dated day by its date. Nothing is sent until
     Done, which sends the whole of it; Discard changes puts the saved week back; Undo, for a minute after Done, sends the week it replaced. */
  var hrsDraft=null, hrsSaved='', hrsEditing=null, hrsCopy=null, hrsUndo=null, hrsAdding=false, hrsPv=null, hrsPvSeq=0, HRS_ORDER=[1,2,3,4,5,6,0];
  var HRS_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], HRS_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var HRS_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function hrsMin(t){ var p=String(t||'').split(':'); return p.length===2?(+p[0])*60+(+p[1]):null; }
  function hrsHm(m){ var h=Math.floor(m/60), x=m%60; return (h<10?'0':'')+h+':'+(x<10?'0':'')+x; }
  function hrsLate(s){ return !!s&&hrsMin(s.close)<hrsMin(s.open); }
  function hrsAnyLate(a){ return !!a&&a.some(hrsLate); }
  function hrsPct(m){ return (m/14.4).toFixed(2)+'%'; }
  function hrsArr(d){ return !d?null:(Array.isArray(d)?d:[d]).map(function(s){ return {open:s.open,close:s.close}; }); }
  function hrsOut(a){ return !a?null:a.length===1?{open:a[0].open,close:a[0].close}:a.map(function(s){ return {open:s.open,close:s.close}; }); }
  function hrsWeekOut(){
    var w={days:hrsDraft.days.map(hrsOut)}, keys=Object.keys(hrsDraft.dates).sort();
    if(keys.length){ w.dates={}; keys.forEach(function(k){ w.dates[k]=hrsOut(hrsDraft.dates[k]); }); }
    return w;
  }
  function hrsFromConfig(){
    var s=makerHours.config&&makerHours.config.schedule, days=(s&&s.days)||[], dates=(s&&s.dates)||{}, out={days:[0,1,2,3,4,5,6].map(function(i){ return hrsArr(days[i]); }), dates:{}};
    Object.keys(dates).forEach(function(k){ out.dates[k]=hrsArr(dates[k]); });
    return out;
  }
  function hrsDirty(){ return !!hrsDraft&&JSON.stringify(hrsWeekOut())!==hrsSaved; }
  function hrsIsDate(key){ return typeof key==='string'; }
  function hrsDayOf(key){ return hrsIsDate(key)?hrsDraft.dates[key]:hrsDraft.days[key]; }
  function hrsSet(key,a){ if(hrsIsDate(key)) hrsDraft.dates[key]=a; else hrsDraft.days[key]=a; }
  function hrsWeekday(ymd){ return new Date(ymd+'T00:00:00Z').getUTCDay(); }
  function hrsShift(ymd,n){ return new Date(Date.parse(ymd+'T00:00:00Z')+n*86400000).toISOString().slice(0,10); }
  /* the day before a row (its tail) and the day after it (a stretch that runs on): a weekday's are weekdays, a date's are the calendar's */
  function hrsBefore(key){ if(!hrsIsDate(key)) return hrsDraft.days[(key+6)%7]; var p=hrsShift(key,-1); return Object.prototype.hasOwnProperty.call(hrsDraft.dates,p)?hrsDraft.dates[p]:hrsDraft.days[hrsWeekday(p)]; }
  function hrsAfter(key){ if(!hrsIsDate(key)) return hrsDraft.days[(key+1)%7]; var p=hrsShift(key,1); return Object.prototype.hasOwnProperty.call(hrsDraft.dates,p)?hrsDraft.dates[p]:hrsDraft.days[hrsWeekday(p)]; }
  function hrsName(key){ if(!hrsIsDate(key)) return HRS_NAMES[key]; var d=new Date(key+'T00:00:00Z'); return HRS_SHORT[d.getUTCDay()]+' '+d.getUTCDate()+' '+HRS_MON[d.getUTCMonth()]; }
  function hrsShort(key){ return hrsIsDate(key)?hrsName(key):HRS_SHORT[key]; }
  function hrsAllDay(a){ return !!a&&a.length===1&&a[0].open==='00:00'&&a[0].close==='24:00'; }
  function hrsSaid(a){ return !a?'Closed':hrsAllDay(a)?'Open all day':a.map(function(s){ return s.open+' to '+s.close+(hrsLate(s)?' next day':''); }).join(', '); }
  /* the days a weekday copies to at first: the rest of its group (his answer 3), said "Mon to Thu" when they run on, else "Mon, Tue and Thu" */
  function hrsGroup(i){ return (i===0||i===6?[6,0]:[1,2,3,4,5]).filter(function(k){ return k!==i; }); }
  /* a quarter-hour picker, a close also offering 24:00; a time filed off the quarter hour stays a choice of its own, so Done never moves it unseen */
  function hrsPick(act,key,value,label,close){
    var s=actOn(el('select'),act,key), v=hrsMin(value), list=[];
    for(var m=0;m<1440;m+=15) list.push(m);
    if(close) list.push(1440);
    if(v!==null&&v%15) list.push(v);
    list.sort(function(a,b){ return a-b; }).forEach(function(m){ var o=el('option',null,hrsHm(m)); o.value=hrsHm(m); s.appendChild(o); });
    s.value=value; s.setAttribute('aria-label',label);
    return s;
  }
  /* a row: the name, a bar of the day's 24 hours (a rect a span, in hours; the day before's tail a strip from 00) and its hours in words, as Ambient's week of spans draws them */
  function hrsRow(key){
    var a=hrsDayOf(key), prev=hrsBefore(key), tails=(prev||[]).filter(hrsLate), dated=hrsIsDate(key), li=el('li'), b=actOn(el('button','amb-week__day'),dated?'hours.date':'hours.day',dated?key:HRS_NAMES[key]); b.type='button';
    b.setAttribute('aria-expanded',String(hrsEditing===key)); if(hrsEditing===key) b.setAttribute('aria-current','true');
    var said=hrsSaid(a), from=tails.length?hrsShort(dated?hrsShift(key,-1):(key+6)%7):'', own=!a?'Closed':hrsAllDay(a)?'All day':a.map(function(s){ return s.open+' to '+s.close; }).join(', ');
    if(tails.length) said+=a?', and '+from+' until '+tails[tails.length-1].close:' (open from '+from+' until '+tails[tails.length-1].close+')';
    b.setAttribute('aria-label',hrsShort(key)+': '+said+'. Change');
    b.appendChild(el('span','amb-week__name',hrsShort(key)));
    var bar=svgEl('svg',{'class':'amb-week__bar',viewBox:'0 0 24 1',preserveAspectRatio:'none','aria-hidden':'true'});
    tails.forEach(function(s){ bar.appendChild(svgEl('rect',{x:'0',y:'0.3',width:String(hrsMin(s.close)/60),height:'0.4'})); });
    (a||[]).forEach(function(s){ var o=hrsMin(s.open); bar.appendChild(svgEl('rect',{x:String(o/60),y:'0',width:String(((hrsLate(s)?1440:hrsMin(s.close))-o)/60),height:'1'})); });
    b.appendChild(bar);
    b.appendChild(el('span','amb-week__said'+(a?'':' off'),tails.length?'Until '+tails[tails.length-1].close+' from '+from+', then '+(a?own:'closed'):own));
    b.addEventListener('click',function(){ hrsEditing=hrsEditing===key?null:key; hrsCopy=null; hrsDraw(); hrsFocus(b.getAttribute('data-act'),b.getAttribute('data-key')); });
    li.appendChild(b); return li;
  }
  /* a redraw keeps the control in hand */
  function hrsFocus(act,key){ /* a key of null finds a control with none */ var root=document.getElementById('oShop')||document.getElementById('makerSchedule'), n=root&&[].filter.call(root.querySelectorAll('[data-act]'),function(x){ return x.getAttribute('data-act')===act&&x.getAttribute('data-key')===key; })[0]; if(n&&n.focus) n.focus(); }
  function hrsDraw(){ drawMakerHours(); hrsPreview(); }
  /* from 960px the open day stands in the pane beside the week (Ambient's panes; his 860 became 960 on 16 Nov 2026) */
  function hrsWide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:960px)').matches); }
  try{ var hrsMq=window.matchMedia&&window.matchMedia('(min-width:960px)'); if(hrsMq&&hrsMq.addEventListener) hrsMq.addEventListener('change',function(){ if(makerHours&&placeNow==='shop') hrsDraw(); }); }catch(e){}
  /* 26 Oct 2026, his word (Hours "the same change" as Notice and Practice): THE OPEN DAY IS A LIST OF SETTINGS. Its name heads it; Open and Open all
     day are switches; each span is an Opens row and a Closes row, a quarter-hour picker each; then a list of what can be done to the day, Add hours,
     Same as the day before, Copy to other days (a row a day, ticked), Remove this date and Discard changes in ember; what customers would see in
     one grey line; and Done, the one pill. Nothing is sent until Done, as before. 16 Nov 2026 (Ambient): the groups are amb-settings, the switches
     input.amb-switch, Done the pane's amb-foot. */
  function hrsSwitch(label,act,key,on,fn){
    var row=sSwitchRow(label,act,key,on), sw=row.sw;
    sw.addEventListener('click',function(){ fn(); hrsDraw(); hrsFocus(act,key); });
    return sLi(row);
  }
  function hrsAction(list,label,act,key,fn,dis,danger){
    var b=sAction(label,act,key,danger); b.disabled=!!dis;
    b.addEventListener('click',function(){ if(b.disabled) return; fn(); hrsDraw(); hrsFocus(act,key); }); list.appendChild(sLi(b)); return b;
  }
  var hrsSeq=0;
  function hrsTimeRow(label,select){ var row=el('label','amb-setting'); row.appendChild(el('span','amb-setting__name',label)); row.appendChild(sSelect(select)); return sLi(row); }
  function hrsEdit(key){
    var a=hrsDayOf(key), name=hrsIsDate(key)?key:HRS_NAMES[key], late=hrsAnyLate(a), box=document.createDocumentFragment();
    var g=sGroup(hrsName(key),'maker-dayedit'), list=g.list; g.setAttribute('role','group'); g.setAttribute('aria-label',hrsName(key)+' hours');
    list.appendChild(hrsSwitch('Open','hours.day-closed',name,!!a,function(){ hrsSet(key,a?null:[{open:'09:00',close:'17:00'}]); }));
    if(a){
      list.appendChild(hrsSwitch('Open all day','hours.day-allday',name,hrsAllDay(a),function(){ hrsSet(key,hrsAllDay(a)?[{open:'09:00',close:'17:00'}]:[{open:'00:00',close:'24:00'}]); }));
      if(!hrsAllDay(a)) a.forEach(function(s,j){
        var k=j?name+' '+(j+1):name, sl=hrsLate(s), n=j?' ('+(j+1)+')':'';
        var from=hrsPick('hours.day-from',k,s.open,hrsName(key)+' opens'+n,false), to=hrsPick('hours.day-to',k,s.close,hrsName(key)+' closes'+n+(sl?', next day':''),true);
        list.appendChild(hrsTimeRow('Opens'+n,from)); list.appendChild(hrsTimeRow('Closes'+n+(sl?', next day':''),to));
        [from,to].forEach(function(p){ p.addEventListener('change',function(){ var m=hrsArr(hrsDayOf(key)); m[j]={open:from.value,close:to.value}; hrsSet(key,m); hrsDraw(); hrsFocus(p.getAttribute('data-act'),k); }); });
        if(a.length>1){ var rm=hrsAction(list,'Remove these hours','hours.day-remove',k,function(){ var m=hrsArr(hrsDayOf(key)); m.splice(j,1); hrsSet(key,m); },false,true);
          rm.setAttribute('aria-label','Remove '+s.open+' to '+s.close); }
      });
    }
    box.appendChild(g);
    /* a stretch past midnight that reaches the next day's first opening runs on as one (openParts merges it): said, never refused */
    var next=hrsAfter(key), runs=late&&next&&a.filter(hrsLate).some(function(s){ return next.some(function(n){ return hrsMin(n.open)<=hrsMin(s.close); }); });
    if(late) g.appendChild(sFoot(runs?'Runs on into the next day’s hours: one stretch.':'Closes the next day.'));
    var ag=sGroup(null,'maker-dayedit-acts'), acts=ag.list;
    var last=a&&a[a.length-1], room=last&&!hrsLate(last)&&hrsMin(last.close)<=1380&&a.length<6;
    if(a&&!hrsAllDay(a)) hrsAction(acts,'Add hours','hours.day-add',name,function(){ var o=hrsMin(last.close)+60, m=hrsArr(a); m.push({open:hrsHm(Math.min(o,1425)),close:o+240>=1440?'24:00':hrsHm(o+240)}); hrsSet(key,m); },!room);
    if(!hrsIsDate(key)){
      var b4=(key+6)%7;
      hrsAction(acts,'Same as '+HRS_NAMES[b4],'hours.day-same',name,function(){ hrsSet(key,hrsArr(hrsDraft.days[b4])); });
      hrsAction(acts,'Copy to other days','hours.day-copy',name,function(){ hrsCopy=hrsCopy?null:hrsGroup(key); }).setAttribute('aria-expanded',String(!!hrsCopy));
    } else hrsAction(acts,'Remove this date','hours.date-remove',name,function(){ delete hrsDraft.dates[key]; hrsEditing=null; },false,true);
    if(hrsDirty()) hrsAction(acts,'Discard changes','hours.discard',null,function(){ hrsDraft=null; hrsEditing=null; hrsCopy=null; },false,true);
    box.appendChild(ag);
    /* Copy to (his answer): a row a day, its group ticked at first, then Copy */
    if(hrsCopy&&!hrsIsDate(key)){
      var cg=sGroup('Copy to','maker-copy'), chips=cg.list; cg.setAttribute('role','group'); cg.setAttribute('aria-label','Copy '+HRS_NAMES[key]+' to');
      HRS_ORDER.forEach(function(i){ if(i===key) return; var on=hrsCopy.indexOf(i)>=0, row=sSwitchRow(HRS_NAMES[i],'hours.copy-day',HRS_NAMES[i],on), c=row.sw;
        c.addEventListener('click',function(){ var at=hrsCopy.indexOf(i); if(at>=0) hrsCopy.splice(at,1); else hrsCopy.push(i); drawMakerHours(); hrsFocus('hours.copy-day',HRS_NAMES[i]); }); chips.appendChild(sLi(row)); });
      hrsAction(chips,hrsCopy.length?'Copy to '+hrsCopy.length+(hrsCopy.length===1?' day':' days'):'Copy','hours.copy-apply',name,function(){ hrsCopy.forEach(function(i){ hrsDraft.days[i]=hrsArr(a); }); hrsCopy=null; },!hrsCopy.length);
      box.appendChild(cg);
    }
    var pv=sFoot('','maker-preview'); pv.id='makerHoursPreview'; pv.setAttribute('role','status'); box.appendChild(pv);
    var done=el('div','amb-foot');
    makerButton(done,['Done','hours.save',name],function(){
      var before=hrsSaved;
      return refs('/all/maker/hours',{schedule:hrsWeekOut()})
        .then(function(value){ makerHours=value; hrsDraft=null; hrsEditing=null; hrsCopy=null; hrsUndo=before?{week:JSON.parse(before),until:Date.now()+60000}:null; drawMakerHours(); hoursSaid('week','Weekly hours saved.'); })
        .catch(function(error){ hoursSaid('week',null,error); });
    },true);
    box.appendChild(done);
    return box;
  }
  /* WHAT CUSTOMERS WOULD SEE (his answer): a read of the Counter's own rule on the draft, sent as a read, never stored; said for the day
     being changed, else today */
  function hrsPreview(){
    var line=document.getElementById('makerHoursPreview'); if(!line||!hrsDraft) return;
    /* read only when there is something to see: a day open or the week changed, so entering Shop reads the hours once */
    if(navigator.onLine===false||(hrsEditing===null&&!hrsDirty())){ hrsPv=null; line.textContent=''; return; }
    var seq=++hrsPvSeq;
    refs('/all/maker/hours?preview='+encodeURIComponent(JSON.stringify(hrsWeekOut()))).then(function(v){ if(seq!==hrsPvSeq) return; hrsPv=v&&v.preview||null; hrsPreviewDraw(); })
      .catch(function(error){ if(seq!==hrsPvSeq) return; hrsPv=null; var l=document.getElementById('makerHoursPreview'); if(l) refusal(l,error); });
  }
  function hrsPreviewDraw(){
    var line=document.getElementById('makerHoursPreview'); if(!line) return;
    line.textContent=''; if(!hrsPv||!hrsPv.status||!hrsPv.week) return;
    var st=hrsPv.status, at=st.open?st.nextChange:st.nextOpen, w=at?barWhen(at):'';
    var day=hrsPv.week.filter(function(d){ return hrsEditing===null?false:hrsIsDate(hrsEditing)?d.date===hrsEditing:hrsWeekday(d.date)===hrsEditing; })[0]||hrsPv.week[0];
    var wins=day.windows.map(function(x){ var a=(x.w<10?'0':'')+x.w, b=(x.w+4<10?'0':'')+(x.w+4), whole=a+':00-'+(x.w+4===24?'24':b)+':00'; return a+'-'+b+(x.span===whole?'':' as '+x.span); });
    line.appendChild(el('b',null,'Customers would see: '));
    line.appendChild(document.createTextNode((st.open?'Open'+(w?' until '+w:''):'Closed'+(w?', opens '+w:''))+'. '+hrsName(day.date)+': '+day.said+'. '
      +(wins.length?'Delivery windows '+wins.join(', ')+'.':'No delivery windows that day.')));
  }
  function drawMakerHours(){
    barDraw();
    var root=document.getElementById('makerSchedule');
    if(!root||!makerHours) return;
    root.textContent='';
    drawMakerNow();
    drawConfirm();
    /* 20 Oct 2026 (his word, canvas V63, and his eight answers to Fable's design): THE WEEK CHART. A row a day, Monday first; a close earlier than the
       open is the next day's (stmt/hours.js openParts), its tail a strip at the start of the next day's bar. A tap opens the day. 16 Nov 2026 (the move
       to Ambient): the week is Ambient's week of spans, the dated days after Sunday in the same list, the open day a pane beside it from 960px. */
    if(!hrsDraft){ hrsDraft=hrsFromConfig(); hrsSaved=JSON.stringify(hrsWeekOut()); }
    var pane=document.getElementById('makerDayPane'), side=hrsWide()&&!!pane, after=[], put=function(key){ var box=hrsEdit(key); if(side) pane.appendChild(box); else after.push(box); };
    var flush=function(){ after.forEach(function(b){ root.appendChild(b); }); after=[]; };
    if(pane){ pane.textContent=''; }
    var fig=el('figure','amb-chart'), cap=el('figcaption','amb-chart__title','Weekly hours'), week=el('ol','amb-week maker-week'), keys=Object.keys(hrsDraft.dates).sort(), carry=false;
    cap.appendChild(el('span','amb-chart__note','Tap a day to change it.')); fig.appendChild(cap);
    week.setAttribute('aria-label','Weekly hours');
    HRS_ORDER.forEach(function(i){ var li=hrsRow(i); week.appendChild(li); if(hrsEditing===i) put(i); if((hrsBefore(i)||[]).some(hrsLate)) carry=true; });
    keys.forEach(function(k,n){ var li=hrsRow(k); li.classList.add('maker-date'); if(!n) li.classList.add('amb-week__dated'); week.appendChild(li); if(hrsEditing===k) put(k); if((hrsBefore(k)||[]).some(hrsLate)) carry=true; });
    fig.appendChild(week);
    var axis=el('ol','amb-week__axis'); axis.setAttribute('aria-hidden','true'); ['00','06','12','18','24'].forEach(function(t){ axis.appendChild(el('li',null,t)); }); fig.appendChild(axis);
    var key=el('ul','amb-legend');
    [['amb-week__key','Open']].concat(carry?[['amb-week__key amb-week__key--carry','Open past midnight, from the day before']]:[]).forEach(function(k){
      var li=el('li'); li.appendChild(el('span',k[0])); li.appendChild(el('span','amb-legend__name',k[1])); key.appendChild(li); });
    fig.appendChild(key);
    root.appendChild(fig);
    flush();
    var weekSaid=el('p','msg osaid'); weekSaid.id='makerHoursSaved'; weekSaid.setAttribute('role','status'); weekSaid.setAttribute('aria-live','polite'); root.appendChild(weekSaid);
    var kg=sGroup(null,'maker-keep'), keep=kg.list;
    if(hrsDirty()&&hrsEditing===null) hrsAction(keep,'Discard changes','hours.discard',null,function(){ hrsDraft=null; hrsEditing=null; hrsCopy=null; },false,true);
    if(hrsUndo&&Date.now()<hrsUndo.until){ var un=sAction('Undo','hours.undo'); keep.appendChild(sLi(un));
      un.addEventListener('click',function(){ if(un.disabled) return; un.disabled=true; var back=hrsUndo.week;
        refs('/all/maker/hours',{schedule:back}).then(function(value){ makerHours=value; hrsDraft=null; hrsEditing=null; hrsUndo=null; drawMakerHours(); hoursSaid('week','Back to the hours before.'); })
          .catch(function(error){ un.disabled=false; hoursSaid('week',null,error); }); });
      setTimeout(function(){ if(hrsUndo&&Date.now()>=hrsUndo.until){ hrsUndo=null; drawMakerHours(); } },Math.max(0,hrsUndo.until-Date.now())+50); }
    if(keep.children.length) root.appendChild(kg);
    hrsPreviewDraw();
    /* the dated days (his answer): a holiday closed or a special day's hours, today to 90 days ahead, standing in for their weekday whole; they stand in the week above */
    var dg=sGroup('Dates','maker-dates'), dated=dg.list;
    if(!keys.length) dated.appendChild(sLi(sRead('None')));
    var add=sAction(hrsAdding?'Not now':'Add a date','hours.date-add'); dated.appendChild(sLi(add));
    add.setAttribute('aria-expanded',String(hrsAdding));
    add.addEventListener('click',function(){ hrsAdding=!hrsAdding; drawMakerHours(); hrsFocus(hrsAdding?'hours.date-pick':'hours.date-add',null); });
    if(hrsAdding){
      var today=new Date(Date.now()+8*3600000).toISOString().slice(0,10), prow=el('label','amb-setting'), pick=actOn(el('input','amb-input'),'hours.date-pick');
      pick.type='date'; pick.min=today; pick.max=hrsShift(today,90); pick.value=hrsShift(today,1); pick.setAttribute('aria-label','The date');
      prow.appendChild(el('span','amb-setting__name','Date')); prow.appendChild(pick); dated.appendChild(sLi(prow));
      var put2=sAction('Add this date','hours.date-new'); dated.appendChild(sLi(put2));
      put2.addEventListener('click',function(){ var v=pick.value; if(!v||v<today||v>hrsShift(today,90)){ hoursSaid('week','Choose a date from today to 90 days ahead.'); return; }
        if(!Object.prototype.hasOwnProperty.call(hrsDraft.dates,v)) hrsDraft.dates[v]=null; hrsEditing=v; hrsAdding=false; hrsDraw(); hrsFocus('hours.date',v); });
    }
    dg.appendChild(sFoot('A date stands in for its weekday.'));
    root.appendChild(dg);
    flush();
    if(pane&&!pane.children.length){ var ng=sGroup('No day open'); ng.list.appendChild(sLi(sRead('Tap a day or a date.'))); pane.appendChild(ng); }
  }
  /* 25 Oct 2026 (canvas Salt Admin Shop, his yes): FOR NOW, first on Hours, where the bar's hours chip lands. The state is the title (Open until 22:00,
     Paused until 14:00, Closed, opens 09:00), one line under it, and one pill, Hold the shop (Change while his override stands), beside a Weekly hours
     ghost while one is filed. The pill opens the form: Closed or Open, the until time in Kuala Lumpur, Not now and Set it. Bodies as before. */
  /* 26 Oct 2026, his word (Hours "the same change"): NOW, first on Hours, where the bar's hours chip lands, a list of settings. Its first row is
     the state (Open until 22:00, Paused until 14:00, Closed, opens 09:00) beside what holds it; then the confirm time; then Hold the shop, a
     Switch. On, it shows Hold as (Closed or Open, a Segment) and Until, and Set it, the one pill; off while he holds the shop, it goes back to
     the weekly hours at once, as Weekly hours did. Bodies as before. */
  var hrsHold=false;
  function hrsSeg(act,items,value,label){
    var s=el('div','amb-segment ahold-seg'); s.setAttribute('role','group'); s.setAttribute('aria-label',label);
    var pick=function(v){ s.value=v; [].forEach.call(s.children,function(b){ b.setAttribute('aria-pressed',String(b.getAttribute('data-key')===v)); }); };
    items.forEach(function(it){ var b=actOn(el('button','amb-segment__opt',it.label),act,it.value); b.type='button'; b.value=it.value;
      b.addEventListener('click',function(){ pick(it.value); s.dispatchEvent(new Event('change')); }); s.appendChild(b); });
    pick(value); return s;
  }
  function drawMakerNow(){
    var box=document.getElementById('makerNow'); if(!box||!makerHours) return;
    var st=makerHours.status||{}, man=makerHours.config&&makerHours.config.manual, held=!!man&&st.source==='manual';
    var at=st.open?st.nextChange:st.nextOpen, w=at&&!(Date.parse(at)<=Date.now())?barWhen(at):'';
    box.textContent='';
    var g=sGroup('Now','anow-list'), list=g.list;
    var first=el('div','amb-setting');
    var title=el('span','amb-setting__name anow-title', st.open?'Open'+(w?' until '+w:''):held?'Paused'+(w?' until '+w:''):'Closed'+(w?', opens '+w:''));
    title.setAttribute('data-now', st.open?'open':held?'paused':'closed'); first.appendChild(title);
    first.appendChild(el('span','amb-setting__value anow-src', held?'Held by you':st.source==='default'?'No weekly hours':'Weekly hours'));
    list.appendChild(sLi(first));
    var conf=el('div','amb-setting'); conf.id='makerConfirm'; list.appendChild(sLi(conf));
    var on=held||hrsHold, hrow=sSwitchRow('Hold the shop','hours.hold',null,on), sw=hrow.sw; sw.id='makerHoldSw';
    if(on) sw.setAttribute('aria-controls','makerHold'); list.appendChild(sLi(hrow));
    sw.addEventListener('click',function(){
      if(sw.disabled) return;
      if(!on){ hrsHold=true; drawMakerNow(); drawConfirm(); var f=document.querySelector('[data-act="hours.override-state"][aria-pressed="true"]'); if(f&&f.focus) f.focus(); return; }
      if(!held){ hrsHold=false; drawMakerNow(); drawConfirm(); var g2=document.querySelector('[data-act="hours.hold"]'); if(g2&&g2.focus) g2.focus(); return; }
      sw.disabled=true;
      refs('/all/maker/hours',{clearManual:true}).then(function(value){ makerHours=value; hrsHold=false; drawMakerHours(); hoursSaid('now','Back on the weekly hours.'); })
        .catch(function(error){ sw.disabled=false; sw.checked=on; hoursSaid('now',null,error); });
    });
    var until=null, kind=null;
    if(on){
      kind=hrsSeg('hours.override-state',[{value:'false',label:'Closed'},{value:'true',label:'Open'}],man?String(!!man.open):'false','Hold the shop as');
      var kr=el('div','amb-setting'); kr.id='makerHold'; kr.appendChild(el('span','amb-setting__name','Hold as')); kr.appendChild(kind); list.appendChild(sLi(kr));
      var ur=el('label','amb-setting'), uw=el('span','amb-setting__name',kind.value==='true'?'Open until':'Closed until'); until=actOn(el('input','amb-input'),'hours.override-until');
      until.type='datetime-local'; until.value=klInputValue(man&&man.until); ur.appendChild(uw); ur.appendChild(until); list.appendChild(sLi(ur));
      kind.addEventListener('change',function(){ uw.textContent=kind.value==='true'?'Open until':'Closed until'; });
    }
    box.appendChild(g);
    var sub=sFoot(on&&!held?'Kuala Lumpur time; customers can still order.':held?'Your weekly hours take over'+(w?' at '+w:'')+'.':st.open?'Customers can order and you answer now.'
      :st.source==='default'?'No weekly hours set; customers can still order.':'Customers can still order; you answer when you open.');
    sub.id='makerHoursStatus'; g.appendChild(sub);
    if(on){
      var go=el('div','anow-set'); go.setAttribute('data-amb','');
      makerButton(go,['Set it','hours.override-set'],function(){
        var when=Date.parse(until.value+'+08:00');
        if(!Number.isFinite(when)){ hoursSaid('now','Choose an end time.'); return; }
        return refs('/all/maker/hours',{manual:{open:kind.value==='true',until:new Date(when).toISOString()}})
          .then(function(value){ makerHours=value; hrsHold=false; drawMakerHours(); hoursSaid('now','Saved for now.'); })
          .catch(function(error){ hoursSaid('now',null,error); });
      },true);
      box.appendChild(go);
    }
    drawMaint(box);
  }
  /* 17 Nov 2026, his word: MAINTENANCE, one Switch under Now. On, it asks when the Counter is back (Kuala Lumpur, a day and a time) and Put it on
     stops every customer signing in, puts the notice at the door, which says when, and leaves anyone already in unable to change anything (18 Nov
     2026: a notice and a sign-in stop, not a block); it lifts by itself at that time, or at once when he turns the
     Switch off. Salt Admin is never held. Body {until} or {off: true} to /all/maker/maintenance; the hours read carries it back as maint. */
  var mtOpen=false;
  function maintUntil(){ var m=makerHours&&makerHours.maint, t=m&&Date.parse(m.until); return t>Date.now()?m.until:null; }
  function drawMaint(box){
    if(TESTING) return;
    var filed=maintUntil(), on=!!filed||mtOpen, w=filed?barWhen(filed):'';
    var g=sGroup('Maintenance','amaint'), list=g.list, row=sSwitchRow('Under maintenance','maint.switch',null,on), sw=row.sw; sw.id='makerMaintSw';
    list.appendChild(sLi(row));
    sw.addEventListener('click',function(){
      if(sw.disabled) return;
      if(!on){ mtOpen=true; drawMakerNow(); drawConfirm(); var f=document.querySelector('[data-act="maint.until"]'); if(f&&f.focus) f.focus(); return; }
      if(!filed){ mtOpen=false; drawMakerNow(); drawConfirm(); var g2=document.querySelector('[data-act="maint.switch"]'); if(g2&&g2.focus) g2.focus(); return; }
      sw.disabled=true;
      refs('/all/maker/maintenance',{off:true}).then(function(value){ if(makerHours) makerHours.maint=value.maint; mtOpen=false; drawMakerHours(); hoursSaid('now','Maintenance off. Customers are back within a minute.'); })
        .catch(function(error){ sw.disabled=false; sw.checked=on; hoursSaid('now',null,error); });
    });
    var until=null;
    if(on){
      var ur=el('label','amb-setting'); until=actOn(el('input','amb-input'),'maint.until');
      until.type='datetime-local'; until.min=klInputValue(new Date(Math.ceil(Date.now()/60000)*60000).toISOString()); until.value=klInputValue(filed||new Date(Date.now()+3600000).toISOString());
      ur.appendChild(el('span','amb-setting__name','Back at')); ur.appendChild(until); list.appendChild(sLi(ur));
    }
    g.appendChild(sFoot(filed?'Customers cannot sign in and see Under maintenance at the door, back '+w+'. Anyone already in can change nothing. It lifts by itself then; Salt Admin stays open.'
      :on?'Kuala Lumpur time. Within a minute customers cannot sign in and anyone already in can change nothing; Salt Admin stays open.':'Customers can use the Counter.'));
    box.appendChild(g);
    if(on){
      var go=el('div','anow-set'); go.setAttribute('data-amb','');
      makerButton(go,[filed?'Change':'Put it on','maint.set'],function(){
        var when=Date.parse(until.value+'+08:00');
        if(!Number.isFinite(when)){ hoursSaid('now','Choose when it is back.'); return; }
        return refs('/all/maker/maintenance',{until:new Date(when).toISOString()})
          .then(function(value){ if(makerHours) makerHours.maint=value.maint; mtOpen=false; drawMakerHours(); hoursSaid('now','Under maintenance until '+barWhen(value.maint.until)+'.'); })
          .catch(function(error){ hoursSaid('now',null,error); });
      },true);
      box.appendChild(go);
    }
  }
  /* Salt Admin A to C (20 Oct 2026), P3: THE CONFIRM TIME, as the hourly cron filed it: the figure and what customers read, or how far it is
     from the ten it needs, or that none is filed yet. Old (over three hours) is said, since customers then see nothing. */
  function drawConfirm(){
    var row=document.getElementById('makerConfirm'); if(!row) return;
    row.textContent='';
    var c=makerHours&&makerHours.confirm, u=confirmUsual(), at=c&&Date.parse(c.at), stale=u==null&&c&&at>0&&Date.now()-at>3*3600e3;
    row.appendChild(el('span','amb-setting__name','Confirm time'));
    var fig=el('span','amb-setting__value shconfirm',u!=null?u+' min':stale?'Old':c&&at>0?'Not yet':'None');
    fig.setAttribute('data-glance','confirm'); if(u!=null) fig.setAttribute('data-confirm',String(u));
    row.appendChild(fig);
    row.appendChild(el('span','amb-vh', u!=null?c.n+' measured; customers read it while you are open.'
      :stale?'Filed '+fmtWhen(c.at)+'; customers see none until it runs again.'
      :c&&at>0?(c.n!=null?c.n+' measured; ':'')+'customers see a figure from 10.'
      :'Not measured yet; the hourly measure files it.'));
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
  /* COUNTER BATCH A (18 Oct 2026, his decisions): HIS COLLECTION POINTS, under Shop hours. A point is a code (one capital letter and one
     or two digits, as A2) and its place, typed as two figures or read off a pasted Maps link on this device; no label and no address. The
     list is the Counter's own (maker:points), never the Desk's; Ready to collect offers it, and an order keeps its own copy, so a point
     removed here moves no order already waiting at it. */
  var makerPoints=null, makerPointsDraft=null;
  async function loadMakerPoints(){
    if(placeNow!=='shop') return;
    try{ makerPoints=await refs('/all/maker/points'); makerPointsDraft=null; drawMakerPoints(); drawConfirm(); }
    catch(error){ var s=document.getElementById('makerPointsStatus'); if(s) refusal(s,error); }
  }
  /* 26 Oct 2026 (his word: "test it out with Google Maps, Waze and Apple Maps"): a link with its point is read on this device; a short
     Google or Apple link, or an Apple one with only a place id, is opened on the Worker for its point (/all/maker/geo/open, his yes to
     Apple); else two figures */
  function pointOpaque(text){
    var t=String(text||'').split(String.fromCharCode(10)).join(' ').split(String.fromCharCode(13)).join(' '), m=/https:[/][/][^ <>"]+/i.exec(t); if(!m) return null;
    var u; try{ u=new URL(m[0]); }catch(e){ return null; }
    var h=u.hostname.toLowerCase();
    if(h==='maps.app.goo.gl'||h==='goo.gl'&&/^[/]maps[/]/.test(u.pathname)||h==='maps.apple'&&/^[/]p[/]/.test(u.pathname)) return u.href;
    if(h==='maps.apple.com'&&u.searchParams.get('place-id')) return u.href;
    return null;
  }
  function pointFigures(reading){ return reading&&Number.isFinite(reading.lat)&&Number.isFinite(reading.lng)?{lat:Math.round(reading.lat*1e5)/1e5,lng:Math.round(reading.lng*1e5)/1e5}:null; }
  async function pointPlace(text){
    var got=pointFigures(makerGeo.link(text));
    if(got) return got;
    var opaque=pointOpaque(text);
    if(opaque){ var opened=await refs('/all/maker/geo/open',{url:opaque}); got=pointFigures(makerGeo.link(opened&&opened.location||'')); if(got) return got; }
    var two=String(text||'').split(',').map(function(x){ return x.trim(); });
    if(two.length!==2||!two[0]||!two[1]) return null;
    var lat=Number(two[0]), lng=Number(two[1]);
    return Number.isFinite(lat)&&Number.isFinite(lng)?{lat:Math.round(lat*1e5)/1e5,lng:Math.round(lng*1e5)/1e5}:null;
  }
  /* 26 Oct 2026 (his word): the points are a list of settings, a row a point with its cross; New point a Code row and a Place row, then Add
     point; Save the points the one pill */
  function drawMakerPoints(){
    var root=document.getElementById('makerPoints'), status=document.getElementById('makerPointsStatus');
    if(!root||!makerPoints) return;
    root.textContent='';
    var list=makerPointsDraft||((makerPoints.points&&makerPoints.points.list)||[]).slice();
    var pg=sGroup(null,'apoints'), box=pg.list;
    if(!list.length) box.appendChild(sLi(sRead('None')));
    list.forEach(function(p,i){
      var row=el('div','amb-setting'), code=el('span','amb-setting__name apoints-code',p.code); code.setAttribute('data-point',p.code); row.appendChild(code);
      row.appendChild(el('span','amb-setting__value apoints-place',p.lat.toFixed(5)+', '+p.lng.toFixed(5)));
      var x=actOn(amb.node(amb.circle('Remove point '+p.code,'close')),'points.remove',p.code); x.classList.add('amb-circle--plain','apoints-x');
      x.addEventListener('click',function(){ list.splice(i,1); makerPointsDraft=list; drawMakerPoints(); });
      row.appendChild(x); box.appendChild(sLi(row));
    });
    root.appendChild(pg);
    if(status){ status.className='amb-settings__foot'; status.textContent=list.length?'Ready to collect asks which one.':'Ready to collect needs one.'; root.appendChild(status); }
    root.appendChild(el('h3','amb-section','New point'));
    var field=function(label,act,ph){ var i=actOn(el('input','amb-input'),act); i.type='text'; i.placeholder=ph; root.appendChild(sField(label,i)); return i; };
    var code=field('Code','points.code','A3'), where=field('Place','points.place','');
    code.setAttribute('maxlength','3'); code.setAttribute('autocapitalize','characters'); code.setAttribute('spellcheck','false');
    /* 26 Oct 2026, his word ("type it and the relevant recommended place from OpenStreetMap appears"): three letters or more, a moment's pause,
       and up to five places stand as rows under Place, each its name and where it is; a tap (or the arrows and Enter) puts its point in
       Place and names it in the line under the list. A link or two figures are read as before. Escape or a fresh word closes the list. */
    var picked=placeAssist(where,{id:'makerPoints',act:'points',keep:true});
    var put=el('div','apoints-act'); put.setAttribute('data-amb','');
    var add=actOn(el('button','amb-pill amb-pill--quiet','Add point'),'points.add'); add.type='button'; put.appendChild(add); root.appendChild(put);
    add.addEventListener('click',async function(){
      if(add.disabled) return;
      var c=String(code.value||'').trim().toUpperCase(), place=null;
      add.disabled=true;
      try{ place=await pointPlace(where.value); }catch(e){ add.disabled=false; pointsSaid(null,e); return; }
      add.disabled=false;
      if(!/^[A-Z][0-9]{1,2}$/.test(c)){ pointsSaid('A code is one capital letter and one or two digits, such as A2.'); return; }
      if(!place){ pointsSaid('Give the place as two figures, latitude then longitude, or paste a Maps link with a point.'); return; }
      if(list.some(function(p){ return p.code===c; })){ pointsSaid('Point '+c+' is on the list already.'); return; }
      if(list.length>=20){ pointsSaid('Twenty points at most.'); return; }
      list.push({code:c,lat:place.lat,lng:place.lng}); makerPointsDraft=list; drawMakerPoints(); pointsSaid('Point '+c+' added. Save to keep it.');
    });
    root.appendChild(picked);
    root.appendChild(el('p','amb-settings__foot','Type a place, or paste a Google Maps, Waze or Apple Maps link.'));
    var saveRow=el('div','apoints-act apoints-save'); saveRow.setAttribute('data-amb',''); root.appendChild(saveRow);
    makerButton(saveRow,['Save the points','points.save'],function(){
      return refs('/all/maker/points',{list:list}).then(function(value){ makerPoints=value; makerPointsDraft=null; drawMakerPoints(); pointsSaid('Points saved.'); })
        .catch(function(error){ pointsSaid(null,error); });
    },true);
  }
  /* 4 Nov 2026 (his answers: one convention on every surface): ONE PLACE FIELD. Shop's points were the first (26 Oct 2026, his word "type it and
     the relevant recommended place from OpenStreetMap appears"): three letters or more, a moment's pause, and up to five places stand as rows under
     the field, each its name and where it is; a tap (or the arrows and Enter) puts its point in the field as two figures and names it in the line
     under the list; Escape or a fresh word closes the list. A pasted map link or two figures are read as before, by the one reader. Use my location
     puts this phone's point there the same way. Add ID, Amend ID and a filed place take it too, and the customer's spot is the same field */
  function placeAssist(where,o){
    var found=el('ul','amb-settings__list apoints-found'); found.id=o.id+'Found'; found.setAttribute('role','listbox'); found.setAttribute('aria-label','Places found');
    where.setAttribute('role','combobox'); where.setAttribute('aria-autocomplete','list'); where.setAttribute('aria-expanded','false'); where.setAttribute('aria-controls',o.id+'Found');
    where.setAttribute('autocomplete','off'); where.setAttribute('spellcheck','false'); where.placeholder='Search, or paste a link';
    where.closest('label').after(found);
    var here=actOn(el('button','amb-pill amb-pill--quiet amb-pill--sm apoints-here','Use my location'),o.act+'.here'); here.type='button';
    found.after(here);
    var picked=el('p','amb-field__hint apoints-picked'); picked.setAttribute('role','status');
    if(!o.keep) here.after(picked);
    var seq=0, timer=null, hits=[], at=-1;
    var shut=function(){ found.textContent=''; hits=[]; at=-1; where.setAttribute('aria-expanded','false'); where.removeAttribute('aria-activedescendant'); };
    /* 17 Nov 2026: a point put in the field by a pick or his location is told as a change, so Locality is worked out from it (makerLocalityFrom) */
    var told=function(){ where.dispatchEvent(new Event('change',{bubbles:true})); };
    var choose=function(i){ var h=hits[i]; if(!h) return; where.value=h.lat.toFixed(5)+', '+h.lng.toFixed(5); picked.textContent=h.name+(h.where?', '+h.where:''); shut(); where.focus(); told(); };
    /* a link, figures, degrees or a plus code are read, never searched for */
    var readable=function(w){ var r=null; try{ r=makerGeo.link(w); }catch(e){ r=null; } return !!r&&(r.lat!=null||!!r.short); };
    var mark=function(i){ at=i; [].forEach.call(found.querySelectorAll('button'),function(r,j){ r.setAttribute('aria-selected',String(j===i)); }); if(i>=0&&found.querySelectorAll('button')[i]) where.setAttribute('aria-activedescendant',found.querySelectorAll('button')[i].id); };
    var draw=function(list,note){
      found.textContent=''; hits=list||[]; at=-1;
      hits.forEach(function(h,i){
        var li=el('li'), r=actOn(el('button','amb-setting apoints-hit'),o.act+'.found',String(i)); r.type='button'; r.tabIndex=-1; r.id=o.id+'Hit'+i; r.setAttribute('role','option'); r.setAttribute('aria-selected','false'); li.setAttribute('role','presentation');
        r.appendChild(el('span','amb-setting__name',h.name)); if(h.where) r.appendChild(el('span','amb-setting__value',h.where));
        r.addEventListener('mousedown',function(e){ e.preventDefault(); }); r.addEventListener('click',function(){ choose(i); }); li.appendChild(r); found.appendChild(li);
      });
      if(note){ var n=el('li'); n.setAttribute('role','presentation'); n.appendChild(sRead(note)); found.appendChild(n); }
      where.setAttribute('aria-expanded',String(!!hits.length));
    };
    where.addEventListener('input',function(){
      picked.textContent=''; clearTimeout(timer);
      var w=where.value.replace(/ {2,}/g,' ').trim(), mine=++seq;
      if(w.length<3||/^https?:/i.test(w)||/^-?[0-9.]+ *, *-?[0-9.]+$/.test(w)||readable(w)){ shut(); return; }
      timer=setTimeout(function(){
        refs('/all/maker/geo/search',{q:w}).then(function(v){ if(mine!==seq) return; var l=v&&v.places||[]; draw(l,l.length?'':'No place found. Paste a link instead.'); })
          .catch(function(){ if(mine!==seq) return; draw([],'The place search is not answering. Paste a link instead.'); });
      },350);
    });
    where.addEventListener('keydown',function(e){
      if(!hits.length) return;
      if(e.key==='ArrowDown'){ e.preventDefault(); mark((at+1)%hits.length); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); mark(at<=0?hits.length-1:at-1); }
      else if(e.key==='Enter'&&at>=0){ e.preventDefault(); choose(at); }
      else if(e.key==='Escape'){ e.preventDefault(); shut(); }
    });
    /* his phone's point, read once and fresh, put in the field as two figures */
    here.addEventListener('click',function(){
      var g=null; try{ g=navigator.geolocation; }catch(e){}
      if(!g||typeof g.getCurrentPosition!=='function'){ picked.textContent='This device does not share its location.'; return; }
      here.disabled=true; picked.textContent='Reading your location.'; ++seq; clearTimeout(timer);
      g.getCurrentPosition(function(pos){
        here.disabled=false; var c=pos&&pos.coords, la=c?+c.latitude:NaN, ln=c?+c.longitude:NaN;
        if(!isFinite(la)||!isFinite(ln)||Math.abs(la)>90||Math.abs(ln)>180){ picked.textContent='Your location could not be read.'; return; }
        shut(); where.value=la.toFixed(5)+', '+ln.toFixed(5); picked.textContent='Your location, where you stand.'; told();
      },function(){ here.disabled=false; picked.textContent='Your location was not shared.'; },{enableHighAccuracy:true, maximumAge:0, timeout:15000});
    });
    return picked;
  }
  function pointsSaid(text,error){
    var line=document.getElementById('makerPointsMessage');
    if(!line) return;
    if(error) refusal(line,error); else line.textContent=text;
    if(line.scrollIntoView) line.scrollIntoView({block:'nearest'});
  }
  async function loadLinks(quiet){
    var poll=quiet===true;
    if(!poll) moved=null;
    linksBusy=true;
    try{
      var jd=await readJoins();
      var j=await refs('/all/refs'); nGot('links');
      var diff=changed('links',[j.refs])||jd;
      links=j.refs||[]; linksRead=true;
      if(diff||!poll){ drawLinks(); drawJoins(); drawNeeds(); joinsDrive(); if(!poll){ say(''); linkSay(''); } }
    }
    catch(e){ nGot('links', e); if(!poll) sayFail(e); }
    finally{ linksBusy=false; }
  }
  /* 11 Oct 2026: A MOVE ON A LINK IS SENT ONCE. While it is out the card's move buttons are off, on Needs you and on Links,
     and a second tap, on a button a redraw put in their place, sends nothing. */
  var moving={};
  function moveLock(id, on){
    [].forEach.call(document.querySelectorAll('[data-link="'+id+'"] button[data-move], [data-need="l:'+id+'"] button[data-move], [data-pane="l:'+id+'"] button[data-move]'), function(b){ b.disabled=on; });
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
  /* ---- JOIN LINKS (plan version 5, his answers E to E2 of 02 Nov 2026; stmt/join.js) ------------------------------------------------
     An associate asks for a link for ONE person; he approves it here beside the guest links; the referee's page seals a name and a place to the slip key
     (info 'salt-join v1') and sends it once. A join in state sent is a To do card, Add them: the one unlock opens the seal and Record's New customer is
     filled with the name and the place, kind Customer, and he adds the ID as ever. When that Add ID is sent the join is told its code (state added), and
     once the code has an account on the sheet this page mints the hand-over as Show a code does and files it for the referee's page (once a join a load).
     The name lives in page memory (joinHold) until the lock, and goes nowhere but into the Add ID form's sealed vault envelope. */
  var joins=[], joinsRead=false, joinHold=null, joinWant=null, joinForm=null, joinHanded={}, joinSaid={}, joinMoving={}, joinTried={};
  function joinWaiting(r){ return r.approved===false&&r.declined!==true&&!r.revoked; }
  function joinWord(r){ return r.revoked?'Withdrawn':r.declined===true?'Declined':r.approved===false?'Waiting':({open:'Open',sent:'Sent',added:'Added',keyed:'Signing in',spent:'Used'}[r.state]||'Open'); }
  function joinPut(j){ for(var i=0;i<joins.length;i++) if(joins[i].id===j.id){ joins[i]=j; return; } joins.unshift(j); }
  async function readJoins(){
    try{ var j=await refs('/all/joins'); nGot('joins'); var was=changed('joins',[j.joins]); joins=j.joins||[]; joinsRead=true; return was; }
    catch(e){ nGot('joins', e); return false; }
  }
  function drawJoins(){
    var box=document.getElementById('jlist'); if(!box) return;
    box.textContent='';
    if(!joins.length) return;
    var group=el('section','agroup glinks'), list=el('ul','amb-list amb-list--ruled');
    group.setAttribute('aria-label','Join links');
    group.appendChild(el('h2','amb-section ghead','Join links')); group.appendChild(list);
    joins.forEach(function(r){
      var who=codeByUser(r.by), waiting=joinWaiting(r), key='jl:'+r.id;
      var row=el('li','amb-row glrow'), tx=el('span','amb-row__text'), sub=el('span','amb-row__sub'), age=waiting?ageOf(r.made):stampDay(r.made);
      row.setAttribute('data-join', r.id);
      tx.appendChild(el('span','amb-row__title','Join link from '+who));
      sub.appendChild(el('span',waiting?'amb-neg':null,joinWord(r))); sub.appendChild(document.createTextNode(age?', '+age:'')); tx.appendChild(sub); row.appendChild(tx);
      var tr=el('span','amb-row__trail');
      if(waiting){
        var ap=aPill('Approve','join.approve',key,true,true), de=aPill('Decline','join.decline',key,true,true);
        ap.setAttribute('data-move',''); de.setAttribute('data-move','');
        ap.disabled=de.disabled=!!joinMoving[r.id];
        ap.addEventListener('click', function(){ moveJoin(r,'approve'); }); de.addEventListener('click', function(){ moveJoin(r,'decline'); });
        tr.appendChild(ap); tr.appendChild(de);
      }else if(r.approved===true&&!r.revoked&&r.state!=='spent'){
        var wd=aPill('Withdraw','join.withdraw',key,true,true); wd.setAttribute('data-move',''); wd.disabled=!!joinMoving[r.id];
        wd.addEventListener('click', function(){ moveJoin(r,'revoke'); });
        tr.appendChild(wd);
      }
      if(tr.firstChild) row.appendChild(tr);
      list.appendChild(row);
      if(joinSaid[r.id]){ var n=el('li','oask'); n.setAttribute('role','status'); n.appendChild(el('p','amb-field__hint nnote bad amb-neg',joinSaid[r.id])); list.appendChild(n); }
    });
    box.appendChild(group);
  }
  async function moveJoin(r, how){
    if(joinMoving[r.id]) return;
    joinMoving[r.id]=true; delete joinSaid[r.id]; drawJoins();
    try{
      var j=await refs('/all/joins/'+r.id+'/'+how, {});
      joinPut(j.join); joinSaid[r.id]=({approve:'Approved, and it opens now.',decline:'Declined, and it stays shut.',revoke:r.state==='open'?'Withdrawn.':'Withdrawn, so they need a new link.'}[how]||'Done.');
    }catch(e){ joinSaid[r.id]=e.message; }
    delete joinMoving[r.id]; drawJoins(); drawNeeds();
  }
  /* a join in state sent: the referee's form is in, waiting on his Add ID */
  function joinNeed(r){
    var who=codeByUser(r.by);
    return item('now','accounts','Customer','j:'+r.id, r.sentAt||r.made, {who:who, title:'New customer from '+who,
      why:'Add them from the name and place they sent, and they sign in by themselves.', open:(wide()?function(){}:null)}, function(c){
      if(joinNamed(r)) mainButton(c,'Send its code','need.join-told','j:'+r.id, function(){ joinTell(r.id, joinTried[r.id]); });
      else mainButton(c,'Add them','need.join-add','j:'+r.id, function(){ joinAdd(r, this); });
      if(joinSaid[r.id]){ var n=noteOf(c); n.textContent=joinSaid[r.id]; n.className+=' bad'; }
    });
  }
  /* added, and waiting for the account or for its hand-over to be filed: FYI, no button */
  function joinSignNeed(r){
    var t='Signing in '+(r.code||'the new customer');
    return item('watch','accounts','Customer','js:'+r.id, r.addedAt||r.made, {who:r.code||'Customer', title:t, counts:false,
      why:'Their account opens once the Add ID is approved and folded, and then they sign in by themselves.', open:(wide()?function(){}:null)}, function(c){
      if(joinSaid[r.id]){ var n=noteOf(c); n.textContent=joinSaid[r.id]; n.className+=' bad'; }
    });
  }
  function joinAdd(r, from){
    delete joinSaid[r.id]; joinWant=r.id;
    if(!makerVault){ vaultAsk(from); return; }
    joinOpenNow();
  }
  /* the seal opened with the slip key the one unlock holds, then Record's New customer filled (joinApply) */
  async function joinOpenNow(){
    var id=joinWant; if(!id||!makerVault) return; joinWant=null;
    var r=joins.filter(function(x){ return x.id===id; })[0];
    try{
      if(!r||r.state!=='sent'||!r.seal) throw new Error('That join is not waiting any more.');
      if(!makerVault.slip) throw new Error('No slip key is filed.');
      var plain=await makerSealedOpen(makerVault.slip, r.seal, 'salt-join v1'), p=null;
      try{ p=JSON.parse(new TextDecoder().decode(plain)); }catch(x){ p=null; }
      if(!p||typeof p.name!=='string'||typeof p.place!=='string'||!p.name.trim()||!p.place.trim()) throw new Error('It holds nothing this page reads.');
      if(!makerVault) return;
      joinHold={id:r.id, by:r.by, name:p.name.trim().slice(0,60), place:p.place.trim().slice(0,60)};
    }catch(e){ if(r) joinSaid[id]='Could not open it: '+e.message; drawNeeds(); return; }
    showPlace('record','customers',{fresh:true, push:true});
    joinApply();
  }
  function joinApply(){
    var f=joinForm; if(!joinHold||!f||!f.name.isConnected) return;
    f.kind.value='customer'; f.kind.dispatchEvent(new Event('change',{bubbles:true}));
    f.name.value=joinHold.name; f.place.value=joinHold.place;
    (f.drifts||[]).forEach(function(d){ if(d.product==='salt'){ d.select.value='0.3'; d.select.dispatchEvent(new Event('change',{bubbles:true})); } });   /* 11 Nov 2026: a new customer starts at +30% */
    f.name.dispatchEvent(new Event('input',{bubbles:true})); f.place.dispatchEvent(new Event('input',{bubbles:true}));
    f.filled=true; f.status.textContent='Filled from the join link of '+codeByUser(joinHold.by)+(codeOfUser(joinHold.by)?', their first week counting for them':'')+'; check them, then add.';
    openForm('new-customer');
  }
  /* the lock lets the name go: the held copy, and the form fields it filled */
  function joinForget(){
    joinHold=null; joinWant=null;
    if(joinForm&&joinForm.filled){ joinForm.filled=false; joinForm.name.value=''; joinForm.place.value=''; joinForm.status.textContent=''; }
  }
  /* his Add ID went through for what the join filled: the join is told the code, never a name. Answers a sentence to add to the form's line, or '' */
  async function joinTold(name, locality, kind, code){
    if(!joinHold||!joinForm||!joinForm.filled||kind!=='customer') return '';
    var id=joinHold.id; joinHold=null; joinForm.filled=false;
    return joinTell(id, code);
  }
  async function joinTell(id, code){
    try{ var j=await refs('/all/joins/'+id+'/added', {code:code}); joinPut(j.join); delete joinSaid[id]; delete joinTried[id]; drawJoins(); drawNeeds(); return 'The join link has its code.'; }
    catch(e){ joinSaid[id]='Its code was not told to the link: '+e.message; drawNeeds(); return 'The join link was not told its code: '+e.message; }
  }
  /* an Add ID tried for a join stays in joinTried (a code, not a name) though its send or its word to the link was lost; once the unlocked vault names that
     code the Add ID is in, and the card offers Send its code, the link told as joinTold would have */
  function joinNamed(r){
    var code=joinTried[r.id], names=makerVault&&makerVault.names;
    return r.state==='sent'&&!!code&&!!names&&Object.hasOwn(names,code);
  }
  /* once the code has an account on the sheet, the hand-over is minted as Show a code mints it and filed for the page that sent the form; once a join a load */
  function joinsDrive(){
    if(!joinsRead||!sheet) return;
    joins.forEach(function(r){
      if(r.state!=='added'||!r.code||joinHanded[r.id]||r.approved!==true||r.declined===true||r.revoked) return;
      var a=sheetRows.filter(function(x){ return x.code===r.code&&x.account; })[0]; if(!a) return;
      joinHanded[r.id]=true; joinSignIn(r, a);
    });
  }
  async function joinSignIn(r, a){
    try{
      var k=await keyFor(a);
      var j=await refs('/all/joins/'+r.id+'/handover', {u:a.username, token:k.token, wrap:k.wrap});
      k=null; joinPut(j.join); delete joinSaid[r.id];
    }catch(e){ joinSaid[r.id]='Not signed in: '+e.message; }
    drawJoins(); drawNeeds();
  }
  /* ---- NEEDS YOU, THE INBOX (S9 9.1, and Phase 1b of 11 Oct 2026) ------------------------------------
     His home: every thing that waits on him, one card each on the system's Action recipe (salt-action, coloured by --salt-sev), ranked
     Now, Soon, Watch and oldest first in each. NOW is a customer waiting: an order placed, a payment they say they sent (on an order or
     against the account), a message asked, an account whose address is refused. SOON is his own work: a Desk row to approve, an entry
     that did not get through, a stage he rejected, a guest link, an ID with no account, accounts nobody has been sent, money owed past its term
     and goods paid for and not handed over. WATCH is an override in force and a notice set. A practice item is drawn after the real ones, labelled, and counted nowhere.
     A card is its kind word, who (the code), what, its age, one Open that goes to the detail, and, only where the page already has that
     exact action as one tap, one filled pill that calls the same function with the same guards. A card is titled by what to do, verb first (17 Oct 2026).
     A MONEY TAP ASKS ONCE ON THE CARD, then calls the order or claim card's own send (orderReceived, sendClaimAnswer); Agree, which needs the delivery and the window, and Cash
     open the full card in Orders. Read off what the places read anyway (/all/sheet, /all/refs, the
     review, the claims, the threads, the hours and the notice). A tap is answered on its own card. */
  /* 22 Oct 2026, his names: TO DO is his to act, PENDING the customer's (money they owe past its term, an offer of his waiting on their yes), FYI
     nothing to do (an override in force, a notice set). The ids stay now, soon and watch. Each group always open, with no count and no fold. */
  var SEVS=[['now','To do'],['soon','Pending'],['watch','FYI']], SEVC={now:'copper',soon:'brass',watch:'mist'}, NEED_MS=5000;   /* R4, his yes of 19 Oct 2026 (D12): was 30000; a tick that finds the same answer draws nothing */
  var NEED_SRC=[['sheet','accounts'],['links','links'],['review','orders and rows'],['claims','payments'],['threads','messages'],['hours','hours'],['notice','the notice'],['book','what is owed']];
  var nlist=document.getElementById('nlist'), nCount=document.getElementById('nCount'), linksRead=false, linksBusy=false;
  var nFoldOpen={}, nKind='all', nSrc={}, nSeen={}, needN=0, needsAt=0, needsReading=false, needsTimer=null, makerNotice=null, shopReading=false;
  /* each source says it was read, or why it was not, so a read that failed is never taken for an empty inbox */
  function nGot(name, err){ nSrc[name]=err?String(err.message||err):'ok'; if(!err) delete nSeen[name+'!']; }
  /* R4: a poll that fails again with the same words draws nothing; a new failure does, and a read that gets through forgets it (nGot) */
  function failNew(name, err){ var s=String(err&&err.message||err), was=nSeen[name+'!']!==s; nSeen[name+'!']=s; return was; }
  function needSig(){ return Object.keys(nSeen).sort().map(function(k){ return k+'='+nSeen[k]; }).join('|')+JSON.stringify(nSrc); }
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
     his letter in it, and no word for it is drawn, not the Desk's (salt, oil, candy, rice, gas) and not the shape's (Cube, Droplet, Lozenge, Capsule, Starburst). A reader is told the
     shape, as on the customer's page (pshape: a hidden .sr or an aria-label), never the product. The Desk keeps its names; this page does not. bookMark is a mark in
     a line, bookTile mtile for a card (the mark, and under it "2.5 units"), bookTag the typed Product tag (Orders, since 25 Oct 2026), bookItem a tile of a form that is the
     mark alone, and pmarkHead, the customer's, a heading that is the mark alone. A select cannot hold a mark, so an option says the book's letter in brackets, [I],
     and nothing for a book with none. noBook takes a book's name out of a sentence the Desk or the Counter wrote, for the words that are not this page's to change. */
  var BOOKS=/\\b(salt|oil|candy|rice|gas)\\b(?!\\s+(?:account|admin|counter|command|desk)\\b)/gi;
  function noBook(text){
    return String(text==null?'':text).replace(BOOKS,function(w,k,at,all){ var before=all.slice(0,at); return /\\bthe\\s+$/i.test(before)?'book':/(^|[.!?]\\s)$/.test(before)?'The book':'the book'; });
  }
  function bookLetter(product){ var k=String(product||'').toLowerCase(); return Object.prototype.hasOwnProperty.call(PLET,k)?PLET[k].l:''; }
  function bookTile(product,q){ return markThumb(product,'md'); }
  function bookItem(product){ return {value:product,label:pshape(product),mark:product}; }
  /* 12 Oct 2026 (Phase 5): A BOOK ON A ROW WEARS THE SYSTEM'S PRODUCT TAG, the book's mark in it and its own accent as its hue (PRODUCTS.accent in ledger/book.json is
     the system's --salt-product-<book> token, which the tag's modifier for the book reads). The tag holds no words; this page alone draws one. */
  /* 25 Oct 2026 (canvas Salt Admin Orders): bookTag, read by Orders' Ledger, Group and Approve alone, is the typed Product tag, as Needs you's cards name a book */

  /* a quantity, its book and a sum on one line: 2 units [its tag], RM 100.00 */
  function bookLine(qty,product,total){
    var p=el('p','maker-facts');
    if(qty==null){ p.appendChild(document.createTextNode(rm(total))); return p; }
    p.appendChild(document.createTextNode(units(qty)+(product?' ':''))); if(product) p.appendChild(bookChip(product));
    p.appendChild(document.createTextNode(', '+rm(total))); return p;
  }
  var ENTRY_WORD={SELL:'Sale', BUY:'Purchase', AMEND:'Correction', TIER:'Their %',REPAY:'Repayment', RENAME:'Name or place change', REDEEM:'Reward', PRICE:'Price change', PLACE:'Map placement', PARTNER:'Partner', OBS:'Reminder', GIFT:'Gift', COUNT:'Stock count', ADDID:'New customer', LOAN:'Loan', EDIT:'Edit'};
  /* 11 Nov 2026: an edit of the market is named by its kind and, for a point, the figures he sent */
  var MARKET_WORD={marketOff:'Market move off', marketOn:'Market move on', anchor:'Median point'};
  function entryWord(e){
    var p=e&&e.payload;
    if(p&&p.mode==='edit'&&Object.prototype.hasOwnProperty.call(MARKET_WORD,p.kind)) return MARKET_WORD[p.kind]+(p.kind==='anchor'&&+p.q>0&&+p.price>0?', '+units(+p.q)+', '+rm(+p.price):'');
    return ENTRY_WORD[e&&e.type]||(e&&e.type)||'Entry';
  }
  /* 12 Nov 2026 (his Approve review): A CARD SAYS WHAT IT APPROVES. A Their % row is each book and the figure it sets, read off the row as drafted, and what it was
     where the drafter's flag says it moves; an entry with no size and no sum draws no money line (it drew RM 0.00) but the first sentence of the drafter's reading */
  function tierSets(d){
    var t=(d.collection==='tierset'&&d.row&&d.row.tiers)||{}, out=[];
    Object.keys(t).forEach(function(c){ var ps=t[c]||{}; Object.keys(ps).forEach(function(p){ out.push({code:c, product:p, v:ps[p]}); }); });
    return out;
  }
  function tierWord(v){ return v==null?'0%':pctWord(Math.round(Number(v)*100)); }
  /* the drafter says a figure as "20% off", "30% lift" or "not set"; the card says it as the stepper does */
  function tierWas(d,s){
    var said=function(w){ var m=/^([0-9.]+)% (off|lift)$/.exec(w); return m?pctWord(Math.round(+m[1])*(m[2]==='off'?-1:1)):w==='not set'?'0%':w; };
    var hit=null; (d.flags||[]).forEach(function(f){ var m=/^([^ ]+?)'s (.+?) moves from (.+?) to (.+?)[.]$/.exec(String(f)); if(m&&m[1]===s.code&&String(m[2]).toLowerCase()===String(s.product).toLowerCase()) hit=said(m[3]); });
    return hit;
  }
  function tierLines(d){
    var sets=tierSets(d), many=Object.keys((d.row||{}).tiers||{}).length>1;
    return sets.map(function(s){
      var p=el('p','maker-facts aptier'), was=tierWas(d,s);
      if(many) p.appendChild(document.createTextNode(s.code+' '));
      p.appendChild(bookChip(s.product)); p.appendChild(document.createTextNode(' '+tierWord(s.v)+(was?', was '+was:'')));
      return p;
    });
  }
  function firstSentence(s){ s=noBook(String(s||'')).trim(); var m=/^.*?[.!?](?=[ ]|$)/.exec(s); return m?m[0]:s; }
  function noFigure(d){ return d.qty==null&&d.total==null; }
  /* what a Desk row is, in the order a person says it: the kind, the size, the sum; its book is the mark its card draws before these words (needCard, mark) */
  function rowWhat(d){ var e=d.entry||{}; return [entryWord(e), d.qty==null?'':units(d.qty), rm(d.total)].filter(Boolean).join(', '); }
  /* 16 Nov 2026, the move to Ambient: a second choice is Ambient's quiet pill and a main one its pill; ambBtn sizes either */
  function ghost(t){ var L=labOf(t), b=actOn(el('button','amb-pill amb-pill--quiet',L[0]),L[1],L[2]); b.type='button'; return b; }
  function pill(t){ var L=labOf(t), b=actOn(el('button','amb-pill',L[0]),L[1],L[2]); b.type='button'; return b; }
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
    /* 22 Oct 2026: rm, the money the card is about (its figure), and tap, the money tap it waits on (confirm or agree), which the Insight sums */
    var full=function(){ return Object.assign({sev:sev, kind:kind, word:word, key:key, at:at||''}, o); };
    return {sev:sev, kind:kind, key:key, at:at||'', practice:!!o.practice, counts:o.counts!==false, n:needN++, rm:+o.rm>0?+o.rm:0, tap:o.tap||'', order:o.order||'', make:function(){
      var c=needTask(full());
      if(tweak) tweak(c);
      return c;
    }, pane:function(){
      /* 22 Oct 2026: the opened card, the same ways as the card's (tweak), every one of them */
      var c=needPane(full());
      if(tweak) tweak(c);
      return c;
    }, below:function(box){
      /* under it, the order's own card (its figures and its Agree inputs) or the account's */
      var ord=o.order&&(makerData&&makerData.orders||[]).filter(function(x){ return x.id===o.order; })[0], acc=o.u&&sheet&&sheet[o.u];
      if(ord&&ordOpen(ord)) orderCard(box, ord, {inline:true}); else if(acc) acctPane(box, acc);
    }, belowSig:function(){
      var ord=o.order&&(makerData&&makerData.orders||[]).filter(function(x){ return x.id===o.order; })[0], acc=o.u&&sheet&&sheet[o.u];
      /* and the cash held on it, so its countdown, Undo and Retry are drawn as Orders draws them */
      return JSON.stringify([key, ord||null, acc||null, ord?[makerCashHeld[ord.id]||null, makerCashSaid[ord.id]||null]:null]);
    }};
  }
  /* 16 NOV 2026, THE MOVE TO AMBIENT (place F): THE UNSENT BANNER is Ambient's Notice with its one quiet pill, Open, over every place until its entry is sent
     or discarded; unsentPlace stands it under the shown place's hero. The title says how many and since when, the sentence what to do. */
  function bannerCard(o){
    var age=ageOf(o.at), c=el('div','amb-notice need unsent-note'), t=el('span'), b=el('b','amb-notice__title',o.who+' '+o.what+(age?' \u00b7 '+age:''));
    c.setAttribute('data-sev',o.sev);
    c.appendChild(amb.node(amb.glyph('info')));
    t.appendChild(b); t.appendChild(document.createTextNode(o.why||'')); c.appendChild(t);
    if(o.open&&o.keepOpen){ var op=ambBtn(pill(['Open',o.act||'need.open',o.key]),true); op.addEventListener('click', o.open); c.appendChild(op); }
    return c;
  }
  /* a button drawn as Ambient's small pill, and a quiet one is a second choice. A disabled or aria state stays as it was. */
  function ambBtn(b, quiet){
    b.classList.remove('nbtn');
    b.classList.add('amb-pill','amb-pill--sm'); if(quiet) b.classList.add('amb-pill--quiet');
    return b;
  }
  /* a book's name in ink with its hue on the dot: Ambient's kind chip (the book's index in PSYM's order) */
  function nBook(product){ var k=String(product||'').toLowerCase().replace(/[^a-z]/g,''); return amb.node(amb.kindChip(k, k.charAt(0).toUpperCase()+k.slice(1))); }
  /* the action register's words on a to-do: Overdue when late, Due while it waits on his tap now, Open after. The group's word (Now, Soon, Watch) stays over the list. */
  function needTone(o){ return o.late?['neg','Overdue']:o.sev==='now'?['warn','Due']:o.sev==='watch'?['','Watch']:['','Open']; }
  /* THE CARD OF THE LIST (16 Nov 2026): Ambient's To-do. Line one the kind and its age and the state's chip; the title its one button (the whole card is the tap,
     the title's ::after stretched over it in site.css), a book's chip before the code; the money the card is about as its one figure; the way on a row of
     quiet small pills, made once the first is added; notes and an ask stand between, made once something writes to them. */
  function needTask(o){
    var tap=!!o.open, age=o.age!=null?o.age:ageOf(o.at), tt=o.title||o.who||'', st=needTone(o);
    var c=el('article','amb-task'+(st[0]?' amb-task--'+st[0]:'')+' ntask'), head=el('div','amb-task__head'), kd=el('span','amb-task__kind nkind',o.word),
      title=el('h3','amb-task__title'), tp=el(tap?'button':'span','need-title'+(tap?' need-tap':'')), go=el('div','amb-task__acts ngo'), bodyEl=null;
    if(tap){ tp.type='button'; actOn(tp,o.act||'need.open',o.key); tp.addEventListener('click', function(){ if(typeof o.onTap==='function') o.onTap(); else needOpen(o); }); }
    c.setAttribute('data-need', o.key); c.setAttribute('data-kind', o.kind); c.setAttribute('data-sev', o.sev);
    if(o.u) c.setAttribute('data-u', o.u);
    if(o.practice) c.setAttribute('data-practice','');
    if(age){ kd.appendChild(document.createTextNode(' \u00b7 ')); kd.appendChild(el('span','nage'+(o.late?' nage--late':''),age)); }
    head.appendChild(kd); head.appendChild(el('span','amb-chip'+(st[0]?' amb-chip--'+st[0]:''),st[1])); c.appendChild(head);
    if(o.mark) tp.appendChild(nBook(o.mark));
    tp.appendChild(whoTag(el('span','need-who'+(CODE_RE.test(tt)?' need-who--code':''),tt),tt));
    if(tap) tp.setAttribute('aria-label', o.word+': '+[(o.head||'')+(o.who||'')+(o.rest||''), o.what].filter(Boolean).join(', '));
    title.appendChild(tp); c.appendChild(title);
    if(+o.rm>0.004){ var f=el('div','amb-task__figures'), s=amb.node(amb.stat('Amount',rmShort(o.rm))); s.classList.add('nfig'); f.appendChild(s); c.appendChild(f); }
    Object.defineProperty(c,'_body',{get:function(){ if(!bodyEl){ bodyEl=el('div','nbody'); c.insertBefore(bodyEl, go.parentNode===c?go:null); } return bodyEl; }, configurable:true});
    c._grow=function(){ c.classList.add('need--grow'); };
    c._add=function(b){
      if(o.sev==='watch') return;   /* Ambient 0.7.5: Watch is a state with nothing to do yet, so it has no control (its title opens it) */
      var grown=c.classList.contains('need--grow');
      if(go.children.length&&!grown) return;
      var filled=!b.classList.contains('amb-pill--quiet');
      ambBtn(b, !(grown&&filled&&!go.children.length));
      if(!go.parentNode) c.appendChild(go);
      go.appendChild(b);
    };
    return c;
  }
  /* 22 OCT 2026 (canvas Needs you, his comments on the card): ONE SHAPE AND ONE HEIGHT, 76px on a phone and 80px wide. Line one is the kind and the age, the
     age in ember when late; line two the title, the code in the mono face (the verb is the button), a book's typed Product tag before it (on Salt Admin a
     book is its name, his answer of 22 Oct 2026, reversing his word of 12 Oct for this page alone; the Counter keeps its marks). The one action is a filled
     pill of one size, the figure large in the last column. No why line and no chip: the why, the clock and any second choice stand in the opened card. The
     whole card is still the tap, the title its button stretched over it, read in full to a reader. c._add takes the first action alone, and every action of
     the row once the card has grown (it asks once, or runs a turn), when the row stands under the body. */
  var CODE_RE=/^[A-Z]+[0-9]+-[A-Z0-9-]+$/;
  /* 22 OCT 2026 (canvas Needs you): A CARD TAPPED OPENS BESIDE THE LIST FROM 860PX, every kind of it; below 860px it goes to its place, as before */
  function needOpen(o){ if(wide()){ nOpenKey=o.key; drawNeedOpen(true); return; } o.open(); }
  /* THE OPENED CARD, the card in full: its kind and age, the title in words, verb first, what and why with the book's typed tag, the clock of an order, and
     every way of its row, the second choice (Decline, Show a code, Record payment) among them, the first filled and the rest ghosts. An order's or an
     account's card stands under it (item.below), where its own ways are, so the head of an order draws none of its own. */
  function needPane(o){
    var st=needTone(o), age=o.age!=null?o.age:ageOf(o.at), tt=o.title||o.who||'', bodyEl=null;
    var c=el('article','amb-task npane'+(st[0]?' amb-task--'+st[0]:'')), head=el('div','amb-task__head'), k=el('span','amb-task__kind npane__kind',o.word);
    c.setAttribute('data-pane', o.key); c.setAttribute('aria-label', 'The open card');
    if(age){ k.appendChild(document.createTextNode(' \u00b7 ')); k.appendChild(el('span','nage'+(o.late?' nage--late':''),age)); }
    head.appendChild(k); head.appendChild(el('span','amb-chip'+(st[0]?' amb-chip--'+st[0]:''),st[1])); c.appendChild(head);
    var h=el('h2','amb-task__title npane__title');
    if(o.head||o.rest){ if(o.head) h.appendChild(document.createTextNode(o.head)); h.appendChild(whoTag(el('span','need-who'+(CODE_RE.test(o.who)?' need-who--code':''),o.who),o.who)); if(o.rest) h.appendChild(document.createTextNode(o.rest)); }
    else { var pt=o.say||tt; h.appendChild(whoTag(el('span','need-who'+(CODE_RE.test(pt)?' need-who--code':''),pt),pt)); }
    c.appendChild(h);
    if(o.what||o.mark){ var w=el('p','amb-task__text npane__what'); if(o.mark) w.appendChild(nBook(o.mark)); if(o.what) w.appendChild(el('span',null,(o.mark?' ':'')+o.what)); c.appendChild(w); }
    if(o.why) c.appendChild(el('p','amb-task__text npane__why',o.why));
    /* an order's head draws no ways (its card under it has them) and so no ask, which the list's card holds; the Offer's keeps its ask-once Withdraw */
    var own=!o.order||!!o.ways, go=el('div','amb-foot npane__go'), acts=el('div','amb-task__acts npane__acts');
    Object.defineProperty(c,'_body',{get:function(){ if(!bodyEl){ bodyEl=el('div','npane__body'); c.insertBefore(bodyEl, acts.parentNode===c?acts:null); } return bodyEl; }, configurable:true});
    c._go=go; c._full=true; c._grow=function(){}; c._noWays=!own;
    /* the first filled action is the record's one main action, the foot (drawNeedOpen stands it last in the column); every other way a quiet pill under the words */
    c._add=function(b){
      if(!own) return;
      var filled=!b.classList.contains('amb-pill--quiet');
      if(filled&&!go.children.length){ ambBtn(b,false); b.classList.remove('amb-pill--sm'); b.classList.add('amb-pill--block'); go.appendChild(b); return; }
      ambBtn(b,true); if(!acts.parentNode) c.appendChild(acts); acts.appendChild(b);
    };
    return c;
  }
  /* a card's main button, on the card: it opens the full card where that action has inputs the card asks for, or asks in place where it is money */
  var needAsk={}, needBusy={}, needNote={};
  function mainButton(c,label,act,key,fn){ var b=pill([label,act,key]); b.addEventListener('click', fn); c._add(b); return b; }
  function needSays(c,key){ if(needNote[key]){ var n=noteOf(c); n.textContent=needNote[key]; n.className+=' bad'; } }
  /* a money tap asks once, on the card, before any request: Yes sends, Cancel sends nothing, and while a send is out both are off */
  function askBox(c,key,question,yes){
    if(c._noWays) return;   /* an order's head beside the list asks nothing; the list's card asks */
    if(c._grow) c._grow();
    var q=el('p','nask',question); q.setAttribute('role','group'); c._body.appendChild(q);
    var y=pill([needBusy[key]?'Sending.':'Yes','need.ask-yes',key]), n=ghost(['Cancel','need.ask-no',key]);
    y.disabled=n.disabled=!!needBusy[key];
    y.addEventListener('click', function(){ if(needBusy[key]) return; yes(); });
    n.addEventListener('click', function(){ if(needBusy[key]) return; delete needAsk[key]; drawNeeds(); });
    c._add(y); c._add(n);
  }
  function noteOf(c){ var m=el('p','nnote'); m.setAttribute('role','status'); c._body.appendChild(m); return m; }
  /* S9 fix: FROM 860PX NEEDS YOU STANDS BESIDE WHAT A CARD IS ABOUT (the plan's f13w, his decision 9 of 11 Oct 2026), as Customers does, and NOTHING
     OPENS BY ITSELF: the column says Choose a card until he taps, and only the card he tapped is marked current. 22 Oct 2026 (canvas Needs you): every card
     opens there, level with the first card, as the card in full (needPane) over the order's or the account's own card. The head is drawn with every
     redraw of the list, as the cards are; the card under it only when what it stands on changes, and never while a field of it is in use, so a redraw never
     takes a tap or a figure he is typing off it. A card gone from the list closes it. wide() is the two panes' width, which the page's CSS shares at 860px. */
  var nopen=document.getElementById('nopen'), nOpenKey=null, needLast=[];
  function wide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:960px)').matches); }
  /* the record's one main action stands last in its column (Ambient's foot), outside #nopen, and goes with the card */
  function nFoot(nh){
    var rec=nopen.parentNode, old=rec.querySelector(':scope > .npane__go'); if(old) rec.removeChild(old);
    var sv=document.getElementById('apBar');   /* 16 Nov 2026 (Ambient 0.7.5): while the save bar shows, saving is the one main action and no record has a foot */
    if(nh&&nh._go&&nh._go.children.length&&!(sv&&!sv.hidden)) rec.appendChild(nh._go);
  }
  /* an account's Open on a phone goes to its card on Customers */
  function openNeed(u){ showPlace('customers','accounts',{fresh:true,push:true}); openCard(u); }
  /* 22 Oct 2026 (Fable's review): a field with the focus holds the card; a tap does not, or the card would never follow what the tap did */
  function nopenInUse(){ var a=document.activeElement; return !!(a&&nopen.contains(a)&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); }
  function drawNeedOpen(force){
    var it=nOpenKey&&needLast.filter(function(i){ return i.key===nOpenKey; })[0];
    [].slice.call(nlist.querySelectorAll('[data-need]')).forEach(function(c){
      if(it&&c.getAttribute('data-need')===nOpenKey) c.setAttribute('aria-current','true'); else c.removeAttribute('aria-current'); });
    if(!it){
      nFoot(null);
      /* Fable's review: a tap that moved its order on takes the card off the list, so the pane keeps that order's answer in view until his next tap */
      var was=nopen.getAttribute('data-order'), said=was&&makerSaid[was];
      nOpenKey=null;
      if(said){ if(nopen.getAttribute('data-said')!==said){ nopen.textContent=''; nopen.removeAttribute('data-key'); nopen.setAttribute('data-said',said); nopen.hidden=false;
        var sl=el('p','amb-task__text npane__said',said); sl.setAttribute('role','status'); nopen.appendChild(sl); } return; }
      if(nopen.firstChild||!nopen.hidden){ nopen.hidden=true; nopen.textContent=''; nopen.removeAttribute('data-key'); nopen.removeAttribute('data-order'); mHome.classList.remove('open'); }
      return;
    }
    if(nopen.getAttribute('data-key')!==it.key){ nopen.textContent=''; nopen.setAttribute('data-key', it.key); nopen.setAttribute('data-order', it.order); nopen.removeAttribute('data-said'); force=true; }
    mHome.classList.add('open'); nopen.hidden=false;
    var head=nopen.querySelector(':scope > .npane'), low=nopen.querySelector(':scope > .npane-x'), nh=it.pane();
    if(head) nopen.replaceChild(nh, head); else nopen.insertBefore(nh, nopen.firstChild);
    nFoot(nh);
    if(!low){ low=el('div','npane-x'); nopen.appendChild(low); }
    var sig=it.belowSig();
    if(force||(low.getAttribute('data-sig')!==sig&&!nopenInUse())){ low.textContent=''; low.setAttribute('data-sig', sig); it.below(low); }
  }
  /* the standing link for strangers is what an ID with no account is shown */
  function strangerLink(){
    return links.filter(function(r){ return r.standing&&!r.revoked; })[0]||null;
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
      /* 22 Oct 2026: the card's button is one size, so it says Send and Share, and a reader hears the whole */
      b.disabled=!!m.busy; b.textContent=m.busy?'Making':m.j?'Share':'Send'; b.setAttribute('aria-label',m.busy?'Making it...':m.j?'Share the link':'Send a sign-in link');
      note.textContent=m.note||''; withDetails(note,m.err);
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
    return item('now','accounts','Link','l:'+r.id, r.made, {who:who, head:'Approve ', rest:"'s guest link", what:'Made '+when(r.made),
      why:'A link for a friend. It opens nothing until you approve it.', open:goPlace('customers','links'), counts:waitingLink(r)&&!done}, function(c){
      if(done){ noteOf(c).textContent=moved.t; return; }
      var ap=pill(['Approve','need.link-approve']), de=ghost(['Decline','need.link-decline']);
      ap.setAttribute('data-move',''); de.setAttribute('data-move','');
      /* a card drawn while a move on its link is out (the open card beside the list) is off with the rest */
      ap.disabled=de.disabled=!!moving[r.id];
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
    return item('now','accounts','Locked','k:'+a.username, held>0?new Date(held-900000).toISOString():'', {who:a.code||a.username, u:a.username, head:'Send ', rest:' a sign-in link', what:'Locked out'+(L.until?' until '+hm(L.until):''),
      why:'Too many wrong passwords. If it was them, send a sign-in link.'
        +(s&&s.opens?' Last signed in'+(howOf(s)?' '+howOf(s):'')+', '+dayMon(s.last)+'.':' Has never signed in.'),
      open:function(){ openNeed(a.username); }}, function(c){
      c._add(linkButton(a, noteOf(c)));
      /* and Show a code, in person, stage 3's hand-over (showHandover), for a customer at his counter */
      var sc=ghost(['Show a code','need.show-code']); sc.addEventListener('click', function(){ showHandover(a, sc); }); c._add(sc);
    });
  }
  function bareNeed(a){
    return item('now','accounts','Account','n:'+a.username, '', {who:a.code||a.username, u:a.username, head:'Set up ', rest:"'s account", what:'No account yet', why:waitLine(),
      open:function(){ openNeed(a.username); }}, function(c){
      silverOn(a, c, 'need');
    });
  }
  function silverOn(a, c, at){
    var sh=pill(['Show',at+'.show-link']); sh.setAttribute('aria-label','Show the guest price list');
    c._add(sh);
    var note=noteOf(c);
    function openSilverOn(){
      var r=strangerLink();
      if(!r){ note.textContent='The guest link is not made yet. Open Links once, then try again.'; return; }
      silverOpen[a.username]=true;
      var box=el('figure','amb-codeframe glink'), fld=el('div','amb-codeframe__field'), img=document.createElement('img'), cp=ghost(['Copy link',at+'.copy-link']), cap=el('figcaption','amb-codeframe__caption');
      cap.appendChild(el('code','gu',r.url));
      img.src=r.qr; img.alt='QR to the guest price list'; img.width=180; img.height=180; fld.appendChild(img); box.appendChild(fld); box.appendChild(cap);
      cp.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); note.textContent='Copied.'; }catch(e){ note.textContent='Copy failed.'; }
      });
      box.appendChild(cp);
      if(c._grow) c._grow(); c._body.insertBefore(box, note); sh.disabled=true;
    }
    sh.addEventListener('click', openSilverOn);
    if(silverOpen[a.username]) openSilverOn();
  }
  function sendAt(rows){ return rows.map(function(a){ return a.issued||''; }).filter(Boolean).sort()[0]||''; }
  function sendNeed(rows){
    var codes=rows.map(function(a){ return a.code||a.username; }), first=sendAt(rows);
    var named=codes.length>6?codes.slice(0,5).concat([(codes.length-5)+' more']):codes;
    return item('now','accounts','Account','s', first, {who:rows.length+(rows.length===1?' account has':' accounts have')+' not been sent their sign-in link', title:rows.length===1?codes[0]:rows.length+' accounts', say:rows.length+(rows.length===1?' account has':' accounts have')+' not been sent their sign-in link', what:first?'ready since '+dayMon(first):'',
      why:andList(named)+'.', open:function(){ showPlace('customers','accounts',{fresh:true,push:true}); filterBy('unsent'); }}, function(c){
      var go=pill(['Send','need.send-turn']); go.setAttribute('aria-label','Send sign-in links one by one');
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
  function orderOpener(id){ return function(){ var e=ordEntries[id], st=e?e.parts.replace('orders.',''):'todo'; showPlace('orders',st,{fresh:true, push:true}); openOrder(id); }; }
  function orderWhat(o){ return units(o.qty)+' · '+rm(o.total); }
  function waitingClaims(){ return makerClaims.filter(function(c){ return c.state==='waiting'; }); }
  function pendingRows(){ return (makerData&&makerData.drafts||[]).filter(function(d){ return d.status==='pending'; }); }
  /* 15 Oct 2026 (plan 1, part 2): a device's queue key the Desk could not read (malformed, or with no matching device), named so he can mend it;
     every other entry is read beside it */
  function unreadableKeys(){ return (makerData&&makerData.unreadable||[]).filter(function(k){ return typeof k==='string'; }); }
  function unreadableLine(keys){ return keys.length+(keys.length===1?' queue entry':' queue entries')+' unreadable: '+keys.join(', '); }
  function unreadableNeed(keys){
    return item('now','rows','Entry','qx', '', {who:'Desk queue', what:unreadableLine(keys),
      why:'Every other entry is read as usual. No entry is withdrawn until that key is mended.', open:goPlace('orders','approve')}, function(c){ mainButton(c,'Check','need.check','qx', goPlace('orders','approve')); });
  }
  /* 28 Oct 2026 (his screenshot, four cards reading Desk and Fix alone): the title is the reason, held to one line, so no card is blank */
  function entryNeed(r, key){
    return item('now','rows','Entry',key, isoAt(r.at||r.seenAt||r.id), {who:r.party||'Desk', head:'Fix ', rest:"'s entry", what:'Did not get through', title:notTaken(r.why),
      why:noBook(r.why||'The Desk could not take this entry.'), open:goPlace('orders','approve')}, function(c){ mainButton(c,'Fix','need.fix',key, goPlace('orders','approve')); });
  }
  /* 28 OCT 2026 (his word): A RED SUITE IS THE DESK INFORMING HIM, never his entry to fix. cloud-commit writes it as the refusal suite:<version> and clears
     every one on the next green suite (tools/drafts.mjs --clear-suite-notices), so it is one FYI line, the newest version alone, with no button */
  /* plan version 4, part 4a (his answer E, walk-in ready): A WALK-IN TAKES THE NEXT READY ACCOUNT at Add ID, so Needs you says when fewer than ten are
     left (tools/stmt-pool.mjs POOL_LOW, the same figure, pinned by the suite), as the last publish counted them; the laptop's pool makes fifty again. FYI: nothing to tap here */
  var POOL_LOW=10;
  function poolNeed(n){
    var t=n===0?'No ready accounts left':n+' ready account'+(n===1?'':'s')+' left';
    return item('watch','watch','Accounts','x:pool', sheetAt||'', {who:'Accounts', title:t, what:t, counts:false,
      why:'A walk-in takes one at Add ID, so run the pool on the laptop to make fifty again.', open:(wide()?function(){}:null)});
  }
  /* 13 Nov 2026 (the price band's version 3, the customers): one FYI line says the week's new buyers, read off the Desk's catalogue. Nothing here prices.
     16 Nov 2026, his word "Remove it": NO CARD FOR THE REGULARS due, late or lapsed. It asked nothing of him: the reminder wakes them by itself (stmt/remind.js),
     the win-back waits for their next Accept, and their habit stands on their account (habitRows) and on the Desk's Clients. */
  var buyersNow=null, buyersRead=false;
  function readBuyers(){
    return refs('/all/maker/inputs').then(function(j){
      var c=(j&&j.catalog)||{}; buyersRead=true;
      if(changed('buyers',c.buyers||null)){ buyersNow=c.buyers&&typeof c.buyers==='object'?c.buyers:null; drawNeeds(); }
    },function(){});
  }
  function buyersNeed(b){
    var t=(b.count>0?b.count+' new this week':'No new buyers this week')+(b.introduced>0?', '+b.introduced+' through an associate':'')+(b.back>0?', '+b.back+' came back':'')+(b.thin?'. Thin against the weeks before':'');
    return item('watch','accounts','New buyers','x:buyers', '', {who:t, title:t, mark:'salt', what:t, counts:false,
      why:'First orders in the last 7 days, against the eight weeks before.', open:(wide()?function(){}:null)});
  }
  function suiteRow(r){ return /^suite:/.test(String(r&&r.id||'')); }
  function suiteNeed(rows){
    var r=rows.slice().sort(function(a,b){ return String(a.seenAt||'')<String(b.seenAt||'')?1:-1; })[0], v=String(r.id).slice(6);
    return item('watch','watch','Tests','x:suite', isoAt(r.seenAt), {who:'Desk', title:'Desk tests red after '+v, what:'Desk tests red after '+v, counts:false,
      why:noBook(r.why||'')+(rows.length>1?' Earlier red runs: '+(rows.length-1)+'.':''), open:wide()?function(){}:null});
  }
  /* an entry kept on this phone and not confirmed (Phase 4c): Soon, his own work; its Open is Record, on the entry's own section, where Send again, Update and send and Discard are */
  function unsentNeed(u){
    var w=unsentWord(u);
    return item('now','rows','Unsent','u:'+u.path, u.at, {who:u.who||'This phone', what:w.charAt(0).toUpperCase()+w.slice(1),
      why:unsentSaid(u)+' Open it to send it again, update it or discard it.', open:function(){ unsentOpen(u); }}, function(c){ mainButton(c,'Open','need.unsent','u:'+u.path, function(){ unsentOpen(u); }); });
  }
  function threadNeed(t){
    var last=t.msgs[t.msgs.length-1];
    return item('now','messages','Message','m:'+t.u, last.at, {who:codeByUser(t.u), head:'Reply to ', what:cut(last.text), practice:!!t.test,
      open:function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(t.u); }}, function(c){
      mainButton(c,'Reply','need.reply','m:'+t.u, function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(t.u); });
    });
  }
  /* ---- 15 Oct 2026 (plan 1, parts 3 and 4): WHAT IS OWED, BOTH WAYS, as Soon cards, his own work. The figures are the Desk's (/all/maker/inputs, owedMoney
     and owedGoods: src/maker-inputs.js owedBothWays over the engine's txAdvance, txUnpaidSince, the term and txStat), so nothing is reckoned here.
     A card's button opens the site order its row belongs to (the order's ledgerKey is the row's ovKey) on Money received or the handover; a row
     with no site order opens Record's Correct a row on that row, as goods or cash moved. The button opens; it books nothing. ---- */
  var owed=null, owedReading=false, owedAt=0;
  async function loadOwed(){
    if(owedReading) return;
    owedReading=true;
    var apply=false;
    try{
      var j=await refs('/all/maker/inputs'), c=(j&&j.catalog)||{};
      if(!Array.isArray(c.owedMoney)||!Array.isArray(c.owedGoods)) throw new Error(c.owedError||c.error||'The Desk did not say what is owed.');
      nGot('book');
      var v={money:c.owedMoney, goods:c.owedGoods, refunds:Array.isArray(c.openRefunds)?c.openRefunds:null};
      if(changed('book', v)){ owed=v; apply=true; }
    }catch(error){ nGot('book', error); apply=failNew('book', error); }
    owedAt=Date.now(); owedReading=false;
    /* 25 Oct 2026: and Accounts, whose Owed says how late (P1); 20 Nov 2026: and each account's credit, off the same read */
    if(apply){ liveSheet(); drawNeeds(); drawRoster(); if(aOpen) openCard(aOpen); }
  }
  /* 20 Nov 2026 (his yes: Salt Admin reads the live Desk, after CM4-TO's and CD4-DAM's credits stood four minutes past his Approve): AN ACCOUNT'S
     CREDIT IS THE DESK'S OPEN REFUNDS, read with what is owed (/all/maker/inputs, openRefunds off the book's customerRefunds), never the statement
     sealed at the last publish. The refund is theirs by its exact code, as the statement counts it (make_statements stmtRefunds), and the flag is
     chosen again in the publish's own order (reviewFlag): owed, goods, credit, agreed, settled. The sealed figures stay under seal, and stand alone
     while the Desk's read has not landed or names no refunds. Only the credit is live: what they owe stays the statement's until the next publish. */
  function liveAcct(a, refunds){
    if(!a||a.test||!a.t||!Array.isArray(refunds)) return a;
    var seal=a.seal||{t:a.t, flag:a.flag}, t={}, o={}, k;
    for(k in seal.t) t[k]=seal.t[k];
    t.refund=+refunds.filter(function(r){ return r&&r.party===a.code; }).reduce(function(s,r){ return s+(+r.amount||0); },0).toFixed(2);
    for(k in a) o[k]=a[k];
    o.t=t; o.seal=seal;
    o.flag=+t.owed>0.009?'owes':+t.toGet>0.009?'goods':t.refund>0.009?'refund':+t.pend>0.009?'pend':'clear';
    return o;
  }
  function liveSheet(){
    if(!sheet||!owed||!owed.refunds) return;
    sheetRows=sheetRows.map(function(a){ return liveAcct(a, owed.refunds); });
    sheet={}; sheetRows.forEach(function(a){ sheet[a.username]=a; });
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
  /* 27 Oct 2026, his word: a row opens in the sale form, from the Ledger and from Needs you's owed cards alike; Correct a row stays, reached from it as Other fields */
  var amendWant=null, amendPick=null, tradeEditPick=null;
  function applyAmend(){
    if(!amendWant||!tradeEditPick) return;
    var rid=amendWant; amendWant=null;
    if(tradeEditPick(rid)) openForm('sale-or-purchase');
  }
  function amendFor(rid){ amendWant=rid; showPlace('record','entry',{fresh:true,push:true}); applyAmend(); }
  /* 9 Nov 2026: an account by its code, from the Desk's Act (a refund to mark paid); a -R bucket is its associate's, having no account of its own;
     a code with no account opens the list */
  function acctFor(code){
    var own=String(code).replace(/-R$/,''), list=(OWNER&&OWNER.accounts||[]).filter(function(x){ return x.username; });
    var a=list.filter(function(x){ return x.code===code; })[0]||list.filter(function(x){ return x.code===own; })[0];
    if(a) openNeed(a.username); else showPlace('customers','accounts',{fresh:true,push:true});
  }
  /* the want's own address is replaced first, by the place he was on: the want then pushes its place, so Back leaves it rather than opening it again */
  function wantGo(w){ if(w[0]==='row') amendFor(w[1]); else if(w[0]==='acct') acctFor(w[1]); else if(w[0]==='tip') tipFor(w[1]); else if(w[0]==='market') marketFor(w[1]); else if(w[0]==='anchor') marketFor('anchor',w[1].split('/')[0],w[1].split('/')[1]); }
  function owedGo(r, sect){
    var o=siteOrderOf(r);
    if(o) openOrderAt(o.id, sect); else amendFor(r.rid);
  }
  function moneyNeed(m){
    var first=m.rows[0];
    /* 22 Oct 2026 (canvas Needs you): its age is how late it is, in ember; its one tap is Message, their thread, and Record payment stands in the opened card */
    var acc=OWNER.accounts.filter(function(x){ return x.code===m.party&&x.username; })[0], late=ageOf(m.due);
    return item('soon','payments','Owed','$:'+m.party, m.since, {who:m.party, head:'Collect '+rm(m.rm)+' from ', what:'Past term', rm:+m.rm||0, age:late?late+' late':'', late:!!late,
      why:'Handed over '+fmtWhen(m.since)+', due '+fmtWhen(m.due)+'.'+(m.rows.length>1?' '+m.rows.length+' orders; the oldest opens.':''),
      open:function(){ owedGo(first,'[data-amend]'); }}, function(c){
      if(acc){ var ms=pill(['Message','need.owed-message',m.party]); ms.addEventListener('click', function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(acc.username); }); c._add(ms); }
      var b=ghost(['Record','need.owed-pay',m.party]); b.setAttribute('aria-label','Record payment'); b.addEventListener('click', function(){ owedGo(first,'[data-amend]'); }); c._add(b);
    });
  }
  function goodsNeed(r){
    return item('now','orders','To hand over','g:'+r.rid, r.date||'', {who:r.party, head:'Hand over to ', mark:r.product, what:units(r.units)+' paid, not handed over',
      why:r.date?'Ordered '+fmtWhen(r.date)+'.':'', open:function(){ owedGo(r,'[data-amend]'); }}, function(c){
      var b=pill(['Handover','need.owed-hand',r.rid]); b.addEventListener('click', function(){ owedGo(r,'[data-amend]'); }); c._add(b);
    });
  }
  /* the Watch cards: an override in force, a notice set. 15 Oct 2026 (plan 1, part 5): THE DESK'S OWN COUNT IS NO CARD. "The Desk shows 4 for you" named
     nothing he could act on, and every kind it counts (the master's ordActs: an order placed, a question asked, a payment they say they sent, cash
     to record on goods handed over) is a card of its own here: Order, Message, Payment, and Owed once past its term. */
  function hoursNeed(m){
    var wd=day3('en')[new Date(Date.parse(m.until)+28800000).getUTCDay()];
    var said=(m.open?'Open':'Paused')+' until '+wd+' '+hm(m.until);
    return item('watch','watch','Hours','w:hours', '', {who:'Shop', title:said, what:said, age:'today',
      why:'The weekly hours are overridden for now.', open:goPlace('shop','hours')}, function(c){ mainButton(c,'Change','need.hours','w:hours', goPlace('shop','hours')); });
  }
  /* 17 Nov 2026: the Counter under his maintenance switch, to the moment it lifts */
  function maintNeed(until){
    var said='Under maintenance until '+barWhen(until);
    return item('watch','watch','Maintenance','w:maint', '', {who:'Shop', title:said, what:said, age:'today',
      why:'Customers cannot sign in and see the notice at the door; Salt Admin stays open.', open:goPlace('shop','hours')}, function(c){ mainButton(c,'Change','need.maint','w:maint', goPlace('shop','hours')); });
  }
  function noticeNeed(lines){
    return item('watch','watch','Notice','w:notice', '', {who:'Shop', title:cut(lines.join(' · ')), what:cut(lines.join(' · ')), why:'This line is at the top of every customer account.', open:goPlace('shop','notice')},
      function(c){ mainButton(c,'Change','need.notice','w:notice', goPlace('shop','notice')); });
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
    return item('now','accounts','Account','s', sendAt(t.rows), {who:fin?'All done':(t.i+1)+' of '+n, what:did+' of '+n+' sent', counts:counts,
      why:fin?(did===n?'Each has their link, and each is ticked sent.':'The ones not ticked are still on Accounts, under Not sent.')
        :(a.code||a.username)+(t.copied?': their message is copied.':t.j?': their link is made. Share it and it is ticked sent.':': making their link.'),
      open:function(){ showPlace('customers','accounts',{fresh:true,push:true}); filterBy('unsent'); }}, function(c){
      if(c._grow) c._grow();
      if(!c._full){ var tw=fin?(did===n?'Each has their link, and each is ticked sent.':'The ones not ticked are still on Accounts, under Not sent.')
        :(a.code||a.username)+(t.copied?': their message is copied.':t.j?': their link is made. Share it and it is ticked sent.':': making their link.');
        c._body.appendChild(el('p','amb-task__text',did+' of '+n+' sent. '+tw)); }
      var ticks=el('div','achips');
      t.rows.forEach(function(x, k){ var did=t.sent.indexOf(x.username)>=0;
        ticks.appendChild(chip(did?'verdigris':(k===t.i?'brass':'mist'), (x.code||x.username)+(did?', sent':''))); });
      c._body.appendChild(ticks);
      if(fin){ var dn=ghost(['Done','need.turn-done']); dn.addEventListener('click', function(){ turn=null; drawNeeds(); }); c._add(dn); }
      else {
        var sh=pill(['','need.turn-share']); sh.textContent=t.copied?'Sent it':'Share'; sh.disabled=!t.j||!!t.busy; sh.addEventListener('click', turnShare);
        var sk=ghost(['Skip','need.turn-skip']); sk.disabled=!!t.busy; sk.addEventListener('click', function(){ if(turn.busy) return; turn.i++; turnStep(); });
        c._add(sh); c._add(sk);
      }
      var tn=noteOf(c); tn.textContent=t.why; withDetails(tn,t.whyErr);
    });
  }
  /* THE MONEY BUTTONS OF NEEDS YOU. One payment waiting on an order: Received asks once on the card, then sends what the order card's Received sends (orderReceived,
     makerTap: one request id until it lands, makerBusy). More than one: the full card, which lists them. */
  function orderPayButton(c, o, pays){
    var key='p:'+o.id, who=codeByUser(o.u);
    if(pays.length!==1){ mainButton(c,'Review','need.review',key, orderOpener(o.id)); needSays(c,key); return; }
    var pp=pays[0], onBook=payOnBook(o,pp);
    if(!needAsk[key]){ var rb=mainButton(c,onBook?'Recorded':'Received','need.received',key, function(){ delete needNote[key]; needAsk[key]=true; drawNeeds(); }); if(onBook) rb.setAttribute('aria-label','Already recorded'); }
    else askBox(c,key,onBook?'Already recorded, '+rm(pp.amount)+'?':'Confirm '+rm(pp.amount)+' received from '+who+'?', function(){
      needBusy[key]=true; drawNeeds();
      orderReceived(o,pp).then(function(done){
        delete needBusy[key];
        if(done) delete needAsk[key]; else needNote[key]=done===undefined?'Busy, try again.':makerSaid[o.id]||'Not confirmed. Try again.';
        drawNeeds();
      });
    });
    needSays(c,key);
  }
  /* 22 Oct 2026: WITHDRAW AN OFFER asks once on the card, then sends what the order card's Take back the offer sends (makerTap withdraw, one request id) */
  function offerButton(c, o, apf){
    var key='f:'+o.id;
    if(!needAsk[key]) mainButton(c,'Withdraw','need.withdraw',key, function(){ delete needNote[key]; needAsk[key]=true; drawNeeds(); });
    else askBox(c,key,'Take back your offer of '+rm((+apf.total||0)+(+apf.delivery||0))+' to '+codeByUser(o.u)+'?', function(){
      needBusy[key]=true; drawNeeds();
      makerTap(o,'withdraw',{},makerWithdrawSaid(o)).then(function(done){
        delete needBusy[key];
        if(done) delete needAsk[key]; else needNote[key]=done===undefined?'Busy, try again.':makerSaid[o.id]||'Not withdrawn. Try again.';
        drawNeeds();
      });
    });
    needSays(c,key);
  }
  /* A payment against the account: its rows are read first (the card's own preview), and when they settle cleanly Received asks once on the card and sends
     the card's request (sendClaimAnswer, the same request id). Rows that need a look open the full card. */
  function claimPayButton(c, claim){
    var key='c:'+claim.u+':'+claim.id, ck=claim.u+':'+claim.id, who=codeByUser(claim.u), ask=needAsk[key];
    function full(){ delete needAsk[key]; makerClaimOpen=ck; goPlace('orders','payments')(); }
    function send(hash){
      var body={hash:hash}, intended=JSON.stringify({action:'received',body:body});
      var req=makerClaimRequests[ck]||(makerClaimRequests[ck]={intended:intended,action:'received',body:Object.assign({rid:mintRid()},body),busy:false});
      if(req.busy) return;
      req.busy=true; needBusy[key]=true; drawNeeds();
      sendClaimAnswer(claim,ck,req).then(function(){ delete needAsk[key]; },function(e){ if(e&&e.detail&&e.detail.differs) delete makerClaimRequests[ck]; needNote[key]='Not confirmed: '+e.message; }).then(function(){ req.busy=false; delete needBusy[key]; drawNeeds(); });
    }
    if(!ask){
      mainButton(c,'Received','need.received',key, function(){ delete needNote[key]; if(makerClaimRequests[ck]){ full(); return; } needAsk[key]={}; drawNeeds(); });
      if(c._full){ var oc=ghost(['Open the claim','need.claim-open',key]); oc.addEventListener('click', full); c._add(oc); }
    }else askBox(c,key,'Confirm '+rm(claim.amount)+' received from '+who+'?', function(){
      /* Yes reads the rows first, as the card's own Received does; rows that need a look open the full card instead of sending */
      needBusy[key]=true; drawNeeds();
      refs('/all/maker/claims/'+claim.u+'/'+claim.id+'/preview',{}).then(function(r){
        delete needBusy[key];
        if(r.booked||r.left>0.004){ full(); return; }
        send(r.hash);
      },function(e){ delete needBusy[key]; needNote[key]='Could not read the rows: '+e.message; drawNeeds(); });
    });
    needSays(c,key);
  }
  /* every card there is, ranked: Now before Soon before Watch, a real one before a practice one, the oldest first, those with no age last */
  function needItems(){
    var L=[], real=sheetRows.filter(function(a){ return !a.test; }), orders=makerData&&makerData.orders||[];
    needN=0;
    orders.filter(ordWaits).forEach(function(o){
      var who=codeByUser(o.u), t=!!o.test, to=orderOpener(o.id), pays=ordPays(o);
      /* P5: a sheet's placed orders are one card, the first's, saying how many; the others draw none */
      var shP=o.sheet?orders.filter(function(x){ return x.u===o.u&&x.sheet===o.sheet&&x.status==='placed'&&ordWaits(x); }).sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); }):[];
      var held=o.status==='placed'&&makerAccHeld(o), apf=held&&o.price.offer||{};
      if(o.status==='placed'&&shP.length>1&&shP[0].id!==o.id){}
      /* 22 Oct 2026 (canvas Needs you): his Accept sent for their yes is theirs to answer, so Pending, its one tap Withdraw, asked once on the card;
         one they said yes to waits on its row under Approve, which the glance counts, so it draws no card here */
      else if(held&&o.price.state==='offered') L.push(item('soon','orders','Offer','f:'+o.id, o.price.offeredAt||o.at, {who:who, head:'Offer to ', mark:o.product, order:o.id,
        what:'Waits on their yes until '+fmtWhen(apf.until), practice:t, open:to, rm:(+apf.total||0)+(+apf.delivery||0), ways:true}, function(c){ offerButton(c,o,apf); }));
      else if(held){}
      else if(o.status==='placed') L.push(item('now','orders','Order','o:'+o.id, o.at, {who:who, head:makerAsked(o)?'Offer on ':'Agree ', rest:shP.length>1?"'s sheet":"'s order", mark:o.product, what:shP.length>1?shP.length+' orders on one sheet':orderWhat(o), practice:t, open:to, order:o.id,
        rm:shP.length>1?shP.reduce(function(s,x){ return s+(+x.total||0); },0):+o.total||0, tap:'agree', late:!!(clockOf(o)||{}).late}, function(c){
        /* Agree needs the delivery charge and the window, which the full card asks for, so the button opens it; the clock stands in the opened card */
        var k=c._full&&clockOf(o);
        if(k){ var nc=el('p','need-clock'+(k.late?' need-clock--late':'')); nc.setAttribute('data-clock','');
          nc.appendChild(el('strong','oclock__min',k.waited+' min')); nc.appendChild(document.createTextNode(' waiting'+(k.usual!=null?', usually '+k.usual:'')));
          c._body.appendChild(nc); }
        mainButton(c,makerAsked(o)?'Offer':'Agree','need.agree','o:'+o.id, to);
      }));
      /* a question of theirs on the order that he has not answered (the Worker's awaitingAnswer), as an account's thread is Now when asked */
      if(orderAsked(o)){
        var last=o.msgs[o.msgs.length-1];
        L.push(item('now','messages','Message','om:'+o.id, last.at, {who:who, head:'Reply to ', what:cut(last.text), why:'On their order.', practice:t, open:to, order:o.id}, function(c){
          mainButton(c,'Reply','need.reply','om:'+o.id, to);
        }));
      }
      if(pays.length){
        var sum=pays.reduce(function(s,p){ return s+(+p.amount||0); },0), first=pays.map(function(p){ return p.at||''; }).filter(Boolean).sort()[0]||'';
        L.push(item('now','payments','Payment','p:'+o.id, first, {who:who, head:'Confirm ', rest:"'s "+rm(sum), what:'Says they paid', practice:t, open:to, rm:sum, tap:'confirm', order:o.id}, function(c){ orderPayButton(c,o,pays); }));
      }
      if(o.again&&o.again.length) L.push(item('now','orders','Order','a:'+o.id, o.at, {who:who, head:'Send ', rest:"'s order again", mark:o.product, what:orderWhat(o),
        why:'A step you rejected waits to be sent again.', practice:t, open:to, order:o.id}, function(c){ mainButton(c,'Review','need.review','a:'+o.id, to); }));
    });
    waitingClaims().forEach(function(c){
      L.push(item('now','payments','Payment','c:'+c.u+':'+c.id, c.at, {who:codeByUser(c.u), head:'Confirm ', rest:"'s "+rm(c.amount), what:'Says they paid',
        practice:!!c.test, open:goPlace('orders','payments'), rm:+c.amount||0, tap:'confirm'}, function(card){ claimPayButton(card,c); }));
    });
    makerThreads.filter(makerThreadAsked).forEach(function(t){ L.push(threadNeed(t)); });
    real.filter(function(a){ return a.account&&a.locked; }).forEach(function(a){ L.push(lockNeed(a)); });
    var rows=pendingRows();
    /* 22 Oct 2026 (his answer, no overlaps): a row to approve is on Orders > Approve alone; the glance counts them (To approve) */
    (makerData&&makerData.refused||[]).forEach(function(r, i){ if(!suiteRow(r)) L.push(entryNeed(r, 'x:'+i)); });
    var reds=(makerData&&makerData.refused||[]).filter(suiteRow);
    if(reds.length) L.push(suiteNeed(reds));
    (makerData&&makerData.queue||[]).filter(function(e){ return e.state==='refused'; }).forEach(function(e){ L.push(entryNeed(e, 'q:'+e.id)); });
    if(unreadableKeys().length) L.push(unreadableNeed(unreadableKeys()));
    if(sheetSpares!=null&&sheetSpares<POOL_LOW) L.push(poolNeed(sheetSpares));
    if(buyersNow&&(buyersNow.count>0||buyersNow.thin)) L.push(buyersNeed(buyersNow));
    if(owed) owed.money.forEach(function(m){ if(m&&m.rows&&m.rows.length) L.push(moneyNeed(m)); });
    if(owed) owed.goods.forEach(function(r){ if(r&&r.rid) L.push(goodsNeed(r)); });
    unsentList().forEach(function(u){ L.push(unsentNeed(u)); });
    /* a link he has just moved stays where he tapped it, saying what happened, and is no longer counted */
    links.filter(function(r){ return waitingLink(r)||(moved&&moved.id===r.id&&!r.standing&&r.by); }).forEach(function(r){ L.push(linkNeed(r)); });
    joins.forEach(function(r){ if(r.revoked||r.declined===true) return; if(r.state==='sent') L.push(joinNeed(r)); else if(r.state==='added') L.push(joinSignNeed(r)); });
    real.filter(function(a){ return a.account===false; }).forEach(function(a){ L.push(bareNeed(a)); });
    var fresh=real.filter(function(a){ return a.account&&!a.sent&&!(a.seen&&a.seen.opens); });
    if(turn||fresh.length) L.push(turn?turnCard(fresh.length>0):sendNeed(fresh));
    var manual=makerHours&&makerHours.status&&makerHours.status.source==='manual'&&makerHours.config&&makerHours.config.manual;
    if(manual) L.push(hoursNeed(manual));
    if(maintUntil()) L.push(maintNeed(maintUntil()));
    if(makerNotice&&makerNotice.length) L.push(noticeNeed(makerNotice));
    /* within a group (drawNeeds heads them To do, Pending, FYI, practice apart under its own line): 22 Oct 2026, his word, MONEY FIRST, the largest
       sum first; then the cards with no sum, the oldest first, those with no age last; then as built */
    return L.sort(function(a, b){
      var ma=a.rm>0.004, mb=b.rm>0.004;
      if(ma!==mb) return ma?-1:1;
      if(ma&&Math.abs(a.rm-b.rm)>0.004) return b.rm-a.rm;
      var ta=Date.parse(a.at), tb=Date.parse(b.at);
      if(isFinite(ta)!==isFinite(tb)) return isFinite(ta)?-1:1;
      return (isFinite(ta)&&ta!==tb)?ta-tb:a.n-b.n;
    });
  }
  /* the count on each item of the bars: Needs you counts what waits on him; Orders counts the orders still open (not ended or completed), book rows and trips with them (ordOpenCount); Customers what asks him. Record and Shop have none. A practice item is never counted. */
  function drawCounts(items){
    setCount('needs', items.filter(function(i){ return i.sev==='now'&&!i.practice&&i.counts; }).length);
    setCount('orders', ordOpenCount());
    setCount('customers', makerThreads.filter(function(t){ return !t.test&&makerThreadAsked(t); }).length+links.filter(waitingLink).length);
    barLive(draftGroups(pendingRows()).length);
  }
  /* 21 Oct 2026 (his word, the bar was bare) to 15 Nov 2026: the bar's chips went with the bar. What waits is the tab counts (setCount), so
     this reads what it read and draws nothing but Approve's name in Orders' hero; drawCounts still calls it, and it answers the figures. */
  function barLive(rows){
    var n={approve:rows}; ['needs','orders','customers'].forEach(function(k){ var c=document.querySelector('[data-count="'+k+'"]'); n[k]=+(c&&c.textContent)||0; });
    /* Orders' Approve, in its hero, names the rows that wait */
    /* 18 Nov 2026 (his answer D): every place's bar carries Approve; Orders' own always stands, the others only while rows wait */
    var apSay=rows?'Approve, '+rows+' to approve':'Approve';
    [].forEach.call(document.querySelectorAll('[data-approve]'), function(apBtn){
      if(apBtn.getAttribute('aria-label')!==apSay) apBtn.setAttribute('aria-label',apSay);
      if(!apBtn.id&&apBtn.hidden!==!rows) apBtn.hidden=!rows;
    });
    return n;
  }
  function needsReady(){ return NEED_SRC.every(function(s){ return nSrc[s[0]]; }); }
  function needsBad(){ return NEED_SRC.filter(function(s){ return nSrc[s[0]]&&nSrc[s[0]]!=='ok'; }).map(function(s){ return s[1]; }); }
  /* 15 Oct 2026 (plan 1, his word: "Nothing needs you" while its orders read had failed): A READ THAT FAILED LEADS THE PAGE, above the title, in plain
     words and with a Retry, and the all-clear is said only when every read got through. The banner is made once and its words changed, so a redraw
     never takes the Retry from under his finger. */
  var nFail=document.getElementById('nFail'), nRetry=null;
  function drawFail(bad){
    if(!nFail) return;
    if(nFail.hidden!==!bad.length) nFail.hidden=!bad.length;   /* R4: written only when it differs, as the stock's tick redraws the lead */
    if(!bad.length) return;
    if(!nRetry){
      nFail.textContent=''; nFail.appendChild(amb.node(amb.glyph('info'))); nFail.appendChild(el('span','nfail__what'));
      nRetry=ambBtn(pill(['Retry','need.retry']),true); nRetry.addEventListener('click', function(){ nRetry.disabled=true; nRetry.textContent='Reading.'; readNeeds(true); });
      nFail.appendChild(nRetry);
    }
    var fw='Couldn\\'t read '+andList(bad)+'.'; var fwn=nFail.querySelector('.nfail__what'); if(fwn.textContent!==fw) fwn.textContent=fw;
    if(!needsReading){ if(nRetry.disabled) nRetry.disabled=false; if(nRetry.textContent!=='Retry') nRetry.textContent='Retry'; }
  }
  /* 22 OCT 2026 (canvas Needs you): THE LEAD IS ONE INSIGHT. What waits on his tap in money, summed off the cards that wait on a money tap of his (a payment
     they say they sent, to confirm; an order placed, to agree), then the books that need stock off STOCK's lights (red out; amber promised past the shelf by what is agreed over it, or low;
     04 Nov 2026, his four steps: an agreed order makes a book amber at most, and yellow, selling fast, needs nothing yet). With nothing in money it counts what waits on him; with a read failed it never says nothing needs him. Written only when it differs. */
  function rmShort(n){ var v=Math.round((+n||0)*100)/100; return 'RM '+v.toLocaleString('en-MY',{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2}); }
  var SAY_N=['no','one','two','three','four','five','six','seven','eight','nine'];
  function sayN(n){ return SAY_N[n]||String(n); }
  function stockNeeds(){
    var books=glanceStock&&glanceStock.books, out=0, past=[], low=0;
    if(books) Object.keys(books).forEach(function(p){ var b=books[p]; if(!b||typeof b.shelf!=='number') return;
      var over=(+b.commit||0)-(+b.shelf||0);
      if(b.light==='red') out++; else if(b.light==='amber'){ if(over>0.005) past.push(over); else low++; } });
    return {out:out, past:past, low:low};
  }
  function drawLead(items){
    var bad=needsBad(); drawFail(bad);
    var parts=[];
    if(!needsReady()) parts.push(['','Reading what needs you.']);
    else {
      var conf=0, agree=0, todo=0, pend=0;
      items.forEach(function(i){ if(!i.practice&&i.sev==='soon') pend++; if(i.practice||!i.counts||i.sev!=='now') return; todo++; if(i.tap==='confirm') conf+=i.rm; else if(i.tap==='agree') agree+=i.rm; });
      var says=[conf>0.004?rmShort(conf)+' to confirm':'', agree>0.004?rmShort(agree)+' to agree':''].filter(Boolean);
      if(says.length) parts.push([rmShort(conf+agree),' waits on your tap now: '+says.join(', ')+'.']);
      else if(todo) parts.push([String(todo),todo===1?' thing waits on your tap now.':' things wait on your tap now.']);
      else if(pend&&!bad.length) parts.push([String(pend),' pending. Nothing waits on your tap now.']);   /* 18 Nov 2026: with cards under Pending the lead never says nothing needs him */
      else parts.push(['',bad.length?'Nothing in what could be read.':'Nothing needs you.']);
      var s=stockNeeds(), n=s.out+s.past.length+s.low;
      /* 18 Nov 2026: one state alone is said once (it read "2 books need stock: two are low") */
      if(n&&!s.past.length&&!(s.out&&s.low)) parts.push([n+(n===1?' book':' books'),(n===1?' is ':' are ')+(s.out?'out of':'low on')+' stock.']);
      else if(n) parts.push([n+(n===1?' book':' books'),(n===1?' needs':' need')+' stock: '+[s.out?sayN(s.out)+(s.out===1?' is out':' are out'):'',
        s.past.length===1?'one is promised '+units(s.past[0])+' past its shelf':s.past.length?sayN(s.past.length)+' are promised past their shelf':'',
        s.low?sayN(s.low)+(s.low===1?' is low':' are low'):''].filter(Boolean).join(', ')+'.']);
    }
    var sig=JSON.stringify(parts);
    if(nCount.getAttribute('data-sig')===sig) return;
    nCount.setAttribute('data-sig',sig); nCount.textContent='';
    parts.forEach(function(p,k){ if(k) nCount.appendChild(document.createTextNode(' ')); if(p[0]) nCount.appendChild(el('b',null,p[0])); nCount.appendChild(document.createTextNode(p[1])); });
  }
  function drawNeeds(){
    if(!nlist) return;
    var items=needItems(), shown=items.filter(function(i){ return nKind==='all'||i.kind===nKind; });
    drawCounts(items); drawLead(items); drawGlanceAll();
    /* a kind whose cards have gone leaves him on All (drawKindCounts dims it) */
    if(needsReady()){
      var have={}; items.forEach(function(i){ have[i.kind]=1; });
      if(nKind!=='all'&&!have[nKind]){ nKind='all'; shown=items; kindMark(); }
    }
    drawKindCounts(items);
    needLast=items;
    nlist.textContent='';
    var practiceList=shown.filter(function(i){ return i.practice; }); shown=shown.filter(function(i){ return !i.practice; });
    if(!shown.length&&needsReady()) nlist.appendChild(el('p','rnone',nKind==='all'&&!needsBad().length?'Nothing needs you.':'Nothing here.'));
    SEVS.forEach(function(s){
      var group=shown.filter(function(i){ return i.sev===s[0]; });
      if(!group.length) return;
      /* 22 Oct 2026 (his comment, "doesn't have to be collapsible"): every group stands open under its one word, with no count */
      var box=el('section','ngroup'); box.setAttribute('data-sev', s[0]); box.setAttribute('aria-label', s[1]);
      var h=el('h2','amb-section nsev', s[1]); h.setAttribute('data-sev', s[0]);
      box.appendChild(h); nlist.appendChild(box);
      group.forEach(function(i){ box.appendChild(i.make()); });
    });
    /* 17 Oct 2026: practice accounts leave Now, Soon and Watch for one folded line at the foot, which opens them in place */
    if(practiceList.length){
      var pb=el('details','nfold'); pb.setAttribute('data-sev','practice'); if(nFoldOpen.practice) pb.open=true;
      pb.addEventListener('toggle', function(){ nFoldOpen.practice=pb.open; });
      var ph=el('summary','amb-section nsev','Practice: '+practiceList.length); ph.setAttribute('data-sev','practice'); ph.setAttribute('data-act','need.fold.practice');
      pb.appendChild(ph); practiceList.forEach(function(i){ pb.appendChild(i.make()); }); nlist.appendChild(pb);
    }
    drawNeedOpen(false);
  }
  function redrawLead(){ drawLead(needItems()); }
  /* 21 Oct 2026 (canvas V56): EACH KIND SAYS HOW MANY OF IT WAIT, practice apart, as the bars count; nothing is said until every read has landed.
     22 Oct 2026 (canvas Needs you): the count stands beside the word on its tab, and a kind with nothing at all is dimmed and cannot be chosen. */
  function drawKindCounts(items){
    var n={all:0}, have={all:1}, ready=needsReady();
    items.forEach(function(i){ have[i.kind]=1; if(i.practice||i.sev==='watch') return; n.all++; n[i.kind]=(n[i.kind]||0)+1; });
    [].forEach.call(document.querySelectorAll('.nchips button'), function(b){
      var k=b.getAttribute('data-chip'), c=b.querySelector('.nkopt__n');
      if(!c){ c=el('span','amb-segment__count nkopt__n'); b.appendChild(c); }
      var said=ready&&(n[k]||!have[k])?String(n[k]||0):'';   /* 18 Nov 2026: a kind holding FYI cards alone says no figure, never a 0 beside cards */
      if(c.textContent!==said) c.textContent=said;
      var none=ready&&!have[k];
      if((b.getAttribute('aria-disabled')==='true')!==none){ if(none){ b.setAttribute('aria-disabled','true'); b.setAttribute('aria-pressed','false'); } else b.removeAttribute('aria-disabled'); }
    });
  }
  /* the chosen kind's tab: selected, and the Nav bar's active link */
  function kindMark(){
    [].forEach.call(document.querySelectorAll('.nchips button'), function(x){
      var on=x.getAttribute('data-chip')===nKind; x.setAttribute('aria-pressed', on?'true':'false');
    });
  }
  /* 21 Oct 2026 (P7): THE GLANCE heads Needs you. 22 Oct 2026 (canvas Needs you): three single-line KPI tiles, each a link to Orders. Ready (brass): the
     orders ready with goods still to hand over, as Orders' Ready stage holds them. To approve (copper): the cards waiting under Approve. Receivables
     (verdigris, his word, was Owed to you): what the agreed orders still owe, their goods and delivery less what is paid, summed, with a meter of what
     they have paid of what they come to. Read off the orders the page holds and nothing else; a practice order counts only on the practice surface. */
  function drawGlance(){
    var g=document.getElementById('nGlance'); if(!g) return;
    stockRead();
    if(!makerData){ g.hidden=true; if(g.parentNode) g.parentNode.hidden=true; return; }
    var ready=0, owe=0, due=0;
    (makerData.orders||[]).forEach(function(o){
      if(o.test&&!TESTING) return;
      if(orderPartsOf(o)==='orders.ready') ready++;
      if(['acknowledged','ready','done'].indexOf(o.status)<0||o.writtenOff) return;
      var comes=(+o.total||0)+(+o.delivery||0), left=ordDue(o);
      due+=comes; if(left>0.004) owe+=left;
    });
    var paid=Math.max(0,due-owe), fill=due>0.004?Math.round(paid/due*100):0;
    var tiles=[['#orders/ready','ready','Ready',String(ready),'brass'],['#orders/approve','approve','To approve',String(draftGroups(pendingRows()).length),'copper'],
      ['#orders','owed','Receivables',rmShort(owe),'verdigris',fill,rmShort(paid),rmShort(due)]];
    var sig=JSON.stringify(tiles);
    g.hidden=false; if(g.parentNode) g.parentNode.hidden=false;
    if(g.getAttribute('data-sig')===sig) return;
    g.setAttribute('data-sig',sig); g.textContent='';
    tiles.forEach(function(t){
      var a=el('a','amb-tile nkpi'); a.href=t[0]; a.setAttribute('data-glance',t[1]); a.setAttribute('data-act','need.glance.'+t[1]);
      a.appendChild(el('span','amb-tile__label',t[2]));
      a.appendChild(el('span','amb-tile__figure',t[3]));
      if(t[5]!=null){
        a.classList.add('nkpi--owed'); a.setAttribute('aria-label',t[2]+', '+t[3]+': '+t[6]+' paid of '+t[7]+' agreed');
        var m=el('progress','amb-meter'); m.max=100; m.value=t[5]; m.setAttribute('aria-hidden','true'); a.appendChild(m);
        a.appendChild(el('span','amb-tile__delta amb-muted',t[6]+' paid of '+t[7]+' agreed'));
      }
      g.appendChild(a);
    });
  }
  function drawGlanceAll(){ drawGlance(); drawStockBooks(); moodSet(); }
  /* 15 NOV 2026, THE MOVE TO AMBIENT (his answers of 14 Nov 2026): THE MOOD IS THE MARKET'S HEAT, for him. Salt's heat in the stock he polls
     (STOCK.books.salt.heat, the engine's marketHeat off its supply step): tight is Flare, and Needs you, Orders and Customers say Supply tight in
     their hero's chip; anything else is Lagoon with no chip. Shop is at rest, Slate. Heat is never good or bad, and prices nothing. */
  function moodSet(){
    var r=document.getElementById('roster'); if(!r) return;
    var b=glanceStock&&glanceStock.books, tight=!!(b&&b.salt&&b.salt.heat==='tight'), m=placeNow==='shop'?'slate':tight?'flare':'lagoon';
    if(window.Ambient&&window.Ambient.mood) window.Ambient.mood(m, r); else r.setAttribute('data-mood', m);
    [].forEach.call(r.querySelectorAll('[data-heat]'), function(c){ if(c.hidden===(m==='flare')) c.hidden=m!=='flare'; });
  }
  /* 21 Oct 2026 (canvas V62, his word "stock count, stock expected dates should be here"): THE STOCK, the Desk's figures (the master measures them at each
     version, GET /all/maker/stock), the day the next lot is expected his own from Stock. Read once a page open; a failed read is asked again five minutes on.
     22 Oct 2026 (canvas Needs you): Stock cover and Next lot left the glance; Stock by book carries both for every book, and the Insight says which need stock. */
  var glanceStock=null, glanceStockOut=false, glanceStockFailed=0;
  function glanceDay(iso){ return new Date(iso+'T04:00:00Z').toLocaleDateString('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short'}); }
  function stockRead(){
    if(glanceStock||glanceStockOut||Date.now()-glanceStockFailed<=300000) return;
    glanceStockOut=true;
    refs('/all/maker/stock').then(function(j){ glanceStock=j; glanceStockFailed=0; },function(){ glanceStockFailed=Date.now(); })
      .then(function(){ glanceStockOut=false; drawGlanceAll(); redrawLead(); });
  }
  /* 22 OCT 2026 (his word, the restock light made plain): STOCK BY BOOK under the glance, every book, the worst light first and then the least
     cover: its mark, the light in the Counter's own words and colour, then the Desk's figures, the shelf, what is agreed, what is free, the days of
     cover, and the next lot's units and day. The light is the Desk's (restockLight, measured into STOCK with the figures); nothing here works one
     out. Read with the tiles and again on each tick of the Needs you poll, so a re-seed shows within the poll; a failed read leaves the tiles to say so. */
  /* 04 Nov 2026 (his four steps): the Counter's words and the design system's four light colours as chips, worst first */
  var STOCK_WORD={green:'Available',yellow:'Selling fast',amber:'Low on stock',red:'Out of stock'}, STOCK_RANK={red:0,amber:1,yellow:2,green:3},
    STOCK_TONE={green:'pos',yellow:'',amber:'warn',red:'neg'};   /* 16 Nov 2026: Ambient's tones; Selling fast plain, with its word */
  /* a figure of the table: up to two places, a minus sign under nought, no unit (the head says Units) */
  function stockFig(n){ var v=Math.round((+n||0)*100)/100; return (v<0?'\u2212':'')+Math.abs(v).toLocaleString('en-MY',{maximumFractionDigits:2}); }
  function drawStockBooks(){
    var s=document.getElementById('nStock'); if(!s) return;
    var books=glanceStock&&glanceStock.books, ids=books?Object.keys(books).filter(function(p){ return books[p]&&typeof books[p].shelf==='number'; }):[];
    if(!ids.length){ if(!s.hidden){ s.hidden=true; s.textContent=''; s.removeAttribute('data-sig'); } return; }   /* a tick that finds nothing again draws nothing */
    var rank=function(b){ return [b.light in STOCK_RANK?STOCK_RANK[b.light]:3, b.coverDays==null?Infinity:+b.coverDays]; };
    ids.sort(function(x,y){ var a=rank(books[x]), c=rank(books[y]); return a[0]-c[0]||a[1]-c[1]; });
    /* 22 Oct 2026 (canvas Needs you): each book's figures: the shelf, what is agreed and what is free, the meter of what is agreed of the shelf (full,
       and ember, once promised past it or with nothing on it), the days of cover (4 wk+ past four weeks), and the next lot's units and day */
    var rows=ids.map(function(p){
      var b=books[p], shelf=+b.shelf||0, commit=+b.commit||0, free=+b.free||0, transit=+b.transit||0, by=glanceStock.by&&glanceStock.by[p], light=b.light in STOCK_RANK?b.light:'';
      return {p:p, light:light, shelf:stockFig(shelf), agreed:stockFig(commit), free:stockFig(free), neg:free<-0.009,
        fill:shelf>0.009?Math.min(100,Math.round(commit/shelf*100)):commit>0.009?100:0, ember:light==='red'||commit>shelf+0.009,
        cover:free<=0.009?'0 d':b.coverDays==null?'4 wk+':b.coverDays+' d',
        lot:transit>0.009?units(transit)+(by?' · '+glanceDay(by):''):by?'None yet · '+glanceDay(by):'None'};
    });
    var sig=JSON.stringify([glanceStock.today,rows]);
    if(s.hidden) s.hidden=false;
    if(s.getAttribute('data-sig')===sig) return;
    s.setAttribute('data-sig',sig); s.textContent='';
    /* 16 Nov 2026 (the move to Ambient): ONE TABLE, which stands as labelled lines on a phone (Ambient's stack table) and in columns from 720px: the book's
       chip (its hue on the dot, its name in ink), the light as a chip with its dot and word, then the figures, the meter of what is agreed of the shelf, the
       cover and the next lot. */
    var h=el('h2','amb-section','Stock by book'); h.setAttribute('data-head','');
    if(glanceStock.today) h.title='As measured on '+glanceDay(glanceStock.today);
    h.appendChild(el('span','amb-section__note','Units'+(glanceStock.today?' \u00b7 measured '+glanceDay(glanceStock.today):'')));
    s.appendChild(h);
    var chipOf=function(r){ return r.light?amb.node('<span class="amb-chip'+(STOCK_TONE[r.light]?' amb-chip--'+STOCK_TONE[r.light]:'')+'"><span class="amb-chip__dot"></span>'+esch(STOCK_WORD[r.light])+'</span>'):null; };
    var tb=el('table','amb-table amb-table--stack'), th=el('thead'), hr=el('tr'), bd=el('tbody');
    tb.appendChild(el('caption','sr','Stock by book, worst first'));
    var cols=[['Book'],['Light'],['Shelf',1],['Agreed',1],['Free',1],['Of shelf'],['Cover',1],['Next lot']];
    cols.forEach(function(x){ var c=el('th',x[1]?'is-num':null,x[0]); c.setAttribute('scope','col'); hr.appendChild(c); });
    th.appendChild(hr); tb.appendChild(th);
    rows.forEach(function(r){
      var tr=el('tr'), cell=function(label,cls,text){ var td=el('td',cls,text); td.setAttribute('data-label',label); tr.appendChild(td); return td; };
      tr.setAttribute('data-book',r.p);
      cell('Book').appendChild(nBook(r.p));
      var lc=cell('Light'), c=chipOf(r); if(c) lc.appendChild(c);
      cell('Shelf','is-num',r.shelf); cell('Agreed','is-num'+(r.ember?' amb-neg':''),r.agreed); cell('Free','is-num'+(r.neg?' amb-neg nfree--neg':''),r.free);
      var mc=cell('Of shelf'), m=el('progress','amb-meter'); m.max=100; m.value=r.fill; m.setAttribute('aria-label','Agreed '+r.agreed+' of '+r.shelf); mc.appendChild(m);
      cell('Cover','is-num',r.cover); cell('Next lot',null,r.lot);
      bd.appendChild(tr);
    });
    tb.appendChild(bd); s.appendChild(tb);
  }
  /* a kind chosen from its tab (22 Oct 2026: Jump to is gone, every kind is in view) */
  function nPick(k){ nKind=k; kindMark(); drawNeeds(); }
  /* ---- READING WHAT NEEDS YOU, on entering it and every 5 seconds while it is showing. Everything it shows is read from the sources the
     other places read, each guarding its own read: none starts while another of its kind is out, and a poll that finds the same answer
     draws nothing. The sheet and the links are read again only after the page has read them once (it does at opening). ---- */
  function readNeeds(force, tick){
    if(needsReading) return;
    if(!force&&needsAt&&Date.now()-needsAt<NEED_MS) return;
    needsReading=true;
    var sig0=tick?needSig():null;
    var jobs=TESTING?[loadMaker(true), loadMakerClaims(true), loadMakerThreads(true)]:[loadMaker(true), loadMakerClaims(true), loadMakerThreads(true), readShop(), loadOwed()];
    /* the sheet and the links are read again once read, or once their read has failed, so a Retry reaches every read that did */
    if((sheet||nSrc.sheet)&&!sheetBusy) jobs.push(loadSheet(true));
    /* 13 Nov 2026 (the price band's version 3): the regulars who need a word and the week's new buyers, read with the Desk's catalogue once and on a Retry, never on the poll's tick; a failed read keeps what was read and says nothing (it is not what he waits on) */
    if(!TESTING&&(!tick||!buyersRead)) jobs.push(readBuyers());
    if((linksRead||nSrc.links)&&!linksBusy) jobs.push(loadLinks(true));
    /* 22 Oct 2026: the poll's tick reads the stock again (Stock by book), a failure keeping what was read */
    if(tick&&glanceStock&&!glanceStockOut) jobs.push(refs('/all/maker/stock').then(function(j){ glanceStock=j; drawGlanceAll(); redrawLead(); },function(){}));
    Promise.all(jobs).then(function(){ needsAt=Date.now(); }, function(){}).then(function(){ needsReading=false; if(!tick||needSig()!==sig0) redrawLead(); });
  }
  /* what Watch shows: the hours with an override in force, and the notice */
  async function readShop(){
    if(shopReading) return;
    shopReading=true;
    var apply=false;
    try{ var h=await refs('/all/maker/hours'); nGot('hours'); if(changed('hours', h)){ makerHours=h; apply=true; } }
    catch(error){ nGot('hours', error); if(failNew('hours', error)) apply=true; }
    try{ var b=await refs('/all/maker/bulletin'); nGot('notice'); if(changed('notice', b.lines||[])){ makerNotice=b.lines||[]; apply=true; } }
    catch(error){ nGot('notice', error); if(failNew('notice', error)) apply=true; }
    shopReading=false;
    barDraw();
    if(apply) drawNeeds();
  }
  /* THE POLL runs only while Needs you or Orders is showing and the page is visible, and stops the moment either stops. */
  function needsWatch(){
    var on=!document.hidden&&!document.body.classList.contains('ended')&&(placeNow==='needs'||placeNow==='orders');
    if(on&&needsTimer===null) needsTimer=setInterval(tickPlace, NEED_MS);
    else if(!on&&needsTimer!==null){ clearInterval(needsTimer); needsTimer=null; }
    if(on&&liveDirty){ liveDirty=false; tickPlace(); }   /* an event that came while another place showed is read now */
  }
  function tickPlace(){
    if(document.hidden||(placeNow!=='needs'&&placeNow!=='orders')){ needsWatch(); return; }
    /* viewing an account as them hides this page (stmt/page.js): nothing is read for a page nobody is looking at, and the read goes on when he is back */
    if(roster.hidden) return;
    if(placeNow==='needs') readNeeds(true, true);
    else { loadMaker(true); loadMakerClaims(true); }
  }
  document.addEventListener('visibilitychange', function(){ needsWatch(); if(!document.hidden&&needsTimer!==null) tickPlace(); });
  /* ---- SPEED WAVE 2 L2 (21 Oct 2026): THE LIVE SOCKET, on /all/live past Access (the page's liveSocket, stmt/page.js). Each event is a kind, the
     account and an id, nothing more: Needs you and Orders are read at once when one shows (else the next time it is shown), and Chat re-reads
     when it is open. While the socket is up the two polls fall to a minute and stay as the net; on its loss they return to 5 and 2 seconds. ---- */
  var liveDirty=false, liveOwner=null, liveOwnerHad=false, NEED_BASE=NEED_MS;
  function needsRetime(){ if(needsTimer!==null){ clearInterval(needsTimer); needsTimer=null; } needsWatch(); }
  function ownerLiveEvent(m){
    if(m.k==='thread'&&inChat()&&!document.hidden) loadMakerThreads(true);
    if((placeNow==='needs'||placeNow==='orders')&&!document.hidden) tickPlace(); else liveDirty=true;
  }
  if(LIVE_ON){
    liveOwner=liveSocket({ path:'/all/live',
      up:function(){ NEED_MS=LIVE_NET_MS; chatMs=LIVE_NET_MS; needsRetime(); if(makerThreadTimer!==null) startMakerChat(); if(liveOwnerHad) ownerLiveEvent({k:'order'}); liveOwnerHad=true; },
      down:function(){ NEED_MS=NEED_BASE; chatMs=2000; needsRetime(); if(makerThreadTimer!==null) startMakerChat(); },
      event:ownerLiveEvent });
  }
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
  /* 16 Nov 2026, THE MOVE TO AMBIENT (place H, Associates): A BOOK IS ITS CHIP AND HOW MANY; its associates are one Table, which stacks into labelled lines where there is no room: what they bought, sold for him and
     brought in, right-aligned, the counts beside, and the reward on salt alone as the system's meter, in units; the code opens their account */
  function assocMeter(w){
    var cell=el('div','ameter'), m=el('progress','amb-meter'), words=w.earned+' earned, '+w.taken+' taken, '+(Math.round(w.left*100)/100)+' left'+(w.held?', held while away':'')+', '+Math.round(w.next*100)+'% to next';
    m.max=100; m.value=Math.max(0, Math.min(100, Math.round(w.next*100)));
    m.setAttribute('aria-label','Reward, '+(Math.round(w.left*100)/100)+' units left, '+Math.round(w.next*100)+'% of the way to the next');
    cell.appendChild(m); cell.appendChild(el('span','amb-field__hint',words));
    return cell;
  }
  function assocCode(code, act){
    var acc=OWNER.accounts.filter(function(x){ return x.code===code&&x.username; })[0];
    if(!acc) return el('b','acode',code);
    var b=actOn(el('button','amb-pill amb-pill--quiet amb-pill--sm acode apick',code),act||'assoc.open',code); b.type='button';
    b.addEventListener('click', function(){ showPlace('customers','accounts',{fresh:true, push:true}); openCard(acc.username); });
    return b;
  }
  function assocTable(p){
    var table=el('table','amb-table amb-table--stack atable'), hr=el('tr'), body=el('tbody'), tiered=p.rows.some(function(r){ return !!r.reward; });
    var heads=['Associate','Standing','Bought','Sold','Introduced','Resales','Referred','Share',tiered?'Reward, units':'Reward'], num={2:1,3:1,4:1,5:1,6:1,7:1};
    table.appendChild(el('caption','amb-vh','Each associate, this book'));
    heads.forEach(function(h, i){ var th=el('th',num[i]?'is-num':null,h); th.setAttribute('scope','col'); hr.appendChild(th); });
    table.appendChild(el('thead')).appendChild(hr); table.appendChild(body);
    p.rows.forEach(function(r){
      var tr=el('tr',r.departed?'off':null), marks=[]; if(r.founder) marks.push('founder'); if(r.rank) marks.push('#'+r.rank); if(r.departed) marks.push('away'); if(r.stars) marks.push(new Array(r.stars+1).join('★'));
      var cells=[assocCode(r.id,'assoc.open-row'), marks.join(' · '), rm(r.bought), rm(r.soldFor), rm(r.introduced), r.onward?String(r.onward):'', r.referred?String(r.referred):'', r.share?r.share+'%':'', null];
      cells.forEach(function(v, i){
        var td=el('td',num[i]?'is-num':null); td.setAttribute('data-label',heads[i]);
        if(i===8){ if(r.reward&&r.reward.next!=null) td.appendChild(assocMeter(r.reward)); else if(r.reward) td.textContent=r.reward.earned+' earned, '+r.reward.taken+' taken, '+(Math.round(r.reward.left*100)/100)+' left'; else td.textContent=tiered?'':'None on this book'; }
        else if(typeof v==='string') td.textContent=v; else td.appendChild(v);
        if(i===0) td.classList.add('astand2');
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    return table;
  }
  function drawCards(){
    var wrap=document.getElementById('clist'); if(!wrap) return;
    wrap.textContent='';
    var head=document.getElementById('ccount');
    if(!cards||!cards.products||!cards.products.length){
      if(head) head.textContent='';
      wrap.appendChild(el('p','amb-empty','No report yet. It comes with the next update.'));
      return;
    }
    if(head) head.textContent='As at '+(cards.at?stampDay(cards.at):'the last publish')+'.';
    cards.products.forEach(function(p){
      var hd=el('h2','amb-section aprodhead'), tag=el('span','aprodtag'); tag.appendChild(bookChip(p.product)); hd.appendChild(tag);
      hd.appendChild(el('span','amb-section__note',p.rows.length+(p.rows.length===1?' associate':' associates'))); wrap.appendChild(hd);
      if(!p.rows.length){ wrap.appendChild(el('p','amb-empty','Nobody on this book yet.')); return; }
      wrap.appendChild(assocTable(p));
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
  /* THE TEST ACCOUNTS (his answer of 29 Sep 2026: a second account, not a switch; a third, fresh, on 18 Oct 2026), made and taken away
     together: one open with every case a customer sees, one locked, only for paying, and one fresh with room to order. The same zeros open
     all three; the names are stmt/testusers.js's list. */
  var TEST_ALL=${JSON.stringify(TEST_USERS)};
  var TEST_LINE='Password 0000-0000-0000-0000 for all three. Username 0000-0000 shows every case; 0000-0001 is locked, for paying only; 0000-0002 is fresh, with room to order.';
  /* ---- 11 NOV 2026, THE PRICE BAND'S VERSION 2: SHOP > MARKET. The market move's switch, the day's words, the Median points he has set and a form to re-anchor one. Everything is an
     edit he approves next, under Approve; nothing here prices. Off and On ask once on the Sheet. A point outside the band is refused with what it means, and one Reason line lets it stand. ---- */
  var mkt=null, mktSaid='', mktReady=null, mktForm={q:'',price:''}, mktOut=null, mktWhy='';
  function loadMarket(){
    return refs('/all/maker/inputs').then(function(j){ mkt=(j&&j.catalog)||{}; mktSaid=''; },function(e){ mktSaid=e.message; }).then(function(){ drawMarket(); marketAct(); });
  }
  function marketFor(kind,q,price){
    mktReady={kind:kind};
    if(kind==='anchor'){ mktForm={q:String(q),price:String(price)}; mktOut=null; mktWhy=''; }
    showPlace('shop','market',{fresh:true,push:true});
  }
  function marketAct(){
    var r=mktReady; if(!r||!mkt||!mkt.market) return; mktReady=null;
    if(r.kind==='anchor') return;
    var sw=document.querySelector('#makerMarket [data-act="market.switch"]');
    if(sw&&(r.kind==='off')===mkt.market.on&&!sw.disabled) sw.click();
  }
  async function marketSend(body,answer){
    try{ await refs('/all/maker/inputs/edit',body); mktOut=null; mktWhy=''; mktSaid=body.kind==='anchor'?'Sent. The point stands once you approve it, under Approve.':'Sent. It takes effect once you approve it, under Approve.'; await loadMarket(); }
    catch(error){
      if(error.detail&&error.detail.outside){ mktOut={say:noBook(error.raw||error.message)}; drawMarket(); return; }
      mktSaid=''; refusal(answer,error);
    }
  }
  function drawMarket(){
    var box=document.getElementById('makerMarket'); if(!box) return;
    box.textContent='';
    if(!mkt){ box.appendChild(sFoot(mktSaid||'Reading.')); return; }
    var m=mkt.market, waits=mkt.marketWaiting||[];
    if(!m){ box.appendChild(sFoot('Salt has no market move to set.')); return; }
    var swWait=waits.some(function(k){ return k.kind!=='anchor'; }), ptWait=waits.filter(function(k){ return k.kind==='anchor'; });
    var g=sGroup(null), list=g.list, srow=sSwitchRow('Market move','market.switch',null,!!m.on), sw=srow.sw; sw.disabled=swWait;
    list.appendChild(sLi(srow));
    var today=el('div','amb-setting'); today.appendChild(el('span','amb-setting__name',swWait?'Waiting under Approve.':m.why||(m.on?'On.':'Off: salt is at the plain Median Price.')));
    today.setAttribute('data-market-today',''); list.appendChild(sLi(today));
    /* 13 Nov 2026 (version 3): on the days the price test runs it is said under the move, so the move is never unseen */
    var pt=mkt.test;
    if(pt&&+pt.q>0&&isFinite(+pt.rm)){
      var tr0=el('div','amb-setting'); tr0.setAttribute('data-market-test','');
      tr0.appendChild(el('span','amb-setting__name','Price test: '+rmShort(Math.abs(+pt.rm))+(+pt.rm>=0?' up':' down')+' at '+units(pt.q)+', week '+(+pt.week)+' of '+(+pt.weeks)));
      list.appendChild(sLi(tr0));
    }
    g.appendChild(sFoot('Salt moves within 15 points under and 20 over the Median Price, 5 a day, by what stock says.'));
    box.appendChild(g);
    sw.addEventListener('click',function(){
      var on=!!m.on; sw.checked=on;
      ownerAsk(sw,'market:switch',{title:on?'Switch the market move off?':'Switch the market move on?', plain:true,
        say:[on?'Salt goes back to the plain Median Price at the next publish.':'It climbs from nought, 5 points a day at most.','You approve it next, under Approve.'], go:on?'Switch off':'Switch on', keep:'Not now'}).then(function(yes){
        if(!yes) return;
        marketSend({at:new Date().toISOString(), kind:on?'marketOff':'marketOn', product:'salt'}, today.firstChild);
      });
    });
    /* the re-anchor form */
    box.appendChild(el('h3','amb-section','Re-anchor the Median'));
    var sizes=(mkt.marketSizes||[]).slice();
    if(mktForm.q&&sizes.indexOf(+mktForm.q)<0) sizes.push(+mktForm.q);
    var sel=actOn(el('select'),'market.size'), price=actOn(el('input','amb-input'),'market.price');
    sizes.forEach(function(q){ var o=el('option',null,units(q)); o.value=String(q); sel.appendChild(o); });
    sel.value=mktForm.q&&sizes.indexOf(+mktForm.q)>=0?String(+mktForm.q):(sizes.length?String(sizes[0]):'');
    price.type='number'; price.step='5'; price.min='5'; price.inputMode='numeric'; price.value=mktForm.price||'';
    var form=el('div','amform');
    form.appendChild(sField('Size',sSelect(sel))); form.appendChild(sField('Price (RM)',price));
    var answer=el('p','msg anote aanswer'); answer.setAttribute('role','status');
    var send=actOn(el('button','amb-pill','Send'),'market.send'); send.type='button'; send.disabled=ptWait.length>0;
    var keep=function(){ mktForm={q:sel.value,price:price.value}; if(mktOut){ mktOut=null; mktWhy=''; drawMarket(); } };
    sel.addEventListener('change',keep); price.addEventListener('input',keep);
    send.addEventListener('click',function(){
      var p=Number(price.value);
      if(!(p>0)||Math.abs(p/5-Math.round(p/5))>1e-9||!sel.value){ answer.textContent='Choose a size and a price in steps of RM 5.'; return; }
      mktForm={q:sel.value,price:price.value};
      marketSend({at:new Date().toISOString(), kind:'anchor', product:'salt', q:+sel.value, price:p}, answer);
    });
    box.appendChild(form);
    if(mktOut){
      var out=el('div','amout'), why=actOn(el('input','amb-input'),'market.why'); why.type='text'; why.maxLength=120; why.value=mktWhy; why.setAttribute('data-one-off','');
      out.appendChild(amb.node(amb.notice(mktOut.say,true)));
      out.appendChild(sField(ONE_OFF_WORDS.reason,why));
      var go=actOn(el('button','amb-pill',ONE_OFF_WORDS.go),'market.stand'); go.type='button'; go.disabled=!oneOffOk(why.value);
      why.addEventListener('input',function(){ mktWhy=why.value; go.disabled=!oneOffOk(why.value); });
      go.addEventListener('click',function(){ if(!oneOffOk(why.value)) return; marketSend({at:new Date().toISOString(), kind:'anchor', product:'salt', q:+sel.value, price:Number(price.value), why:why.value.trim()}, answer); });
      out.appendChild(el('div','apoints-act')).appendChild(go); box.appendChild(out);
    } else box.appendChild(el('div','apoints-act')).appendChild(send);
    box.appendChild(answer);
    if(mktSaid) answer.textContent=mktSaid;
    if(ptWait.length) box.appendChild(sFoot('A point waits under Approve; send another once it is decided.'));
    var pts=mkt.marketPoints||[];
    if(pts.length){
      var pg=sGroup('Points you have set');
      pts.forEach(function(p){
        var r=sRead(units(p.q)+', '+rm(p.price)+', from '+p.from+(p.outside?'. Outside the band: '+p.outside.why:'')); r.setAttribute('data-market-point',String(p.q));
        pg.list.appendChild(sLi(r));
      });
      box.appendChild(pg);
    }
  }
  /* ---- 13 NOV 2026, THE PRICE BAND'S VERSION 3: SHOP > CALENDAR. His marks, a name and the days it runs (Hari Raya, a school holiday), which the Desk measures against the 28 days before each. Add and Remove stand at once,
     with no Approve: a mark prices nothing. A name is 2 to 30 characters, the days real and within a year of today, the last on or after the first. ---- */
  var cal=null, calSaid='', calForm={name:'',from:'',to:''};
  function loadCalendar(){
    return refs('/all/maker/calendar').then(function(j){ cal=(j&&j.calendar&&j.calendar.list)||[]; calSaid=''; },function(e){ calSaid=e.message; }).then(drawCalendar);
  }
  function calDay(d,n){ var t=new Date(d+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); }
  function calFault(f){
    var name=String(f.name||'').trim(), today=tripToday();
    if(name.length<2||name.length>30||/[<>]/.test(name)) return 'A name is 2 to 30 characters.';
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(f.from||'')||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(f.to||'')) return 'Choose both days.';
    if(f.to<f.from) return 'The last day is on or after the first.';
    if(f.to>calDay(today,365)||f.from<calDay(today,-365)) return 'Choose days within a year of today.';
    return '';
  }
  async function calendarSend(body,answer){
    try{ var j=await refs('/all/maker/calendar',body); cal=(j&&j.calendar&&j.calendar.list)||[]; calSaid=body.add?'Added.':'Removed.'; if(body.add) calForm={name:'',from:'',to:''}; drawCalendar(); }
    catch(error){ calSaid=''; refusal(answer,error); }
  }
  function drawCalendar(){
    var box=document.getElementById('makerCalendar'); if(!box) return;
    box.textContent='';
    if(!cal){ box.appendChild(sFoot(calSaid||'Reading.')); return; }
    var answer=el('p','msg anote aanswer'); answer.setAttribute('role','status');
    if(!cal.length){ box.appendChild(el('h3','amb-section','Marks')); box.appendChild(sFoot('No marks yet.')); }
    else {
      var g=sGroup('Marks'), list=g.list;
      cal.slice().sort(function(a,b){ return a.from<b.from?-1:a.from>b.from?1:0; }).forEach(function(m){
        var r=el('div','amb-setting');
        r.setAttribute('data-cal-mark',m.id); r.appendChild(el('span','amb-setting__name',m.name)); r.appendChild(el('span','amb-setting__value',dayMon(m.from+'T04:00:00Z')+(m.to!==m.from?' to '+dayMon(m.to+'T04:00:00Z'):'')));
        var rm0=actOn(amb.node(amb.circle('Remove '+m.name,'close')),'calendar.remove',m.id); rm0.classList.add('amb-circle--plain');
        rm0.addEventListener('click',function(){ rm0.disabled=true; calendarSend({remove:m.id},answer); });
        r.appendChild(rm0); list.appendChild(sLi(r));
      });
      box.appendChild(g);
    }
    box.appendChild(el('h3','amb-section','Add a mark'));
    var form=el('div','amform');
    var name=actOn(el('input','amb-input'),'calendar.name'), from=actOn(el('input','amb-input'),'calendar.from'), to=actOn(el('input','amb-input'),'calendar.to');
    name.type='text'; name.maxLength=30; name.value=calForm.name; from.type='date'; from.value=calForm.from; to.type='date'; to.value=calForm.to;
    [['Name',name],['From',from],['To',to]].forEach(function(p){ form.appendChild(sField(p[0],p[1])); });
    var keep=function(){ calForm={name:name.value,from:from.value,to:to.value}; };
    [name,from,to].forEach(function(n){ n.addEventListener('input',keep); n.addEventListener('change',keep); });
    var add=actOn(el('button','amb-pill','Add'),'calendar.add'); add.type='button';
    add.addEventListener('click',function(){
      keep(); var f=calFault(calForm);
      if(f){ answer.textContent=f; return; }
      calendarSend({add:{name:calForm.name.trim(),from:calForm.from,to:calForm.to}},answer);
    });
    box.appendChild(form); box.appendChild(el('div','apoints-act')).appendChild(add); box.appendChild(answer);
    if(calSaid) answer.textContent=calSaid;
    box.appendChild(sFoot('A mark stands at once. The Desk measures how much each ran above the 28 days before it.'));
  }
  var TEST_SHOWS=['Every case','Locked, to pay','Fresh, to order'];
  function drawTest(){
    var box=document.getElementById('mTest'); if(!box) return;
    /* a pair made by halves (a tap cut off between its two sends) keeps Make, for the one missing (Fable's review) */
    var have=sheetRows.filter(function(a){ return a.test; }).map(function(a){ return a.username; });
    var need=TEST_ALL.filter(function(u){ return have.indexOf(u)<0; }), on=!need.length;
    box.textContent='';
    /* 26 Oct 2026, his word (Practice "based on the same design language" as This device, iPad and Mac included): one Switch, Practice accounts,
       on while all three exist; turned on it makes the missing, turned off it asks once and removes all three. While any exists, a plain list:
       each username and what it shows, the password (a tap copies it) and Open the test page while all three are open. No chips, no counts.
       16 Nov 2026 (Ambient): the groups are amb-settings, the switch input.amb-switch. */
    var g=sGroup(null), srow=sSwitchRow('Practice accounts','more.test-accounts',null,on), b=srow.sw;
    g.list.appendChild(sLi(srow)); box.appendChild(g);
    b.setAttribute('data-test-state',String(have.length)); if(on) ynTag(b,'test:remove');
    g.appendChild(sFoot(on?'Nothing they do is recorded.'
      : have.length?have.length+' of '+TEST_ALL.length+' made; turn on to make '+need.join(' and ')+'.':'Three accounts to try the customer’s page; nothing they do is recorded.'));
    if(have.length){
      var ag=sGroup('Accounts','atest-list'), accts=ag.list;
      TEST_ALL.forEach(function(u,i){
        if(have.indexOf(u)<0) return;
        var r=el('div','amb-setting'), n=el('span','amb-setting__name atest-u',u); n.setAttribute('data-test',u); r.appendChild(n);
        r.appendChild(el('span','amb-setting__value atest-shows',TEST_SHOWS[i]||'')); accts.appendChild(sLi(r));
      });
      var pw=actOn(el('button','amb-setting atest-pw'),'more.test-password'); pw.type='button';
      pw.appendChild(el('span','amb-setting__name','Password')); pw.appendChild(el('span','amb-setting__value atest-pwv','0000-0000-0000-0000'));
      pw.appendChild(amb.node(amb.glyph('copy','sm'))); pw.setAttribute('aria-label','Copy the password');
      pw.addEventListener('click',function(){ try{ navigator.clipboard.writeText('0000-0000-0000-0000').then(function(){ say('Password copied.'); },function(){ say('Copy it by hand: 0000-0000-0000-0000.'); }); }catch(e){ say('Copy it by hand: 0000-0000-0000-0000.'); } });
      accts.appendChild(sLi(pw));
      if(on){
        var go=actOn(el('a','amb-setting'),'more.test-page'); go.href='/all/test';
        go.appendChild(el('span','amb-setting__name','Open the test page')); go.appendChild(amb.node(amb.glyph('next','sm'))); accts.appendChild(sLi(go));
      }
      box.appendChild(ag);
    }
    b.addEventListener('click', async function(){
      if(b.disabled) return;
      b.checked=on;
      if(on&&!(await ownerAsk(b,'test:remove',{title:'Remove all three?', say:['Everything they wrote goes with them.'], go:'Remove', keep:'Keep them'}))) return;
      b.disabled=true; say(on?'Removing...':'Making...','wait');
      try{
        if(on) await refs('/all/test',{make:false});
        else for(var i=0;i<need.length;i++) await refs('/all/test',await testKeys(need[i]));
        sheet=null; await loadSheet();
        say(on?'Gone, with everything they wrote.':'Made. '+TEST_LINE+' Their examples appear after the next update.');
      }catch(e){ sayFail(e); }
      b.disabled=false; drawTest();
    });
  }
  /* a place, an item on More, or a way back: one listener for the whole of his page */
  roster.addEventListener('click', function(ev){
    var bk=ev.target.closest('button[data-back]');
    if(bk){ var way=bk.getAttribute('data-back'); if(way==='accounts') openCard(null); else if(way==='orders') closeOrder(); else if(way==='claims'){ if(makerClaimOpen) makerClaimToggle(makerClaimOpen); } else if(way==='form') closeForm(); return; }
    var b=ev.target.closest('button[data-m]'); if(b){ var mm=b.getAttribute('data-m'); if(mm==='orders'&&placeNow==='orders'&&ordOpened){ closeOrder(); return; } showPlace(mm, b.getAttribute('data-p')||(mm===placeNow?partNow:''), {fresh:true,push:true}); return; }
    var k=ev.target.closest('button[data-chip]');
    if(k){ if(k.getAttribute('aria-disabled')!=='true') nPick(k.getAttribute('data-chip')); return; }
    var t=ev.target.closest('button[data-part]'), tp=t&&(t.closest('[data-place]')||t.parentNode);
    /* 2 Nov 2026: the Accounts tab, tapped while an account is open, returns to the list, as the way back does */
    if(t&&aOpen&&tp.getAttribute('data-place')==='customers'&&t.getAttribute('data-part')==='accounts') openCard(null);
    if(t) showPlace(tp.getAttribute('data-place'), t.getAttribute('data-part'), {push:true});
  });
  /* the + orb opens Record's menu of entries */
  var oAdd=document.getElementById('oAdd');
  if(oAdd) oAdd.addEventListener('click', function(){ showPlace('record','entry',{fresh:true,push:true}); });
  /* Approve, Orders' one main action (the bar's Approve until 15 Nov 2026) */
  [].forEach.call(document.querySelectorAll('[data-approve]'), function(ap){ ap.addEventListener('click', function(){ showPlace('orders','approve',{fresh:true,push:true}); }); });
  /* Ledger check, in every place's bar (18 Nov 2026): the part its row in Orders' More list opened */
  [].forEach.call(document.querySelectorAll('[data-ledger]'), function(lb){ lb.addEventListener('click', function(){ showPlace('orders','ledger',{push:true}); }); });
  document.getElementById('afil').addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-f]'); if(b&&b.getAttribute('aria-disabled')!=='true') filterBy(b.getAttribute('data-f'));
  });
  rq.addEventListener('input', drawRoster);
  showPlace('needs','',{fresh:true});
  /* the home itself needs the account list and the links: Needs you is read off both (S9 9.1) */
  if(!TESTING){ loadSheet(); loadLinks(); }
  /* an address he opened the page on (#orders, #customers/links, the old #maker): the place it names, over the home */
  if(location.hash){
    var first=addrOf(location.hash);
    if(first&&first.want){ try{ history.replaceState(null,'',addrFor('needs','')); }catch(e){} wantGo(first.want); }
    else if(first){
      showPlace(first.place, first.part, {fresh:true});
      try{ history.replaceState(null,'',addrFor(placeNow, partNow)); }catch(e){}
    }
  }
  /* ---- SALT ADMIN'S OWN NOTIFICATIONS (19 Oct 2026, docs/plan-notifications.html section 3) ---------------------------------------------
     Shop > This device. Its worker is /all/sw.js at scope /all (the customer's worker at the root never sees this page), its subscriptions are
     filed by /all/push/subscribe under opush:, and the Counter's own VAPID key is the one the site publishes at /push/key. The browser's question
     is asked from the Turn on tap alone. A registration whose scope is not exactly /all is never taken for Admin's, so Turn off can never undo a
     customer's. A tap on a banner is told here where to go (the worker posts { salt: 'admin', hash }), and the page opens that place. */
  function alertCan(){ return ('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window); }
  function alertPaint(on, note){
    var st=document.getElementById('alertState'), a=document.getElementById('alertOn'), b=document.getElementById('alertOff'), n=document.getElementById('alertNote');
    if(!st||!a||!b) return;
    st.textContent=on?'On':'Off'; a.hidden=true; b.hidden=true; a.disabled=false; b.disabled=false;
    /* 26 Oct 2026, his word: the Switch shows it, coloured when on, and is free again once the answer is in */
    var sw=document.getElementById('alertSwitch'); if(sw){ sw.checked=!!on; sw.disabled=false; }
    if(note&&n) n.textContent=note;
  }
  function alertKey(k){ var raw=atob(k.replace(/-/g,'+').replace(/_/g,'/')), out=new Uint8Array(raw.length); for(var i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i); return out; }
  function alertIsAdmin(reg){ try{ return !!reg&&new URL(reg.scope).pathname==='/all'; }catch(e){ return false; } }
  function alertActive(reg){
    return new Promise(function(done){
      var w=reg.installing||reg.waiting||reg.active;
      if(!w||w.state==='activated') return done(reg);
      w.addEventListener('statechange', function(){ if(w.state==='activated') done(reg); });
    });
  }
  async function alertFile(sub){
    var j=sub.toJSON?sub.toJSON():null;
    if(!j||!j.keys) throw new Error('This phone gave no notification keys. Try again.');
    await refs('/all/push/subscribe',{endpoint:sub.endpoint, keys:{p256dh:j.keys.p256dh, auth:j.keys.auth}});
  }
  async function alertTurnOn(){
    var a=document.getElementById('alertOn'); a.disabled=true;
    try{
      if(!alertCan()){ alertPaint(false,'This browser cannot take notifications. On an iPhone, add Salt Admin to the Home Screen first.'); return; }
      var k=await (await fetch('/push/key',{cache:'no-store'})).json();
      if(!k.key||!k.configured){ alertPaint(false,'Notifications are not set up on the site yet.'); return; }
      var perm=await Notification.requestPermission();
      if(perm!=='granted'){ alertPaint(false,'The browser did not allow notifications. Allow them in its settings, then tap again.'); return; }
      var reg=await alertActive(await navigator.serviceWorker.register('/all/sw.js',{scope:'/all'}));
      var sub=(await reg.pushManager.getSubscription())||(await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:alertKey(k.key)}));
      await alertFile(sub);
      alertPaint(true,'Salt Admin rings this phone for what waits on your decision.');
    }catch(e){ alertPaint(false,(e&&e.message)||'Notifications could not be turned on. Try again.'); }
  }
  async function alertTurnOff(){
    var b=document.getElementById('alertOff'); b.disabled=true;
    try{
      var reg=await navigator.serviceWorker.getRegistration('/all'), sub=alertIsAdmin(reg)?await reg.pushManager.getSubscription():null;
      if(sub){ await refs('/all/push/unsubscribe',{endpoint:sub.endpoint}); await sub.unsubscribe(); }
      alertPaint(false,'Notifications are off on this phone.');
    }catch(e){ alertPaint(true,(e&&e.message)||'Notifications could not be turned off. Try again.'); }
  }
  /* on opening: a phone already subscribed says On, and files the subscription again so a record the site lost is put back */
  async function alertRead(){
    try{
      if(!alertCan()||Notification.permission!=='granted') return;
      var reg=await navigator.serviceWorker.getRegistration('/all'), sub=alertIsAdmin(reg)?await reg.pushManager.getSubscription():null;
      if(!sub) return;
      await alertFile(sub);
      alertPaint(true);
    }catch(e){ /* the row stays Off; a tap on Turn on tries again */ }
  }
  if(!TESTING&&document.getElementById('alertOn')){
    document.getElementById('alertOn').addEventListener('click', alertTurnOn);
    document.getElementById('alertOff').addEventListener('click', alertTurnOff);
    var alertSw=document.getElementById('alertSwitch');
    if(alertSw) alertSw.addEventListener('click', function(){ if(alertSw.disabled) return; var was=!alertSw.checked; alertSw.disabled=true; alertSw.checked=was; (was?alertTurnOff:alertTurnOn)(); });
    alertRead();
    try{
      if('serviceWorker' in navigator&&navigator.serviceWorker.addEventListener) navigator.serviceWorker.addEventListener('message', function(ev){
        var d=ev&&ev.data;
        if(!d||d.salt!=='admin'||typeof d.hash!=='string'||view) return;
        var at=addrOf(d.hash);
        if(at) showPlace(at.place, at.part, {fresh:true, push:true});
      });
    }catch(e){ /* a browser that will not listen still opens the page */ }
  }
  /* 15 Nov 2026, the move to Ambient: light and dark follow the device (his answer of 14 Nov 2026); nothing here asks for a look */
`;
