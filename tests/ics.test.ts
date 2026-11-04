import { describe, expect, it } from "vitest";
import { buildCalendarFile, buildIcs, foldLine, icsEscape } from "@/lib/ics";
import { parisToUtc } from "@/lib/time";

const base = {
  uid: "abc@sicaap-salles",
  start: new Date("2026-11-03T09:00:00Z"), // 10h à Paris
  end: new Date("2026-11-03T10:00:00Z"),
  summary: "Grande salle – Point client",
  location: "Grande salle (SICAAP)",
  organizerEmail: "reservations@sicaap.com",
  attendeeEmail: "a.texier@sicaap.com",
  attendeeName: "A. Texier",
};

const lines = (ics: string) => ics.split("\r\n");

describe("invitations .ics envoyées par e-mail", () => {
  it("produit une invitation REQUEST à l'heure de Paris", () => {
    const ics = buildIcs("REQUEST", base, new Date("2026-11-02T08:00:00Z"));
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261103T100000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20261103T110000");
    expect(ics).toContain("UID:abc@sicaap-salles");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(lines(ics).every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });

  it("produit une annulation et une récurrence", () => {
    const cancel = buildIcs("CANCEL", { ...base, recurrenceId: base.start });
    expect(cancel).toContain("METHOD:CANCEL");
    expect(cancel).toContain("STATUS:CANCELLED");
    expect(cancel).toContain("RECURRENCE-ID;TZID=Europe/Paris:20261103T100000");
    const series = buildIcs("REQUEST", { ...base, weeklyUntil: new Date("2026-12-01T10:00:00Z"), exdates: [new Date("2026-11-10T09:00:00Z")] });
    expect(series).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261201T100000Z");
    expect(series).toContain("EXDATE;TZID=Europe/Paris:20261110T100000");
  });

  it("échappe et replie le texte", () => {
    expect(icsEscape("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    const folded = foldLine("SUMMARY:" + "é".repeat(60));
    expect(folded.split("\r\n ").every((p) => Buffer.byteLength(p) <= 75)).toBe(true);
  });
});

describe("fichier « Ajouter à mon agenda »", () => {
  const occ = (date: string, s = "10:00", e = "11:00", original?: string, room = "Petite salle") => ({
    start: parisToUtc(date, s),
    end: parisToUtc(date, e),
    originalStart: parisToUtc(original ?? date, s === "10:00" || !original ? s : "10:00"),
    summary: `${room} – Point équipe`,
    location: `${room} (SICAAP)`,
  });

  it("produit un rendez-vous simple (PUBLISH, sans organisateur)", () => {
    const ics = buildCalendarFile("b1@sicaap-salles", [occ("2026-11-10")]);
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261110T100000");
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("RRULE:FREQ=WEEKLY");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  it("regroupe une série en une récurrence qui garde 10h malgré le changement d'heure", () => {
    // 19 et 26 octobre (heure d'été) puis 2 novembre (heure d'hiver)
    const ics = buildCalendarFile("s1@sicaap-salles", [occ("2026-10-19"), occ("2026-10-26"), occ("2026-11-02")]);
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261019T100000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261102T090000Z");
    expect(ics).not.toContain("EXDATE");
    expect(ics).not.toContain("RECURRENCE-ID");
  });

  it("exclut les semaines sans réservation et garde les occurrences déplacées", () => {
    const moved = { ...occ("2026-11-23", "14:00", "15:30"), originalStart: parisToUtc("2026-11-23", "10:00") };
    const ics = buildCalendarFile("s2@sicaap-salles", [occ("2026-11-02"), occ("2026-11-16"), moved]);
    expect(ics).toContain("EXDATE;TZID=Europe/Paris:20261109T100000");
    expect(ics).toContain("RECURRENCE-ID;TZID=Europe/Paris:20261123T100000");
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261123T140000");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
  });
});
