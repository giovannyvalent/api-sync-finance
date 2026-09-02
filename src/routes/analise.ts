import { Router } from 'express'

export const analiseRouter = Router()

/**
 * Página de análise do fluxo Projuris -> Conta Azul.
 *
 * Mostra a transformação registro a registro: o item cru que veio da consulta
 * de receita-despesa, a regra aplicada, e o corpo do POST que iria para o
 * Conta Azul. É a tela para conferir o mapeamento antes de escrever de verdade.
 *
 * Abre em modo demonstração (dados fictícios) para poder ser avaliada sem
 * credencial nenhuma; com a chave preenchida, troca para os dados reais.
 *
 * Paleta validada com scripts/validate_palette.js da skill de dataviz:
 *  - funil: rampa ordinal azul de um hue só (passa nos dois modos)
 *  - série temporal: uma série (slot 1), sem legenda — o título nomeia
 *  - status nunca é o único canal: sempre acompanha ícone e rótulo
 * Verde x vermelho como preenchimentos vizinhos foi descartado: ΔE 4.1 sob
 * deuteranopia, ou seja, indistinguíveis para parte dos leitores.
 */
const HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Análise do Fluxo — Projuris para Conta Azul</title>
<style>
  :root{
    color-scheme: light;
    --plane:#f9f9f7; --surface:#ffffff;
    --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781;
    --grid:#e1e0d9; --axis:#c3c2b7; --ring:rgba(11,11,11,.10);
    --serie:#2a78d6;
    --ord-1:#86b6ef; --ord-2:#5598e7; --ord-3:#2a78d6; --ord-4:#1c5cab;
    --good:#0ca30c; --critical:#d03b3b; --neutro:#898781;
    --chip:#f0efec;
  }
  @media (prefers-color-scheme:dark){
    :root:where(:not([data-theme="light"])){
      color-scheme: dark;
      --plane:#0d0d0d; --surface:#1b1e24;
      --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
      --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10);
      --serie:#3987e5;
      --ord-1:#cde2fb; --ord-2:#9ec5f4; --ord-3:#6da7ec; --ord-4:#3987e5;
      --good:#0ca30c; --critical:#d03b3b; --neutro:#898781;
      --chip:#252932;
    }
  }
  :root[data-theme="dark"]{
    color-scheme: dark;
    --plane:#0d0d0d; --surface:#1b1e24;
    --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10);
    --serie:#3987e5;
    --ord-1:#cde2fb; --ord-2:#9ec5f4; --ord-3:#6da7ec; --ord-4:#3987e5;
    --good:#0ca30c; --critical:#d03b3b; --neutro:#898781;
    --chip:#252932;
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--plane);color:var(--ink);
    font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
  .wrap{max-width:1120px;margin:0 auto;padding:28px 20px 72px}

  header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
  h1{font-size:21px;margin:0;letter-spacing:-.015em}
  .sub{color:var(--ink-2);font-size:13px}
  .flex{flex:1}

  .card{background:var(--surface);border:1px solid var(--ring);border-radius:12px;
    padding:20px 22px;margin-top:16px}
  .card > h2{font-size:15px;margin:0;letter-spacing:-.01em;font-weight:650}
  .card > .cap{color:var(--ink-2);font-size:12.5px;margin:2px 0 0}

  .banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    background:var(--chip);border:1px solid var(--ring);border-radius:10px;
    padding:11px 14px;margin-top:16px;font-size:13px;color:var(--ink-2)}

  button{background:var(--serie);color:#fff;border:0;border-radius:8px;
    padding:9px 15px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit}
  button:hover{filter:brightness(1.08)}
  button.ghost{background:transparent;color:var(--serie);border:1px solid var(--ring)}
  button.ghost[aria-pressed="true"]{background:var(--serie);color:#fff;border-color:transparent}
  .seg{display:inline-flex;gap:6px;background:var(--chip);padding:4px;border-radius:10px}
  .seg button{background:transparent;color:var(--ink-2);padding:6px 13px;font-size:13px}
  .seg button[aria-pressed="true"]{background:var(--surface);color:var(--ink);
    box-shadow:0 1px 2px rgba(0,0,0,.08)}

  .tiles{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));
    margin-top:16px}
  .tile{background:var(--surface);border:1px solid var(--ring);border-radius:11px;padding:15px 16px}
  .tile .v{font-size:27px;font-weight:700;letter-spacing:-.025em;line-height:1.15}
  .tile .k{font-size:12.5px;color:var(--ink-2);margin-top:3px;
    display:flex;align-items:center;gap:6px}
  .dot{width:9px;height:9px;border-radius:50%;flex:none}
  .ic{width:13px;height:13px;flex:none}

  svg{display:block;overflow:visible}
  .gridline{stroke:var(--grid);stroke-width:1}
  .axis{stroke:var(--axis);stroke-width:1}
  .tick{fill:var(--muted);font-size:11px}
  .vlabel{fill:var(--ink);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
  .blabel{fill:var(--ink-2);font-size:12px}

  .tip{position:fixed;pointer-events:none;z-index:60;background:var(--surface);
    border:1px solid var(--ring);border-radius:9px;padding:9px 11px;
    box-shadow:0 6px 22px rgba(0,0,0,.16);font-size:12.5px;opacity:0;
    transition:opacity .1s;max-width:260px}
  .tip .tv{font-size:15px;font-weight:700;letter-spacing:-.02em}
  .tip .tk{color:var(--ink-2);font-size:12px;margin-top:1px}
  .tip .key{display:inline-block;width:14px;height:2px;border-radius:1px;
    vertical-align:middle;margin-right:6px}

  .scroll{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px;min-width:600px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;
    color:var(--muted);border-bottom:1px solid var(--grid);padding:9px 12px 9px 0;font-weight:650}
  td{padding:10px 12px 10px 0;border-bottom:1px solid var(--grid);vertical-align:top}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}

  .st{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
    white-space:nowrap}
  .st.criado{color:var(--good)} .st.erro{color:var(--critical)} .st.ignorado{color:var(--muted)}

  .rec{border:1px solid var(--ring);border-radius:11px;margin-top:10px;background:var(--surface);
    overflow:hidden}
  .rec > summary{cursor:pointer;padding:13px 16px;display:flex;align-items:center;gap:12px;
    flex-wrap:wrap;list-style:none}
  .rec > summary::-webkit-details-marker{display:none}
  .rec > summary:hover{background:var(--chip)}
  .rec .rid{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
  .rec .rdesc{font-weight:600;font-size:13.5px}
  .rec .rval{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:650}
  .rec .chev{color:var(--muted);font-size:11px}
  .rec[open] .chev{transform:rotate(90deg)}

  .flow{display:grid;grid-template-columns:1fr 44px 1fr;gap:0;
    border-top:1px solid var(--grid);padding:4px 16px 16px}
  @media (max-width:820px){ .flow{grid-template-columns:1fr;} .arrowcol{display:none} }
  .side h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);
    margin:16px 0 8px;font-weight:650}
  .kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:12.5px}
  .kv dt{color:var(--ink-2);white-space:nowrap}
  .kv dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .arrowcol{display:flex;align-items:center;justify-content:center;color:var(--muted)}
  mono,code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
    background:var(--chip);padding:1px 5px;border-radius:4px}
  /* atravessam as tres colunas do grid: sem isso caem na coluna da seta */
  .rule,.flow > details.json{grid-column:1 / -1}
  .rule{font-size:12px;color:var(--ink-2);background:var(--chip);border-radius:8px;
    padding:9px 12px;margin-top:12px;border:1px solid var(--ring)}
  .why{color:var(--muted);font-size:12px;margin-top:6px}
  details.json{margin-top:12px}
  details.json summary{cursor:pointer;color:var(--ink-2);font-size:12px}
  pre{background:var(--plane);border:1px solid var(--ring);border-radius:8px;padding:11px;
    overflow-x:auto;font-size:11.5px;margin:7px 0 0;line-height:1.5}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
