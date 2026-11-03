"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SETTINGS } from "@/config/settings";
import { cancelBookingAction, createBookingAction, updateBookingAction } from "@/app/actions";
import type { PlanningRoom } from "@/lib/planning";
import { addDaysToKey } from "@/lib/time";
import { readableTextOn } from "@/lib/color";
import { RoomIcon } from "./RoomIcon";

export type DialogState =
  | { mode: "create"; roomId: string; date: string; startTime: string; endTime: string; title: string }
  | {
      mode: "edit";
      id: string;
      roomId: string;
      date: string;
      startTime: string;
      endTime: string;
      title: string;
      ownerName: string;
      isSeries: boolean;
      ended: boolean;
    };

const OPEN = SETTINGS.openingHour * 60;
const CLOSE = SETTINGS.closingHour * 60;
const STEP = SETTINGS.slotMinutes;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const START_TIMES = Array.from({ length: (CLOSE - OPEN) / STEP }, (_, i) => hhmm(OPEN + i * STEP));
const END_TIMES = Array.from({ length: (CLOSE - OPEN) / STEP }, (_, i) => hhmm(OPEN + (i + 1) * STEP));

interface Props {
  state: DialogState;
  rooms: PlanningRoom[];
  users: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
  onDone?: (kind: "created" | "updated" | "cancelled", message?: string) => void;
}

export function BookingDialog({ state, rooms, users, currentUserId, onClose, onDone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [startTime, setStartTime] = useState(state.startTime);
  const [endTime, setEndTime] = useState(state.endTime);
  const editing = state.mode === "edit";
  const readOnly = editing && state.ended;

  function done(kind: "created" | "updated" | "cancelled", result: { ok: boolean; error?: string; message?: string }) {
    if (!result.ok) {
      setError(result.error ?? "Erreur inattendue.");
      return;
    }
    onClose();
    onDone?.(kind, result.message);
    router.refresh();
  }

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      if (editing) done("updated", await updateBookingAction(form));
      else done("created", await createBookingAction(form));
    });
  }

  function cancel(scope: "one" | "following") {
    if (state.mode !== "edit") return;
    const question =
      scope === "following"
        ? "Annuler cette réservation et toutes les suivantes de la série ?"
        : "Annuler cette réservation ?";
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => done("cancelled", await cancelBookingAction(state.id, scope)));
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2>
          {editing ? (readOnly ? "Réservation terminée" : "Modifier la réservation") : "Nouvelle réservation ✨"}
          {editing && <span className="muted" style={{ fontWeight: 400 }}> · {state.ownerName}</span>}
        </h2>
        {error && <div className="alert error">{error}</div>}
        <form action={submit}>
          {editing && <input type="hidden" name="id" value={state.id} />}
          <fieldset disabled={readOnly || pending}>
            <div className="field" role="radiogroup" aria-label="Salle">
              <span className="field-title">Salle</span>
              <div className="room-picker">
                {rooms.map((r) => (
                  <label key={r.id} className="room-card">
                    <input type="radio" name="roomId" value={r.id} defaultChecked={r.id === state.roomId} required />
                    <span className="face">
                      <span className="icon" style={{ background: r.color, color: readableTextOn(r.color) }}>
                        <RoomIcon capacity={r.capacity} />
                      </span>
                      <span className="name">{r.name}</span>
                      <span className="cap">{r.capacity} pers.</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" name="date" type="date" defaultValue={state.date} required />
              </div>
              <div className="field">
                <label htmlFor="startTime">Début</label>
                <select id="startTime" name="startTime" value={startTime} onChange={(e) => {
                  setStartTime(e.target.value);
                  if (e.target.value >= endTime) {
                    const i = START_TIMES.indexOf(e.target.value);
                    setEndTime(END_TIMES[Math.min(i + 1, END_TIMES.length - 1)]);
                  }
                }}>
                  {START_TIMES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="endTime">Fin</label>
                <select id="endTime" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {END_TIMES.filter((t) => t > startTime).map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="title">Objet <span className="muted" style={{ fontWeight: 400 }}>(facultatif, visible par vous et les administrateurs)</span></label>
              <input id="title" name="title" maxLength={200} defaultValue={state.title} placeholder="Ex. Point client" />
            </div>
            {!editing && users.length > 0 && (
              <div className="field">
                <label htmlFor="ownerId">Réserver pour</label>
                <select id="ownerId" name="ownerId" defaultValue={currentUserId}>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            {!editing && (
              <div className="field">
                <label className="inline">
                  <input type="checkbox" name="repeat" value="weekly" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                  Répéter chaque semaine
                </label>
                {repeat && (
                  <div style={{ marginTop: 8 }}>
                    <label htmlFor="repeatUntil">Jusqu&apos;au (inclus)</label>
                    <input id="repeatUntil" name="repeatUntil" type="date" required min={state.date}
                      defaultValue={addDaysToKey(state.date, 28)} />
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                      {SETTINGS.maxRecurrenceWeeks} semaines maximum. Les jours fériés et fermetures sont ignorés.
                    </p>
                  </div>
                )}
              </div>
            )}
          </fieldset>
          <div className="actions">
            {editing && !readOnly && (
              <div className="left">
                <button type="button" className="danger" disabled={pending} onClick={() => cancel("one")}>
                  {state.isSeries ? "Annuler cette date" : "Annuler la réservation"}
                </button>
                {state.isSeries && (
                  <button type="button" className="danger" disabled={pending} onClick={() => cancel("following")}>
                    … et les suivantes
                  </button>
                )}
              </div>
            )}
            <button type="button" className="secondary" onClick={onClose}>Fermer</button>
            {!readOnly && (
              <button type="submit" disabled={pending}>{pending ? "Enregistrement…" : editing ? "Enregistrer" : "Réserver"}</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
