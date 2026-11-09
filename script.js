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

  /* ================= sound — v8 (ui-sound-design skill) =================
     Every sound is synthesized with the Web Audio API: no audio files,
     nothing copied. Browsers block audio until a user gesture, so the
     AudioContext is created/resumed only from a gesture and sound stays
     OFF until the user turns it on (header toggle, remembered in
     localStorage). Master gain never exceeds 0.3; exponential ramps
     always end at 0.001, never 0 (ramping to 0 throws). */
  var soundOn = false, soundArmed = false;
  var actx = null, masterGain = null, noiseBuf = null;
  var pourSrc = null, pourFilter = null, pourGain = null, ambNodes = null;
  var soundBtn = document.getElementById("soundBtn");
  var lastSoundIdx = -1;

  function audioCtx(){
    if (!actx){
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        actx = new AC();
        masterGain = actx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(actx.destination);
        var len = actx.sampleRate;
        noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { actx = null; return null; }
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function playTone(freq0, freq1, dur, type, vol, delay){
    if (!soundOn) return;
    var c = audioCtx(); if (!c) return;
    var now = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq0, now);
    if (freq1 && freq1 !== freq0) o.frequency.exponentialRampToValueAtTime(freq1, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(masterGain);
    o.start(now); o.stop(now + dur + 0.05);
  }
  function playWhoosh(){
    if (!soundOn) return;
    var c = audioCtx(); if (!c || !noiseBuf) return;
    var now = c.currentTime;
    var src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.1;
    f.frequency.setValueAtTime(320, now);
    f.frequency.exponentialRampToValueAtTime(2600, now + 0.22);
    f.frequency.exponentialRampToValueAtTime(500, now + 0.4);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start(now); src.stop(now + 0.45);
  }
  function startAmbience(){
    var c = audioCtx(); if (!c || ambNodes) return;
    var g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(0.05, c.currentTime, 1.5);
    g.connect(masterGain);
    var o1 = c.createOscillator(); o1.type = "sine"; o1.frequency.value = 55;
    var o2 = c.createOscillator(); o2.type = "triangle"; o2.frequency.value = 82.41;
    var g2 = c.createGain(); g2.gain.value = 0.35;
    var lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    var lfoG = c.createGain(); lfoG.gain.value = 0.02;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    lfo.connect(lfoG); lfoG.connect(g.gain);
    o1.start(); o2.start(); lfo.start();
    ambNodes = { g: g, oscs: [o1, o2, lfo] };
  }
  function stopAmbience(){
    if (!ambNodes) return;
    var n = ambNodes; ambNodes = null;
    try {
      n.g.gain.setTargetAtTime(0.0001, actx.currentTime, 0.2);
      n.oscs.forEach(function(o){ try { o.stop(actx.currentTime + 0.6); } catch (e) {} });
      setTimeout(function(){ try { n.g.disconnect(); } catch (e) {} }, 700);
    } catch (e) {}
  }
  /* Pour noise: a looped filtered-noise stream whose loudness and
     brightness follow the pour progress (0..1). */
  function setPourLevel(level){
    if (!soundOn || level <= 0){ stopPourNoise(); return; }
    var c = audioCtx(); if (!c || !noiseBuf) return;
    if (!pourSrc){
      pourSrc = c.createBufferSource(); pourSrc.buffer = noiseBuf; pourSrc.loop = true;
      pourFilter = c.createBiquadFilter(); pourFilter.type = "bandpass";
      pourFilter.frequency.value = 600; pourFilter.Q.value = 0.7;
      pourGain = c.createGain(); pourGain.gain.value = 0.0001;
      pourSrc.connect(pourFilter); pourFilter.connect(pourGain); pourGain.connect(masterGain);
      pourSrc.start();
    }
    pourGain.gain.setTargetAtTime(0.03 + 0.13 * level, c.currentTime, 0.08);
    pourFilter.frequency.setTargetAtTime(420 + 900 * level, c.currentTime, 0.1);
  }
  function stopPourNoise(){
    if (!pourSrc) return;
    var src = pourSrc, g = pourGain;
    pourSrc = null; pourFilter = null; pourGain = null;
    try {
      if (actx){ g.gain.setTargetAtTime(0.0001, actx.currentTime, 0.05); src.stop(actx.currentTime + 0.3); }
      else src.stop();
    } catch (e) {}
  }
  function setSound(on){
    soundOn = on;
    if (soundBtn){
      soundBtn.textContent = on ? "SOUND ON" : "SOUND OFF";
      soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    try { localStorage.setItem("noctara-sound", on ? "1" : "0"); } catch (e) {}
    if (on){ audioCtx(); startAmbience(); }
    else { stopPourNoise(); stopAmbience(); }
  }
  function armSound(){
    if (soundOn && !soundArmed){ soundArmed = true; audioCtx(); startAmbience(); }
  }
  if (soundBtn) soundBtn.addEventListener("click", function(){
    setSound(!soundOn);
    if (soundOn) playTone(660, 880, 0.18, "sine", 0.18);
  });
  document.addEventListener("pointerdown", armSound);
  try {
    if (localStorage.getItem("noctara-sound") === "1"){
      soundOn = true;
      if (soundBtn){
        soundBtn.textContent = "SOUND ON";
        soundBtn.setAttribute("aria-pressed", "true");
      }
    }
  } catch (e) {}

  function layout(){
    SEG = Math.round(window.innerHeight * (window.innerWidth < 640 ? 1.02 : 1.3));
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
    /* sound: a whoosh rides each ink-wipe scene change; a soft chime
       marks arriving at the Taste scene */
    if (idx !== lastSoundIdx){
      if (lastSoundIdx >= 0) playWhoosh();
      lastSoundIdx = idx;
      if (scenes[idx] && scenes[idx].id === "taste"){
        playTone(523.25, 523.25, 0.5, "sine", 0.10);
        playTone(783.99, 783.99, 0.6, "sine", 0.08, 0.14);
      }
    }
  }
  function scrollToScene(i){
    playTone(1200, 900, 0.06, "sine", 0.10);
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
          /* derive state from the ScrollTrigger's own progress (the scroll
             target), not the lagging playhead, so jumps land correctly */
          var tNow = self.progress * N;
          var idx = Math.min(N - 1, Math.max(0, Math.round(tNow - 0.5)));
          setLive(idx);
          if (typeof window.__glIndex === "number" && window.__glIndex >= 0){
            window.__glProgress = Math.min(1, Math.max(0, tNow - window.__glIndex));
            window.__glNear = Math.abs(tNow - (window.__glIndex + 0.5)) < 1.6;
          }
        }
      }
    });

    scenes.forEach(function(sc, i){
      var img = sc.querySelector(".scene-img");
      var fades = sc.querySelectorAll(".caption, .scrub");
      var isFirst = i === 0, isLast = i === N - 1;

      /* scene visibility: the swap happens fast, hidden under the
         ink-wipe bars that sweep across at every boundary */
      if (isFirst){
        gsap.set(sc, { autoAlpha: 1 });
      } else {
        master.fromTo(sc, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, i - 0.1);
      }
      if (!isLast){
        master.to(sc, { autoAlpha: 0, duration: 0.1 }, i + 0.9);
      }
      /* ink-wipe bars: sweep in from the left, cover the swap, sweep out right */
      if (!isFirst){
        master.fromTo(".wipe",
          { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: 0.22, stagger: 0.05, ease: "power2.inOut", immediateRender: i === 1 },
          i - 0.32);
        master.to(".wipe",
          { scaleX: 0, transformOrigin: "right center", duration: 0.22, stagger: 0.05, ease: "power2.inOut", immediateRender: false },
          i + 0.03);
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
  function applySel(name, color){
    chosen = { name: name, color: color };
    root.style.setProperty("--sel", color);
    playTone(880, 420, 0.09, "sine", 0.22); /* bottle-select pop */
    if (selCaption) selCaption.textContent = "YOU CHOSE — " + name.toUpperCase();
    if (tasteNote) tasteNote.textContent = name + " — watch its colour rise.";
    window.dispatchEvent(new CustomEvent("noctara-select", { detail: { name: name, color: color } }));
    resetPour();
  }
  window.__setSel = applySel;
  document.querySelectorAll(".zone").forEach(function(z){
    z.style.setProperty("--zc", z.getAttribute("data-color"));
    z.addEventListener("click", function(){
      document.querySelectorAll(".zone").forEach(function(o){ o.classList.remove("selected"); });
      z.classList.add("selected");
      applySel(z.getAttribute("data-name"), z.getAttribute("data-color"));
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
    setPourLevel(fill / 100); /* pour noise follows the fill */
    if (fill >= 100){
      pouring = false; stream.classList.remove("on");
      stopPourNoise();
      playTone(523.25, 523.25, 0.4, "sine", 0.16); /* poured: soft chime */
      playTone(659.25, 659.25, 0.4, "sine", 0.14, 0.12);
      playTone(783.99, 783.99, 0.55, "sine", 0.12, 0.24);
      pourBtn.textContent = "POURED ✓"; pourBtn.classList.add("done");
      return;
    }
    pourRaf = requestAnimationFrame(pourLoop);
  }
  function resetPour(){
    fill = 0; pouring = false;
    if (pourRaf) cancelAnimationFrame(pourRaf);
    stopPourNoise();
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
      setPourLevel(0.05);
      pourRaf = requestAnimationFrame(pourLoop);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function(t){
      pourBtn.addEventListener(t, function(){
        pouring = false; stream.classList.remove("on");
        stopPourNoise();
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


  /* ================= polish: preloader, custom cursor, parallax ================= */
  var loader = document.getElementById("loader");
  if (loader){
    var loaderBar = document.getElementById("loaderBar");
    var loaderPct = document.getElementById("loaderPct");
    var lp = { v: 0 }, loadDone = false;
    var renderLp = function(){
      var v = Math.round(lp.v);
      if (loaderBar) loaderBar.style.width = v + "%";
      if (loaderPct) loaderPct.textContent = v + "%";
    };
    var hideLoader = function(){
      if (window.gsap){
        gsap.to(loader, { autoAlpha: 0, duration: 0.7, ease: "power2.inOut",
          onComplete: function(){ if (loader.parentNode) loader.remove(); } });
      } else {
        loader.classList.add("hide");
        setTimeout(function(){ if (loader.parentNode) loader.remove(); }, 700);
      }
    };
    var finishLoad = function(){
      if (loadDone) return; loadDone = true;
      if (window.gsap){
        gsap.to(lp, { v: 100, duration: 0.45, ease: "power1.out", onUpdate: renderLp, onComplete: hideLoader });
      } else hideLoader();
    };
    if (window.gsap){
      gsap.to(lp, { v: 88, duration: 1.6, ease: "power2.out", onUpdate: renderLp });
      window.addEventListener("load", finishLoad);
      setTimeout(finishLoad, 3500);
    } else hideLoader();
  }

  if (window.gsap && window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches){
    var cDot = document.getElementById("cursorDot");
    var cRing = document.getElementById("cursorRing");
    if (cDot && cRing){
      root.classList.add("has-cursor");
      gsap.set([cDot, cRing], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
      var dX = gsap.quickTo(cDot, "x", { duration: 0.12, ease: "power2.out" });
      var dY = gsap.quickTo(cDot, "y", { duration: 0.12, ease: "power2.out" });
      var rX = gsap.quickTo(cRing, "x", { duration: 0.45, ease: "power3.out" });
      var rY = gsap.quickTo(cRing, "y", { duration: 0.45, ease: "power3.out" });
      var cursorShown = false;
      window.addEventListener("mousemove", function(ev){
        if (!cursorShown){
          cursorShown = true;
          gsap.to([cDot, cRing], { autoAlpha: 1, duration: 0.3 });
        }
        dX(ev.clientX); dY(ev.clientY); rX(ev.clientX); rY(ev.clientY);
        var liveImg = document.querySelector("#stage .panel.live .scene-img");
        if (liveImg){
          gsap.to(liveImg, { x: (ev.clientX / window.innerWidth - 0.5) * 14,
            duration: 0.9, ease: "power2.out", overwrite: "auto" });
        }
      });
      document.querySelectorAll("a, button, .zone, .badge").forEach(function(el){
        el.addEventListener("mouseenter", function(){ cRing.classList.add("on"); });
        el.addEventListener("mouseleave", function(){ cRing.classList.remove("on"); });
      });
    }
  }

  /* ================= gravity: real-time WebGL (three.js) =================
     A real 3D scene built from code only (threejs-scene skill): ACES
     tone mapping, pixel ratio capped at 2, shared geometry/materials,
     fog for depth. The master timeline feeds it a local progress value;
     scroll dollies the camera through the floating ingredients, and
     rendering pauses while the scene is far from the playhead. */
  var glCanvas = document.getElementById("glCanvas");
  window.__glIndex = scenes.findIndex(function(sc){ return sc.id === "gravity"; });
  window.__glProgress = 0;
  window.__glNear = false;
  if (glCanvas && window.THREE){
    try {
      var renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      var scene3 = new THREE.Scene();
      scene3.fog = new THREE.FogExp2(0x12060a, 0.028);
      var camera3 = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera3.position.set(0, 0, 15);
      scene3.add(new THREE.AmbientLight(0x8a4a3a, 1.15));
      var key = new THREE.DirectionalLight(0xfff2d9, 1.6); key.position.set(4, 6, 8); scene3.add(key);
      var rim = new THREE.DirectionalLight(0xc82924, 1.2); rim.position.set(-6, -3, -4); scene3.add(rim);
      var group3 = new THREE.Group(); scene3.add(group3);
      var palette = [0xFBEB7F, 0x97F3AD, 0x72C5F6, 0xC82924, 0xF3F1E9];
      var geos = [ new THREE.SphereGeometry(0.5, 24, 18), new THREE.IcosahedronGeometry(0.45, 0), new THREE.TorusGeometry(0.42, 0.15, 12, 24) ];
      var mats = palette.map(function(c){ return new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.08, emissive: c, emissiveIntensity: 0.24 }); });
      var floaters = [];
      for (var fi = 0; fi < 46; fi++){
        var m3 = new THREE.Mesh(geos[fi % 3], mats[fi % palette.length]);
        m3.position.set((Math.random() - 0.5) * 17, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 9 - 1);
        var s3 = 0.5 + Math.random() * 1.05; m3.scale.set(s3, s3, s3);
        m3.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        m3.userData = { y0: m3.position.y, ph: Math.random() * 6.283, rs: (Math.random() - 0.5) * 0.9, fs: 0.5 + Math.random() * 0.8 };
        group3.add(m3); floaters.push(m3);
      }
      function sizeGL(){
        var w = glCanvas.clientWidth || window.innerWidth, h = glCanvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera3.aspect = w / h; camera3.updateProjectionMatrix();
      }
      sizeGL();
      window.addEventListener("resize", sizeGL);
      if (!window.gsap || !window.ScrollTrigger){
        window.__glProgress = 0.5;
        if ("IntersectionObserver" in window){
          new IntersectionObserver(function(en){ window.__glNear = en[0].isIntersecting; }).observe(glCanvas);
        } else { window.__glNear = true; }
      }
      var clock3 = new THREE.Clock();
      (function renderGL(){
        requestAnimationFrame(renderGL);
        if (!window.__glNear) return;
        var t = clock3.getElapsedTime();
        var p = window.__glProgress || 0;
        floaters.forEach(function(m){
          m.position.y = m.userData.y0 + Math.sin(t * m.userData.fs + m.userData.ph) * 0.55;
          m.rotation.y += 0.014 * m.userData.rs;
          m.rotation.x += 0.009 * m.userData.rs;
        });
        group3.rotation.y = (p - 0.5) * 0.9 + t * 0.02;
        camera3.position.z = 15.5 - p * 4.5;
        camera3.position.y = (p - 0.5) * 1.6;
        camera3.lookAt(0, 0, 0);
        renderer.render(scene3, camera3);
      })();
    } catch (e) { /* WebGL unavailable: the CSS gradient still carries the scene */ }
  }
})();
