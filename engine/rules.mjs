/* engine/rules.mjs: S1c-i of the Book plan. THE PRICING RULE TABLES, ONE MODULE.
   These tables sat in the master's own script, so only the desk could read them. They live here now so a Worker can
   import the same object the desk inlines (tools/engine.mjs puts this file's text into the master between its markers,
   the final export line dropped). The text of each const is exactly what stood in the master: no value, key or order
   changed, and the master reads them under the same names. REF is not here: it is built from the master's LADDER.
   Edit this module, then: node tools/engine.mjs --sync. */

const RULES={
  creditUnits:{salt:{retail:1,associate:2}, oil:{retail:10,associate:20}},
  creditDays:10,
  holdDays:1,
  hideDays:3,
  lockDays:4,
  /* V5b2 (his answers of 29 Sep 2026): an order that would take what a customer owes at once, across every book, over
     this is paid in advance, for everyone, in place of the Counter's unit cap. The desk Worker reads it from TERMS.
     No semicolon in this object: the publish reads RULES up to the first one. */
  creditCeilingRM:250,
  /* V5c (his answers of 29 Sep 2026): a late payer is offered a level down, never priced one. Two delays past the term
     within this many days, or one of lockDays or more, turn the offer on, one payment on time turns it off, and a delay
     within this many days of that takes lateResetRepeat payments on time in a row. The engine's lateOffer reads them. */
  lateWindowDays:90,
  /* 05 Oct 2026: a book losing this share of what it buys or more prints the stack's after-leak figure beside its floor, as
     information only, the floor being COGS and nothing pricing off the leak */
  leakInfoFrom:0.25,
  lateResetRepeat:3,
  fullProvDays:21,
  reorderUnits:{salt:15, oil:20},
  /* F15 (29 Sep 2026, his Q16): the delivery fee offered by distance, one way. A setting, never a price: it fills the
     delivery box, his figure wins, and the goods, the floor and the board never read it. roadFactor 1.3 is an assumption
     for the Klang Valley. localityFallback: a party with no exact point is measured to its PLACED locality (0.01 degrees,
     about a kilometre out), his answer at design. */
  delivery:{rmPerKm:1.5, roadFactor:1.3, roundTo:0.5, minRm:0, maxRm:null, localityFallback:true}
};

