/* engine/pinned.mjs: S5 OF THE BOOK PLAN, THE CODES THE DESK'S OWN LOGIC QUOTES (28 Oct 2026).
 *
 * The fold refuses a rename of a party whose code is written into the master's own script (CJ4-OKR is named in DIAMOND and R0_NETWORK), because a
 * fold writes the book and never the master's code: the desk would name a party the book no longer has. It finds them by scanning the master
 * (tools/fold.mjs pinnedInMaster), which a Worker cannot do. The Book's tap books a rename only when this list says its code is free, so the list is
 * the master's scan written down. It may be LONGER than the scan (a code listed and no longer quoted is a rename left for a hand fold, the safe side)
 * and never shorter: the suite scans the master and fails when a quoted code is missing here. A code is pinned with everything under it (its `-R` bucket and an end buyer's `<code>-<n>-<place>`), as the fold finds them: it asks each code a rename would move. */
export const PINNED_CODES = ["CJ4-OKR", "SA5-BTR", "SP7-PUD", "CM6-HCM"];
export const isPinned = (code) => typeof code === "string" && PINNED_CODES.some((p) => code === p || code.startsWith(p + "-"));
