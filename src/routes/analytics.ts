import { Router } from 'express'
import { getSupabase } from '../db/supabase.js'

export const analyticsRouter = Router()

function intervalo(req: { query: Record<string, unknown> }): { inicio: string; fim: string } {
  const fim = req.query.fim ? String(req.query.fim) : new Date().toISOString().slice(0, 10)
  const inicio = req.query.inicio
    ? String(req.query.inicio)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { inicio, fim }
}

/** Visão geral: volume e valor sincronizado no período. */
analyticsRouter.get('/resumo', async (req, res) => {
  try {
    const { inicio, fim } = intervalo(req as never)
    const { data, error } = await getSupabase()
      .from('sync_lancamento')
      .select('status_sync, valor, data_vencimento')
      .gte('data_vencimento', inicio)
      .lte('data_vencimento', fim)
    if (error) throw new Error(error.message)

    const linhas = (data ?? []) as Array<{ status_sync: string; valor: number | null }>
    const porStatus: Record<string, { quantidade: number; valor: number }> = {}
    for (const l of linhas) {
      const b = (porStatus[l.status_sync] ??= { quantidade: 0, valor: 0 })
      b.quantidade++
      b.valor += l.valor ?? 0
    }

    const criados = porStatus.criado ?? { quantidade: 0, valor: 0 }
    res.json({
      periodo: { inicio, fim },
      total_lancamentos: linhas.length,
      valor_total_criado: Number(criados.valor.toFixed(2)),
      quantidade_criada: criados.quantidade,
      por_status: porStatus,
    })
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

/** Série mensal de valor sincronizado — base do gráfico de faturamento. */
analyticsRouter.get('/por-mes', async (req, res) => {
  try {
    const { inicio, fim } = intervalo(req as never)
    const { data, error } = await getSupabase()
      .from('sync_lancamento')
      .select('valor, data_vencimento')
      .eq('status_sync', 'criado')
      .gte('data_vencimento', inicio)
      .lte('data_vencimento', fim)
    if (error) throw new Error(error.message)

    const meses: Record<string, { quantidade: number; valor: number }> = {}
    for (const l of (data ?? []) as Array<{ valor: number | null; data_vencimento: string }>) {
      const mes = l.data_vencimento.slice(0, 7)
      const b = (meses[mes] ??= { quantidade: 0, valor: 0 })
      b.quantidade++
      b.valor += l.valor ?? 0
    }

    res.json({
      periodo: { inicio, fim },
      series: Object.entries(meses)
        .map(([mes, v]) => ({ mes, quantidade: v.quantidade, valor: Number(v.valor.toFixed(2)) }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    })
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

/** Ranking de clientes por valor sincronizado. */
analyticsRouter.get('/por-cliente', async (req, res) => {
  try {
    const { inicio, fim } = intervalo(req as never)
    const limite = Number(req.query.limite ?? 20)
    const { data, error } = await getSupabase()
      .from('sync_lancamento')
      .select('cliente_nome, cliente_documento, valor')
      .eq('status_sync', 'criado')
      .gte('data_vencimento', inicio)
      .lte('data_vencimento', fim)
    if (error) throw new Error(error.message)

    const mapa: Record<string, { cliente: string; documento: string | null; quantidade: number; valor: number }> = {}
    for (const l of (data ?? []) as Array<{
      cliente_nome: string | null
      cliente_documento: string | null
      valor: number | null
    }>) {
      const chave = l.cliente_documento || l.cliente_nome || 'não identificado'
      const b = (mapa[chave] ??= {
        cliente: l.cliente_nome ?? 'não identificado',
        documento: l.cliente_documento,
        quantidade: 0,
        valor: 0,
      })
      b.quantidade++
      b.valor += l.valor ?? 0
    }

    res.json({
      periodo: { inicio, fim },
      clientes: Object.values(mapa)
        .map((c) => ({ ...c, valor: Number(c.valor.toFixed(2)) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, limite),
    })
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

/** Saúde da integração: últimas execuções e erros abertos. */
analyticsRouter.get('/execucoes', async (req, res) => {
  try {
    const limite = Number(req.query.limite ?? 20)
    const { data: runs, error: e1 } = await getSupabase()
      .from('sync_run')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(limite)
    if (e1) throw new Error(e1.message)

    const { data: falhas, error: e2 } = await getSupabase()
      .from('sync_lancamento')
      .select('projuris_id, descricao, valor, motivo, atualizado_em')
      .eq('status_sync', 'erro')
      .order('atualizado_em', { ascending: false })
      .limit(50)
    if (e2) throw new Error(e2.message)

    res.json({ execucoes: runs ?? [], erros_abertos: falhas ?? [] })
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})
