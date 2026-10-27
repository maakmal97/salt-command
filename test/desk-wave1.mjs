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
      overlay: [`window.__r=BASE_SALES.filter(function(s){return (s.total-(+s.cash||0)-(+s.settledRM||0))>1&&!s.cancelled&&!s.defaulted&&(+s.deliveredQty||0)>0;}).sort(function(a,b){return (b.total-(+b.cash||0)-(+b.settledRM||0))-(a.total-(+a.cash||0)-(+a.settledRM||0));})[0];window.__was=window.__r.cash;window.__r.cash=window.__r.total-(+window.__r.settledRM||0);applyOverlay()`,
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
    /* ...and these five do not change what the list says, so a kept list that ignored them would still equal a fresh walk. Each is therefore asked
       the other way: moved alone (the queue without applyOverlay, which would move the book's stamp), it must drop the kept answer, and put back it
       must drop it again. Red on its own when its term leaves the key. */
    const moves = [
      ["draft", `window.__kd=AP_DRAFTS;AP_DRAFTS=[{id:'d9',status:'pending',entry:{orderId:'zt9',status:'Payment',by:'customer'}}]`, `AP_DRAFTS=window.__kd`],
      ["hush", `window.__kh=HUSH;HUSH={zt9:'2999-01-01'}`, `HUSH=window.__kh`],
      ["expected", `window.__ke=EXPECTED;EXPECTED={salt:'2999-01-01'}`, `EXPECTED=window.__ke`],
      ["override", `pxOver.party='ZT9'`, `pxOver.party=''`],
      ["queue", `queue.push({at:'2999-01-01T00:00:00Z',raw:'probe',payload:{mode:'obs',id:'zt9',act:'dismiss'}})`, `queue.pop()`],
    ];
    for (const [k, a, b] of moves) {
      const r = rd(`(function(){
        var x=allActions(),x2=allActions();
        ${a};
        var y=allActions();
        ${b};
        var z=allActions();
        return {kept:x===x2,dropped:x!==y,droppedBack:z!==y,sameAsFirst:JSON.stringify(z)===JSON.stringify(x)};})()`);
      ok(r.kept && r.dropped && r.droppedBack && r.sameAsFirst, "the key holds " + k + " by itself: moving it alone drops the kept list, and putting it back drops it again: " + JSON.stringify(r));
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

    /* what is kept holds no name: a key is a short hash of the names, a kept chart's signature a hash of its labels, and a lock empties the lot */
    const held = rd(`(function(){
      var N='Zed Trader',host=document.createElement('div');host.className='vpart';host.setAttribute('data-tab','zzvault');document.body.appendChild(host);
      var made=[];window.Chart=window.Chart||function(c,cfg){this.canvas=c;this.cfg=cfg;this.destroy=function(){};};
      try{
        vaultNames={'CN3-WM':N};revealed=true;SESSION_MEMO=null;railCounts._c=null;CHART_KEEP.clear();
        var named=JSON.stringify(allActions()).includes(N);railCounts();
        host.innerHTML='<canvas id="zv1"></canvas>';freshChart(host.querySelector('canvas'),{type:'bar',data:{labels:[N,'CN3-WM'],datasets:[{data:[1,2]}]}});
        var keys=[SESSION_MEMO.k,railCounts._c.k,badgeKey(),badgeKey(true)],sigs=[];CHART_KEEP.forEach(function(e,k){sigs.push(e.sig,k);});
        var open={named:named,keys:keys.concat(sigs).filter(function(s){return String(s).indexOf(N)>=0;}).length,sigs:sigs.length,
          keyA:badgeKey(true)};
        vaultNames={'CN3-WM':'Other Name'};var keyB=badgeKey(true);vaultNames={'CN3-WM':N};var keyA2=badgeKey(true);
        var moves={differs:open.keyA!==keyB,steady:open.keyA===keyA2};
        var memoBefore=allActions();
        lockVault();
        var after={kept:CHART_KEEP.size,memoGone:SESSION_MEMO===null,railGone:railCounts._c===null,again:allActions()!==memoBefore,named:JSON.stringify(allActions()).includes(N),
          keys:[SESSION_MEMO&&SESSION_MEMO.k,railCounts._c&&railCounts._c.k].filter(function(s){return s&&String(s).indexOf(N)>=0;}).length};
        return {open:open,moves:moves,after:after};
      }finally{host.parentNode.removeChild(host);CHART_KEEP.clear();lockVault();}})()`);
    ok(held.open.named && held.open.sigs >= 2 && held.open.keys === 0 && held.moves.differs && held.moves.steady,
      "while the vault is open no kept key, chart signature or key holds a name, and the key still moves when a name does and not when none does: " + JSON.stringify({ open: { ...held.open, keyA: undefined }, moves: held.moves }));
    ok(held.after.kept === 0 && held.after.memoGone && held.after.railGone && held.after.again && !held.after.named && held.after.keys === 0,
      "a lock empties the kept charts and misses the kept list: the next read is a new walk without the name: " + JSON.stringify(held.after));

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

    /* ---------------------------------------------------------------- F2 */
    /* a recording library: a chart is an object with its canvas and its config, and can be told it is gone */
    w.eval(`window.__made=[];window.Chart=function(c,cfg){this.canvas=c;this.cfg=cfg;this.gone=false;window.__made.push(this);};
      window.Chart.prototype.destroy=function(){this.gone=true;};
      window.Chart.prototype.unbindEvents=function(){this.unbound=(this.unbound||0)+1;};window.Chart.prototype.bindEvents=function(){this.rebound=(this.rebound||0)+1;};window.Chart.register=function(){};
      window.Chart.defaults={font:{},animation:{},plugins:{tooltip:{},legend:{labels:{}}},elements:{line:{},point:{}}};
      window.__td=function(id){return window.__made.filter(function(c){return c.canvas&&(id?c.canvas.id===id:/^td/.test(c.canvas.id));});};`);
    /* Today's own two charts: drawn once, and a tap away and back puts the same ones back */
    const today = rd(`(function(){
      CHART_KEEP.clear();window.__made.length=0;
      switchTab('today');var first=__td().length,a=__td();
      switchTab('money');switchTab('today');switchTab('money');switchTab('today');
      var k=document.getElementById('tdKindChart');
      return {first:first,after:__td().length,seated:a.length>0&&k===a[0].canvas&&k.isConnected,live:a.every(function(c){return !c.gone;}),kept:CHART_KEEP.size};})()`);
    ok(today.first === 2 && today.after === 2 && today.seated && today.live,
      "Today's two charts are drawn once; a tap away and back, twice over, builds none and puts the kept canvas where the page has an empty one: " + JSON.stringify(today));
    const moved = rd(`(function(){
      var before=__td().length,old=__td();
      window.__r=BASE_SALES.filter(function(s){return (s.total-(+s.cash||0))>1&&!s.cancelled&&(+s.deliveredQty||0)>0;}).sort(function(a,b){return (b.total-(+b.cash||0))-(a.total-(+a.cash||0));})[0];
      window.__was=window.__r.cash;window.__r.cash=window.__r.total;applyOverlay();
      switchTab('money');switchTab('today');
      var built=__td().length-before,goneOld=old.filter(function(c){return c.gone;}).length;
      window.__r.cash=window.__was;applyOverlay();
      return {built:built,goneOld:goneOld};})()`);
    ok(moved.built >= 1 && moved.goneOld >= 1, "a change in the book redraws the chart whose picture it changes, and lets the old one go: " + JSON.stringify(moved));

    /* freshChart on its own, over a canvas of its own: the signature is the look, the inputs and the whole config */
    const probe = (body) => rd(`(function(){
      var host=document.createElement('div');host.className='vpart';host.setAttribute('data-tab','zzprobe');document.body.appendChild(host);
      var seat=function(id){host.innerHTML='<div class="chartbox">'+(id?'<canvas id="'+id+'"></canvas>':'<canvas></canvas>')+'</div>';return host.querySelector('canvas');};
      var cfgA={type:'bar',data:{labels:['a'],datasets:[{data:[1]}]},options:{}};
      var cfgB={type:'bar',data:{labels:['a'],datasets:[{data:[2]}]},options:{}};
      CHART_KEEP.clear();window.__made.length=0;
      try{${body}}finally{host.parentNode.removeChild(host);CHART_KEEP.clear();}})()`);
    const same = probe(`var a=freshChart(seat('zp1'),cfgA);var c2=seat('zp1');var b=freshChart(c2,cfgA);
      return {built:window.__made.length,same:a===b,seated:host.querySelector('canvas')===a.canvas&&c2.parentNode===null,live:!a.gone};`);
    ok(same.built === 1 && same.same && same.seated && same.live, "the same picture asked for again (same seat, look, inputs and config) is the kept chart on its kept canvas: " + JSON.stringify(same));
    /* and a kept canvas that has changed places has its resize watch moved to the new box, once the render's work is over, never during it */
    const seatedAt = rd(`(function(){
      var host=document.createElement('div');host.className='vpart';host.setAttribute('data-tab','zzseat');document.body.appendChild(host);window.__seatHost=host;
      var seat=function(){host.innerHTML='<canvas id="zs1"></canvas>';return host.querySelector('canvas');};
      var cfg={type:'bar',data:{labels:['a'],datasets:[{data:[1]}]}};
      CHART_KEEP.clear();window.__made.length=0;
      var a=freshChart(seat(),cfg);var b=freshChart(seat(),cfg);window.__seatChart=b;
      return {same:a===b,during:b.rebound||0};})()`);
    await new Promise((r) => setTimeout(r, 0));
    const seatedAfter = rd(`(function(){var c=window.__seatChart,r={unbound:c.unbound||0,rebound:c.rebound||0};window.__seatHost.parentNode.removeChild(window.__seatHost);CHART_KEEP.clear();return r;})()`);
    ok(seatedAt.same && seatedAt.during === 0 && seatedAfter.unbound === 1 && seatedAfter.rebound === 1,
      "a kept canvas put in a new place has its events and size re-bound to it once, after the render's own work: " + JSON.stringify({ seatedAt, seatedAfter }));
    const cfgMoved = probe(`var a=freshChart(seat('zp1'),cfgA);var b=freshChart(seat('zp1'),cfgB);
      return {built:window.__made.length,diff:a!==b,oldGone:a.gone,live:!b.gone};`);
    ok(cfgMoved.built === 2 && cfgMoved.diff && cfgMoved.oldGone && cfgMoved.live, "a changed config builds a new chart and lets the old one go: " + JSON.stringify(cfgMoved));
    const stamp = probe(`var a=freshChart(seat('zp1'),cfgA);DATA_STAMP++;var b=freshChart(seat('zp1'),cfgA);
      return {built:window.__made.length,diff:a!==b,oldGone:a.gone};`);
    ok(stamp.built === 2 && stamp.diff && stamp.oldGone, "the book moving (its stamp) builds the chart anew even with the same config: " + JSON.stringify(stamp));
    const idless = probe(`var a=freshChart(seat(''),cfgA);var b=freshChart(seat(''),cfgA);
      return {built:window.__made.length,kept:CHART_KEEP.size};`);
    ok(idless.built === 2 && idless.kept === 0, "a canvas with no id is never kept: " + JSON.stringify(idless));
    /* a kept canvas put back in the page is updated by Chart.js in its 'attach' mode: given no transition it ran the whole entrance again (proved in Chromium) */
    const attach = rd(`(function(){
      var keep=window.Chart;
      try{window.Chart=function(){};window.Chart.defaults={font:{},animation:{},plugins:{tooltip:{},legend:{labels:{}}},elements:{line:{},point:{}},transitions:{resize:{animation:{duration:0}}}};
        chartTheme();var t=window.Chart.defaults.transitions;
        return {attach:t.attach&&t.attach.animation&&t.attach.animation.duration,resize:t.resize.animation.duration};}
      finally{window.Chart=keep;}})()`);
    ok(attach.attach === 0 && attach.resize === 0, "a chart put back in the page has no entrance of its own: the library's attach mode takes no time: " + JSON.stringify(attach));
    const lru = rd(`(function(){
      var host=document.createElement('div');host.className='vpart';host.setAttribute('data-tab','zzlru');document.body.appendChild(host);
      CHART_KEEP.clear();window.__made.length=0;
      try{
        for(var i=0;i<CHART_KEEP_MAX+10;i++){host.innerHTML='<canvas id="zl'+i+'"></canvas>';freshChart(host.querySelector('canvas'),{type:'bar',data:{labels:[i],datasets:[{data:[i]}]}});}
        var gone=window.__made.filter(function(c){return c.gone;}).length;
        return {size:CHART_KEEP.size,max:CHART_KEEP_MAX,gone:gone,oldestGone:window.__made[0].gone,newestLive:!window.__made[window.__made.length-1].gone};
      }finally{host.parentNode.removeChild(host);CHART_KEEP.clear();}})()`);
    ok(lru.size === lru.max && lru.gone === 10 && lru.oldestGone && lru.newestLive, "no more than CHART_KEEP_MAX charts are held, the longest unused let go first: " + JSON.stringify(lru));

    /* a theme switch still rebuilds, even where every token is the same in both looks (so the config is too) */
    const STUB = ["salt-salt", "salt-brass", "salt-copper", "salt-verdigris", "salt-ember", "salt-steel", "salt-product-salt", "salt-mist-light", "salt-brass-soft",
      "salt-obsidian", "salt-slate", "salt-line-strong", "desk-chart-grid"];
    /* Tide is off for now (#197, 19 Oct 2026): lookSet refuses it and the head script forces Night, but the page's theme still changes where saltLook sets
       data-theme (the way a returning Tide will), so the change is driven so, and redrawn as lookSet redraws */
    const look = rd(`(function(){
      var L=function(t){saltLook(t);lookRedraw();};
      var de=document.documentElement,hex=${JSON.stringify(STUB)};
      hex.forEach(function(k,i){de.style.setProperty('--'+k,'#0a0b'+(10+i).toString(16));});
      try{
        L('tide');CHART_KEEP.clear();window.__made.length=0;
        switchTab('today');var first=__td().length;switchTab('money');switchTab('today');var again=__td().length;
        L('night');var night=__td().length;
        var kinds=__td('tdKindChart');
        var cfgSame=kinds.length===2&&JSON.stringify(kinds[0].cfg)===JSON.stringify(kinds[1].cfg);
        return {first:first,again:again,night:night,cfgSame:cfgSame,theme:lookNow()};
      }finally{hex.forEach(function(k){de.style.removeProperty('--'+k);});L('night');}})()`);
    ok(look.first === 2 && look.again === 2 && look.night === 4 && look.cfgSame && look.theme === "night",
      "a theme switch rebuilds the charts of the part showing though both looks gave the same config: " + JSON.stringify(look));

    /* the tokens: read once a look, and the other look's values the moment it is chosen */
    const tok = rd(`(function(){
      var L=function(t){saltLook(t);lookRedraw();};
      L('tide');TOK=null;
      var n=0,o=window.getComputedStyle;window.getComputedStyle=function(){n++;return o.apply(window,arguments);};
      var a,b,c;
      try{a=tcol('ink');tcol('ink');tcol('ink',0.5);tcol('brass');tcol('brass');}finally{window.getComputedStyle=o;}
      var reads=n;
      var tide=tcol('ink');L('night');var night=tcol('ink');L('tide');var back=tcol('ink');L('night');
      var de=document.documentElement;de.style.setProperty('--salt-salt','#123456');var stub=tcol('ink');de.style.removeProperty('--salt-salt');
      return {reads:reads,tide:tide,night:night,back:back,stub:stub,hue:typeof hue};})()`);
    ok(tok.reads === 2 && tok.tide && tok.night && tok.tide !== tok.night && tok.back === tok.tide && tok.stub === "#123456",
      "tcol reads each token once a look (two tokens, two reads over five calls), follows a theme switch and a token set on the page at once: " + JSON.stringify(tok));

    /* the ledger's column widths: measured once for a markup, taken from the last measure when the same ledger is drawn again */
    const led = rd(`(function(){
      var P=Element.prototype,o=P.getBoundingClientRect,n=0,wd=Object.getOwnPropertyDescriptor(window,'innerWidth');
      P.getBoundingClientRect=function(){n++;var r=o.apply(this,arguments);return {width:/lc-|cqty|cprc|ctot|lstate/.test(this.className||'')?88:0,height:0,top:0,left:0,right:0,bottom:0};};
      LED_FIT=null;
      try{
        switchTab('book');var first=n,css=document.querySelector('.sec.on .ledwrap').style.getPropertyValue('--lc-date');
        n=0;switchTab('money');switchTab('book');var again=n,css2=document.querySelector('.sec.on .ledwrap').style.getPropertyValue('--lc-date');
        n=0;Object.defineProperty(window,'innerWidth',{configurable:true,value:(window.innerWidth||1024)-300});switchTab('money');switchTab('book');var resized=n;
        Object.defineProperty(window,'innerWidth',wd||{configurable:true,value:1024});switchTab('money');switchTab('book');   /* measured again at the old width, so the next change is the markup's alone */
        window.__rr=BASE_SALES[BASE_SALES.length-1];window.__rw=window.__rr.total;window.__rr.total=window.__rr.total+1111;applyOverlay();
        n=0;switchTab('money');switchTab('book');var changed=n;
        window.__rr.total=window.__rw;applyOverlay();
        return {first:first,css:css,again:again,css2:css2,resized:resized,changed:changed};
      }finally{P.getBoundingClientRect=o;}})()`);
    ok(led.first > 0 && led.css === '90px' && led.again === 0 && led.css2 === '90px' && led.resized > 0 && led.changed > 0,
      "the ledger measures its columns once for a markup and a window width, takes them from that measure when drawn again, and measures anew for another markup or width: " + JSON.stringify(led));

    /* the number formats are the same text as before, made once */
    const nf = rd(`(function(){
      var vals=[0,-0,1,-1,0.004,-0.004,0.005,0.5,1.005,12.5,1234.5,1234567.891,-98765.4321,1e6,1e21,NaN,Infinity,'12.5','abc',null,undefined,2.675,0.0001,-0.0001];
      var bad=[];
      vals.forEach(function(n){
        var f=CUR+' '+noNegZero(Number(n).toLocaleString('en-MY',{minimumFractionDigits:(Math.abs(n%1)>1e-9?2:0),maximumFractionDigits:2}));
        var f0=CUR+' '+noNegZero(Number(n).toLocaleString('en-MY',{maximumFractionDigits:0}));
        var u=noNegZero(Number(n).toLocaleString('en-MY',{maximumFractionDigits:2}))+' unit';
        if(fmt(n)!==f)bad.push(['fmt',String(n),fmt(n),f]);if(fmt0(n)!==f0)bad.push(['fmt0',String(n),fmt0(n),f0]);if(units(n)!==u)bad.push(['units',String(n),units(n),u]);});
      return {n:vals.length,bad:bad.slice(0,4)};})()`);
    ok(nf.n > 20 && nf.bad.length === 0, "fmt, fmt0 and units give exactly the text toLocaleString gave, over the awkward values: " + JSON.stringify(nf));
  } finally { try { w.close(); } catch (e) { /* best effort */ } }

  /* -------------------------------------------------------------------- F3 */
  {
    const { w: v } = await openMaster(process.env.SALT_MASTER || undefined, { late: true });   /* a window as the browser has it: the deferral on */
    const vr = (e) => JSON.parse(String(v.eval("JSON.stringify(" + e + ")")));
    try {
      /* the rig: a Chart that counts what it is asked to draw, the frame and the task queue in the test's hands, and the three
         later steps counted (the draw pass, the table fades, the rail's count) */
      v.eval(`window.__ch=0;window.__tabs=[];window.__fade=0;window.__nc=0;window.__walks=0;
        window.Chart=function(c,cfg){window.__ch++;this.canvas=c;this.cfg=cfg;this.destroy=function(){};};window.Chart.register=function(){};
        window.Chart.defaults={font:{},animation:{},plugins:{tooltip:{},legend:{labels:{}}},elements:{line:{},point:{}}};
        window.__odp=drawPass;drawPass=function(t,e){window.__tabs.push(t);return window.__odp.apply(this,arguments);};
        window.__otf=tscrollFadeAll;tscrollFadeAll=function(l){window.__fade++;return window.__otf.apply(this,arguments);};
        window.__onc=navCounts;navCounts=function(){window.__nc++;return window.__onc.apply(this,arguments);};
        window.__oa=allActionsNow;allActionsNow=function(){window.__walks++;return window.__oa.apply(this,arguments);};
        window.__zero=function(){window.__ch=0;window.__tabs=[];window.__fade=0;window.__nc=0;window.__walks=0;};
        window.__frames=[];window.requestAnimationFrame=function(f){window.__frames.push(f);return window.__frames.length;};
        window.__tasks=[];window.__realST=window.setTimeout;
        window.setTimeout=function(f,ms){if(!(ms>0)){window.__tasks.push(f);return -1;}return window.__realST.apply(window,arguments);};
        window.__frame=function(){var q=window.__frames.splice(0);q.forEach(function(f){f();});};
        window.__task=function(){var f=window.__tasks.shift();if(f)f();return !!f;};
        window.__drain=function(){var n=0;while(window.__task()&&n++<200);};`);
      const seen = () => vr("{charts:__ch,tabs:__tabs,fades:__fade,counts:__nc,frames:__frames.length}");
      /* settle the page's own open, then count from nothing */
      v.eval("__frame();__drain();switchTab('network');__frame();__drain();__zero();");

      /* 1. a tap's synchronous path draws no chart, counts no rail and reads no table's width; its text is in the page */
      const sync = vr(`(function(){switchTab('pricing');var s=document.querySelector('.sec.on');
        return {charts:__ch,tabs:__tabs,fades:__fade,counts:__nc,frames:__frames.length,text:s.querySelectorAll('.vpart h1,.vpart .dsc,.vpart table').length>0,
        canvases:s.querySelectorAll('canvas').length,wrapped:s.querySelectorAll('.tscroll').length};})()`);
      ok(sync.charts === 0 && sync.tabs.length === 0 && sync.counts === 0 && sync.fades === 0 && sync.text && sync.canvases > 0 && sync.wrapped > 0 && sync.frames === 1,
        "a tap writes the part's text, its canvases and its table wrappers and asks for one frame, and draws no chart, runs no draw pass, counts no rail and reads no table's width: " + JSON.stringify(sync));

      /* 2. nothing runs until a frame has been painted; then each step has a task of its own, in order: charts, fades, count */
      v.eval("__drain();");
      const noFrame = seen();
      ok(noFrame.charts === 0 && noFrame.counts === 0 && noFrame.fades === 0, "the later work waits for a painted frame: queued tasks alone draw, count and fade nothing: " + JSON.stringify(noFrame));
      v.eval("__frame();");
      const t0 = seen(); v.eval("__task();");   /* the frame's setTimeout 0 starts the work: the draw pass */
      const t1 = seen(); v.eval("__task();");   /* the next task: the table fades */
      const t2 = seen(); v.eval("__task();");   /* the next: the rail's count */
      const t3 = seen();
      ok(t0.charts === 0 && t1.charts > 0 && t1.tabs.length === 1 && t1.fades === 0 && t1.counts === 0
        && t2.fades >= 1 && t2.counts === 0 && t3.counts === 1,
        "after the frame the charts are drawn in one task, the fades in the next and the rail's count in the one after: " + JSON.stringify([t0, t1, t2, t3]));

      /* 3. a tap on another part before the deferred work runs cancels the stale work: only the last part is drawn, and counted once */
      v.eval("__zero();switchTab('pricing');switchTab('sourcing');__frame();__drain();");
      const stale = seen(), cur = vr("curAddr");
      ok(stale.tabs.length === 1 && stale.tabs[0] === "sourcing" && cur === "sourcing" && stale.counts === 1,
        "two taps before the frame draw the second part alone and count the rail once; the first's draw pass, fades and count are cancelled: " + JSON.stringify({ stale, cur }));

      /* ... and half way: the first tap's charts are drawn, its fades and count still waiting, and a second tap lands */
      v.eval("__zero();switchTab('pricing');__frame();__task();");
      const half = seen();
      v.eval("switchTab('network');__frame();__drain();");
      const after = seen();
      ok(half.tabs.length === 1 && half.counts === 0 && after.tabs.length === 2 && after.tabs[1] === "network" && after.counts === 1,
        "a tap that lands between the steps of the last one cancels the steps still waiting, and the new part is drawn and counted: " + JSON.stringify({ half, after }));

      /* ... and the part may be gone by the time the frame comes: nothing is drawn onto what is no longer in the page */
      v.eval("__zero();switchTab('pricing');document.querySelector('.sec.on').innerHTML='';__frame();__drain();");
      const gone = seen();
      ok(gone.tabs.length === 0, "a part that has left the page before the frame is not drawn on: " + JSON.stringify(gone));

      /* 4. a render that is not a tap does all of it at once and cancels what a tap had left for later */
      v.eval("__zero();switchTab('pricing');render();");
      const all = seen();
      v.eval("__frame();__drain();");
      const left = seen();
      ok(all.tabs.length === 1 && all.counts === 1 && all.fades >= 1 && left.tabs.length === 1 && left.counts === 1,
        "a render that is not a tap draws, fades and counts at once, and the tap's later work, cancelled by it, then does nothing: " + JSON.stringify({ all, left }));

      /* 5. lateFlush runs what is left now, and only once */
      v.eval("__zero();switchTab('pricing');lateFlush();lateFlush();__frame();__drain();");
      const fl = seen();
      ok(fl.tabs.length === 1 && fl.counts === 1, "lateFlush runs the draw pass, the fades and the count that a tap left, once: " + JSON.stringify(fl));

      /* 5b. a render that draws nothing (no part to draw into) cancels nothing: the tap's charts, fades and count still follow */
      v.eval("__zero();switchTab('pricing');window.__ct=curTab;curTab='zz-none';render();curTab=window.__ct;__frame();__drain();");
      const bail = seen();
      ok(bail.tabs.length === 1 && bail.tabs[0] === "pricing" && bail.counts === 1 && bail.fades >= 1,
        "a render that bails before drawing leaves the last tap's charts, fades and count to follow: " + JSON.stringify(bail));

      /* 5c. the late draw pass keeps a memo of its own, as it had inside the render: the inputs' key is read once across a part's charts */
      const memo = vr(`(function(){var n=0,o=badgeKey,charts=0,of=freshChart;badgeKey=function(x){if(x===true)n++;return o.apply(this,arguments);};
        freshChart=function(){charts++;return of.apply(this,arguments);};
        try{__zero();switchTab('pricing');__frame();var before=n;charts=0;__task();return {keys:n-before,charts:charts,memoAfter:RENDER_MEMO===null};}
        finally{badgeKey=o;freshChart=of;__drain();}})()`);
      ok(memo.charts >= 2 && memo.keys <= 1 && memo.memoAfter,
        "the late draw pass reads the inputs' key at most once across the part's charts, and closes its memo after: " + JSON.stringify(memo));

      /* 6. the ledger sets its kept columns on the tap's own paint, so they do not move after it */
      const col = vr(`(function(){
        var sigOf=function(){var w=document.querySelector('.sec.on .ledwrap'),html=w.innerHTML,fonts=(document.fonts&&document.fonts.status)||'loaded',h=0;
          for(var i=0;i<html.length;i++)h=(h*31+html.charCodeAt(i))|0;return html.length+'|'+h+'|'+fonts+'|'+lookNow()+'|'+(window.innerWidth||0);};
        var P=CSSStyleDeclaration.prototype,op=P.setProperty,log=[];P.setProperty=function(n,x){log.push(n+'='+x);return op.apply(this,arguments);};
        var T=DOMTokenList.prototype,oa=T.add;T.add=function(c){if(c==='lmeasure')log.push('measure');return oa.apply(this,arguments);};
        try{
          switchTab('ledger');lateFlush();LED_FIT={sig:sigOf(),w:{e:77}};
          switchTab('network');lateFlush();
          log.length=0;switchTab('ledger');
          var painted=log.filter(function(l){return l==='--lc-e=77px';}).length;
          lateFlush();
          LED_FIT=null;switchTab('network');lateFlush();log.length=0;switchTab('ledger');
          var unmeasured=log.filter(function(l){return /^--lc-|^measure$/.test(l);}).length;
        }finally{P.setProperty=op;T.add=oa;}
        return {painted:painted,unmeasured:unmeasured};})()`);
      ok(col.painted === 1 && col.unmeasured === 0, "a ledger drawn again from the markup it was measured on has its columns set on the tap's own paint, and one never measured is not measured before it: " + JSON.stringify(col));

      /* 7. the whole chain runs by itself on the browser's own frame and timers */
      v.eval(`window.requestAnimationFrame=function(f){return window.__realST.call(window,f,0);};window.setTimeout=window.__realST;`);
      v.eval("__zero();switchTab('sourcing');");
      const early = seen();
      for (let i = 0; i < 100 && vr("__nc") < 1; i++) await new Promise((r) => setTimeout(r, 50));   /* the steps are tasks of the page's own: as long as they take */
      const ran = seen();
      ok(early.charts === 0 && early.counts === 0 && ran.tabs.length === 1 && ran.counts === 1,
        "on the browser's own frame and timers a tap paints first and the charts, the fades and the count follow by themselves: " + JSON.stringify({ early, ran }));

      /* 8. the rail's count is warmed once the desk's reads settle, so the first tap after them finds it kept */
      v.eval(`window.__tasks=[];window.requestAnimationFrame=function(f){window.__frames.push(f);return 1;};`);
      v.eval("switchTab('network');lateFlush();SESSION_MEMO=null;railCounts._c=null;__zero();window.SALT_CLOUD=true;");
      const cold = vr("(function(){switchTab('sourcing');lateFlush();return __walks;})()");   /* the flip with nothing warmed: the tap walks */
      v.eval("switchTab('network');lateFlush();window.SALT_CLOUD=false;switchTab('sourcing');lateFlush();window.SALT_CLOUD=true;warmSoon();");
      await new Promise((r) => setTimeout(r, 650));
      const warm2 = vr("(function(){__zero();switchTab('network');lateFlush();return __walks;})()");
      ok(cold >= 1 && warm2 === 0, "after the desk learns it is the cloud the rail's count is read once it settles, so the next tap walks no book (a tap with nothing warmed walks): " + JSON.stringify({ cold, warm: warm2 }));

      /* and each read that settles asks for it: the restock date, the hushes, and the waiting list the drafts and orders reads move */
      const reads = {
        expLoad: [`window.fetch=function(){return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({ok:true,expected:{}});}});};`, `expLoad(true)`],
        hushLoad: [`window.fetch=function(){return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({ok:true,hush:{}});}});};`, `hushLoad(true)`],
        waitRecount: [``, `(window.__ko=ORD_OPEN,ORD_OPEN=[{id:'zt9',status:'placed',total:100,delivery:0,paid:0,at:new Date().toISOString(),code:'ZT9-TST'}],ordWaitWas=ordActs().map(function(a){return a.kind+':'+(a.o&&a.o.id);}).join(','),waitRecount())`],
      };
      for (const k of Object.keys(reads)) {
        v.eval(`window.SALT_CLOUD=true;${reads[k][0]};switchTab('network');lateFlush();`);
        const k0 = vr("badgeKey()");                                          /* the count is kept against this key */
        v.eval(`${reads[k][1]};`);
        for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));   /* the stubbed fetch answers within a few ticks */
        const k1 = vr("badgeKey()");
        await new Promise((r) => setTimeout(r, 700));                         /* the warm waits 400 ms after the last read */
        const warmed = vr("railCounts._c!==null&&railCounts._c.k===badgeKey()");
        v.eval("__zero();");
        const next = vr("(function(){switchTab('sourcing');lateFlush();return __walks;})()");
        ok(k0 !== k1 && warmed && next === 0, "once " + k + " has moved the key and settled, the rail's count is kept against the new key and the next tap walks no book: " + JSON.stringify({ moved: k0 !== k1, warmed, next }));
        v.eval("if(window.__ko)ORD_OPEN=window.__ko;");
      }
    } finally { try { v.close(); } catch (e) { /* best effort */ } }
  }

  /* -------------------------------------------------------------------- R2 */
  const buildSrc = readFileSync(new URL("../tools/build.mjs", import.meta.url), "utf8");
  const arr = /const PWA_BLOCK = (\[[\s\S]*?\n\])\.join\(EOL\);/.exec(buildSrc);
  ok(!!arr, "the build carries the PWA block as a list of lines");
  const block = arr ? new Function("IDTOKEN", "EOL", "return " + arr[1] + ".join(EOL);")("__ID__", "\n") : "";
  const tickSrc = (block.match(/\(function\(\)\{\s*var chip=null,timer=null;[\s\S]*?\n\}\)\(\);/) || [])[0];
  ok(!!tickSrc && tickSrc.includes("function recheck()"), "the shipped freshness block carries the idle re-check");
  if (tickSrc) {
    const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
    const rig = () => {
      const t = { fresh: 0, intervals: [], timeouts: [], listeners: {}, vis: "visible", active: null, sheets: [], fields: [], navopen: false, chips: 0, onLoad: null };
      const doc = {
        get visibilityState() { return t.vis; }, get activeElement() { return t.active; },
        querySelectorAll: (s) => s.includes("textarea") ? t.fields : t.sheets.filter((e) => s.includes(e.kind === "native" ? "dialog[open]" : "[role=\"dialog\"]")),
        addEventListener: (type, fn) => { (t.listeners[type] = t.listeners[type] || []).push(fn); },
        createElement: () => { t.chips++; return { setAttribute() { }, set onclick(f) { } }; },
        body: { appendChild() { }, classList: { contains: (c) => c === "navopen" && t.navopen } },
      };
      const win = { SALT_CLOUD: true, getComputedStyle: (e) => e.style, addEventListener: (type, fn) => { if (type === "load") t.onLoad = fn; } };
      const fetchStub = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "NEWID", v: "v9" }) });
      new Function("window", "document", "fetch", "setInterval", "setTimeout", "location", "navigator", "SALT_REV_MS", "SALT_BUILD_ID", "saltFresh",
        "queue", "qSyncState", "qPost", "qNewestAt", "qSentThrough", "qDirty", tickSrc)(
        win, doc, fetchStub, (f, ms) => { t.intervals.push([f, ms]); return t.intervals.length; }, (f) => { t.timeouts.push(f); return t.timeouts.length; },
        {}, {}, 10000, "OLDID", () => { t.fresh++; }, [], "server", () => { }, () => "", "", false);
      t.start = async () => { t.onLoad(); await flush(); };
      t.twoSeconds = () => t.intervals.filter(([, ms]) => ms === 2000).forEach(([f]) => f());
      t.drain = () => { const q = t.timeouts.splice(0); q.forEach((f) => f()); };
      t.fire = (type) => (t.listeners[type] || []).forEach((f) => f({}));
      return t;
    };
    const INPUT = { tagName: "INPUT" };
    {
      const t = rig(); t.active = INPUT; await t.start();
      for (let i = 0; i < 5; i++) t.twoSeconds();
      ok(t.chips === 1 && t.fresh === 0, "a busy desk (a field focused) is offered the chip and is not reloaded over, however long it waits: " + JSON.stringify({ chips: t.chips, fresh: t.fresh }));
    }
    {
      const t = rig(); t.active = INPUT; await t.start();
      t.active = null; t.fire("focusout"); t.drain();
      const afterOne = t.fresh;
      t.twoSeconds();
      ok(afterOne === 0 && t.fresh === 1, "when the field loses focus the desk loads the new build on the second idle look, not the first: " + JSON.stringify({ afterOne, fresh: t.fresh }));
    }
    {
      const t = rig(); t.active = INPUT; await t.start();
      t.active = null; t.fire("focusout"); t.drain();            /* idle once */
      t.active = INPUT; t.twoSeconds();                           /* focus came back: not idle, the count starts again */
      t.active = null; t.twoSeconds();                            /* idle once */
      const held = t.fresh;
      t.twoSeconds();                                             /* idle twice in a row */
      ok(held === 0 && t.fresh === 1, "a focus that moves from one field to another is never reloaded over: the count restarts at each busy look: " + JSON.stringify({ held, fresh: t.fresh }));
    }
    /* the Desk's sheets are <div role="dialog">, not <dialog>: a sheet holding only buttons has no field to hold the focus */
    const SHEET = { kind: "role", hidden: false, closest: () => null, style: { display: "block", visibility: "visible" } };
    for (const [what, sheets, navopen] of [["a sheet (role=dialog) with only buttons in it", [SHEET], false], ["a native <dialog> that is open", [{ ...SHEET, kind: "native" }], false], ["the rail opened over the page", [], true]]) {
      const t = rig(); t.sheets = sheets; t.navopen = navopen; await t.start();
      for (let i = 0; i < 4; i++) t.twoSeconds();
      const open = t.fresh, chips = t.chips;
      t.sheets = []; t.navopen = false; t.twoSeconds();
      const first = t.fresh; t.twoSeconds();
      ok(open === 0 && chips === 1 && first === 0 && t.fresh === 1, what + " holds the reload however long it stays open, and closing it lets the build through on the second idle look: " + JSON.stringify({ open, chips, first, fresh: t.fresh }));
    }
    for (const [what, sheet] of [["a sheet that is shut (hidden)", { ...SHEET, hidden: true }], ["a sheet inside a hidden holder", { ...SHEET, closest: () => ({}) }],
      ["a sheet with display none", { ...SHEET, style: { display: "none", visibility: "visible" } }], ["a sheet with visibility hidden", { ...SHEET, style: { display: "block", visibility: "hidden" } }]]) {
      const t = rig(); t.sheets = [sheet]; await t.start();
      ok(t.fresh === 1 && t.chips === 0, what + " does not hold the reload: " + JSON.stringify({ chips: t.chips, fresh: t.fresh }));
    }
    {
      const t = rig(); t.active = INPUT; await t.start();
      t.active = null; t.vis = "hidden";
      for (let i = 0; i < 5; i++) t.twoSeconds();
      const hidden = t.fresh;
      t.vis = "visible"; t.twoSeconds(); t.twoSeconds();
      ok(hidden === 0 && t.fresh === 1, "a page that is not on screen is never reloaded; it is once it shows and is idle: " + JSON.stringify({ hidden, fresh: t.fresh }));
    }
    /* a field typed into and left holds no focus, but what is in it is unsent: it holds the reload until it is back to what was drawn */
    const shown = () => [{}], none = () => [];
    const FIELD = (o) => ({ tagName: "INPUT", type: "text", disabled: false, value: "", defaultValue: "", checked: false, defaultChecked: false, getClientRects: shown, ...o });
    const opts = (sel, def) => [0, 1, 2].map((i) => ({ selected: i === sel, defaultSelected: i === def }));
    for (const [what, field, back] of [
      ["a text field typed into and left", FIELD({ value: "21 Oct" }), (x) => { x.value = ""; }],
      ["a restock day typed over the one drawn", FIELD({ type: "date", value: "2026-10-21", defaultValue: "2026-10-20" }), (x) => { x.value = "2026-10-20"; }],
      ["a box ticked", FIELD({ type: "checkbox", checked: true }), (x) => { x.checked = false; }],
      ["a choice changed from the one drawn", { ...FIELD({ tagName: "SELECT", type: "select-one" }), options: opts(2, 1), selectedIndex: 2 }, (x) => { x.selectedIndex = 1; }],
      ["a choice changed where none was drawn as chosen", { ...FIELD({ tagName: "SELECT", type: "select-one" }), options: opts(1, -1), selectedIndex: 1 }, (x) => { x.selectedIndex = 0; }]]) {
      const t = rig(); t.fields = [field]; await t.start();
      t.fire("focusout"); t.drain(); for (let i = 0; i < 4; i++) t.twoSeconds();
      const held = t.fresh, chips = t.chips;
      back(field); t.twoSeconds(); const first = t.fresh; t.twoSeconds();
      ok(held === 0 && chips === 1 && first === 0 && t.fresh === 1, what + " holds the reload with no focus on it, and once it is back to what was drawn the build loads on the second idle look: " + JSON.stringify({ held, chips, first, fresh: t.fresh }));
    }
    for (const [what, field] of [["a typed field that is not shown", FIELD({ value: "x", getClientRects: none })], ["a disabled field", FIELD({ value: "x", disabled: true })],
      ["a hidden input", FIELD({ type: "hidden", value: "x" })], ["an untouched field, a choice at the one drawn and one where none was drawn as chosen",
        [FIELD({ value: "a", defaultValue: "a" }), { ...FIELD({ tagName: "SELECT", type: "select-one" }), options: opts(1, 1), selectedIndex: 1 }, { ...FIELD({ tagName: "SELECT", type: "select-one" }), options: opts(0, -1), selectedIndex: 0 }]]]) {
      const t = rig(); t.fields = [].concat(field); await t.start();
      ok(t.fresh === 1 && t.chips === 0, what + " does not hold the reload: " + JSON.stringify({ chips: t.chips, fresh: t.fresh }));
    }
    {
      const t = rig(); await t.start();
      ok(t.fresh === 1 && t.chips === 0, "an idle desk still loads the new build at once, with no chip: " + JSON.stringify({ chips: t.chips, fresh: t.fresh }));
    }
  }
}
