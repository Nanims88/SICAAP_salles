"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/salles", label: "Salles" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/fermetures", label: "Fermetures" },
  { href: "/admin/reservations", label: "Réservations" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <div className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path.startsWith(t.href) ? "active" : ""}>{t.label}</Link>
      ))}
    </div>
  );
}
