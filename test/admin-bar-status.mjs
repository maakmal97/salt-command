import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

/* 19 Oct 2026, his word: Salt Admin's bar says where things stand, as the Desk's line does: a dot and Live or Offline, then Open or
   Closed with when that changes, off the hours his page already reads, then the clock. Offline when his read cannot reach the Counter,
   and once the sign-in has ended. It sends nothing of its own, and nothing of it reaches a customer's page.
   15 Nov 2026, THE MOVE TO AMBIENT: the bar is gone with the salt-ds frame. The live word and the clock are each place's hero's time line;
   the hours are a glass chip in Needs you's hero, its dot the chip's own, its state said in its word (the mesh carries the ink alone). */
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
    ok(!!live && live.className === "abarlive on" && live.textContent === "Live" && !!live.closest("#mHome > header.amb-hero > .amb-hero__time"),
      "Salt Admin's hero reads Live in its time line, the dot lit, while his reads reach the Counter: " + JSON.stringify(live && [live.className, live.textContent]));
    ok(!!hrs && !hrs.hidden && hrs.textContent === "Open to " + until && hrs.classList.contains("amb-chip") && hrs.classList.contains("amb-chip--glass") && !hrs.classList.contains("ashop--closed"),
      "and Open to the next change, off the hours his page reads, a glass chip: " + JSON.stringify(hrs && [hrs.hidden, hrs.textContent, hrs.className, until]));
    /* 20 Oct 2026 (canvas V26, his yes): the hours are a control, named with what a tap does, and a tap goes to Shop hours. 22 Oct 2026 (canvas Needs you):
       a glowing status chip at the bar's top right, its dot the system's glyph */
    ok(hrs.tagName === "BUTTON" && hrs.getAttribute("data-act") === "bar.hours" && hrs.getAttribute("aria-label") === "Open to " + until + ". Tap to change" && !!hrs.querySelector(".amb-chip__dot") && hrs.firstElementChild.classList.contains("amb-chip__dot"),
      "the hours are a chip, a button named with what a tap does: " + (hrs.getAttribute("aria-label") || ""));
    ok(!!hrs.parentElement && hrs.parentElement.matches("#mHome > header.amb-hero") && hrs.parentElement.lastElementChild === hrs && !hrs.closest(".amb-hero__time"),
      "the chip stands last in Needs you's hero, out of the time line, which keeps Live and the clock: " + (hrs.parentElement && hrs.parentElement.className));
    const css = [...D.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!/\.ashop|\.abar\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")) && /\.amb-chip \{/.test(css),
      "the chip is Ambient's, its size and its dot the part's own, and the page's layer draws none of it, nor a bar");
    ok(reads.filter((r) => r === "/hours").length === 0, "and the bar sends no read of its own: " + JSON.stringify(reads.filter((r) => r === "/hours")));
    status = { open: false, source: "schedule", nextChange: next.toISOString(), nextOpen: next.toISOString() };
    await again();
    ok(hrs.textContent === "Closed to " + n.weekday + " " + n.hour + ":" + n.minute && hrs.classList.contains("ashop--closed") && !hrs.classList.contains("ashop--paused"),
      "Closed, said in its word, to the day and time it opens, when the shop is shut by its hours: " + JSON.stringify([hrs.textContent, hrs.className]));
    status = { open: false, source: "manual", nextChange: soon.toISOString(), nextOpen: soon.toISOString() };
    await again();
    ok(hrs.textContent === "Paused to " + until && hrs.classList.contains("ashop--paused") && !hrs.classList.contains("ashop--closed"),
      "Paused, said in its word, to the moment his override ends, when he has shut the shop for now: " + JSON.stringify([hrs.textContent, hrs.className]));
    mode = "down";
    await again();
    ok(live.className === "abarlive off" && live.textContent === "Offline", "Offline, once his read cannot reach the Counter: " + JSON.stringify([live.className, live.textContent]));
    mode = "ok";
    await again();
    ok(live.className === "abarlive on", "and Live again on the next read that reaches it: " + live.className);
    status = { open: true, source: "schedule", nextChange: new Date(Date.now() - 1000).toISOString(), nextOpen: null };
    await again();
    ok(hrs.hidden && hrs.textContent === "", "an hours line whose moment has passed is not drawn: " + JSON.stringify([hrs.hidden, hrs.textContent]));
    mode = "lapsed";
    await again();
    ok(live.className === "abarlive off" && live.textContent === "Offline", "and Offline once the sign-in has ended: " + JSON.stringify([live.className, live.textContent]));
    /* last, since it moves him to Shop: a tap on the hours chip goes there */
    hrs.click(); await wait();
    const cur = D.querySelector('button[data-m][aria-current="page"]');
    ok(!!cur && cur.getAttribute("data-m") === "shop", "and a tap on the hours chip goes to Shop: " + (cur && cur.getAttribute("data-m")));
  } finally { dom.window.close(); process.off("unhandledRejection", swallow); }
  const customer = landingPage("abcd-efgh", "nbarc", null);
  ok(!/abarlive|abarhours|aBarLive|aBarHours|Offline: this device/.test(customer.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")), "and none of it reaches a customer's page, its rules apart, which sit under .adm");
}
