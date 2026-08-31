import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in values.",
  );
}

// Single shared client — anon key only. This is safe to use directly from browser code because
// RLS policies (see supabase/migrations) govern what it can actually read/write.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
