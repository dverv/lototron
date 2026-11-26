// Объёмные хромированные звёзды, как в концепте: «пухлые», вращаются и вспыхивают бликом.
// Один общий WebGL-холст поверх страницы; каждая звезда привязана к DOM-элементу.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/+esm';

// «Надутая» пятиконечная звезда: от центра к краю профиль как у подушки.
function puffyStar(R = 1, r = .48, h = .4, rings = 12, per = 8) {
  const outline = [];
  for (let i = 0; i < 10; i++) {
    const a0 = Math.PI / 2 + i * Math.PI / 5, a1 = Math.PI / 2 + (i + 1) * Math.PI / 5;
    const r0 = i % 2 ? r : R, r1 = (i + 1) % 2 ? r : R;
    for (let j = 0; j < per; j++) {
      const t = j / per;
      outline.push([(1 - t) * Math.cos(a0) * r0 + t * Math.cos(a1) * r1, (1 - t) * Math.sin(a0) * r0 + t * Math.sin(a1) * r1]);
    }
  }
  const n = outline.length, pos = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    pos.push(0, 0, side * h);
    for (let k = 1; k <= rings; k++) {
      const t = k / rings, z = side * h * Math.pow(1 - t * t, .55);
      for (const [x, y] of outline) pos.push(x * t, y * t, z);
    }
    for (let i = 0; i < n; i++) {
      const a = base + 1 + i, b = base + 1 + (i + 1) % n;
      side > 0 ? idx.push(base, a, b) : idx.push(base, b, a);
    }
    for (let k = 1; k < rings; k++) {
      const o0 = base + 1 + (k - 1) * n, o1 = base + 1 + k * n;
      for (let i = 0; i < n; i++) {
        const a = o0 + i, b = o0 + (i + 1) % n, c = o1 + i, d = o1 + (i + 1) % n;
        side > 0 ? idx.push(a, c, d, a, d, b) : idx.push(a, d, c, a, b, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Блик-«искра»: четыре луча и мягкое свечение.
function sparkTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 40);
  glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(.25, 'rgba(255,255,255,.5)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff';
  for (const rot of [0, Math.PI / 2]) {
    g.save(); g.translate(64, 64); g.rotate(rot);
    g.beginPath(); g.moveTo(-62, 0); g.quadraticCurveTo(0, -3, 62, 0); g.quadraticCurveTo(0, 3, -62, 0); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// anchors: [{ el, ax, ay, dx, dy, size, tilt }] — ax/ay доля от рамки элемента (0..1), dx/dy и size в пикселях.
export function createStars(anchors, { zIndex = 5 } = {}) {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: String(zIndex) });
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.02).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(300, 500, 900); scene.add(key);
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -3000, 3000);

  const geo = puffyStar();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xe9eef4, metalness: 1, roughness: .14, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.5 });
  const sparkMat = new THREE.SpriteMaterial({ map: sparkTexture(), transparent: true, depthTest: false, blending: THREE.AdditiveBlending });

  const stars = anchors.map((a, i) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, mat); g.add(m);
    const s = new THREE.Sprite(sparkMat.clone()); s.position.set(.35, .55, .6); g.add(s);
    scene.add(g);
    return { ...a, g, m, s, phase: i * 2.1, speed: .55 + (i % 3) * .12, nextFlash: 1 + i * 1.3, flash: 0, spin: 0 };
  });

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.left = 0; camera.right = w; camera.top = 0; camera.bottom = -h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // по клику рядом со звездой — она делает быстрый оборот
  addEventListener('pointerdown', e => {
    for (const st of stars) {
      const p = st.g.position;
      if (Math.hypot(e.clientX - p.x, e.clientY + p.y) < st.size * .75) {
        st.spin = 1; st.flash = 1;
        // маленький салют из звёздочек прямо из звезды
        confetti({ particleCount: 36, spread: 80, startVelocity: 20, gravity: .7, ticks: 140, scalar: .8,
          origin: { x: p.x / innerWidth, y: -p.y / innerHeight }, shapes: ['star', 'circle'],
          colors: ['#f6ae4b', '#ffffff', '#17a463', '#e9b65a', '#dfe6ee'], zIndex: 40, disableForReducedMotion: true });
      }
    }
  });

  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    for (const st of stars) {
      const el = typeof st.el === 'function' ? st.el() : st.el;
      const r = el?.getBoundingClientRect();
      const visible = r && r.width > 0 && getComputedStyle(el).visibility !== 'hidden';
      st.g.visible = !!visible;
      if (!visible) continue;
      const x = r.left + (st.ax ?? 0) * r.width + (st.dx ?? 0), y = r.top + (st.ay ?? 0) * r.height + (st.dy ?? 0);
      const bob = Math.sin(t * 1.3 + st.phase) * 3;
      st.g.position.set(x, -(y + bob), 0);
      st.g.scale.setScalar(st.size / 2);
      // вращение: плавное покачивание + иногда полный оборот
      st.spin = Math.max(0, st.spin - dt * .7);
      st.extra = ((st.extra ?? 0) + st.spin * dt * 14) % (Math.PI * 2);
      if (!st.spin) { const target = st.extra > Math.PI ? Math.PI * 2 : 0; st.extra += (target - st.extra) * .06; } // докручивается до целого оборота
      st.m.rotation.y = Math.sin(t * st.speed + st.phase) * 1.1 + st.extra;
      st.m.rotation.x = Math.sin(t * .7 + st.phase) * .25;
      st.m.rotation.z = (st.tilt ?? 0) + Math.sin(t * .5 + st.phase) * .12;
      // блик: вспыхивает раз в несколько секунд
      st.nextFlash -= dt;
      if (st.nextFlash <= 0) { st.flash = 1; st.nextFlash = 2.5 + Math.random() * 3; }
      st.flash = Math.max(0, st.flash - dt * 1.6);
      const f = Math.sin(st.flash * Math.PI);
      st.s.material.opacity = f;
      st.s.scale.setScalar(.2 + f * 1.1);
      st.s.material.rotation = t * .8;
    }
    renderer.render(scene, camera);
  })(last);

  return { canvas };
}
