import { Header } from "@/components/Header";
import { WeekPlanning } from "@/components/WeekPlanning";
import { requireUser } from "@/lib/auth";
import { loadWeek } from "@/lib/planning";
import { mondayOf, todayKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const user = await requireUser();
  const { semaine } = await searchParams;
  const ref = semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? semaine : todayKey();
  const data = await loadWeek(user, mondayOf(ref));
  return (
    <>
      <Header user={user} />
      <main>
        <WeekPlanning data={data} isAdmin={user.role === "ADMIN"} currentUserId={user.id} />
      </main>
    </>
  );
}
