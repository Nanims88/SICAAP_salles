import { CancelButton } from "@/components/CancelButton";
import { formatDateLong, parisDateKey, parisTime } from "@/lib/time";

export interface BookingRow {
  id: string;
  start: Date;
  end: Date;
  title: string | null;
  seriesId: string | null;
  room: { name: string; color: string };
  owner?: { name: string };
}

export function BookingTable({ rows, showOwner }: { rows: BookingRow[]; showOwner?: boolean }) {
  if (rows.length === 0) return <p className="muted">Aucune réservation à venir.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Horaire</th><th>Salle</th>{showOwner && <th>Réservé par</th>}<th>Objet</th><th />
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.id}>
            <td style={{ textTransform: "capitalize" }}>{formatDateLong(parisDateKey(b.start))}</td>
            <td>{parisTime(b.start)} – {parisTime(b.end)}</td>
            <td><span className="swatch" style={{ background: b.room.color }} />{b.room.name}</td>
            {showOwner && <td>{b.owner?.name}</td>}
            <td>{b.title ?? <span className="muted">—</span>} {b.seriesId && <span className="badge">récurrent</span>}</td>
            <td style={{ textAlign: "right" }}><CancelButton id={b.id} isSeries={!!b.seriesId} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
