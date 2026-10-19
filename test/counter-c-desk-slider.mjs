/* test/counter-c-desk-slider.mjs: THE SLIDER ON THE DESK (Counter Batch C, P10, item 21; his word of 20 Oct 2026).
 *
 * Every strip of two to six options on the Desk is the system's sliding segmented control, .salt-segment: the parts strip of each
 * destination and the rail's Look switch. One track, equal columns (--n), the thumb at the chosen one (--i), set in the same handler
 * that moves the selection. Every check reads the Desk opened in jsdom (tools/payload.mjs openMaster) or the stylesheet it serves; each
 * was proved red by its own mutation (test/counter-c-desk-slider.mutations.json, tools/section.mjs).
 *   1  every destination of two parts or more draws its strip as a slider, --n its parts, --i and aria-selected on the open one
 *   2  a tap on another part moves --i and aria-selected together, and the tab stop with them; the strip redrawn on the same parts
 *      starts its thumb where it stood before the reflow, so it slides rather than jumps
 *   3  the rail's Look switch is a slider of two, Night held by aria-pressed and the recipe's active class, the thumb at it,
 *      Tide still greyed (disabled); lookMark moves the class and the thumb with the theme
 *   4  the recipe the Desk serves keeps each option 44px, and no layer of the Desk lowers it on a strip's option
 *   5  the thumb slides 0.25s, and not at all under reduced motion */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok, master }) {
  master = master || process.env.SALT_MASTER || join(REPO, "master", "salt_command.html");
  const { openMaster } = await import("../tools/payload.mjs");
  const starts = [];
  const { w } = await openMaster(master, { fresh: true, before: (win) => {
    Object.defineProperty(win.HTMLElement.prototype, "offsetWidth", { configurable: true, get() { if (this.classList.contains("vnav")) starts.push(this.style.getPropertyValue("--i")); return 0; } });
  } });
  const d = w.document;
  const views = w.eval("VIEWS.map(v=>({id:v.id,parts:[v.lead].concat(v.parts)}))");
  const strip = (id) => d.querySelector("#sec-" + id + " .vnav");
  const read = (nav) => {
    const b = [...nav.querySelectorAll("button")];
    return { cls: nav.classList.contains("salt-segment"), n: nav.style.getPropertyValue("--n"), i: nav.style.getPropertyValue("--i"),
      sel: b.findIndex((x) => x.getAttribute("aria-selected") === "true"), opts: b.every((x) => x.classList.contains("salt-segment__opt")), count: b.length };
  };

  /* ---- 1 ---- */
  const seen = [];
  for (const v of views.filter((x) => x.parts.length > 1)) {
    w.eval("switchTab(" + JSON.stringify(v.id) + ")");
    const nav = strip(v.id), r = nav ? read(nav) : null;
    seen.push([v.id, r]);
  }
  ok(seen.length >= 4 && seen.every(([id, r]) => r && r.cls && r.opts && r.count === views.find((x) => x.id === id).parts.length && r.n === String(r.count) && r.i === "0" && r.sel === 0)
    && seen.some(([, r]) => r.count === 3),
    "every destination of two parts or more draws a slider, --n its parts, the thumb and aria-selected on the lead: " + JSON.stringify(seen));

  /* ---- 2 ---- */
  w.eval("switchTab('stock')");
  strip("stock").querySelector('[data-s="sourcing"]').click();
  const after = read(strip("stock")), stop = [...strip("stock").querySelectorAll("button")].map((b) => b.tabIndex);
  ok(after.i === "2" && after.sel === 2 && stop.join() === "-1,-1,0",
    "a tap on Sourcing moves the thumb (--i 2), aria-selected and the tab stop together: " + JSON.stringify([after, stop]));
  starts.length = 0;
  strip("stock").querySelector('[data-s="forward"]').click();
  const back = read(strip("stock"));
  ok(back.i === "1" && back.sel === 1, "and a tap back on Next 30 days moves both to 1: " + JSON.stringify(back));
  ok(starts.join() === "2", "the redrawn strip starts its thumb at Sourcing, where it stood, before the reflow that lets it slide: " + JSON.stringify(starts));

  /* ---- 3 ---- */
  const look = d.querySelector(".look-switch"), lb = look ? [...look.querySelectorAll("[data-look]")] : [];
  const night = lb.find((b) => b.dataset.look === "night"), tide = lb.find((b) => b.dataset.look === "tide");
  ok(look && look.classList.contains("salt-segment") && look.style.getPropertyValue("--n") === "2" && look.style.getPropertyValue("--i") === "0"
    && night && night.classList.contains("salt-segment__opt--active") && night.getAttribute("aria-pressed") === "true"
    && tide && tide.classList.contains("salt-segment__opt") && !tide.classList.contains("salt-segment__opt--active") && tide.disabled,
    "the rail's Look switch is a slider of two, Night held and marked active, the thumb at it, Tide greyed: "
      + JSON.stringify(look && { cls: look.className, n: look.style.getPropertyValue("--n"), i: look.style.getPropertyValue("--i"), b: lb.map((b) => [b.className, b.getAttribute("aria-pressed"), b.disabled]) }));
  w.eval("document.documentElement.setAttribute('data-theme','tide');lookMark()");
  ok(tide.classList.contains("salt-segment__opt--active") && !night.classList.contains("salt-segment__opt--active") && look.style.getPropertyValue("--i") === "1"
    && tide.getAttribute("aria-pressed") === "true", "and lookMark moves the active class, aria-pressed and the thumb with the theme: " + JSON.stringify([tide.className, look.style.getPropertyValue("--i")]));
  w.close();

  /* ---- 4 and 5 ---- */
  const html = readFileSync(master, "utf8").replace(/\r\n/g, "\n");
  const opt = /\.salt-segment__opt \{[^}]*\}/.exec(html), before = /\.salt-segment::before \{[^}]*\}/.exec(html);
  const lower = [...html.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]*(?:\.vpill|\.salt-segment__opt|\.look-switch [^{]*)[^{}]*)\{([^}]*)\}/g)]
    .filter((m) => /min-height\s*:\s*(?!\s)(?!44px|var\(--tap\))/.test(m[2]) || /(?:^|;)\s*height\s*:/.test(m[2]));
  ok(opt && /min-height:\s*44px/.test(opt[0]) && lower.length === 0,
    "each slider option is 44px tall in the recipe the Desk serves, and no layer lowers it: " + JSON.stringify(lower.map((m) => m[0].slice(0, 120))));
  ok(before && /transition:\s*transform 0\.25s/.test(before[0]) && /@media \(prefers-reduced-motion: reduce\) \{\s*\.salt-segment::before \{ transition: none; \}/.test(html),
    "the thumb slides 0.25s, and not at all under reduced motion");
}
