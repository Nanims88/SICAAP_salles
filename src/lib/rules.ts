import { SETTINGS } from "@/config/settings";
import { holidayName } from "@/lib/holidays";
import { addDaysToKey, isoWeekday, parisDateKey, parisMinutesOfDay } from "@/lib/time";

export interface ClosureLike {
  roomId: string | null;
  /** "AAAA-MM-JJ", inclus */
  startDate: string;
  /** "AAAA-MM-JJ", inclus */
  endDate: string;
  reason: string;
}

export interface SlotInput {
  roomId: string;
  start: Date;
  end: Date;
}

export interface RuleContext {
  now: Date;
  closures: ClosureLike[];
  /** Les administrateurs peuvent réserver au-delà du délai maximal. */
  isAdmin?: boolean;
}

/** Date limite (exclue) de réservation : aujourd'hui + N mois. */
export function maxBookingDateKey(now: Date): string {
  const today = parisDateKey(now);
  const [y, m, d] = today.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1 + SETTINGS.maxAdvanceMonths, d));
  return limit.toISOString().slice(0, 10);
}

/** Fermeture applicable à une salle à une date donnée, ou null. */
export function closureFor(roomId: string, dateKey: string, closures: ClosureLike[]): ClosureLike | null {
  return (
    closures.find(
      (c) => (c.roomId === null || c.roomId === roomId) && c.startDate <= dateKey && dateKey <= c.endDate,
    ) ?? null
  );
}

/**
 * Vérifie qu'un créneau respecte les règles métier.
 * Retourne la liste des erreurs (vide si le créneau est valide).
 * Le contrôle des chevauchements est fait séparément (base de données).
 */
export function validateSlot(slot: SlotInput, ctx: RuleContext): string[] {
  const errors: string[] = [];
  const { start, end } = slot;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ["Date ou heure invalide."];
  }
  if (end <= start) {
    return ["L'heure de fin doit être après l'heure de début."];
  }

  const dayKey = parisDateKey(start);
  const endMinutes = parisMinutesOfDay(end);
  const sameDay =
    parisDateKey(end) === dayKey || (endMinutes === 0 && parisDateKey(end) === addDaysToKey(dayKey, 1));
  if (!sameDay) {
    return ["Une réservation doit commencer et finir le même jour."];
  }

  const startMin = parisMinutesOfDay(start);
  const endMin = endMinutes === 0 ? 24 * 60 : endMinutes;
  const step = SETTINGS.slotMinutes;
  if (startMin % step !== 0 || endMin % step !== 0 || start.getUTCSeconds() !== 0 || end.getUTCSeconds() !== 0) {
    errors.push(`Les horaires doivent être alignés sur des créneaux de ${step} minutes.`);
  }

  if (startMin < SETTINGS.openingHour * 60 || endMin > SETTINGS.closingHour * 60) {
    errors.push(`Les réservations sont possibles de ${SETTINGS.openingHour}h à ${SETTINGS.closingHour}h.`);
  }

  if (!SETTINGS.openDays.includes(isoWeekday(dayKey))) {
    errors.push("Les réservations sont possibles du lundi au vendredi.");
  }

  const holiday = holidayName(dayKey);
  if (holiday) {
    errors.push(`Jour férié (${holiday}).`);
  }

  const closure = closureFor(slot.roomId, dayKey, ctx.closures);
  if (closure) {
    errors.push(`Salle fermée : ${closure.reason}.`);
  }

  if (start < ctx.now) {
    errors.push("Impossible de réserver un créneau passé.");
  }

  if (!ctx.isAdmin && dayKey >= maxBookingDateKey(ctx.now)) {
    errors.push(`Réservation possible au maximum ${SETTINGS.maxAdvanceMonths} mois à l'avance.`);
  }

  return errors;
}
