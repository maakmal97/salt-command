/* test/desk-wave1.mjs: "Live and fast", wave 1, the Desk's part (19 Oct 2026).
   F1 OPEN ONCE: a derived read (To do, each book's approach list, the band) is kept between renders against the whole of
      badgeKey, so a render, a chart arriving and a tap make no second walk; and every input that moves its answer drops it.
   F2 LIGHT TAPS: a chart is kept with its canvas and put back when the same picture is asked for again; the design tokens
      are read once a look; the number formats are made once.
   R2 IDLE RELOAD: a chip offered to a busy desk loads the new build itself once the desk is idle on two looks in a row.
   Every check names the mutation that turns it red in test/desk-wave1.mutations.json. */
import { readFileSync } from "node:fs";

export async function run({ ok }) {
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const rd = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  try {
    /* ---------------------------------------------------------------- F1 */
    w.eval(`window.__walks=0;window.__splits=0;window.__renders=0;window.__oa=allActionsNow;window.__os=approachSplitNow;window.__or=renderNow;
      allActionsNow=function(){window.__walks++;return window.__oa.apply(this,arguments);};
      approachSplitNow=function(){window.__splits++;return window.__os.apply(this,arguments);};
      renderNow=function(){window.__renders++;return window.__or.apply(this,arguments);};
      window.__count=function(){return [window.__walks,window.__splits];};window.__zero=function(){window.__walks=0;window.__splits=0;window.__renders=0;};`);

    /* 1. the page's own first render left the answers kept: more renders, every part, and the library arriving make no walk */
    const warm = rd(`(function(){
      var parts=[];VIEWS.forEach(function(V){[V.lead].concat(V.parts).forEach(function(p){parts.push(p);});});
      switchTab('today');window.__zero();
      render();render();render();
      var kept=allActions()===allActions()&&bookBand()===bookBand()&&approachSplit()===approachSplit();   /* the very same answers handed back, the band too */
      parts.forEach(function(p){switchTab(p);});switchTab('today');render();
      return {parts:parts.length,walks:window.__count(),renders:window.__renders,kept:kept};})()`);
    ok(warm.parts === 13 && warm.renders >= 16 && warm.walks[0] === 0 && warm.walks[1] === 0 && warm.kept,
      "after the first render, sixteen renders over every part make no walk of the books and no approach list, and the list, the band and the approach list come back as the very same answers: " + JSON.stringify(warm));

    /* the library arriving is the other road that used to walk again: a draw queued for it, answered outside any render */
    const arrive = rd(`(function(){
      window.__zero();
      window.Chart=function(c,cfg){this.canvas=c;this.cfg=cfg;this.destroy=function(){};};window.Chart.register=function(){};
      window.Chart.defaults={font:{},animation:{},plugins:{tooltip:{},legend:{labels:{}}},elements:{line:{},point:{}}};
      var s=document.head.querySelector('script[src="assets/chart.umd.js"]');
      if(!s||typeof s.onload!=='function')return {noScript:true};
      s.onload();
      return {walks:window.__count(),renders:window.__renders};})()`);
    ok(!arrive.noScript && arrive.walks[0] === 0 && arrive.walks[1] === 0 && arrive.renders === 0,
      "the library arriving draws the charts from the kept answers: no walk, no approach list and no second render: " + JSON.stringify(arrive));

    /* 2. every input that moves the answer drops it: the kept answer is what a fresh walk gives, and moves when the input does */
    const step = (name, mutate, restore) => {
      const r = rd(`(function(){
        var day=function(n){var d=new Date(TODAY.getTime()+n*864e5);return d.toISOString().slice(0,10);};
        var both=function(){return JSON.stringify([allActions(),bookBand()]);};
        var fresh=function(){SESSION_MEMO=null;return JSON.stringify([allActionsNow(),eachBook(function(){var f=forecast(),cv=coverStats();
          return {held:currentStock,prom:f.commitUnits,short:f.shortUnits,days:cv.days,below:cv.below,trig:cv.reorderAt,rate:cv.rate,dry:f.dry,owed:arGross};})]);};
        var before=both();
        ${mutate};
        var memo=both(),now=fresh();
        ${restore};
        var back=both(),nowBack=fresh();
        return {moved:before!==now,same:memo===now,back:back===before&&back===nowBack};})()`);
      return r;
    };
    const inputs = {
      overlay: [`window.__r=BASE_SALES.filter(function(s){return (s.total-(+s.cash||0))>1&&!s.cancelled&&(+s.deliveredQty||0)>0;}).sort(function(a,b){return (b.total-(+b.cash||0))-(a.total-(+a.cash||0));})[0];window.__was=window.__r.cash;window.__r.cash=window.__r.total;applyOverlay()`,
        `window.__r.cash=window.__was;applyOverlay()`],
      order: [`window.__ko=ORD_OPEN;ORD_OPEN=[{id:'zt9',status:'placed',total:100,delivery:0,paid:0,at:new Date().toISOString(),code:'ZT9-TST'}]`, `ORD_OPEN=window.__ko`],
      date: [`window.__t0=TODAY.getTime();TODAY.setTime(window.__t0+400*864e5)`, `TODAY.setTime(window.__t0)`],
      vault: [`vaultNames={'CN3-WM':'Zed Trader'};revealed=true;if(!JSON.stringify(allActionsNow()).includes('Zed Trader'))throw new Error('the probe name is not on the list')`, `lockVault()`],
    };
    for (const k of Object.keys(inputs)) {
      const s = step(k, inputs[k][0], inputs[k][1]);
      ok(s.moved && s.same && s.back, "a changed " + k + " moves the kept To do list and band, which equal a fresh walk at once and again when it is put back: " + JSON.stringify(s));
    }
    /* the ones that do not move this book's list still hand back what a fresh walk gives */
    const quiet = [
      ["draft", `window.__kd=AP_DRAFTS;AP_DRAFTS=[{id:'d9',status:'pending',entry:{orderId:'zt9',status:'Payment',by:'customer'}}]`, `AP_DRAFTS=window.__kd`],
      ["hush", `window.__kh=HUSH;HUSH={zt9:'2999-01-01'}`, `HUSH=window.__kh`],
      ["expected", `window.__ke=EXPECTED;EXPECTED={salt:day(5)}`, `EXPECTED=window.__ke`],
      ["override", `pxOver.party='ZT9'`, `pxOver.party=''`],
      ["queue", `queue.push({at:'2999-01-01T00:00:00Z',raw:'probe',payload:{mode:'count',qty:1,date:day(0)}});applyOverlay()`, `queue.pop();applyOverlay()`],
    ];
    for (const [k, a, b] of quiet) {
      const s = step(k, a, b);
      ok(s.same && s.back, "a changed " + k + " leaves the kept list equal to a fresh walk, and put back again: " + JSON.stringify(s));
    }

    /* a product switch: each book's approach list is its own, kept under its own name */
    const books = rd(`(function(){
      var keep=PROD,out={};
      ['salt','oil','candy','rice'].forEach(function(p){setProd(p);recompute();out[p]=JSON.stringify(approachSplit());});
      var fresh={};
      ['salt','oil','candy','rice'].forEach(function(p){SESSION_MEMO=null;setProd(p);recompute();fresh[p]=JSON.stringify(approachSplitNow());});
      setProd(keep);recompute();
      var distinct=Object.keys(out).filter(function(p,i,a){return a.every(function(q,j){return j>=i||out[q]!==out[p];});}).length;
      return {same:Object.keys(out).every(function(p){return out[p]===fresh[p];}),distinct:distinct};})()`);
    ok(books.same && books.distinct >= 2, "switching the book in view gives each book its own kept approach list, equal to a fresh one: " + JSON.stringify(books));

    /* the vault: a lock never serves a remembered name */
    const vault = rd(`(function(){
      vaultNames={'CN3-WM':'Zed Trader'};revealed=true;
      var open=JSON.stringify(allActions()).includes('Zed Trader');
      lockVault();
      var locked=JSON.stringify(allActions()).includes('Zed Trader');
      return {open:open,locked:locked,code:JSON.stringify(allActions()).includes('CN3-WM')};})()`);
    ok(vault.open && !vault.locked && vault.code, "the list names a party while the vault is open and returns to the code the moment it is locked: " + JSON.stringify(vault));

    /* 3. each live book is walked once, not twice, and the answer keeps the books' order */
    const eb = rd(`(function(){
      var calls=0,orig=recompute;recompute=function(){calls++;return orig.apply(this,arguments);};
      var keep=PROD,r;try{r=eachBook(function(p){return p;});}finally{recompute=orig;}
      var live=liveBooks();
      var after={s:currentStock,a:arGross};recompute();
      return {calls:calls,live:live.length,order:JSON.stringify(Object.keys(r))===JSON.stringify(live),prod:PROD===keep,inView:after.s===currentStock&&after.a===arGross};})()`);
    ok(eb.live === 4 && eb.calls === eb.live && eb.order && eb.prod && eb.inView,
      "eachBook walks each live book once (the one in view last), answers in the books' order and leaves the view's own walk standing: " + JSON.stringify(eb));
    const thrown = rd(`(function(){
      var keep=PROD,msg='';
      try{eachBook(function(p){if(p==='oil')throw new Error('probe');return p;});}catch(e){msg=e.message;}
      var after={s:currentStock,a:arGross,p:PROD};recompute();
      return {msg:msg,prod:after.p===keep,fresh:after.s===currentStock&&after.a===arGross};})()`);
    ok(thrown.msg === "probe" && thrown.prod && thrown.fresh, "a reader that throws mid-way still leaves the book in view and its walk as they were: " + JSON.stringify(thrown));

    /* 4. every width is read before any class is written */
    const fade = rd(`(function(){
      switchTab('people');   /* 99 tables, none in a closed card (Network's are all in closed ones) */
      var log=[],E=Element.prototype;
      var defs=['scrollWidth','clientWidth','scrollLeft'].map(function(n){var d=Object.getOwnPropertyDescriptor(E,n);
        Object.defineProperty(E,n,{configurable:true,get:function(){if(this.classList&&this.classList.contains('tscroll'))log.push('r');return n==='scrollWidth'?500:n==='clientWidth'?300:0;}});return [n,d];});
      var T=DOMTokenList.prototype,ot=T.toggle;
      T.toggle=function(c){if(c==='more'||c==='morel')log.push('w');return ot.apply(this,arguments);};
      var n=[].filter.call(document.querySelectorAll('.sec.on .tscroll'),function(x){return !x.closest('details:not([open])');}).length;
      document.querySelectorAll('.sec.on .tscroll').forEach(function(x){x.classList.remove('more');x.classList.remove('morel');});
      log.length=0;
      try{wrapTables();}finally{T.toggle=ot;defs.forEach(function(d){if(d[1])Object.defineProperty(E,d[0],d[1]);else delete E[d[0]];});}
      var firstW=log.indexOf('w'),lastR=log.lastIndexOf('r');
      var more=[].filter.call(document.querySelectorAll('.sec.on .tscroll'),function(x){return !x.closest('details:not([open])');}).every(function(x){return x.classList.contains('more')&&!x.classList.contains('morel');});
      return {tables:n,reads:log.filter(function(c){return c==='r';}).length,writes:log.filter(function(c){return c==='w';}).length,firstW:firstW,lastR:lastR,more:more};})()`);
    ok(fade.tables >= 5 && fade.reads >= fade.tables * 3 && fade.writes >= fade.tables && fade.firstW > fade.lastR && fade.more,
      "the scroll fade reads every table's widths first, then writes the classes (more where wider than the box): " + JSON.stringify(fade));

  } finally { try { w.close(); } catch (e) { /* best effort */ } }

}
