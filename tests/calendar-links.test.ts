import { describe, expect, it } from "vitest";
import { calendarSummary, icsUrl, outlookWebUrl } from "@/lib/calendar-links";

describe("lien « Outlook en ligne »", () => {
  it("pré-remplit sujet, lieu et horaires (UTC, sans millisecondes)", () => {
    const url = new URL(
      outlookWebUrl({
        subject: calendarSummary("Grande salle", "Point client"),
        location: "Grande salle (SICAAP)",
        start: "2026-11-10T09:00:00.000Z",
        end: "2026-11-10T10:00:00.000Z",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://outlook.office.com/calendar/0/deeplink/compose");
    expect(url.searchParams.get("subject")).toBe("Grande salle – Point client");
    expect(url.searchParams.get("location")).toBe("Grande salle (SICAAP)");
    expect(url.searchParams.get("startdt")).toBe("2026-11-10T09:00:00Z");
    expect(url.searchParams.get("enddt")).toBe("2026-11-10T10:00:00Z");
  });

  it("nomme l'événement par défaut et construit l'adresse du fichier", () => {
    expect(calendarSummary("Box 1", null)).toBe("Réservation Box 1");
    expect(icsUrl("abc")).toBe("/api/reservations/abc/agenda");
  });
});
