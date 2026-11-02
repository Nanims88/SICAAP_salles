"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SETTINGS } from "@/config/settings";
import type { PlanningData, PlanningBooking } from "@/lib/planning";
import { addDaysToKey, formatDateLong, parisDateKey, parisMinutesOfDay, parisTime } from "@/lib/time";
import { BookingDialog, type DialogState } from "./BookingDialog";
import { readableTextOn } from "@/lib/color";

const SLOT_H = 26; // hauteur d'un créneau de 30 min, en pixels
const OPEN = SETTINGS.openingHour * 60;
const CLOSE = SETTINGS.closingHour * 60;
const STEP = SETTINGS.slotMinutes;
const SLOTS = (CLOSE - OPEN) / STEP;

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function topOf(min: number): number {
  return ((min - OPEN) / STEP) * SLOT_H;
}

export function WeekPlanning({ data, isAdmin, currentUserId }: { data: PlanningData; isAdmin: boolean; currentUserId: string }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const now = new Date(data.now);
  const today = parisDateKey(now);
  const nowMin = parisMinutesOfDay(now);

  const bookingsByCell = useMemo(() => {
    const map = new Map<string, PlanningBooking[]>();
    for (const b of data.bookings) {
      const k = `${parisDateKey(new Date(b.start))}|${b.roomId}`;
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return map;
  }, [data.bookings]);

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
    });
  }

  return (
    <>
      <div className="toolbar">
        <Link className="button secondary" href={`/?semaine=${addDaysToKey(data.weekStart, -7)}`}>‹ Semaine précédente</Link>
        <Link className="button secondary" href="/">Aujourd&apos;hui</Link>
        <Link className="button secondary" href={`/?semaine=${addDaysToKey(data.weekStart, 7)}`}>Semaine suivante ›</Link>
        <span className="title">
          Du {formatDateLong(data.weekStart)} au {formatDateLong(lastDay)}
        </span>
        <div className="legend">
          {data.rooms.map((r) => (
            <span key={r.id}>
              <span className="swatch" style={{ background: r.color }} />
              {r.name} <span className="muted">({r.capacity} pers.)</span>
            </span>
          ))}
        </div>
      </div>

      <div className="planning" style={{ gridTemplateColumns: `52px repeat(${data.days.length}, 1fr)` }}>
        {/* En-têtes */}
        <div className="corner" />
        {data.days.map((d) => (
          <div key={d.key} className={`day-head${d.key === today ? " today" : ""}`}>
            <div className="name">{d.label}</div>
            <div className="note">{d.holiday ?? d.closures.find((c) => c.roomId === null)?.reason ?? ""}</div>
            <div className="lanes-head" style={{ gridTemplateColumns: `repeat(${lanes}, 1fr)` }}>
              {data.rooms.map((r) => (
                <span key={r.id} style={{ background: r.color, color: readableTextOn(r.color) }} title={r.name}>{r.name}</span>
              ))}
            </div>
          </div>
        ))}

        {/* Heures */}
        <div className="times" style={{ height: SLOTS * SLOT_H }}>
          {Array.from({ length: SLOTS / 2 + 1 }, (_, i) => OPEN + i * 60).map((m, i) => (
            <div key={m} style={{ top: i === 0 ? 8 : m === CLOSE ? topOf(m) - 8 : topOf(m) }}>{toHHMM(m)}</div>
          ))}
        </div>

        {/* Jours × salles */}
        {data.days.map((d) => (
          <div key={d.key} className="day" style={{ gridTemplateColumns: `repeat(${lanes}, 1fr)`, height: SLOTS * SLOT_H }}>
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
                        style={{ top: topOf(sMin) + 1, height: Math.max(topOf(eMin) - topOf(sMin) - 2, 12), background: r.color, color: readableTextOn(r.color) }}
                        title={`${r.name} · ${label}`}
                        onClick={() => openEdit(b)}
                      >
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

      <p className="muted" style={{ marginTop: 10 }}>
        Cliquez sur un créneau libre pour réserver, ou sur l&apos;une de vos réservations pour la modifier ou l&apos;annuler.
        Les réservations encadrées sont les vôtres.
      </p>

      {dialog && (
        <BookingDialog
          state={dialog}
          rooms={data.rooms}
          users={isAdmin ? data.users : []}
          currentUserId={currentUserId}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
