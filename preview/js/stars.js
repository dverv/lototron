// Объёмные хромированные звёзды, как в концепте: надутые фольгированные шарики, плавно вращаются. Без бликов — по просьбе дизайнера.
// Один общий WebGL-холст поверх страницы; каждая звезда привязана к DOM-элементу.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Звезда как фольгированный шарик из концепта: плоский контур звезды, «надутый» изнутри.
// Объём считаем как натянутую плёнку под давлением (уравнение Пуассона): поверхность
// получается гладкой, без рёбер от центра к лучам, тонкие кончики лучей сами выходят ниже.
export function puffyStar(R = 1, rIn = .52, h = .5, rings = 34, N = 240) {
  // контур: классическая пятиконечная звезда с прямыми сторонами, углы скруглены сглаживанием
  const M = 1440, raw = new Float32Array(M), lut = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    const a = i / M * Math.PI * 2, seg = Math.PI / 5;
    const k = Math.floor(((a - Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) / seg);
    const a0 = Math.PI / 2 + k * seg, a1 = a0 + seg;
    const r0 = k % 2 ? rIn : R, r1 = k % 2 ? R : rIn;
    const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0, x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1;
    const dx = Math.cos(a), dy = Math.sin(a), ex = x1 - x0, ey = y1 - y0;   // пересечение луча со стороной
    raw[i] = (x0 * ey - y0 * ex) / (dx * ey - dy * ex);
  }
  const W = 36, sig = 24;   // гауссово сглаживание радиуса по углу — скругляет кончики и впадины
  for (let i = 0; i < M; i++) {
    let sum = 0, wsum = 0;
    for (let j = -W * 2; j <= W * 2; j++) { const w = Math.exp(-j * j / (2 * sig * sig)); sum += raw[(i + j + M) % M] * w; wsum += w; }
    lut[i] = sum / wsum;
  }
  const rad = a => { const f = ((a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * M, i = Math.floor(f) % M, t = f - Math.floor(f); return lut[i] * (1 - t) + lut[(i + 1) % M] * t; };
  // 1) решаем ∇²u = -1 внутри контура на сетке, u = 0 снаружи
  const G = 200, span = 1.06, step = 2 * span / (G - 1);
  const u = new Float32Array(G * G), inside = new Uint8Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = -span + i * step, y = -span + j * step;
    inside[j * G + i] = Math.hypot(x, y) < rad(Math.atan2(y, x)) ? 1 : 0;
  }
  const h2 = step * step;
  for (let it = 0; it < 500; it++) {
    for (let j = 1; j < G - 1; j++) for (let i = 1; i < G - 1; i++) {
      const q = j * G + i; if (!inside[q]) continue;
      const v = (u[q - 1] + u[q + 1] + u[q - G] + u[q + G] + h2) / 4;
      u[q] += 1.9 * (v - u[q]);
    }
  }
  let umax = 0; for (const v of u) umax = Math.max(umax, v);
  const sample = (x, y) => {
    const fx = (x + span) / step, fy = (y + span) / step;
    const i = Math.min(G - 2, Math.max(0, Math.floor(fx))), j = Math.min(G - 2, Math.max(0, Math.floor(fy)));
    const tx = fx - i, ty = fy - j, q = j * G + i;
    return (u[q] * (1 - tx) + u[q + 1] * tx) * (1 - ty) + (u[q + G] * (1 - tx) + u[q + G + 1] * tx) * ty;
  };
  // 2) сетка: центр + кольца, повторяющие контур; кольца гуще у шва, где плёнка круто уходит вниз
  const outline = [];
  for (let i = 0; i < N; i++) {
    const a = Math.PI / 2 + i / N * Math.PI * 2, r = rad(a);
    outline.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const n = N, P = .5, T0 = .8, pos = [], nor = [], idx = [];
  // высота на полярной сетке (кольцо k, угол i). У самого шва значения сетки Пуассона «ступенчатые»,
  // поэтому после T0 плавно сводим высоту к нулю по параболе, сохраняя наклон.
  const ts = [0]; for (let k = 1; k <= rings; k++) ts.push(Math.sin(k / rings * Math.PI / 2));
  const U = ts.map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const [x, y] = outline[i];
    const at = t => Math.max(0, sample(x * t, y * t));
    const u0 = at(T0), s0 = (at(T0) - at(T0 - .03)) / .03, c = -(u0 + s0 * (1 - T0)) / ((1 - T0) ** 2);
    ts.forEach((t, k) => { const d = t - T0; U[k][i] = k === 0 ? umax : t <= T0 ? at(t) : Math.max(0, u0 + s0 * d + c * d * d); });
    U[rings][i] = 0;
  }
  const Z = U.map(row => Array.from(row, v => h * Math.pow(Math.min(1, v / umax), P)));
  const pt = (k, i) => { i = (i + n) % n; const [x, y] = outline[i]; return [x * ts[k], y * ts[k], Z[k][i]]; };
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    pos.push(0, 0, side * h); nor.push(0, 0, side);
    for (let k = 1; k <= rings; k++) for (let i = 0; i < n; i++) {
      const p = pt(k, i);
      pos.push(p[0], p[1], side * p[2]);
      // нормаль по соседям на полярной сетке: гладко и в центре, и у шва
      const a = pt(k, i + 1), b = pt(k, i - 1), c = pt(Math.min(rings, k + 1), i), d = pt(k - 1, i);
      const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2];
      const rx = c[0] - d[0], ry = c[1] - d[1], rz = c[2] - d[2];
      let nx = ty * rz - tz * ry, ny = tz * rx - tx * rz, nz = tx * ry - ty * rx;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      if (k === rings) { nz = 0; if (nx * p[0] + ny * p[1] < 0) { nx = -nx; ny = -ny; } }
      const l = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / l, ny / l, side * nz / l);
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
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// anchors: [{ el, ax, ay, dx, dy, size, tilt }] — ax/ay доля от рамки элемента (0..1), dx/dy и size в пикселях.
// sizeScale — множитель размера: на компьютере звёзды крупнее, как в концепте
export function createStars(anchors, { zIndex = 5, sizeScale = () => innerWidth >= 900 ? 1.5 : 1 } = {}) {
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

  const stars = anchors.map((a, i) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, mat); g.add(m);
    scene.add(g);
    return { ...a, g, m, phase: i * 2.1, speed: .55 + (i % 3) * .12, spin: 0 };
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
        st.spin = 1;
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
      const a = st.desk && innerWidth >= 900 ? { ...st, ...st.desk } : st;   // отдельная расстановка для компьютера
      const x = r.left + (a.ax ?? 0) * r.width + (a.dx ?? 0), y = r.top + (a.ay ?? 0) * r.height + (a.dy ?? 0);
      const bob = Math.sin(t * 1.3 + st.phase) * 3;
      st.g.position.set(x, -(y + bob), 0);
      const k = st.desk?.size && innerWidth >= 900 ? st.desk.size : st.size * sizeScale();
      st.g.scale.setScalar(k / 2);
      // вращение: плавное покачивание + иногда полный оборот
      st.spin = Math.max(0, st.spin - dt * .7);
      st.extra = ((st.extra ?? 0) + st.spin * dt * 14) % (Math.PI * 2);
      if (!st.spin) { const target = st.extra > Math.PI ? Math.PI * 2 : 0; st.extra += (target - st.extra) * .06; } // докручивается до целого оборота
      st.m.rotation.y = Math.sin(t * st.speed + st.phase) * 1.1 + st.extra;
      st.m.rotation.x = Math.sin(t * .7 + st.phase) * .25;
      st.m.rotation.z = (st.tilt ?? 0) + Math.sin(t * .5 + st.phase) * .12;
    }
    renderer.render(scene, camera);
  })(last);

  return { canvas };
}
