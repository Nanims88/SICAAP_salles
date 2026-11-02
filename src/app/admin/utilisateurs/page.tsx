import { ErrorBanner } from "@/components/ErrorBanner";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateUserAction } from "../actions";
import { CreateUserForm, ResetPasswordButton } from "./UserForms";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const me = await requireAdmin();
  const { erreur } = await searchParams;
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <ErrorBanner error={erreur} />
      <div className="card">
        <h2>Créer un compte</h2>
        <CreateUserForm />
      </div>
      <div className="card">
        <h2>Utilisateurs ({users.length})</h2>
        <table>
          <thead><tr><th>Nom / e-mail</th><th>Rôle</th><th>Actif</th><th>État</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td colSpan={4} style={{ padding: 0 }}>
                  <form action={updateUserAction} style={{ display: "grid", gridTemplateColumns: "1fr 140px 60px 170px 110px", gap: 10, alignItems: "center", padding: "6px 10px" }}>
                    <input type="hidden" name="id" value={u.id} />
                    <div>
                      <input name="name" defaultValue={u.name} required />
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{u.email}{u.id === me.id && " (vous)"}</div>
                    </div>
                    <select name="role" defaultValue={u.role}>
                      <option value="USER">Utilisateur</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                    <input name="active" type="checkbox" defaultChecked={u.active} />
                    <span>
                      {!u.active ? <span className="badge off">désactivé</span>
                        : u.mustChangePassword ? <span className="badge">mot de passe provisoire</span>
                        : <span className="badge">actif</span>}
                    </span>
                    <button type="submit" className="small secondary">Enregistrer</button>
                  </form>
                </td>
                <td style={{ textAlign: "right" }}><ResetPasswordButton id={u.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
