/* Kat Consulting — behaviour layer: word-by-word headlines, one-shot reveals, story reading-focus,
 * photo parallax, hide-on-scroll header, mobile menu. No libraries, no network. Sleeps when idle. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;
  var $ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Split a headline into words (keeps <em> wrappers) so each word can rise into place. */
  function splitWords(el) {
    var n = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var outer = document.createElement("span");
            var inner = document.createElement("span");
            outer.className = "w";
            inner.className = "wi";
            inner.style.setProperty("--wi", n++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    // Each underline waits for its own last word to arrive before drawing in.
    Array.prototype.forEach.call(el.querySelectorAll("em"), function (em) {
      var words = em.querySelectorAll(".wi");
      if (words.length) em.style.setProperty("--em-end", words[words.length - 1].style.getPropertyValue("--wi"));
    });
    el.classList.add("is-split");
  }

  var reveals = $("[data-reveal], [data-split], [data-peek]");
  if (reduce || !hasIO) {
    reveals.forEach(function (el) { el.classList.add("is-in", "is-split"); });
  } else {
    $("[data-split]").forEach(splitWords);
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        seen.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { seen.observe(el); });
  }

  /* Story: the paragraph in the middle of the screen glows, passed ones settle, upcoming ones wait. */
  var story = $(".story-text p");
  if (story.length && !reduce && hasIO) {
    var focus = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) { el.classList.add("is-active"); el.classList.remove("is-read"); }
        else if (entry.boundingClientRect.top < 0) { el.classList.remove("is-active"); el.classList.add("is-read"); }
        else { el.classList.remove("is-active", "is-read"); }
      });
    }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
    story.forEach(function (p) { focus.observe(p); });
  } else {
    story.forEach(function (p) { p.classList.add("is-active"); });
  }

  /* Header: soft shadow once scrolled, tucks away on the way down, returns on the way up. */
  var header = document.querySelector(".site-header");
  var lastY = window.scrollY;
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-stuck", y > 8);
      var menuOpen = document.body.style.overflow === "hidden";
      if (!menuOpen && !reduce) {
        if (y > lastY + 4 && y > 160) header.classList.add("is-hidden");
        else if (y < lastY - 4 || y <= 160) header.classList.remove("is-hidden");
      }
    }
    lastY = y;
  }

  /* Photo parallax: prints drift at different speeds while the hero is in view (desktop only, compositor-only). */
  var drifters = $("[data-drift]");
  var heroVisible = true;
  var hero = document.querySelector(".hero");
  var wide = window.matchMedia("(min-width: 900px)");
  function drift() {
    var y = window.scrollY;
    drifters.forEach(function (el) { el.style.translate = "0 " + (-y * parseFloat(el.getAttribute("data-drift"))).toFixed(1) + "px"; });
  }
  if (drifters.length && !reduce && hasIO && hero) {
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; }).observe(hero);
  }


  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      if (heroVisible && drifters.length && !reduce && wide.matches) drift();
    });
  }, { passive: true });
  onScroll();

  /* Mobile menu */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      if (open && header) header.classList.remove("is-hidden");
    };
    toggle.addEventListener("click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    window.matchMedia("(min-width: 900px)").addEventListener("change", function () { setOpen(false); });
  }

  /* Printing: load lazy photos first so they appear on paper */
  window.addEventListener("beforeprint", function () { $("img[loading=lazy]").forEach(function (img) { img.loading = "eager"; }); });
  // Start the hero birds once fonts and the hero photo are ready (never later than 1.5s)
  var heroImg = document.querySelector(".hero-main img");
  var ready = [document.fonts ? document.fonts.ready : Promise.resolve()];
  if (heroImg && heroImg.decode) ready.push(heroImg.decode().catch(function () {}));
  Promise.race([Promise.all(ready), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
    document.documentElement.classList.add("birds-go");
  });
  // Flocks take off once, the first time they scroll into view
  var flocks = document.querySelectorAll("[data-flock]");
  if ("IntersectionObserver" in window) {
    var flockObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-flying"); flockObs.unobserve(entry.target); }
      });
    }, { threshold: 0.6, rootMargin: "0px 0px -30% 0px" });
    flocks.forEach(function (f) { flockObs.observe(f); });
  } else {
    flocks.forEach(function (f) { f.classList.add("is-flying"); });
  }
})();
