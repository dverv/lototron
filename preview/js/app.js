// Конкурс-лотерея: обложка со счётчиком → лототрон участника. Данные — опубликованная Google-таблица.
import { CSV_URL } from '../../config.js?v=202611271332';
import { parseCSV, buildParticipants, readUpdated, shortName, searchByLastName, pickerName, COUPON_RUB } from '../../js/data.js?v=202611271332';
import { load, save, remove } from '../../js/store.js?v=202611271332';
import { createDrum } from './drum.js?v=202611271332';
import { createStars } from './stars.js?v=202611271332';

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const plural = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const digits = n => n >= 1000 ? 'd4' : n >= 100 ? 'd3' : '';   // длинное число — поменьше, чтобы влезло в плашку
const DRAW = Date.parse('2026-12-30T00:00:00+03:00');   // розыгрыш 30 декабря, Москва

// ---------- данные: свежая таблица → копия на телефоне → демо (только пока таблица не подключена) ----------
async function loadData() {
  if (CSV_URL) {
    try {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      save('cache', { text, at: Date.now() });
      return { text, source: 'live' };
    } catch {
      const c = load('cache');
      if (c?.text) return { text: c.text, source: 'stale', at: c.at };
      throw new Error('Нет связи с таблицей');
    }
  }
  return { text: await (await fetch('../demo.csv')).text(), source: 'demo' };
}

// ---------- счётчик ----------
function timeLeft() {
  const ms = Math.max(0, DRAW - Date.now());
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60 };
}
function tickClock() { const { d, h, m } = timeLeft(); $('clock').textContent = `${pad(d)}:${pad(h)}:${pad(m)}`; }
tickClock(); setInterval(tickClock, 20000);

// ---------- звук ----------
let actx;
const initAudio = () => { try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); } catch {} };
function ding(p = 1) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime;
  [880, 1320, 1760].forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f * p;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16 / (i + 1), t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 1);
  });
}
addEventListener('pointerdown', initAudio, { once: true });

// ---------- состояние ----------
let people = [], total = 0, me = null, tab = 'me', drum = null, delta = 0;
const fullName = p => `${p.first} ${p.last}`.trim();

// лототрон вписывается в свободное место: на компьютере — справа целиком, на телефоне — над приветствием
function layout() {
  if (!drum) return;
  const wide = innerWidth >= 900, c = $('drum').getBoundingClientRect();
  const top = wide ? innerHeight * .12 : 16 + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat') || 0);
  const bottom = wide ? innerHeight * .9 : $('side').getBoundingClientRect().top - 6 - c.top;
  drum.setLayout({ topPx: top, bottomPx: Math.max(bottom, top + 120) });
}
addEventListener('resize', layout);

// ---------- плашка ----------
function renderPanel(shown = me.coupons) {
  const { d, h } = timeLeft();
  const days = `<div class="days"><span>до розыгрыша</span><b>${d} ${plural(d, 'день', 'дня', 'дней')} ${h} ч</b></div>`;
  const sw = `<div class="switch"><button data-t="me" class="${tab === 'me' ? 'on' : ''}">мой лототрон</button><button data-t="all" class="${tab === 'all' ? 'on' : ''}">общий</button></div>`;
  if (tab === 'me') {
    const done = shown >= me.coupons;
    const pct = done ? (COUPON_RUB - me.toNext) / COUPON_RUB * 100 : 100;
    $('panel').innerHTML = sw +
      `<div class="big"><span class="n ${digits(shown)}">${shown}</span><div><div class="w">${plural(shown, 'купон', 'купона', 'купонов')}</div>${delta > 0 ? `<span class="pill">+${delta} с прошлого визита</span>` : ''}</div></div>
       <div class="track"><i style="width:${pct}%"></i></div>
       <div class="small">${done ? `до ${me.coupons + 1}-го купона — ${fmt(me.toNext)} ₽` : `${shown + 1}-й купон уже летит!`}</div>` + days;
  } else {
    $('panel').innerHTML = sw +
      `<div class="big"><span class="n ${digits(total)}">${fmt(total)}</span><div><div class="w">${plural(total, 'купон', 'купона', 'купонов')}</div><span class="pill green">твои — ${me.coupons}</span></div></div>
       <button class="cta" data-open="rating">посмотреть рейтинг</button>` + days;
  }
}
$('panel').addEventListener('click', e => {
  const b = e.target.closest('[data-t]');
  if (!b || b.dataset.t === tab || drum.busy) return;
  tab = b.dataset.t; renderPanel();
  tab === 'me' ? drum.showMine({ name: fullName(me), count: me.coupons }) : drum.showAll({ name: fullName(me), mine: me.coupons, others: total - me.coupons });
  layout();
});

