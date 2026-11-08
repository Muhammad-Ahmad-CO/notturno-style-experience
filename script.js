(function(){
  "use strict";
  var root = document.documentElement;

  /* ---- scene artwork (base64 data URIs from assets-data.js) ---- */
  var A = window.NOCTARA_ASSETS || {};
  document.querySelectorAll("[data-asset]").forEach(function(el){
    var key = el.getAttribute("data-asset");
    if (A[key]) el.style.backgroundImage = "url(" + A[key] + ")";
  });

  var scenes = Array.prototype.slice.call(document.querySelectorAll("#stage .panel"));
  var spacer = document.getElementById("spacer");
  var progress = document.getElementById("progress");
  var dotsNav = document.getElementById("dots");
  var SEG = 0;

  function layout(){
    SEG = Math.round(window.innerHeight * 1.3);
    spacer.style.height = ((scenes.length - 1) * SEG + window.innerHeight) + "px";
  }
  layout();

  /* dots */
  var dots = scenes.map(function(sc, i){
    var b = document.createElement("button");
    b.setAttribute("aria-label", "Go to scene " + (i + 1) + (sc.id ? " (" + sc.id + ")" : ""));
    b.addEventListener("click", function(){ scrollToScene(i); });
    dotsNav.appendChild(b);
    return b;
  });

  function setLive(idx){
    scenes.forEach(function(sc, i){ sc.classList.toggle("live", i === idx); });
    dots.forEach(function(b, i){ b.classList.toggle("on", i === idx); });
  }
  function scrollToScene(i){
    var y = i * SEG;
    if (window.gsap && window.ScrollToPlugin){
      gsap.to(window, { duration: 1.1, ease: "power2.inOut", scrollTo: { y: y, autoKill: false } });
    } else {
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  /* ================= GSAP + ScrollTrigger engine =================
     Per the official gsap-scrolltrigger skill: register the plugin
     once, put ScrollTrigger on the top-level master timeline only,
     scrub it across the spacer's scroll range. Each scene owns one
     unit of timeline time: artwork push-in, crossfades, captions,
     eyelids — all choreographed as tweens.                        */
  if (window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);

    var N = scenes.length;
    var master = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: spacer,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        onUpdate: function(self){
          if (progress) progress.style.width = (self.progress * 100).toFixed(2) + "%";
          var idx = Math.min(N - 1, Math.floor(self.progress * N + 0.0001));
          /* active scene = the one whose segment the playhead sits in */
          idx = Math.min(N - 1, Math.max(0, Math.round(master.time() - 0.5)));
          setLive(idx);
        }
      }
    });

    scenes.forEach(function(sc, i){
      var img = sc.querySelector(".scene-img");
      var fades = sc.querySelectorAll(".caption, .scrub");
      var isFirst = i === 0, isLast = i === N - 1;

      /* scene visibility: crossfade in / out (first starts on, last stays on) */
      if (isFirst){
        gsap.set(sc, { autoAlpha: 1 });
      } else {
        master.fromTo(sc, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, i - 0.35);
      }
      if (!isLast){
        master.to(sc, { autoAlpha: 0, duration: 0.35 }, i + 0.65);
      }
      /* camera: slow push-in + drift across the whole segment */
      if (img){
        master.fromTo(img,
          { scale: 1.26, y: 19 },
          { scale: 1.06, y: -19, duration: 1 },
          i);
      }
      /* captions & blocks scrub in, then out */
      fades.forEach(function(el){
        master.fromTo(el,
          { autoAlpha: 0, y: 30 },
          { autoAlpha: 1, y: 0, duration: 0.24 },
          i + 0.16);
        if (!isLast){
          master.to(el, { autoAlpha: 0, y: -18, duration: 0.16, immediateRender: false }, i + 0.84);
        }
      });
      /* eyelids scrub open */
      var lidTop = sc.querySelector(".lid-top");
      var lidBottom = sc.querySelector(".lid-bottom");
      if (lidTop && lidBottom){
        gsap.set([lidTop, lidBottom], { scaleY: 1 });
        master.to([lidTop, lidBottom], { scaleY: 0, duration: 0.5, ease: "power1.inOut" }, i + 0.10);
      }
      /* intro choreography */
      var h1 = sc.querySelector("h1");
      if (h1){
        master.to(h1, { scale: 1.08, autoAlpha: 0, duration: 0.42, ease: "power1.in" }, i + 0.55);
        sc.querySelectorAll(".mantra, .tagline, .scroll-hint").forEach(function(el){
          master.to(el, { autoAlpha: 0, duration: 0.3, immediateRender: false }, i + 0.12);
        });
      }
      /* hold each scene until its segment ends */
      master.to({}, { duration: 0.0001 }, i + 0.9999);
    });

    setLive(0);
    window.addEventListener("resize", function(){ layout(); ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });
    ScrollTrigger.refresh();
  } else {
    /* CDN failed: static fallback so the page still reads top-to-bottom */
    root.classList.add("no-gsap");
    scenes.forEach(function(sc){ sc.classList.add("live"); });
    if (progress) progress.style.display = "none";
    if (dotsNav) dotsNav.style.display = "none";
  }

  /* nav links jump-scroll to their scene */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click", function(ev){
      var id = a.getAttribute("href").slice(1);
      var idx = scenes.findIndex(function(sc){ return sc.id === id; });
      if (idx >= 0){ ev.preventDefault(); scrollToScene(idx); }
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
    window.addEventListener("resize", sizeCanvas);
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
    pourFill.setAttribute("y", (130 - fill).toFixed(1));
    pourFill.setAttribute("height", fill.toFixed(1));
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
        if (idx >= 0) scrollToScene(idx);
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
