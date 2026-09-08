/* Monthly statements of account, one per customer, built from the book and the engine.
 *
 * WHERE THE STATEMENT RULES LIVE NOW, AND WHY THAT CHANGED (29 Aug 2026)
 * Until v388 they lived in the desk (stmtRows, stmtRecon, stmtRefunds, stmtDoc), and this
 * tool loaded the desk headlessly and called them, so there was one copy. v388 removed the
 * desk's statement panel and all five functions on his instruction, recorded as uncalled;
 * this tool called four of them, and broke. With the desk's copy gone, the one home of the
 * statement rules is THIS FILE: the four functions below are the desk's own text at v387,
 * lifted verbatim, with exactly two substitutions, each marked where it sits:
 *   - txStat and txDates come from engine/position.mjs, the same module the desk runs, so
 *     every figure on a statement is still the desk's own arithmetic and cannot drift;
 *   - the who-line is codes-only, because the desk-era useName option read the laptop's
 *     plaintext directory, which never reaches this repo.
 * What lives here alone is the statement's own law: what a customer may see and how the
 * document reads. Nothing else in the repo states it, so this is one copy, not a second.
 * IF THE DESK EVER REGAINS A STATEMENTS PANEL, inline this file the way tools/engine.mjs
 * inlines the engines, so it goes back to being one copy there too.
 *
 *   node tools/make_statements.mjs <outDir> [YYYY-MM-DD issue date]
 *
 * No dependencies: plain node, no jsdom, no network. It writes one file per customer who
 * has anything to show, named by code so the folder sorts alphabetically, plus the review
 * sheet. SALT_BOOK overrides the book path, which is how the tests run it on copies.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { statementCss, REVIEW_CSS } from "./stmt-style.mjs";
import { qrSvg } from "./qr.mjs";
import { sendSheet } from "./stmt-send.mjs";
import { newPassword, newUsername, USERNAME_RE, makeVerifier, contentKey, wrapKey, encryptWith, decryptWith } from "./stmt-crypto.mjs";
import { priceList } from "./pricelist.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOK = process.env.SALT_BOOK || resolve(REPO, "ledger", "book.json");
/* WHERE A SCANNED CODE LANDS: the statements site, NOT the desk's address (his instruction,
   03 Sep 2026). It is READ OUT OF wrangler.stmt.jsonc rather than restated here, because a QR is
   printed on paper and handed over: get the two out of step and thirty-seven codes point at a
   hostname that answers nothing, with every check green and the paper already in customers' hands.
   That is not hypothetical, it is what had just happened to /s/ one rename earlier. The account's
   workers.dev subdomain cannot be read from the config, so it stays here; SALT_BASE_URL overrides
   the whole address for a rehearsal or once a custom domain exists. */
const WORKERS_SUBDOMAIN = "qyts8mh72kyg";
export function siteBaseUrl() {
  if (process.env.SALT_BASE_URL) return process.env.SALT_BASE_URL.replace(/\/+$/, "");
  const cfg = readFileSync(resolve(REPO, "wrangler.stmt.jsonc"), "utf8");
  const m = /^\s*"name"\s*:\s*"([^"]+)"/m.exec(cfg);
  if (!m) throw new Error("wrangler.stmt.jsonc names no Worker, so no statement address can be built");
  return "https://" + m[1] + "." + WORKERS_SUBDOMAIN + ".workers.dev";
}
const BASE_URL = siteBaseUrl();
const book = JSON.parse(readFileSync(BOOK, "utf8"));

/* the desk globals the lifted functions read, bound to the same sources the desk binds
   them to: the book's own declarations, and the position engine's own functions */
