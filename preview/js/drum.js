// 3D-лототрон по концепту Ксении: прозрачный цилиндр, хромированные кольца и перекладины,
// хромовая ось на стойках, алюминиевый поддон. Купоны — зелёные билеты с вырезами и номерами.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm';

const R = 2.2;                         // радиус цилиндра
const L = 4.8;                         // длина цилиндра
const T = 0.3;                         // толщина стенок-коллайдеров
const NSEG = 20;                       // стенка из 20 плиток
const BASE_Y = -(R + .55);             // верх поддона
const X = new THREE.Vector3(1, 0, 0);
const SEG = Math.PI / 2;               // 4 перекладины: в покое одна сверху, одна спереди — как в концепте
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
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6e2, .9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 9, 7); scene.add(sun);

  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: .16 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd2d6da, metalness: .85, roughness: .38 });
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xf2f8ff, transparent: true, opacity: .06, roughness: .03,
    metalness: 0, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.1, depthWrite: false, side: THREE.DoubleSide });

  // барабан (вращается)
  const drum = new THREE.Group(); scene.add(drum);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 96, 1, true), acrylic);
  tube.rotation.z = Math.PI / 2; tube.renderOrder = 2; drum.add(tube);
  for (const s of [-1, 1]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .03, 96), acrylic);
    disc.rotation.z = Math.PI / 2; disc.position.x = s * L / 2; disc.renderOrder = 2; drum.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + .03, .085, 20, 128), chrome);
    ring.rotation.y = Math.PI / 2; ring.position.x = s * L / 2; drum.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * .42, .05, 14, 64), chrome); // внутреннее кольцо на торце
    ring2.rotation.y = Math.PI / 2; ring2.position.x = s * (L / 2 + .02); drum.add(ring2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .12, 40), chrome);
    hub.rotation.z = Math.PI / 2; hub.position.x = s * (L / 2 + .06); drum.add(hub);
  }
  for (let k = 0; k < 4; k++) {                         // перекладины вдоль цилиндра
    const a = k * SEG;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, L, 16), chrome);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, Math.cos(a) * (R + .03), Math.sin(a) * (R + .03)); drum.add(bar);
  }

  // неподвижное: ось, стойки, поддон, мягкая тень
  const stand = new THREE.Group(); scene.add(stand);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, L + 1.3, 20), chrome); axle.rotation.z = Math.PI / 2; stand.add(axle);
  for (const s of [-1, 1]) {
    const x = s * (L / 2 + .42);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .22, 32), chrome); knob.rotation.z = Math.PI / 2; knob.position.x = s * (L / 2 + .66); stand.add(knob);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 14), chrome); cap.position.x = s * (L / 2 + .8); stand.add(cap);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, -BASE_Y, 20), chrome); post.position.set(x, BASE_Y / 2, 0); stand.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .1, 32), chrome); foot.position.set(x, BASE_Y + .05, 0); stand.add(foot);
  }
  const base = new THREE.Mesh(new RoundedBoxGeometry(L + 1.5, .26, 2.4, 4, .07), alu); base.position.y = BASE_Y - .13; stand.add(base);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(L + 1.3, .05, 2.2, 2, .02), new THREE.MeshStandardMaterial({ color: 0xe9ecef, metalness: .7, roughness: .3 }));
  lip.position.y = BASE_Y + .02; stand.add(lip);
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(20,40,32,.4)'); gr.addColorStop(1, 'rgba(20,40,32,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(L + 4, 4.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = BASE_Y - .27; stand.add(blob);
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
  let angle = 0, w = 4.5, snapTarget = null;
  const drumQ = new THREE.Quaternion();
  const STEP = () => mode === 'me' ? 1 / 120 : 1 / 60;

  function buildShell() {
    const rr = R + T / 2, hw = Math.PI * rr / NSEG * 1.25;
    for (let k = 0; k < NSEG; k++) {
      const phi = k / NSEG * Math.PI * 2;
      world.createCollider(RAPIER.ColliderDesc.cuboid(L / 2 + .2, T / 2, hw)
        .setTranslation(0, Math.cos(phi) * rr, Math.sin(phi) * rr)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(X, phi)).setFriction(.6).setRestitution(.2), drumBody);
    }
    for (const s of [-1, 1])
      world.createCollider(RAPIER.ColliderDesc.cuboid(T / 2, R + .4, R + .4).setTranslation(s * (L / 2 + T / 2), 0, 0).setFriction(.4).setRestitution(.2), drumBody);
  }
  function randInside(margin, yMax = R) {
    for (;;) {
      const y = (Math.random() * 2 - 1) * (R - margin), z = (Math.random() * 2 - 1) * (R - margin);
      if (Math.hypot(y, z) < R - margin && y < yMax) return new THREE.Vector3((Math.random() * 2 - 1) * (L / 2 - margin - .3), y, z);
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

  // новые купоны падают сверху по одному, потом барабан перемешивает
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let dropping = false;
  async function dropNew(n, onEach = () => {}) {
    if (mode !== 'me' || n <= 0 || dropping) return;
    dropping = true;
    snapTarget = Math.round(angle / (2 * Math.PI)) * 2 * Math.PI; w = 0;
    await sleep(700);
    const shown = Math.min(n, 12);
    for (let k = 0; k < shown; k++) {
      if (myCount < MAX_MINE_BODIES) {
        const p = new THREE.Vector3((Math.random() - .5) * 2, R - .6, (Math.random() - .5) * .6);
        coupons.push({ body: addBody(p, SIZE_ME, { x: 0, y: -2, z: 0 }), mesh: myMesh(myCount) });
      }
      myCount++; onEach(k, shown);
      await sleep(shown > 6 ? 380 : 600);
    }
    myCount += n - shown;
    await sleep(400);
    snapTarget = null; w = 5;
    dropping = false;
  }

  // ---------- управление ----------
  // тянешь вверх-вниз — крутишь барабан; влево-вправо — слегка поворачиваешь вид
  const REST_YAW = .07;
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
      if (Math.abs(w) < .9 && !drag) { const tgt = Math.round(angle / SEG) * SEG; w += ((tgt - angle) * 10 - w * 3) * h; } // в покое перекладины сверху и спереди
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
      if (check && (Math.abs(t.x) > L / 2 + .05 || Math.hypot(t.y, t.z) > R + .05)) { c.body.setTranslation({ x: 0, y: 0, z: 0 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      if (c.mesh) { c.mesh.position.set(t.x, t.y, t.z); c.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
      else { m4.compose(v3.set(t.x, t.y, t.z), q4.set(r.x, r.y, r.z, r.w), one); c.inst.setMatrixAt(c.idx, m4); dirty.add(c.inst); }
    }
    dirty.forEach(m => m.instanceMatrix.needsUpdate = true);
    drum.quaternion.copy(drumQ);
  }

  // камера вписывает лототрон в полосу экрана между topPx и bottomPx (координаты холста)
  let camDist = 16, layout = { topPx: 0, bottomPx: innerHeight };
  const lookY = (R + BASE_Y - .3) / 2;
  function resize() {
    const wdt = canvas.clientWidth || innerWidth, hgt = canvas.clientHeight || innerHeight, a = wdt / hgt;
    renderer.setSize(wdt, hgt, false); camera.aspect = a;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const { topPx, bottomPx } = layout;
    const frac = Math.max(.25, (bottomPx - topPx) / hgt);
    const objH = (R - BASE_Y + .5) * 1.12, objW = L + 1.9;
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
    camera.position.set(Math.sin(yaw) * camDist, lookY + camDist * .16, Math.cos(yaw) * camDist);
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
