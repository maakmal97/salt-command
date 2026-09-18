/* stmt/send.js: THE WORDS A CUSTOMER IS SENT, in one place (v688).
 *
 * The laptop's send sheet (tools/stmt-send.mjs) and Send statement on the master account hand over
 * the same thing, so they say it with the same words: this module holds them, the tool imports it,
 * and the Worker builds each card's message from it. A second copy is how the two would drift, and
 * the message is the one part of the send a customer keeps.
 *
 * NOTHING UNDER stmt/ IMPORTS OUT OF stmt/, so this file imports nothing at all; the tool imports
 * IN, which is allowed and is the direction that keeps the Worker clean.
 *
 * THE PASSWORD IS NEVER IN A MESSAGE. It went by its own channel while it lived only on the
 * laptop, and it still does: the card copies it on its own, to the clipboard.
 *
 * SINCE v710 THERE IS A SECOND WAY TO SEND ONE, and it is the one he asked for: a link that signs
 * them in, so no message carries a password at all. signInMessage below is its words. This header
 * claimed that link already existed from v688 until v710, three lines above a function that sent a
 * password by a second channel; it did not exist, and the claim is corrected here rather than
 * quietly dropped. */

/** The month a date string belongs to, as a customer reads it. */
export function monthNameOf(issue) {
  const d = new Date(String(issue || "") + "T00:00:00Z");
  if (isNaN(d)) return "";
  /* Node and every browser write "Sept" for September in en-GB; the months are named here so a
     statement, a card and a message cannot differ by a letter. */
  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

/** The message a customer gets: the link and the username, and no secret. */
export function linkMessage(row, monthName) {
  return "Your statement of account" + (monthName ? " for " + monthName : "") + " is ready.\n\n"
    + "Open it here:\n" + row.url + "\n\n"
    + "Username: " + row.user + "\n"
    + "Your password is in a separate message.\n\n"
    + "The page shows every order from the start to today, and each monthly statement as it was "
    + "issued. Tick Remember me and that device stays signed in; Log out ends it.";
}

/** THE ONE-TIME LINK (v710, his instruction of 18 Sep 2026: the shared link signs them in). One
 *  message, no password in it, and it says plainly what the link is: theirs, once, and not for
 *  passing on. It does not promise it cannot be forwarded, because it can. */
export function signInMessage(row, monthName) {
  return "Your statement of account" + (monthName ? " for " + monthName : "") + " is ready.\n\n"
    + "This link signs you in, once:\n" + row.url + "\n\n"
    + "Open it yourself and do not pass it on: anybody holding it can open your statement until you "
    + "have used it. It stops working after a week.\n\n"
    + "The page shows every order from the start to today, and each monthly statement as it was "
    + "issued. Tick Remember me and that device stays signed in; Log out ends it.";
}

/** The second message: the password, and nothing that says which account it opens. */
export function passwordMessage(row) {
  return "Statement password: " + row.pw + "\n\n"
    + "Please keep it to yourself. It opens the statement at the link in the previous message.";
}

/** One line of where an account stands, as the card prints it under the code. */
export function totalsLine(t) {
  if (!t) return "";
  const m = (v) => Number(v || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t.n + " order" + (t.n === 1 ? "" : "s") + ", RM " + m(t.total)
    + (t.owed > 0 ? ", RM " + m(t.owed) + " outstanding" : "");
}
