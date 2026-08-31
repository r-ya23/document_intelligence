// Admin Supabase client for use inside Edge Functions only.
// Uses the service_role key — bypasses RLS. Never expose this client or key to the frontend.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars in Edge Function runtime.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
