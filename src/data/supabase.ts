import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// .env: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (só a anon key; a service role nunca vem para cá).
// Sem elas, o app roda como antes: tudo só no aparelho.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null
