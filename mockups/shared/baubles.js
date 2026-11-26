// Ёлочные шары на нитях: глянец, металл, жемчуг, бархат. Красоту дают отражения студийного света,
// поэтому окружение — «фотостудия» из нескольких софтбоксов, запечённая в карту отражений.
import * as THREE from 'three';

function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x3a5a4e);       // светлее, чтобы зеркальные шары не были чёрными
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(7, 5, 0xfff0d8, 7, [6, 6, 7]);       // тёплый основной софтбокс
  panel(3, 9, 0xd9ecff, 3.5, [-8, 2, 4]);    // холодный боковой
  panel(14, 1.4, 0xffe2b4, 4, [0, 9, -3]);   // полоса сверху
  panel(2.5, 2.5, 0xffffff, 10, [2, -1, 9]); // яркий блик спереди
  panel(10, 6, 0x1a7a55, 2.2, [0, -8, 2]);   // зелёный отсвет снизу
  panel(12, 8, 0xf2e6d4, 1.6, [-2, 3, -10]); // светлый фон за спиной — серебро читается
  panel(5, 5, 0xffd9a8, 3, [9, -3, -2]);     // тёплый отсвет сбоку
  const t = new THREE.PMREMGenerator(renderer).fromScene(s, 0.015).texture;
  return t;
}

const MATS = {
  green:    () => new THREE.MeshPhysicalMaterial({ color: 0x0e6b48, metalness: .15, roughness: .1, clearcoat: 1, clearcoatRoughness: .04 }),
  gold:     () => new THREE.MeshStandardMaterial({ color: 0xd9b46c, metalness: 1, roughness: .22 }),
  silver:   () => new THREE.MeshStandardMaterial({ color: 0xeef2f6, metalness: 1, roughness: .14 }),
  pearl:    () => new THREE.MeshPhysicalMaterial({ color: 0xf4eee4, metalness: 0, roughness: .32, clearcoat: .8, sheen: .6, sheenColor: new THREE.Color(0xffe6d0), iridescence: .35 }),
  burgundy: () => new THREE.MeshPhysicalMaterial({ color: 0x6e0f22, metalness: 0, roughness: .55, sheen: 1, sheenRoughness: .35, sheenColor: new THREE.Color(0xff8fa6), clearcoat: .3 }),
  blush:    () => new THREE.MeshPhysicalMaterial({ color: 0xe8a2ad, metalness: .3, roughness: .18, clearcoat: 1, clearcoatRoughness: .1 }),
};

// layouts: { desktop: [...], mobile: [...] }, элемент: { x: -1..1 доля полуширины, len: 0..1 доля высоты, r, mat, z }
export function createBaubles(canvas, layouts) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const key = new THREE.DirectionalLight(0xfff3e0, 1.6); key.position.set(6, 8, 10); scene.add(key);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 0, 22);

  const capMat = new THREE.MeshStandardMaterial({ color: 0xcfa760, metalness: 1, roughness: .3 });
  const threadMat = new THREE.MeshBasicMaterial({ color: 0xe9d7a8, transparent: true, opacity: .7 });
  const sphere = new THREE.SphereGeometry(1, 64, 48);
  let items = [];

  function build() {
    items.forEach(it => scene.remove(it.pivot)); items = [];
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, halfW = halfH * camera.aspect;
    const list = w >= 900 ? layouts.desktop : layouts.mobile;
    const unit = Math.min(halfW, halfH) / 6;          // размер шаров относительно экрана
    list.forEach((b, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(b.x * halfW, halfH + .5, b.z ?? 0);
      const r = b.r * unit, len = b.len * halfH * 2 + .5;
      const thread = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, len, 6), threadMat);
      thread.position.y = -len / 2; pivot.add(thread);
      const ball = new THREE.Group(); ball.position.y = -len - r * 1.12; pivot.add(ball);
      const m = new THREE.Mesh(sphere, MATS[b.mat]()); m.scale.setScalar(r); ball.add(m);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * .2, r * .24, r * .26, 24), capMat); cap.position.y = r * 1.04; ball.add(cap);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(r * .1, r * .025, 8, 20), capMat); loop.position.y = r * 1.22; ball.add(loop);
      scene.add(pivot);
      items.push({ pivot, ball, ph: i * 1.37, amp: .035 + (i % 3) * .012, spd: .55 + (i % 4) * .08 });
    });
  }
  addEventListener('resize', build); build();

  (function loop(now) {
    requestAnimationFrame(loop);
    const t = now / 1000;
    for (const it of items) {
      it.pivot.rotation.z = Math.sin(t * it.spd + it.ph) * it.amp;              // покачивание на нити
      it.pivot.rotation.x = Math.sin(t * it.spd * .7 + it.ph) * it.amp * .5;
      it.ball.rotation.y = t * .25 + it.ph;                                     // медленный поворот — блики «бегут»
    }
    renderer.render(scene, camera);
  })(0);
}
