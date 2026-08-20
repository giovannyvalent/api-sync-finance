import { config } from '../config.js'
import { logger } from '../logger.js'

/**
 * Autenticação do Projuris ADV.
 * Doc: POST https://apigw.projurisadv.com.br/auth/token
 *      x-www-form-urlencoded: grant_type=password, client_id, client_secret,
 *      username=USUARIO$$DOMINIO, password
 *      resposta: { access_token, expires_in: 1500, refresh_token, ... }
 *
 * O token dura ~25 min, então cachear em memória ajuda dentro da mesma
 * invocação/instância quente do Vercel. Não persiste — é password grant,
 * dá pra reobter a qualquer momento.
 */

let cache: { token: string; expiraEm: number } | null = null

export async function getProjurisToken(): Promise<string> {
  const agora = Date.now()
  if (cache && cache.expiraEm > agora + 30_000) return cache.token

  const { authUrl, clientId, clientSecret, username, password } = config.projuris
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
  })

  const res = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })

  const texto = await res.text()
  if (!res.ok) {
    throw new Error(`Projuris auth ${res.status}: ${texto.slice(0, 400)}`)
  }

  const json = JSON.parse(texto) as { access_token: string; expires_in?: number }
  if (!json.access_token) throw new Error('Projuris auth: resposta sem access_token')

  const ttl = (json.expires_in ?? 1500) * 1000
  cache = { token: json.access_token, expiraEm: agora + ttl }
  logger.info('projuris', `token obtido (expira em ${Math.round(ttl / 1000)}s)`)
  return json.access_token
}

export function limparCacheToken(): void {
  cache = null
}