const PRICE_ENGINE={
  sizes:[0.5,1,1.5,2,2.5,3,4,5,6.25,12.5],
  /* THE MARGIN IS NOT TYPED. It is REGRESSED from what this book has actually achieved,
     size by size, and refits itself as orders accumulate. See marginCurve(). What is typed
     is a single hand on the tiller: a shift applied to the whole fitted curve, at zero
     until he wants to be more expensive or cheaper across the board. */
  marginShift:0,
  minPoints:8,          // below this there is not enough trade to fit anything honest
  fallbackMargin:0.42,  // and this is used instead, stated rather than inferred
  clamp:{lo:0.18,hi:0.72},
  /* how much of the unexplained leak the customer is asked to carry. Zero keeps the v205
     position that the desk absorbs the cost of a problem the customer did not cause. */
  recoverAbnormal:0,
  /* what the desk charges itself for money out on credit, per year. Used only to price the
     days a tier is expected to take, never to charge anyone interest. */
  /* v353, HIS INSTRUCTION OF 24 Aug: 40%, NOT 12%. What he charges himself for money tied up,
     per year. 12% was a borrowing rate; 40% is what he says his own capital is worth, which is
     the right basis for a desk funded out of his own pocket rather than out of a facility.
     WHERE IT BITES, AND IT IS SMALLER THAN IT SOUNDS. Inventory: a 50 unit lot clears in about 12
     days at 4.32 a day, so the average unit is held under 6, and 40% of RM45.20 over 6 days is
     about 29 sen a unit. Credit: a customer who takes 10 days to pay costs 1.1% of the sale
     against 0.33% at 12%. It is a real layer and it is not the one that decides a price. */
  moneyRate:0.40,
  /* the least a rate must fall at each step up, so size is visibly worth taking */
  incentive:0.03,
  /* ============ FIVE CATEGORIES, EARNED NOT ASSIGNED (v237) ============
     Cheapest first, because that is the order they earn. rel is what each pays relative to
     Regular, so the whole ladder moves together when the curve moves and the RELATIONSHIP
     between them stays a policy.
       SPECIAL    the handful who have carried the book. Best price on the desk.
       ASSOCIATE  resells or refers, so his margin is earned on volume he brings.
       LOYAL      buys to a rhythm and settles on the day.
       REGULAR    the default ask, and the price the curve is fitted to.
       ONE-TIME   bought once, no history, full term assumed, no claim on a discount.
     days is what each is expected to take to pay, which is a real cost and is priced. */
  /* ============ THREE TIERS, TIER I TO TIER III (v245) ============
     Five categories became three because the book cannot support five. The engine was
     already pricing Associate and Loyal identically at 29.8%, and Regular held two
     customers against a book of twenty-four, so two of the five distinctions were
     nominal before any constraint bound. Cheapest first, because that is the order they
     earn: TIER I is the best price on the desk, TIER III is the full ask.
     REL NO LONGER PAYS TWICE. Tier I sat at 0.82 AND took zero credit days, so the same
     fact bought the same customer a discount and a cost saving. rel is now 0.92 and the
     zero credit days deliver the rest, which is cost recovery rather than a second gift. */
  tiers:[
    {code:'T1',name:'Tier I',   rel:0.92, days:0,  col:'#e4e9ec',dots:3,
     who:'carried the book; best price on the desk'},
    {code:'T2',name:'Tier II',  rel:1.00, days:3,  col:'#d8c79c',dots:2,
     who:'the default ask, and the price the curve is fitted to'},
    {code:'T3',name:'Tier III', rel:1.15, days:10, col:'#c5a059',dots:1,
     who:'bought once, no history, and the full term assumed'}
  ],
  /* v238: NO CAPS. Every tier runs every size. A cap is a break in the ladder by another
     name, and the only thing allowed to move a price is the floor. */
  maxSize:{T1:1e9,T2:1e9,T3:1e9},
  /* THE LEAST A UNIT MAY EARN, IN RINGGIT, WHATEVER THE SIZE (v245). The percentage floor
     could not see that a unit is the scarce thing here: at 20% it let a 12.5 lot go for
     RM13.59 a unit while a single unit earned RM40. Twenty is not a round number picked
     for neatness, it is the LARGEST value at which the board still solves in whole RM10
     steps at every size and tier; at 25 and above the band between floor and ceiling
     closes and prices go to exact ringgit again. */
  /* ============ THE FLOOR IS A CURVE PER TIER (v249) ============
     Stated by him as MARKUP ON COST, which is the only reading that parses: 100% margin on
     revenue is undefined, 100% markup is twice cost. Two anchors per tier, at 1 unit and at
     12.5 unit, interpolated in the LOG of size because that is how the fitted margin curve
     already behaves and how discounts are actually felt. Tier II is the midpoint of the two
     at every size rather than a third pair of typed numbers, so the ladder cannot develop a
     kink in the middle that nobody chose.
     THIS REPLACES minPerUnit, WHICH IS NOW ZERO. The two cannot both be the floor: a flat
     RM20 a unit forces 12.5 unit to a 31% markup, which would silently overrule the 15% he
     asked for at Tier I. Kept as a live mechanism at zero so it is one number to restore. */
  /* v250: IT IS A CAP, NOT A FLOOR, and that correction changes what the board IS. Read as
     a minimum, the fitted margin curve was free to price Tier I ABOVE 33% at a unit and did,
     at 50.4%. Read as a maximum, these four numbers ARE the board: every price is lot cost
     times one plus the stated markup, rounded DOWN to the five grid so the cap is never
     breached by rounding. The regressed margin curve no longer sets the carded price; it
     stays alive for off-board sizes and for the analysis panes. */
  /* ============ NINE STATED PRICES, AND A SOLVER BETWEEN THEM (v251) ============
     He now sets the board directly at three sizes per tier. These are PRICES, not markups
     and not margins, so nothing is derived from cost any more except the floor that tests
     them. Everything between is solved.
     THE SOLVER INTERPOLATES THE RATE, NOT THE TOTAL. Interpolating totals draws a straight
     line through a curve and puts the middle sizes above both ends per unit; the rate is the
     thing that has to fall smoothly, so the rate is what is interpolated, in the LOG of size
     because that is how every other curve on this desk behaves. Outside the stated range it
     is held flat rather than extrapolated.
     THE ANCHORS ARE PINNED. The strictness pass may move any solved size but never one he
     typed: if a stated price and a solved neighbour collide, the solved one gives way. */
  /* ============ THE ANCHORS ARE PER PRODUCT (v260) ============
     They were flat, so switching the desk to oil showed SALT'S BOARD VERBATIM: RM80 for a
     unit of oil that costs RM7.90 landed, a 545% markup, and RM850 for a 12.5 lot, against
     the one oil sale on the book which cleared RM13 a unit. A price list keyed to nothing is
     worse than no price list, because it looks authoritative.
     A PRODUCT WITH NO STATED ANCHORS DOES NOT BORROW ANOTHER'S PRICES. It borrows the SHAPE:
     the markup salt carries on its OWN lot cost at each anchor size, applied to this
     product's own lot cost. Same commercial ladder, its own economics. That board is marked
     DERIVED wherever it appears; it is a placeholder for his numbers, not a recommendation. */
  anchors:{
    salt:{
      T1:{0.5:50,  1:80,  12.5:850},
      T2:{0.5:60,  1:100, 12.5:900},
      T3:{0.5:80,  1:120, 12.5:950}
    },
    /* OIL IS ITS OWN TRADE, NOT SALT AT ANOTHER SCALE (v261). Stated by him 07 Aug: a 10
       unit minimum, and two anchors per tier. The 10 unit anchors are RM10.00, RM11.50 and
       RM13.00 a unit; at 50 they are RM8.20, RM8.80 and RM9.40. The single oil sale on the
       book was 10 units for RM130, which is Tier III at 10 to the ringgit, so the ladder is
       consistent with the one trade written rather than merely plausible.
       BEYOND 50 THE RATE HOLDS FLAT, because the anchors stop there and the curve is clamped
       rather than extrapolated: 100 units quotes at the 50 unit rate, RM820 at Tier I. If a
       hundred should be cheaper per unit than a fifty, that needs a third anchor. */
    oil:{
      T1:{10:100, 50:420},
      T2:{10:115, 50:440},
      T3:{10:130, 50:470}
    }
  },
  /* ============ THE RUNGS AND THE BOARD ARE TWO LISTS, AND THIS IS WHY ============
     THE SIZE LADDER IS PER PRODUCT. Salt runs half a unit to 12.5; oil starts at a 10 unit
     minimum, steps by 5 to 50, then by 10 to 100. Quoting oil on salt's sizes produced a board
     whose smallest lot was a twentieth of the minimum order.
     sizesBy WAS THE WALK'S RUNG GRID, NOT THE PRINTED BOARD, and the split existed because
     conflating the two was a trap. ladderWalk goes forward and each rung is clamped to the rate
     of the rung below it, so the ONLY thing that ratchets a rate DOWN is an intermediate rung
     landing on a cheaper ten. He asked for an oil board of 10 to 50 in tens. Taking that as the
     rung grid measured out at RM13.00 a unit at every size, dead flat, because nine dropped
     rungs are nine chances to step down removed; 50 unit would have risen from RM610 to RM650
     and oil's volume discount would have gone. So the rungs stayed fine and boardBy said which
     of them were PRINTED. Measured with the split in place: 130 / 250 / 370 / 490 / 610, taper
     intact, not one price moved.
     ROUND 5 RETIRES OIL'S SPLIT, AND THE TRAP WITH IT. The flatness above was never a property
     of his grid: it was salt's ladder clamp handing every oil size past 12.5 unit ONE markup,
     so nothing but a rounding accident could taper, and the intermediate rungs were those
     accidents. With the taper fitted to oil's own quote and the anchor span on oil's own board
     (LADDER_BY), the curve tapers by itself and his 10-to-50-in-tens grid holds the rate law
     with no rungs between: measured at 130 / 240 / 320 / 400 / 470 on the current cost basis,
     strictly falling per unit. The 15 to 45 fives and the 60 to 100 tail leave the walk grid
     on his call 4 of 29 Aug: the board quotes what he sells, and a size he does not sell is
     priced off-board by ladderAsk against the rungs beneath it, exactly as salt's 7 unit is.
     SALT NEEDS NO SPLIT, because his list is a superset of the rungs it already had. 3.5 and 4.5
     are real rungs, and adding them moves three prices down by RM10 each: 4 unit 390 to 380,
     5 unit 470 to 460, 6.25 unit 580 to 570. That is not a discount anyone chose. 3.5 unit asks
     RM340, which is RM97.14 a unit, and a bigger lot may never cost more per unit, so 4 unit may
     not exceed RM388.57 and rounds to RM380. RM390 was only holding because 3.5 was not quoted;
     the rung exposes the rate law rather than changing it.
     80 AND 100 UNIT COME BACK ON HIS DECISION OF 15 SEP 2026, because his pricing workbook's oil board carries them:
     derived beside his five stated sizes, they ask no more a unit than 50 unit does and clear their own floors
     (RM720 and RM900 on 16 Sep, RM9.00 a unit). */
  sizesBy:{
    salt:[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6.25,12.5],
    oil:[10,20,30,40,50],   /* 19 Sep 2026: five sizes, his board. 80 and 100 went with the tiers. */
    candy:[1,5,10,20,30],   /* 23 Sep 2026: his three rates and a size inside each */
    rice:[1,5,10]
  },
  /* which rungs are PRINTED. A product with no entry prints every rung it has. Empty since
     round 5: oil's grid IS its board now, so the mechanism stands and nothing uses it. */
  boardBy:{},
  /* TENS FIRST, FIVES ONLY WHERE TENS CANNOT HOLD HIS ANCHORS (v251). His instruction was
     nearest tens all across, and on Tier I that is arithmetically impossible: the rate is
     RM80 a unit at the 1 unit anchor, the only ten-grid prices at 1.5 unit are RM110 and
     RM120, RM120 ties the rate and RM110 crashes it to RM73.33, and from RM73.33 a strictly
     falling rate cannot reach the RM68 his 12.5 anchor states without passing under it at
     3 unit. Fives clear it exactly, with rates 100, 80, 76.67, 75, 74, 73.33, 72.5, 71,
     70.4, 68. So the solver takes the COARSEST grid that satisfies both laws, cell by cell,
     and the board reports which cells needed the finer step rather than hiding it. */
  /* v262: A THIRD STEP, BECAUSE OIL'S FLOOR IS NEARLY FLAT. Oil's floor rate is
     8.22 + 5.56/q, which falls by fractions of a sen per unit as the lot grows: from RM8.33 a
     unit at 50 to RM8.28 at 100. The band a larger lot has to land in is therefore a few sen
     wide, while one five-ringgit step at 70 units moves the rate by 7 sen. The step was
     coarser than the target. Salt never showed this because its delivery is a tenth of its
     lot cost and its floor still has somewhere to fall. Tens first, then fives, then whole
     ringgit where nothing else fits, and the grid used is recorded per cell. */
  /* v263: TENS OR FIVES, NEVER FINER, AND ROUND UP WHERE IT WILL NOT FIT. Stated by him.
     The RM1 step added at v262 solved oil's nearly-flat floor and produced RM582 and RM746 on
     a printed card, which is not a price anyone reads out. Where a five cannot satisfy every
     law at once the price goes UP to the next five: a price above its floor that breaks a
     rate taper is a decision the desk can defend; one below its floor is not. */
  grid:10, gridFallback:[10,5],
  /* v261: THE FLOOR CURVE IS SALT'S AND ONLY SALT'S. Its anchors are stated in salt's sizes,
     1 unit and 12.5, so on oil's 10-to-100 ladder every size clamped to the far end and a
     product with a RM5 delivery on a RM375 lot inherited a floor built for one with a RM5
     delivery on a RM63 lot. A product without its own curve falls back to the band
     percentage, which is the desk's own refusal line and asks nothing it cannot justify. */
  markupCurve:{salt:{lo:1, hi:12.5, T1:{lo:0.33, hi:0.15}, T3:{lo:1.00, hi:0.45}}},
  minPerUnit:0,
  /* ============ WHAT AN ORDER OF HIS OWN TIME COSTS (v352) ============
     RM25, stated by him on 24 Aug. Roughly five hours a week at RM50 an hour spread over the ten
     orders a week this book actually runs at.
     PER ORDER, NOT PER UNIT, because that is how the work falls: a half unit and a twelve and a
     half take about the same handling, one message, one handover, one line in the book.
     WHY IT IS RM25 AND NOT MORE. Tested against his own eighty-two priced sales: at RM25 seventy-
     three of them still clear the floor, at RM40 fifty-nine do and at RM60 forty-six. RM25
     disciplines the worst nine without declaring half the book a mistake. Raise it when the ask
     has caught up with it, not before.
     IT IS NOT IN THE MARGIN CURVE, and that is deliberate. A flat per-order charge is
     proportionally enormous on a small order, so putting it in the regression base inverts the
     slope: margin appears to RISE with size, the "may not rise" clamp fires, and the curve dies.
     Measured, with it in: b +0.0436, r-squared 0.058. Without: b -0.0881, r-squared 0.340. His
     time belongs in the refusal line, not in the measurement of what the book has achieved.
     NOT CHARGED since 07 Sep 2026, his instruction ("do not charge for my time"), given after
     reading the 1, 1.5 and 2 unit derivation: the floor is the leak-adjusted cost of the units
     and nothing per order. The mechanism and the argument above stay for the day he states a
     figure again. */
  timePerOrder:0,
  /* WHEN THE INVENTORY IS SHORT, STOP PAYING PEOPLE TO EMPTY IT. The 3% step incentive is a
     policy for spare capacity. Below this many days of cover it goes to zero, so the
     ladder flattens by itself and returns when inventory does. */
  coverGuard:14,
  /* ============ WHAT PUTS SOMEONE IN A CATEGORY ============
     Read off the ledger every time, never typed against a name, so a customer moves up by
     trading and moves down by stopping. Tested in order, first match wins. */
  rules:{loyalOrders:3, loyalDays:35, specialRev:1200, specialOrders:4}
};

