// 3D-лототрон: шестигранный акриловый барабан с ручкой, купоны с физикой.
// Макеты 26.11: белый барабан, свои купоны зелёные. Основа — site/js/drum.js. Наружу — небольшой API (см. createDrum).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm';

// ---------- геометрия барабана ----------
// шестигранная призма, ось вращения — X (слева направо)
const RH = 2.4;                        // радиус описанной окружности шестигранника
const AP = RH * Math.cos(Math.PI / 6); // апофема (расстояние до грани)
const L = 4.8;                         // длина барабана
const T = 0.3;                         // толщина стенок-коллайдеров
const H = RH + 0.75;                   // от оси до подставки
const X = new THREE.Vector3(1, 0, 0);
const SEG = Math.PI / 3;
const SIZE_ME = new THREE.Vector3(1.3, .65, .035);
const SIZE_ALL = new THREE.Vector3(.5, .25, .025);
const MAX_MINE_BODIES = 100;           // больше в личный барабан физически не кладём

export async function createDrum(canvas, { onTouch = () => {} } = {}) {
  await RAPIER.init();

  // ---------- рендер ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe3ff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(4, 8, 6); scene.add(sun);
  const rim = new THREE.PointLight(0xfff0b0, 22, 20); rim.position.set(-5, 1, -3); scene.add(rim);

  const red = new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, metalness: 0, roughness: .28, clearcoat: 1, clearcoatRoughness: .08 }); // белый лак
  const yellow = new THREE.MeshStandardMaterial({ color: 0xdde3ea, metalness: 1, roughness: .2 }); // хром
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.13, roughness: 0.04,
    metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide });

  // барабан (вращается)
  const drum = new THREE.Group(); scene.add(drum);
  for (let k = 0; k < 6; k++) {
    const phi = k * SEG;
    const p = new THREE.Mesh(new THREE.BoxGeometry(L, 0.03, RH), acrylic);
    p.quaternion.setFromAxisAngle(X, phi);
    p.position.set(0, Math.cos(phi) * AP, Math.sin(phi) * AP);
    p.renderOrder = 2; drum.add(p);
    const va = phi + Math.PI / 6;                     // рёбра — по вершинам
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, L, 10), red);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, Math.cos(va) * RH, Math.sin(va) * RH);
    drum.add(bar);
  }
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(RH, RH, 0.03, 6), acrylic);
    cap.rotation.z = Math.PI / 2; cap.position.x = s * L / 2; cap.renderOrder = 2; drum.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RH, 0.07, 10, 6), red);
    ring.rotation.y = Math.PI / 2; ring.position.x = s * L / 2; drum.add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 32), red);
    hub.rotation.z = Math.PI / 2; hub.position.x = s * (L / 2 + 0.07); drum.add(hub);
    for (let k = 0; k < 3; k++) {                     // спицы на торцах — точно в вершины
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, RH * 2, 0.06), red);
      sp.position.x = s * (L / 2 + 0.02); sp.rotation.x = Math.PI / 6 + k * SEG; drum.add(sp);
    }
  }
  const hatch = new THREE.Group();                    // люк на грани k=0
  [[1.4, .07, 0, .55], [1.4, .07, 0, -.55], [.07, 1.17, .7, 0], [.07, 1.17, -.7, 0]].forEach(([w, d, x, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, .07, d), red); b.position.set(x, 0, z); hatch.add(b);
  });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), red); knob.position.set(0, .07, 0); hatch.add(knob);
  hatch.position.y = AP + .04; drum.add(hatch);
  const crank = new THREE.Group();                    // ручка-кривошип справа
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.1, .14), red); arm.position.y = .5; crank.add(arm);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .6, 16),
    new THREE.MeshStandardMaterial({ color: 0x0c5a3e, roughness: .35, metalness: 0 }));
  grip.rotation.z = Math.PI / 2; grip.position.set(.3, 1.0, 0); crank.add(grip);
  crank.position.x = L / 2 + 0.75; drum.add(crank);

  // стойки (неподвижные)
  const stand = new THREE.Group(); scene.add(stand);
  const rod = (a, b, r, mat = yellow) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 16), mat);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    stand.add(m);
  };
  for (const s of [-1, 1]) {
    const x = s * (L / 2 + 0.45), top = new THREE.Vector3(x, 0, 0);
    rod(top, new THREE.Vector3(x, -H, 1.5), .08);
    rod(top, new THREE.Vector3(x, -H, -1.5), .08);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.2, 20, 14), red); cap.position.copy(top); stand.add(cap);
  }
  rod(new THREE.Vector3(-L / 2 - .6, 0, 0), new THREE.Vector3(L / 2 + .8, 0, 0), .07); // ось
  const base = new THREE.Mesh(new THREE.BoxGeometry(L + 1.8, .22, 3.6),
    new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: .6, roughness: .35 }));
  base.position.y = -H - .11; stand.add(base);

  // ---------- текстуры купонов ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function ticketTexture({ a, b, ink, name, num }) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 512, 256); grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = ink; g.globalAlpha = .4; g.lineWidth = 5; g.strokeRect(14, 14, 484, 228);
    g.setLineDash([10, 10]); g.beginPath(); g.moveTo(384, 20); g.lineTo(384, 236); g.stroke(); g.setLineDash([]);
    g.globalAlpha = .25; g.fillStyle = ink;
    g.beginPath(); g.arc(0, 128, 24, 0, 7); g.fill(); g.beginPath(); g.arc(512, 128, 24, 0, 7); g.fill();
    g.globalAlpha = 1; g.fillStyle = ink; g.textBaseline = 'middle';
    g.font = '900 62px Montserrat, sans-serif'; g.fillText('КУПОН', 40, 88);
    g.font = '800 30px Montserrat, sans-serif'; g.fillText(name, 42, 150, 330);
    g.font = '700 18px Montserrat, sans-serif'; g.globalAlpha = .7; g.fillText('КОНКУРС-ЛОТЕРЕЯ · 30.12', 42, 200);
    g.globalAlpha = 1;
    g.save(); g.translate(448, 128); g.rotate(-Math.PI / 2); g.textAlign = 'center';
    g.font = '900 40px Montserrat, sans-serif'; g.fillText(num, 0, 0, 200); g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  }
  const goldEdge = new THREE.MeshStandardMaterial({ color: 0x0b6640, metalness: .1, roughness: .5 });
  const whiteEdge = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .1, roughness: .5 });
  const faceMat = map => new THREE.MeshStandardMaterial({ map, metalness: .25, roughness: .32 });
  const mats = (edge, face) => [edge, edge, edge, edge, face, face];
  const GOLD = { a: '#1aa866', b: '#0b6640', ink: '#ffffff' }; // свои — зелёные
  const whiteTex = ticketTexture({ a: '#ffffff', b: '#f1f5f3', ink: '#0c5a3e', name: 'участник', num: '№' });

  // ---------- физика ----------
  let world, drumBody, coupons = [], meshes = [], textures = [], mode = 'me', ghostMat = null, myName = '';
  let angle = 0, w = 5;               // при загрузке — приветственный оборот
  let snapTarget = null, hatchOpen = 0, hatchT = 0;
  const drumQ = new THREE.Quaternion();
  const STEP = () => mode === 'me' ? 1 / 120 : 1 / 60;

  function buildShell() {
    for (let k = 0; k < 6; k++) {
      const phi = k * SEG, r = AP + T / 2;
      world.createCollider(RAPIER.ColliderDesc.cuboid(L / 2 + .2, T / 2, RH / 2 + .15)
        .setTranslation(0, Math.cos(phi) * r, Math.sin(phi) * r)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(X, phi)).setFriction(.6).setRestitution(.2), drumBody);
    }
    for (const s of [-1, 1])
      world.createCollider(RAPIER.ColliderDesc.cuboid(T / 2, RH + .3, RH + .3)
        .setTranslation(s * (L / 2 + T / 2), 0, 0).setFriction(.4).setRestitution(.2), drumBody);
  }
  function randInside(margin, yMax = AP) {
    for (;;) {
      const y = (Math.random() * 2 - 1) * (AP - margin), z = (Math.random() * 2 - 1) * (AP - margin);
      if (Math.hypot(y, z) < AP - margin && y < yMax)
        return new THREE.Vector3((Math.random() * 2 - 1) * (L / 2 - margin - .3), y, z);
    }
  }
  const rq = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 7, Math.random() * 7, Math.random() * 7));
  function addBody(p, size, vel) {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z).setRotation(rq()).setCcdEnabled(mode === 'me')
      .setLinearDamping(.05).setAngularDamping(.15));
    world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, Math.max(size.z / 2, .035))
      .setDensity(1).setFriction(.6).setRestitution(.3), b);
    if (vel) { b.setLinvel(vel, true); b.setAngvel({ x: Math.random() * 8 - 4, y: Math.random() * 8 - 4, z: Math.random() * 8 - 4 }, true); }
    return b;
  }
  function clear() {
    meshes.forEach(m => { scene.remove(m); m.geometry.dispose(); });
    textures.forEach(t => t.dispose());
    meshes = []; coupons = []; textures = []; ghostMat = null;
    if (world) world.free();
    world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    world.timestep = STEP();
    drumBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    drumBody.setRotation(drumQ, true);
    buildShell();
  }
  function myMesh(i) {
    const tex = ticketTexture({ ...GOLD, name: myName, num: '№' + String(i + 1).padStart(2, '0') });
    textures.push(tex);
    const m = new THREE.Mesh(new THREE.BoxGeometry(SIZE_ME.x, SIZE_ME.y, SIZE_ME.z), mats(goldEdge, faceMat(tex)));
    scene.add(m); meshes.push(m); return m;
  }
  let myCount = 0;
  function showMine({ name, count }) {
    mode = 'me'; myName = name; myCount = count; clear();
    for (let i = 0; i < Math.min(count, MAX_MINE_BODIES); i++)
      coupons.push({ body: addBody(randInside(.7, .2), SIZE_ME), mesh: myMesh(i) });
  }
  function showAll({ name, mine, others, cap = 350 }) {
    mode = 'all'; myName = name; clear();
    const nOthers = Math.max(0, Math.min(others, cap - mine));   // свои — всегда все, чужие — выборка
    const goldTex = ticketTexture({ ...GOLD, name, num: '★' }); textures.push(goldTex);
    const mineGeo = new THREE.BoxGeometry(SIZE_ALL.x * 1.5, SIZE_ALL.y * 1.5, SIZE_ALL.z);
    const glow = new THREE.MeshStandardMaterial({ map: goldTex, emissive: 0x1fd07f, emissiveIntensity: .35, metalness: .3, roughness: .3 });
    const mineM = new THREE.InstancedMesh(mineGeo, mats(goldEdge, glow), Math.max(mine, 1));
    const othM = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE_ALL.x, SIZE_ALL.y, SIZE_ALL.z), mats(whiteEdge, faceMat(whiteTex)), Math.max(nOthers, 1));
    mineM.count = mine; othM.count = nOthers;
    [mineM, othM].forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); meshes.push(m); });
    // «рентген»: свои купоны просвечивают сквозь горку чужих
    ghostMat = new THREE.MeshBasicMaterial({ color: 0x18b86d, transparent: true, opacity: .75, depthTest: false, depthWrite: false });
    const ghost = new THREE.InstancedMesh(mineGeo.clone(), ghostMat, Math.max(mine, 1));
    ghost.count = mine; ghost.instanceMatrix = mineM.instanceMatrix; ghost.renderOrder = 10; ghost.frustumCulled = false;
    scene.add(ghost); meshes.push(ghost);
    for (let i = 0; i < nOthers; i++) coupons.push({ body: addBody(randInside(.4), SIZE_ALL), inst: othM, idx: i });
    for (let i = 0; i < mine; i++) coupons.push({ body: addBody(randInside(.4), SIZE_ALL.clone().multiplyScalar(1.5)), inst: mineM, idx: i });
    w = Math.max(w, 4);
  }

  // Новые купоны падают через люк по одному. onEach(i) — после каждого купона (звук, счётчик).
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let dropping = false;
  async function dropNew(n, onEach = () => {}) {
    if (mode !== 'me' || n <= 0 || dropping) return;
    dropping = true;
    snapTarget = Math.round(angle / (2 * Math.PI)) * 2 * Math.PI; w = 0;   // люком вверх
    await sleep(1100);
    hatchOpen = 1;
    const shown = Math.min(n, 12);                                       // больше 12 — не задерживаем человека
    for (let k = 0; k < shown; k++) {
      if (myCount < MAX_MINE_BODIES) {
        const p = new THREE.Vector3((Math.random() - .5) * .5, AP - .55, (Math.random() - .5) * .4);
        coupons.push({ body: addBody(p, SIZE_ME, { x: 0, y: -2, z: 0 }), mesh: myMesh(myCount) });
      }
      myCount++;
      onEach(k, shown);
      await sleep(shown > 6 ? 380 : 650);
    }
    myCount += n - shown;
    hatchOpen = 0;
    await sleep(500);
    snapTarget = null; w = 6;                                            // закрыли люк — и перемешали
    dropping = false;
  }

  // ---------- взаимодействие ----------
  // тянешь вверх-вниз — крутишь барабан; влево-вправо — слегка поворачиваешь камеру
  let drag = null, yaw = .45, yawTarget = .45;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch {} onTouch(); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { drag = null; return; } // кнопку уже отпустили — просто ведём мышью
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    w = THREE.MathUtils.clamp(w + dy * .03, -9, 9);
    yawTarget = THREE.MathUtils.clamp(yawTarget - dx * .004, -.7, .9); // барабан поворачивается вслед за пальцем
  });
  const endDrag = () => drag = null;
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  addEventListener('pointerup', endDrag); addEventListener('blur', endDrag);   // отпустили за пределами барабана или окна

  // ---------- цикл ----------
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  function physStep(h) {
    if (snapTarget !== null) w += ((snapTarget - angle) * 30 - w * 9) * h;          // пружина к заданному углу
    else {
      w *= Math.exp(-h * .55);                                                       // трение в оси
      if (Math.abs(w) < .9 && !drag) { const tgt = Math.round(angle / SEG) * SEG; w += ((tgt - angle) * 14 - w * 3.2) * h; } // встаёт гранью вниз
    }
    angle += w * h;
    drumQ.setFromAxisAngle(X, angle);
    drumBody.setNextKinematicRotation(drumQ);
    world.step();
  }
  let frame = 0;
  function sync() {
    const dirty = new Set(), check = ++frame % 15 === 0;
    for (const c of coupons) {
      const t = c.body.translation(), r = c.body.rotation();
      if (check && (Math.abs(t.x) > L / 2 + .05 || Math.hypot(t.y, t.z) > RH + .05)) {   // вылетел — вернуть внутрь
        c.body.setTranslation({ x: 0, y: 0, z: 0 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      if (c.mesh) { c.mesh.position.set(t.x, t.y, t.z); c.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
      else { m4.compose(v3.set(t.x, t.y, t.z), q4.set(r.x, r.y, r.z, r.w), one); c.inst.setMatrixAt(c.idx, m4); dirty.add(c.inst); }
    }
    dirty.forEach(m => m.instanceMatrix.needsUpdate = true);
    drum.quaternion.copy(drumQ);
    hatchT += (hatchOpen - hatchT) * .15;
    hatch.position.y = AP + .04 + hatchT * .25; hatch.rotation.x = -hatchT * .9;
  }

  // камера вписывает барабан в свободную полосу экрана между topPx и bottomPx
  let camDist = 16, layout = { topPx: 0, bottomPx: innerHeight };
  const lookY = (RH - H - .2) / 2;
  function resize() {
    const wdt = canvas.clientWidth || innerWidth, hgt = canvas.clientHeight || innerHeight, a = wdt / hgt;
    renderer.setSize(wdt, hgt, false); camera.aspect = a;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const { topPx, bottomPx } = layout;
    const frac = Math.max(.28, (bottomPx - topPx) / hgt);
    const objH = (2 * RH + .95) * 1.18, objW = L + 2.4;
    camDist = Math.max(objH / (2 * tanH * frac), objW / (2 * tanH * a * .94)) * 1.22;
    camera.clearViewOffset();
    camera.setViewOffset(wdt, hgt, 0, hgt / 2 - (topPx + bottomPx) / 2, wdt, hgt);
    camera.updateProjectionMatrix();
  }
  function setLayout(l) { layout = l; resize(); }
  addEventListener('resize', resize);

  let acc = 0, last = performance.now(), running = true;
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (!world) return;                       // ещё не показали ни одного барабана
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    acc += dt; let n = 0;
    const h = STEP();
    while (acc >= h && n < 4) { physStep(h); acc -= h; n++; }
    if (n === 4) acc = 0;
    sync();
    yaw += (yawTarget - yaw) * .08;
    if (!drag) yawTarget += (.45 - yawTarget) * .01;
    camera.position.set(Math.sin(yaw) * camDist, lookY + camDist * .28, Math.cos(yaw) * camDist);
    camera.lookAt(0, lookY, 0);
    if (ghostMat) ghostMat.opacity = .72 + .18 * Math.sin(now / 450);
    renderer.render(scene, camera);
  }
  function pause() { running = false; }
  function resume() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  resize();
  requestAnimationFrame(loop);

  return { showMine, showAll, dropNew, setLayout, pause, resume, get busy() { return dropping; } };
}
