// Лототрон: связывает данные таблицы, 3D-барабан, экраны и память телефона.
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/+esm';
import { CSV_URL } from '../config.js?v=202611271319';
import { parseCSV, buildParticipants, readUpdated, shortName, searchByLastName, pickerName, COUPON_RUB } from './data.js?v=202611271319';
import { chanceGain } from './chance.js?v=202611271319';
import { createDrum } from './drum.js?v=202611271319';
import { load, save, remove } from './store.js?v=202611271319';

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#ef2b3c', '#ffcd1f', '#14a352', '#3d93ff', '#ffffff'];
const ACH = [[1, 'Первый купон'], [5, 'Пятёрка'], [10, 'Десятка'], [25, 'Четверть сотни']];

// ---------- данные ----------
// Порядок: свежая таблица → сохранённая на телефоне копия → демо.
async function loadData() {
  if (CSV_URL) {
    try {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      save('cache', { text, at: Date.now() });
      return { text, source: 'live' };
    } catch (e) {
      const c = load('cache');
      if (c?.text) return { text: c.text, source: 'stale', at: c.at };
      // таблица подключена, но недоступна и копии нет: не подсовываем демо с выдуманными людьми
      throw new Error('Нет связи с таблицей');
    }
  }
  const res = await fetch('demo.csv');
  return { text: await res.text(), source: 'demo' };
}

// ---------- звук ----------
let actx;
function initAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* без звука */ } }
function ding(pitch = 1) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  [880, 1320, 1760].forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f * pitch;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18 / (i + 1), t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 1);
  });
}
addEventListener('pointerdown', initAudio, { once: true });

// ---------- состояние ----------
let people = [], total = 0, me = null, tab = 'me', drum = null, brandFilter = 'Все';

function layout() {
  if (!drum) return;
  const top = $('top').getBoundingClientRect().bottom + 10;
  const card = tab === 'me' ? $('card-me') : $('card-all');
  const bottom = card.hidden ? innerHeight : card.getBoundingClientRect().top - 6;
  drum.setLayout({ topPx: top, bottomPx: bottom });
}
addEventListener('resize', layout);

// ---------- мой лототрон ----------
function renderMe(shown) {
  const cnt = $('cnt');
  cnt.textContent = shown;
  cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
  $('cntLbl').textContent = plural(shown, 'купон', 'купона', 'купонов');
  const done = shown >= me.coupons;
  const toNext = done ? me.toNext : 0;
  $('fill').style.width = done ? ((COUPON_RUB - me.toNext) / COUPON_RUB * 100) + '%' : '100%';
  $('tonext').innerHTML = done
    ? `до ${me.coupons + 1}-го купона — <b>${fmt(toNext)} ₽</b>`
    : `<b>${shown + 1}-й купон уже летит!</b>`;
  const gain = chanceGain(me.coupons, total) * 100;
  $('chance').textContent = gain >= .05 ? `+${gain.toFixed(1).replace('.', ',')}% к шансу` : '';
  $('ach').innerHTML = ACH.map(([n, t]) => `<span class="${shown >= n ? 'got' : ''}">${shown >= n ? '★ ' : ''}${t}</span>`).join('');
}

async function showMe() {
  const seen = load('seen:' + me.id);
  const from = seen == null ? 0 : Math.min(seen, me.coupons);      // первый визит — купоны падают с нуля
  const fresh = me.coupons - from;
  const drop = Math.min(fresh, 12);
  drum.showMine({ name: `${me.first} ${me.last}`.trim(), count: me.coupons - drop });
  renderMe(me.coupons - drop);
  const d = $('delta');
  d.hidden = !(seen != null && fresh > 0);
  d.textContent = `+${fresh} с прошлого визита`;
  save('seen:' + me.id, me.coupons);
  if (drop > 0) {
    await new Promise(r => setTimeout(r, 700));
    await drum.dropNew(drop, (k, n) => {
      renderMe(me.coupons - drop + k + 1);
      ding(1 + k * .06);
      confetti({ particleCount: 30, spread: 70, origin: { x: .5, y: .35 }, colors: COLORS, disableForReducedMotion: true });
    });
    renderMe(me.coupons);
    confetti({ particleCount: 140, spread: 110, startVelocity: 45, origin: { x: .5, y: .5 }, colors: COLORS, disableForReducedMotion: true });
  }
}

