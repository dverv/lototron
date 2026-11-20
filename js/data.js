// Данные конкурса: чтение опубликованной Google-таблицы (CSV) и подсчёт купонов.
// Модуль без DOM — тестируется в node (tests/data.test.mjs).

export const COUPON_RUB = 200000; // 1 купон за каждые 200 000 ₽ ПДС (регламент, п. 1)

// RFC 4180: кавычки, запятые и переводы строк внутри кавычек, "" внутри кавычек, CRLF.
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parsePds(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[\s  ₽]/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function makeId(fio, city) {
  return (fnv1a(`${norm(fio)}|${norm(city)}`) % 36 ** 6).toString(36).padStart(6, '0');
}

const norm = s => String(s ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

const COLS = { fio: ['фио'], city: ['город', 'салон'], brand: ['направ'], pds: ['пдс'] };

export function buildParticipants(rows) {
  const hi = rows.findIndex(r => r.some(c => norm(c).startsWith('фио')));
  if (hi < 0) return [];
  const head = rows[hi].map(norm);
  const col = {};
  for (const [key, prefixes] of Object.entries(COLS)) col[key] = head.findIndex(h => prefixes.some(p => h.startsWith(p)));

  const out = [], used = new Set();
  for (const r of rows.slice(hi + 1)) {
    const fio = String(r[col.fio] ?? '').trim().replace(/\s+/g, ' ');
    if (!fio) continue;
    const city = col.city >= 0 ? String(r[col.city] ?? '').trim() : '';
    const brand = col.brand >= 0 ? String(r[col.brand] ?? '').trim() : '';
    const pds = col.pds >= 0 ? parsePds(r[col.pds]) : 0;
    let id = makeId(fio, city);
    for (let n = 2; used.has(id); n++) id = makeId(fio, `${city}#${n}`); // полные тёзки в одном городе
    used.add(id);
    const [last = '', first = ''] = fio.split(' ');
    const coupons = Math.floor(pds / COUPON_RUB);
    out.push({ id, fio, first, last, city, brand, pds, coupons, toNext: COUPON_RUB * (coupons + 1) - pds });
  }
  return out;
}

export function shortName(p) {
  return p.first ? `${p.first} ${p.last[0]}.` : p.last;
}

export function searchByLastName(list, query) {
  const q = norm(query);
  if (q.length < 3) return [];
  return list.filter(p => norm(p.fio).split(' ').some(w => w.startsWith(q)));
}

// Ячейка «Обновлено» рядом с подписью (обычно над шапкой таблицы).
export function readUpdated(rows) {
  for (const r of rows) {
    const i = r.findIndex(c => norm(c).startsWith('обновлено'));
    if (i >= 0) { const v = String(r[i + 1] ?? '').trim(); return v || null; }
  }
  return null;
}
