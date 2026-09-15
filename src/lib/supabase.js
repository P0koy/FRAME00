import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("FRAME99: Supabase environment variables are missing.");
}

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseKey || "missing-key"
);
