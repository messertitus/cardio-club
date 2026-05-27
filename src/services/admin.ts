import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function clearMccTestData(supabase: AppSupabaseClient): Promise<ServiceResult<{ result: unknown }>> {
  const { data, error } = await supabase.rpc("clear_mcc_test_data", {});

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Testdaten konnten nicht geleert werden.") };
  }

  return ok({ result: data });
}
