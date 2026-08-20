import { config } from '../config.js'
import { logger } from '../logger.js'
import { getContaAzulToken } from './auth.js'

/**
 * Cliente da API v2 do Conta Azul — https://api-v2.contaazul.com/v1
 * Limite documentado: ~10 req/s. O sync serializa as chamadas e ainda
 * respeita um intervalo mínimo entre elas.
 */

const INTERVALO_MIN_MS = 120
let ultimaChamada = 0

async function respeitarRateLimit(): Promise<void> {
  const espera = ultimaChamada + INTERVALO_MIN_MS - Date.now()
  if (espera > 0) await new Promise((r) => setTimeout(r, espera))
  ultimaChamada = Date.now()
}

async function chamar<T>(
  metodo: 'GET' | 'POST' | 'PUT',
  path: string,
  opcoes: { query?: Record<string, string | number>; body?: unknown } = {},
): Promise<T> {
  await respeitarRateLimit()

  const token = await getContaAzulToken()
  const url = new URL(config.contaazul.apiBase.replace(/\/$/, '') + path)
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

  // 429: espera e tenta uma vez
  if (res.status === 429) {
    logger.warn('contaazul', `429 em ${path}, aguardando 2s`)
    await new Promise((r) => setTimeout(r, 2000))
    return chamar<T>(metodo, path, opcoes)
  }

  const texto = await res.text()
  if (!res.ok) throw new Error(`ContaAzul ${metodo} ${path} ${res.status}: ${texto.slice(0, 500)}`)
  return (texto ? JSON.parse(texto) : null) as T
}

// ---------------------------------------------------------------------------
// Pessoas (clientes)
// ---------------------------------------------------------------------------

export type Pessoa = { id: string; nome?: string; documento?: string }

function somenteDigitos(v?: string | null): string {
  return (v ?? '').replace(/\D/g, '')
}

/** Procura cliente por documento (CPF/CNPJ) e, sem documento, por nome. */
export async function buscarPessoa(documento?: string, nome?: string): Promise<Pessoa | null> {
  const doc = somenteDigitos(documento)
  const termo = doc || (nome ?? '').trim()
  if (!termo) return null

  const resposta = await chamar<unknown>('GET', '/pessoa', {
    query: { termo_busca: termo, tamanho_pagina: 10, pagina: 1 },
  })

  const lista = extrairLista(resposta)
  if (lista.length === 0) return null

  if (doc) {
    const exato = lista.find((p) => somenteDigitos(p.documento) === doc)
    if (exato) return exato
    return null // com documento em mãos, não aceita casamento por nome
  }

  const alvo = (nome ?? '').trim().toLowerCase()
  return lista.find((p) => (p.nome ?? '').trim().toLowerCase() === alvo) ?? null
}

export async function criarPessoa(dados: {
  nome: string
  documento?: string
  email?: string
  telefone?: string
}): Promise<Pessoa> {
  const doc = somenteDigitos(dados.documento)
  const body: Record<string, unknown> = {
    nome: dados.nome,
    tipo_pessoa: doc.length === 14 ? 'JURIDICA' : 'FISICA',
    perfis: ['CLIENTE'],
  }
  if (doc) body.documento = doc
  if (dados.email) body.email = dados.email
  if (dados.telefone) body.telefone = dados.telefone

  const criada = await chamar<Pessoa>('POST', '/pessoa', { body })
  logger.info('contaazul', `pessoa criada: ${dados.nome} (${criada?.id})`)
  return criada
}

/** Reaproveita o cliente existente ou cria um novo. */
export async function garantirPessoa(dados: {
  nome: string
  documento?: string
  email?: string
}): Promise<Pessoa> {
  const existente = await buscarPessoa(dados.documento, dados.nome)
  if (existente) return existente
  return criarPessoa(dados)
}

// ---------------------------------------------------------------------------
// Contas a receber
// ---------------------------------------------------------------------------

export type ContaReceberInput = {
  pessoaId: string
  descricao: string
  valor: number
  dataVencimento: string // yyyy-mm-dd
  dataCompetencia?: string
  categoriaId?: string
  contaFinanceiraId?: string
  centroCustoId?: string
  observacao?: string
}

/**
 * Monta o corpo do POST de conta a receber.
 * Exposto separado do envio para o modo dry-run poder mostrar exatamente
 * o que seria enviado — e para ajustar o mapeamento num lugar só.
 */
export function montarBodyContaReceber(input: ContaReceberInput): Record<string, unknown> {
  const c = config.contaazul
  const body: Record<string, unknown> = {
    id_pessoa: input.pessoaId,
    descricao: input.descricao,
    data_vencimento: input.dataVencimento,
    total: Number(input.valor.toFixed(2)),
    negociacao: {
      tipo: 'A_VISTA',
      parcelas: [
        {
          data_vencimento: input.dataVencimento,
          valor: Number(input.valor.toFixed(2)),
        },
      ],
    },
  }

  const categoria = input.categoriaId || c.categoriaId
  if (categoria) body.id_categoria = categoria

  const conta = input.contaFinanceiraId || c.contaFinanceiraId
  if (conta) body.id_conta_financeira = conta

  const centro = input.centroCustoId || c.centroCustoId
  if (centro) body.id_centro_custo = centro

  if (input.dataCompetencia) body.data_competencia = input.dataCompetencia
  if (input.observacao) body.observacao = input.observacao

  return body
}

export type ContaReceberCriada = { id?: string; [k: string]: unknown }

export async function criarContaReceber(input: ContaReceberInput): Promise<ContaReceberCriada> {
  const body = montarBodyContaReceber(input)
  const criada = await chamar<ContaReceberCriada>(
    'POST',
    '/financeiro/eventos-financeiros/contas-a-receber',
    { body },
  )
  logger.info('contaazul', `conta a receber criada: ${input.descricao} (${criada?.id})`)
  return criada
}

// ---------------------------------------------------------------------------
// Consultas auxiliares — servem pra descobrir os ids de configuração
// ---------------------------------------------------------------------------

export async function listarContasFinanceiras(): Promise<unknown> {
  return chamar('GET', '/financeiro/contas-financeiras/buscar', {
    query: { tamanho_pagina: 100, pagina: 1 },
  })
}

export async function listarCategorias(): Promise<unknown> {
  return chamar('GET', '/financeiro/categorias', { query: { tamanho_pagina: 100, pagina: 1 } })
}

export async function listarCentrosCusto(): Promise<unknown> {
  return chamar('GET', '/financeiro/centros-de-custo', { query: { tamanho_pagina: 100, pagina: 1 } })
}

function extrairLista(resposta: unknown): Pessoa[] {
  if (Array.isArray(resposta)) return resposta as Pessoa[]
  if (resposta && typeof resposta === 'object') {
    const obj = resposta as Record<string, unknown>
    for (const chave of ['itens', 'dados', 'content', 'data', 'results']) {
      const v = obj[chave]
      if (Array.isArray(v)) return v as Pessoa[]
    }
  }
  return []
}
