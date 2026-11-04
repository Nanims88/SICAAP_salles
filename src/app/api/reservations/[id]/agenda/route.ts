import { getCurrentUser } from "@/lib/auth";
import { canManage } from "@/lib/bookings";
import { calendarLocation, calendarSummary } from "@/lib/calendar-links";
import { prisma } from "@/lib/db";
import { buildCalendarFile } from "@/lib/ics";
import { parisDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Fichier .ics « Ajouter à mon agenda » d'une réservation.
 * Pour une réservation récurrente, le fichier contient toute la série à venir.
 * Accès : l'auteur de la réservation ou un administrateur.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Non connecté.", { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.status !== "CONFIRMED") return new Response("Réservation introuvable.", { status: 404 });
  if (!canManage(user, booking)) return new Response("Accès refusé.", { status: 403 });

  const rows = booking.seriesId
    ? await prisma.booking.findMany({
        where: { seriesId: booking.seriesId, status: "CONFIRMED", end: { gt: new Date() } },
        include: { room: true },
        orderBy: { start: "asc" },
      })
    : [{ ...booking, room: await prisma.room.findUniqueOrThrow({ where: { id: booking.roomId } }) }];

  if (rows.length === 0) return new Response("Cette réservation est terminée.", { status: 410 });

  const appUrl = process.env.APP_URL ?? new URL(_req.url).origin;
  const ics = buildCalendarFile(
    `${booking.seriesId ?? booking.id}@sicaap-salles`,
    rows.map((r) => ({
      start: r.start,
      end: r.end,
      originalStart: r.originalStart ?? r.start,
      summary: calendarSummary(r.room.name, r.title),
      location: calendarLocation(r.room.name),
      description: `Réservation faite sur ${appUrl}`,
    })),
  );

  const first = rows[0];
  const slug = first.room.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  const filename = `reservation-${slug}-${parisDateKey(first.start)}${booking.seriesId ? "-serie" : ""}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
