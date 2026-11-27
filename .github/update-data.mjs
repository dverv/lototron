// Запускается в GitHub Actions перед выкладкой: скачивает опубликованную Google-таблицу
// (ссылка в секрете SHEET_CSV_URL, в репозитории её нет — там полные ФИО) и пишет data.csv
// без полных отчеств. Если таблица недоступна или пришла пустой — оставляет прежний data.csv.
import fs from 'node:fs';
import { toSiteCsv } from '../js/data.js';

const url = process.env.SHEET_CSV_URL;
const out = new URL('../data.csv', import.meta.url);
try {
  if (!url) throw new Error('нет секрета SHEET_CSV_URL');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = toSiteCsv(await res.text());
  if (r.people < 10) throw new Error(`в таблице всего ${r.people} чел. — похоже на ошибку`);
  fs.writeFileSync(out, r.csv);
  console.log(`data.csv обновлён: ${r.people} чел., ${r.coupons} купонов, обновлено ${r.updated}`);
} catch (e) {
  console.log(`::warning::Таблица не обновлена (${e.message}), на сайте остаются прежние данные`);
}
