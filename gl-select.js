/* NOCTARA — selection scene in 3D: the same Blender bottles stand in the
   selection panel. The panel's three invisible click zones (left /
   centre / right thirds) already map to the three bottles, so picking
   stays exactly as before — this module only renders the bottles and
   steps the chosen one forward when script.js fires "noctara-select".
   Without WebGL or the CDN, the manga artwork and zones carry the scene. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('glCanvas3');
const panel = document.getElementById('selection');
const BY_COLOR = { '#FBEB7F': 'Ember', '#97F3AD': 'Mint', '#72C5F6': 'Moon' };

if (canvas && panel && window.NOCTARA_MODELS && window.NOCTARA_MODELS.bottles) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
    scene.add(new THREE.AmbientLight(0x8a4a3a, 1.2));
    const key = new THREE.DirectionalLight(0xfff2d9, 1.6);
    key.position.set(0.4, 0.7, 0.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc82924, 1.6);
    rim.position.set(-0.6, 0.3, -0.5);
    scene.add(rim);

    function size() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    size();
    window.addEventListener('resize', size);

    function state() {
      const panels = document.querySelectorAll('#stage .panel');
      const idx = Array.prototype.indexOf.call(panels, panel);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const t = total > 0 ? (window.scrollY / total) * panels.length : 0;
      return { p: Math.min(1, Math.max(0, t - idx)), near: Math.abs(t - (idx + 0.5)) < 1.6 };
    }

    const bin = atob(window.NOCTARA_MODELS.bottles);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    new GLTFLoader().parse(bytes.buffer, '', (gltf) => {
      /* one turntable group holds the model; per-product groups inside it
         hold each bottle so the chosen one can step forward */
      const table = new THREE.Group();
      scene.add(table);
      const model = gltf.scene;
      table.add(model);

      const groups = {};
      ['Ember', 'Mint', 'Moon'].forEach((k) => {
        const g = new THREE.Group();
        g.userData.key = k;
        g.userData.tz = 0;
        g.userData.ts = 1;
        table.add(g);
        groups[k] = g;
      });
      model.children.slice().forEach((node) => {
        const m = /_(Ember|Mint|Moon)$/.exec(node.name || '');
        if (m) groups[m[1]].attach(node); /* disc and anything else stays on the model */
      });
      table.position.y = -0.17;

      window.addEventListener('noctara-select', (e) => {
        const k = BY_COLOR[((e.detail && e.detail.color) || '').toUpperCase()];
        if (!k) return;
        Object.values(groups).forEach((g) => {
          const on = g.userData.key === k;
          g.userData.tz = on ? 0.15 : 0;
          g.userData.ts = on ? 1.07 : 0.96;
        });
        window.__selKey = k;
      });

      panel.classList.add('has-gl3');
      window.__selGlReady = true;
      (function render() {
        requestAnimationFrame(render);
        const s = state();
        if (!s.near) return;
        table.rotation.y = (s.p - 0.5) * 0.5;
        Object.values(groups).forEach((g) => {
          g.position.z += (g.userData.tz - g.position.z) * 0.08;
          const sc = g.scale.x + (g.userData.ts - g.scale.x) * 0.08;
          g.scale.setScalar(sc);
        });
        camera.position.set(0, 0.05, 1.14 - s.p * 0.22);
        camera.lookAt(0, -0.01, 0);
        renderer.render(scene, camera);
      })();
    }, () => { /* parse failed: artwork fallback */ });
  } catch (e) { /* WebGL unavailable: artwork fallback */ }
}
