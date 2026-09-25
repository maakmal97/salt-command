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

/* v769, HIS INSTRUCTION OF 21 SEP 2026: THE ACCOUNT IS READY, AND IT IS NOT A MONTH. Both messages
 * said "your statement of account for September 2026 is ready" and promised "each monthly statement
 * as it was issued", which was true of a monthly issue and is not true of what this is: ONE LIVE
 * DOCUMENT that keeps up with the orders, beside the prices and the order form. So the message hands
 * over an ACCOUNT rather than a document, says the three things it is for, and says where a question
 * goes. The sealed issues already sent are untouched and still open on the page.
 *
 * WHAT IT IS CAREFUL ABOUT: a question goes ON AN ORDER, because that is where the thread lives
 * (v751), and saying "ask us anything" would promise a channel that is not there. */
const INSIDE = "Inside you will find your statement of account, which keeps up with your orders, the "
  + "latest prices, and a form to place an order. If you have a question, write it on the order and I "
  + "will answer you there.";
const KEEPIT = "Keep it on your phone: on an iPhone tap Share, then Add to Home Screen; on Android tap "
  + "the three dots, then Install app.";
/* S1 1.3, 24 SEP 2026: ONLY WHERE THE READER REACHES THE DOOR, AND SAID WHERE IT HAPPENS. An iPhone's Home
 * Screen app keeps its own storage, so what Safari remembered never reaches it: the sign-in is made inside
 * the saved app. The link's message does not carry this at all: the link keeps the phone signed in
 * itself (S3 3.4), and never shows the door. */
const REMEMBER = "Open it from there and sign in with Keep me signed in ticked: it stays signed in, and Log out ends it.";

/** The message a customer gets: the link and the username, and no secret. */
export function linkMessage(row) {
  return "Your account is ready to use.\n\n"
    + "Open it here:\n" + row.url + "\n\n"
    + "Username: " + row.user + "\n"
    + "Your password is in a separate message.\n\n"
    + INSIDE + "\n\n" + KEEPIT + " " + REMEMBER;
}

/** THE ONE-TIME LINK (v710, his instruction of 18 Sep 2026: the shared link signs them in). One
 *  message, no password in it, and it says plainly what the link is: theirs, once, and not for
 *  passing on. It does not promise it cannot be forwarded, because it can.
 *  S3 3.4, HIS D1 OF 24 SEP 2026: THE LINK KEEPS THE PHONE SIGNED IN, and the message says so and names the
 *  username, so the customer knows what to type if they ever meet the door. It still carries no home screen
 *  steps: on an iPhone the saved app is carried across by a code the page shows, not by this message. */
export function signInMessage(row) {
  return "Your Salt Counter account is ready. Tap to open it on this phone:\n" + row.url + "\n\n"
    + "Your username is " + row.user + ". The link works once and keeps this phone signed in.\n\n"
    + INSIDE + "\n\n"
    + "Open it yourself and do not pass it on: anybody holding it can open your account until you "
    + "have used it. It stops working after three days; if it has, ask me for a new link.\n\n"
    + signInMalay(row);
}
/* S13 13.4, HIS D12 OF 24 SEP 2026: THE MESSAGE IS ENGLISH AND BAHASA MELAYU IN ONE (the plan's 13.4, from the design's
 * "the message, EN and BM in one"): it goes before the phone's language is known, so both halves travel, the English
 * first, which is where a paste into the door finds the username. The same words, the link above it, and no password. */
function signInMalay(row) {
  return "Akaun Salt Counter anda sudah sedia. Ketik pautan di atas untuk membukanya di telefon ini.\n\n"
    + "Nama pengguna anda ialah " + row.user + ". Pautan ini berfungsi sekali sahaja dan telefon ini kekal log masuk.\n\n"
    + "Di dalamnya ada penyata akaun anda, yang dikemas kini mengikut pesanan anda, harga terkini, dan borang untuk "
    + "membuat pesanan. Jika ada soalan, tulis pada pesanan itu dan saya akan jawab di situ.\n\n"
    + "Buka sendiri dan jangan kongsikan: sesiapa yang ada pautan ini boleh membuka akaun anda sehingga anda "
    + "menggunakannya. Pautan ini tamat selepas tiga hari; jika sudah tamat, minta pautan baharu daripada saya.";
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
