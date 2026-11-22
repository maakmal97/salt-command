import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

/* 19 Oct 2026, his word: Salt Admin's bar says where things stand, as the Desk's line does: a dot and Live or Offline, then Open or
   Closed with when that changes, off the hours his page already reads, then the clock. Offline when his read cannot reach the Counter,
   and once the sign-in has ended. It sends nothing of its own, and nothing of it reaches a customer's page.
   15 Nov 2026, THE MOVE TO AMBIENT: the bar is gone with the salt-ds frame. The live word and the clock are each place's hero's time line;
   the hours are a glass chip in Needs you's hero, its dot the chip's own, its state said in its word (the mesh carries the ink alone).
   22 Nov 2026 (the place head, his answers of 22 Nov 2026): every place's status row, under its parts, says Live and the time, then the shop's state, each a dot and a word,
   not a glass chip: Live is a dot and its word, the state a quiet button with a label, the time its own word, and the row holds the same on every place and width. */
export async function run({ ok }) {
  const kl = (d, o) => { const p = {}; new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "Asia/Kuala_Lumpur", hourCycle: "h23" }, o)).formatToParts(d).forEach((x) => { p[x.type] = x.value; }); return p; };
  const swallow = () => { };
  process.on("unhandledRejection", swallow);
  /* an hour on, unless that crosses midnight in Kuala Lumpur, when the until line says the day instead */
  const soon = new Date(Date.now() + 60 * 60 * 1000), sameDay = kl(soon, { day: "2-digit" }).day === kl(new Date(), { day: "2-digit" }).day;
  /* 22 Oct 2026 (canvas Needs you): today its time; within six days the weekday and the time */
  const t = kl(soon, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", weekday: "short" });
  const until = sameDay ? t.hour + ":" + t.minute : t.weekday + " " + t.hour + ":" + t.minute;
  const next = new Date(Date.now() + 36 * 60 * 60 * 1000), n = kl(next, { hour: "2-digit", minute: "2-digit", weekday: "short" });
  let status = { open: true, source: "schedule", nextChange: soon.toISOString(), nextOpen: null }, mode = "ok";
  const reads = [];
  const answer = (body, code = 200) => ({ ok: code === 200, status: code, type: "basic", json: async () => body, text: async () => JSON.stringify(body) });
  const dom = new JSDOM(landingPage("", "nbar", { master: "", accounts: [] }), { url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async (u) => {
        const path = String(u); reads.push(path);
        if (mode === "down") throw new TypeError("Failed to fetch");
        if (mode === "lapsed") return answer({ ok: false }, 401);
        return path === "/all/maker/hours" ? answer({ ok: true, status, config: {} }) : answer({ ok: false, error: "fixture" }, 503);
      };
    } });
  const wait = () => new Promise((r) => setTimeout(r, 300));
  const again = async () => { dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange")); await wait(); };
  try {
    await wait();
    const D = dom.window.document, live = D.getElementById("aBarLive"), hrs = D.getElementById("aBarHours");
    /* 22 Nov 2026 (the place head): Live is a dot and its word, the first of the head's status row, its dot lit while his reads reach the Counter; no hero holds a time line any more */
    ok(!!live && live.className === "amb-status__live abarlive on" && live.textContent === "Live" && live.firstElementChild.classList.contains("amb-chip__dot")
      && live.matches("#mHome > .amb-head > .amb-status > :first-child") && !D.querySelector("header.amb-hero .abarlive, .amb-hero__time"),
      "Salt Admin's status row reads Live, a dot and its word, the dot lit, while his reads reach the Counter: " + JSON.stringify(live && [live.className, live.textContent]));
    /* 22 Nov 2026 (the place head): the state is Ambient's amb-status__state, a quiet button with a label, not a glass chip; Open takes the gain's dot (--pos), and its moment is a word of its own */
    const labelOf = () => hrs.querySelector(":scope > .amb-status__label"), wordOf = () => hrs.querySelector(":scope > .amb-status__label > .amb-status__word");
    ok(!!hrs && !hrs.hidden && hrs.textContent === "Open to " + until && hrs.classList.contains("amb-status__state") && hrs.classList.contains("amb-status__state--pos") && !hrs.classList.contains("amb-status__state--warn")
      && !hrs.classList.contains("amb-chip") && !hrs.classList.contains("ashop--closed"),
      "and Open to the next change, off the hours his page reads, a quiet button of the status row: " + JSON.stringify(hrs && [hrs.hidden, hrs.textContent, hrs.className, until]));
    ok(!!labelOf() && labelOf().firstChild.textContent === "Open" && !!wordOf() && wordOf().textContent === " to " + until,
      "its label says Open and the moment it next changes is a word of its own, which a phone does without: " + JSON.stringify([labelOf() && labelOf().textContent, wordOf() && wordOf().textContent]));
    /* 20 Oct 2026 (canvas V26, his yes): the hours are a control, named with what a tap does, and a tap goes to Shop hours. 22 Oct 2026 (canvas Needs you):
       a glowing status chip at the bar's top right, its dot the system's glyph. 22 Nov 2026 (the place head): the dot is the first of the button, then its label */
    ok(hrs.tagName === "BUTTON" && hrs.getAttribute("data-act") === "bar.hours" && hrs.getAttribute("aria-label") === "Open to " + until + ". Tap to change" && !!hrs.querySelector(".amb-chip__dot") && hrs.firstElementChild.classList.contains("amb-chip__dot"),
      "the state is a button named with what a tap does: " + (hrs.getAttribute("aria-label") || ""));
    /* 18 Nov 2026 (his answers B and D): the chip follows the time line, and the hero ends in its two moves, Ledger check and Approve, which a phone shows on Orders alone.
       22 Nov 2026 (the place head): the head's status row holds them in order, Live, the time, the state, Supply tight, then at its end Ledger and Approve, on every width */
    const row = hrs.parentElement, kids = row ? [...row.children] : [];
    ok(!!row && row.matches("#mHome > .amb-head > div.amb-status[role='group']") && hrs.previousElementSibling.matches("span.amb-status__time.clk[data-clock]") && hrs.previousElementSibling.previousElementSibling === live
      && hrs.nextElementSibling.matches("span.amb-status__flag[data-heat]") && row.lastElementChild.matches(".amb-status__end")
      && row.lastElementChild.querySelectorAll("button.amb-pill[data-ledger], button.amb-pill[data-approve]").length === 2
      && !D.querySelector("[data-wide]") && D.querySelector("#mHome > header.amb-hero").children.length === 1,
      "the state stands after the clock in the head's status row, under the parts: Live and the clock first, Ledger and Approve at its end, and the hero holds the title alone: " + kids.map((k) => k.className.split(" ")[0]).join(" "));
    const css = [...D.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!/\.ashop|\.abar\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")) && /\.amb-status__state \{/.test(css) && /\.amb-status__live > \.amb-chip__dot \{/.test(css),
      "the state and the live line are Ambient's (amb-status), their size and their dot the part's own, and the page's layer draws none of it, nor a bar");
    ok(reads.filter((r) => r === "/hours").length === 0, "and the bar sends no read of its own: " + JSON.stringify(reads.filter((r) => r === "/hours")));
    status = { open: false, source: "schedule", nextChange: next.toISOString(), nextOpen: next.toISOString() };
    await again();
    ok(hrs.textContent === "Closed to " + n.weekday + " " + n.hour + ":" + n.minute && hrs.classList.contains("ashop--closed") && !hrs.classList.contains("ashop--paused") && !/amb-status__state--/.test(hrs.className),
      "Closed, said in its word, to the day and time it opens, when the shop is shut by its hours, its dot the third ink: " + JSON.stringify([hrs.textContent, hrs.className]));
    status = { open: false, source: "manual", nextChange: soon.toISOString(), nextOpen: soon.toISOString() };
    await again();
    ok(hrs.textContent === "Paused to " + until && hrs.classList.contains("ashop--paused") && hrs.classList.contains("amb-status__state--warn") && !hrs.classList.contains("ashop--closed"),
      "Paused, said in its word, to the moment his override ends, when he has shut the shop for now, its dot a warning's: " + JSON.stringify([hrs.textContent, hrs.className]));
    mode = "down";
    await again();
    ok(live.className === "amb-status__live abarlive amb-status__live--off off" && live.textContent === "Offline" && live.firstElementChild.classList.contains("amb-chip__dot"),
      "Offline, once his read cannot reach the Counter, its dot the loss's colour: " + JSON.stringify([live.className, live.textContent]));
    mode = "ok";
    await again();
    ok(live.className === "amb-status__live abarlive on" && live.textContent === "Live", "and Live again on the next read that reaches it: " + live.className);
    status = { open: true, source: "schedule", nextChange: new Date(Date.now() - 1000).toISOString(), nextOpen: null };
    await again();
    ok(hrs.hidden && hrs.textContent === "", "an hours line whose moment has passed is not drawn: " + JSON.stringify([hrs.hidden, hrs.textContent]));
    mode = "lapsed";
    await again();
    ok(live.className === "amb-status__live abarlive amb-status__live--off off" && live.textContent === "Offline", "and Offline once the sign-in has ended: " + JSON.stringify([live.className, live.textContent]));
    /* last, since it moves him to Shop: a tap on the state goes there */
    hrs.click(); await wait();
    const cur = D.querySelector('button[data-m][aria-current="page"]');
    ok(!!cur && cur.getAttribute("data-m") === "shop", "and a tap on the state goes to Shop: " + (cur && cur.getAttribute("data-m")));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
  const customer = landingPage("abcd-efgh", "nbarc", null);
  ok(!/abarlive|abarhours|aBarLive|aBarHours|Offline: this device/.test(customer.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")), "and none of it reaches a customer's page, its rules apart, which sit under .adm");
}
