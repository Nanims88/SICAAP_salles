/**
 * Génération de fichiers iCalendar (RFC 5545), compatibles Outlook.
 *
 * Les heures sont écrites dans le fuseau Europe/Paris (TZID + VTIMEZONE) :
 * une réservation récurrente garde ainsi la même heure locale de part et
 * d'autre des changements d'heure été / hiver.
 */
import { formatInTimeZone } from "date-fns-tz";
import { SETTINGS } from "@/config/settings";
import { addDaysToKey, parisDateKey, parisTime, parisToUtc } from "@/lib/time";

const TZ = SETTINGS.timeZone;

/** Définition du fuseau Europe/Paris (heure d'été : dernier dimanche de mars → dernier dimanche d'octobre). */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Instant UTC au format iCalendar (suffixe Z). */
export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Heure locale de Paris au format iCalendar, à utiliser avec TZID. */
export function icsLocal(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyyMMdd'T'HHmmss");
}

const local = (prop: string, d: Date) => `${prop};TZID=${TZ}:${icsLocal(d)}`;

/** Échappement des valeurs texte (RFC 5545 §3.3.11). */
export function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
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

function calendar(method: string, events: string[][]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SICAAP//Reservation des salles//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    ...VTIMEZONE,
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Invitations envoyées par e-mail (REQUEST / CANCEL)
// ---------------------------------------------------------------------------

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
  /** Récurrence hebdomadaire : fin de la dernière occurrence. */
  weeklyUntil?: Date;
  /** Occurrences exclues de la récurrence (débuts). */
  exdates?: Date[];
  /** Pour viser une seule occurrence d'une série. */
  recurrenceId?: Date;
}

export type IcsMethod = "REQUEST" | "CANCEL";

export function buildIcs(method: IcsMethod, event: IcsEvent, now: Date = new Date()): string {
  // SEQUENCE croissant dans le temps : chaque mise à jour remplace la précédente dans Outlook.
  const sequence = Math.floor(now.getTime() / 1000);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `SEQUENCE:${sequence}`,
    local("DTSTART", event.start),
    local("DTEND", event.end),
  ];
  if (event.recurrenceId) lines.push(local("RECURRENCE-ID", event.recurrenceId));
  if (event.weeklyUntil) lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${icsDate(event.weeklyUntil)}`);
  for (const ex of event.exdates ?? []) lines.push(local("EXDATE", ex));
  lines.push(`SUMMARY:${icsEscape(event.summary)}`, `LOCATION:${icsEscape(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  lines.push(
    `ORGANIZER:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${icsEscape(event.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${event.attendeeEmail}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
  );
  return calendar(method, [lines]);
}

// ---------------------------------------------------------------------------
// Fichier « Ajouter à mon agenda » (PUBLISH) : un rendez-vous simple, sans
// organisateur ni réponse à envoyer. Une série devient UNE récurrence
// hebdomadaire, avec ses dates exclues et ses occurrences modifiées.
// ---------------------------------------------------------------------------

export interface CalendarOccurrence {
  start: Date;
  end: Date;
  /** Début prévu dans la série (identique à start si l'occurrence n'a pas été déplacée). */
  originalStart: Date;
  summary: string;
  location: string;
  description?: string;
}

function eventLines(uid: string, now: Date, o: { start: Date; end: Date; summary: string; location: string; description?: string }, extra: string[] = []): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    local("DTSTART", o.start),
    local("DTEND", o.end),
    ...extra,
    `SUMMARY:${icsEscape(o.summary)}`,
    `LOCATION:${icsEscape(o.location)}`,
    ...(o.description ? [`DESCRIPTION:${icsEscape(o.description)}`] : []),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ];
}

/** Même heure locale de Paris, n semaines plus tard (insensible aux changements d'heure). */
function addWeeksLocal(d: Date, n: number): Date {
  return parisToUtc(addDaysToKey(parisDateKey(d), 7 * n), parisTime(d));
}

export function buildCalendarFile(uid: string, occurrences: CalendarOccurrence[], now: Date = new Date()): string {
  if (occurrences.length === 0) throw new Error("Aucune occurrence à exporter.");
  const occs = [...occurrences].sort((a, b) => a.originalStart.getTime() - b.originalStart.getTime());

  if (occs.length === 1) {
    return calendar("PUBLISH", [eventLines(uid, now, occs[0])]);
  }

  // Occurrence « type » de la série : la première non déplacée (sinon la première).
  const ref = occs.find((o) => o.start.getTime() === o.originalStart.getTime()) ?? occs[0];
  const duration = ref.end.getTime() - ref.start.getTime();
  const first = occs[0];
  const last = occs[occs.length - 1];

  // Semaines de la série sans occurrence confirmée (jour férié, fermeture, annulation) → EXDATE.
  const present = new Set(occs.map((o) => icsLocal(o.originalStart)));
  const exdates: Date[] = [];
  for (let w = 1, d = addWeeksLocal(first.originalStart, 1); d <= last.originalStart; w++, d = addWeeksLocal(first.originalStart, w)) {
    if (!present.has(icsLocal(d))) exdates.push(d);
  }

  const master = eventLines(
    uid,
    now,
    { start: first.originalStart, end: new Date(first.originalStart.getTime() + duration), summary: ref.summary, location: ref.location, description: ref.description },
    [`RRULE:FREQ=WEEKLY;UNTIL=${icsDate(last.originalStart)}`, ...exdates.map((d) => local("EXDATE", d))],
  );

  // Occurrences qui diffèrent de la série (horaire, durée, salle ou objet) → exceptions RECURRENCE-ID.
  const overrides = occs
    .filter(
      (o) =>
        o.start.getTime() !== o.originalStart.getTime() ||
        o.end.getTime() - o.start.getTime() !== duration ||
        o.summary !== ref.summary ||
        o.location !== ref.location,
    )
    .map((o) => eventLines(uid, now, o, [local("RECURRENCE-ID", o.originalStart)]));

  return calendar("PUBLISH", [master, ...overrides]);
}
