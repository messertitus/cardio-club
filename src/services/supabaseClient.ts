import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

export function createAppSupabaseClient(supabaseUrl: string, supabaseAnonKey: string): AppSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
