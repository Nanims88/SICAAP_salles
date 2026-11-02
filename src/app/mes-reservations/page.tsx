import { Header } from "@/components/Header";
import { BookingTable } from "@/components/BookingTable";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const user = await requireUser();
  const rows = await prisma.booking.findMany({
    where: { ownerId: user.id, status: "CONFIRMED", end: { gt: new Date() } },
    include: { room: { select: { name: true, color: true } } },
    orderBy: { start: "asc" },
  });
  return (
    <>
      <Header user={user} />
      <main>
        <div className="card">
          <h2>Mes réservations à venir ({rows.length})</h2>
          <BookingTable rows={rows} />
        </div>
      </main>
    </>
  );
}
