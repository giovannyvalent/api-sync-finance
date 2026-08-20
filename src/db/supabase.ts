import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config.js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const { url, serviceRoleKey } = config.supabase
    if (!url || !serviceRoleKey) {
      throw new Error('Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    }
    _client = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  }
  return _client
}
