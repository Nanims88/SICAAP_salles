import Link from "next/link";
import { BRAND } from "@/config/brand";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions";

export function Header({ user }: { user: CurrentUser }) {
  return (
    <header className="header">
      <Link href="/" className="brand">
        {BRAND.logo && (
          <span className="logo-badge"><img src={BRAND.logo} alt="" /></span>
        )}
        {BRAND.appName}
        <small>{BRAND.appSubtitle}</small>
      </Link>
      <nav>
        <Link href="/">Planning</Link>
        <Link href="/mes-reservations">Mes réservations</Link>
        {user.role === "ADMIN" && <Link href="/admin">Administration</Link>}
      </nav>
      <div className="user">
        <span>{user.name}</span>
        <Link href="/mot-de-passe" style={{ color: "inherit" }}>Mot de passe</Link>
        <form action={logoutAction}>
          <button type="submit" className="small">Déconnexion</button>
        </form>
      </div>
    </header>
  );
}
