import { config } from '../config.js'
import { logger } from '../logger.js'
import { getProjurisToken, limparCacheToken } from './auth.js'

export type ProjurisLancamento = Record<string, unknown>

async function chamar(path: string, query: Record<string, string | number> = {}, tentativa = 1): Promise<unknown> {
  const token = await getProjurisToken()
  const url = new URL(config.projuris.apiUrl.replace(/\/$/, '') + path)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v))

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })

  // token expirado no meio do caminho: renova uma vez e repete
  if ((res.status === 401 || res.status === 403) && tentativa === 1) {
    limparCacheToken()
    return chamar(path, query, 2)
  }

  const texto = await res.text()
  if (!res.ok) throw new Error(`Projuris ${path} ${res.status}: ${texto.slice(0, 500)}`)
  if (!texto) return []
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`Projuris ${path}: resposta não é JSON: ${texto.slice(0, 200)}`)
  }
}

/**
 * Extrai a lista de registros de uma resposta paginada.
 * O Projuris varia o envelope entre endpoints, então tentamos as chaves usuais.
 */
function extrairLista(resposta: unknown): ProjurisLancamento[] {
  if (Array.isArray(resposta)) return resposta as ProjurisLancamento[]
  if (resposta && typeof resposta === 'object') {
    const obj = resposta as Record<string, unknown>
    for (const chave of ['content', 'dados', 'registros', 'itens', 'items', 'lista', 'results', 'data']) {
      const v = obj[chave]
      if (Array.isArray(v)) return v as ProjurisLancamento[]
    }
  }
  return []
}

/**
 * Busca lançamentos financeiros num intervalo de datas (yyyy-mm-dd).
 * Pagina até acabar ou até PROJURIS_MAX_PAGINAS.
 */
export async function buscarLancamentos(dataInicio: string, dataFim: string): Promise<ProjurisLancamento[]> {
  const p = config.projuris
  const todos: ProjurisLancamento[] = []

  for (let pagina = 1; pagina <= p.maxPaginas; pagina++) {
    const resposta = await chamar(p.lancamentosPath, {
      [p.paramDataInicio]: dataInicio,
      [p.paramDataFim]: dataFim,
      [p.paramPagina]: pagina,
      [p.paramTamanhoPagina]: p.tamanhoPagina,
    })

    const lista = extrairLista(resposta)
    logger.info('projuris', `página ${pagina}: ${lista.length} lançamento(s)`)
    todos.push(...lista)

    if (lista.length < p.tamanhoPagina) break
  }

  return todos
}

/** Chamada crua — útil pra descobrir o formato real do endpoint financeiro. */
export async function chamarBruto(path: string, query: Record<string, string> = {}): Promise<unknown> {
  return chamar(path, query)
}