// ---------- новые купоны с прошлого визита ----------
async function playNew() {
  const seen = load('seen:' + me.id);
  const from = seen == null ? 0 : Math.min(seen, me.coupons);   // первый визит — все купоны падают с нуля
  const fresh = me.coupons - from, drop = Math.min(fresh, 12);
  delta = seen != null ? fresh : 0;
  save('seen:' + me.id, me.coupons);
  drum.showMine({ name: fullName(me), count: me.coupons - drop });
  renderPanel(me.coupons - drop); layout();
  if (drop <= 0) return;
  await new Promise(r => setTimeout(r, 600));
  await drum.dropNew(drop, k => { renderPanel(me.coupons - drop + k + 1); ding(1 + k * .05); });
  renderPanel();
}
let played = false;
function onGameVisible() { if (me && !played) { played = true; playNew(); } }

// ---------- выбор себя ----------
function openPicker() {
  me = null; played = false;
  $('panel').hidden = true; $('notMe').hidden = true; $('picker').hidden = false;
  $('hello').textContent = 'Здравствуй!';
  $('q').value = ''; $('found').innerHTML = ''; $('pickNote').textContent = 'Нужно хотя бы 3 буквы.';
  drum?.showAll({ name: '', mine: 0, others: total });
  layout();
}
$('q').addEventListener('input', () => {
  const q = $('q').value, found = searchByLastName(people, q).slice(0, 8);
  $('found').innerHTML = found.map(p => `<li><button data-id="${p.id}"><b>${esc(pickerName(p))}</b><small>${esc(p.city || '')}</small></button></li>`).join('');
  $('pickNote').textContent = q.trim().length < 3 ? 'Нужно хотя бы 3 буквы.' : found.length ? 'Нажми на себя.' : 'Не нашли. Проверь написание или напиши организатору конкурса.';
});
$('found').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { initAudio(); choose(people.find(p => p.id === b.dataset.id), true); } });
$('notMe').addEventListener('click', () => { remove('me'); history.replaceState(null, '', location.pathname); openPicker(); });

function choose(p, now = false) {
  me = p; tab = 'me'; save('me', p.id);
  $('picker').hidden = true; $('panel').hidden = false; $('notMe').hidden = false;
  $('hello').textContent = `Здравствуй, ${p.first || p.last}!`;
  delta = 0; renderPanel(); layout();
  if (now || isGameVisible()) { played = true; playNew(); }
}

