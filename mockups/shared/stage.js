// Театральная 3D-сцена: бархатный занавес со складками, кулисы на золотых подхватах с кистями,
// ламбрекен с фестонами, луч прожектора, пол сцены и золотые искры в воздухе.
// Отдельный холст позади барабана. Перерисовывается ~30 раз в секунду (лёгкое колыхание ткани).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStage(canvas, { color = 0x153f31, sheen = 0x9cc9b3 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x041a12);
  scene.fog = new THREE.Fog(0x041a12, 30, 60);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = .25;
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 200);

  // ---- материалы: бархат (sheen даёт характерный отлив на складках), золото
  const velvet = new THREE.MeshPhysicalMaterial({ color, roughness: .92, sheen: 1, sheenRoughness: .38, sheenColor: new THREE.Color(sheen), side: THREE.DoubleSide });
  const velvetDark = velvet.clone(); velvetDark.color = new THREE.Color(color).multiplyScalar(.42); velvetDark.sheenColor = new THREE.Color(sheen).multiplyScalar(.4);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: .32 });

  // ---- свет
  scene.add(new THREE.HemisphereLight(0x9fd9bf, 0x050d0a, .35));
  const spot = new THREE.SpotLight(0xfff0d2, 1900, 0, .36, .8, 2);
  spot.position.set(2, 16, 16); spot.target.position.set(1.5, -1, 0); scene.add(spot, spot.target);
  const sideL = new THREE.SpotLight(0xffe2b8, 700, 0, .5, .9, 2); sideL.position.set(-14, 6, 10); sideL.target.position.set(-8, 0, 0); scene.add(sideL, sideL.target);
  const sideR = sideL.clone(); sideR.position.set(14, 6, 10); sideR.target.position.set(8, 0, 0); scene.add(sideR, sideR.target);

  // ---- задник: широкий занавес с неровными вертикальными складками
  const H = 26, backW = 70;
  const back = new THREE.PlaneGeometry(backW, H, 700, 24);
  {
    const p = back.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const z = .55 * Math.sin(x * 1.9) + .35 * Math.sin(x * 4.3 + 1.7) + .18 * Math.sin(x * 9.1 + .4) + .05 * Math.sin(y * .5 + x);
      p.setZ(i, z);
    }
    back.computeVertexNormals();
  }
  const backMesh = new THREE.Mesh(back, velvetDark); backMesh.position.set(0, 4, -3); scene.add(backMesh);

  // ---- кулиса: ткань, собранная подхватом на высоте tieY, ниже снова расходится
  function drape(width, tieY, side) {
    const g = new THREE.PlaneGeometry(width, H, 160, 90);
    const p = g.attributes.position, base = new Float32Array(p.array);
    const top = H / 2, bottom = -H / 2;
    g.userData.update = (t) => {
      for (let i = 0; i < p.count; i++) {
        let x = base[i * 3], y = base[i * 3 + 1];
        const u = (x + width / 2) / width;             // 0 — внешний край, 1 — внутренний
        const uu = side < 0 ? u : 1 - u;               // внешний край у стены
        // сжатие к подхвату: вверху ткань широкая, у подхвата узкая, ниже немного расходится
        const d = y - tieY;
        const squeeze = d > 0 ? .28 + .72 * Math.pow(Math.min(1, d / (top - tieY)), 1.6) : .28 + .45 * Math.pow(Math.min(1, -d / (tieY - bottom)), .8);
        const xx = (uu * squeeze) * width;              // от внешнего края внутрь
        const folds = (.38 + .55 * (1 - squeeze)) * Math.sin(uu * 22 + uu * uu * 6) + .12 * Math.sin(uu * 57 + 1.3);
        const sway = Math.sin(t * .6 + y * .25) * .08 * (1 - Math.abs(d) / H);
        const bulge = (1 - squeeze) * 1.2 * Math.sin(Math.PI * uu);   // ткань выпирает вперёд у подхвата
        p.setXYZ(i, (side < 0 ? xx : -xx) + sway, y, folds + bulge);
      }
      p.needsUpdate = true; g.computeVertexNormals();
    };
    g.userData.update(0);
    const m = new THREE.Mesh(g, velvet);
    // подхват: золотой шнур-кольцо и кисть
    const tie = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(width * .17, .14, 12, 48), gold); ring.rotation.x = Math.PI / 2; ring.scale.set(1, .55, 1);
    tie.add(ring);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.6, 8), gold); cord.position.set(side < 0 ? .6 : -.6, -.8, .9); tie.add(cord);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.28, 20, 14), gold); knob.position.set(side < 0 ? .6 : -.6, -1.65, .9); tie.add(knob);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.5, 24, 1, true), gold); tassel.position.set(side < 0 ? .6 : -.6, -2.5, .9); tie.add(tassel);
    tie.position.set((side < 0 ? 1 : -1) * width * .14, tieY, .6);
    const grp = new THREE.Group(); grp.add(m, tie);
    return { grp, geo: g };
  }

  // ---- ламбрекен: верхняя драпировка с фестонами (провисающими «гирляндами» ткани)
  function valance(width, swag) {
    const h = 3.2, g = new THREE.PlaneGeometry(width, h, 600, 30);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const v = (h / 2 - y) / h;                       // 0 — верх, 1 — низ
      const ph = ((x / swag) % 1 + 1) % 1;            // положение внутри фестона
      const sag = Math.sin(Math.PI * ph);             // провис
      const ny = y - v * sag * 1.4;
      const z = .9 * sag * v + .25 * Math.sin(x * 6 + v * 3) * v + .5;
      p.setXYZ(i, x, ny, z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, velvet);
    // золотая бахрома-кант по верху
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, width, 12), gold); rail.rotation.z = Math.PI / 2; rail.position.set(0, h / 2, .6);
    const grp = new THREE.Group(); grp.add(m, rail); return grp;
  }

  // ---- пол сцены: тёмный, слегка глянцевый, с пятном света
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x0a1f17, roughness: .45, metalness: .1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -6, 14); scene.add(floor);

  // ---- золотые искры в воздухе
  const N = 140, sp = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - .5) * 30; sp[i * 3 + 1] = Math.random() * 16 - 5; sp[i * 3 + 2] = Math.random() * 8 + 1; seeds[i] = Math.random() * 10; }
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(.3, 'rgba(255,214,140,.6)'); r.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: dot, size: .35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 }));
  scene.add(sparks);

  // ---- сборка под размер экрана: кулисы прижаты к краям видимой области
  let drapes = [], val = null, layout = { focusX: 0 };
  function build() {
    drapes.forEach(d => { scene.remove(d.grp); d.geo.dispose(); }); drapes = [];
    if (val) scene.remove(val);
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, a = w / h;
    camera.aspect = a; camera.position.set(0, 1.2, 24); camera.lookAt(0, .5, 0); camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 24, halfW = halfH * a;
    const dw = Math.min(halfW * .7, 10);             // ширина кулисы
    const tieY = -halfH * .25;
    const L = drape(dw, tieY, -1); L.grp.position.set(-halfW + dw * .06, .5, 1); scene.add(L.grp);
    const R = drape(dw, tieY, 1); R.grp.position.set(halfW - dw * .06, .5, 1); scene.add(R.grp);
    drapes = [L, R];
    val = valance(halfW * 2 + 4, Math.max(4.5, halfW * .55)); val.position.set(0, .5 + halfH - 1.2, 2); scene.add(val);
    renderer.setSize(w, h, false);
  }
  addEventListener('resize', build); build();

  let last = 0;
  (function loop(now) {
    requestAnimationFrame(loop);
    if (now - last < 33) return;                       // ~30 кадров в секунду достаточно для ткани
    last = now;
    const t = now / 1000;
    drapes.forEach(d => d.geo.userData.update(t));
    const p = sparkGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) + .006 + Math.sin(t + seeds[i]) * .002;
      if (y > 11) y = -5;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * .4 + seeds[i]) * .003);
    }
    p.needsUpdate = true;
    renderer.render(scene, camera);
  })(0);
}
