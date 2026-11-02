import { ErrorBanner } from "@/components/ErrorBanner";
import { prisma } from "@/lib/db";
import { frenchHolidays } from "@/lib/holidays";
import { dbDateToKey, formatDateLong, keyToDbDate, todayKey } from "@/lib/time";
import { addClosureAction, deleteClosureAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClosuresPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const today = todayKey();
  const [closures, rooms] = await Promise.all([
    prisma.closure.findMany({ where: { endDate: { gte: keyToDbDate(today) } }, include: { room: true }, orderBy: { startDate: "asc" } }),
    prisma.room.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const year = Number(today.slice(0, 4));
  const holidays = [...frenchHolidays(year), ...frenchHolidays(year + 1)].filter(([k]) => k >= today).slice(0, 12);

  return (
    <div className="stack">
      <ErrorBanner error={erreur} />
      <div className="card">
        <h2>Ajouter une fermeture</h2>
        <form action={addClosureAction} className="row" style={{ alignItems: "flex-end" }}>
          <div className="field"><label>Du</label><input name="startDate" type="date" required min={today} /></div>
          <div className="field"><label>Au (inclus)</label><input name="endDate" type="date" min={today} /></div>
          <div className="field">
            <label>Salle</label>
            <select name="roomId" defaultValue="">
              <option value="">Toutes les salles</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 2 }}><label>Motif</label><input name="reason" required maxLength={120} placeholder="Ex. Fermeture estivale, travaux…" /></div>
          <div className="field" style={{ flex: "0 0 auto" }}><button type="submit">Ajouter</button></div>
        </form>
        <p className="muted">Les réservations déjà existantes sur la période ne sont pas annulées automatiquement : vérifiez l&apos;onglet Réservations.</p>
      </div>
      <div className="card">
        <h2>Fermetures à venir ({closures.length})</h2>
        {closures.length === 0 ? <p className="muted">Aucune fermeture programmée.</p> : (
          <table>
            <thead><tr><th>Période</th><th>Salle</th><th>Motif</th><th /></tr></thead>
            <tbody>
              {closures.map((c) => (
                <tr key={c.id}>
                  <td>{formatDateLong(dbDateToKey(c.startDate))}{dbDateToKey(c.endDate) !== dbDateToKey(c.startDate) && ` → ${formatDateLong(dbDateToKey(c.endDate))}`}</td>
                  <td>{c.room?.name ?? "Toutes"}</td>
                  <td>{c.reason}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={deleteClosureAction}><input type="hidden" name="id" value={c.id} /><button className="small danger">Supprimer</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h2>Jours fériés (bloqués automatiquement)</h2>
        <ul style={{ margin: 0, columns: 2 }}>
          {holidays.map(([k, name]) => <li key={k}>{formatDateLong(k)} — {name}</li>)}
        </ul>
      </div>
    </div>
  );
}