// ---------- общий лототрон и рейтинг ----------
function ranked() {
  return [...people].sort((a, b) => b.coupons - a.coupons || b.pds - a.pds);
}
function showAll() {
  drum.showAll({ name: `${me.first} ${me.last}`.trim(), mine: me.coupons, others: total - me.coupons });
  $('cntAll').textContent = fmt(total);
  $('mineAll').textContent = `твоих — ${me.coupons}`;
  const place = ranked().findIndex(p => p.id === me.id) + 1;
  $('myPlace').textContent = me.coupons > 0 ? `Ты на ${place}-м месте из ${people.length}` : 'Твой первый купон — впереди';
}
function renderRating() {
  const brands = ['Все', ...new Set(people.map(p => p.brand).filter(Boolean))];
  $('chips').innerHTML = brands.map(b => `<button class="${b === brandFilter ? 'on' : ''}" data-b="${esc(b)}">${esc(b)}</button>`).join('');
  const all = ranked().filter(p => brandFilter === 'Все' || p.brand === brandFilter);
  const withC = all.filter(p => p.coupons > 0 || p.id === me.id);
  $('list').innerHTML = withC.map((p, i) => {
    const isMe = p.id === me.id;
    return `<li class="${isMe ? 'me' : ''}"><span class="pl">${p.coupons > 0 ? i + 1 : '—'}</span>
      <span class="nm"><b>${isMe ? 'Ты' : esc(shortName(p))}</b><small>${esc([p.city, p.brand].filter(Boolean).join(' · '))}</small></span>
      <span class="cp">${p.coupons}</span></li>`;
  }).join('');
  const zero = all.filter(p => p.coupons === 0 && p.id !== me.id).length;
  $('zeroNote').textContent = zero ? `Ещё ${zero} ${plural(zero, 'участник', 'участника', 'участников')} пока без купонов.` : '';
  $('list').querySelector('.me')?.scrollIntoView({ block: 'center' });
}
$('chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { brandFilter = b.dataset.b; renderRating(); } });
$('openRating').addEventListener('click', () => { $('rating').hidden = false; renderRating(); });
$('closeRating').addEventListener('click', () => { $('rating').hidden = true; });

// ---------- призы ----------
function daysUntil(isoDate) {
  // считаем по московскому времени: до начала указанного дня
  const now = new Date(Date.now() + 3 * 3600e3);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(isoDate) - today) / 864e5);
}
function renderPrizes() {
  const c = daysUntil('2026-12-28'), d = daysUntil('2026-12-30');
  $('cdCoupons').textContent = c > 0 ? c : c === 0 ? 'Сегодня' : '✓';
  $('cdCouponsLbl').textContent = c > 0 ? plural(c, 'день', 'дня', 'дней') + ' на купоны' : c === 0 ? 'последний день' : 'приём закрыт';
  $('cdDraw').textContent = d > 0 ? d : d === 0 ? 'Сегодня' : '✓';
  $('cdDrawLbl').textContent = d > 0 ? plural(d, 'день', 'дня', 'дней') + ' до розыгрыша' : d === 0 ? 'розыгрыш!' : 'розыгрыш прошёл';
}

// ---------- вкладки ----------
function setTab(t) {
  tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('card-me').hidden = t !== 'me';
  $('card-all').hidden = t !== 'all';
  $('prizes').hidden = t !== 'prizes';
  $('rating').hidden = true;
  $('c').style.visibility = t === 'prizes' ? 'hidden' : '';
  if (t === 'prizes') { drum.pause(); renderPrizes(); $('prizes').style.top = $('top').getBoundingClientRect().bottom + 8 + 'px'; $('prizes').scrollTop = 0; return; }
  drum.resume(); layout();
  if (t === 'me') showMe(); else showAll();
}
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && b.dataset.tab !== tab && !drum.busy) setTab(b.dataset.tab);
});

// ---------- выбор себя ----------
function openPicker() {
  $('picker').hidden = false; $('tabs').hidden = true; $('card-me').hidden = true; $('card-all').hidden = true;
  $('hello').textContent = 'Лототрон';
  $('q').value = ''; $('found').innerHTML = ''; $('pickNote').textContent = 'Нужно хотя бы 3 буквы.';
  setTimeout(() => $('q').focus(), 50);
}
$('q').addEventListener('input', () => {
  const q = $('q').value, found = searchByLastName(people, q).slice(0, 8);
  $('found').innerHTML = found.map(p => `<li><button data-id="${p.id}"><b>${esc(pickerName(p))}</b><small>${esc([p.city, p.brand].filter(Boolean).join(' · '))}</small></button></li>`).join('');
  $('pickNote').textContent = q.trim().length < 3 ? 'Нужно хотя бы 3 буквы.'
    : found.length ? 'Нажми на себя.' : 'Не нашли. Проверь написание или напиши организатору конкурса.';
});
$('found').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  initAudio();
  choose(people.find(p => p.id === b.dataset.id));
});
$('notMe').addEventListener('click', () => { remove('me'); me = null; history.replaceState(null, '', location.pathname); openPicker(); });

