import { Router } from 'express'
import { rodarSync, janelaPadrao } from '../sync/runner.js'
import { chamarBruto } from '../projuris/client.js'
import { normalizar } from '../sync/mapper.js'
import {
  listarCategorias,
  listarCentrosCusto,
  listarContasFinanceiras,
} from '../contaazul/client.js'
import { config } from '../config.js'

export const syncRouter = Router()

/**
 * POST /sync/run
 * body/query: { inicio?: 'yyyy-mm-dd', fim?: 'yyyy-mm-dd', dry_run?: boolean }
 */
syncRouter.post('/run', async (req, res) => {
  try {
    const fonte = { ...req.query, ...(req.body ?? {}) } as Record<string, unknown>
    const dryRun =
      fonte.dry_run === true || fonte.dry_run === 'true' ? true
      : fonte.dry_run === false || fonte.dry_run === 'false' ? false
      : undefined

    const resultado = await rodarSync({
      inicio: fonte.inicio ? String(fonte.inicio) : undefined,
      fim: fonte.fim ? String(fonte.fim) : undefined,
      dryRun,
      origem: 'api',
    })
    res.json(resultado)
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

/** Atalho de conferência: roda sempre em dry-run. */
syncRouter.post('/preview', async (req, res) => {
  try {
    const fonte = { ...req.query, ...(req.body ?? {}) } as Record<string, unknown>
    const resultado = await rodarSync({
      inicio: fonte.inicio ? String(fonte.inicio) : undefined,
      fim: fonte.fim ? String(fonte.fim) : undefined,
      dryRun: true,
      origem: 'preview',
    })
    res.json(resultado)
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

/**
 * GET /sync/projuris-bruto?path=/financeiro/lancamentos&...
 * Espelha a resposta crua do Projuris — é como você descobre o nome real
 * dos campos antes de fechar o mapeamento.
 */
syncRouter.get('/projuris-bruto', async (req, res) => {
  try {
    const { path, ...query } = req.query as Record<string, string>
    const alvo = path || config.projuris.lancamentosPath
    const resposta = await chamarBruto(alvo, query)

    const amostra = Array.isArray(resposta) ? resposta[0] : undefined
    res.json({
      path: alvo,
      resposta,
      normalizacao_da_amostra: amostra ? normalizar(amostra) : null,
    })
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

/** Ids de configuração do Conta Azul (conta financeira, categoria, centro de custo). */
syncRouter.get('/contaazul-refs', async (_req, res) => {
  try {
    const [contas, categorias, centros] = await Promise.allSettled([
      listarContasFinanceiras(),
      listarCategorias(),
      listarCentrosCusto(),
    ])
    const valor = (r: PromiseSettledResult<unknown>) =>
      r.status === 'fulfilled' ? r.value : { erro: String(r.reason) }
    res.json({
      contas_financeiras: valor(contas),
      categorias: valor(categorias),
      centros_de_custo: valor(centros),
    })
  } catch (e) {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) })
  }
})

syncRouter.get('/janela-padrao', (_req, res) => res.json(janelaPadrao()))
