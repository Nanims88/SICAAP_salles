"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action}>
      {state && !state.ok && <div className="alert error">{state.error}</div>}
      <div className="field">
        <label htmlFor="current">Mot de passe actuel (ou provisoire)</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">Nouveau mot de passe</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirmation</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <button type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
