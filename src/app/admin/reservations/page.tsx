import Link from "next/link";
import { BookingTable } from "@/components/BookingTable";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ salle?: string }> }) {
  const { salle } = await searchParams;
  const rooms = await prisma.room.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const rows = await prisma.booking.findMany({
    where: { status: "CONFIRMED", end: { gt: new Date() }, ...(salle ? { roomId: salle } : {}) },
    include: { room: { select: { name: true, color: true } }, owner: { select: { name: true } } },
    orderBy: { start: "asc" },
    take: 300,
  });
  return (
    <div className="card">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Réservations à venir ({rows.length})</h2>
        <div className="legend">
          <Link href="/admin/reservations" className={salle ? "" : "badge"}>Toutes</Link>
          {rooms.map((r) => (
            <Link key={r.id} href={`/admin/reservations?salle=${r.id}`} className={salle === r.id ? "badge" : ""}>{r.name}</Link>
          ))}
        </div>
      </div>
      <BookingTable rows={rows} showOwner />
    </div>
  );
}
