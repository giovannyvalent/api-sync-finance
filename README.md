# projuris-contaazul-sync

API serverless (Vercel) que lê **lançamentos financeiros do Projuris** e cria as
**contas a receber correspondentes no Conta Azul**, guardando tudo no Supabase
para analytics posterior.

```
Projuris ADV ──► normalização ──► Conta Azul (contas a receber)
     │                                    │
     └────────────► Supabase ◄────────────┘
                (idempotência + analytics)
```

## Painel

`GET /painel` — tela de operação servida pelo próprio Express, na mesma URL da
API. Não há front separado de propósito: um segundo deploy traria CORS, outra
autenticação e mais uma coisa para manter, sem ganho para uma tela interna.

O painel cobre o ciclo inteiro sem terminal:

- **Situação** — o que falta configurar, se o Conta Azul está autorizado e há
  quantos dias o token foi renovado (o `refresh_token` morre com 14 dias parado)
- **Executar** — período por vencimento, alternando entre *Simular* e
  *Executar de verdade*, com o resultado item a item
- **Analytics** — valor sincronizado, série por mês e ranking de clientes
- **Execuções e erros** — histórico dos runs e lançamentos que falharam

A página é pública (não carrega segredo), mas todo dado que ela busca exige a
`SYNC_API_KEY`, digitada uma vez e guardada no `localStorage` do navegador.

O modo **Simular** é o padrão do seletor: quem abre o painel pela primeira vez
não escreve no Conta Azul por acidente.

## O endpoint financeiro do Projuris

Documentação real: **https://docs.projurisadv.com.br/resource_Financeiro.html**
(a Central de Ajuda não cobre o módulo Financeiro; o OpenAPI cobre).

O endpoint usado é **`POST /adv-service/receita-despesa/consulta`**. Quatro
detalhes que não dá para adivinhar e estão implementados:

- os **filtros vão no corpo**, e paginação/ordenação na query (`pagina`,
  `quan-registros`, `executar-contagem`);
- as **datas são epoch em milissegundos** (tipo `long`), não string;
- o campo de início do período chama-se **`dataPeridoInicio`** — o typo
  ("Perido") está no schema do Projuris, não aqui;
- `dataFiltro: "VENCIMENTO"` faz o período valer sobre o vencimento, e
  `planoContaNatureza: "RECEITA"` filtra no servidor — despesa não deve virar
  conta a receber.

A resposta vem como `{ totalRegistros, totalValor, receitaDespesaConsultaResultadoWs[] }`.

### Limitação conhecida: favorecido sem CPF/CNPJ

A consulta paginada devolve apenas `nomeFavorecido`, sem documento. Casar
cliente por nome num sistema contábil produz duplicata ("Acme Ltda" x
"ACME LTDA"). Por isso, quando o item traz `codigoFavorecido`, o sync busca o
cadastro em `GET /adv-service/pessoa/{codigo}` e usa o CPF/CNPJ para casar no
Conta Azul — com cache por execução, já que vários lançamentos costumam apontar
para o mesmo favorecido. Desligue com `PROJURIS_ENRIQUECER_FAVORECIDO=false`.

Se `codigoFavorecido` não vier na resposta real, o casamento cai para nome e o
log mostra `favorecidos com CPF/CNPJ: 0/N` — sinal de que vale usar
`GET /receita-despesa/{codigo}` para buscar o vínculo.

## Setup

**1. Banco** — rode [`sql/schema.sql`](sql/schema.sql) no SQL Editor do Supabase.

**2. Variáveis** — copie `.env.example` e preencha no painel da Vercel.

**3. Deploy**

```bash
vercel --prod
```

**4. Autorizar o Conta Azul** (uma vez por empresa) — abra no navegador:

```
https://SEU-APP.vercel.app/oauth/contaazul/start
```

Isso salva `access_token` + `refresh_token` na tabela `contaazul_token`. Dali em
diante a renovação é automática.

**5. Resolver os ids de configuração**

```bash
curl -H "x-api-key: $SYNC_API_KEY" https://SEU-APP.vercel.app/sync/contaazul-refs
```

Pegue o id da conta financeira / categoria / centro de custo e coloque em
`CONTAAZUL_CONTA_FINANCEIRA_ID`, `CONTAAZUL_CATEGORIA_ID`, `CONTAAZUL_CENTRO_CUSTO_ID`.

**6. Conferir em dry-run antes de escrever de verdade**

```bash
curl -X POST -H "x-api-key: $SYNC_API_KEY" \
  "https://SEU-APP.vercel.app/sync/preview?inicio=2026-08-01&fim=2026-08-31"
```

