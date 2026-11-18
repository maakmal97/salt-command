/* ambient.js: the little behaviour the components need. One file, no dependency, served from the
 * app's own origin (script-src 'self'); it writes no style attribute and no markup. Everything is
 * delegated from the document, so parts drawn later work without being wired.
 *
 *   data-amb-open="id"      opens the <dialog class="amb-sheet"> with that id
 *   data-amb-close          closes the sheet it is in; a tap on the scrim closes one too
 *   data-amb-copy="value"   copies that value (or, left empty, the .amb-plate__value inside) and says so
 *   .amb-segment__opt       presses itself and releases its neighbours, then fires amb:change
 *     data-amb-mood="name"  ...and takes the shell to that mood
 *   .amb-more               opens and closes the drawer named by aria-controls
 *   .amb-drop               shows a file being dragged over it, and hands the files its input accepts to that input
 *   .amb-handle             fires amb:move (detail.by: -1 or 1) on the up and down arrow keys; so does a
 *     data-amb-move="-1|1"  click on anything that carries this. The app does the moving.
 *   .amb-deck               a deck: the right and left arrow keys go to the next slide and the one before
 *   .amb-contents           a document's contents: a link takes the reader to its section, and the
 *                           link of the section on screen carries aria-current
 *   .amb-stepper            data-amb-step="-1|1" takes its field one step down or up, held between the
 *                           field's min and max; at either end that control carries aria-disabled. With
 *     data-amb-values="a b c" on the field, the steps walk that list (any figures, in order) instead: to the
 *                           next value above the figure, or the last below it, so a typed figure between two
 *                           stands and the next step lands on a value; the up and down arrow keys walk it too.
 *                           Either way the field then fires input, change and amb:change (detail.value)
 *   .amb-input--code        a one-time code: spaces and hyphens in what is typed or pasted are taken out
 *   .amb-slider__input      with data-amb-unit="%" (or any unit, empty for none), says its figure as it moves: the
 *                           field's .amb-slider__value and the input's aria-valuetext, signed when the range runs
 *                           below nought (+30%, \u221230%). Without data-amb-unit the app says the figure itself
 *
 * Nothing here waits on a transition or an animation ending: reduced motion sets both durations
 * to nothing, and a timer of nothing still fires. */