// ---------- рейтинг, призы, механика ----------
const ranked = () => [...people].sort((a, b) => b.coupons - a.coupons || b.pds - a.pds);
const PRIZES = [
  ['15 мультипекарей', 'Мультивыпечка KBS 0501 03', 'p1'],
  ['10 блендеров', 'Погружной блендер KHB 0317 W Tulip', 'p2'],
  ['5 чайников', 'Чайник SMEG KLF03WHEU, белый', 'p3'],
  ['3 сертификата', 'Сертификат на мебель Дятьково Design со скидкой 90%*', 'p4'],
  ['1 сертификат', 'Сертификат на мебель Дятьково Design со скидкой 100%*', 'p5'],
  ['1 диван или кресло', 'На выбор: диваны Талла, Токка, Ланц, Солин; кресла Талла, Омиш, Трим, Тироль, Глено, Бенгал, Кессел', 'p6'],
];
// тексты механики — дословно из файла «механика.docx»
const MECH = [
  'За каждые 200 000 ₽ в чеке вы получаете именной купон (считаем всё, включая рассрочку). Учитываем продажи с 19 ноября по 25 декабря по данным DMI-портала.',
  '30 декабря все купоны отправляются в лототрон. Каждый вытягиваем по одному разу и обратно уже не кладем.',
  'Пока в барабане остается хоть один купон с вашим именем — вы в игре. Чем больше купонов, тем выше шансы.',
  'Отгуляем праздники – и после 13 января 2027 года начнем выдавать призы.',
];
function sheetBody(kind) {
  if (kind === 'prizes') return `<div class="prizes">${PRIZES.map(([t, s, img]) => `<div class="prize"><b>${t}</b><img src="assets/${img}.jpg" alt=""><small>${s}</small></div>`).join('')}</div>
    <p class="bonus">+ 15 бонусных призов в конце розыгрыша</p>
    <p class="foot">*Максимальная сумма заказа по сертификату — 100 000 ₽ с применением базовой скидки (автоматическая скидка в Портале на дату завершения розыгрыша).</p>`;
  if (kind === 'mech') return `<ol class="mech">${MECH.map((t, i) => `<li><b>0${i + 1}.</b><span>${t}</span></li>`).join('')}</ol>`;
  const list = ranked().filter(p => p.coupons > 0 || p.id === me?.id);
  const zero = people.filter(p => p.coupons === 0 && p.id !== me?.id).length;
  return `<ol class="rate">${list.map((p, i) => { const mine = p.id === me?.id;
    return `<li class="${mine ? 'me' : ''}"><span class="pl">${p.coupons > 0 ? i + 1 : '—'}</span><span class="nm"><b>${mine ? 'Ты' : esc(shortName(p))}</b><small>${esc(p.city || '')}</small></span><span class="cp">${p.coupons}</span></li>`; }).join('')}</ol>
    ${zero ? `<p class="rate-note">Ещё ${zero} ${plural(zero, 'участник', 'участника', 'участников')} пока без купонов.</p>` : ''}`;
}
const TITLES = { prizes: 'Призы', mech: 'Механика', rating: 'Рейтинг' };
function openSheet(kind) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="sheet" role="dialog" aria-label="${TITLES[kind]}"><div class="sheet-h"><h2>${TITLES[kind]}</h2><button class="x" aria-label="Закрыть">×</button></div>${sheetBody(kind)}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.x')) m.remove(); });
  document.body.appendChild(m);
  m.querySelector('.rate .me')?.scrollIntoView({ block: 'center' });
}
addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openSheet(b.dataset.open); });
addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelector('.modal')?.remove(); });

// ---------- скролл между экранами ----------
const sc = $('scroller');
const isGameVisible = () => sc.scrollTop >= $('game').offsetTop - 4;
sc.addEventListener('scroll', () => { if (isGameVisible()) onGameVisible(); });
$('hint').onclick = () => sc.scrollTo({ top: $('game').offsetTop, behavior: 'smooth' });

// ---------- старт ----------
(async function start() {
  const [data, d] = await Promise.all([loadData(), createDrum($('drum'), { onTouch: initAudio }), document.fonts.ready]);
  drum = d;
  const rows = parseCSV(data.text);
  people = buildParticipants(rows);
  total = people.reduce((s, p) => s + p.coupons, 0);
  const upd = readUpdated(rows), badge = $('badge');
  if (data.source === 'demo') { badge.textContent = 'Демо-данные'; badge.classList.add('demo'); badge.hidden = false; }
  else if (data.source === 'stale') { badge.textContent = `Нет связи · данные от ${new Date(data.at).toLocaleDateString('ru-RU')}`; badge.hidden = false; }
  else if (upd) { badge.textContent = `Обновлено ${upd}`; badge.hidden = false; }
  $('loading').hidden = true;

  const id = new URLSearchParams(location.search).get('id') || load('me');
  const p = id && people.find(x => x.id === id);
  if (p) choose(p); else { if (id) remove('me'); openPicker(); }

  // звёзды только на обложке, вокруг плашки-счётчика, как в концепте; только вращаются
  const cd = $('countdown');
  createStars([
    { el: cd, ax: 0, ay: 0, dx: 6, dy: 4, size: 40, tilt: .2, desk: { size: 62, dx: 8, dy: 6 } },
    { el: cd, ax: 1, ay: 0, dx: -2, dy: -20, size: 30, tilt: -.3, desk: { size: 48, dx: 6, dy: -40 } },
    { el: cd, ax: 1, ay: 1, dx: -8, dy: -6, size: 34, tilt: .1, desk: { size: 54, dx: -10, dy: -8 } },
  ], { zIndex: 5, sizeScale: () => 1 });
})().catch(err => { console.error(err); $('loading').textContent = 'Не получилось загрузить купоны. Проверь интернет и обнови страницу.'; });
