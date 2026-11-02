import type { ActionResult } from "@/lib/bookings";

export type FormState = ActionResult | null;

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optionalStr(form: FormData, key: string, max = 200): string | null {
  const v = str(form, key).slice(0, max);
  return v.length ? v : null;
}
