import express from 'express'
import { assertConfig, config } from './config.js'
import { logger } from './logger.js'
import { oauthRouter } from './routes/oauth.js'
import { syncRouter } from './routes/sync.js'
import { analyticsRouter } from './routes/analytics.js'
import { exigirApiKey, exigirCronSecret } from './routes/auth-mw.js'
import { rodarSync } from './sync/runner.js'

export const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, _res, next) => {
  logger.info('http', `${req.method} ${req.path}`)
  next()
})

// --- diagnóstico -----------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    servico: 'projuris-contaazul-sync',
    descricao: 'Lançamentos financeiros do Projuris → contas a receber no Conta Azul',
    rotas: {
      saude: 'GET /health',
      autorizar_contaazul: 'GET /oauth/contaazul/start',
      preview: 'POST /sync/preview  (dry-run, não escreve no Conta Azul)',
      executar: 'POST /sync/run',
      inspecionar_projuris: 'GET /sync/projuris-bruto',
      refs_contaazul: 'GET /sync/contaazul-refs',
      analytics: ['GET /analytics/resumo', 'GET /analytics/por-mes', 'GET /analytics/por-cliente', 'GET /analytics/execucoes'],
    },
  })
})

app.get('/health', (_req, res) => {
  const faltando = assertConfig()
  res.status(faltando.length ? 503 : 200).json({
    ok: faltando.length === 0,
    env_faltando: faltando,
    projuris_lancamentos_path: config.projuris.lancamentosPath,
    contaazul_company_id: config.contaazul.companyId,
    dry_run_global: config.sync.dryRunGlobal,
  })
})

// --- OAuth (público: o usuário precisa abrir no navegador) ------------------

app.use('/oauth', oauthRouter)

// --- operação (protegida por SYNC_API_KEY) ---------------------------------

app.use('/sync', exigirApiKey, syncRouter)
app.use('/analytics', exigirApiKey, analyticsRouter)

// --- cron da Vercel (protegido por CRON_SECRET) ----------------------------

app.get('/cron/sync', exigirCronSecret, async (_req, res) => {
  try {
    const resultado = await rodarSync({ origem: 'cron' })
    res.json({
      ok: true,
      total_lidos: resultado.total_lidos,
      total_criados: resultado.total_criados,
      total_ignorados: resultado.total_ignorados,
      total_erros: resultado.total_erros,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('cron', msg)
    res.status(500).json({ ok: false, erro: msg })
  }
})

app.use((_req, res) => res.status(404).json({ erro: 'rota não encontrada' }))

export default app
