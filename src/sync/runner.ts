import { config } from '../config.js'
import { logger } from '../logger.js'
import { buscarLancamentos } from '../projuris/client.js'
import { criarContaReceber, garantirPessoa, montarBodyContaReceber } from '../contaazul/client.js'
import { descricaoContaAzul, normalizar, type Lancamento } from './mapper.js'
import {
  atualizarRun,
  idsJaSincronizados,
  registrarLancamento,
  registrarRun,
  type LancamentoRow,
} from '../db/repo.js'

export type ResultadoItem = {
  projuris_id: string
  descricao: string
  valor: number
  status: 'criado' | 'ignorado' | 'erro' | 'dry_run'
  motivo?: string
  contaazul_id?: string
  payload?: unknown
}

export type ResultadoSync = {
  origem: string
  periodo: { inicio: string; fim: string }
  dry_run: boolean
  total_lidos: number
  total_criados: number
  total_ignorados: number
  total_erros: number
  duracao_ms: number
  itens: ResultadoItem[]
}

export function janelaPadrao(dias = config.sync.janelaDias): { inicio: string; fim: string } {
  const fim = new Date()
  const inicio = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000)
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) }
}

/** Regras de negócio que descartam um lançamento antes de tocar no Conta Azul. */
function motivoParaIgnorar(l: Lancamento): string | null {
  if (l.tipo !== 'RECEITA') return `tipo ${l.tipo} — só receita vira conta a receber`
  if (!Number.isFinite(l.valor)) return 'valor ausente ou ilegível'
  if (l.valor < config.sync.valorMinimo) return `valor ${l.valor} abaixo do mínimo`
  const permitidos = config.sync.statusPermitidos
  if (permitidos.length > 0) {
    const status = (l.status ?? '').toUpperCase()
    if (!permitidos.some((p) => status === p.toUpperCase())) {
      return `status "${l.status ?? '-'}" fora da lista permitida`
    }
  }
  return null
}

function linhaBase(l: Lancamento, runId: number | null): Omit<LancamentoRow, 'status_sync'> {
  return {
    projuris_id: l.id,
    descricao: l.descricao,
    valor: Number.isFinite(l.valor) ? l.valor : null,
    data_vencimento: l.dataVencimento,
    data_competencia: l.dataCompetencia ?? null,
    status_projuris: l.status ?? null,
    cliente_nome: l.clienteNome,
    cliente_documento: l.clienteDocumento ?? null,
    processo: l.processo ?? null,
    centro_custo: l.centroCusto ?? null,
    categoria: l.categoria ?? null,
    run_id: runId,
    payload_projuris: l.bruto,
  }
}

export async function rodarSync(opcoes: {
  inicio?: string
  fim?: string
  dryRun?: boolean
  origem?: string
}): Promise<ResultadoSync> {
  const t0 = Date.now()
  const padrao = janelaPadrao()
  const inicio = opcoes.inicio ?? padrao.inicio
  const fim = opcoes.fim ?? padrao.fim
  const dryRun = opcoes.dryRun ?? config.sync.dryRunGlobal
  const origem = opcoes.origem ?? 'manual'

  logger.info('sync', `iniciando ${inicio} → ${fim} (dry_run=${dryRun}, origem=${origem})`)

  const brutos = await buscarLancamentos(inicio, fim)
  const lancamentos = brutos
    .map(normalizar)
    .filter((l): l is Lancamento => l !== null)

  const descartadosNaLeitura = brutos.length - lancamentos.length
  if (descartadosNaLeitura > 0) {
    logger.warn('sync', `${descartadosNaLeitura} registro(s) sem id ou sem vencimento — descartados`)
  }

  const jaFeitos = await idsJaSincronizados(lancamentos.map((l) => l.id))
  const itens: ResultadoItem[] = []
  let criados = 0
  let ignorados = 0
  let erros = 0

  // Registro do run vem antes para que cada lançamento já nasça vinculado.
  const runId = await registrarRun({
    origem,
    data_inicio: inicio,
    data_fim: fim,
    dry_run: dryRun,
    total_lidos: lancamentos.length,
    total_criados: 0,
    total_ignorados: 0,
    total_erros: 0,
    duracao_ms: 0,
  })

  for (const l of lancamentos) {
    const base = linhaBase(l, runId)

    if (jaFeitos.has(l.id)) {
      ignorados++
      itens.push({ projuris_id: l.id, descricao: l.descricao, valor: l.valor, status: 'ignorado', motivo: 'já sincronizado' })
      continue
    }

    const motivo = motivoParaIgnorar(l)
    if (motivo) {
      ignorados++
      itens.push({ projuris_id: l.id, descricao: l.descricao, valor: l.valor, status: 'ignorado', motivo })
      await registrarLancamento({ ...base, status_sync: 'ignorado', motivo })
      continue
    }

    try {
      if (dryRun) {
        const payload = montarBodyContaReceber({
          pessoaId: '<resolvido-no-envio-real>',
          descricao: descricaoContaAzul(l),
          valor: l.valor,
          dataVencimento: l.dataVencimento,
          dataCompetencia: l.dataCompetencia,
          observacao: l.processo ? `Processo ${l.processo}` : undefined,
        })
        itens.push({ projuris_id: l.id, descricao: l.descricao, valor: l.valor, status: 'dry_run', payload })
        await registrarLancamento({ ...base, status_sync: 'dry_run', payload_contaazul: payload })
        continue
      }

      const pessoa = await garantirPessoa({
        nome: l.clienteNome,
        documento: l.clienteDocumento,
        email: l.clienteEmail,
      })

      const entrada = {
        pessoaId: pessoa.id,
        descricao: descricaoContaAzul(l),
        valor: l.valor,
        dataVencimento: l.dataVencimento,
        dataCompetencia: l.dataCompetencia,
        observacao: l.processo ? `Processo ${l.processo}` : undefined,
      }

      const criada = await criarContaReceber(entrada)
      criados++
      itens.push({
        projuris_id: l.id,
        descricao: l.descricao,
        valor: l.valor,
        status: 'criado',
        contaazul_id: criada?.id,
      })
      await registrarLancamento({
        ...base,
        status_sync: 'criado',
        contaazul_id: criada?.id ?? null,
        contaazul_pessoa_id: pessoa.id,
        payload_contaazul: montarBodyContaReceber(entrada),
        motivo: null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      erros++
      logger.error('sync', `falha no lançamento ${l.id}: ${msg}`)
      itens.push({ projuris_id: l.id, descricao: l.descricao, valor: l.valor, status: 'erro', motivo: msg })
      await registrarLancamento({ ...base, status_sync: 'erro', motivo: msg })
    }
  }

  const duracao = Date.now() - t0

  // Fecha o mesmo run com os totais reais.
  if (runId !== null) {
    await atualizarRun(runId, {
      total_criados: criados,
      total_ignorados: ignorados,
      total_erros: erros,
      duracao_ms: duracao,
    })
  }

  logger.info('sync', `fim: ${criados} criado(s), ${ignorados} ignorado(s), ${erros} erro(s) em ${duracao}ms`)

  return {
    origem,
    periodo: { inicio, fim },
    dry_run: dryRun,
    total_lidos: lancamentos.length,
    total_criados: criados,
    total_ignorados: ignorados,
    total_erros: erros,
    duracao_ms: duracao,
    itens,
  }
}
