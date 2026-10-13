import { openMaster } from "../tools/payload.mjs";

/* 14 Oct 2026 (his review of Salt Account and the Desk): the Desk's header carries a live clock in Kuala Lumpur time, and a
   refusal from the Worker on the queue reads as the Worker's own words with the entry held, never as a server gone. The 409
   that refused every loan repayment (readBook never lifted loans) read "stopped answering" and switched to downloads. */
export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const kl = () => { const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; }); return p.hour + ":" + p.minute; };
    const clock = w.document.getElementById("deskClock");
    const before = kl(), shown = clock ? clock.textContent : null, after = kl();
    ok(!!clock && (shown === before || shown === after), "the Desk's header shows the time in Kuala Lumpur: " + JSON.stringify({ shown, before }));
    clock.textContent = "";
    w.document.dispatchEvent(new w.Event("visibilitychange"));
    ok(clock.textContent === kl() || clock.textContent === before, "and paints it again when the page comes back into view: " + JSON.stringify(clock.textContent));

    const box = w.document.createElement("div"); box.id = "wbSync"; w.document.body.appendChild(box);
    w.eval("qSyncState='server'");
    w.fetch = async () => ({ ok: false, status: 409, json: async () => ({ ok: false, error: "The loan no longer exists" }), text: async () => "" });
    const sent = await w.eval("qPost()");
    const state = w.eval("qSyncState");
    ok(sent === false && /The desk refused this: The loan no longer exists\. The entry is held on this device\./.test(box.textContent) && state === "server",
      "a 409 from the queue reads as the Worker's own words, the entry held, the desk still on the server: " + JSON.stringify({ sent, text: box.textContent, state }));
    w.fetch = async () => ({ ok: false, status: 502, json: async () => ({}), text: async () => "" });
    await w.eval("qPost()");
    ok(w.eval("qSyncState") === "download", "and a server error still falls back to downloads as before");
  } finally { try { w.close(); } catch (e) { } }
}