function choose(p) {
  me = p; save('me', p.id);
  $('picker').hidden = true; $('tabs').hidden = false;
  $('hello').innerHTML = `Привет, <b>${esc(p.first || p.last)}!</b>`;
  setTab('me');
}

// ---------- старт ----------
(async function start() {
  const [data, d] = await Promise.all([
    loadData(),
    createDrum($('c'), { onTouch: initAudio }),
    document.fonts.ready,
  ]);
  drum = d;
  const rows = parseCSV(data.text);
  people = buildParticipants(rows);
  total = people.reduce((s, p) => s + p.coupons, 0);
  const upd = readUpdated(rows);
  const badge = $('badge');
  if (data.source === 'demo') { badge.textContent = 'Демо-данные · таблица ещё не подключена'; badge.classList.add('demo'); }
  else if (data.source === 'stale') { badge.textContent = `Нет связи · данные от ${new Date(data.at).toLocaleDateString('ru-RU')}`; badge.classList.add('stale'); }
  else badge.textContent = upd ? `Купоны до 28 декабря · обновлено ${upd}` : 'Купоны до 28 декабря';
  $('loading').hidden = true;

  const urlId = new URLSearchParams(location.search).get('id');
  const id = urlId || load('me');
  const p = id && people.find(x => x.id === id);
  if (p) choose(p);
  else { if (id) remove('me'); openPicker(); }
})().catch(err => {
  console.error(err);
  $('loading').textContent = 'Не получилось загрузить купоны. Проверь интернет и обнови страницу.';
});

// ---------- гирлянда ----------
function garland() {
  const g = $('garland'), W = innerWidth, seg = 110, n = Math.ceil(W / seg);
  let d = 'M0 6', bulbs = '';
  for (let i = 0; i < n; i++) {
    const x0 = i * seg, x1 = x0 + seg, cx = x0 + seg / 2;
    d += ` Q ${cx} 34 ${x1} 6`;
    for (let j = 1; j <= 3; j++) {
      const t = j / 4, x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) ** 2 * 6 + 2 * (1 - t) * t * 34 + t * t * 6;
      const c = ['#ef2b3c', '#ffcd1f', '#14a352', '#ff7ad9', '#ffffff'][(i * 3 + j) % 5];
      bulbs += `<g class="b"><rect x="${x - 3}" y="${y - 1}" width="6" height="5" rx="1" fill="#1d2b45"/><ellipse cx="${x}" cy="${y + 11}" rx="5" ry="8" fill="${c}" style="filter:drop-shadow(0 0 6px ${c})"/></g>`;
    }
  }
  g.setAttribute('viewBox', `0 0 ${W} 52`);
  g.innerHTML = `<path d="${d}" stroke="#1d2b45" stroke-width="2" fill="none"/>` + bulbs;
}
garland(); addEventListener('resize', garland);

// ---------- снег ----------
const sc = $('snow'), sg = sc.getContext('2d');
let flakes = [];
function snowResize() {
  sc.width = innerWidth * devicePixelRatio; sc.height = innerHeight * devicePixelRatio;
  flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * sc.width, y: Math.random() * sc.height, r: (Math.random() * 2.2 + .6) * devicePixelRatio, s: Math.random() * .6 + .3, w: Math.random() * 6 }));
}
addEventListener('resize', snowResize); snowResize();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) (function snow(t) {
  sg.clearRect(0, 0, sc.width, sc.height); sg.fillStyle = 'rgba(255,255,255,.9)';
  for (const f of flakes) {
    f.y += f.s * devicePixelRatio; f.x += Math.sin(t / 1500 + f.w) * .3;
    if (f.y > sc.height) { f.y = -5; f.x = Math.random() * sc.width; }
    sg.beginPath(); sg.arc(f.x, f.y, f.r, 0, 7); sg.fill();
  }
  requestAnimationFrame(snow);
})(0);
