"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cancelBookingAction } from "@/app/actions";

export function CancelButton({ id, isSeries }: { id: string; isSeries: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(scope: "one" | "following") {
    const q = scope === "following" ? "Annuler cette réservation et toutes les suivantes de la série ?" : "Annuler cette réservation ?";
    if (!window.confirm(q)) return;
    start(async () => {
      const r = await cancelBookingAction(id, scope);
      if (!r.ok) window.alert(r.error);
      router.refresh();
    });
  }
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="small danger" disabled={pending} onClick={() => run("one")}>Annuler</button>
      {isSeries && <button className="small secondary" disabled={pending} onClick={() => run("following")}>+ suivantes</button>}
    </span>
  );
}
