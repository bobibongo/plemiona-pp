// src/shared-date.js
// Format: "DD.MM. HH:MM" (rok bieżący) lub "DD.MM.YY HH:MM" (rok 20YY).
const RE = /^(\d{2})\.(\d{2})\.(?:(\d{2}))?\s+(\d{2}):(\d{2})$/;

export function parsePremiumDate(dateRaw, now = new Date()) {
  const s = String(dateRaw).replace(/ /g, ' ').trim();
  const m = RE.exec(s);
  if (!m) throw new Error(`Nieparsowalna data: ${JSON.stringify(dateRaw)}`);
  const [, dd, mm, yy, hh, min] = m;
  const year = yy !== undefined ? 2000 + Number(yy) : now.getFullYear();
  return new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
}