</head>
<body>
<div class="wrap">

<header>
  <div>
    <h1>Análise do Fluxo</h1>
    <div class="sub">O que sai do Projuris e o que entra no Conta Azul</div>
  </div>
  <span class="flex"></span>
  <div class="seg" role="group" aria-label="Origem dos dados">
    <button id="mDemo" aria-pressed="true">Demonstração</button>
    <button id="mReal" aria-pressed="false">Dados reais</button>
  </div>
</header>

<div class="banner" id="banner"></div>

<div class="tiles" id="tiles"></div>

<div class="card">
  <h2>Funil da sincronização</h2>
  <p class="cap">De tudo que o Projuris devolveu, quanto chega a virar conta a receber.</p>
  <div id="funil"></div>
</div>

<div class="card">
  <h2>Valor por mês de vencimento</h2>
  <p class="cap">Total das contas a receber criadas, pela data de vencimento.</p>
  <div id="serie"></div>
</div>

<div class="card">
  <h2>Transformação registro a registro</h2>
  <p class="cap">Clique num lançamento para ver o campo de origem, a regra aplicada e o
    corpo do POST que vai para o Conta Azul.</p>
  <div id="registros"></div>
</div>

<div class="card">
  <h2>Tabela completa</h2>
  <p class="cap">Todos os valores em texto — a mesma informação dos gráficos, sem depender de cor.</p>
  <div class="scroll"><table id="tabela">
    <thead><tr>
      <th>Projuris</th><th>Descrição</th><th>Favorecido</th>
      <th class="num">Valor</th><th>Vencimento</th><th>Situação</th><th>Motivo</th>
    </tr></thead><tbody></tbody></table></div>
