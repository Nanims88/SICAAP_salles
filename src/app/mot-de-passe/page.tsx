import { Header } from "@/components/Header";
import { requireUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { PasswordForm } from "./PasswordForm";

export default async function PasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <>
      {!user.mustChangePassword && <Header user={user} />}
      <div className="auth-simple card">
        <h1>Changer de mot de passe</h1>
        {user.mustChangePassword && (
          <p className="alert success">Bienvenue {user.name} ! Choisissez votre mot de passe personnel pour continuer.</p>
        )}
        <p className="muted">Au moins {MIN_PASSWORD_LENGTH} caractères, avec au moins une lettre et un chiffre.</p>
        <PasswordForm />
      </div>
    </>
  );
}
