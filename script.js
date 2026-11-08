/* NOCTARA — vanilla JS: reveal, parallax, eyes, hand canvas, selection, pour. */
(function () {
  "use strict";

  /* ---------- Reveal on scroll + scene triggers ---------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });

  function sceneTrigger(id, cls, threshold) {
    var el = document.getElementById(id);
    if (!el) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { el.classList.add(cls); io.disconnect(); }
      });
    }, { threshold: threshold || 0.4 });
    io.observe(el);
  }
  sceneTrigger("eyes", "eyes-open", 0.45);       // eyelids lift
  sceneTrigger("cathedral", "crumbled", 0.35);   // pillars crack + fall
  sceneTrigger("taste", "float-on", 0.3);        // antigravity drift starts

  /* ---------- Parallax (Approach scene layers) ---------- */
  var layers = Array.prototype.slice.call(document.querySelectorAll(".parallax"));
  var ticking = false;
  function parallax() {
    layers.forEach(function (layer) {
      var r = layer.parentElement.getBoundingClientRect();
      var speed = parseFloat(layer.getAttribute("data-speed") || "0.2");
      var offset = -r.top * speed;
      layer.style.transform = "translateY(" + offset.toFixed(1) + "px)";
    });
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(parallax); }
  }, { passive: true });
  parallax();

  /* ---------- Hand scene: hand follows pointer, canvas smears ---------- */
  var handScene = document.getElementById("hand");
  var handWrap = document.getElementById("handWrap");
  var canvas = document.getElementById("smearCanvas");
  var ctx = canvas.getContext("2d");
  var handX = 0, handY = 0, targetX = 200, targetY = 160, holding = false;

  function sizeCanvas() {
    var r = handScene.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  function scenePoint(evt) {
    var r = handScene.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  }
  handScene.addEventListener("pointermove", function (evt) {
    var p = scenePoint(evt);
    targetX = p.x; targetY = p.y;
    if (holding) smear(p.x, p.y);
  });
  handScene.addEventListener("pointerdown", function (evt) {
    holding = true;
    var p = scenePoint(evt);
    targetX = p.x; targetY = p.y;
    smear(p.x, p.y);
  });
  window.addEventListener("pointerup", function () { holding = false; });
  handScene.addEventListener("pointerleave", function () { holding = false; });

  function smear(x, y) {
    // Layered translucent blobs = wet paint dragged across wood.
    for (var i = 0; i < 3; i++) {
      var rad = 16 + Math.random() * 26;
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(88,10,8,0.34)");
      g.addColorStop(1, "rgba(88,10,8,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + (Math.random() * 22 - 11), y + (Math.random() * 14 - 7), rad * 1.5, rad * 0.7, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Smears slowly dry out / fade.
  setInterval(function () {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.045)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, 120);

  // Smooth (lerped) hand following, anchored by the fingertips.
  (function followHand() {
    handX += (targetX - handX) * 0.16;
    handY += (targetY - handY) * 0.16;
    var w = handWrap.offsetWidth || 220;
    handWrap.style.transform = "translate(" + (handX - w * 0.45) + "px," + (handY - w * 0.28) + "px) rotate(-4deg)";
    requestAnimationFrame(followHand);
  })();

  /* ---------- Drink selection (drives pour + taste colours) ---------- */
  var selected = null; // { name, color, key }
  var caption = document.getElementById("selectionCaption");
  var pourState = document.getElementById("pourState");

  document.querySelectorAll(".bottle-card").forEach(function (card) {
    card.addEventListener("click", function () {
      document.querySelectorAll(".bottle-card").forEach(function (c) {
        c.classList.remove("selected"); c.setAttribute("aria-pressed", "false");
      });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");
      selected = {
        name: card.getAttribute("data-name"),
        color: card.getAttribute("data-color"),
        key: card.getAttribute("data-key")
      };
      document.documentElement.style.setProperty("--selected", selected.color);
      caption.innerHTML = "CHOSEN: " + selected.name.toUpperCase() + " — NOW HOLD THE POUR.";
      resetPour();
      pourState.textContent = "READY: " + selected.name.toUpperCase() + ". HOLD THE BUTTON TO POUR.";
    });
  });

  /* ---------- Pour scene: hold to fill the glass ---------- */
  var pourBtn = document.getElementById("pourBtn");
  var pourPct = document.getElementById("pourPct");
  var glassFill = document.getElementById("glassFill");
  var pourBottle = document.getElementById("pourBottle");
  var pourStream = document.getElementById("pourStream");
  var progress = 0, pouring = false, rafId = null, lastTs = 0;
  var GLASS_TOP = 34, GLASS_BOTTOM = 126; // y-range inside the SVG clip

  function renderPour() {
    var h = (GLASS_BOTTOM - GLASS_TOP) * (progress / 100);
    glassFill.setAttribute("height", h.toFixed(1));
    glassFill.setAttribute("y", (GLASS_BOTTOM - h).toFixed(1));
    pourPct.textContent = Math.floor(progress) + "%";
  }
  function resetPour() {
    progress = 0; stopPour(); renderPour();
    pourBtn.disabled = false; pourBtn.textContent = "HOLD TO POUR";
  }
  function pourLoop(ts) {
    if (!pouring) return;
    if (lastTs) progress += (ts - lastTs) / 42; // ~100% in 4.2s of holding
    lastTs = ts;
    if (progress >= 100) {
      progress = 100; renderPour(); finishPour(); return;
    }
    renderPour();
    rafId = requestAnimationFrame(pourLoop);
  }
  function startPour() {
    if (progress >= 100) return;
    if (!selected) {
      pourState.textContent = "FIRST CHOOSE AN ELIXIR ABOVE — THE BOTTLE IS STILL CORKED.";
      document.getElementById("selection").scrollIntoView({ behavior: "smooth" });
      return;
    }
    pouring = true; lastTs = 0;
    pourBtn.classList.add("held");
    pourBottle.classList.add("pouring");
    pourStream.classList.add("on");
    pourState.textContent = "POURING " + selected.name.toUpperCase() + "…";
    rafId = requestAnimationFrame(pourLoop);
  }
  function stopPour() {
    pouring = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pourBtn.classList.remove("held");
    pourBottle.classList.remove("pouring");
    pourStream.classList.remove("on");
    if (progress > 0 && progress < 100) pourState.textContent = "PAUSED AT " + Math.floor(progress) + "% — HOLD AGAIN TO CONTINUE.";
  }
  function finishPour() {
    stopPour();
    pourBtn.disabled = true;
    pourBtn.textContent = "POURED ✓";
    pourState.textContent = "POURED — " + selected.name.toUpperCase() + ". SCROLL ON: IT IS TIME TO TASTE.";
  }
  pourBtn.addEventListener("pointerdown", function (e) { e.preventDefault(); startPour(); });
  pourBtn.addEventListener("pointerup", stopPour);
  pourBtn.addEventListener("pointerleave", stopPour);
  pourBtn.addEventListener("pointercancel", stopPour);
  window.addEventListener("blur", stopPour);
  renderPour();
})();
