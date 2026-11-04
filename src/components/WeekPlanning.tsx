"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SETTINGS } from "@/config/settings";
import type { PlanningData, PlanningBooking } from "@/lib/planning";
import { readableTextOn } from "@/lib/color";
import { addDaysToKey, formatDateLong, isoWeekday, parisDateKey, parisMinutesOfDay, parisTime } from "@/lib/time";
import { BookingDialog, type DialogState } from "./BookingDialog";
import { RoomIcon } from "./RoomIcon";
import { AddToCalendar } from "./AddToCalendar";
import type { BookingInfo } from "@/lib/bookings";

const SLOT_H = 28; // hauteur d'un créneau de 30 min, en pixels
const OPEN = SETTINGS.openingHour * 60;
const CLOSE = SETTINGS.closingHour * 60;
const STEP = SETTINGS.slotMinutes;
const SLOTS = (CLOSE - OPEN) / STEP;
const CONFETTI_COLORS = ["#f8ac16", "#57cbbb", "#015959", "#ffdc20", "#85d4b1", "#0086ff"];

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function topOf(min: number): number {
  return ((min - OPEN) / STEP) * SLOT_H;
}

function dayParts(key: string): { name: string; num: number } {
  const [y, m, d] = key.split("-").map(Number);
  const name = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "");
  return { name, num: d };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

interface Props {
  data: PlanningData;
  isAdmin: boolean;
  currentUserId: string;
  userName: string;
}

