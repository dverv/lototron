// Общая логика макетов: демо-данные, единая карточка, счётчик, всплывающие окна.
export const DEMO = { name: 'Ангелина', full: 'Ангелина Смирнова', coupons: 15, week: 6, toNext: 138000, total: 506 };
const COUPON = 200000;
const DRAW = Date.parse('2026-12-30T00:00:00+03:00');   // розыгрыш 30 декабря, Москва

const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const plural = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };
const pad = n => String(n).padStart(2, '0');

export function timeLeft() {
  const ms = Math.max(0, DRAW - Date.now());
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60 };
}

// Счётчик-плакат «Конкурс-лотерея 34:05:12 / дней часов минут / до 30 декабря»
export function mountCountdown(el) {
  el.classList.add('countdown');
  el.innerHTML = `<div class="t">КОНКУРС-ЛОТЕРЕЯ</div><div class="clock"></div>
    <div class="units"><span>дней</span><span>часов</span><span>минут</span></div><div class="till">розыгрыш 30 декабря</div>`;
  const tick = () => { const { d, h, m } = timeLeft(); el.querySelector('.clock').textContent = `${pad(d)}:${pad(h)}:${pad(m)}`; };
  tick(); setInterval(tick, 20000);
}

// Единая карточка: переключатель «мой / общий», купоны, прогресс и дни до розыгрыша в одном блоке.
export function mountPanel(el, { onTab = () => {} } = {}) {
  el.classList.add('panel');
  let tab = 'me';
  const render = () => {
    const { d, h } = timeLeft();
    const days = `<div class="days"><span>до розыгрыша</span><b>${d} ${plural(d, 'день', 'дня', 'дней')} ${h} ч</b></div>`;
    el.innerHTML = `<div class="switch"><button data-t="me" class="${tab === 'me' ? 'on' : ''}">мой лототрон</button><button data-t="all" class="${tab === 'all' ? 'on' : ''}">общий</button></div>` +
      (tab === 'me'
        ? `<div class="big"><span class="n">${DEMO.coupons}</span><div><div class="w">${plural(DEMO.coupons, 'купон', 'купона', 'купонов')}</div><span class="pill">+${DEMO.week} за неделю</span></div></div>
           <div class="bar"><i style="width:${(COUPON - DEMO.toNext) / COUPON * 100}%"></i></div>
           <div class="small">до ${DEMO.coupons + 1}-го купона — ${fmt(DEMO.toNext)} ₽</div>`
        : `<div class="big"><span class="n">${DEMO.total}</span><div><div class="w">купонов</div><span class="pill green">твои — ${DEMO.coupons}</span></div></div>
           <button class="cta" data-open="rating">посмотреть рейтинг</button>`) + days;
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (b && b.dataset.t !== tab) { tab = b.dataset.t; render(); onTab(tab); }
  });
  render();
  return { get tab() { return tab; } };
}

const PRIZES = [
  ['15 мультипекарей', 'Мультивыпечка KBS 0501 03', 'p1'],
  ['10 блендеров', 'Погружной блендер KHB 0317 W Tulip', 'p2'],
  ['5 чайников', 'Чайник SMEG KLF03WHEU, белый', 'p3'],
  ['3 сертификата', 'Сертификат на мебель Дятьково Design со скидкой 90%*', 'p4'],
  ['1 сертификат', 'Сертификат на мебель Дятьково Design со скидкой 100%*', 'p5'],
  ['1 диван или кресло', 'На выбор: диваны Талла, Токка, Ланц, Солин; кресла Талла, Омиш, Трим, Тироль, Глено, Бенгал, Кессел', 'p6'],
];
const MECH = [
  'За каждые 200 000 ₽ в чеке вы получаете именной купон (считаем всё, включая рассрочку). Учитываем продажи с 19 ноября по 25 декабря по данным DMI-портала.',
  '30 декабря все купоны отправляются в лототрон. Каждый вытягиваем по одному разу, обратно не кладём.',
  'Пока в барабане остаётся хоть один купон с вашим именем — вы в игре. Чем больше купонов, тем выше шансы.',
  'Отгуляем праздники — и после 13 января 2027 года начнём выдавать призы.',
];
const RATING = [['Мария К.', 'Орёл', 19], ['Марина П.', 'Калуга', 17], ['Михаил М.', 'Воронеж', 16], ['Ты', 'Брянск', 15, true], ['Ксения К.', 'Рязань', 15],
  ['Наталья А.', 'Рязань', 13], ['Никита Е.', 'Санкт-Петербург', 11], ['Анна М.', 'Калуга', 10], ['Ольга С.', 'Москва', 9], ['Дмитрий Т.', 'Тула', 8], ['Елена В.', 'Курск', 7], ['Ирина Л.', 'Смоленск', 6]];

function body(kind) {
  if (kind === 'prizes') return `<div class="prizes">${PRIZES.map(([t, s, img]) => `<div class="prize"><b>${t}</b><img src="assets/${img}.jpg" alt=""><small>${s}</small></div>`).join('')}</div>
    <p class="bonus">+ 15 бонусных призов в конце розыгрыша</p>
    <p class="foot">*Максимальная сумма заказа по сертификату — 100 000 ₽ с применением базовой скидки (автоматическая скидка в Портале на дату завершения розыгрыша).</p>`;
  if (kind === 'mech') return `<ol class="mech">${MECH.map((t, i) => `<li><b>0${i + 1}.</b><span>${t}</span></li>`).join('')}</ol>`;
  return `<ol class="rate">${RATING.map(([n, c, k, me], i) => `<li class="${me ? 'me' : ''}"><span class="pl">${i + 1}</span><span class="nm"><b>${n}</b><small>${c}</small></span><span class="cp">${k}</span></li>`).join('')}</ol>`;
}
const TITLES = { prizes: 'Призы', mech: 'Механика', rating: 'Рейтинг' };

export function openModal(kind) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="sheet" role="dialog" aria-label="${TITLES[kind]}"><div class="sheet-h"><h2>${TITLES[kind]}</h2><button class="x" aria-label="Закрыть">×</button></div>${body(kind)}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.x')) m.remove(); });
  document.body.appendChild(m);
}
addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openModal(b.dataset.open); });
addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelector('.modal')?.remove(); });
