import { config } from '../config.js'
import { logger } from '../logger.js'
import { getProjurisToken, limparCacheToken } from './auth.js'

/**
 * Cliente do módulo Financeiro do Projuris ADV.
 * Doc: https://docs.projurisadv.com.br/resource_Financeiro.html
 *
 * O endpoint de lançamentos é POST /receita-despesa/consulta:
 *   - filtros vão no CORPO (não na query)
 *   - paginação/ordenação vão na QUERY, em kebab-case
 *   - datas são epoch em MILISSEGUNDOS (tipo long), não string
 *   - o campo de início do período é "dataPeridoInicio" (typo do schema deles)
 */

export type ReceitaDespesa = {
  codigoReceitaDespesa?: number
  data?: number
  situacao?: string
  tipoReceitaDespesa?: string
  planoConta?: string
  nomeFavorecido?: string
  numeroDocumento?: string
  valor?: number
  valorReal?: number
  identificador?: string
  identificadorModulo?: string
  codigoRegistroVinculo?: number
  codigoLancamento?: number
  modulo?: string
  dataExercicio?: number
  unidadeOrganizacional?: { chave?: string; valor?: string }
  tipoDocumento?: { chave?: string; valor?: string }
  receitaDespesaItemWs?: unknown[]
  pagamentoDadosBasico?: unknown[]
  codigoExterno?: string
  codigoExternoAdicional?: string
  [k: string]: unknown
}

type RespostaConsulta = {
  totalRegistros?: number
  totalValor?: number
  receitaDespesaConsultaResultadoWs?: ReceitaDespesa[]
}

async function chamar<T>(
  metodo: 'GET' | 'POST',
  path: string,
  opcoes: { query?: Record<string, string | number>; body?: unknown } = {},
  tentativa = 1,
): Promise<T> {
  const token = await getProjurisToken()
  const url = new URL(config.projuris.apiUrl.replace(/\/$/, '') + path)
  for (const [k, v] of Object.entries(opcoes.query ?? {})) url.searchParams.set(k, String(v))

  const res = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  })

  // token venceu no meio do caminho: renova uma vez e repete
  if ((res.status === 401 || res.status === 403) && tentativa === 1) {
    limparCacheToken()
    return chamar<T>(metodo, path, opcoes, 2)
  }

  const texto = await res.text()
  if (!res.ok) throw new Error(`Projuris ${metodo} ${path} ${res.status}: ${texto.slice(0, 500)}`)
  if (!texto) return null as T
  try {
    return JSON.parse(texto) as T
  } catch {
    throw new Error(`Projuris ${path}: resposta não é JSON: ${texto.slice(0, 200)}`)
  }
}

/** yyyy-mm-dd → epoch ms (meia-noite local). */
function isoParaEpoch(iso: string, fimDoDia = false): number {
  const [a, m, d] = iso.split('-').map(Number)
  return fimDoDia
    ? new Date(a, m - 1, d, 23, 59, 59, 999).getTime()
    : new Date(a, m - 1, d, 0, 0, 0, 0).getTime()
}

/**
 * Busca lançamentos financeiros por período de vencimento.
 * Filtra RECEITA no servidor — não faz sentido trazer despesa para virar
 * conta a receber.
 */
export async function buscarLancamentos(
  dataInicio: string,
  dataFim: string,
): Promise<ReceitaDespesa[]> {
  const p = config.projuris
  const todos: ReceitaDespesa[] = []

  const filtro: Record<string, unknown> = {
    dataPeridoInicio: isoParaEpoch(dataInicio),
    dataPeridoFim: isoParaEpoch(dataFim, true),
    // o período se aplica ao VENCIMENTO, não à emissão
    dataFiltro: p.dataFiltro,
  }
  if (p.planoContaNatureza) filtro.planoContaNatureza = p.planoContaNatureza

  for (let pagina = 1; pagina <= p.maxPaginas; pagina++) {
    const resposta = await chamar<RespostaConsulta>('POST', p.lancamentosPath, {
      query: {
        pagina,
        'quan-registros': p.tamanhoPagina,
        'executar-contagem': pagina === 1 ? 'true' : 'false',
      },
      body: filtro,
    })

    const lista = resposta?.receitaDespesaConsultaResultadoWs ?? []
    if (pagina === 1) {
      logger.info(
        'projuris',
        `consulta: ${resposta?.totalRegistros ?? '?'} registro(s), total R$ ${resposta?.totalValor ?? '?'}`,
      )
    }
    logger.info('projuris', `página ${pagina}: ${lista.length} lançamento(s)`)
    todos.push(...lista)

    if (lista.length < p.tamanhoPagina) break
  }

  return todos
}

/**
 * Dados cadastrais de uma pessoa (GET /adv-service/pessoa/{codigo}).
 * A consulta de receita-despesa devolve só o NOME do favorecido; para casar o
 * cliente no Conta Azul com segurança precisamos do CPF/CNPJ.
 */
export async function buscarPessoa(codigo: number | string): Promise<Record<string, unknown> | null> {
  try {
    return await chamar<Record<string, unknown>>('GET', `/pessoa/${codigo}`)
  } catch (e) {
    logger.warn('projuris', `pessoa ${codigo} não recuperada: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

/** Extrai CPF/CNPJ de um cadastro de pessoa, tolerando variações de campo. */
export function extrairDocumento(pessoa: Record<string, unknown> | null): string | undefined {
  if (!pessoa) return undefined
  for (const chave of ['cpfCnpj', 'cpf', 'cnpj', 'documento', 'numeroDocumento', 'nrDocumento']) {
    const v = pessoa[chave]
    if (typeof v === 'string' && v.replace(/\D/g, '').length >= 11) return v
    if (typeof v === 'number' && String(v).length >= 11) return String(v)
  }
  return undefined
}

/** Detalhe de um lançamento — traz mais campos que a consulta paginada. */
export async function buscarLancamentoDetalhe(codigo: number | string): Promise<unknown> {
  return chamar('GET', `/receita-despesa/${codigo}`)
}

/** Chamada crua, para inspecionar qualquer endpoint sem mexer no código. */
export async function chamarBruto(
  path: string,
  query: Record<string, string> = {},
  body?: unknown,
): Promise<unknown> {
  return chamar(body ? 'POST' : 'GET', path, { query, body })
}
