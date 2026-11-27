// 3D-лототрон: форма — шестигранный барабан с ручкой, люком и стойками (как в утверждённых прототипах),
// фактура — по концепту Ксении: хром, прозрачный акрил, алюминиевый поддон, зелёные билеты с номерами.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm';

const RH = 2.4;                        // радиус описанной окружности шестигранника
const AP = RH * Math.cos(Math.PI / 6); // апофема
const L = 4.8;                         // длина барабана
const T = 0.3;                         // толщина стенок-коллайдеров
const H = RH + 0.75;                   // от оси до поддона
const X = new THREE.Vector3(1, 0, 0);
const SEG = Math.PI / 3;
const SIZE_ME = new THREE.Vector3(1.1, .5, .03);
const SIZE_ALL = new THREE.Vector3(.5, .23, .022);
const MAX_MINE_BODIES = 100;
const GREENS = [['#1f6b4f', '#16523c'], ['#2aa56f', '#1f8a5a'], ['#18573f', '#124632']]; // оттенки билетов как в концепте

export async function createDrum(canvas, { onTouch = () => {} } = {}) {
  await RAPIER.init();

  // ---------- рендер ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6e2, .9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 9, 7); scene.add(sun);

  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: .16 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd2d6da, metalness: .85, roughness: .38 });
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xf2f8ff, transparent: true, opacity: .035, roughness: .03,
    metalness: 0, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.1, depthWrite: false, side: THREE.DoubleSide });
  const gripMat = new THREE.MeshPhysicalMaterial({ color: 0x0d5a40, roughness: .3, clearcoat: 1, clearcoatRoughness: .1 });

  // барабан (вращается): акриловые грани, хромированные рёбра, торцы со спицами, люк, ручка
  const drum = new THREE.Group(); scene.add(drum);
  for (let k = 0; k < 6; k++) {
    const phi = k * SEG;
    const p = new THREE.Mesh(new THREE.BoxGeometry(L, .03, RH), acrylic);
    p.quaternion.setFromAxisAngle(X, phi); p.position.set(0, Math.cos(phi) * AP, Math.sin(phi) * AP);
    p.renderOrder = 2; drum.add(p);
    const va = phi + Math.PI / 6;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, L, 16), chrome);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, Math.cos(va) * RH, Math.sin(va) * RH); drum.add(bar);
  }
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(RH, RH, .03, 6), acrylic);
    cap.rotation.z = Math.PI / 2; cap.position.x = s * L / 2; cap.renderOrder = 2; drum.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RH, .08, 16, 6), chrome);
    ring.rotation.y = Math.PI / 2; ring.position.x = s * L / 2; drum.add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .14, 40), chrome);
    hub.rotation.z = Math.PI / 2; hub.position.x = s * (L / 2 + .07); drum.add(hub);
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, RH * 2, 10), chrome);
      sp.position.x = s * (L / 2 + .02); sp.rotation.x = Math.PI / 6 + k * SEG; drum.add(sp);
    }
  }
  const hatch = new THREE.Group();
  [[1.4, .07, 0, .55], [1.4, .07, 0, -.55], [.07, 1.17, .7, 0], [.07, 1.17, -.7, 0]].forEach(([w, d, x, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, .07, d), chrome); b.position.set(x, 0, z); hatch.add(b);
  });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.1, 20, 14), chrome); knob.position.set(0, .08, 0); hatch.add(knob);
  hatch.position.y = AP + .04; drum.add(hatch);
  const crank = new THREE.Group();
  const arm = new THREE.Mesh(new RoundedBoxGeometry(.12, 1.15, .16, 3, .04), chrome); arm.position.y = .5; crank.add(arm);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .62, 24), gripMat);
  grip.rotation.z = Math.PI / 2; grip.position.set(.32, 1.0, 0); crank.add(grip);
  const gripCap = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 14), chrome); gripCap.position.set(.64, 1.0, 0); crank.add(gripCap);
  crank.position.x = L / 2 + .75; drum.add(crank);

  // неподвижное: ось, стойки буквой «А», поддон, мягкая тень
  const stand = new THREE.Group(); scene.add(stand);
  const rod = (a, b, r) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 20), chrome);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); stand.add(m);
  };
  for (const s of [-1, 1]) {
    const x = s * (L / 2 + .45), top = new THREE.Vector3(x, 0, 0);
    rod(top, new THREE.Vector3(x, -H, 1.3), .075);
    rod(top, new THREE.Vector3(x, -H, -1.3), .075);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.17, 24, 16), chrome); cap.position.copy(top); stand.add(cap);
  }
  rod(new THREE.Vector3(-L / 2 - .6, 0, 0), new THREE.Vector3(L / 2 + .8, 0, 0), .065);
  const base = new THREE.Mesh(new RoundedBoxGeometry(L + 1.6, .26, 3.2, 4, .07), alu); base.position.y = -H - .13; stand.add(base);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(L + 1.4, .05, 3.0, 2, .02), new THREE.MeshStandardMaterial({ color: 0xe9ecef, metalness: .7, roughness: .3 }));
  lip.position.y = -H + .02; stand.add(lip);
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(20,40,32,.4)'); gr.addColorStop(1, 'rgba(20,40,32,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(L + 4, 5.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = -H - .27; stand.add(blob);
  }

  // ---------- билеты ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function ticketTexture({ a, b, ink, num, name = '' }) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 232;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 232); grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.fillStyle = grd; g.fillRect(0, 0, 512, 232);
    // вырезы-полукруги по краям и пунктир отрыва, как у билета
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (const x of [0, 512]) { g.beginPath(); g.arc(x, 116, 30, 0, 7); g.fill(); }
    g.strokeStyle = ink; g.globalAlpha = .35; g.lineWidth = 4; g.setLineDash([10, 10]);
    g.beginPath(); g.moveTo(410, 18); g.lineTo(410, 214); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 104px Montserrat, sans-serif'; g.fillText(num, 210, name ? 100 : 118, 330);
    if (name) { g.globalAlpha = .8; g.font = '600 26px Montserrat, sans-serif'; g.fillText(name, 210, 180, 330); g.globalAlpha = 1; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x14513b, roughness: .6 });
  const whiteEdge = new THREE.MeshStandardMaterial({ color: 0xf3f5f4, roughness: .6 });
  const faceMat = map => new THREE.MeshStandardMaterial({ map, roughness: .6, metalness: 0, envMapIntensity: .4 }); // насыщенный зелёный, не засвеченный
  const mats = (edge, face) => [edge, edge, edge, edge, face, face];

  // ---------- физика ----------
  let world, drumBody, coupons = [], meshes = [], textures = [], mode = 'me', ghostMat = null, myName = '';
  let angle = 0, w = 4.5, snapTarget = null, hatchOpen = 0, hatchT = 0;
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
      world.createCollider(RAPIER.ColliderDesc.cuboid(T / 2, RH + .3, RH + .3).setTranslation(s * (L / 2 + T / 2), 0, 0).setFriction(.4).setRestitution(.2), drumBody);
  }
  function randInside(margin, yMax = AP) {
    for (;;) {
      const y = (Math.random() * 2 - 1) * (AP - margin), z = (Math.random() * 2 - 1) * (AP - margin);
      if (Math.hypot(y, z) < AP - margin && y < yMax) return new THREE.Vector3((Math.random() * 2 - 1) * (L / 2 - margin - .3), y, z);
    }
  }
  const rq = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 7, Math.random() * 7, Math.random() * 7));
  function addBody(p, size, vel) {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(rq())
      .setCcdEnabled(mode === 'me').setLinearDamping(.05).setAngularDamping(.15));
    world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, Math.max(size.z / 2, .035)).setDensity(1).setFriction(.6).setRestitution(.3), b);
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
    const [a, b] = GREENS[i % 3];
    const tex = ticketTexture({ a, b, ink: '#ffffff', num: String(i + 1), name: myName }); textures.push(tex);
    const m = new THREE.Mesh(new THREE.BoxGeometry(SIZE_ME.x, SIZE_ME.y, SIZE_ME.z), mats(edgeMat, faceMat(tex)));
    scene.add(m); meshes.push(m); return m;
  }
  let myCount = 0;
  function showMine({ name, count }) {
    mode = 'me'; myName = name; myCount = count; clear();
    for (let i = 0; i < Math.min(count, MAX_MINE_BODIES); i++) coupons.push({ body: addBody(randInside(.6, .1), SIZE_ME), mesh: myMesh(i) });
  }
  function showAll({ name, mine, others, cap = 350 }) {
    mode = 'all'; myName = name; clear();
    const nOthers = Math.max(0, Math.min(others, cap - mine));
    const mineTex = ticketTexture({ a: '#2bb073', b: '#1c8d59', ink: '#ffffff', num: '★' }); textures.push(mineTex);
    const othTex = ticketTexture({ a: '#ffffff', b: '#eef2f0', ink: '#1f6b4f', num: '№' }); textures.push(othTex);
    const mineGeo = new THREE.BoxGeometry(SIZE_ALL.x * 1.5, SIZE_ALL.y * 1.5, SIZE_ALL.z);
    const glow = new THREE.MeshStandardMaterial({ map: mineTex, emissive: 0x1fd07f, emissiveIntensity: .3, roughness: .45 });
    const mineM = new THREE.InstancedMesh(mineGeo, mats(edgeMat, glow), Math.max(mine, 1));
    const othM = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE_ALL.x, SIZE_ALL.y, SIZE_ALL.z), mats(whiteEdge, faceMat(othTex)), Math.max(nOthers, 1));
    mineM.count = mine; othM.count = nOthers;
    [mineM, othM].forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); meshes.push(m); });
    ghostMat = new THREE.MeshBasicMaterial({ color: 0x1aa866, transparent: true, opacity: .75, depthTest: false, depthWrite: false });
    const ghost = new THREE.InstancedMesh(mineGeo.clone(), ghostMat, Math.max(mine, 1));
    ghost.count = mine; ghost.instanceMatrix = mineM.instanceMatrix; ghost.renderOrder = 10; ghost.frustumCulled = false;
    scene.add(ghost); meshes.push(ghost);
    for (let i = 0; i < nOthers; i++) coupons.push({ body: addBody(randInside(.4), SIZE_ALL), inst: othM, idx: i });
    for (let i = 0; i < mine; i++) coupons.push({ body: addBody(randInside(.4), SIZE_ALL.clone().multiplyScalar(1.5)), inst: mineM, idx: i });
    w = Math.max(w, 4);
  }

  // новые купоны падают через люк по одному, потом барабан перемешивает
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let dropping = false;
  async function dropNew(n, onEach = () => {}) {
    if (mode !== 'me' || n <= 0 || dropping) return;
    dropping = true;
    snapTarget = Math.round(angle / (2 * Math.PI)) * 2 * Math.PI; w = 0;   // люком вверх
    await sleep(1000);
    hatchOpen = 1;
    const shown = Math.min(n, 12);
    for (let k = 0; k < shown; k++) {
      if (myCount < MAX_MINE_BODIES) {
        const p = new THREE.Vector3((Math.random() - .5) * .5, AP - .55, (Math.random() - .5) * .4);
        coupons.push({ body: addBody(p, SIZE_ME, { x: 0, y: -2, z: 0 }), mesh: myMesh(myCount) });
      }
      myCount++; onEach(k, shown);
      await sleep(shown > 6 ? 380 : 600);
    }
    myCount += n - shown;
    hatchOpen = 0;
    await sleep(500);
    snapTarget = null; w = 5;
    dropping = false;
  }

  // ---------- управление ----------
  // тянешь вверх-вниз — крутишь барабан; влево-вправо — слегка поворачиваешь вид
  const REST_YAW = .34;   // три четверти — видно ручку и объём
  let drag = null, yaw = REST_YAW, yawTarget = REST_YAW;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch {} onTouch(); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { drag = null; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    w = THREE.MathUtils.clamp(w + dy * .03, -9, 9);
    yawTarget = THREE.MathUtils.clamp(yawTarget - dx * .004, -.6, .7);
  });
  const endDrag = () => drag = null;
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  addEventListener('pointerup', endDrag); addEventListener('blur', endDrag);

  // ---------- цикл ----------
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  function physStep(h) {
    if (snapTarget !== null) w += ((snapTarget - angle) * 30 - w * 9) * h;
    else {
      w *= Math.exp(-h * .55);
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
      if (check && (Math.abs(t.x) > L / 2 + .05 || Math.hypot(t.y, t.z) > RH + .05)) { c.body.setTranslation({ x: 0, y: 0, z: 0 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      if (c.mesh) { c.mesh.position.set(t.x, t.y, t.z); c.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
      else { m4.compose(v3.set(t.x, t.y, t.z), q4.set(r.x, r.y, r.z, r.w), one); c.inst.setMatrixAt(c.idx, m4); dirty.add(c.inst); }
    }
    dirty.forEach(m => m.instanceMatrix.needsUpdate = true);
    drum.quaternion.copy(drumQ);
    hatchT += (hatchOpen - hatchT) * .15;
    hatch.position.y = AP + .04 + hatchT * .25; hatch.rotation.x = -hatchT * .9;
  }

  // камера вписывает лототрон в полосу экрана между topPx и bottomPx (координаты холста)
  let camDist = 16, layout = { topPx: 0, bottomPx: innerHeight };
  const lookY = (RH - H - .2) / 2;
  function resize() {
    const wdt = canvas.clientWidth || innerWidth, hgt = canvas.clientHeight || innerHeight, a = wdt / hgt;
    renderer.setSize(wdt, hgt, false); camera.aspect = a;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const { topPx, bottomPx } = layout;
    const frac = Math.max(.25, (bottomPx - topPx) / hgt);
    const objH = (2 * RH + .95) * 1.12, objW = L + 2.6;
    camDist = Math.max(objH / (2 * tanH * frac), objW / (2 * tanH * a * .96)) * 1.08;
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
    if (!world) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    acc += dt; let n = 0;
    const h = STEP();
    while (acc >= h && n < 4) { physStep(h); acc -= h; n++; }
    if (n === 4) acc = 0;
    sync();
    yaw += (yawTarget - yaw) * .08;
    if (!drag) yawTarget += (REST_YAW - yawTarget) * .01;
    camera.position.set(Math.sin(yaw) * camDist, lookY + camDist * .24, Math.cos(yaw) * camDist);
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
