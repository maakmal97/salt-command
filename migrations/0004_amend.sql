-- 0004_amend.sql — let a draft be an AMENDMENT to an existing row, not only a new one.
--
-- WHY THIS EXISTS, AND WHY IT WAS NOT NEEDED UNTIL NOW. The drafter refused every amendment
-- from v302 to v322, on the stated ground that "which row it amends is a judgement". That was
-- true of an amendment arriving as free text with nothing identifying its target. It stopped
-- being true on 20 Aug 2026, when the phone's Amend tab started making you TAP a specific open
-- order and sending the desk's own ovKey for it. The judgement is made before the entry is
-- queued, by the person making it, which is exactly where it belongs.
--
-- Fulfilment is the commonest entry this book takes, 39 of them, and it was the last thing
-- that still required the laptop.
--
-- WHAT `amends` HOLDS: the ovKey of the target row, `party|date|total`, verbatim as the desk
-- composes it. An undated row's key really does carry the string "undefined" on both sides;
-- that is not a bug and must not be normalised, because ovFind matches on the same expression.
--
-- WHAT `row` HOLDS FOR AN AMENDMENT, and this is the part worth reading. It holds the TARGET
-- ROW AS IT STANDS TODAY, not the row as it will be. The drafter deliberately does NOT compute
-- the result: ovAmend in the master is layered, careful logic (a pending lot that stops being
-- pending, a partial receipt, the inTransit flag that exists to stop a deposit walking a whole
-- lot into the cost basis), and a second copy of it in a Worker would drift from the first the
-- day either changed. That is the same rule data.json obeys.
--
-- SO WHAT IS BEING APPROVED IS THE IDENTIFICATION AND THE FIGURES: is this the right row, and
-- is that what happened to it. The fold applies it, using the desk's own rules, where the desk
-- actually is.
--
-- kind is constrained on purpose. Fulfilment and Cancellation are mechanical once the row is
-- named. Modification joined them on 24 Aug 2026: the phone's Restate form carries newQty and
-- newTotal exactly as a Fulfilment carries cash and kg, so what changed is a figure typed
-- against a tapped order, not free text, and the drafter runs the same rate check on it that a
-- brand new row gets. Linked and Rewarded are still refused: neither form exists on the phone,
-- and each is a judgement about which OTHER row or which award applies, not a figure to check.

ALTER TABLE draft ADD COLUMN amends TEXT;
ALTER TABLE draft ADD COLUMN amend_kind TEXT;

-- An index because the commit run asks "is anything outstanding against this row" often enough
-- to be worth it, and because a second amendment drafted against a row that already has one
-- pending is a thing the drafter should be able to see cheaply.
CREATE INDEX IF NOT EXISTS draft_amends ON draft (amends) WHERE amends IS NOT NULL;
