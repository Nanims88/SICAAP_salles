import { redirect } from "next/navigation";
import { BRAND } from "@/config/brand";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth card">
      {BRAND.logo && <img src={BRAND.logo} alt={BRAND.appName} style={{ height: 48, marginBottom: 12 }} />}
      <h1>{BRAND.appName}</h1>
      <p className="muted">{BRAND.appSubtitle}</p>
      <LoginForm />
    </div>
  );
}
