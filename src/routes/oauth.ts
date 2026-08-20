import { Router } from 'express'
import crypto from 'crypto'
import { config } from '../config.js'
import { logger } from '../logger.js'
import { trocarCodigoPorToken, urlAutorizacao } from '../contaazul/auth.js'

export const oauthRouter = Router()

/**
 * Passo 1 — abrir no navegador, logar no Conta Azul e autorizar.
 * Feito uma vez por empresa; depois o refresh_token no Supabase mantém tudo.
 */
oauthRouter.get('/contaazul/start', (_req, res) => {
  if (!config.contaazul.clientId || !config.contaazul.redirectUri) {
    return res.status(500).json({ erro: 'CONTAAZUL_CLIENT_ID / CONTAAZUL_REDIRECT_URI ausentes' })
  }
  const state = crypto.randomBytes(16).toString('hex')
  res.redirect(urlAutorizacao(state))
})

/** Passo 2 — o Conta Azul redireciona pra cá com ?code=. Vale 3 minutos. */
oauthRouter.get('/contaazul/callback', async (req, res) => {
  const code = String(req.query.code ?? '')
  const erro = String(req.query.error ?? '')

  if (erro) return res.status(400).json({ erro, descricao: req.query.error_description ?? null })
  if (!code) return res.status(400).json({ erro: 'code ausente na query' })

  try {
    await trocarCodigoPorToken(code)
    res.type('html').send(
      '<h2>Conta Azul autorizado com sucesso.</h2><p>Pode fechar esta aba — o sync já consegue criar contas a receber.</p>',
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('oauth', msg)
    res.status(500).json({ erro: msg })
  }
})
