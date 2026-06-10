import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type MemberCity = { city: string; memberCount: number; active: boolean };

// Cities that currently run events (test phase: only Konstanz).
export async function listActiveCities(supabase: AppSupabaseClient): Promise<ServiceResult<string[]>> {
  const { data, error } = await supabase.from("mcc_active_cities").select("city").order("city", { ascending: true });
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Aktive Städte konnten nicht geladen werden.") };
  }
  return ok(data.map((row) => row.city));
}

// Admin view: every city that has members, with counts and whether it is active.
export async function listMemberCities(supabase: AppSupabaseClient): Promise<ServiceResult<MemberCity[]>> {
  const { data, error } = await supabase.rpc("list_mcc_member_cities");
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Städte konnten nicht geladen werden.") };
  }
  return ok(data.map((row) => ({ city: row.city, memberCount: row.member_count, active: row.active })));
}

export async function setActiveCities(supabase: AppSupabaseClient, cities: string[]): Promise<ServiceResult<{ saved: true }>> {
  const { error } = await supabase.rpc("set_mcc_active_cities", { cities });
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Aktive Städte konnten nicht gespeichert werden.") };
  }
  return ok({ saved: true });
}
