"use client";

import { useEffect, useRef, useState } from "react";
import { calendarLocation, calendarSummary, icsUrl, outlookWebUrl } from "@/lib/calendar-links";

export interface CalendarBooking {
  id: string;
  start: string;
  end: string;
  title: string | null;
  roomName: string;
  isSeries: boolean;
}

/**
 * Bouton « Ajouter à mon agenda » : Outlook en ligne (lien pré-rempli)
 * ou fichier .ics pour Outlook installé (toute la série si récurrente).
 */
export function AddToCalendar({ booking, label = "Ajouter à mon agenda", compact = false, placement = "above" }: { booking: CalendarBooking; label?: string; compact?: boolean; placement?: "above" | "below" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const web = outlookWebUrl({
    subject: calendarSummary(booking.roomName, booking.title),
    location: calendarLocation(booking.roomName),
    body: `Réservation faite sur ${typeof window !== "undefined" ? window.location.origin : "l'application de réservation des salles"}`,
    start: booking.start,
    end: booking.end,
  });

  return (
    <div className={`cal-add${placement === "below" ? " below" : ""}`} ref={ref}>
      <button
        type="button"
        className={compact ? "small secondary" : "secondary"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">📅</span> {label}
      </button>
      {open && (
        <div className="cal-menu" role="menu">
          <a role="menuitem" href={web} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <strong>Outlook en ligne</strong>
            <span>{booking.isSeries ? "Ajoute cette date uniquement" : "S'ouvre pré-rempli : cliquez sur Enregistrer"}</span>
          </a>
          <a role="menuitem" href={icsUrl(booking.id)} download onClick={() => setOpen(false)}>
            <strong>Outlook installé (fichier .ics)</strong>
            <span>{booking.isSeries ? "Ajoute toute la série en une fois" : "Ouvrez le fichier puis « Enregistrer et fermer »"}</span>
          </a>
        </div>
      )}
    </div>
  );
}
