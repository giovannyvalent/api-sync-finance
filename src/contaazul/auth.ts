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
 * O authorization_code vale 3 minutos. O access_token expira em 1h e é
 * renovado pelo refresh_token, que vale 2 semanas e é de USO ÚNICO — cada
 * renovação devolve um refresh_token novo que precisa substituir o anterior.
 * Por isso o par fica no Supabase: serverless não mantém memória entre
 * invocações, e perder o token novo quebra a integração de vez.
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

const ERRO_REAUTORIZAR =
  'Conta Azul não autorizado. Acesse /oauth/contaazul/start e conclua o login antes de sincronizar.'

/**
 * Access token válido: usa o do banco ou renova via refresh_token.
 *
 * Atenção ao contrato do Conta Azul: o access_token vale 1 hora e o
 * refresh_token vale 2 semanas MAS é de USO ÚNICO. Cada renovação obriga a
 * gravar o refresh_token novo — guardar o antigo deixa a integração morta na
 * renovação seguinte, com erro genérico de invalid_grant.
 */
export async function getContaAzulToken(): Promise<string> {
  const c = config.contaazul
  const row = await lerToken(c.companyId)
  if (!row) throw new Error(ERRO_REAUTORIZAR)

  const expiraEm = new Date(row.expires_at).getTime()
  if (expiraEm > Date.now() + 60_000) return row.access_token

  logger.info('contaazul', 'access_token expirado, renovando via refresh_token')

  let json: RespostaToken
  try {
    json = await pedirToken({
      grant_type: 'refresh_token',
      client_id: c.clientId,
      refresh_token: row.refresh_token,
    })
  } catch (e) {
    // Duas invocações serverless podem tentar renovar ao mesmo tempo: uma
    // consome o refresh_token e a outra recebe invalid_grant. Antes de
    // desistir, verifica se a concorrente já gravou um par válido.
    const atual = await lerToken(c.companyId)
    if (atual && atual.refresh_token !== row.refresh_token) {
      const novoPrazo = new Date(atual.expires_at).getTime()
      if (novoPrazo > Date.now() + 60_000) {
        logger.warn('contaazul', 'refresh concorrente detectado; usando o token gravado pela outra execução')
        return atual.access_token
      }
    }
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Falha ao renovar o token do Conta Azul (${msg}). ` +
        'O refresh_token é de uso único e expira em 2 semanas — se a integração ficou parada além disso, ' +
        'é preciso refazer a autorização em /oauth/contaazul/start.',
    )
  }

  if (!json.refresh_token) {
    // Não dá pra continuar com o antigo: ele acabou de ser consumido.
    throw new Error(
      'Conta Azul devolveu access_token sem refresh_token novo. Como o refresh_token é de uso único, ' +
        'não há token válido para a próxima renovação — refaça a autorização em /oauth/contaazul/start.',
    )
  }

  await salvarToken({
    company_id: c.companyId,
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  })
  return json.access_token
}
