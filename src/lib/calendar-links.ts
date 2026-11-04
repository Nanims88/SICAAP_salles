/** Titre de l'événement d'agenda (identique dans les e-mails et le fichier « Ajouter à mon agenda »). */
export function calendarSummary(roomName: string, title: string | null): string {
  return title ? `${roomName} – ${title}` : `Réservation ${roomName}`;
}

export function calendarLocation(roomName: string): string {
  return `${roomName} (SICAAP)`;
}

/**
 * Lien « Outlook en ligne » (Microsoft 365) : ouvre un nouvel événement
 * pré-rempli dans Outlook sur le Web ; l'utilisateur n'a plus qu'à l'enregistrer.
 * Ce lien ne gère pas la récurrence : pour une série, utiliser le fichier .ics.
 */
export function outlookWebUrl(e: { subject: string; location: string; body?: string; start: string; end: string }): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.subject,
    location: e.location,
    body: e.body ?? "",
    // Format ISO 8601 en UTC, sans millisecondes (ex. 2026-11-16T09:00:00Z).
    startdt: e.start.replace(/\.\d{3}Z$/, "Z"),
    enddt: e.end.replace(/\.\d{3}Z$/, "Z"),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** Adresse du fichier .ics d'une réservation (servi par l'application). */
export function icsUrl(bookingId: string): string {
  return `/api/reservations/${encodeURIComponent(bookingId)}/agenda`;
}
