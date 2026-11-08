(function(){
  "use strict";
  var root = document.documentElement;

  /* ---- scene artwork (base64 data URIs from assets-data.js) ---- */
  var A = window.NOCTARA_ASSETS || {};
  document.querySelectorAll("[data-asset]").forEach(function(el){
    var key = el.getAttribute("data-asset");
    if (A[key]) el.style.backgroundImage = "url(" + A[key] + ")";
  });

  /* ================= scroll-driven stage engine =================
     The stage is fixed; page scroll SCRUBS the experience, like the
     reference site: scenes crossfade, the camera pushes in, captions
     slide, and the eyelids open — all tied to scroll position.      */
  var scenes = Array.prototype.slice.call(document.querySelectorAll("#stage .panel"));
  var spacer = document.getElementById("spacer");
  var progress = document.getElementById("progress");
  var dotsNav = document.getElementById("dots");
  var SEG = 0, VH = 0;

  var dots = scenes.map(function(sc, i){
    var b = document.createElement("button");
    b.setAttribute("aria-label", "Go to scene " + (i + 1) + (sc.id ? " (" + sc.id + ")" : ""));
    b.addEventListener("click", function(){
      window.scrollTo({ top: i * SEG, behavior: "smooth" });
    });
    dotsNav.appendChild(b);
    return b;
  });

  function layout(){
    VH = window.innerHeight;
    SEG = Math.round(VH * 1.3);
    spacer.style.height = ((scenes.length - 1) * SEG + VH) + "px";
  }
  layout();

  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
  function sstep(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t){ return 1 - Math.pow(1 - t, 3); }

  /* per-scene scrub targets */
  var sceneData = scenes.map(function(sc){
    return {
      el: sc,
      img: sc.querySelector(".scene-img"),
      fades: Array.prototype.slice.call(sc.querySelectorAll(".caption, .scrub")),
      lidTop: sc.querySelector(".lid-top"),
      lidBottom: sc.querySelector(".lid-bottom"),
      h1: sc.querySelector("h1"),
      fadeOutEls: Array.prototype.slice.call(sc.querySelectorAll(".mantra, .tagline, .scroll-hint"))
    };
  });

  var ticking = false;
  function update(){
    ticking = false;
    var y = window.scrollY || 0;
    var maxY = Math.max(1, (scenes.length - 1) * SEG);
    if (progress) progress.style.width = (clamp(y / maxY, 0, 1) * 100).toFixed(2) + "%";
    var best = -1, bestOp = 0;

    sceneData.forEach(function(d, i){
      var center = i * SEG;
      var start = center - SEG / 2;
      var lp = clamp((y - start) / SEG, 0, 1);           /* 0..1 through this scene */
      var dist = Math.abs(y - center);
      var op = clamp((SEG * 0.80 - dist) / (SEG * 0.38), 0, 1);
      d.el.style.opacity = op.toFixed(3);
      d.el.style.visibility = op <= 0.002 ? "hidden" : "visible";
      d.el.style.zIndex = i + 1;
      if (op > bestOp){ bestOp = op; best = i; }

      /* camera push-in + drift on the artwork */
      if (d.img){
        var e = easeOut(lp);
        d.img.style.transform =
          "translateY(" + ((lp - 0.5) * -38).toFixed(1) + "px) scale(" + (1.26 - 0.20 * e).toFixed(3) + ")";
      }
      /* captions & blocks: scrub in, then out (last scene stays) */
      var capO = sstep(0.16, 0.40, lp) * (i === sceneData.length - 1 ? 1 : 1 - sstep(0.84, 1.0, lp));
      d.fades.forEach(function(el){
        el.style.opacity = capO.toFixed(3);
        var rot = el.classList.contains("caption") && el.parentElement.classList.contains("scene") ? "" :
                  (el.classList.contains("caption") ? " rotate(-1.2deg)" : "");
        el.style.transform = "translateY(" + ((1 - capO) * 30).toFixed(1) + "px)" + rot;
      });
      /* eyelids scrub open with scroll */
      if (d.lidTop && d.lidBottom){
        var open = sstep(0.10, 0.62, lp);
        d.lidTop.style.transform = "scaleY(" + (1 - open).toFixed(3) + ")";
        d.lidBottom.style.transform = "scaleY(" + (1 - open).toFixed(3) + ")";
      }
      /* intro title: slow zoom, fades as you leave */
      if (d.h1){
        d.h1.style.transform = "scale(" + (1 + lp * 0.08).toFixed(3) + ")";
        d.h1.style.opacity = (1 - sstep(0.55, 0.97, lp)).toFixed(3);
        d.fadeOutEls.forEach(function(el){
          el.style.opacity = (1 - sstep(0.10, 0.45, lp)).toFixed(3);
        });
      }
    });

    scenes.forEach(function(sc, i){ sc.classList.toggle("live", i === best && bestOp > 0.55); });
    dots.forEach(function(b, i){ b.classList.toggle("on", i === best); });
  }
  function onScroll(){
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function(){ layout(); sizeCanvas(); update(); });
  update();

  /* nav links jump-scroll to their scene */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click", function(ev){
      var id = a.getAttribute("href").slice(1);
      var idx = scenes.findIndex(function(sc){ return sc.id === id; });
      if (idx >= 0){
        ev.preventDefault();
        window.scrollTo({ top: idx * SEG, behavior: "smooth" });
      }
    });
  });

  /* ================= hand scene: hold & drag red smears ================= */
  var canvas = document.getElementById("smear");
  var ctx = null, W = 0, H = 0, blobs = [], holding = false;
  function sizeCanvas(){
    if (!canvas) return;
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  if (canvas){
    ctx = canvas.getContext("2d");
    sizeCanvas();
    function pos(ev){
      var r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    canvas.addEventListener("pointerdown", function(ev){
      holding = true; canvas.setPointerCapture(ev.pointerId);
      var p = pos(ev); blobs.push({ x: p.x, y: p.y, r: 26, a: 0.5 });
    });
    canvas.addEventListener("pointermove", function(ev){
      if (!holding) return;
      var p = pos(ev);
      blobs.push({ x: p.x, y: p.y, r: 20 + Math.random() * 16, a: 0.45 });
      if (blobs.length > 260) blobs.splice(0, blobs.length - 260);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function(t){
      canvas.addEventListener(t, function(){ holding = false; });
    });
    (function draw(){
      if (ctx){
        ctx.clearRect(0, 0, W, H);
        blobs = blobs.filter(function(b){ return b.a > 0.01; });
        blobs.forEach(function(b){
          var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, "rgba(200,41,36," + b.a.toFixed(3) + ")");
          g.addColorStop(1, "rgba(200,41,36,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
          b.a *= 0.994; b.r += 0.25;
        });
      }
      requestAnimationFrame(draw);
    })();
  }

  /* ================= selection ================= */
  var selCaption = document.getElementById("selCaption");
  var tasteNote = document.getElementById("tasteNote");
  var chosen = null;
  document.querySelectorAll(".zone").forEach(function(z){
    z.style.setProperty("--zc", z.getAttribute("data-color"));
    z.addEventListener("click", function(){
      document.querySelectorAll(".zone").forEach(function(o){ o.classList.remove("selected"); });
      z.classList.add("selected");
      chosen = { name: z.getAttribute("data-name"), color: z.getAttribute("data-color") };
      root.style.setProperty("--sel", chosen.color);
      if (selCaption) selCaption.textContent = "YOU CHOSE — " + chosen.name.toUpperCase();
      if (tasteNote) tasteNote.textContent = chosen.name + " — watch its colour rise.";
      resetPour();
    });
  });

  /* ================= pour ================= */
  var pourBtn = document.getElementById("pourBtn");
  var pourFill = document.getElementById("pourFill");
  var pourPct = document.getElementById("pourPct");
  var stream = document.getElementById("stream");
  var fill = 0, pouring = false, pourRaf = null, lastT = 0;
  function renderPour(){
    var h = fill * 1.0;
    pourFill.setAttribute("y", (130 - h).toFixed(1));
    pourFill.setAttribute("height", h.toFixed(1));
    pourPct.textContent = Math.round(fill);
  }
  function pourLoop(t){
    if (!pouring) return;
    var dt = Math.min(64, t - lastT); lastT = t;
    fill = Math.min(100, fill + dt / 42); /* ~4.2s to full */
    renderPour();
    if (fill >= 100){
      pouring = false; stream.classList.remove("on");
      pourBtn.textContent = "POURED ✓"; pourBtn.classList.add("done");
      return;
    }
    pourRaf = requestAnimationFrame(pourLoop);
  }
  function resetPour(){
    fill = 0; pouring = false;
    if (pourRaf) cancelAnimationFrame(pourRaf);
    stream.classList.remove("on"); renderPour();
    if (pourBtn){ pourBtn.textContent = "HOLD TO POUR"; pourBtn.classList.remove("done"); }
  }
  if (pourBtn){
    pourBtn.addEventListener("pointerdown", function(ev){
      ev.preventDefault();
      if (!chosen){
        var idx = scenes.findIndex(function(sc){ return sc.id === "selection"; });
        if (idx >= 0) window.scrollTo({ top: idx * SEG, behavior: "smooth" });
        return;
      }
      if (fill >= 100) return;
      pouring = true; lastT = performance.now();
      stream.classList.add("on");
      pourRaf = requestAnimationFrame(pourLoop);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function(t){
      pourBtn.addEventListener(t, function(){
        pouring = false; stream.classList.remove("on");
        if (pourRaf) cancelAnimationFrame(pourRaf);
      });
    });
    renderPour();
  }

  /* ================= taste orbs ================= */
  var orbs = document.getElementById("orbs");
  if (orbs){
    for (var i = 0; i < 16; i++){
      var s = document.createElement("span");
      s.className = "orb";
      var size = 14 + Math.random() * 46;
      s.style.width = s.style.height = size.toFixed(0) + "px";
      s.style.left = (Math.random() * 96).toFixed(1) + "%";
      s.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + "s";
      s.style.animationDelay = (-Math.random() * 12).toFixed(1) + "s";
      orbs.appendChild(s);
    }
  }
})();
