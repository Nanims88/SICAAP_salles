/**
 * Génération d'invitations iCalendar (RFC 5545), compatibles Outlook.
 * Les heures sont écrites en UTC (suffixe Z) : pas de définition de fuseau à embarquer.
 */

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location: string;
  description?: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
  /** Récurrence hebdomadaire : dernière occurrence (incluse). */
  weeklyUntil?: Date;
  /** Occurrences exclues de la récurrence (débuts). */
  exdates?: Date[];
  /** Pour viser une seule occurrence d'une série. */
  recurrenceId?: Date;
}

export type IcsMethod = "REQUEST" | "CANCEL";

export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Échappement des valeurs texte (RFC 5545 §3.3.11). */
export function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Repli des lignes à 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, "utf8");
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + len > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(method: IcsMethod, event: IcsEvent, now: Date = new Date()): string {
  // SEQUENCE croissant dans le temps : chaque mise à jour remplace la précédente dans Outlook.
  const sequence = Math.floor(now.getTime() / 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SICAAP//Reservation des salles//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
  ];
  if (event.recurrenceId) lines.push(`RECURRENCE-ID:${icsDate(event.recurrenceId)}`);
  if (event.weeklyUntil) lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${icsDate(event.weeklyUntil)}`);
  for (const ex of event.exdates ?? []) lines.push(`EXDATE:${icsDate(ex)}`);
  lines.push(
    `SUMMARY:${icsEscape(event.summary)}`,
    `LOCATION:${icsEscape(event.location)}`,
  );
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  lines.push(
    `ORGANIZER:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${icsEscape(event.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${event.attendeeEmail}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
