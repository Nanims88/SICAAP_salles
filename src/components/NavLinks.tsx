"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/", label: "Planning", active: path === "/" },
    { href: "/mes-reservations", label: "Mes réservations", active: path.startsWith("/mes-reservations") },
    ...(isAdmin ? [{ href: "/admin", label: "Administration", active: path.startsWith("/admin") }] : []),
  ];
  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={l.active ? "active" : ""} aria-current={l.active ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
