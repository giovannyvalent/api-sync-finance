import express from 'express'
import { assertConfig, config } from './config.js'
import { logger } from './logger.js'
import { oauthRouter } from './routes/oauth.js'
import { painelRouter } from './routes/painel.js'
import { analiseRouter } from './routes/analise.js'
import { syncRouter } from './routes/sync.js'
import { analyticsRouter } from './routes/analytics.js'
import { exigirApiKey, exigirCronSecret } from './routes/auth-mw.js'
import { rodarSync } from './sync/runner.js'
import { getContaAzulToken } from './contaazul/auth.js'
import { lerToken } from './db/repo.js'

export const app = express()

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// CORS — permite que painéis externos (ex.: o Financeiro do sete-legal-os)
// consumam esta API a partir de outro domínio. Sem credenciais de cookie —
// a autenticação é por header (x-api-key), então * é seguro aqui.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

app.use((req, _res, next) => {
  logger.info('http', `${req.method} ${req.path}`)
  next()
})

// --- diagnóstico -----------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    servico: 'projuris-contaazul-sync',
    descricao: 'Lançamentos financeiros do Projuris → contas a receber no Conta Azul',
    painel: 'GET /painel',
    analise: 'GET /analise',
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

app.get('/health', async (_req, res) => {
  const faltando = assertConfig()

  // Estado do token do Conta Azul: o refresh_token vale 2 semanas e é de uso
  // único, então saber quanto falta evita descobrir o vencimento pelo erro.
  let contaazul: Record<string, unknown> = { autorizado: false }
  try {
    const row = await lerToken(config.contaazul.companyId)
    if (row) {
      const expiraEm = new Date(row.expires_at).getTime()
      const atualizadoEm = new Date((row as { atualizado_em?: string }).atualizado_em ?? row.expires_at).getTime()
      const diasDesdeRenovacao = (Date.now() - atualizadoEm) / 86_400_000
      contaazul = {
        autorizado: true,
        access_token_expira_em: row.expires_at,
        access_token_valido: expiraEm > Date.now(),
        dias_desde_ultima_renovacao: Number(diasDesdeRenovacao.toFixed(1)),
        // refresh_token morre com 14 dias sem uso
        risco_expiracao_refresh: diasDesdeRenovacao > 10,
      }
    }
  } catch (e) {
    contaazul = { autorizado: false, erro: e instanceof Error ? e.message : String(e) }
  }

  res.status(faltando.length ? 503 : 200).json({
    ok: faltando.length === 0,
    env_faltando: faltando,
    projuris_lancamentos_path: config.projuris.lancamentosPath,
    contaazul_company_id: config.contaazul.companyId,
    dry_run_global: config.sync.dryRunGlobal,
    contaazul,
  })
})

// --- OAuth (público: o usuário precisa abrir no navegador) ------------------

app.use('/oauth', oauthRouter)
app.use('/painel', painelRouter)
app.use('/analise', analiseRouter)

// --- operação (protegida por SYNC_API_KEY) ---------------------------------

app.use('/sync', exigirApiKey, syncRouter)
app.use('/analytics', exigirApiKey, analyticsRouter)

// --- cron da Vercel (protegido por CRON_SECRET) ----------------------------

app.get('/cron/sync', exigirCronSecret, async (_req, res) => {
  try {
    // Keep-alive do OAuth: o refresh_token do Conta Azul expira em 2 semanas
    // sem uso. Um período longo sem lançamento nenhum não pode derrubar a
    // autorização, então renovamos antes de olhar o Projuris.
    try {
      await getContaAzulToken()
    } catch (e) {
      logger.warn('cron', `keep-alive do token falhou: ${e instanceof Error ? e.message : String(e)}`)
    }

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
