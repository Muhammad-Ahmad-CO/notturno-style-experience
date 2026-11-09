/* NOCTARA — cellar scene: the Blender-built bottles (GLB) in real-time 3D.
   The model was modelled in Blender 5.2 (assets-src/make_bottles.py),
   exported as GLB and embedded base64 in assets-data.js as
   window.NOCTARA_MODELS.bottles, because the site ships as static text
   files. three.js is loaded as an ES module via the import map in
   index.html; if the CDN or WebGL is unavailable the panel's CSS
   gradient quietly carries the scene instead. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('glCanvas2');
const panel = document.getElementById('cellar');

if (canvas && panel && window.NOCTARA_MODELS && window.NOCTARA_MODELS.bottles) {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x12060a, 0.045);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);

    scene.add(new THREE.AmbientLight(0x8a4a3a, 1.2));
    const key = new THREE.DirectionalLight(0xfff2d9, 1.6);
    key.position.set(0.4, 0.7, 0.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc82924, 1.6);
    rim.position.set(-0.6, 0.3, -0.5);
    scene.add(rim);
    const glow = new THREE.PointLight(0xfbeb7f, 0.35, 2.5);
    glow.position.set(0, 0.1, 0.45);
    scene.add(glow);

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
      return {
        p: Math.min(1, Math.max(0, t - idx)),
        near: Math.abs(t - (idx + 0.5)) < 1.6
      };
    }

    const bin = atob(window.NOCTARA_MODELS.bottles);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    new GLTFLoader().parse(bytes.buffer, '', (gltf) => {
      const model = gltf.scene;
      model.position.y = -0.17;
      scene.add(model);
      window.__cellarReady = true;
      const clock = new THREE.Clock();
      (function render() {
        requestAnimationFrame(render);
        const s = state();
        if (!s.near) return;
        const t = clock.getElapsedTime();
        model.rotation.y = (s.p - 0.5) * 1.6 + t * 0.02;
        camera.position.set(0, 0.05 + (s.p - 0.5) * 0.06, 1.18 - s.p * 0.3);
        camera.lookAt(0, -0.01, 0);
        renderer.render(scene, camera);
      })();
    }, () => { /* parse failed: CSS gradient fallback */ });
  } catch (e) { /* WebGL unavailable: CSS gradient fallback */ }
}
