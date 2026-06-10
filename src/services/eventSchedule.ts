import type { EventDay } from "./date";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

// Generic per-weekday schedule (replaces the Saturday/Sunday-only model).
export type EventDayConfig = { weekday: EventDay; time: string };

export async function getMccEventDays(supabase: AppSupabaseClient, clubId: string): Promise<ServiceResult<EventDayConfig[]>> {
  const { data, error } = await supabase.from("mcc_event_days").select("weekday, start_time").eq("club_id", clubId);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Eventtage konnten nicht geladen werden.") };
  }
  return ok(data.map((row) => ({ weekday: row.weekday, time: row.start_time.slice(0, 5) })));
}

export async function setMccEventDays(supabase: AppSupabaseClient, days: EventDayConfig[]): Promise<ServiceResult<EventDayConfig[]>> {
  const { error } = await supabase.rpc("set_mcc_event_days", { days: days.map((day) => ({ weekday: day.weekday, time: day.time })) });
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Eventtage konnten nicht gespeichert werden.") };
  }
  return ok(days);
}

export type EventSchedule = {
  saturdayEnabled: boolean;
  saturdayTime: string; // "HH:MM"
  sundayEnabled: boolean;
  sundayTime: string; // "HH:MM"
};

const DEFAULT_SCHEDULE: EventSchedule = {
  saturdayEnabled: true,
  saturdayTime: "14:00",
  sundayEnabled: true,
  sundayTime: "15:00",
};

function toHourMinute(time: string | null | undefined, fallback: string): string {
  if (!time) return fallback;
  return time.slice(0, 5);
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

export async function getMccEventSchedule(supabase: AppSupabaseClient, clubId: string): Promise<ServiceResult<EventSchedule>> {
  const { data, error } = await supabase.from("club_event_settings").select().eq("club_id", clubId).maybeSingle();
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Zeitplan konnte nicht geladen werden.") };
  }
  if (!data) {
    return ok(DEFAULT_SCHEDULE);
  }
  return ok({
    saturdayEnabled: data.saturday_enabled,
    saturdayTime: toHourMinute(data.saturday_time, DEFAULT_SCHEDULE.saturdayTime),
    sundayEnabled: data.sunday_enabled,
    sundayTime: toHourMinute(data.sunday_time, DEFAULT_SCHEDULE.sundayTime),
  });
}

export async function setMccEventSchedule(supabase: AppSupabaseClient, input: EventSchedule): Promise<ServiceResult<EventSchedule>> {
  const { error } = await supabase.rpc("set_mcc_event_schedule", {
    sat_enabled: input.saturdayEnabled,
    sat_time: input.saturdayTime,
    sun_enabled: input.sundayEnabled,
    sun_time: input.sundayTime,
  });
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Zeitplan konnte nicht gespeichert werden.") };
  }
  return ok(input);
}
