(function(){
  "use strict";
  var root = document.documentElement;

  /* ---- scene artwork (base64 data URIs from assets-data.js) ---- */
  var A = window.NOCTARA_ASSETS || {};
  document.querySelectorAll("[data-asset]").forEach(function(el){
    var key = el.getAttribute("data-asset");
    if (A[key]) el.style.backgroundImage = "url(" + A[key] + ")";
  });

  /* ---- reveal on scroll ---- */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting){ e.target.classList.add("in"); }
    });
  }, {threshold: 0.35});
  document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });
  var eyes = document.getElementById("eyes");
  if (eyes) io.observe(eyes);

  /* ---- parallax on scene artwork ---- */
  var imgs = Array.prototype.slice.call(document.querySelectorAll(".scene-img"));
  var ticking = false;
  function parallax(){
    ticking = false;
    var vh = window.innerHeight;
    imgs.forEach(function(img){
      var r = img.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var prog = (r.top + r.height/2 - vh/2) / (vh/2 + r.height/2); /* -1..1 */
      img.style.setProperty("--p", (prog * -34).toFixed(1) + "px");
    });
  }
  window.addEventListener("scroll", function(){
    if (!ticking){ ticking = true; requestAnimationFrame(parallax); }
  }, {passive:true});
  parallax();

  /* ---- hand scene: hold & drag red smears ---- */
  var canvas = document.getElementById("smear");
  if (canvas){
    var ctx = canvas.getContext("2d");
    var W, H, blobs = [], holding = false;
    function size(){
      var r = canvas.parentElement.getBoundingClientRect();
      W = canvas.width = Math.floor(r.width);
      H = canvas.height = Math.floor(r.height);
    }
    size(); window.addEventListener("resize", size);
    function pos(ev){
      var r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    canvas.addEventListener("pointerdown", function(ev){
      holding = true; canvas.setPointerCapture(ev.pointerId);
      var p = pos(ev); blobs.push({x:p.x, y:p.y, r:26, a:0.5});
    });
    canvas.addEventListener("pointermove", function(ev){
      if (!holding) return;
      var p = pos(ev);
      blobs.push({x:p.x, y:p.y, r:20 + Math.random()*16, a:0.45});
      if (blobs.length > 260) blobs.splice(0, blobs.length - 260);
    });
    ["pointerup","pointercancel","pointerleave"].forEach(function(t){
      canvas.addEventListener(t, function(){ holding = false; });
    });
    (function draw(){
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
      requestAnimationFrame(draw);
    })();
  }

  /* ---- selection ---- */
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

  /* ---- pour ---- */
  var pourBtn = document.getElementById("pourBtn");
  var pourFill = document.getElementById("pourFill");
  var pourPct = document.getElementById("pourPct");
  var stream = document.getElementById("stream");
  var fill = 0, pouring = false, pourRaf = null, lastT = 0;
  function renderPour(){
    var h = fill * 1.0; /* bowl interior: y 30..130 -> fill height max 100 */
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
    pourBtn.textContent = "HOLD TO POUR"; pourBtn.classList.remove("done");
  }
  if (pourBtn){
    pourBtn.addEventListener("pointerdown", function(ev){
      ev.preventDefault();
      if (!chosen){
        document.getElementById("selection").scrollIntoView({behavior:"smooth"});
        if (selCaption) selCaption.textContent = "FIRST — CHOOSE YOUR ELIXIR";
        return;
      }
      if (fill >= 100) return;
      pouring = true; lastT = performance.now();
      stream.classList.add("on");
      pourRaf = requestAnimationFrame(pourLoop);
    });
    ["pointerup","pointerleave","pointercancel"].forEach(function(t){
      pourBtn.addEventListener(t, function(){
        pouring = false; stream.classList.remove("on");
        if (pourRaf) cancelAnimationFrame(pourRaf);
      });
    });
    renderPour();
  }

  /* ---- taste orbs ---- */
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
