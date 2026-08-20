-- ============================================================
-- projuris-contaazul-sync — executar no SQL Editor do Supabase
-- ============================================================

-- Tokens OAuth do Conta Azul.
-- Serverless não guarda estado entre invocações: o refresh_token vive aqui.
create table if not exists contaazul_token (
  company_id     text        primary key,
  access_token   text        not null,
  refresh_token  text        not null,
  expires_at     timestamptz not null,
  atualizado_em  timestamptz not null default now()
);

-- Uma linha por execução do sync (manual, api, preview ou cron).
create table if not exists sync_run (
  id               bigserial   primary key,
  origem           text        not null,
  data_inicio      date        not null,
  data_fim         date        not null,
  dry_run          boolean     not null default false,
  total_lidos      int         not null default 0,
  total_criados    int         not null default 0,
  total_ignorados  int         not null default 0,
  total_erros      int         not null default 0,
  duracao_ms       int         not null default 0,
  erro             text,
  criado_em        timestamptz not null default now()
);

create index if not exists sync_run_criado_em on sync_run (criado_em desc);

-- Uma linha por lançamento do Projuris.
-- projuris_id é UNIQUE: é o que garante idempotência (nunca duplica no Conta Azul).
create table if not exists sync_lancamento (
  projuris_id          text        primary key,
  contaazul_id         text,
  contaazul_pessoa_id  text,
  descricao            text,
  valor                numeric(14,2),
  data_vencimento      date,
  data_competencia     date,
  status_projuris      text,
  cliente_nome         text,
  cliente_documento    text,
  processo             text,
  centro_custo         text,
  categoria            text,
  status_sync          text        not null,  -- 'criado' | 'ignorado' | 'erro' | 'dry_run'
  motivo               text,
  run_id               bigint      references sync_run(id),
  payload_projuris     jsonb,
  payload_contaazul    jsonb,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create index if not exists sync_lancamento_status      on sync_lancamento (status_sync);
create index if not exists sync_lancamento_vencimento  on sync_lancamento (data_vencimento);
create index if not exists sync_lancamento_cliente     on sync_lancamento (cliente_documento);
create index if not exists sync_lancamento_run         on sync_lancamento (run_id);

-- ------------------------------------------------------------
-- Views de analytics
-- ------------------------------------------------------------

-- Valor sincronizado por mês de vencimento.
create or replace view vw_sync_por_mes as
select
  date_trunc('month', data_vencimento)::date as mes,
  count(*)                                    as quantidade,
  sum(valor)                                  as valor_total
from sync_lancamento
where status_sync = 'criado'
group by 1
order by 1;

-- Ranking de clientes.
create or replace view vw_sync_por_cliente as
select
  coalesce(cliente_documento, cliente_nome) as chave_cliente,
  max(cliente_nome)                          as cliente_nome,
  count(*)                                   as quantidade,
  sum(valor)                                 as valor_total
from sync_lancamento
where status_sync = 'criado'
group by 1
order by valor_total desc;

-- Saúde da integração nos últimos 30 dias.
create or replace view vw_sync_saude as
select
  date_trunc('day', criado_em)::date as dia,
  count(*)                            as execucoes,
  sum(total_criados)                  as criados,
  sum(total_erros)                    as erros,
  round(avg(duracao_ms))              as duracao_media_ms
from sync_run
where criado_em > now() - interval '30 days'
group by 1
order by 1 desc;
