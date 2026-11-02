import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { SETTINGS } from "@/config/settings";

const TZ = SETTINGS.timeZone;

/** Convertit une date "AAAA-MM-JJ" et une heure "HH:mm" (heure de Paris) en instant UTC. */
export function parisToUtc(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Date ou heure invalide");
  }
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

/** Date calendaire "AAAA-MM-JJ" d'un instant, vue depuis Paris. */
export function parisDateKey(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

/** Heure "HH:mm" d'un instant, vue depuis Paris. */
export function parisTime(d: Date): string {
  return formatInTimeZone(d, TZ, "HH:mm");
}

/** Minutes écoulées depuis minuit (heure de Paris). */
export function parisMinutesOfDay(d: Date): number {
  const z = toZonedTime(d, TZ);
  return z.getHours() * 60 + z.getMinutes();
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date calendaire "AAAA-MM-JJ". */
export function isoWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Ajoute des jours à une date calendaire "AAAA-MM-JJ". */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant la date calendaire donnée. */
export function mondayOf(dateKey: string): string {
  return addDaysToKey(dateKey, 1 - isoWeekday(dateKey));
}

/** Date calendaire du jour à Paris. */
export function todayKey(now: Date = new Date()): string {
  return parisDateKey(now);
}

/** Libellé lisible, ex. "lundi 3 novembre 2026". */
export function formatDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Libellé court, ex. "lun. 3 nov.". */
export function formatDateShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Conversion d'une colonne @db.Date (minuit UTC) en clé "AAAA-MM-JJ". */
export function dbDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Conversion d'une clé "AAAA-MM-JJ" en valeur pour une colonne @db.Date. */
export function keyToDbDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export { addDays, format };
