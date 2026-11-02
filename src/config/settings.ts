/**
 * Règles métier de réservation. Toutes les heures s'entendent en heure de Paris.
 */
export const SETTINGS = {
  timeZone: "Europe/Paris",
  /** Heure d'ouverture (incluse), en heures. */
  openingHour: 8,
  /** Heure de fermeture (une réservation doit finir au plus tard à cette heure). */
  closingHour: 19,
  /** Granularité des créneaux, en minutes. */
  slotMinutes: 30,
  /** Jours réservables, numérotation ISO (1 = lundi … 7 = dimanche). */
  openDays: [1, 2, 3, 4, 5] as readonly number[],
  /** Délai maximal de réservation à l'avance, en mois. */
  maxAdvanceMonths: 3,
  /** Nombre maximal d'occurrences d'une réservation récurrente hebdomadaire. */
  maxRecurrenceWeeks: 26,
  /** Durée de validité d'une session de connexion, en jours. */
  sessionDays: 7,
} as const;
