import { SETTINGS } from "@/config/settings";
import { addDaysToKey, parisDateKey, parisTime, parisToUtc } from "@/lib/time";

export interface Occurrence {
  start: Date;
  end: Date;
}

/**
 * Génère les occurrences hebdomadaires d'un créneau, de la première date
 * jusqu'à la date de fin incluse. Les heures restent fixes en heure de Paris
 * (y compris lors des changements d'heure été/hiver).
 */
export function weeklyOccurrences(first: Occurrence, untilDateKey: string): Occurrence[] {
  const firstKey = parisDateKey(first.start);
  if (untilDateKey < firstKey) {
    throw new Error("La date de fin de récurrence doit être postérieure à la première date.");
  }
  const startTime = parisTime(first.start);
  const endTime = parisTime(first.end);
  const result: Occurrence[] = [];
  for (let week = 0; ; week++) {
    const key = addDaysToKey(firstKey, 7 * week);
    if (key > untilDateKey) break;
    if (result.length >= SETTINGS.maxRecurrenceWeeks) {
      throw new Error(`Une récurrence est limitée à ${SETTINGS.maxRecurrenceWeeks} semaines.`);
    }
    result.push({ start: parisToUtc(key, startTime), end: parisToUtc(key, endTime) });
  }
  return result;
}
