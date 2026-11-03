import { redirect } from "next/navigation";
import { BRAND } from "@/config/brand";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth-screen">
      <div className="auth-art" aria-hidden="true">
        <span className="stripe s1" />
        <span className="stripe s2" />
        <span className="stripe s3" />
        <span className="stripe s4" />
        <h2>Votre salle, <em>en deux clics.</em></h2>
        <p>Box, petite ou grande salle : réservez le bon espace au bon moment.</p>
      </div>
      <div className="auth-panel">
        <div className="auth">
          <div className="auth-brand">
            {BRAND.logo && <img src={BRAND.logo} alt={`Logo ${BRAND.appName}`} />}
            <div>
              <h1>{BRAND.appName}</h1>
              <p className="muted">{BRAND.appSubtitle}</p>
            </div>
          </div>
          <div className="card">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
