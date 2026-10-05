# Counter maker replacement inventory

The inventory is a source/control inventory, not owner acceptance. Desk write controls remain
available until the replacements pass genuine owner acceptance. All Counter Admin routes below
remain under the existing verified-owner `/all` boundary. A generic input route is not a
replacement for an absent control.

## Enter, ledger and Network

| Incumbent action and source | Actual Counter control | Route and shared handler | Restriction or remaining work |
|---|---|---|---|
| New sale/purchase, Workbench New order | Maker: Send trade for review | `/all/maker/inputs/sale` or `/purchase`; shared trade constructors | A proposed row, not acknowledgement; no board repricing |
| Inventory count, Workbench count | Maker: Record count | `/all/maker/inputs/stock-count`; `makerStockCount` | Count precedes lot roll; reorder remains derived |
| Borrow/lend, Workbench loan | Maker: Send loan for review | `/all/maker/inputs/loan`; shared loan constructor | Loan settlement remains a hand fold |
| Repayment, loan card | Maker: Send repayment for review | `/all/maker/inputs/repay`; shared repayment constructor and admission | Authoritative remaining capacity; reservations apply across roads |
| Gift, ledger/new-entry editor | Maker: Send gift for review | `/all/maker/inputs/gift`; shared constructor | Not a sale or a pricing change |
| Reward redemption or oldest-advance offset, `redeemRebate` | Maker: Redeem or offset | `/all/maker/inputs/redeem`; engine reward account and admission | Departed holders remain refused; reward-bearing books only |
| Automatic associate offset, `autoOffsets` after Approve load | No equivalent automatic proposal trigger | Existing Desk trigger uses shared offset constructor | Missing Counter trigger; manual redemption is not automatic-proposal parity |
| Set/clear held tier, `tierSet` | Maker: Send tier for review | `/all/maker/inputs/tier-set`; shared tier constructor | Current control chooses one level, not proposal bands or the late-payer offer |
| Accept unheld/unqueued tier proposals, `tierAcceptAll` | Maker: Accept tier proposals | `/all/maker/inputs/tier-accept-all` `{at}`; `makerTierAcceptAll` over the snapshot's `tierOf`, which the Desk's own `ruleProposal` drew | One `tierset` entry as the Desk builds it; held tiers, tiers already queued or waiting, fixed books and resale accounts skipped; nothing priced in the Worker; `tierOf` is as of the last fold's seed, not live |
| Hush a Whiteboard tip, `obsAct` (Snooze 7, Snooze 30, Dismiss) | Maker: Tips, Hush tip | `/all/maker/inputs/hush` `{at, id, until}` writes the Desk's KV `hush` map through the bridge (the Desk's keyed `GET/POST /hush`, which its own `obsAct` also posts to); the tips are the snapshot's `obs` (id, severity, title) | One store both surfaces share, `{tip id: day or null}`, past days pruned on each write; no queue entry, draft or fold; the Desk reads it on load and on opening Whiteboard, and in the cloud it alone decides a tip's state; `until` a day after today and within a year, or null to dismiss; Bring back stays on the Desk (`/hush` with `clear`); the tip card shows each id and "Hush in Maker"; the Desk control stays until A8; `obs` is as of the last fold's seed |
| Tier-card Add ID | Maker has general Add ID, not the tier-card workflow | `/all/maker/inputs/add-id` | Starting-tier/proposal workflow still needs equivalent coverage |
| Add ID, both Workbench registration paths | Maker: Encrypt and send Add ID | `/all/maker/inputs/add-id`; device code derivation and pair outbox | Official locality; plaintext name never sent; hard-coded rekeys refused |
| Amend ID/rekey, Workbench | Maker: Encrypt and send Amend ID | `/all/maker/inputs/amend-id`; pair CAS and fixed outbox | Names/places move together; historical prose keeps old code |
| Locality/exact map filing, `wbLinkRead`/placement | Maker: Queue map placement | `/all/maker/inputs/place`, `/all/maker/geo/expand`; shared locality/link logic | Exact points and addresses ciphertext-only; Maps/Waze filing on device |
| Sale/purchase Correction, ledger editor | Maker: Send amendment for review | `/all/maker/inputs/ledger-amend`; RID lookup, `checkCorrection`, `entryFault`, `rowRoom`, fold `payFault` | Current fields only; note/settlement prose/order-code and cancelled/defaulted-row edits still missing |
| Sale Fulfilment/Cancellation, Workbench | Same amendment form | Same route; shared constructors | No money/goods on Cancellation; moved goods or pending payment refuses |
| Purchase Payment/Receipt/Default, Workbench | Maker: Amend a ledger row, Payment, Receipt, Default on a purchase lot | Same route; the shared `ledgerAmendmentEntry` with the Workbench's status and line; `rowRoom` and the fold `payFault` | Payment is cash only and Receipt units only, each within what the lot can still take; Default only before units arrive and not behind money on its way. The drafter and fold take these three on a lot (05 Oct 2026, A4); owner acceptance unverified |
| Sale Modification, Workbench | No kind-equivalent control | Correction covers only supported field changes | Note/prose parity missing; not permission to rewrite sealed history |
| Linked/Rewarded, historical amendment kinds | Explicit refusal | Shared cloud amendment refusal and drafter | Business-rule restriction, not an implementation target to broaden |
| Associate tree, rank, contribution/reward ledgers, `tabNetwork`/`resellerCard` | Desk remains the checker | Counter account/associate reports are existing readers | Tree, vacancy/departure facts and decision-support readings are not write actions |

