import { config } from '../config.js'
import { logger } from '../logger.js'
import { lerToken, salvarToken } from '../db/repo.js'

/**
 * OAuth2 do Conta Azul (API v2 / Cognito).
 *   authorize: https://auth.contaazul.com/oauth2/authorize
 *   token:     https://auth.contaazul.com/oauth2/token
 *              Authorization: Basic base64(client_id:client_secret)
 *   escopo fixo: openid profile aws.cognito.signin.user.admin
 *
 * O authorization_code vale 3 minutos. O access_token expira em ~1h e é
 * renovado pelo refresh_token, que fica salvo no Supabase (serverless não
 * mantém memória entre invocações).
 */

function basicAuth(): string {
  const { clientId, clientSecret } = config.contaazul
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export function urlAutorizacao(state: string): string {
  const c = config.contaazul
  const u = new URL(`${c.authBase}/oauth2/authorize`)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', c.clientId)
  u.searchParams.set('redirect_uri', c.redirectUri)
  u.searchParams.set('state', state)
  u.searchParams.set('scope', c.scope)
  return u.toString()
}

type RespostaToken = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

async function pedirToken(params: Record<string, string>): Promise<RespostaToken> {
  const res = await fetch(`${config.contaazul.authBase}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
  })
  const texto = await res.text()
  if (!res.ok) throw new Error(`ContaAzul token ${res.status}: ${texto.slice(0, 400)}`)
  return JSON.parse(texto) as RespostaToken
}

/** Troca o authorization_code pelo primeiro par de tokens e persiste. */
export async function trocarCodigoPorToken(code: string): Promise<void> {
  const c = config.contaazul
  const json = await pedirToken({
    grant_type: 'authorization_code',
    client_id: c.clientId,
    code,
    redirect_uri: c.redirectUri,
  })
  if (!json.refresh_token) throw new Error('ContaAzul: resposta sem refresh_token')

  await salvarToken({
    company_id: c.companyId,
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  })
  logger.info('contaazul', `autorização concluída para company_id=${c.companyId}`)
}

/** Access token válido: usa o do banco ou renova via refresh_token. */
export async function getContaAzulToken(): Promise<string> {
  const c = config.contaazul
  const row = await lerToken(c.companyId)
  if (!row) {
    throw new Error(
      'Conta Azul não autorizado. Acesse /oauth/contaazul/start e conclua o login antes de sincronizar.',
    )
  }

  const expiraEm = new Date(row.expires_at).getTime()
  if (expiraEm > Date.now() + 60_000) return row.access_token

  logger.info('contaazul', 'access_token expirado, renovando via refresh_token')
  const json = await pedirToken({
    grant_type: 'refresh_token',
    client_id: c.clientId,
    refresh_token: row.refresh_token,
  })

  await salvarToken({
    company_id: c.companyId,
    access_token: json.access_token,
    // o Cognito nem sempre devolve refresh_token novo; mantém o antigo
    refresh_token: json.refresh_token ?? row.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  })
  return json.access_token
}
