import type { ReceitaDespesa } from '../projuris/client.js'

/**
 * Formato interno normalizado. Escrito contra o schema real de
 * receitaDespesaConsultaResultadoWs (POST /receita-despesa/consulta).
 */
export type Lancamento = {
  id: string
  descricao: string
  valor: number
  dataVencimento: string // yyyy-mm-dd
  dataCompetencia?: string
  tipo: 'RECEITA' | 'DESPESA'
  status?: string
  clienteNome: string
  clienteDocumento?: string
  clienteEmail?: string
  processo?: string
  centroCusto?: string
  categoria?: string
  numeroDocumento?: string
  bruto: ReceitaDespesa
}

function texto(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

/** Aceita 1234.56, "1.234,56", "1234,56" e "R$ 1.234,56". */
export function paraNumero(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return NaN
  let s = v.replace(/[R$\s]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return Number(s)
}

/**
 * Normaliza para yyyy-mm-dd.
 * O Projuris devolve datas como epoch em MILISSEGUNDOS (tipo long); as demais
 * formas ficam aceitas para não quebrar em campos que venham como string.
 */
export function paraDataIso(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined

  if (typeof v === 'number') {
    // segundos vs milissegundos: epoch em segundos não passa de ~1e10
    const ms = v < 1e11 ? v * 1000 : v
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return undefined
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const s = String(v).trim()
  if (/^\d{10,}$/.test(s)) return paraDataIso(Number(s))

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const br = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(s)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

/** Converte um item da consulta do Projuris no formato interno. */
export function normalizar(bruto: ReceitaDespesa): Lancamento | null {
  const id = texto(bruto.codigoReceitaDespesa ?? bruto.codigoLancamento)
  if (!id) return null

  // "data" é o vencimento quando a consulta usa dataFiltro=VENCIMENTO
  const dataVencimento = paraDataIso(bruto.data)
  if (!dataVencimento) return null

  // valorReal reflete acréscimos/descontos; cai para valor quando ausente
  const valor = paraNumero(bruto.valorReal ?? bruto.valor)

  const natureza = (texto(bruto.tipoReceitaDespesa) ?? '').toUpperCase()
  const tipo: Lancamento['tipo'] = natureza.includes('DESPES') ? 'DESPESA' : 'RECEITA'

  const numeroDocumento = texto(bruto.numeroDocumento)
  const planoConta = texto(bruto.planoConta)

  // A consulta não traz descrição livre: o rótulo útil é plano de contas +
  // número do documento. O identificador do módulo dá o vínculo (processo etc).
  const descricao =
    [planoConta, numeroDocumento ? `Doc. ${numeroDocumento}` : undefined]
      .filter(Boolean)
      .join(' — ') || `Lançamento Projuris ${id}`

  return {
    id,
    descricao,
    valor,
    dataVencimento,
    dataCompetencia: paraDataIso(bruto.dataExercicio),
    tipo,
    status: texto(bruto.situacao),
    clienteNome: texto(bruto.nomeFavorecido) ?? 'Cliente não identificado',
    // a consulta paginada não devolve CPF/CNPJ do favorecido
    clienteDocumento: undefined,
    clienteEmail: undefined,
    processo: texto(bruto.identificador ?? bruto.identificadorModulo),
    centroCusto: texto(bruto.unidadeOrganizacional?.valor),
    categoria: planoConta,
    numeroDocumento,
    bruto,
  }
}

/** Descrição enviada ao Conta Azul — carrega a origem para rastreabilidade. */
export function descricaoContaAzul(l: Lancamento): string {
  const partes = [l.descricao]
  if (l.processo) partes.push(l.processo)
  partes.push(`[Projuris #${l.id}]`)
  return partes.join(' — ').slice(0, 250)
}
