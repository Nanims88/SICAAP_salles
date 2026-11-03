import Link from "next/link";
import { BRAND } from "@/config/brand";
import type { CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
import { NavLinks } from "./NavLinks";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Header({ user }: { user: CurrentUser }) {
  return (
    <header className="header">
      <Link href="/" className="brand">
        {BRAND.logo && <img src={BRAND.logo} alt="" />}
        <span>
          <span className="brand-name">{BRAND.appName}</span>
          <small>{BRAND.appSubtitle}</small>
        </span>
      </Link>
      <NavLinks isAdmin={user.role === "ADMIN"} />
      <div className="user">
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="user-name">
          {user.name}
          <small><Link href="/mot-de-passe">Mot de passe</Link></small>
        </span>
        <form action={logoutAction}>
          <button type="submit" className="icon-button" title="Déconnexion" aria-label="Déconnexion">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}
