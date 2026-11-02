/**
 * Jours fériés légaux en France métropolitaine (hors Alsace-Moselle).
 */

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function key(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** Jours fériés d'une année : clé "AAAA-MM-JJ" → libellé. */
export function frenchHolidays(year: number): Map<string, string> {
  const { month, day } = easterSunday(year);
  const easter = (offset: number) => key(year, month, day + offset);
  return new Map<string, string>([
    [key(year, 1, 1), "Jour de l'an"],
    [easter(1), "Lundi de Pâques"],
    [key(year, 5, 1), "Fête du Travail"],
    [key(year, 5, 8), "Victoire 1945"],
    [easter(39), "Ascension"],
    [easter(50), "Lundi de Pentecôte"],
    [key(year, 7, 14), "Fête nationale"],
    [key(year, 8, 15), "Assomption"],
    [key(year, 11, 1), "Toussaint"],
    [key(year, 11, 11), "Armistice 1918"],
    [key(year, 12, 25), "Noël"],
  ]);
}

/** Libellé du jour férié pour une date "AAAA-MM-JJ", ou null. */
export function holidayName(dateKey: string): string | null {
  return frenchHolidays(Number(dateKey.slice(0, 4))).get(dateKey) ?? null;
}
