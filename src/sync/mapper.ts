import type { ProjurisLancamento } from '../projuris/client.js'

/**
 * Formato interno normalizado. O resto do sistema só conhece este shape —
 * se o Projuris mudar nomes de campo, só este arquivo muda.
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
  bruto: ProjurisLancamento
}

/** Lê o primeiro caminho que existir. Aceita "a.b.c" para campos aninhados. */
function pick(obj: unknown, caminhos: string[]): unknown {
  for (const caminho of caminhos) {
    let atual: unknown = obj
    let ok = true
    for (const parte of caminho.split('.')) {
      if (atual && typeof atual === 'object' && parte in (atual as Record<string, unknown>)) {
        atual = (atual as Record<string, unknown>)[parte]
      } else {
        ok = false
        break
      }
    }
    if (ok && atual !== null && atual !== undefined && atual !== '') return atual
  }
  return undefined
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

/** Normaliza para yyyy-mm-dd. Aceita ISO, dd/mm/aaaa e dd-mm-aaaa. */
export function paraDataIso(v: unknown): string | undefined {
  const s = texto(v)
  if (!s) return undefined

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const br = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(s)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

/**
 * Converte um lançamento cru do Projuris no formato interno.
 * Os arrays de candidatos cobrem as variações de nomenclatura mais prováveis;
 * confirme contra o payload real e enxugue depois da primeira execução.
 */
export function normalizar(bruto: ProjurisLancamento): Lancamento | null {
  const id = texto(
    pick(bruto, ['id', 'codigo', 'idLancamento', 'lancamentoId', 'seqLancamento', 'chave']),
  )
  if (!id) return null

  const valor = paraNumero(
    pick(bruto, ['valor', 'valorLancamento', 'valorTotal', 'valorOriginal', 'vlLancamento']),
  )

  const dataVencimento = paraDataIso(
    pick(bruto, ['dataVencimento', 'vencimento', 'dtVencimento', 'data_vencimento', 'dataPrevista']),
  )
  if (!dataVencimento) return null

  const tipoBruto = (texto(pick(bruto, ['tipo', 'tipoLancamento', 'natureza', 'especie'])) ?? '')
    .toUpperCase()
  const tipo: Lancamento['tipo'] =
    tipoBruto.includes('DESPES') || tipoBruto.includes('PAGAR') || tipoBruto.includes('SAIDA')
      ? 'DESPESA'
      : 'RECEITA'

  const clienteNome =
    texto(
      pick(bruto, [
        'cliente.nome',
        'pessoa.nome',
        'nomeCliente',
        'cliente',
        'clienteNome',
        'favorecido.nome',
        'favorecido',
        'nomePessoa',
      ]),
    ) ?? 'Cliente não identificado'

  return {
    id,
    descricao:
      texto(pick(bruto, ['descricao', 'historico', 'observacao', 'titulo', 'complemento'])) ??
      `Lançamento Projuris ${id}`,
    valor,
    dataVencimento,
    dataCompetencia: paraDataIso(
      pick(bruto, ['dataCompetencia', 'dataLancamento', 'dtLancamento', 'dataEmissao']),
    ),
    tipo,
    status: texto(pick(bruto, ['status', 'situacao', 'statusLancamento', 'situacaoLancamento'])),
    clienteNome,
    clienteDocumento: texto(
      pick(bruto, [
        'cliente.cpfCnpj',
        'cliente.documento',
        'pessoa.cpfCnpj',
        'cpfCnpj',
        'documento',
        'cnpjCpf',
        'cliente.cnpj',
        'cliente.cpf',
      ]),
    ),
    clienteEmail: texto(pick(bruto, ['cliente.email', 'pessoa.email', 'email', 'emailCliente'])),
    processo: texto(
      pick(bruto, ['processo.numero', 'numeroProcesso', 'processo', 'pasta', 'numeroPasta']),
    ),
    centroCusto: texto(pick(bruto, ['centroCusto.nome', 'centroCusto', 'centro_custo'])),
    categoria: texto(
      pick(bruto, ['categoria.nome', 'categoria', 'planoContas.nome', 'planoContas', 'classificacao']),
    ),
    bruto,
  }
}

/** Descrição enviada ao Conta Azul — carrega a origem para rastreabilidade. */
export function descricaoContaAzul(l: Lancamento): string {
  const partes = [l.descricao]
  if (l.processo) partes.push(`Proc. ${l.processo}`)
  partes.push(`[Projuris #${l.id}]`)
  return partes.join(' — ').slice(0, 250)
}
