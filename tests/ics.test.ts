import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, icsEscape } from "@/lib/ics";

const base = {
  uid: "abc@sicaap-salles",
  start: new Date("2026-11-03T09:00:00Z"),
  end: new Date("2026-11-03T10:00:00Z"),
  summary: "Grande salle – Point client",
  location: "Grande salle (SICAAP)",
  organizerEmail: "reservations@sicaap.com",
  attendeeEmail: "a.texier@sicaap.com",
  attendeeName: "A. Texier",
};

describe("invitations .ics", () => {
  it("produit une invitation REQUEST valide", () => {
    const ics = buildIcs("REQUEST", base, new Date("2026-11-02T08:00:00Z"));
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("DTSTART:20261103T090000Z");
    expect(ics).toContain("DTEND:20261103T100000Z");
    expect(ics).toContain("UID:abc@sicaap-salles");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });

  it("produit une annulation et une récurrence", () => {
    const cancel = buildIcs("CANCEL", { ...base, recurrenceId: base.start });
    expect(cancel).toContain("METHOD:CANCEL");
    expect(cancel).toContain("STATUS:CANCELLED");
    expect(cancel).toContain("RECURRENCE-ID:20261103T090000Z");
    const series = buildIcs("REQUEST", { ...base, weeklyUntil: new Date("2026-12-01T10:00:00Z"), exdates: [new Date("2026-11-10T09:00:00Z")] });
    expect(series).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261201T100000Z");
    expect(series).toContain("EXDATE:20261110T090000Z");
  });

  it("échappe et replie le texte", () => {
    expect(icsEscape("a,b;c\nd")).toBe("a\\,b\;c\\nd");
    const folded = foldLine("SUMMARY:" + "é".repeat(60));
    expect(folded.split("\r\n ").every((p) => Buffer.byteLength(p) <= 75)).toBe(true);
  });
});