O dry-run mostra o JSON exato que iria para o Conta Azul, sem criar nada.
Quando estiver certo, tire `SYNC_DRY_RUN=true` e use `/sync/run`.

## Rotas

| Rota | Proteção | O que faz |
|---|---|---|
| `GET /painel` | — | Painel de operação (dados exigem a chave) |
| `GET /health` | — | Diz quais env vars faltam |
| `GET /oauth/contaazul/start` | — | Inicia o OAuth do Conta Azul |
| `GET /oauth/contaazul/callback` | — | Recebe o `code` e salva os tokens |
| `POST /sync/run` | `x-api-key` | Executa o sync (`inicio`, `fim`, `dry_run`) |
| `POST /sync/preview` | `x-api-key` | Igual, sempre em dry-run |
| `GET /sync/projuris-bruto` | `x-api-key` | Resposta crua do Projuris + normalização |
| `GET /sync/contaazul-refs` | `x-api-key` | Contas financeiras, categorias, centros de custo |
| `GET /analytics/resumo` | `x-api-key` | Volume e valor por status |
| `GET /analytics/por-mes` | `x-api-key` | Série mensal |
| `GET /analytics/por-cliente` | `x-api-key` | Ranking de clientes |
| `GET /analytics/execucoes` | `x-api-key` | Últimos runs + erros abertos |
| `GET /cron/sync` | `CRON_SECRET` | Chamado de hora em hora pelo Vercel Cron |

## Decisões que valem saber

**Idempotência.** `sync_lancamento.projuris_id` é chave primária. Antes de criar
qualquer coisa, o runner consulta os ids já com `status_sync = 'criado'` e pula.
Rodar o mesmo período dez vezes não duplica nada no Conta Azul.

**Token do Conta Azul no banco.** Função serverless não tem memória entre
invocações — se o `refresh_token` ficasse em RAM, a integração morreria na
primeira expiração. Por isso a tabela `contaazul_token`.

**Não existe token direto / chave de API no Conta Azul.** A API v2 só aceita
OAuth2 Authorization Code — não há `client_credentials`. O login manual é uma
vez por empresa; depois a renovação é automática.

**O `refresh_token` do Conta Azul é de uso único.** Pela doc oficial: o
`access_token` vale 1 hora e o `refresh_token` vale 2 semanas, *mas só pode ser
usado uma vez*. Cada renovação devolve um par novo que precisa substituir o
anterior — guardar o antigo deixa a integração morta na renovação seguinte, com
um `invalid_grant` genérico difícil de diagnosticar. Consequências no código:

- a renovação **exige** `refresh_token` novo na resposta e falha com mensagem
  explícita se ele não vier;
- duas invocações simultâneas podem competir pela renovação; quem perde a
  corrida relê o banco e usa o par que a outra gravou, em vez de quebrar;
- o cron renova o token **antes** de olhar o Projuris, para que um período longo
  sem lançamento nenhum não deixe o `refresh_token` vencer por inatividade;
- `GET /health` mostra `dias_desde_ultima_renovacao` e liga
  `risco_expiracao_refresh` a partir de 10 dias.

Se a integração ficar parada mais de 2 semanas, não tem jeito: é preciso refazer
`/oauth/contaazul/start` no navegador.

**Só receita vira conta a receber.** Lançamentos classificados como despesa são
registrados com `status_sync = 'ignorado'` e o motivo — aparecem no analytics,
mas não vão para o Conta Azul. Contas a pagar seriam outro endpoint.

**Mapeamento contra o schema real.** `src/sync/mapper.ts` lê os campos de
`receitaDespesaConsultaResultadoWs` pelo nome documentado. Usa `valorReal` (que
reflete acréscimos e descontos) e cai para `valor` quando ausente; converte
epoch em milissegundos para `yyyy-mm-dd`.

**Erro não derruba o lote.** Cada lançamento é tratado num try/catch próprio;
falha individual vira `status_sync = 'erro'` com a mensagem e aparece em
`/analytics/execucoes`. Reexecutar o período reprocessa só o que não deu certo.

## Analytics

Além das rotas, o schema cria três views prontas para BI/Metabase:
`vw_sync_por_mes`, `vw_sync_por_cliente`, `vw_sync_saude`.

Os payloads originais ficam em `payload_projuris` / `payload_contaazul` (jsonb),
então dá pra reconstruir análises novas sem voltar nas APIs de origem.

## Local

```bash
npm install
cp .env.example .env
npm run dev     # painel em http://localhost:3000/painel
```