const LADDER_BY={
  /* v564: tier1 null, and it is an ENTRY rather than an omission. ladderFor spreads LADDER under
     the override, so leaving it out would hand oil SALT'S two anchors: every oil size clamps to
     12.5, the rate lands at RM70 a unit, and ten units of oil that Tier 2 sells at RM130 would be
     quoted RM700. Oil has one tier on its own merits too: its board is his stated price at all
     five sizes and the 50 unit rung already earns 3%, so there is nothing for a second tier to sit
     under. Give it two ends here the day he states them. */
  oil:{anchorQ:10, anchorX:0.62, at:{lo:10, hi:50}, floor:0, anchorG:0.36, gLo:0, tier1:null},   /* v504: 0.36 reproduces RM130 at 10 on the floor basis */
  /* 23 Sep 2026: stated a unit in single ringgit, so they round to the ringgit and not the ten */
  candy:{round:{to:1, up:true}, tier1:null},
  rice:{round:{to:1, up:true}, tier1:null}
};

const TIER_RULE={
  salt:{drift:{up:0.3, down:0.2}, mS:2.813, qS:0.5, mB:1.363, qB:12.5, ceilingX:3,
        auto:{wP:0.35, wF:0.25, wV:0.2, wT:0.2, minSettled:3, perMonth:4, unitsPerMonth:10, orders:12, staleDays:60, overdueDays:14, U:0.5, D:0.5, cap:0.5},
        presets:{Better:-0.3, Standard:0, Higher:0.3},
        rungs:[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6.25,12.5],
        /* 05 Oct 2026, his decision: any quantity from half a unit to 25 in quarters is quoted at once on the Counter, and the
           walk runs through every point of it, so the rate never rises from one quarter to the next (the engine's walkSizes) */
        grid:{min:0.5, step:0.25, max:25}},
  /* 19 Sep 2026, HIS INSTRUCTION: oil has no pricing tier. One board, typed, the same for every
     customer, RM13 a unit falling a ringgit every ten to RM9. FIVE SIZES: he typed five prices and
     the engine does not extrapolate his taper, so 80 and 100 would have held flat at RM9 and quoted
     RM720 and RM900; he was asked and chose to drop them. `fixed` is what makes fiveTiers state the
     board instead of striking columns, and `multiples`, `start` and `step` are gone because with one
     price there is nothing for them to say. */
  /* 15 OCT 2026, HIS WORD: oil is ordered in tens, its smallest unit step. The grid's step IS the order step (the Worker's onStep reads
     it), and oil's prices do not move when it goes from 1 to 10: the five points are the five typed rungs. Salt stays at a quarter
     and a coarser step there would raise most of its prices, the walk running through every point (docs/PRODUCTS.md section 9). */
  oil:{fixed:{"10":130,"20":240,"30":330,"40":400,"50":450}, rungs:[10,20,30,40,50], ceilingX:2, grid:{min:10, step:10, max:50}},
  /* 23 SEP 2026, HIS INSTRUCTION: candy and rice are single tier too, stated a unit. Candy RM60 a unit under 10,
     RM55 from 10 to 29 (his answer that day), RM50 from 30. Rice RM8 a unit, RM7 from 5, RM6 from 10. A size
     between rungs is its rung's rate times the size, which is what a rate a unit means; both books round to the
     ringgit (LADDER_BY) so a rate of RM8 is not rounded to a ten. */
  candy:{fixed:{"1":60,"10":550,"30":1500}, rungs:[1,10,30], ceilingX:2, grid:{min:1, step:1, max:30}},
  /* 05 OCT 2026, HIS DECISION: each stated board is held between its floor, COGS times the size, and a ceiling of
     `ceilingX` times that floor, capped down to the book's grid. Twice the floor; rice two and a half, an assumption the
     changelog states. A typed price inside the band does not move. */
  rice:{fixed:{"1":8,"5":35,"10":60}, rungs:[1,5,10], ceilingX:2.5, grid:{min:1, step:1, max:10}}
};

