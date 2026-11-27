// Запускается в GitHub Actions перед выкладкой: скачивает опубликованную Google-таблицу
// (ссылка в секрете SHEET_CSV_URL, в репозитории её нет — там полные ФИО) и пишет data.csv
// без полных отчеств. Если таблица недоступна или пришла пустой — оставляет прежний data.csv.
// Дату «Обновлено» ставит сам: сегодняшнюю (по Москве), если данные изменились с прошлой выкладки,
// иначе оставляет прежнюю. Ячейку «Обновлено» в таблице вести не нужно.
import fs from 'node:fs';
import { toSiteCsv } from '../js/data.js';

const url = process.env.SHEET_CSV_URL;
const site = process.env.SITE_URL || 'https://konkurs.dyatkovo.ru/';
const out = new URL('../data.csv', import.meta.url);
const body = csv => csv.split('\n').slice(1).join('\n');            // всё, кроме строки «Обновлено»
const dateOf = csv => (csv.split('\n')[0].split(',')[1] || '').trim();
const today = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

try {
  if (!url) throw new Error('нет секрета SHEET_CSV_URL');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let fresh = toSiteCsv(text, today);
  if (fresh.people < 10) throw new Error(`в таблице всего ${fresh.people} чел. — похоже на ошибку`);

  // то, что сейчас на сайте: если данные те же — дату не трогаем
  let prev = '';
  try { const r = await fetch(new URL('data.csv', site) + '?t=' + Date.now()); if (r.ok) prev = await r.text(); } catch {}
  if (!prev && fs.existsSync(out)) prev = fs.readFileSync(out, 'utf8');
  if (process.env.FORCE_TODAY !== 'true' && prev && body(prev) === body(fresh.csv) && dateOf(prev)) fresh = toSiteCsv(text, dateOf(prev));

  fs.writeFileSync(out, fresh.csv);
  console.log(`data.csv: ${fresh.people} чел., ${fresh.coupons} купонов, обновлено ${fresh.updated}`);
} catch (e) {
  console.log(`::warning::Таблица не обновлена (${e.message}), на сайте остаются прежние данные`);
}