Network's visible trading action is Redeem/Offset on an eligible associate card.
`tabNetwork` and `resellerCard` do not contain a hidden referral/role-change submission:
their tree, departure/vacancy information and three ledgers are readings. Automatic offsets
originate from the Approve load, not from the visible Redeem button. These are separate coverage
items. A roster registration's association is not permission to accept a Linked amendment.

## Orders, claims and communications

| Incumbent action | Actual Counter control | Route and handler | Restriction or remaining work |
|---|---|---|---|
| Approve/reject proposed row | Maker: Order review, Approve row/Reject row | `/all/maker/drafts/<id>/approve` or `/reject`; native decisions | Claim rows cannot be approved generically; answer through their stage |
| Preview/one-order price/Accept | Maker: Order review, Preview/Accept order | `/all/maker/orders/<id>/preview` or `/accept`; native preview and stage digest | Floor remains; no `PRICE_SET` or board price |
| Ready | Maker: Mark ready | `/all/maker/orders/<id>/move` `{status, rid}`; native `deskMove`, the request id kept by the order book | Acknowledged orders only, held by the order book in the move's own step |
| Decline | Maker: Decline | Same move route, `note` an optional reason through `siteWords` | A placed order; the reason is written onto the order's history |
| Cancel | Maker: Cancel order | Same move route, `status: cancelled` (his decision of 05 Oct 2026) | Only while nothing is paid or claimed and no goods are out, as the Desk's own Cancel for the last two; a paid order is cancelled from the Desk, which carries the refund |
| Handover | Maker: Record handover | `/all/maker/orders/<id>/handed`; native stage tap | Stage approval and row checks remain |
| Cash | Maker: Record cash | `/all/maker/orders/<id>/cash`; native cash stage | Outstanding-advance and remaining-room restrictions |
| Order claim Received | Maker: Receive claimed/Confirm received | `/all/maker/orders/<id>/received`; native Received | Covered-on-book and richer claim-stage controls missing |
| Order Not found | Maker: Not found beside a waiting claim | `/all/maker/orders/<id>/notfound` `{claim, amount, rid}`; native `notFoundOrder` | The claim must still wait, at its own amount; a retry is answered from the order book |
| Stage retry | No visible control | Maker `again` route exists | A route alone is not UI coverage |
| Close/cancel/delivery amendments | None | Native stage/move semantics not fully exposed | Missing; no invented refund booking |
| Account claim preview/Received/Not found | None | Native `claimPreview`, `claimReceived`, `notFoundClaim` not bridged | Next bounded slice; preview rows/hash and approval effects must be shared |
| Slip view | None | Native `slipRelay` and read-only `/vault/key` not bridged | Next bounded slice; device-only decryption, non-extractable key, lock cleanup |
| Account Chat/No reply needed | Maker: Chat, Send reply/No reply needed | `/all/maker/threads[/<u>]`; checked relay and native thread receipt | Fixed ID/body; encrypted reload recovery; isolated serialized example threads |
| Notice Set/Clear/Read | Maker: Notice | `/all/maker/bulletin`; checked native bulletin relay | Confirm before wake; ambiguous readback never proves notification delivery |
| Order reply/No reply needed | Maker: Reply to the customer, Send reply, No reply needed (on an open order) | `/all/maker/orders/<id>/move` `{message}` or `{noReply: true}`, each with `rid`; `siteWords` | Quick replies missing; reasons and messages stay out of ledger notes |
| Customer order/history | Customer Orders; Accounts: View account orders | Customer routes and existing `/all/orders/<u>` | Existing owner route is a read, including example claims; not a maker decision |
| Place on behalf | Accounts: Place for them | `/all/maker/customers/<u>/orders`; native placement | Their sealed list and identity; no board override |
| Weekly/manual hours | Maker: Save weekly hours/temporary override/clear override | `/all/maker/hours` | Closed does not block placement; delayed acknowledgement is shown |

## Existing owner routes, not duplicated

| Existing Counter control | Existing route | Scope |
|---|---|---|
| Links: approve/decline/revoke/restore/level | `/all/refs` and `/all/refs/<id>/approve`, `/decline`, `/revoke`, `/restore`, `/level` | Guest-link management, distinct from customer held tiers |
| Account access/devices/signout/handover | `/all/account/<u>`, `/all/signout`, `/all/handover`, `/all/signin/<u>` | Existing owner account operations, not a new Network trading input |

## Retirement gates

The missing controls above remain open work. Local JWT fixtures prove server boundary behavior,
not a genuine owner session. Positive live owner/keyed-vault acceptance remains unverified.
No Desk input is retired on the strength of this inventory, a generated catalog, or the generic
Maker input allowlist. Pricing rules, restricted amendment kinds and sealed history remain
unchanged.