const TIER_NAMES=['Ambassador','Titanium','Platinum','Gold','Silver'];

const SHRINK_ATTRIB=1;

const COST_BASIS={
  freightPerTrip:{rm:0, what:'RETIRED AS A STATED FIGURE (v503, his instruction of 07 Sep 2026): freight is typed on each lot as `freight`, and pxFreightRate() reads it per unit; this stands at 0 as the fallback for a book with no typed freight', ias2:'inventory', ref:'IAS 2.11 costs of purchase include transport and handling directly attributable to acquisition; rate and basis both stated by him 27 Aug 2026'},
  txnPerDelivery:{rm:0, what:'ONE delivery, to a customer who does not collect. NOT CHARGED since 06 Sep 2026, his instruction: the oil floor at 50 units had climbed over his stated RM 450 on the RM 10 of delivery alone, and his answer was to remove the delivery cost, so a delivered order carries the collected floor and no more', ias2:'period', ref:'IAS 2.16(d) selling costs are excluded from the cost of inventories; RM 10 stated by him 27 Aug 2026, replacing the RM50 v373 flagged as never derived'},
  deliveredShare:{v:0.20, what:'the share of orders delivered rather than collected; four in five come and collect', ias2:'period', ref:'stated by him 24 Aug 2026'},
  sampleShare:{v:0.5,    what:'the half of the leak that is samples, testers and advertising', ias2:'period', ref:'IAS 38.69 advertising and promotional costs are expensed as incurred'},
  abnormalNote:{ias2:'period', ref:'IAS 2.16(a) abnormal amounts of wasted materials are expensed in the period incurred'}
};