(function () {
  "use strict";
  var root = document.documentElement;

  /** A duration token in milliseconds, as the page has it now (0 under reduced motion). */
  function ms(name) {
    var v = getComputedStyle(root).getPropertyValue(name).trim(), n = parseFloat(v) || 0;
    return /ms$/.test(v) ? n : n * 1000;
  }

  /* ---- said aloud: a region that is always in the page, so a screen reader hears what a toast
     shows. While a sheet is open the page behind it cannot be reached, so the region is the one
     inside that sheet. The toast itself is for the eye and is hidden from the reader. ---- */
  function region(host) {
    for (var i = 0; i < host.children.length; i++) if (host.children[i].hasAttribute("data-amb-live")) return host.children[i];
    var live = document.createElement("div");
    live.className = "amb-vh";
    live.setAttribute("data-amb-live", "");
    live.setAttribute("role", "status");
    host.appendChild(live);
    return live;
  }
  /* the sheet on top, when sheets are stacked: the ones under it cannot be reached. The focus can
     only be in the top one, whatever the order in the markup; with no focus to go by, the last open. */
  function host() {
    var at = document.activeElement && document.activeElement.closest ? document.activeElement.closest("dialog[open]") : null;
    if (at) return at;
    var open = document.querySelectorAll("dialog[open]");
    return open.length ? open[open.length - 1] : document.body;
  }
  /* a region falls silent: nothing waiting to be written, nothing left written */
  function hush(live) {
    clearTimeout(live.ambSay);
    clearTimeout(live.ambSaid);
    live.ambNext = "";
    live.textContent = "";
  }
  function say(text) {
    var live = region(host());
    hush(live);
    /* emptied, then written a moment later, so the same words said twice are heard twice */
    live.ambNext = text;
    live.ambSay = setTimeout(function () { live.ambNext = ""; live.textContent = text; }, 60);
    /* said once, then gone: nobody reading on to the end of the page meets an old confirmation */
    live.ambSaid = setTimeout(function () { live.textContent = ""; }, 6000);
  }
  if (document.body) region(document.body); else document.addEventListener("DOMContentLoaded", function () { region(document.body); });

  /* ---- toast ---- */
  var toastTimer = 0;
  function toast(text, el) {
    say(text);
    el = el || document.querySelector("[data-amb-toast]");
    if (!el) return;
    (el.querySelector(".amb-toast__text") || el).textContent = text;
    /* a popover is shown again so it lands above a sheet opened since */
    if (el.hasAttribute("popover") && el.showPopover) {
      try { el.hidePopover(); } catch (e) { /* it was not open */ }
      try { el.showPopover(); } catch (e) { /* stay in the page */ }
    }
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-on");
      setTimeout(function () {
        if (el.classList.contains("is-on") || !el.hidePopover) return;
        try { el.hidePopover(); } catch (e) { /* already gone */ }
      }, ms("--amb-dur"));
    }, 2400);
  }

  /* ---- copy ---- */
  function legacyCopy(text) {
    var into = host(), ta = document.createElement("textarea"), had = document.activeElement;
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "amb-vh";
    into.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    into.removeChild(ta);
    /* the textarea took the focus to be read from: give it back, so a keyboard keeps its place */
    if (had && had.focus) had.focus();
    return ok ? Promise.resolve() : Promise.reject(new Error("copy refused"));
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  /* ---- mood and theme ---- */
  function mood(name, el) {
    el = el || root;
    if (el.getAttribute("data-mood") === name) return;
    el.classList.add("amb-glide");
    el.setAttribute("data-mood", name);
    clearTimeout(el.ambGlide);
    el.ambGlide = setTimeout(function () { el.classList.remove("amb-glide"); }, ms("--amb-dur") * 2 + 60);
  }
  /** "light", "dark", or nothing to follow the device. */
  function theme(name, el) {
    el = el || root;
    if (name) el.setAttribute("data-theme", name); else el.removeAttribute("data-theme");
  }

  /* ---- clicks ---- */
  /* where the press began: a selection dragged out of a sheet ends on the scrim, and is no tap on it */
  var down = { on: null, x: 0, y: 0 };
  document.addEventListener("pointerdown", function (e) { down = { on: e.target, x: e.clientX, y: e.clientY }; }, true);

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null, el;
    if (!t) return;

    if ((el = t.closest("[data-amb-open]"))) {
      var sheet = document.getElementById(el.getAttribute("data-amb-open"));
      if (sheet && sheet.showModal && !sheet.open) { sheet.showModal(); region(sheet); }
      return;
    }
    if ((el = t.closest("[data-amb-close]"))) {
      var inside = el.closest("dialog");
      if (inside) inside.close();
      return;
    }
    /* the scrim belongs to the dialog element, so a tap outside its box lands on the dialog itself */
    if (t.nodeName === "DIALOG" && t.classList.contains("amb-sheet")) {
      var r = t.getBoundingClientRect(), out = function (x, y) { return x < r.left || x > r.right || y < r.top || y > r.bottom; };
      if (out(e.clientX, e.clientY) && (down.on !== t ? !down.on : out(down.x, down.y))) t.close();
      return;
    }
    /* a contents link: to its section, in whatever scrolls it, with the focus so a keyboard reads
       on from there. Done here, not by the address, so it works where a page cannot change its own. */
    if ((el = t.closest(".amb-contents__link"))) {
      var to = document.getElementById((el.getAttribute("href") || "").slice(1));
      if (!to) return;
      e.preventDefault();
      to.setAttribute("tabindex", "-1");
      to.focus({ preventScroll: true });
      to.scrollIntoView();
      return;
    }
    if ((el = t.closest("[data-amb-step]"))) {
      var box = el.closest(".amb-stepper"), field = box && box.querySelector("input");
      if (!field || el.getAttribute("aria-disabled") === "true") return;
      stepBy(field, parseFloat(el.getAttribute("data-amb-step")) < 0 ? -1 : 1);
      return;
    }
    if ((el = t.closest("[data-amb-move]"))) {
      el.dispatchEvent(new CustomEvent("amb:move", { bubbles: true, detail: { by: parseInt(el.getAttribute("data-amb-move"), 10) < 0 ? -1 : 1 } }));
      return;
    }
    if ((el = t.closest(".amb-segment__opt"))) {
      if (el.getAttribute("aria-disabled") === "true") return;
      var seg = el.closest(".amb-segment"), opts = seg ? seg.querySelectorAll(".amb-segment__opt") : [];
      for (var i = 0; i < opts.length; i++) opts[i].setAttribute("aria-pressed", opts[i] === el ? "true" : "false");
      if (el.hasAttribute("data-amb-mood")) mood(el.getAttribute("data-amb-mood"), el.closest(".amb-shell") || root);
      el.dispatchEvent(new CustomEvent("amb:change", { bubbles: true, detail: { value: el.value || el.getAttribute("data-value") || "" } }));
      return;
    }
    if ((el = t.closest(".amb-more[aria-controls]"))) {
      var box = document.getElementById(el.getAttribute("aria-controls")), open = el.getAttribute("aria-expanded") !== "true";
      el.setAttribute("aria-expanded", open ? "true" : "false");
      if (box) box.hidden = !open;
      if (el.hasAttribute("data-amb-less")) {
        if (!el.hasAttribute("data-amb-more")) el.setAttribute("data-amb-more", el.textContent);
        el.textContent = el.getAttribute(open ? "data-amb-less" : "data-amb-more");
      }
      return;
    }
    if ((el = t.closest("[data-amb-copy]")) && el.getAttribute("aria-disabled") !== "true") {
      var from = el.querySelector(".amb-plate__value") || el, name = el.querySelector(".amb-plate__label");
      var given = el.getAttribute("data-amb-copy"), secret = el.closest(".amb-secret");
      /* a secret that is not shown has only its dots on the page: never copy those and call it copied */
      if (!given && secret && secret.getAttribute("data-state") !== "full") return;
      var label = el.getAttribute("data-amb-label") || (name ? name.textContent.trim() : "Value");
      var row = el;
      copy(given || from.textContent.trim()).then(function () {
        row.classList.add("is-copied");
        setTimeout(function () { row.classList.remove("is-copied"); }, 1200);
        toast(label + " copied");
      }, function () { toast("Could not copy"); });
    }
  });

  /* a sheet that closes takes its last words with it, so it does not greet the next opening with
     them. Words still waiting to be written when it closed were never heard: say them where the
     reader now is. */
  /* the cap (0.7.9): a work screen marks its shell data-amb-moved once its hero has passed under the app bar, or,
     with no hero, once it or a pane of it that runs under the bar has moved; the stylesheet then draws what scrolls
     from the bar's middle down. Read on every scroll (in the capture phase, since a scroll does not bubble), and again
     on a resize, a page shown again, any hidden attribute changed, and load, so a mark never outlives its cause */
  function shown(el) { return el && el.getClientRects().length > 0; }
  function cap(sc) {
    var shell = sc && sc.parentElement, bar = shell && shell.querySelector(":scope > .amb-appbar");
    if (!bar || !sc.classList.contains("amb-screen--docked")) return;
    var foot = bar.getBoundingClientRect().bottom, hero = [].filter.call(sc.querySelectorAll(":scope > .amb-hero, :scope .amb-place:not([hidden]) > .amb-hero"), shown)[0];
    var moved = hero ? hero.getBoundingClientRect().bottom <= foot : sc.scrollTop > 4;
    [].forEach.call(sc.querySelectorAll(".amb-split--panes > .amb-stack"), function (s) { if (shown(s) && s.scrollTop > 4 && s.getBoundingClientRect().top < foot) moved = true; });
    shell.toggleAttribute("data-amb-moved", moved);
  }
  function caps() { [].forEach.call(document.querySelectorAll(".amb-shell > .amb-screen--docked"), cap); }
  document.addEventListener("scroll", function (e) {
    var el = e.target;
    cap(el && el.classList && el.classList.contains("amb-screen") ? el : el && el.closest && el.closest(".amb-screen"));
  }, true);
  window.addEventListener("resize", caps);
  window.addEventListener("pageshow", caps);
  new MutationObserver(caps).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", caps); else caps();
  document.addEventListener("close", function (e) {
    var live = e.target && e.target.nodeName === "DIALOG" ? e.target.querySelector(":scope > [data-amb-live]") : null;
    if (!live) return;
    var unsaid = live.ambNext;
    hush(live);
    if (unsaid) say(unsaid);
  }, true);

  /* ---- a handle moves its row without a drag ---- */
  document.addEventListener("keydown", function (e) {
    var h = e.target && e.target.closest ? e.target.closest(".amb-handle") : null;
    if (!h || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    h.dispatchEvent(new CustomEvent("amb:move", { bubbles: true, detail: { by: e.key === "ArrowUp" ? -1 : 1 } }));
  });

  /* ---- a deck: the arrow keys go from slide to slide. The slide nearest the middle of the window
     is the one on show; the next one is brought to the middle. Nothing here sets a size. ---- */
  document.addEventListener("keydown", function (e) {
    var by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!by || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target && e.target.closest && e.target.closest("input, select, textarea, dialog, .amb-segment")) return;
    var slides = document.querySelectorAll(".amb-deck > .amb-slide"), at = 0, best = Infinity;
    if (!slides.length) return;
    for (var i = 0; i < slides.length; i++) {
      var r = slides[i].getBoundingClientRect(), off = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2);
      if (off < best) { best = off; at = i; }
    }
    e.preventDefault();
    slides[Math.max(0, Math.min(slides.length - 1, at + by))].scrollIntoView({ block: "center" });
  });

  /* ---- a file dragged over a drop zone ---- */
  /* a stepper's field and its two ends; a control at an end says so, and is still there to find. A field
     with data-amb-values walks that list, and its ends are the list's first and last */
  function values(field) {
    var raw = field.getAttribute("data-amb-values");
    if (!raw) return null;
    var list = raw.trim().split(/[\s,]+/).map(parseFloat).filter(function (n) { return !isNaN(n); }).sort(function (a, b) { return a - b; });
    return list.length ? list : null;
  }
  function ends(field) {
    var list = values(field);
    if (list) return { lo: list[0], hi: list[list.length - 1], list: list };
    var lo = parseFloat(field.min), hi = parseFloat(field.max);
    return { lo: isNaN(lo) ? -Infinity : lo, hi: isNaN(hi) ? Infinity : hi, step: parseFloat(field.step) || 1 };
  }
  /* one step down (-1) or up (1): along the list to the nearest value past the figure, or by the step */
  function stepBy(field, by) {
    var b = ends(field), v = parseFloat(field.value), next;
    if (b.list) {
      if (isNaN(v)) next = b.lo;
      else if (by > 0) next = b.list.filter(function (n) { return n > v + 1e-9; })[0];
      else next = b.list.filter(function (n) { return n < v - 1e-9; }).pop();
      if (next === undefined) next = by > 0 ? b.hi : b.lo;
    } else next = Math.min(b.hi, Math.max(b.lo, (isNaN(v) ? 0 : v) + by * b.step));
    if (String(next) === field.value) return;
    field.value = String(next);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.dispatchEvent(new CustomEvent("amb:change", { bubbles: true, detail: { value: field.value } }));
    say(field.value);
  }
  /* the arrow keys on a field that walks a list: the list's next or last value, never the browser's step */
  document.addEventListener("keydown", function (e) {
    var f = e.target;
    if (!f || !f.hasAttribute || !f.hasAttribute("data-amb-values") || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    stepBy(f, e.key === "ArrowUp" ? 1 : -1);
  });
  function bounds(box) {
    var field = box.querySelector("input"); if (!field) return;
    var b = ends(field), v = parseFloat(field.value) || 0;
    Array.prototype.forEach.call(box.querySelectorAll("[data-amb-step]"), function (c) {
      var at = parseFloat(c.getAttribute("data-amb-step")) < 0 ? v <= b.lo : v >= b.hi;
      if (at) c.setAttribute("aria-disabled", "true"); else c.removeAttribute("aria-disabled");
    });
  }
  document.addEventListener("input", function (e) {
    var f = e.target;
    if (!f || !f.classList) return;
    if (f.classList.contains("amb-input--code")) { var v = f.value.replace(/[\s-]+/g, ""); if (v !== f.value) f.value = v; }
    var box = f.closest(".amb-stepper");
    if (box) bounds(box);
    if (f.classList.contains("amb-slider__input")) slid(f);
  });
  function allSteppers() { Array.prototype.forEach.call(document.querySelectorAll(".amb-stepper"), bounds); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", allSteppers); else allSteppers();
  /* a slider that carries its unit: its figure in words, beside its label and to a screen reader */
  function slid(f) {
    if (!f.hasAttribute("data-amb-unit")) return;
    var v = parseFloat(f.value) || 0, signed = parseFloat(f.min) < 0, out = f.closest(".amb-slider"), unit = f.getAttribute("data-amb-unit");
    var text = (v > 0 && signed ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v) + unit;
    f.setAttribute("aria-valuetext", text);
    out = out && out.querySelector(".amb-slider__value");
    if (out) out.textContent = text;
  }

  function zoneOf(e) { return e.target && e.target.closest ? e.target.closest(".amb-drop") : null; }
  /* what the input would have taken from its own picker: its accept list, and one file unless it says multiple */
  function taken(input, files) {
    var accept = (input.getAttribute("accept") || "").toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(Boolean), out = [];
    for (var i = 0; i < files.length; i++) {
      var name = files[i].name.toLowerCase(), type = (files[i].type || "").toLowerCase();
      var fits = !accept.length || accept.some(function (a) {
        return a.charAt(0) === "." ? name.slice(-a.length) === a : a.slice(-2) === "/*" ? type.indexOf(a.slice(0, -1)) === 0 : type === a;
      });
      if (fits) out.push(files[i]);
    }
    return input.multiple ? out : out.slice(0, 1);
  }
  ["dragenter", "dragover"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var z = zoneOf(e);
      if (!z) return;
      e.preventDefault();
      z.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var z = zoneOf(e);
      if (!z || (type === "dragleave" && z.contains(e.relatedTarget))) return;
      z.classList.remove("is-over");
      if (type !== "drop") return;
      e.preventDefault();
      var input = z.querySelector('input[type="file"]');
      if (!input || !e.dataTransfer || !e.dataTransfer.files.length) return;
      var keep = taken(input, e.dataTransfer.files), left = e.dataTransfer.files.length - keep.length;
      if (left) z.dispatchEvent(new CustomEvent("amb:refused", { bubbles: true, detail: { count: left } }));
      if (!keep.length) return;
      try {
        var bag = new DataTransfer();
        keep.forEach(function (f) { bag.items.add(f); });
        input.files = bag.files;
      } catch (err) { return; }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  /* ---- a document's contents: the link of the section on screen is the current one ---- */
  function contents(nav) {
    var links = nav.querySelectorAll(".amb-contents__link"), i;
    if (!links.length || !("IntersectionObserver" in self) || nav.ambSpy) return;
    /* a section counts as on screen while it crosses the upper half of what scrolls it; the first of
       those is the current one, so the mark moves on as a section leaves by the top */
    var on = {};
    nav.ambSpy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { on["#" + en.target.id] = en.isIntersecting; });
      /* the first of those in the band, in the page's own order; with none in it, the mark stays */
      for (var first = -1, k = 0; k < links.length && first < 0; k++) if (on[links[k].getAttribute("href")]) first = k;
      if (first < 0) return;
      for (k = 0; k < links.length; k++) {
        if (k === first) links[k].setAttribute("aria-current", "location"); else links[k].removeAttribute("aria-current");
      }
    }, { root: nav.closest(".amb-screen"), rootMargin: "-8% 0px -45% 0px" });
    for (i = 0; i < links.length; i++) {
      var sec = document.getElementById((links[i].getAttribute("href") || "").slice(1));
      if (sec) nav.ambSpy.observe(sec);
    }
    /* until a section reaches that band the reader is at the head of the page: the first is current */
    if (!nav.querySelector("[aria-current]")) links[0].setAttribute("aria-current", "location");
  }
  function allContents() { Array.prototype.forEach.call(document.querySelectorAll(".amb-contents"), contents); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", allContents); else allContents();

  self.Ambient = { toast: toast, say: say, copy: copy, mood: mood, theme: theme, ms: ms, contents: contents };
})();
