"use client";

import { useActionState } from "react";
import { createUserAction, resetPasswordAction, type AdminState } from "../actions";

function PasswordNotice({ state }: { state: AdminState }) {
  if (!state) return null;
  if (!state.ok) return <div className="alert error">{state.error}</div>;
  return (
    <div className="alert success">
      {state.message}
      {state.password && (
        <>
          {" "}Mot de passe provisoire : <strong style={{ fontFamily: "monospace", fontSize: 15 }}>{state.password}</strong>
          <br />
          <small>À communiquer à la personne : il ne sera plus affiché. Il devra être changé à la première connexion.</small>
        </>
      )}
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, null);
  return (
    <form action={action}>
      <PasswordNotice state={state} />
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field"><label>Prénom Nom</label><input name="name" required maxLength={80} /></div>
        <div className="field"><label>E-mail</label><input name="email" type="email" required /></div>
        <div className="field" style={{ flex: "0 0 170px" }}>
          <label>Rôle</label>
          <select name="role" defaultValue="USER">
            <option value="USER">Utilisateur</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
        <div className="field" style={{ flex: "0 0 auto" }}><button type="submit" disabled={pending}>Créer</button></div>
      </div>
    </form>
  );
}

export function ResetPasswordButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm("Générer un nouveau mot de passe provisoire ?")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      {state ? <PasswordNotice state={state} /> : <button className="small secondary" disabled={pending}>Réinitialiser</button>}
    </form>
  );
}