const PRICE_LOCK={
  salt:{lockedOn:'2026-08-06', lot:{date:'2026-07-28', qty:100, rate:47, sup:'SA5-BTR'},
        freight:0.2, landed:47.2,
        shrinkRaw:0.18869362693203473, shrink:0.18869362693203473, sampleLoad:10.9778,
        avgDel:2.7319, delN:58, txn:1.8302303566,
        absorbed:0, eff:60.008,
        why:'RE-LOCKED v244 on the same 28 Jul lot, at the 06 Aug count. The lot has not changed; '
           +'what changed is the leak behind it and the attribution in front of it. The 33.14 count '
           +'took the observed rate from 16.19% to 18.87%, and SHRINK_ATTRIB went to 1, so the whole '
           +'leak is now carried in the price and nothing is absorbed. Effective cost RM53.19 to RM60.01. '
           +'These numbers are the unlocked path’s own output, captured rather than hand-computed: '
           +'the lock was deleted, pxCost() run fresh at attrib 1, and the result written back here. '
           +'Absorbed is 0 by definition at full attribution.'},
  oil: {lockedOn:'2026-08-06', lot:{date:'2026-08-06', qty:50, rate:7, sup:'SP7-PUD'},
        freight:0.4, landed:7.4,
        shrinkRaw:0, shrink:0, sampleLoad:0,
        avgDel:10, delN:1, txn:0.5,
        absorbed:0, eff:7.9,
        why:'Locked on the first oil lot, the day it landed.'}
};

const PROFILE_RULE={
  frequentPerMonth:2,   // "frequent": two or more orders a month
  smallUpTo:1,          // "small": half a unit and one unit, his words
  smallShare:0.6,       //   and six in ten of their orders are that small
  bigFrom:3,            // three units and above, the book's upper quartile and his band
  biggerShare:0.4,      // "buying bigger": four in ten of their orders at three units or more
  loyalOrders:6,        // "loyal": six or more priced orders
  loyalWithinDays:30,   //   and the last within thirty days
  rarePerMonth:1,       // "rare": under one order a month
  rareAfterDays:60,     //   or nothing for sixty days
  spanFloorDays:30      // orders a month is read over at least thirty days, so one order last week is not four a month
};

const PRICING_RULES={ RULES, PRICE_ENGINE, LADDER_BY, TIER_RULE, TIER_NAMES, SHRINK_ATTRIB, COST_BASIS, PRICE_LOCK, PROFILE_RULE };
export default PRICING_RULES;
