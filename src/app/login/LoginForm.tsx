"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action}>
      {state && !state.ok && <div className="alert error">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
        Mot de passe oublié ? Contactez un administrateur.
      </p>
    </form>
  );
}
