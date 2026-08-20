import { getSupabase } from './supabase.js'
import { logger } from '../logger.js'

// ---------------------------------------------------------------------------
// Tokens OAuth do Conta Azul
// Serverless não guarda estado entre invocações, então o refresh_token
// precisa viver no banco.
// ---------------------------------------------------------------------------

export type TokenRow = {
  company_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

export async function lerToken(companyId: string): Promise<TokenRow | null> {
  const { data, error } = await getSupabase()
    .from('contaazul_token')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) throw new Error(`lerToken: ${error.message}`)
  return (data as TokenRow | null) ?? null
}

export async function salvarToken(row: TokenRow): Promise<void> {
  const { error } = await getSupabase()
    .from('contaazul_token')
    .upsert({ ...row, atualizado_em: new Date().toISOString() }, { onConflict: 'company_id' })
  if (error) throw new Error(`salvarToken: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Execuções de sync (analytics de processo)
// ---------------------------------------------------------------------------

export type SyncRun = {
  id?: number
  origem: string
  data_inicio: string
  data_fim: string
  dry_run: boolean
  total_lidos: number
  total_criados: number
  total_ignorados: number
  total_erros: number
  duracao_ms: number
  erro?: string | null
}

export async function registrarRun(run: SyncRun): Promise<number | null> {
  const { data, error } = await getSupabase()
    .from('sync_run')
    .insert(run)
    .select('id')
    .maybeSingle()
  if (error) {
    logger.error('db', `registrarRun falhou: ${error.message}`)
    return null
  }
  return (data as { id: number } | null)?.id ?? null
}

export async function atualizarRun(id: number, patch: Partial<SyncRun>): Promise<void> {
  const { error } = await getSupabase().from('sync_run').update(patch).eq('id', id)
  if (error) logger.error('db', `atualizarRun falhou (${id}): ${error.message}`)
}

// ---------------------------------------------------------------------------
// Lançamentos sincronizados (idempotência + analytics de negócio)
// ---------------------------------------------------------------------------

export type LancamentoRow = {
  projuris_id: string
  contaazul_id?: string | null
  contaazul_pessoa_id?: string | null
  descricao?: string | null
  valor?: number | null
  data_vencimento?: string | null
  data_competencia?: string | null
  status_projuris?: string | null
  cliente_nome?: string | null
  cliente_documento?: string | null
  processo?: string | null
  centro_custo?: string | null
  categoria?: string | null
  status_sync: 'criado' | 'ignorado' | 'erro' | 'dry_run'
  motivo?: string | null
  run_id?: number | null
  payload_projuris?: unknown
  payload_contaazul?: unknown
}

/** Ids já sincronizados com sucesso — base da idempotência. */
export async function idsJaSincronizados(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const encontrados = new Set<string>()
  // consulta em blocos para não estourar o tamanho da URL
  for (let i = 0; i < ids.length; i += 200) {
    const bloco = ids.slice(i, i + 200)
    const { data, error } = await getSupabase()
      .from('sync_lancamento')
      .select('projuris_id')
      .in('projuris_id', bloco)
      .eq('status_sync', 'criado')
    if (error) throw new Error(`idsJaSincronizados: ${error.message}`)
    for (const r of (data ?? []) as Array<{ projuris_id: string }>) encontrados.add(r.projuris_id)
  }
  return encontrados
}

export async function registrarLancamento(row: LancamentoRow): Promise<void> {
  const { error } = await getSupabase()
    .from('sync_lancamento')
    .upsert({ ...row, atualizado_em: new Date().toISOString() }, { onConflict: 'projuris_id' })
  if (error) logger.error('db', `registrarLancamento falhou (${row.projuris_id}): ${error.message}`)
}