const sales = book.sales;
const customerRefunds = book.customerRefunds || [];
const { txStat, txDates } = POSITION_ENGINE;
const esc = x => ('' + (x == null ? '' : x)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const codeOf = n => n; /* the desk's codeOf is newIds[n]||n and newIds is {} post-rekey: identity */

/* ============ STATEMENT OF ACCOUNT (v183) ============
   A customer asked for his own record, so the desk can now hand one over. This is the
   only artefact that leaves the desk describing a NAMED party's dealings, and the whole
   design is about what it must NOT contain.

   THE RULE: STRUCTURED FACTS ONLY, NEVER THE SELLER'S PROSE.
   Every note in this ledger is written for him, not for the buyer, and several are about
   his own bookkeeping: "recorded as 9.47 delivered in error", "the RM200 booked as
   received was NEVER PAID", "delivery audit", "account audit". None of that is the
   customer's business, and no filter over free text is safe enough to be trusted with
   it. So the statement is BUILT rather than copied: date, quantity, unit price, total,
   what was paid and when, what was collected and when, what remains. Nothing else.

   NEVER LEAVES THE DESK, at any setting:
     cost, margin, margin %       what the salt cost and what it earned
     shrinkage, replacement cost  the desk's own economics
     tier names, floors, cards    the pricing structure behind the number he paid
     any other party              codes, names, or the fact that they exist
     internal notes and audits    every free-text field on the order
   A test greps a generated statement for each of these before it can be trusted.

   WHAT HE ALREADY KNOWS, and therefore may have: what he ordered, what he agreed to
   pay, what he handed over and when, what he collected and when, and what is still
   between them. A settlement in kind is included because he agreed to it, but stated as
   an amount and a date rather than with the reasoning that sits behind it here. */
function stmtRows(party,o){
  o=o||{};
  const from=o.from?new Date(o.from):null, to=o.to?new Date(o.to):null;
  return sales.filter(s=>s.customer===party).filter(s=>{
    const d=new Date(s.date);
    const st=txStat(s).order;
    /* A PENDING ORDER IGNORES THE DATE WINDOW (v194). It is an open commitment, not an
       event in a period, and it is still open on the day the statement is issued whatever
       date sits on it. Leaving it to the window made inclusion arbitrary: CA5-KER's
       pending order is dated 28 Jul so it appeared, CI4-OKR's is dated 03 Aug so the
       02 Aug cut-off silently dropped it, and two customers in the same position got
       different statements for no reason either of them could see. An order the customer
       agreed to and has not yet acted on belongs on his statement, full stop. */
    if(st!=='Pending'){
      if(from&&d<from)return false;
      if(to&&d>to)return false;
    }
    if(st==='Pending'&&!o.pending)return false;
    if(st==='Completed'&&!o.completed)return false;
    if(st!=='Pending'&&st!=='Completed'&&!o.open)return false;
    return true;
  })
  /* UNDATED ROWS SORT LAST, they do not sort at random (02 Sep 2026). A row may carry no
     date: three do on the book today, two cancelled and one live. new Date(undefined) is an
     Invalid Date and every comparison with it yields NaN, so the comparator is inconsistent
     and where those rows land is left to the sort implementation, which means the same book
     can print two different orderings. tools/sort-ledger.mjs puts undated pending rows last
     for the same reason; this agrees with it. */
  .sort((a,b)=>{
    const ta=a.date?new Date(a.date).getTime():NaN, tb=b.date?new Date(b.date).getTime():NaN;
    const na=isNaN(ta), nb=isNaN(tb);
    if(na&&nb)return 0;
    if(na)return 1;
    if(nb)return -1;
    return ta-tb;
  }).map(s=>{
    const st=txStat(s), d=txDates(s);
    const paidCash=+(s.cash||0), inKind=+(s.settledRM||0);
    const got=+(s.deliveredQty||0), inKindUnits=+(s.settledKg||0);
    const owed=+(s.total-paidCash-inKind).toFixed(2);
    /* a cross-reference is included ONLY when it points at another of HIS OWN orders;
       anything pointing elsewhere is another party's business and is dropped */
    const links=[];
    (s.amend||[]).forEach(a=>{
      (a.refKeys||[]).forEach(k=>{
        const m=/^([^|]+)\|([^|]+)\|/.exec(k||'');
        if(m&&m[1]===party)links.push(m[2]);
      });
    });
    /* A GIFT MUST NOT READ AS A CHARGE (v187). Goodwill salt is booked in-kind at a
       value so it does not fall out of the ledger as shrinkage, but the customer never
       owed that money and showing him an amount he did not pay invites the exact
       question the statement exists to prevent. So it carries nil and says why. */
    /* v432, ROUND TEN: A GIFT IS A ROW THE CUSTOMER PAID NOTHING FOR, and the rebate flag alone
       does not say that. It says the order was settled by redeeming an award, and an award can
       settle PART of an order: three live rows are part cash and part award, s025 at RM 17 against
       RM 107, s053 at RM 90 against RM 180, s068 at RM 160 against RM 240. Reading the flag as "the
       whole row was free" printed each of them as nil and "no charge", and dropped BOTH the charge
       and the customer's own cash out of the footer: RM 527 of charges and RM 267 of money they had
       actually paid, on statements that go to them. CI4-OKR's document said an order he paid RM 90
       for was free.
       AND goodwill IS THE OTHER HALF OF THE SAME RULE. It is a separate flag in the engine's own
       correctable table, the walk drops those rows from revenue, and the editor's hint says
       "excluded from revenue everywhere"; the tool read only rebate, so a goodwill gift with no
       rebate beside it would have been billed at full value. The only goodwill row on the book
       today carries rebate as well, which is what has been hiding it. */
    /* 08 Sep 2026: A GIFT OWES NOTHING, and a rebate row is a gift only when nothing is owed on it.
       The flag plus "no cash" made the row print "no charge" while its unsettled value still went
       into Outstanding: a goodwill unit with nothing booked in kind read "nil ... Outstanding 100".
       Goodwill is out of the priced set by definition; a rebate row with a balance prints its
       charge and the balance due, as v432 intended. */
    const gift=!!s.goodwill||(!!s.rebate&&paidCash<=0.009&&owed<=0.009);
    /* v432: THE ROW CARRIES ITS OWN rid. Nothing on the document prints it, but without it a
       statement row cannot be traced back to the book row it came from, and any check over these
       figures has to match on party, date and quantity: CH4-MLR has two orders on 14 August of one
       unit each, RM 110 and RM 11.50, so that match is ambiguous on this very book and the first
       assertion written over it reported a correct statement as wrong. */
    return {rid:s.rid||null,gift:gift,date:s.date,qty:s.qty,total:gift?0:s.total,
      unit:s.qty>0?+((s.total-(+s.delivery||0))/s.qty).toFixed(2):0,delivery:+(s.delivery||0),   /* v502: the rate is on the goods */
      paidCash:paidCash,inKind:inKind,got:got,inKindUnits:inKindUnits,
      /* PENDING COUNTS NOWHERE, on a statement as everywhere else (v189). An order
         agreed with nothing paid and nothing collected is an intention, not a debt, and
         showing its value as OUTSTANDING would tell a customer he owes money for salt he
         has never received. The desk has run on that rule since v111; the statement was
         quietly breaking it, and these go out to people. */
      owed:(st.order==='Pending'||st.order==='Cancelled'||gift)?0:(owed>0.009?owed:0),
      pendingOrder:st.order==='Pending',
      /* A CANCELLED ORDER IS NOT A BILL (v193). txStat has returned 'Cancelled' since
         long before statements existed, and stmtRows simply never asked. So CC5-OKR's
         20 Jul order -- agreed at RM90, cancelled the next day with nothing moved either
         way, and carrying the note "counts nowhere" -- came out of the statement builder
         as RM90 outstanding and 1 unit owed. It stays on the page, because he agreed to
         it and remembers it, and a statement that silently drops it invites the question
         it exists to answer. But it counts in nothing. */
      cancelled:st.order==='Cancelled',
      /* v433, ROUND TEN: THE BOOK STORES THIS DATE IN TWO PLACES AND THE TOOL READ ONE. A row
         cancelled through the amendment trail carries a Cancellation step; a row cancelled by a
         Correction carries a top-level cancelledOn and no trail at all. Three of the five cancelled
         rows on the book are the second kind, and two of those carry no order date either, so the
         customer received a struck-through quantity, an amount and the bare word cancelled against
         an order he had no way to identify. The trail wins where both exist, because a folded step
         is the event and the field is the summary of it. */
      cancelledOn:(st.order==='Cancelled'
        ? (((s.amend||[]).filter(a=>a.kind==='Cancellation')[0]||{}).date||s.cancelledOn||null) : null),
      /* AGREED ON IS EXPOSED BECAUSE AN UNDATED PENDING ROW HAS NO OTHER DATE (his ruling,
         1 Sep 2026). It is not a substitute for `date` and must not be used as one: on
         three of its four rows on the book it sits beside `date` and equals it, so it is
         its own fact rather than a fallback. Only the date CELL of an undated row reads
         it, and only because such a row otherwise reaches a customer with no date at all. */
      agreedOn:s.agreedOn||null,
      /* WHAT HE IS OWED IN SALT, which is the figure a dispute actually turns on.
         deliverable = ordered LESS anything withheld by agreement to settle an earlier
         balance; toGet = deliverable LESS what he has already carried away. */
      deliverable:+(s.qty-inKindUnits).toFixed(4),
      toGet:+(s.qty-got-inKindUnits).toFixed(4),
      paidOn:d.pOn||null,gotOn:d.dOn||null,
      state:gift?'No charge'
            :st.order==='Pending'?'Agreed, nothing moved yet'
            :(owed>0.009?'Balance outstanding'
              :(+(s.qty-got-inKindUnits).toFixed(4)>0.009?'Paid in full'
                :'Settled')),
      links:[...new Set(links)]};
  });
}
/* ============ THE RECONCILIATION (v186) ============
   A statement that states a figure is no use in a dispute; one that SHOWS how the figure
   was reached settles it. When salt has been withheld to clear an earlier money balance,
   the customer cannot check the result without seeing the whole chain: which orders were
   short, by how much, what those shortfalls came to, and the rate at which that money was
   turned into salt.
   So this reconstructs it from the ledger rather than from anyone's memory. The Linked
   step carries refKeys pointing at the orders it settled; each of those is read for what
   was billed and what was actually paid, and the difference is the shortfall. The rate is
   then derived by division rather than quoted, so it cannot disagree with the figures
   above it.
   IT REVEALS THE UNIT RATE, and that is a deliberate reversal of v184. You cannot prove a
   conversion from money into goods without naming the rate used. It appears ONLY inside a
   reconciliation, only for the order that carries the offset, and it is his own rate. */
function stmtRecon(party,rows){
  const out=[];
  sales.filter(s=>s.customer===party&&(s.settledKg||0)>0.0001).forEach(s=>{
    const unitsOff=+s.settledKg;
    const keys=[];
    (s.amend||[]).forEach(a=>{(a.refKeys||[]).forEach(k=>{if(k&&k.indexOf(party+'|')===0)keys.push(k);});});
    const legs=[...new Set(keys)].map(k=>{
      const t=sales.find(x=>x.customer+'|'+x.date+'|'+x.total===k);
      if(!t)return null;
      const billed=+t.total, paidCash=+(t.cash||0);
      /* v455: THE SHORTFALL IS READ FROM A FIELD THE SETTLEMENT HAS ALREADY FILLED. The fold
         credits an in-kind settlement INTO the leg's cash, as a Fulfilment step carrying `ref` to
         the order that settled it: s003 holds cash 600 with a step of RM 50 ref 15 Jul order. So by
         statement time billed less cash is 0 on every settled leg, the table printed Short 0.00
         twice, Carried forward 0.00 and 0.00 at 0.00 a unit, and noLegs did not fire because the
         legs existed. The shortfall the walk explains is what those steps credited; a leg with no
         such step is still unpaid and reads billed less cash as before. Paid in cash is then what
         was paid in money, which is the figure the column names. */
      const settledHere=+(t.amend||[]).filter(a=>a.ref&&+a.cash>0.009).reduce((a,x)=>a+(+x.cash),0).toFixed(2);
      const short=settledHere>0.009?settledHere:+(billed-paidCash).toFixed(2);
      return {date:t.date,qty:t.qty,billed:billed,paid:+(billed-short).toFixed(2),short:short};
    }).filter(Boolean).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const shortTot=+legs.reduce((a,x)=>a+x.short,0).toFixed(2);
    const rate=unitsOff>0?+(shortTot/unitsOff).toFixed(2):0;
    const collected=+(s.deliveredQty||0);
    /* NOT EVERY OFFSET IS AGAINST AN EARLIER ORDER (v192). This walk was written for
       the case where salt was withheld to clear unpaid balances on previous SALES, and
       it assumes those sales exist. CS6-PER's 6.5 unit went against a cash advance,
       which is not in the sales ledger at all, so the walk found no legs and printed a
       table of zeros: "carried forward 0.00", "0.00 at 0.00 a unit is 6.5 unit". That
       is not merely ugly, it is unintelligible, and it was in a file about to be sent.
       So the no-leg case is flagged here and told plainly rather than tabulated. */
    out.push({order:{date:s.date,qty:s.qty,total:s.total,paid:+(s.cash||0)},
      noLegs:legs.length===0||shortTot<=0.009,   // v455: legs that carry no shortfall explain nothing, and are told plainly
      legs:legs,shortTot:shortTot,unitsOff:unitsOff,rate:rate,
      deliverable:+(s.qty-unitsOff).toFixed(4),
      collected:collected,
      owed:+(s.qty-unitsOff-collected).toFixed(4),
      payments:(s.amend||[]).filter(a=>+a.cash>0.009).map(a=>({date:a.date,rm:+a.cash}))});
  });
  return out;
}
/* A REFUND IS SOMETHING HE KNOWS ABOUT (v188), and the statement had no line for it.
   If he overpaid and money came back, that is his record as much as any order, and a
   statement that omits it is incomplete in the one direction that favours the seller. */
function stmtRefunds(party,o){
  o=o||{};
  const from=o.from?new Date(o.from):null, to=o.to?new Date(o.to):null;
  return (typeof customerRefunds!=='undefined'?customerRefunds:[])
    .filter(r=>r.party===party)
    .filter(r=>{const d=new Date(r.since);
      if(from&&d<from)return false; if(to&&d>to)return false; return true;})
        /* v454: WHICH KIND OF REFUND. v444 books a cancelled paid order as a payable in this same
       list, so the document has to say which it is printing: the two live rows are overpayments
       and the label was fixed text. The record carries the cancelled row's rid, and the note
       names it; either says cancelled. */
    .map(r=>({date:r.since,amount:+r.amount,paidOn:r.paidOn||null,
      cancelled:!!((r.rid&&sales.some(s=>s.rid===r.rid&&s.cancelled))||/^cancelled order/.test(r.note||''))}));
}
function stmtDoc(party,rows,o){
  /* LESS, AND BETTER LOOKING (v184). The first cut carried a price-per-unit column and a
     running prose commentary on every line: paid this, collected that, settled together
     with the order of such a date. All of it was true and none of it was wanted. A
     customer opening this wants three things -- WHAT he took, WHEN, and HOW MUCH -- and
     every extra column asks him to work out which ones matter.
     The unit price is gone with the rest. It told him nothing he did not know and it
     made his own rate legible in a single portable document, which is the sort of thing
     that ends up beside another buyer's. Totals say what he paid; the arithmetic behind
     them is his to do if he wants it. */
  const e=esc, n2=v=>Number(v).toLocaleString('en-MY',{maximumFractionDigits:2});
  const money=v=>Number(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const refundOwed=(o.refunds||[]).filter(r=>!r.paidOn).reduce((a,r)=>a+(+r.amount||0),0);   // v454
  /* AN UNDATED ROW PRINTS AN EMPTY CELL, NOT "Invalid Date" (29 Aug 2026, the one
     behavioural change from the v387 text). The book now carries undated rows (a
     cancelled order with no action date, an agreed order not yet moved), and the v387
     formatter pushed "Invalid Date" onto a document meant for a customer. The state
     column already says what such a row is; the date cell stays quiet. Whether it
     should instead show the row's cancelledOn or agreedOn is his call, not made here. */
  const dLong=d=>{try{const t=new Date(d);if(!d||isNaN(t))return '';return t.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch(x){return d;}};
  /* CODES ONLY, ALWAYS: the one substitution in this lifted block. The desk-era useName
     option read the laptop's plaintext directory, which never reaches this repo (hard
     rule 2), so the path is removed rather than parameterised: a statement built here
     cannot carry a real name because nothing here holds one. */
  const who=codeOf(party);
  const T={qty:0,total:0,paid:0,owed:0};
  T.toGet=0;T.kindUnits=0;T.got=0;T.ordered=0;
  /* a GIFT is not a payment. Its in-kind value exists so the salt does not fall out of
     the ledger as shrinkage; counting it here made Paid exceed the total ordered, which
     is the one arithmetic a reader would certainly catch. */
  T.pendQty=0;T.pendVal=0;T.pendN=0;
  T.cxN=0;T.cxPaid=0;
  rows.forEach(r=>{
    /* a cancelled order contributes NOTHING: not quantity, not value, not the count of
       orders. Anything else makes the footer disagree with the word "cancelled". */
    /* v454: EXCEPT THE MONEY THEY PAID ON IT, which is real and is theirs. Dropping the row whole
       told a customer who had paid RM 450 for an order later cancelled that they had paid RM 450
       less than they had, and said Balance nil beneath a refund still owed to them. Paid is what
       they handed over; the cancelled part is named on its own line, and the refund the engine
       booked at v444 is stated as Owed to you rather than left to the Refunds table alone. */
    if(r.cancelled){T.cxN++;T.cxPaid+=r.gift?0:(r.paidCash+r.inKind);T.paid+=r.gift?0:(r.paidCash+r.inKind);return;}
    if(r.pendingOrder){T.pendQty+=r.qty;T.pendVal+=r.total;T.pendN++;}
    T.qty+=r.qty;T.total+=r.total;T.paid+=r.gift?0:(r.paidCash+r.inKind);T.owed+=r.owed;
    T.toGet+=(r.toGet>0&&!r.pendingOrder)?r.toGet:0;T.kindUnits+=r.gift?0:r.inKindUnits;T.got+=r.got;T.ordered+=r.qty;});
  /* the row label has to agree with the walk printed below it. Where the offset went
     against a separate arrangement rather than an unpaid earlier order, calling it an
     "earlier balance" contradicts the explanation three inches further down the page. */
  const noLegDates=new Set((o.recon||[]).filter(R=>R.noLegs).map(R=>R.order.date));
  const body=rows.map(r=>{
    const due=r.owed>0.009;
    const when=(o.dates&&r.paidOn&&r.paidOn!==r.date)?'<div class="sub2">paid '+e(dLong(r.paidOn))+'</div>':'';
    /* THE DATE CELL OF AN UNDATED ROW CARRIES THE DATE THE ROW DOES HAVE (his ruling,
       1 Sep 2026). Three rows on the book carry no `date`: two cancelled, one agreed and
       not yet actioned. Until 29 Aug that cell printed "Invalid Date" on a document sent
       to a customer; it then printed nothing, which is honest and still leaves CY2-NIL
       reading an order with NO DATE ANYWHERE ON THE ROW, because a pending row's status
       says only "ordered".
       IT IS MARKED, because a bare date in that column reads as the date the order was
       placed and this is not that: it is when the order was cancelled, or when it was
       agreed. The word travels with the date for exactly that reason.
       AND IT IS NOT PRINTED TWICE. A cancelled row already carries its cancellation date
       under the status word, so where the date has moved into the cell the sub-line goes:
       the same date stated twice in one row invites the reader to look for the difference
       between them. A row that HAS a `date` is untouched, sub-line and all. */
    const moved=!r.date?(r.cancelled&&r.cancelledOn?'cancelled '+e(dLong(r.cancelledOn))
                        :(r.pendingOrder&&r.agreedOn?'agreed '+e(dLong(r.agreedOn)):'')):'';
    /* nor is it goods owed: nothing has been paid for, so nothing is being withheld */
    const owedUnits=r.toGet>0.009&&!r.pendingOrder;
    let stat;
    /* "no charge" and not "goodwill": the same flag covers a gift AND a reseller's
       EARNED reward, and calling an earned reward a gift misdescribes it to the one
       person who knows better. The customer knows which of the two his was. */
    if(r.cancelled)stat='<span class="cx">cancelled</span>'
      +((r.cancelledOn&&!moved)?'<div class="owedunits">'+e(dLong(r.cancelledOn))+'</div>':'')
      +((r.paidCash+r.inKind)>0.009?'<div class="owedunits">'+money(r.paidCash+r.inKind)+' paid, see Refunds</div>':'');
    else if(r.gift)stat='<span class="gift">no charge</span>';
    /* AN AGREED ORDER IS NOT A SETTLED ONE (v189). Nothing has been paid and nothing
       collected, so it is neither a debt nor a closed line. It still belongs on the
       statement, because he agreed to it and will be asked for the money in due course,
       but it must read as what it is: outstanding on BOTH sides, owing nothing yet. */
    else if(r.pendingOrder)stat='<span class="pend">ordered</span>'
      +'<div class="owedunits">to be collected and paid</div>';
    else if(due)stat='<span class="due">'+money(r.owed)+' due</span>';
    else if(owedUnits)stat='<span class="ok">paid in full</span><div class="owedunits">'+n2(r.toGet)+' unit still to collect</div>';
    else stat='<span class="ok">settled</span>';
    return '<tr>'
      +'<td class="l dt">'+(r.date?e(dLong(r.date)):(moved?'<span class="nodt">'+moved+'</span>':''))+when+'</td>'
      +'<td class="q'+(r.cancelled?' cxr':'')+'">'+n2(r.qty)+'<span class="u">unit</span>'
        +(r.inKindUnits>0.009?'<div class="sub2">'+n2(r.inKindUnits)+' unit applied '
          +(noLegDates.has(r.date)?'by agreement':'to an earlier balance')+'</div>':'')
        +'</td>'
      +'<td class="amt'+(r.cancelled?' cxr':'')+'">'+(r.gift?'<span class="nilamt">nil</span>':money(r.total))
        +(r.delivery>0.009?'<div class="sub2">incl. delivery '+money(r.delivery)+'</div>':'')+'</td>'
      +'<td class="r">'+stat+'</td></tr>';
  }).join('');
  return ['<!DOCTYPE html>','<html lang="en"><head><meta charset="utf-8">',
   '<meta name="viewport" content="width=device-width,initial-scale=1">',
   '<meta name="robots" content="noindex,nofollow">',
   '<title>Statement of account</title>','<style>',
   /* THE STATEMENT IN THE SALT IDENTITY (02 Sep 2026). v472 put the design system onto the
      desk and left this document behind, still in the pre-identity hexes. The stylesheet is
      now one shared string built on design/salt-ds.css own :root, so a retune of the system
      reaches the statement, the review sheet and the unlock page with nothing to keep in
      step by hand. See tools/stmt-style.mjs, including why the three semantic colours are
      read from the customer side here and not the desk s. */
   statementCss(),
   '</style></head><body><div class="w">',
   '<p class="eyebrow">'+e(o.brand||'Salt Command')+'</p>',
   '<h1>Statement of account</h1>',
   /* the period line has to survive the reader checking it against the rows. Once a
      pending order can sit outside the window, a statement headed "to 02 Aug" can carry
      a line dated 03 Aug, and saying nothing about that is the sort of small
      contradiction that costs more trust than the figure it hides. */
   /* A BACK-ISSUE MUST NOT CLAIM A CUT-OFF IT DOES NOT HONOUR (02 Sep 2026). The book stores
      CURRENT state with an amendment trail, not a snapshot, so a back-dated run filters rows by
      their ORDER date and then shows each one as it stands TODAY. On the 1 Aug archive that put
      a payment dated 6 Aug and a cancellation dated 24 Aug under a heading reading "to 01 Aug
      2026", on six of twenty-six documents. That is the v194 fault again: a statement headed to
      one date carrying a line dated after it is the small contradiction that costs more trust
      than the figure it hides. Reconstructing the true position as at a past date would need an
      event-sourced book, which this is not, so the archive states what it actually is instead. */
   /* A LIVE STATEMENT SAYS IT IS ONE (03 Sep 2026, his instruction). It is written again by
      the deploy after every fold, so it covers every entry from the start to the moment it was
      written, and the moment is printed to the minute so a reader can tell two of them apart. */
   (o.live
     ? '<p class="meta">Live statement &middot; as at '+e(o.issued)+' &middot; every entry from the beginning to today, '
       +'updated whenever an entry is approved</p>'
     : '<p class="meta">Issued '+e(o.issued)+
     (o.archive
       ? ' &middot; every order placed up to '+e(dLong(o.to))+', shown as the account stands today'
       : (o.from||o.to?' &middot; '+e(o.from?dLong(o.from):'from the beginning')+' to '+e(o.to?dLong(o.to):'today')
         +(T.pendN&&rows.some(r=>r.pendingOrder&&o.to&&new Date(r.date)>new Date(o.to))
            ?', plus any order agreed and not yet actioned':''):''))+'</p>'),
   '<p class="whol gap1">Account</p>',
   '<div class="who">'+e(who)+'</div>',
   '<div class="rule"></div>',
   rows.length?('<table><thead><tr><th class="l">Date</th><th>Quantity</th><th>Amount</th><th class="r">Status</th></tr></thead>'
     +'<tbody>'+body+'</tbody></table>')
     :'<p class="meta">No orders in this period.</p>',
   ((o.refunds||[]).length?'<p class="whol gap2">Refunds</p>'
     +'<table class="rft"><thead><tr><th class="l">Date</th><th class="l">Reason</th><th>Amount</th><th class="r">Status</th></tr></thead><tbody>'
     +o.refunds.map(r=>'<tr><td class="l dt">'+e(dLong(r.date))+'</td>'
       +'<td class="l rsn">'+(r.cancelled?'Cancelled order, money returned to you':'Overpayment returned to you')+'</td>'
       +'<td class="amt">'+money(r.amount)+'</td>'
       +'<td class="r">'+(r.paidOn?'<span class="ok">paid '+e(dLong(r.paidOn))+'</span>'
                                  :'<span class="due">owed to you</span>')+'</td></tr>').join('')
     +'</tbody></table>':''),
   '<div class="tot">',
   /* the count must match what was actually totalled, or the footer says three orders
      over a figure covering two, which is the first thing a careful reader checks */
   '<div class="tr"><span>'+(rows.length-T.cxN)+' order'+((rows.length-T.cxN)===1?'':'s')
     +', '+n2(T.qty)+' unit'
     +(T.cxN?'<span class="cxn"> &middot; '+T.cxN+' cancelled, not counted</span>':'')
     +'</span><span>'+money(T.total)+'</span></div>',
   '<div class="tr"><span>Paid</span><span>'+money(T.paid)+'</span></div>',
   (T.cxPaid>0.009?'<div class="tr sub"><span>of which on cancelled orders</span><span>'+money(T.cxPaid)+'</span></div>':''),
   /* say plainly which part of the total has not happened yet, so the ordered figure
      and the paid figure can be reconciled without him having to ask why they differ */
   (T.pendN?'<div class="tr sub"><span>of which not yet collected or paid</span><span>'
      +money(T.pendVal)+'</span></div>':''),
   '<div class="tr big'+(T.owed>0.009?'':' clear')+'"><span>'+(T.owed>0.009?'Outstanding':'Balance')+'</span><span>'
     +(T.owed>0.009?money(T.owed):'nil')+'</span></div>',
   (refundOwed>0.009?'<div class="tr big"><span>Owed to you</span><span>'+money(refundOwed)+'</span></div>':''),
   '</div>',
   /* GOODS OWED GET THEIR OWN BLOCK. A statement whose only large figure is money can
      read as though nothing else is outstanding, which is exactly the misreading a
      dispute about undelivered salt would turn on. */
   (T.toGet>0.009?'<div class="owed"><p class="owedl">Still to collect</p>'
     +'<p class="owedv">'+n2(T.toGet)+' <span>unit</span></p></div>':''),
   /* THE WORKINGS, step by step, so nothing has to be taken on trust */
   (o.recon||[]).map(R=>{
     let st=0;
     const step=(t,b)=>'<div class="stp"><div class="stpn">'+(++st)+'</div><div class="stpb">'
       +'<p class="stpt">'+t+'</p>'+(b?'<p class="stpd">'+b+'</p>':'')+'</div></div>';
     const legRows=R.legs.map(l=>'<tr><td class="l">'+e(dLong(l.date))+'</td><td>'+n2(l.qty)+' unit</td>'
       +'<td>'+money(l.billed)+'</td><td>'+money(l.paid)+'</td>'
       +'<td class="r"><b class="short">'+money(l.short)+'</b></td></tr>').join('');
     /* v458: THE PAYMENT LIST IS A NARRATIVE BESIDE THE FIGURE, NEVER ITS SOURCE. The dated list is
        read off the amend trail, and v363 lets a Correction set the row's cash directly while the
        trail stays as it was written, so the steps can add up to money the order never carried:
        s018 holds cash 710 after its audit with steps of 650 and 200 beside it. The dated list is
        printed only when it sums to what the row says was paid; otherwise the row's figure alone. */
     const stepSum=+R.payments.reduce((a,x)=>a+x.rm,0).toFixed(2);
     const pays=(R.payments.length&&Math.abs(stepSum-R.order.paid)<=0.009)?R.payments.map(x=>money(x.rm)+' on '+e(dLong(x.date))).join(', ')
                              :money(R.order.paid);
     /* once the salt has gone out the reconciliation is no longer a claim but a record,
        and titling it "how the 0 unit is arrived at" would be nonsense. It is kept
        either way, because the proof is worth more after a dispute than during one. */
     /* the plain-language version, used when there are no earlier orders to show.
        It states only what he already knows: what he ordered, what he paid, what he
        took and what was held back by agreement. It does not name the arrangement the
        salt went against, because a statement is not the place to restate a private
        settlement, and it invites the question instead. */
     if(R.noLegs){
       const gone=R.unitsOff, took=R.collected;
       return '<div class="rec"><p class="recl">How your '+e(dLong(R.order.date))+' order was settled</p>'
         +step('The order was paid in full.',
               n2(R.order.qty)+' unit at '+money(R.order.total/R.order.qty)+' a unit is '
               +money(R.order.total)+', received as '+pays+'.')
         +step('Part of it was not handed over, by agreement.',
               '<b>'+n2(gone)+' unit</b> of that order was held back and applied to a separate '
               +'arrangement between us, rather than being collected or refunded. No money '
               +'changed hands on it.')
         +step(R.owed>0.009?'So the salt still due to you is what is left.'
                           :'So the balance of the order was collected in full.',
               '<table class="mini calc"><tbody>'
               +'<tr><td class="l">Bought</td><td class="r">'+n2(R.order.qty)+' unit</td></tr>'
               +'<tr><td class="l">Less applied by agreement</td><td class="r">&minus; '+n2(gone)+' unit</td></tr>'
               +'<tr class="sub"><td class="l">Deliverable</td><td class="r">'+n2(R.deliverable)+' unit</td></tr>'
               +'<tr><td class="l">Less already collected</td><td class="r">&minus; '+n2(took)+' unit</td></tr>'
               +'<tr class="tot"><td class="l">'+(R.owed>0.009?'Still to collect':'Collected in full, nothing outstanding')
               +'</td><td class="r">'+n2(R.owed)+' unit</td></tr>'
               +'</tbody></table>')
         +'<p class="recn">If your own record of that arrangement differs from this, say so '
         +'and it will be gone through line by line.</p></div>';
     }
     return '<div class="rec"><p class="recl">'+(R.owed>0.009
        ?'How the '+n2(R.owed)+' unit is arrived at'
        :'How your '+e(dLong(R.order.date))+' order was settled')+'</p>'
       +step('Earlier orders were not paid in full.',
             '<table class="mini"><thead><tr><th class="l">Order</th><th>Quantity</th><th>Billed</th><th>Paid in cash</th><th class="r">Short</th></tr></thead><tbody>'
             +legRows+'<tr class="tot"><td class="l" colspan="4">Carried forward</td><td class="r"><b class="short">'
             +money(R.shortTot)+'</b></td></tr></tbody></table>')
       +step('That '+money(R.shortTot)+' was settled out of your order of '+e(dLong(R.order.date))+', in salt rather than cash.',
             money(R.shortTot)+' at '+money(R.rate)+' a unit is <b>'+n2(R.unitsOff)+' unit</b>, withheld from that order by agreement. No money changed hands and that salt stayed on the shelf.')
       +step('The '+e(dLong(R.order.date))+' order itself is paid in full.',
             n2(R.order.qty)+' unit at '+money(R.order.total/R.order.qty)+' a unit is '+money(R.order.total)+', received as '+pays+'.')
       +step(R.owed>0.009
             ?'So the salt due to you is what you bought, less what settled the balance, less what you have taken.'
             :'So the salt due to you was what you bought, less what settled the balance, less what you had already taken. All of it has since been handed over.',
             '<table class="mini calc"><tbody>'
             +'<tr><td class="l">Bought</td><td class="r">'+n2(R.order.qty)+' unit</td></tr>'
             +'<tr><td class="l">Less applied to the '+money(R.shortTot)+' balance</td><td class="r">&minus; '+n2(R.unitsOff)+' unit</td></tr>'
             +'<tr class="sub"><td class="l">Deliverable</td><td class="r">'+n2(R.deliverable)+' unit</td></tr>'
             +'<tr><td class="l">Less already collected</td><td class="r">&minus; '+n2(R.collected)+' unit</td></tr>'
             +'<tr class="tot"><td class="l">'+(R.owed>0.009?'Still to collect':'Collected in full, nothing outstanding')+'</td><td class="r">'+n2(R.owed)+' unit</td></tr>'
             +'</tbody></table>')
       /* the one contradiction a careful reader would otherwise find, answered before he
          finds it: those orders read as settled above yet show short here */
       +'<p class="recn">'+R.legs.map(l=>e(dLong(l.date))).join(' and ')
       +' show as settled at the top of this statement because that balance was cleared '
       +'here, in salt, rather than in cash. Nothing about them is still owed in money.</p>'
       +'</div>';}).join(''),
   '<p class="note">Amounts in ringgit. This statement covers your own orders only, taken from the seller&rsquo;s records as at the issue date. If anything differs from your own, say so and it will be checked.</p>',
   '</div></body></html>'].join('\n');
}

export { stmtRows, stmtRecon, stmtRefunds, stmtDoc };

/* ---- the run -------------------------------------------------------------------
   Ported from the retired make_statements.cjs: the same options, the same totals, the
   same files and the same review sheet, minus the jsdom drive of a desk that no longer
   carries the functions. */
/* ---- the username, the record, and the history --------------------------------------
   THE USERNAME IS NOT THE CODE (his instruction, 03 Sep 2026). statements/_users.json maps each
   desk code to a random username minted the first time that customer is issued a statement and
   kept for life, so a new name on the roster gets a username the month it first appears and an
   old one never changes. It is committed: a username is an address, not a secret, and the
   passwords beside it are what stay out of the repository. It sits beside the month folders,
   because it belongs to every issue rather than to one. */
const longDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function usersFileFor(outDir) {
  if (process.env.SALT_USERS_FILE) return process.env.SALT_USERS_FILE;
  const here = resolve(outDir);
  /* beside the month folders when this is one; inside the folder for a rehearsal anywhere
     else, so a scratch run never drops a file where it was not asked to */
  return /^\d{4}-\d{2}$/.test(basename(here)) ? join(dirname(here), "_users.json") : join(here, "_users.json");
}
function loadUsers(file) {
  if (!existsSync(file)) return {};
  const u = JSON.parse(readFileSync(file, "utf8"));
  for (const k of Object.keys(u)) if (!USERNAME_RE.test(u[k])) throw new Error(file + ": " + k + " has a malformed username " + u[k]);
  return u;
}
function userFor(users, code) {
  if (users[code]) return users[code];
  const taken = new Set(Object.values(users));
  let u;
  do { u = newUsername(); } while (taken.has(u));
  users[code] = u;
  return u;
}
/* THE BODY OF A DOCUMENT, without its QR block: what an envelope carries. A reader who reached
   the page by scanning the code is already where the code points, so printing it back at him
   is furniture; encrypting it as well quadrupled the ciphertext for a picture nobody on that
   page can use. */
const docBody = html => {
  const m = html.match(/<div class="w">([\s\S]*?)<\/div><\/body>/);
  return m ? m[1].replace(/<div class="qrb">[\s\S]*?<\/p><\/div>\s*/, '') : null;
};
/* EVERY EARLIER ISSUE THE CUSTOMER HAS (his instruction, 03 Sep 2026): the password of the
   month opens this month and every month before it. The earlier documents are read back off
   disk exactly as they were issued, archives included, from the month folders beside this one,
   so nothing is regenerated and a past statement never changes under a customer. A folder that
   is not a month, or a run into a directory that is not a month folder, has no history. Codes
   have been re-keyed before; an earlier folder under an old code scheme simply holds no file
   for the new code, and that month is absent rather than wrong. */
function priorIssues(outDir, code, issue) {
  const here = resolve(outDir), me = basename(here), root = dirname(here);
  if (!/^\d{4}-\d{2}$/.test(me) || !existsSync(root)) return [];
  const safe = code.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^statement_' + safe + '_(\\d{4}-\\d{2}-\\d{2})\\.html$');
  const out = [];
  for (const d of readdirSync(root).filter(x => /^\d{4}-\d{2}$/.test(x) && x < me).sort().reverse()) {
    const f = readdirSync(join(root, d)).map(x => re.exec(x)).filter(Boolean)[0];
    if (!f || f[1] >= issue) continue;
    const body = docBody(readFileSync(join(root, d, f[0]), 'utf8'));
    if (body) out.push({ month: d, issued: f[1], body });
  }
  return out;
}

/* ---- the secrets: one key, and the master beside it -----------------------------------
   THE KEY IS NEVER IN THE REPOSITORY. On the laptop it sits in statements/_secrets.json, which
   is gitignored, as {"key": "<hex>", "master": "<the same passphrase as STMT_MASTER>"}; in the
   cloud it is the STMT_KEY secret of the deploy job. An environment variable of either name
   overrides the file, and a test passes both in `opts`. A run that would mint a record and has
   no key stops before writing anything, because a record wrapped under nothing opens nothing. */
function loadSecrets(outDir, opts) {
  /* TRIMMED AT EVERY DOOR. A secret pasted into a web form, echoed from a file, or piped from a
     shell picks up whitespace that is invisible in every log, and an untrimmed byte here is a key
     that derives a different content key from the laptop's. */
  const tr = (v) => String(v == null ? "" : v).trim();
  const out = { key: tr((opts && opts.key) || process.env.STMT_KEY), master: tr((opts && opts.master) || process.env.STMT_MASTER) };
  if (out.key) return out;
  const here = resolve(outDir);
  const file = process.env.SALT_STMT_SECRETS
    || (/^\d{4}-\d{2}$/.test(basename(here)) ? join(dirname(here), "_secrets.json") : join(here, "_secrets.json"));
  if (existsSync(file)) {
    /* stripped of a byte-order mark first: Notepad on Windows writes one by default, and
       JSON.parse rejects it with "Unexpected token" naming a character nobody can see. */
    const s = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    out.key = out.key || tr(s.key);
    out.master = out.master || tr(s.master);
  }
  return out;
}

/* ---- the live statement ------------------------------------------------------------
   EVERY ENTRY FROM THE START TO NOW (his instruction, 03 Sep 2026). The same rows, the same
   document and the same laws as an issue, with no cut-off: whatever the book holds when it is
   written. It is written by the deploy after every fold, so it changes as the book does, and
   its heading says so to the minute in Kuala Lumpur time. It is not written to disk anywhere
   and never has a QR: the QR on the issued statement already opens it. */
export function liveStatement(party, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const kl = at.toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const today = at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
  const o = { from: null, to: today, completed: true, open: true, pending: true,
              dates: true, brand: 'Salt Command', issued: kl.replace(',', ''), live: true };
  const rows = stmtRows(party, o);
  o.refunds = stmtRefunds(party, o);
  o.recon = stmtRecon(party, rows).filter(R => rows.some(x => x.date === R.order.date));
  if (!rows.length && !o.refunds.length) return null;
  return { at: at.toISOString(), body: docBody(stmtDoc(party, rows, o)) };
}

/* THE RECORDS AS THE DEPLOY PUBLISHES THEM: the newest issue's records, each with the live
   document sealed under the same content key. `root` is the statements folder. Without a key
   the records go up as issued and no live document is written, and the caller says so.
   `pricing` (06 Sep 2026) is the desk's PRICING snapshot; given, each record also carries the
   customer's price list for the week, sealed under the same key (tools/pricelist.mjs). */
export async function liveRecords(root, key, now, pricing) {
  let latest = null;
  for (const d of readdirSync(root).filter(x => /^\d{4}-\d{2}$/.test(x)).sort()) {
    if (existsSync(join(root, d, "_kv"))) latest = d;
  }
  if (!latest) return { latest: null, records: [], live: 0, unmatched: [], stale: [] };
  const users = loadUsers(join(root, "_users.json"));
  const byUser = {};
  for (const c of Object.keys(users)) byUser[users[c]] = c;
  const records = [], unmatched = [], stale = [], wrongKey = [];
  let live = 0, priced = 0;
  for (const f of readdirSync(join(root, latest, "_kv")).filter(x => x.endsWith(".json")).sort()) {
    const rec = JSON.parse(readFileSync(join(root, latest, "_kv", f), "utf8"));
    /* A RECORD WITH NO USERNAME IS FROM BEFORE 03 SEP 2026 and cannot be published: the first
       deploy after the site went up found thirty-seven of them and put them all under the one
       key "u:undefined", which the store refused. They are reported and left, and the issue is
       regenerated on the laptop, which is the only place the passwords are. */
    if (!rec || !USERNAME_RE.test(String(rec.u || "")) || !rec.wrap || !rec.env) { stale.push(f); continue; }
    const code = byUser[rec.u];
    if (key && code) {
      /* THE KEY IS PROVED AGAINST THE RECORD BEFORE ANYTHING IS SEALED WITH IT (04 Sep 2026 audit).
         The content key is derived here from the DEPLOY'S copy of STMT_KEY, and the record was
         sealed on the laptop from ITS copy. Nothing compared the two, so a secret that differed by
         one character sealed every live statement under a key no password on earth unwraps: the
         publish counted them and logged "37 with a live statement", the browser opened the monthly
         bundle perfectly and then swallowed the live one as simply absent, and the whole feature
         was dead for every customer with three layers reporting success. That is precisely the
         silent-green failure this repository keeps writing tests for.
         rec.env was sealed with the TRUE content key, so opening it is a cross-check the deploy
         cannot fake: if it parses, the two copies of the secret agree. */
      let ck = null;
      try {
        ck = await contentKey(key, rec.u);
        JSON.parse(await decryptWith(ck, rec.env));
      } catch (e) { ck = null; }
      if (!ck) { wrongKey.push(rec.u); records.push(rec); continue; }
      const doc = liveStatement(code, now);
      if (doc) {
        rec.live = Object.assign({ at: doc.at }, await encryptWith(ck, JSON.stringify(doc)));
        live++;
      }
      if (pricing) {
        const list = priceList(code, book, pricing, now);
        rec.prices = Object.assign({ at: list.at, week: list.week.monday }, await encryptWith(ck, JSON.stringify(list)));
        priced++;
      }
    } else if (key) unmatched.push(rec.u);
    records.push(rec);
  }
  return { latest, records, live, priced, unmatched, stale, wrongKey };
}

/* `archive` produces a HISTORICAL issue: the documents and the review sheet, and nothing else.
   No QR, no password, no encrypted record.

   THE REASON IS THAT A BACK-ISSUE'S QR WOULD LIE. The site opens whichever issue was published
   last, so a code printed on a July statement asks for September's password, and the reader
   would be told his password was not accepted on a document that looks perfectly current. A
   record of a past position is worth keeping; a dead code on it is not. The archive is still
   read back as history by every later issue, which is how it reaches the customer. */
export async function makeStatements(outDir, issue, opts) {
  const archive = !!(opts && opts.archive);
  /* THE RE-ISSUE GUARD, before a byte is written. The generator used to overwrite in silence,
     and docs/STATEMENTS.md carried the rule as an instruction to the reader instead: check the
     folder first, a different issue date means a second issue in one month. An instruction a
     tool could enforce is a rule waiting to be forgotten at the one moment it matters, which
     is a run at speed on the first of the month. Same date is a clean retry and regenerates in
     place; a different one stops. */
  const prior = existsSync(outDir)
    ? [...new Set(readdirSync(outDir)
        .map(f => (/^(?:statement_.+?|_review)_(\d{4}-\d{2}-\d{2})\.html$/.exec(f) || [])[1])
        .filter(Boolean))].sort()
    : [];
  if (prior.length && !prior.includes(issue)) {
    throw new Error("refusing to write a second issue into " + outDir + ": it already holds a set "
      + "issued " + prior.join(", ") + ", and those files may have been sent. Nothing was written.");
  }

  /* A RETRY KEEPS THE PASSWORDS IT ALREADY ISSUED. Minting fresh ones would invalidate every
     password already sent, which is the one thing a retry must not do. */
  const pwFile = join(outDir, "_passwords.json");
  const priorPw = (prior.length && existsSync(pwFile)) ? JSON.parse(readFileSync(pwFile, "utf8")) : {};

  /* THE KEY, before a byte is written: a record wrapped under nothing opens nothing. */
  const secrets = archive ? { key: "", master: "" } : loadSecrets(outDir, opts);
  if (!archive && !secrets.key) {
    throw new Error("no STMT_KEY: put {\"key\": ...} in " + join(dirname(resolve(outDir)), "_secrets.json")
      + " or set STMT_KEY. Without it no record can be wrapped and nothing was written.");
  }
  if (!archive && !secrets.master) console.log("note: no master passphrase given, so the owner's override will not open these records");

  /* THE RECORDS ARE REWRITTEN WHOLE. They are named by username now and were named by code
     until 03 Sep 2026, and a stale file left beside the new ones would be published as an
     account nobody can open. */
  if (archive) mkdirSync(outDir, { recursive: true });
  else { rmSync(join(outDir, "_kv"), { recursive: true, force: true }); mkdirSync(join(outDir, "_kv"), { recursive: true }); }
  const usersFile = archive ? null : usersFileFor(outDir);
  const users = archive ? {} : loadUsers(usersFile);
  const parties = [...new Set(sales.map(s => s.customer))].sort();
  const issued = longDate(issue);
  let made = 0; const skipped = [], sheets = [], kv = [], passwords = {};
  for (const p of parties) {
    /* EVERYTHING to date, not just the month: a customer's statement is more use as a
       complete position than as a slice, and it removes the brought-forward problem
       entirely. The month is what the folder records, not what the statement covers. */
    const o = { from: null, to: issue, completed: true, open: true, pending: true,
                dates: true, brand: 'Salt Command', issued: issued, archive: archive };
    const rows = stmtRows(p, o);
    o.refunds = stmtRefunds(p, o);
    /* only reconcile orders that are actually IN this statement, so the date window
       cannot leave a working referring to a line the reader cannot see */
    o.recon = stmtRecon(p, rows).filter(R => rows.some(x => x.date === R.order.date));
    if (!rows.length && !o.refunds.length) { skipped.push(p); continue; }
    /* the index needs the same totals the statement foots to, so they are taken
       from the same rows rather than recomputed from the ledger */
    /* the index must agree with each statement's own footer: a cancelled order is
       not an order for counting purposes, so it is out of n as well as out of the money */
    const t = { n: rows.filter(r => !r.cancelled).length, qty: 0, total: 0, paid: 0, owed: 0, toGet: 0, pend: 0, cx: 0 };
    t.refund = o.refunds.filter(r => !r.paidOn).reduce((a, r) => a + (+r.amount || 0), 0);   // v454: what is owed TO them
    rows.forEach(r => { if (r.cancelled) { t.cx++; t.paid += r.gift ? 0 : (r.paidCash + r.inKind); return; }
                        t.qty += r.qty; t.total += r.total; t.paid += r.gift ? 0 : (r.paidCash + r.inKind);
                        t.owed += r.owed;
                        t.toGet += (r.toGet > 0 && !r.pendingOrder) ? r.toGet : 0;
                        t.pend += r.pendingOrder ? r.total : 0; });
    /* THE QR, THE USERNAME AND THE PASSWORD (03 Sep 2026). The code opens the statements site
       with the username filled in; the site asks for the password, which goes by a different
       channel, and decrypts in the reader's browser. Two channels rather than one secret link:
       a QR can be photographed off a printed page, and on its own it opens nothing. The
       username is printed beside the code because a customer on another device types it.

       WHAT IS ENCRYPTED IS A BUNDLE OF BODIES, not pages: this issue's document and every
       earlier one the customer has, newest first, as JSON. The site already carries the
       stylesheet, so shipping it inside every envelope would multiply the ciphertext for
       nothing, and the site draws the strip of issue dates from the bundle. */
    const baseDoc = stmtDoc(p, rows, o);
    let html = baseDoc, url = null, pw = null, u = null;
    if (!archive) {
      u = userFor(users, p);
      url = BASE_URL + '/?u=' + encodeURIComponent(u);
      const qr = qrSvg(url, { size: 132, label: 'Statement link' });
      const qrBlock = '<div class="qrb">' + qr
        + '<p class="qrt">Scan to open your statements on your phone at any time, this one and every earlier one.<br>'
        + 'Your username is <code>' + esc(u) + '</code>. The password is sent to you separately. '
        + 'The page stays open for three minutes, then locks; the same password opens it again.<br>'
        + '<code>' + esc(url) + '</code></p></div>';
      html = baseDoc.replace('</div></body></html>', qrBlock + '\n</div></body></html>');
      pw = priorPw[p] || newPassword();
      passwords[p] = pw;
      const history = priorIssues(outDir, p, issue);
      const bundle = { v: 1, issued: issue, statements: [
        { issued: issue, label: issued, body: docBody(baseDoc) },
        ...history.map(h => ({ issued: h.issued, label: longDate(h.issued), body: h.body }))
      ] };
      /* THE RECORD CARRIES NO CODE. The Worker never needs one, and the file is named by the
         username so nothing in the store or its listing pairs an address with an account.
         The bundle is sealed under the content key; the password and the master each hold a
         wrap of that key, and nothing else. */
      const ck = await contentKey(secrets.key, u);
      const rec = { u: u, issued: issue, issues: bundle.statements.map(s => s.issued),
                    verifier: await makeVerifier(pw), wrap: await wrapKey(pw, ck) };
      if (secrets.master) rec.wrapMaster = await wrapKey(secrets.master, ck);
      rec.env = await encryptWith(ck, JSON.stringify(bundle));
      kv.push(rec);
    }

    const file = join(outDir, 'statement_' + p.replace(/[^A-Za-z0-9._-]+/g, '-') + '_' + issue + '.html');
    writeFileSync(file, html);
    console.log('  ' + p.padEnd(14) + rows.length + ' order' + (rows.length === 1 ? '' : 's'));
    made++;
    sheets.push({ who: p, user: u, html: html, t: t, pw: pw, url: url });
  }

  /* THE LEAK GATE, checked rather than asserted. The rules are fed a code and have no route to
     a name, and one customer's document must not name another. Both are true by construction
     and both are the sort of thing that stays true until a signature changes.
     A WHOLE CODE, NOT A SUBSTRING: CN6-WM is a prefix of CN6-WM-R, and matching loosely refuses
     a perfectly good run over a party containing its own name. Same trap as the 20 Aug scan
     that flagged "sans-serif" as a leak. */
  const whole = code => new RegExp("(?<![A-Za-z0-9-])" + code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9-])");
  for (const s of sheets) {
    const others = parties.filter(x => x !== s.who && whole(x).test(s.html));
    if (others.length) throw new Error(s.who + "'s statement names another party: " + others.join(", "));
  }

  /* ---- THE REVIEW SHEET, for him and not for a customer --------------------
     Twenty-four files is too many to open one by one before sending, so this
     stitches every statement into one page behind an index that says which ones
     need a second look. It carries NOTHING a statement does not: it is the same
     markup inlined, so anything safe to send is safe to review and there is no
     second version of the truth to keep in step. The prefix keeps it first in an
     alphabetical listing, where it belongs. */
  if (sheets.length) {
    const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const m2 = v => Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const n2 = v => Number(v).toLocaleString('en-MY', { maximumFractionDigits: 2 });
    /* ONE SHARED STYLESHEET, IMPORTED RATHER THAN LIFTED. This used to pull the <style>
       block out of the first statement with a regular expression so the two could not
       diverge, which worked and depended on a document's markup never changing shape.
       Both now call the same function. */
    const css = statementCss();
    const bodyOf = h => { const m = h.match(/<body>([\s\S]*?)<\/body>/); return m ? m[1] : ''; };
    /* PENDING IS ITS OWN STATE, not a quiet 'clear'. An agreed order nobody has acted
       on is the one line most likely to need chasing, so the index says so rather than
       letting it sit among the finished accounts looking settled. */
    const flag = t => t.owed > 0.009 ? 'owes' : (t.toGet > 0.009 ? 'goods' : (t.refund > 0.009 ? 'refund' : (t.pend > 0.009 ? 'pend' : 'clear')));
    const rowsIdx = sheets.map(x => {
      const f = flag(x.t);
      return '<tr class="f-' + f + '"><td class="l"><a href="#s-' + esc(x.who) + '">' + esc(x.who) + '</a></td>'
        + (archive ? '' : '<td class="l pw">' + esc(x.user) + '</td>')
        + '<td>' + x.t.n + '</td><td>' + n2(x.t.qty) + '</td><td>' + m2(x.t.total) + '</td><td>' + m2(x.t.paid) + '</td>'
        + '<td class="r">' + (x.t.owed > 0.009 ? '<b class="owe">' + m2(x.t.owed) + '</b>' : x.t.refund > 0.009 ? '<b class="rf">' + m2(x.t.refund) + ' to them</b>' : '&mdash;') + '</td>'
        + '<td class="r">' + (x.t.toGet > 0.009 ? '<b class="gd">' + n2(x.t.toGet) + ' unit</b>' : '&mdash;') + '</td>'
        + '<td class="r">' + (x.t.pend > 0.009 ? '<b class="pd">' + m2(x.t.pend) + '</b>' : '&mdash;') + '</td></tr>';
    }).join('');
    const owe = sheets.filter(x => x.t.owed > 0.009), gds = sheets.filter(x => x.t.toGet > 0.009);
    const pnd = sheets.filter(x => x.t.pend > 0.009);
    const sumT = k => sheets.reduce((a, x) => a + x.t[k], 0);
    const review = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>Statements to review · ' + esc(issue) + '</title><style>' + css
      + REVIEW_CSS
      + '</style></head><body>'
      /* THE PASSWORDS ARE NOT ON THIS PAGE, and that is a correction rather than an omission.
         They were, in a column beside each account, while _passwords.json was gitignored on the
         grounds that a credential committed is a credential in the history for ever. The review
         sheet IS committed, so the same thirty-seven passwords went into git anyway and the
         ignore rule protected nothing. They now live in exactly one place, and that place is
         not the repository. */
      + (archive
        ? '<div class="warn"><b>A record of a past issue.</b> These statements carry no QR and no '
          + 'password: the code would point at whatever month was published last, so on a back-issue '
          + 'it would open a different statement and the reader would be told his password was '
          + 'refused. Kept as the position as the book now understands it on that date.</div>'
        : '<div class="warn"><b>For review, never for sending.</b> This page puts every account '
          + 'beside every other, which is exactly what a statement must never do. The usernames are '
          + 'here because they are addresses; the passwords are not: they are in _passwords.json, '
          + 'which is not committed.</div>')
      + '<div class="rv"><p class="rvh">For review, not for sending</p>'
      + '<h1 class="rvt">' + sheets.length + ' statements</h1>'
      + '<p class="rvs">Issued ' + esc(issued) + '. Every statement below is exactly the file that would go to that '
      + 'customer, stitched together so they can be read in one pass. '
      + (owe.length ? '<b>' + owe.length + '</b> carr' + (owe.length === 1 ? 'ies' : 'y') + ' an outstanding balance' : 'None carries a balance')
      + (gds.length ? ', and <b>' + gds.length + '</b> ' + (gds.length === 1 ? 'is' : 'are') + ' owed goods' : '')
      + '.'
      + (pnd.length ? ' <b>' + pnd.length + '</b> hold' + (pnd.length === 1 ? 's' : '') + ' an order agreed but not yet '
        + 'collected or paid, which is money to chase rather than money owed.' : '')
      + '</p>'
      + '<table class="idx"><thead><tr><th class="l">Account</th>' + (archive ? '' : '<th class="l">Username</th>')
      + '<th>Orders</th><th>Quantity</th>'
      + '<th>Ordered</th><th>Paid</th><th class="r">Outstanding</th><th class="r">Owed goods</th>'
      + '<th class="r">Not actioned</th></tr></thead>'
      + '<tbody>' + rowsIdx + '</tbody>'
      + '<tfoot><tr><td class="l"><b>All</b></td>' + (archive ? '' : '<td></td>') + '<td>' + sumT('n') + '</td><td>' + n2(sumT('qty')) + '</td>'
      + '<td>' + m2(sumT('total')) + '</td><td>' + m2(sumT('paid')) + '</td>'
      + '<td class="r"><b class="owe">' + m2(sumT('owed')) + '</b></td>'
      + '<td class="r"><b class="gd">' + n2(sumT('toGet')) + ' unit</b></td>'
      + '<td class="r"><b class="pd">' + m2(sumT('pend')) + '</b></td></tr></tfoot></table></div>'
      + sheets.map(x => '<p class="slab" id="s-' + esc(x.who) + '">' + esc(x.who) + '</p><hr class="cut">'
        + '<div class="sheet">' + bodyOf(x.html) + '</div>').join('')
      + '</body></html>';
    const rf = join(outDir, '_review_' + issue + '.html');
    writeFileSync(rf, review);
    console.log('review sheet: ' + rf);

    /* THE SEND SHEET (04 Sep 2026, his instruction). One card per customer, with the QR, the
       link-and-username message on a Share button and the password on a separate one, so a
       month's sending is not thirty-seven trips between three files with a chance of pasting
       one customer's password under another's name. It carries every password, so it is
       gitignored exactly as _passwords.json is, and it says on its face that it is never the
       thing you send. Archive issues have no password and no link, so they get none. */
    if (!archive) {
      const sf = join(outDir, '_send_' + issue + '.html');
      writeFileSync(sf, sendSheet(sheets, {
        issue: issue,
        monthName: new Date(issue + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      }));
      console.log('send sheet:   ' + sf + '  (gitignored: it holds every password)');
    }
  }

  /* The passwords and the encrypted records. _passwords.json is gitignored: it is credentials,
     and a credential committed is a credential in the history for ever. The _kv records are
     ciphertext plus a verifier, and those ARE committed, because the deploy uploads them. */
  if (!archive) {
    writeFileSync(pwFile, JSON.stringify(passwords, null, 2) + '\n');
    for (const r of kv) writeFileSync(join(outDir, '_kv', r.u + '.json'), JSON.stringify(r) + '\n');
    /* sorted by code, one line each, so a new customer is one added line in the diff */
    const sorted = {};
    for (const k of Object.keys(users).sort()) sorted[k] = users[k];
    writeFileSync(usersFile, JSON.stringify(sorted, null, 2) + '\n');
  }

  console.log('\nwrote ' + made + ' statement' + (made === 1 ? '' : 's') + ' to ' + outDir);
  if (archive) console.log('archive issue: no QR, no password, no KV record');
  else {
    console.log('usernames:    ' + usersFile + '  (committed; a new customer is a new line)');
    console.log('passwords:    ' + pwFile + '  (gitignored, never commit)');
    console.log('for the KV upload: ' + join(outDir, '_kv') + '  (' + kv.length + ' records)');
  }
  if (skipped.length) console.log('nothing to show for: ' + skipped.join(', '));
  return { made, skipped, sheets, kv, passwords, users };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).filter(a => a !== '--archive');
  const archive = process.argv.includes('--archive');
  const outDir = args[0], issue = args[1] || new Date().toISOString().slice(0, 10);
  if (!outDir || /\.html?$/i.test(outDir)) {
    console.error('usage: node tools/make_statements.mjs <outDir> [YYYY-MM-DD issue date]');
    if (outDir) console.error('the desk is no longer an input: statements build from ledger/book.json and engine/position.mjs (v388 removed the statement functions from the desk).');
    process.exit(2);
  }
  makeStatements(outDir, issue, { archive }).catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
}

/** The body of an issued document, without its QR: what the publish tool and the suite read. */
export { docBody };
