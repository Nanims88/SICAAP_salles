import { ErrorBanner } from "@/components/ErrorBanner";
import { prisma } from "@/lib/db";
import { BRAND_PALETTE } from "@/lib/color";
import { saveRoomAction } from "../actions";

export const dynamic = "force-dynamic";

const GRID = "80px 1fr 110px 80px 80px 130px";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const rooms = await prisma.room.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <datalist id="charte">{BRAND_PALETTE.map((c) => <option key={c} value={c} />)}</datalist>
      <ErrorBanner error={erreur} />
      <div className="card">
        <h2>Salles ({rooms.length})</h2>
        <table>
          <thead>
            <tr>
              <th colSpan={6} style={{ padding: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "8px 10px" }}>
                  <span>Ordre</span><span>Nom</span><span>Capacité</span><span>Couleur</span><span>Active</span><span />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td colSpan={6} style={{ padding: 0 }}>
                  <form action={saveRoomAction} style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center", padding: "6px 10px" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <input name="sortOrder" type="number" min={0} defaultValue={r.sortOrder} />
                    <input name="name" defaultValue={r.name} required />
                    <input name="capacity" type="number" min={1} defaultValue={r.capacity} required />
                    <input name="color" type="color" list="charte" defaultValue={r.color} />
                    <input name="active" type="checkbox" defaultChecked={r.active} />
                    <button type="submit" className="small secondary">Enregistrer</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Les couleurs de la charte SICAAP sont proposées dans le sélecteur. Une salle désactivée n&apos;apparaît plus dans le planning ; ses réservations sont conservées.</p>
      </div>
      <div className="card">
        <h2>Ajouter une salle</h2>
        <form action={saveRoomAction} className="row" style={{ alignItems: "flex-end" }}>
          <div className="field"><label>Nom</label><input name="name" required /></div>
          <div className="field"><label>Capacité</label><input name="capacity" type="number" min={1} required /></div>
          <div className="field" style={{ flex: "0 0 70px" }}><label>Couleur</label><input name="color" type="color" list="charte" defaultValue="#6c8ead" /></div>
          <div className="field" style={{ flex: "0 0 90px" }}><label>Ordre</label><input name="sortOrder" type="number" min={0} defaultValue={rooms.length + 1} /></div>
          <div className="field" style={{ flex: "0 0 auto" }}><button type="submit">Ajouter</button></div>
        </form>
      </div>
    </div>
  );
}