</div>

</div>
<div class="tip" id="tip" role="status" aria-live="polite"></div>

<script>
var $ = function (s) { return document.querySelector(s) };
var KEY = 'sync_api_key';

var BRL = function (n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
var BRL0 = function (n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
var DATA_BR = function (iso) {
  if (!iso) return '—';
  var p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
};
var MES_BR = function (ym) {
  var m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var p = ym.split('-');
  return m[Number(p[1]) - 1] + '/' + p[0].slice(2);
};

/* ---------------------------------------------------------------------------
   Dados de demonstração: itens no formato real de
   receitaDespesaConsultaResultadoWs, para a tela poder ser avaliada
   sem credencial e sem banco.
--------------------------------------------------------------------------- */
function epoch(a, m, d) { return new Date(a, m - 1, d).getTime() }

var DEMO_BRUTOS = [
  { codigoReceitaDespesa: 48211, data: epoch(2026,4,10), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários Contratuais', nomeFavorecido:'Construtora Marcheto Ltda', codigoFavorecido: 3312,
    numeroDocumento:'HON-2026-0188', valor: 12000, valorReal: 12000, identificador:'0018842-19.2025.8.26.0100',
    modulo:'processo', dataExercicio: epoch(2026,3,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48219, data: epoch(2026,4,22), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários de Êxito', nomeFavorecido:'Alvorada Alimentos S/A', codigoFavorecido: 2871,
    numeroDocumento:'EXI-2026-0042', valor: 45000, valorReal: 47250, identificador:'1002311-08.2024.8.26.0011',
    modulo:'processo', dataExercicio: epoch(2026,4,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48224, data: epoch(2026,5,5), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários Contratuais', nomeFavorecido:'Construtora Marcheto Ltda', codigoFavorecido: 3312,
    numeroDocumento:'HON-2026-0201', valor: 12000, valorReal: 12000, identificador:'0018842-19.2025.8.26.0100',
    modulo:'processo', dataExercicio: epoch(2026,4,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48240, data: epoch(2026,5,18), situacao:'PENDENTE', tipoReceitaDespesa:'DESPESA',
    planoConta:'Custas Processuais', nomeFavorecido:'Tribunal de Justiça SP', codigoFavorecido: 991,
    numeroDocumento:'CUS-4471', valor: 2380.75, valorReal: 2380.75, identificador:'0018842-19.2025.8.26.0100',
    modulo:'processo', dataExercicio: epoch(2026,5,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48255, data: epoch(2026,6,3), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Consultoria Tributária', nomeFavorecido:'Nordeste Logística ME', codigoFavorecido: 4102,
    numeroDocumento:'CON-2026-0077', valor: 8500, valorReal: 8500, identificador:'Contrato 2026/44',
    modulo:'contrato', dataExercicio: epoch(2026,5,1), unidadeOrganizacional:{ chave:'UO2', valor:'Filial RJ' } },
  { codigoReceitaDespesa: 48261, data: epoch(2026,6,14), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários Contratuais', nomeFavorecido:'Alvorada Alimentos S/A', codigoFavorecido: 2871,
    numeroDocumento:'HON-2026-0215', valor: 18000, valorReal: 18000, identificador:'1002311-08.2024.8.26.0011',
    modulo:'processo', dataExercicio: epoch(2026,6,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48277, data: epoch(2026,7,2), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários Contratuais', nomeFavorecido:'Construtora Marcheto Ltda', codigoFavorecido: 3312,
    numeroDocumento:'HON-2026-0230', valor: 12000, valorReal: 12000, identificador:'0018842-19.2025.8.26.0100',
    modulo:'processo', dataExercicio: epoch(2026,6,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48288, data: epoch(2026,7,20), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Assessoria Trabalhista', nomeFavorecido:'Metalúrgica Krauss Ltda', codigoFavorecido: 5533,
    numeroDocumento:'ASS-2026-0019', valor: 6400, valorReal: 6400, identificador:'Contrato 2026/51',
    modulo:'contrato', dataExercicio: epoch(2026,7,1), unidadeOrganizacional:{ chave:'UO2', valor:'Filial RJ' } },
  { codigoReceitaDespesa: 48301, data: epoch(2026,8,8), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários de Êxito', nomeFavorecido:'Nordeste Logística ME', codigoFavorecido: 4102,
    numeroDocumento:'EXI-2026-0058', valor: 31000, valorReal: 31000, identificador:'0044120-77.2023.8.26.0100',
    modulo:'processo', dataExercicio: epoch(2026,7,1), unidadeOrganizacional:{ chave:'UO2', valor:'Filial RJ' } },
  { codigoReceitaDespesa: 48309, data: epoch(2026,8,25), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários Contratuais', nomeFavorecido:'', codigoFavorecido: null,
    numeroDocumento:'HON-2026-0244', valor: 9000, valorReal: 9000, identificador:'0091002-33.2026.8.26.0100',
    modulo:'processo', dataExercicio: epoch(2026,8,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } },
  { codigoReceitaDespesa: 48312, data: epoch(2026,9,1), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Honorários Contratuais', nomeFavorecido:'Metalúrgica Krauss Ltda', codigoFavorecido: 5533,
    numeroDocumento:'HON-2026-0251', valor: 6400, valorReal: 6400, identificador:'Contrato 2026/51',
    modulo:'contrato', dataExercicio: epoch(2026,8,1), unidadeOrganizacional:{ chave:'UO2', valor:'Filial RJ' } },
  { codigoReceitaDespesa: 48318, data: epoch(2026,9,12), situacao:'PENDENTE', tipoReceitaDespesa:'RECEITA',
    planoConta:'Consultoria Tributária', nomeFavorecido:'Alvorada Alimentos S/A', codigoFavorecido: 2871,
    numeroDocumento:'CON-2026-0091', valor: 0, valorReal: 0, identificador:'Contrato 2026/12',
    modulo:'contrato', dataExercicio: epoch(2026,8,1), unidadeOrganizacional:{ chave:'UO1', valor:'Matriz SP' } }
];

var DOCS_DEMO = { 3312:'11.222.333/0001-44', 2871:'55.666.777/0001-88', 4102:'99.111.222/0001-33',
  5533:'44.555.666/0001-77', 991:'00.000.000/0001-91' };

/* Reproduz no cliente a mesma normalização de src/sync/mapper.ts, para a tela
   de demonstração mostrar a transformação de verdade — e não um desenho dela. */
function isoDe(ms) {
  if (ms == null) return undefined;
  var d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}
function normalizar(b) {
  var id = b.codigoReceitaDespesa != null ? String(b.codigoReceitaDespesa) : null;
  if (!id) return null;
  var venc = isoDe(b.data);
  if (!venc) return null;
  var valor = b.valorReal != null ? b.valorReal : b.valor;
  var natureza = String(b.tipoReceitaDespesa || '').toUpperCase();
  var planoConta = b.planoConta || '';
  var doc = b.numeroDocumento || '';
  var desc = [planoConta, doc ? 'Doc. ' + doc : ''].filter(Boolean).join(' — ') ||
             ('Lançamento Projuris ' + id);
  return {
    id: id, descricao: desc, valor: valor, dataVencimento: venc,
    dataCompetencia: isoDe(b.dataExercicio),
    tipo: natureza.indexOf('DESPES') >= 0 ? 'DESPESA' : 'RECEITA',
    status: b.situacao, clienteNome: b.nomeFavorecido || 'Cliente não identificado',
    clienteDocumento: b.codigoFavorecido ? DOCS_DEMO[b.codigoFavorecido] : undefined,
    processo: b.identificador, centroCusto: b.unidadeOrganizacional && b.unidadeOrganizacional.valor,
    categoria: planoConta, numeroDocumento: doc, bruto: b
  };
}
function descricaoCA(l) {
  var p = [l.descricao];
  if (l.processo) p.push(l.processo);
  p.push('[Projuris #' + l.id + ']');
  return p.join(' — ').slice(0, 250);
}
function bodyCA(l, pessoaId) {
  var v = Number(Number(l.valor).toFixed(2));
  var b = {
    id_pessoa: pessoaId,
    descricao: descricaoCA(l),
    data_vencimento: l.dataVencimento,
    total: v,
    negociacao: { tipo: 'A_VISTA', parcelas: [{ data_vencimento: l.dataVencimento, valor: v }] }
  };
  if (l.dataCompetencia) b.data_competencia = l.dataCompetencia;
  if (l.processo) b.observacao = 'Processo ' + l.processo;
  return b;
}
/* As mesmas regras de descarte do runner. */
function avaliar(l) {
  if (l.tipo !== 'RECEITA') return { status: 'ignorado', motivo: 'é ' + l.tipo.toLowerCase() + ' — só receita vira conta a receber' };
  if (!isFinite(l.valor)) return { status: 'ignorado', motivo: 'valor ausente ou ilegível' };
  if (l.valor < 0.01) return { status: 'ignorado', motivo: 'valor zerado, abaixo do mínimo' };
  if (!l.clienteDocumento) return { status: 'erro', motivo: 'favorecido sem CPF/CNPJ — criaria cliente duplicado no Conta Azul' };
  return { status: 'criado', motivo: '' };
}

function montarDemo() {
  var itens = [];
  for (var i = 0; i < DEMO_BRUTOS.length; i++) {
    var l = normalizar(DEMO_BRUTOS[i]);
    if (!l) continue;
    var r = avaliar(l);
    itens.push({
      lanc: l, status: r.status, motivo: r.motivo,
      payload: r.status === 'criado' ? bodyCA(l, 'ca-pes-' + DEMO_BRUTOS[i].codigoFavorecido) : null
    });
  }
  return itens;
}

/* --------------------------------------------------------------------------- */
var estado = { modo: 'demo', itens: [] };

function resumo(itens) {
  var r = { lidos: itens.length, criados: 0, ignorados: 0, erros: 0, valor: 0 };
  for (var i = 0; i < itens.length; i++) {
    var s = itens[i].status;
    if (s === 'criado') { r.criados++; r.valor += Number(itens[i].lanc.valor) || 0 }
    else if (s === 'erro') r.erros++;
    else r.ignorados++;
  }
  return r;
}

/* ---- tiles: quatro números com ícone + rótulo (cor nunca sozinha) ---- */
var ICONES = {
  criado: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  erro: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="8" cy="12" r="1.3" fill="currentColor"/></svg>',
  ignorado: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
};

function renderTiles(r) {
  var t = [
    { v: String(r.lidos), k: 'Lidos no Projuris', cls: '', ic: '' },
    { v: String(r.criados), k: 'Viram conta a receber', cls: 'criado', ic: ICONES.criado },
    { v: String(r.ignorados), k: 'Ignorados por regra', cls: 'ignorado', ic: ICONES.ignorado },
    { v: String(r.erros), k: 'Precisam de atenção', cls: 'erro', ic: ICONES.erro },
    { v: BRL0(r.valor), k: 'Valor a sincronizar', cls: '', ic: '' }
  ];
  var h = '';
  for (var i = 0; i < t.length; i++) {
    h += '<div class="tile"><div class="v">' + t[i].v + '</div><div class="k">' +
         (t[i].cls ? '<span class="st ' + t[i].cls + '">' + t[i].ic + '</span>' : '') +
         '<span>' + t[i].k + '</span></div></div>';
  }
  $('#tiles').innerHTML = h;
}

/* ---- funil: barras horizontais, rampa ordinal de um hue ---- */
function renderFunil(itens, r) {
  // cada etapa conta o que de fato sobrevive a ela; somar motivos distintos
  // num numero so faria o grafico mentir sobre onde os lancamentos param.
  var receita = 0;
  for (var q = 0; q < itens.length; q++) if (itens[q].lanc.tipo === 'RECEITA') receita++;
  var etapas = [
    { rot: 'Lidos no Projuris', n: r.lidos, cor: 'var(--ord-1)' },
    { rot: 'Do tipo receita', n: receita, cor: 'var(--ord-2)' },
    { rot: 'Passaram nas regras', n: r.criados + r.erros, cor: 'var(--ord-3)' },
    { rot: 'Criados no Conta Azul', n: r.criados, cor: 'var(--ord-4)' }
  ];
  var max = Math.max.apply(null, etapas.map(function (e) { return e.n })) || 1;
  var LB = 168, PR = 58, W = 760, BH = 22, GAP = 14, H = etapas.length * (BH + GAP);
  var s = '<svg viewBox="0 0 ' + W + ' ' + (H + 8) + '" width="100%" height="' + (H + 8) +
          '" role="img" aria-label="Funil da sincronização">';
  for (var i = 0; i < etapas.length; i++) {
    var e = etapas[i], y = i * (BH + GAP) + 4;
    var larg = Math.max(2, (e.n / max) * (W - LB - PR));
    s += '<text x="' + (LB - 12) + '" y="' + (y + BH / 2 + 4) + '" text-anchor="end" class="blabel">' +
         e.rot + '</text>';
    // 4px de canto no fim do dado, quadrado na base
    s += '<path class="mk" data-rot="' + e.rot + '" data-n="' + e.n + '" d="M' + LB + ' ' + y +
         ' H' + (LB + larg - 4) + ' a4 4 0 0 1 4 4 v' + (BH - 8) + ' a4 4 0 0 1 -4 4 H' + LB + ' Z" fill="' + e.cor + '"/>';
    s += '<rect x="' + LB + '" y="' + y + '" width="' + (W - LB) + '" height="' + BH +
         '" fill="transparent" class="hit" data-rot="' + e.rot + '" data-n="' + e.n + '"/>';
    s += '<text x="' + (LB + larg + 10) + '" y="' + (y + BH / 2 + 4) + '" class="vlabel">' + e.n + '</text>';
  }
  s += '<line x1="' + LB + '" y1="0" x2="' + LB + '" y2="' + H + '" class="axis"/></svg>';
  $('#funil').innerHTML = s;

  var nodes = $('#funil').querySelectorAll('.hit');
  for (var j = 0; j < nodes.length; j++) {
    nodes[j].addEventListener('pointermove', function (ev) {
      mostrarTip(ev, this.getAttribute('data-n') + ' lançamento(s)', this.getAttribute('data-rot'));
    });
    nodes[j].addEventListener('pointerleave', esconderTip);
  }
}

/* ---- série temporal: uma série, linha 2px + wash 10% + crosshair ---- */
function renderSerie(itens) {
  var mapa = {};
  for (var i = 0; i < itens.length; i++) {
    if (itens[i].status !== 'criado') continue;
    var m = itens[i].lanc.dataVencimento.slice(0, 7);
    mapa[m] = (mapa[m] || 0) + Number(itens[i].lanc.valor);
  }
  var chaves = Object.keys(mapa).sort();
  if (!chaves.length) {
    $('#serie').innerHTML = '<p class="cap" style="margin-top:14px">Nenhuma conta a receber criada no período.</p>';
    return;
  }
  var pts = chaves.map(function (k) { return { m: k, v: mapa[k] } });
  var bruto = Math.max.apply(null, pts.map(function (p) { return p.v }));
  // teto num numero redondo: 59.250 vira 60.000, e os ticks saem limpos
  var max = (function (v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var passos = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < passos.length; i++) {
      if (v <= passos[i] * mag) return passos[i] * mag;
    }
    return 10 * mag;
  })(bruto);
  var W = 760, H = 210, ML = 62, MR = 24, MT = 16, MB = 30;
  var pw = W - ML - MR, ph = H - MT - MB;
  var X = function (i) { return ML + (pts.length === 1 ? pw / 2 : (i / (pts.length - 1)) * pw) };
  var Y = function (v) { return MT + ph - (v / max) * ph };

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
          '" role="img" aria-label="Valor por mês de vencimento" id="svgSerie">';
  // grade + ticks arredondados
  for (var g = 0; g <= 2; g++) {
    var val = (max / 2) * g, y = Y(val);
    s += '<line x1="' + ML + '" y1="' + y + '" x2="' + (W - MR) + '" y2="' + y + '" class="gridline"/>';
    s += '<text x="' + (ML - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="tick">' + BRL0(val) + '</text>';
  }
  var dPath = '', dArea = '';
  for (var i2 = 0; i2 < pts.length; i2++) {
    dPath += (i2 ? ' L' : 'M') + X(i2) + ' ' + Y(pts[i2].v);
  }
  dArea = dPath + ' L' + X(pts.length - 1) + ' ' + (MT + ph) + ' L' + X(0) + ' ' + (MT + ph) + ' Z';
  s += '<path d="' + dArea + '" fill="var(--serie)" opacity=".10"/>';
  s += '<path d="' + dPath + '" fill="none" stroke="var(--serie)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  for (var i3 = 0; i3 < pts.length; i3++) {
    s += '<text x="' + X(i3) + '" y="' + (H - 8) + '" text-anchor="middle" class="tick">' + MES_BR(pts[i3].m) + '</text>';
  }
  // marcador só no fim: rótulo direto seletivo, nunca em todos os pontos
  var last = pts.length - 1;
  s += '<circle cx="' + X(last) + '" cy="' + Y(pts[last].v) + '" r="5" fill="var(--serie)" stroke="var(--surface)" stroke-width="2"/>';
  s += '<text x="' + (X(last) - 6) + '" y="' + (Y(pts[last].v) - 12) + '" text-anchor="end" class="vlabel">' + BRL0(pts[last].v) + '</text>';
  s += '<line id="cross" x1="0" y1="' + MT + '" x2="0" y2="' + (MT + ph) + '" class="axis" style="opacity:0"/>';
  s += '<rect id="capta" x="' + ML + '" y="' + MT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
  s += '</svg>';
  $('#serie').innerHTML = s;

  var capta = $('#capta'), cross = $('#cross'), svg = $('#svgSerie');
  capta.addEventListener('pointermove', function (ev) {
    var box = svg.getBoundingClientRect();
    var px = (ev.clientX - box.left) / box.width * W;
    var idx = 0, melhor = Infinity;
    for (var k = 0; k < pts.length; k++) {
      var d = Math.abs(X(k) - px);
      if (d < melhor) { melhor = d; idx = k }
    }
    cross.setAttribute('x1', X(idx)); cross.setAttribute('x2', X(idx));
    cross.style.opacity = '1';
    mostrarTip(ev, BRL(pts[idx].v), MES_BR(pts[idx].m), true);
  });
  capta.addEventListener('pointerleave', function () { cross.style.opacity = '0'; esconderTip() });
}

function mostrarTip(ev, valor, rotulo, comKey) {
  var t = $('#tip');
  t.textContent = '';
  var v = document.createElement('div'); v.className = 'tv';
  if (comKey) {
    var k = document.createElement('span'); k.className = 'key';
    k.style.background = 'var(--serie)'; v.appendChild(k);
  }
  v.appendChild(document.createTextNode(valor));
  var r = document.createElement('div'); r.className = 'tk';
  r.textContent = rotulo;             // rótulos são dados: textContent, nunca innerHTML
  t.appendChild(v); t.appendChild(r);
  t.style.opacity = '1';
  var x = ev.clientX + 14, y = ev.clientY - 10;
  if (x + 260 > window.innerWidth) x = ev.clientX - 274;
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function esconderTip() { $('#tip').style.opacity = '0' }

/* ---- transformação registro a registro ---- */
var ROTULO_ST = { criado: 'Criado', ignorado: 'Ignorado', erro: 'Atenção' };

function linhaKV(dl, chave, valor) {
  var dt = document.createElement('dt'); dt.textContent = chave;
  var dd = document.createElement('dd'); dd.textContent = valor == null || valor === '' ? '—' : String(valor);
  dl.appendChild(dt); dl.appendChild(dd);
}

function renderRegistros(itens) {
  var host = $('#registros');
  host.textContent = '';
  for (var i = 0; i < itens.length; i++) {
    var it = itens[i], l = it.lanc, b = l.bruto;

    var det = document.createElement('details'); det.className = 'rec';
    var sum = document.createElement('summary');

    var sid = document.createElement('span'); sid.className = 'rid';
    sid.textContent = '#' + l.id;
    var sde = document.createElement('span'); sde.className = 'rdesc';
    sde.textContent = l.descricao;
    var sst = document.createElement('span'); sst.className = 'st ' + it.status;
    sst.innerHTML = ICONES[it.status];
    sst.appendChild(document.createTextNode(' ' + ROTULO_ST[it.status]));
    var sva = document.createElement('span'); sva.className = 'rval';
    sva.textContent = BRL(l.valor);
    var chev = document.createElement('span'); chev.className = 'chev'; chev.textContent = '▸';

    sum.appendChild(chev); sum.appendChild(sid); sum.appendChild(sde);
    sum.appendChild(sst); sum.appendChild(sva);
    det.appendChild(sum);

    var flow = document.createElement('div'); flow.className = 'flow';

    // origem
    var esq = document.createElement('div'); esq.className = 'side';
    var h4a = document.createElement('h4'); h4a.textContent = 'Projuris · receita-despesa';
    esq.appendChild(h4a);
    var dlA = document.createElement('dl'); dlA.className = 'kv';
    linhaKV(dlA, 'codigoReceitaDespesa', b.codigoReceitaDespesa);
    linhaKV(dlA, 'data', b.data + '  (' + DATA_BR(l.dataVencimento) + ')');
    linhaKV(dlA, 'planoConta', b.planoConta);
    linhaKV(dlA, 'numeroDocumento', b.numeroDocumento);
    linhaKV(dlA, 'nomeFavorecido', b.nomeFavorecido || '(vazio)');
    linhaKV(dlA, 'codigoFavorecido', b.codigoFavorecido);
    linhaKV(dlA, 'valor', b.valor);
    linhaKV(dlA, 'valorReal', b.valorReal);
    linhaKV(dlA, 'tipoReceitaDespesa', b.tipoReceitaDespesa);
    linhaKV(dlA, 'identificador', b.identificador);
    esq.appendChild(dlA);

    var seta = document.createElement('div'); seta.className = 'arrowcol';
    seta.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // destino
    var dir = document.createElement('div'); dir.className = 'side';
    var h4b = document.createElement('h4');
    h4b.textContent = it.payload ? 'Conta Azul · contas-a-receber' : 'Conta Azul · nada seria enviado';
    dir.appendChild(h4b);
    if (it.payload) {
      var dlB = document.createElement('dl'); dlB.className = 'kv';
      linhaKV(dlB, 'id_pessoa', it.payload.id_pessoa);
      linhaKV(dlB, 'descricao', it.payload.descricao);
      linhaKV(dlB, 'data_vencimento', it.payload.data_vencimento);
      linhaKV(dlB, 'total', it.payload.total);
      linhaKV(dlB, 'data_competencia', it.payload.data_competencia);
      linhaKV(dlB, 'observacao', it.payload.observacao);
      linhaKV(dlB, 'negociacao.tipo', it.payload.negociacao.tipo);
      dir.appendChild(dlB);
    } else {
      var p = document.createElement('p'); p.className = 'why';
      p.textContent = it.motivo;
      dir.appendChild(p);
    }

    flow.appendChild(esq); flow.appendChild(seta); flow.appendChild(dir);

    var regra = document.createElement('div'); regra.className = 'rule';
    regra.textContent = it.status === 'criado'
      ? 'Regra: valorReal (' + b.valorReal + ') tem prioridade sobre valor (' + b.valor +
        '); a data epoch vira ' + l.dataVencimento + '; o processo entra na descrição para rastreabilidade.'
      : 'Regra: ' + it.motivo;
    flow.appendChild(regra);

    if (it.payload) {
      var dj = document.createElement('details'); dj.className = 'json';
      var sj = document.createElement('summary'); sj.textContent = 'Ver o JSON exato do POST';
      var pre = document.createElement('pre');
      pre.textContent = JSON.stringify(it.payload, null, 2);
      dj.appendChild(sj); dj.appendChild(pre);
      flow.appendChild(dj);
    }

    det.appendChild(flow);
    host.appendChild(det);
  }
}

function renderTabela(itens) {
  var tb = $('#tabela').querySelector('tbody');
  tb.textContent = '';
  for (var i = 0; i < itens.length; i++) {
    var it = itens[i], l = it.lanc;
    var tr = document.createElement('tr');
    var cel = [
      ['#' + l.id, ''], [l.descricao, ''], [l.clienteNome, ''],
      [BRL(l.valor), 'num'], [DATA_BR(l.dataVencimento), ''], [null, ''], [it.motivo || '—', '']
    ];
    for (var c = 0; c < cel.length; c++) {
      var td = document.createElement('td');
      if (cel[c][1]) td.className = cel[c][1];
      if (c === 5) {
        var sp = document.createElement('span'); sp.className = 'st ' + it.status;
        sp.innerHTML = ICONES[it.status];
        sp.appendChild(document.createTextNode(' ' + ROTULO_ST[it.status]));
        td.appendChild(sp);
      } else {
        td.textContent = cel[c][0];
      }
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
}

function pintar() {
  var r = resumo(estado.itens);
  renderTiles(r);
  renderFunil(estado.itens, r);
  renderSerie(estado.itens);
  renderRegistros(estado.itens);
  renderTabela(estado.itens);
}

/* ---- origem dos dados ---- */
function banner(texto, acao) {
  var b = $('#banner');
  b.textContent = '';
  var s = document.createElement('span'); s.textContent = texto;
  b.appendChild(s);
  if (acao) {
    var a = document.createElement('a'); a.href = acao.href;
    var bt = document.createElement('button'); bt.className = 'ghost'; bt.textContent = acao.rotulo;
    a.appendChild(bt); b.appendChild(a);
  }
}

function usarDemo() {
  estado.modo = 'demo';
  $('#mDemo').setAttribute('aria-pressed', 'true');
  $('#mReal').setAttribute('aria-pressed', 'false');
  estado.itens = montarDemo();
  banner('Dados de demonstração — nada aqui veio do Projuris nem foi enviado ao Conta Azul. ' +
         'A transformação usa as mesmas regras do código real.');
  pintar();
}

async function usarReal() {
  var chave = '';
  try { chave = localStorage.getItem(KEY) || '' } catch (e) {}
  if (!chave) {
    banner('Para ver dados reais, salve a chave da API no painel primeiro.',
           { href: '/painel', rotulo: 'Abrir o painel' });
    return;
  }
  $('#mDemo').setAttribute('aria-pressed', 'false');
  $('#mReal').setAttribute('aria-pressed', 'true');
  banner('Consultando o Projuris…');
  try {
    var r = await fetch('/sync/preview', {
      method: 'POST',
      headers: { 'x-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.erro || ('HTTP ' + r.status));

    estado.modo = 'real';
    estado.itens = (j.itens || []).map(function (i) {
      return {
        lanc: { id: i.projuris_id, descricao: i.descricao, valor: i.valor,
                dataVencimento: (i.payload && i.payload.data_vencimento) || '',
                dataCompetencia: i.payload && i.payload.data_competencia,
                clienteNome: '—', processo: '', bruto: {} },
        status: i.status === 'dry_run' ? 'criado' : i.status,
        motivo: i.motivo || '', payload: i.payload || null
      };
    });
    banner('Simulação sobre dados reais do período padrão — nada foi escrito no Conta Azul.');
    pintar();
  } catch (e) {
    banner('Não foi possível ler o Projuris: ' + e.message + ' — mostrando a demonstração.');
    estado.itens = montarDemo();
    $('#mDemo').setAttribute('aria-pressed', 'true');
    $('#mReal').setAttribute('aria-pressed', 'false');
    pintar();
  }
}

$('#mDemo').onclick = usarDemo;
$('#mReal').onclick = usarReal;
// sem listener de resize: os SVG escalam por viewBox, e repintar
// fecharia o registro que a pessoa abriu para ler.
usarDemo();
</script>
</body>
</html>`

analiseRouter.get('/', (_req, res) => res.type('html').send(HTML))
