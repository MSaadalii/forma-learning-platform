import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!configured) throw new Error('Supabase is not configured');
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