export function WeekPlanning({ data, isAdmin, currentUserId, userName }: Props) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    emoji: string;
    id: number;
    note?: string;
    booking?: BookingInfo;
    actionLabel?: string;
  } | null>(null);
  const now = new Date(data.now);
  const today = parisDateKey(now);
  const nowMin = parisMinutesOfDay(now);

  useEffect(() => {
    // Une notification avec bouton reste affichée jusqu'à sa fermeture.
    if (!toast || toast.booking) return;
    const t = setTimeout(() => setToast(null), toast.note ? 7000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const bookingsByCell = useMemo(() => {
    const map = new Map<string, PlanningBooking[]>();
    for (const b of data.bookings) {
      const k = `${parisDateKey(new Date(b.start))}|${b.roomId}`;
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return map;
  }, [data.bookings]);

  // Petites statistiques de l'accueil
  const mine = data.bookings.filter((b) => b.mine);
  const nextMine = mine.find((b) => new Date(b.end) > now);
  const todayVisible = data.days.some((d) => d.key === today);
  const openNow = todayVisible && nowMin >= OPEN && nowMin < CLOSE && SETTINGS.openDays.includes(isoWeekday(today));
  const busyNow = new Set(
    data.bookings.filter((b) => new Date(b.start) <= now && new Date(b.end) > now).map((b) => b.roomId),
  );
  const freeNow = data.rooms.filter((r) => !busyNow.has(r.id)).length;

  const lastDay = data.days[data.days.length - 1].key;
  const lanes = data.rooms.length || 1;

  function isClosed(dayKey: string, roomId: string): string | null {
    const day = data.days.find((d) => d.key === dayKey)!;
    if (day.holiday) return day.holiday;
    const c = day.closures.find((x) => x.roomId === null || x.roomId === roomId);
    return c ? c.reason : null;
  }

  function openCreate(dayKey: string, roomId: string, startMin: number) {
    setDialog({
      mode: "create",
      roomId,
      date: dayKey,
      startTime: toHHMM(startMin),
      endTime: toHHMM(Math.min(startMin + 60, CLOSE)),
      title: "",
    });
  }

  /** Bouton « Réserver » : prochain créneau ouvré à venir. */
  function openQuickCreate() {
    let day = today;
    let start = Math.max(OPEN, Math.ceil((nowMin + 1) / STEP) * STEP);
    if (!SETTINGS.openDays.includes(isoWeekday(day)) || start > CLOSE - 60) {
      do day = addDaysToKey(day, 1);
      while (!SETTINGS.openDays.includes(isoWeekday(day)));
      start = 9 * 60;
    }
    openCreate(day, data.rooms[0]?.id ?? "", start);
  }

  function openEdit(b: PlanningBooking) {
    if (!b.canManage) return;
    const s = new Date(b.start);
    const e = new Date(b.end);
    setDialog({
      mode: "edit",
      id: b.id,
      roomId: b.roomId,
      date: parisDateKey(s),
      startTime: parisTime(s),
      endTime: parisTime(e),
      title: b.title ?? "",
      ownerName: b.ownerName,
      isSeries: b.isSeries,
      ended: e < now,
      mine: b.mine,
      start: b.start,
      end: b.end,
    });
  }

  function onDone(kind: "created" | "updated" | "cancelled", message?: string, booking?: BookingInfo) {
    const id = Date.now();
    const withCal = booking?.mine ? booking : undefined;
    if (kind === "created") {
      setToast({
        id,
        emoji: "🎉",
        text: message && message !== "Réservation confirmée." ? message : "C'est réservé !",
        note: withCal ? (withCal.isSeries ? "Ajoutez toute la série à votre agenda Outlook :" : "Ajoutez-la à votre agenda Outlook :") : undefined,
        booking: withCal,
      });
    } else if (kind === "updated") {
      setToast({
        id,
        emoji: "✨",
        text: "Réservation modifiée",
        note: withCal ? "Supprimez l'ancien événement de votre agenda, puis ajoutez le nouveau :" : undefined,
        booking: withCal,
        actionLabel: "Mettre à jour mon agenda",
      });
    } else {
      setToast({ id, emoji: "👋", text: "Réservation annulée", note: "Pensez à la retirer de votre agenda Outlook." });
    }
  }

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="hello">
            Bonjour {firstName(userName)} <span className="wave" aria-hidden="true">👋</span>
          </h1>
          <p className="hero-sub">Quel espace vous faut-il aujourd&apos;hui ?</p>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="bubble" style={{ background: "var(--accent-soft)" }} aria-hidden="true">📅</span>
            <div>
              <div className="value">{mine.length}</div>
              <div className="label">réservation{mine.length > 1 ? "s" : ""} cette semaine</div>
            </div>
          </div>
          <div className="stat">
            <span className="bubble" style={{ background: "var(--brand-soft)" }} aria-hidden="true">⏭️</span>
            <div>
              <div className="value">{nextMine ? parisTime(new Date(nextMine.start)) : "—"}</div>
              <div className="label">
                {nextMine
                  ? `${data.rooms.find((r) => r.id === nextMine.roomId)?.name ?? ""}, ${dayParts(parisDateKey(new Date(nextMine.start))).name} ${dayParts(parisDateKey(new Date(nextMine.start))).num}`
                  : "aucune à venir"}
              </div>
            </div>
          </div>
          {openNow && (
            <div className="stat">
              <span className="bubble" style={{ background: "#e3f5ec" }} aria-hidden="true">🟢</span>
              <div>
                <div className="value">{freeNow}/{data.rooms.length}</div>
                <div className="label">salles libres maintenant</div>
              </div>
            </div>
          )}
        </div>
        <button type="button" className="cta" onClick={openQuickCreate}>
          <span aria-hidden="true">＋</span> Réserver
        </button>
      </section>

      <div className="toolbar">
        <div className="week-nav">
          <Link className="round" href={`/?semaine=${addDaysToKey(data.weekStart, -7)}`} aria-label="Semaine précédente">‹</Link>
          <Link href="/">Aujourd&apos;hui</Link>
          <Link className="round" href={`/?semaine=${addDaysToKey(data.weekStart, 7)}`} aria-label="Semaine suivante">›</Link>
        </div>
        <span className="week-title">
          {formatDateLong(data.weekStart).replace(/^\w+ /, "")} → {formatDateLong(lastDay).replace(/^\w+ /, "")}
        </span>
        <div className="legend">
          {data.rooms.map((r) => (
            <span key={r.id} className="chip">
              <span className="dot" style={{ background: r.color, color: readableTextOn(r.color) }}>
                <RoomIcon capacity={r.capacity} />
              </span>
              {r.name} <span className="cap">· {r.capacity} pers.</span>
            </span>
          ))}
        </div>
      </div>

      <div className="planning" style={{ gridTemplateColumns: `56px repeat(${data.days.length}, 1fr)` }}>
        {/* En-têtes */}
        <div className="corner" />
        {data.days.map((d) => {
          const p = dayParts(d.key);
          return (
            <div key={d.key} className={`day-head${d.key === today ? " today" : ""}`}>
              <div className="dname">{p.name}</div>
              <div className="dnum">{p.num}</div>
              <div className="note">{d.holiday ?? d.closures.find((c) => c.roomId === null)?.reason ?? ""}</div>
              <div className="lanes-head" style={{ gridTemplateColumns: `repeat(${lanes}, 1fr)` }}>
                {data.rooms.map((r) => (
                  <span key={r.id} style={{ background: r.color, color: readableTextOn(r.color) }} title={r.name}>{r.name}</span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Heures */}
        <div className="times" style={{ height: SLOTS * SLOT_H }}>
          {Array.from({ length: SLOTS / 2 + 1 }, (_, i) => OPEN + i * 60).map((m, i) => (
            <div key={m} style={{ top: i === 0 ? 8 : m === CLOSE ? topOf(m) - 8 : topOf(m) }}>{toHHMM(m)}</div>
          ))}
        </div>

        {/* Jours × salles */}
        {data.days.map((d) => (
          <div
            key={d.key}
            className={`day${d.key === today ? " today-col" : ""}`}
            style={{ gridTemplateColumns: `repeat(${lanes}, 1fr)`, height: SLOTS * SLOT_H }}
          >
            {data.rooms.map((r) => {
              const closed = isClosed(d.key, r.id);
              const pastUntil = d.key < today ? CLOSE : d.key === today ? Math.min(Math.max(nowMin, OPEN), CLOSE) : OPEN;
              const cellBookings = bookingsByCell.get(`${d.key}|${r.id}`) ?? [];
              return (
                <div key={r.id} className="lane" title={closed ?? undefined}>
                  {Array.from({ length: SLOTS }, (_, i) => OPEN + i * STEP).map((m) => {
                    const past = m < pastUntil; // créneau commencé ou passé
                    const disabled = past || !!closed;
                    return (
                      <div
                        key={m}
                        className={`slot${m % 60 === 0 ? " hour" : ""}${past ? " past" : ""}${closed ? " closed" : ""}`}
                        style={{ top: topOf(m), height: SLOT_H }}
                        title={disabled ? closed ?? undefined : `Réserver ${r.name} à ${toHHMM(m)}`}
                        onClick={disabled ? undefined : () => openCreate(d.key, r.id, m)}
                      />
                    );
                  })}
                  {closed && <div className="shade closed" style={{ top: 0, height: SLOTS * SLOT_H }} />}
                  {!closed && pastUntil > OPEN && <div className="shade past" style={{ top: 0, height: topOf(pastUntil) }} />}
                  {cellBookings.map((b) => {
                    const s = new Date(b.start);
                    const e = new Date(b.end);
                    const sMin = Math.max(parisMinutesOfDay(s), OPEN);
                    const eMin = Math.min(parisMinutesOfDay(e) || 24 * 60, CLOSE);
                    const label = `${parisTime(s)}–${parisTime(e)} · ${b.ownerName}${b.title ? ` · ${b.title}` : ""}${b.isSeries ? " · récurrent" : ""}`;
                    return (
                      <div
                        key={b.id}
                        className={`booking${b.canManage ? "" : " other"}${b.mine ? " mine" : ""}`}
                        style={{
                          top: topOf(sMin) + 2,
                          height: Math.max(topOf(eMin) - topOf(sMin) - 4, 14),
                          background: r.color,
                          color: readableTextOn(r.color),
                        }}
                        title={`${r.name} · ${label}`}
                        onClick={() => openEdit(b)}
                      >
                        {b.mine && <span className="star" aria-label="Votre réservation">★</span>}
                        <div className="who">{b.isSeries ? "↻ " : ""}{b.ownerName}</div>
                        <div className="when">{parisTime(s)}–{parisTime(e)}</div>
                        {b.title && <div className="what">{b.title}</div>}
                      </div>
                    );
                  })}
                  {d.key === today && nowMin > OPEN && nowMin < CLOSE && (
                    <div className="now-line" style={{ top: topOf(nowMin) }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="hint">
        <span aria-hidden="true">💡</span>
        Cliquez sur un créneau libre pour réserver, ou sur une réservation marquée <kbd>★</kbd> pour la modifier.
      </p>

      {dialog && (
        <BookingDialog
          state={dialog}
          rooms={data.rooms}
          users={isAdmin ? data.users : []}
          currentUserId={currentUserId}
          onClose={() => setDialog(null)}
          onDone={onDone}
        />
      )}

      {toast && (
        <>
          {toast.emoji === "🎉" && (
            <div className="confetti" aria-hidden="true" key={`c${toast.id}`}>
              {Array.from({ length: 36 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    animationDelay: `${(i % 9) * 0.05}s`,
                    animationDuration: `${1.1 + (i % 5) * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
          <div className={`toast${toast.booking ? " with-actions" : ""}`} role="status" key={toast.id}>
            <span className="emoji" aria-hidden="true">{toast.emoji}</span>
            <span className="toast-text">
              {toast.text}
              {toast.note && <small>{toast.note}</small>}
            </span>
            {toast.booking && <AddToCalendar booking={toast.booking} label={toast.actionLabel} />}
            {toast.booking && (
              <button type="button" className="toast-close" aria-label="Fermer" onClick={() => setToast(null)}>×</button>
            )}
          </div>
        </>
      )}
    </>
  );
}
