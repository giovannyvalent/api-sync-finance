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
 *  - funil e curva ABC: rampa ordinal azul de um hue só (passa nos dois modos)
 *  - série temporal: uma série (slot 1), sem legenda — o título nomeia
 *  - status nunca é o único canal: sempre acompanha ícone e rótulo
 * Verde x vermelho como preenchimentos vizinhos foi descartado: ΔE 4.1 sob
 * deuteranopia, ou seja, indistinguíveis para parte dos leitores.
 *
 * A curva ABC é deliberadamente DOIS gráficos com um eixo cada, e não o Pareto
 * clássico de barras + linha acumulada em dois eixos Y: naquele formato o
 * alinhamento entre as duas escalas é arbitrário e o desenho sugere uma
 * relação que não está nos dados.
 *
 * Tipografia: serifada só na marca, que é chrome. Todo texto de gráfico —
 * valores, eixos, rótulos — fica no sans, com tabular-nums onde alinha.
 */
const HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Análise do Fluxo — Rubens Lopes Advocacia</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600;700&display=swap">
<style>
  :root{
    color-scheme: light;
    --plane:#f7f7f5; --surface:#ffffff; --canvas:#fbfbfa;
    --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781;
    --grid:#e1e0d9; --axis:#c3c2b7; --ring:rgba(11,11,11,.09);
    --serie:#2a78d6;
    --ord-1:#86b6ef; --ord-2:#5598e7; --ord-3:#2a78d6; --ord-4:#1c5cab;
    --abc-a:#1c5cab; --abc-b:#2a78d6; --abc-c:#86b6ef;
    --good:#0ca30c; --critical:#d03b3b;
    --chip:#f0efec;
    --serif:"Cormorant Garamond",Garamond,"Times New Roman",serif;
    --sans:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  }
  @media (prefers-color-scheme:dark){
    :root:where(:not([data-theme="light"])){
      color-scheme: dark;
      --plane:#0d0d0d; --surface:#1b1e24; --canvas:#16181d;
      --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
      --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10);
      --serie:#3987e5;
      --ord-1:#cde2fb; --ord-2:#9ec5f4; --ord-3:#6da7ec; --ord-4:#3987e5;
      --abc-a:#3987e5; --abc-b:#6da7ec; --abc-c:#cde2fb;
      --good:#0ca30c; --critical:#d03b3b;
      --chip:#252932;
    }
  }
  :root[data-theme="dark"]{
    color-scheme: dark;
    --plane:#0d0d0d; --surface:#1b1e24; --canvas:#16181d;
    --ink:#ffffff; --ink-2:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --ring:rgba(255,255,255,.10);
    --serie:#3987e5;
    --ord-1:#cde2fb; --ord-2:#9ec5f4; --ord-3:#6da7ec; --ord-4:#3987e5;
    --abc-a:#3987e5; --abc-b:#6da7ec; --abc-c:#cde2fb;
    --good:#0ca30c; --critical:#d03b3b;
    --chip:#252932;
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--plane);color:var(--ink);
    font:400 14px/1.6 var(--sans);
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  .wrap{max-width:1120px;margin:0 auto;padding:0 20px 76px}

  /* marca: serifada, centralizada */
  .marca{text-align:center;padding:46px 0 30px;border-bottom:1px solid var(--ring);
    margin-bottom:26px}
  .marca .nome{font-family:var(--serif);font-weight:500;font-size:43px;line-height:1.1;
    letter-spacing:.055em;color:var(--ink);margin:0}
  .marca .regua{width:56px;height:1px;background:var(--axis);margin:16px auto 13px}
  .marca .tag{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;
    color:var(--muted);font-weight:500}
  @media (max-width:640px){ .marca .nome{font-size:30px} }

  .barra{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px}
  h1{font-size:19px;margin:0;letter-spacing:-.015em;font-weight:600}
  .sub{color:var(--ink-2);font-size:13px}
  .flex{flex:1}

  .card{background:var(--surface);border:1px solid var(--ring);border-radius:14px;
    padding:22px 24px;margin-top:16px}
  .card > h2{font-size:15.5px;margin:0;letter-spacing:-.012em;font-weight:600}
  .card > .cap{color:var(--ink-2);font-size:12.5px;margin:3px 0 0;max-width:76ch}

  .banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    background:var(--chip);border:1px solid var(--ring);border-radius:11px;
    padding:11px 15px;margin-top:16px;font-size:12.5px;color:var(--ink-2)}

  button{background:var(--serie);color:#fff;border:0;border-radius:9px;
    padding:9px 15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  button:hover{filter:brightness(1.08)}
  button.ghost{background:transparent;color:var(--serie);border:1px solid var(--ring)}
  .seg{display:inline-flex;gap:5px;background:var(--chip);padding:4px;border-radius:11px}
  .seg button{background:transparent;color:var(--ink-2);padding:6px 14px;font-size:12.5px}
  .seg button[aria-pressed="true"]{background:var(--surface);color:var(--ink);
    box-shadow:0 1px 3px rgba(0,0,0,.09)}

  .tiles{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));
    margin-top:16px}
  .tile{background:var(--surface);border:1px solid var(--ring);border-radius:12px;padding:16px 17px}
  .tile .v{font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1.12}
  .tile .k{font-size:12px;color:var(--ink-2);margin-top:4px;display:flex;align-items:center;gap:6px}
  .ic{width:13px;height:13px;flex:none}

  svg{display:block;overflow:visible}
  .gridline{stroke:var(--grid);stroke-width:1}
  .axis{stroke:var(--axis);stroke-width:1}
  .tick{fill:var(--muted);font-size:11px;font-family:var(--sans);
    font-variant-numeric:tabular-nums}
  .vlabel{fill:var(--ink);font-size:12px;font-weight:600;font-family:var(--sans);
    font-variant-numeric:tabular-nums}
  .blabel{fill:var(--ink-2);font-size:12px;font-family:var(--sans)}
  .plabel{fill:var(--muted);font-size:11px;font-family:var(--sans);
    font-variant-numeric:tabular-nums}

  .tip{position:fixed;pointer-events:none;z-index:60;background:var(--surface);
    border:1px solid var(--ring);border-radius:10px;padding:9px 12px;
    box-shadow:0 8px 26px rgba(0,0,0,.17);font-size:12.5px;opacity:0;
    transition:opacity .1s;max-width:290px}
  .tip .tv{font-size:15px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .tip .tk{color:var(--ink-2);font-size:12px;margin-top:1px}
  .tip .key{display:inline-block;width:14px;height:2px;border-radius:1px;
    vertical-align:middle;margin-right:6px}

  .scroll{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px;min-width:600px}
  th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.055em;
    color:var(--muted);border-bottom:1px solid var(--grid);padding:9px 12px 9px 0;font-weight:600}
  td{padding:10px 12px 10px 0;border-bottom:1px solid var(--grid);vertical-align:top}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}

  .st{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;white-space:nowrap}
  .st.criado{color:var(--good)} .st.erro{color:var(--critical)} .st.ignorado{color:var(--muted)}

  /* esteira em tempo real */
  .esteira{position:relative;height:250px;background:var(--canvas);
    border:1px solid var(--ring);border-radius:12px;margin-top:16px;overflow:hidden}
  .no{position:absolute;top:50%;transform:translateY(-50%);width:152px;
    background:var(--surface);border:1px solid var(--ring);border-radius:12px;
    padding:14px 15px;z-index:3;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .no.orig{left:22px} .no.dest{right:22px}
  .no .nt{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:600}
  .no .nn{font-size:15px;font-weight:600;margin-top:3px;letter-spacing:-.01em}
  .no .nc{font-size:26px;font-weight:700;letter-spacing:-.03em;margin-top:7px;
    font-variant-numeric:tabular-nums;line-height:1.1}
  .no .ncl{font-size:11px;color:var(--muted)}
  .porta{position:absolute;left:50%;top:30px;transform:translateX(-50%);z-index:3;
    text-align:center;pointer-events:none}
  .porta .pl{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);
    font-weight:600;background:var(--canvas);padding:2px 8px}
  .pill{position:absolute;z-index:2;display:flex;align-items:center;gap:7px;
    background:var(--surface);border:1px solid var(--ring);border-radius:99px;
    padding:5px 12px 5px 9px;font-size:11.5px;white-space:nowrap;
    box-shadow:0 2px 9px rgba(0,0,0,.10);will-change:transform,opacity}
  .pill b{font-weight:600;font-variant-numeric:tabular-nums}
  .pill .pd{width:7px;height:7px;border-radius:50%;flex:none;background:var(--serie)}
  .pill.rej .pd{background:var(--muted)}
  .trilho{position:absolute;left:0;top:0;width:100%;height:100%;z-index:1}
  .cont{position:absolute;left:0;right:0;bottom:10px;text-align:center;font-size:11.5px;
    color:var(--muted);z-index:3;padding:0 14px}

  /* ABC */
  .abcw{display:grid;grid-template-columns:1.35fr 1fr;gap:26px;margin-top:16px}
  @media (max-width:900px){ .abcw{grid-template-columns:1fr} }
  .legenda{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;font-size:12px;color:var(--ink-2)}
  .legenda span{display:inline-flex;align-items:center;gap:6px}
  .sw{width:11px;height:11px;border-radius:3px;flex:none}

  .rec{border:1px solid var(--ring);border-radius:12px;margin-top:10px;background:var(--surface);
    overflow:hidden}
  .rec > summary{cursor:pointer;padding:13px 16px;display:flex;align-items:center;gap:12px;
    flex-wrap:wrap;list-style:none}
  .rec > summary::-webkit-details-marker{display:none}
  .rec > summary:hover{background:var(--chip)}
  .rec .rid{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
  .rec .rdesc{font-weight:600;font-size:13.5px}
  .rec .rval{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600}
  .rec .chev{color:var(--muted);font-size:11px}
  .rec[open] .chev{transform:rotate(90deg)}

  .flow{display:grid;grid-template-columns:1fr 44px 1fr;gap:0;
    border-top:1px solid var(--grid);padding:4px 16px 16px}
  @media (max-width:820px){ .flow{grid-template-columns:1fr} .arrowcol{display:none} }
  .side h4{font-size:10.5px;text-transform:uppercase;letter-spacing:.055em;color:var(--muted);
    margin:16px 0 8px;font-weight:600}
  .kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:12.5px}
  .kv dt{color:var(--ink-2);white-space:nowrap}
  .kv dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .arrowcol{display:flex;align-items:center;justify-content:center;color:var(--muted)}
  .rule,.flow > details.json{grid-column:1 / -1}
  .rule{font-size:12px;color:var(--ink-2);background:var(--chip);border-radius:9px;
    padding:10px 13px;margin-top:12px;border:1px solid var(--ring)}
  .why{color:var(--muted);font-size:12px;margin-top:6px}
  details.json{margin-top:12px}
  details.json summary{cursor:pointer;color:var(--ink-2);font-size:12px}
  pre{background:var(--plane);border:1px solid var(--ring);border-radius:9px;padding:12px;
    overflow-x:auto;font-size:11.5px;margin:7px 0 0;line-height:1.55;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace}

  @media (prefers-reduced-motion: reduce){
    .pill{transition:none !important}
  }
</style>
</head>
<body>
<div class="wrap">

<div class="marca">
  <p class="nome">Rubens Lopes Advocacia</p>
  <div class="regua"></div>
  <div class="tag">Automação Financeira</div>
</div>

<div class="barra">
  <div>
    <h1>Análise do Fluxo</h1>
    <div class="sub">O que sai do Projuris e o que entra no Conta Azul</div>
  </div>
  <span class="flex"></span>
  <div class="seg" role="group" aria-label="Origem dos dados">
    <button id="mDemo" aria-pressed="true">Demonstração</button>
    <button id="mReal" aria-pressed="false">Dados reais</button>
  </div>
</div>

<div class="banner" id="banner"></div>

<div class="tiles" id="tiles"></div>

<div class="card">
  <h2>Transferências em andamento</h2>
  <p class="cap">Cada cápsula é um lançamento saindo do Projuris. No meio do caminho as
    regras decidem: o que passa vira conta a receber, o que não passa cai com o motivo.</p>
  <div class="esteira" id="esteira" aria-hidden="true"></div>
  <div style="margin-top:12px"><button class="ghost" id="btnPlay" aria-pressed="true">Pausar</button></div>
  <p class="cap" style="margin-top:9px">Animação ilustrativa do mesmo conjunto exibido abaixo —
    os números para leitura estão nos cartões e na tabela.</p>
</div>

<div class="card">
  <h2>Funil da sincronização</h2>
  <p class="cap">De tudo que o Projuris devolveu, quanto chega a virar conta a receber.</p>
  <div id="funil"></div>
</div>

<div class="card">
  <h2>Curva ABC por categoria</h2>
  <p class="cap">Onde o faturamento se concentra. À esquerda o valor por plano de contas;
    à direita quanto do total já foi acumulado — dois gráficos com um eixo cada, em vez de
    sobrepor duas escalas no mesmo plano.</p>
  <div class="abcw">
    <div>
      <div id="abcBarras"></div>
      <div class="legenda" id="abcLegenda"></div>
    </div>
    <div id="abcCurva"></div>
  </div>
  <div class="scroll" style="margin-top:18px"><table id="abcTabela">
    <thead><tr><th>Categoria</th><th>Classe</th><th class="num">Faturamento</th>
      <th class="num">% do total</th><th class="num">% acumulado</th></tr></thead>
    <tbody></tbody></table></div>
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
  return Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
};
var BRL0 = function (n) {
  return Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL',
    minimumFractionDigits:0, maximumFractionDigits:0 });
};
var PCT = function (n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') + '%' };
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

function epoch(a, m, d) { return new Date(a, m - 1, d).getTime() }

/* Itens no formato real de receitaDespesaConsultaResultadoWs. */
function reg(cod, mes, dia, plano, favo, codFavo, doc, valor, valorReal, tipo, ident, uo) {
  return { codigoReceitaDespesa:cod, data:epoch(2026, mes, dia), situacao:'PENDENTE',
    tipoReceitaDespesa:tipo || 'RECEITA', planoConta:plano, nomeFavorecido:favo,
    codigoFavorecido:codFavo, numeroDocumento:doc, valor:valor,
    valorReal:valorReal == null ? valor : valorReal, identificador:ident, modulo:'processo',
    dataExercicio:epoch(2026, Math.max(1, mes - 1), 1),
    unidadeOrganizacional:{ chave:'UO', valor:uo || 'Matriz SP' } };
}

var DEMO_BRUTOS = [
  reg(48211,4,10,'Honorários Contratuais','Construtora Marcheto Ltda',3312,'HON-2026-0188',12000,null,'RECEITA','0018842-19.2025.8.26.0100'),
  reg(48219,4,22,'Honorários de Êxito','Alvorada Alimentos S/A',2871,'EXI-2026-0042',45000,47250,'RECEITA','1002311-08.2024.8.26.0011'),
  reg(48224,5,5,'Honorários Contratuais','Construtora Marcheto Ltda',3312,'HON-2026-0201',12000,null,'RECEITA','0018842-19.2025.8.26.0100'),
  reg(48240,5,18,'Custas Processuais','Tribunal de Justiça SP',991,'CUS-4471',2380.75,null,'DESPESA','0018842-19.2025.8.26.0100'),
  reg(48255,6,3,'Consultoria Tributária','Nordeste Logística ME',4102,'CON-2026-0077',8500,null,'RECEITA','Contrato 2026/44','Filial RJ'),
  reg(48261,6,14,'Honorários Contratuais','Alvorada Alimentos S/A',2871,'HON-2026-0215',18000,null,'RECEITA','1002311-08.2024.8.26.0011'),
  reg(48268,6,26,'Recuperação Judicial','Têxtil Panorama S/A',6120,'REC-2026-0007',62000,null,'RECEITA','1004488-90.2026.8.26.0100'),
  reg(48277,7,2,'Honorários Contratuais','Construtora Marcheto Ltda',3312,'HON-2026-0230',12000,null,'RECEITA','0018842-19.2025.8.26.0100'),
  reg(48281,7,9,'Direito Societário','Holding Vale Verde Ltda',7011,'SOC-2026-0031',27500,null,'RECEITA','Contrato 2026/38'),
  reg(48288,7,20,'Assessoria Trabalhista','Metalúrgica Krauss Ltda',5533,'ASS-2026-0019',6400,null,'RECEITA','Contrato 2026/51','Filial RJ'),
  reg(48294,7,28,'Recuperação Judicial','Têxtil Panorama S/A',6120,'REC-2026-0012',58000,null,'RECEITA','1004488-90.2026.8.26.0100'),
  reg(48301,8,8,'Honorários de Êxito','Nordeste Logística ME',4102,'EXI-2026-0058',31000,null,'RECEITA','0044120-77.2023.8.26.0100','Filial RJ'),
  reg(48305,8,15,'Contencioso Cível','Supermercados Bandeira S/A',8240,'CIV-2026-0064',15800,null,'RECEITA','0077310-45.2025.8.26.0100'),
  reg(48309,8,25,'Honorários Contratuais','',null,'HON-2026-0244',9000,null,'RECEITA','0091002-33.2026.8.26.0100'),
  reg(48312,9,1,'Honorários Contratuais','Metalúrgica Krauss Ltda',5533,'HON-2026-0251',6400,null,'RECEITA','Contrato 2026/51','Filial RJ'),
  reg(48316,9,8,'Compliance e LGPD','Holding Vale Verde Ltda',7011,'LGP-2026-0009',11200,null,'RECEITA','Contrato 2026/38'),
  reg(48318,9,12,'Consultoria Tributária','Alvorada Alimentos S/A',2871,'CON-2026-0091',0,null,'RECEITA','Contrato 2026/12'),
  reg(48322,9,19,'Direito Societário','Supermercados Bandeira S/A',8240,'SOC-2026-0044',19400,null,'RECEITA','Contrato 2026/61'),
  reg(48327,9,25,'Propriedade Intelectual','Editora Farol Ltda',9310,'PIN-2026-0003',7300,null,'RECEITA','Contrato 2026/70'),
  reg(48331,10,2,'Sucessões e Inventários','Família Cardoso Bueno',9455,'SUC-2026-0015',4900,null,'RECEITA','1009922-14.2026.8.26.0100')
];

var DOCS_DEMO = { 3312:'11.222.333/0001-44', 2871:'55.666.777/0001-88', 4102:'99.111.222/0001-33',
  5533:'44.555.666/0001-77', 991:'00.000.000/0001-91', 6120:'22.333.444/0001-55',
  7011:'33.444.555/0001-66', 8240:'66.777.888/0001-99', 9310:'77.888.999/0001-11',
  9455:'88.999.000/0001-22' };

/* Reproduz a normalização de src/sync/mapper.ts para a demonstração mostrar a
   transformação de verdade — e não um desenho dela. */
function isoDe(ms) {
  if (ms == null) return undefined;
  var d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' +
         String(d.getDate()).padStart(2,'0');
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
  return {
    id:id,
    descricao:[planoConta, doc ? 'Doc. ' + doc : ''].filter(Boolean).join(' — ') ||
              ('Lançamento Projuris ' + id),
    valor:valor, dataVencimento:venc, dataCompetencia:isoDe(b.dataExercicio),
    tipo:natureza.indexOf('DESPES') >= 0 ? 'DESPESA' : 'RECEITA',
    status:b.situacao, clienteNome:b.nomeFavorecido || 'Cliente não identificado',
    clienteDocumento:b.codigoFavorecido ? DOCS_DEMO[b.codigoFavorecido] : undefined,
    processo:b.identificador, centroCusto:b.unidadeOrganizacional && b.unidadeOrganizacional.valor,
    categoria:planoConta, numeroDocumento:doc, bruto:b
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
  var b = { id_pessoa:pessoaId, descricao:descricaoCA(l), data_vencimento:l.dataVencimento,
    total:v, negociacao:{ tipo:'A_VISTA', parcelas:[{ data_vencimento:l.dataVencimento, valor:v }] } };
  if (l.dataCompetencia) b.data_competencia = l.dataCompetencia;
  if (l.processo) b.observacao = 'Processo ' + l.processo;
  return b;
}
function avaliar(l) {
  if (l.tipo !== 'RECEITA') return { status:'ignorado', motivo:'é ' + l.tipo.toLowerCase() + ' — só receita vira conta a receber' };
  if (!isFinite(l.valor)) return { status:'ignorado', motivo:'valor ausente ou ilegível' };
  if (l.valor < 0.01) return { status:'ignorado', motivo:'valor zerado, abaixo do mínimo' };
  if (!l.clienteDocumento) return { status:'erro', motivo:'favorecido sem CPF/CNPJ — criaria cliente duplicado no Conta Azul' };
  return { status:'criado', motivo:'' };
}
function montarDemo() {
  var itens = [];
  for (var i = 0; i < DEMO_BRUTOS.length; i++) {
    var l = normalizar(DEMO_BRUTOS[i]);
    if (!l) continue;
    var r = avaliar(l);
    itens.push({ lanc:l, status:r.status, motivo:r.motivo,
      payload: r.status === 'criado' ? bodyCA(l, 'ca-pes-' + DEMO_BRUTOS[i].codigoFavorecido) : null });
  }
  return itens;
}

/* --------------------------------------------------------------------------- */
var estado = { modo:'demo', itens:[] };

function resumo(itens) {
  var r = { lidos:itens.length, criados:0, ignorados:0, erros:0, valor:0 };
  for (var i = 0; i < itens.length; i++) {
    var s = itens[i].status;
    if (s === 'criado') { r.criados++; r.valor += Number(itens[i].lanc.valor) || 0 }
    else if (s === 'erro') r.erros++;
    else r.ignorados++;
  }
  return r;
}

var ICONES = {
  criado:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  erro:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="8" cy="12" r="1.3" fill="currentColor"/></svg>',
  ignorado:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
};

function renderTiles(r) {
  var t = [
    { v:String(r.lidos), k:'Lidos no Projuris', cls:'', ic:'' },
    { v:String(r.criados), k:'Viram conta a receber', cls:'criado', ic:ICONES.criado },
    { v:String(r.ignorados), k:'Ignorados por regra', cls:'ignorado', ic:ICONES.ignorado },
    { v:String(r.erros), k:'Precisam de atenção', cls:'erro', ic:ICONES.erro },
    { v:BRL0(r.valor), k:'Valor a sincronizar', cls:'', ic:'' }
  ];
  var h = '';
  for (var i = 0; i < t.length; i++) {
    h += '<div class="tile"><div class="v">' + t[i].v + '</div><div class="k">' +
         (t[i].cls ? '<span class="st ' + t[i].cls + '">' + t[i].ic + '</span>' : '') +
         '<span>' + t[i].k + '</span></div></div>';
  }
  $('#tiles').innerHTML = h;
}

function ligarHit(host, fn) {
  var nodes = host.querySelectorAll('.hit');
  for (var j = 0; j < nodes.length; j++) {
    nodes[j].addEventListener('pointermove', function (ev) {
      var d = fn(this); mostrarTip(ev, d[0], d[1]);
    });
    nodes[j].addEventListener('pointerleave', esconderTip);
  }
}

/* ---- funil ---- */
function renderFunil(itens, r) {
  var receita = 0;
  for (var q = 0; q < itens.length; q++) if (itens[q].lanc.tipo === 'RECEITA') receita++;
  var etapas = [
    { rot:'Lidos no Projuris', n:r.lidos, cor:'var(--ord-1)' },
    { rot:'Do tipo receita', n:receita, cor:'var(--ord-2)' },
    { rot:'Passaram nas regras', n:r.criados + r.erros, cor:'var(--ord-3)' },
    { rot:'Criados no Conta Azul', n:r.criados, cor:'var(--ord-4)' }
  ];
  var max = Math.max.apply(null, etapas.map(function (e) { return e.n })) || 1;
  var LB = 176, PR = 58, W = 760, BH = 22, GAP = 14, H = etapas.length * (BH + GAP);
  var s = '<svg viewBox="0 0 ' + W + ' ' + (H + 8) + '" width="100%" height="' + (H + 8) +
          '" role="img" aria-label="Funil da sincronização">';
  for (var i = 0; i < etapas.length; i++) {
    var e = etapas[i], y = i * (BH + GAP) + 4;
    var larg = Math.max(2, (e.n / max) * (W - LB - PR));
    s += '<text x="' + (LB - 12) + '" y="' + (y + BH/2 + 4) + '" text-anchor="end" class="blabel">' + e.rot + '</text>';
    s += '<path d="M' + LB + ' ' + y + ' H' + (LB + larg - 4) + ' a4 4 0 0 1 4 4 v' + (BH - 8) +
         ' a4 4 0 0 1 -4 4 H' + LB + ' Z" fill="' + e.cor + '"/>';
    s += '<rect x="' + LB + '" y="' + y + '" width="' + (W - LB) + '" height="' + BH +
         '" fill="transparent" class="hit" data-rot="' + e.rot + '" data-n="' + e.n + '"/>';
    s += '<text x="' + (LB + larg + 10) + '" y="' + (y + BH/2 + 4) + '" class="vlabel">' + e.n + '</text>';
  }
  s += '<line x1="' + LB + '" y1="0" x2="' + LB + '" y2="' + H + '" class="axis"/></svg>';
  $('#funil').innerHTML = s;
  ligarHit($('#funil'), function (el) {
    return [el.getAttribute('data-n') + ' lançamento(s)', el.getAttribute('data-rot')];
  });
}

/* ---- curva ABC ---- */
function calcularABC(itens) {
  var mapa = {};
  for (var i = 0; i < itens.length; i++) {
    var l = itens[i].lanc;
    if (l.tipo !== 'RECEITA') continue;
    var v = Number(l.valor) || 0;
    if (v <= 0) continue;
    var c = l.categoria || 'Sem categoria';
    mapa[c] = (mapa[c] || 0) + v;
  }
  var lista = Object.keys(mapa).map(function (k) { return { cat:k, valor:mapa[k] } });
  lista.sort(function (a, b) { return b.valor - a.valor });
  var total = lista.reduce(function (s, x) { return s + x.valor }, 0) || 1;
  var acum = 0;
  for (var j = 0; j < lista.length; j++) {
    lista[j].pct = lista[j].valor / total * 100;
    acum += lista[j].pct;
    lista[j].acum = acum;
    lista[j].classe = acum <= 80.0001 ? 'A' : acum <= 95.0001 ? 'B' : 'C';
  }
  return { lista:lista, total:total };
}
var COR_ABC = { A:'var(--abc-a)', B:'var(--abc-b)', C:'var(--abc-c)' };

function renderABC(itens) {
  var r = calcularABC(itens);
  var L = r.lista;
  if (!L.length) {
    $('#abcBarras').innerHTML = '<p class="cap" style="margin-top:14px">Sem faturamento no período.</p>';
    $('#abcCurva').innerHTML = ''; $('#abcLegenda').innerHTML = '';
    $('#abcTabela').querySelector('tbody').textContent = '';
    return;
  }

  var LB = 184, PR = 100, W = 640, BH = 20, GAP = 11, H = L.length * (BH + GAP);
  var max = L[0].valor;
  var s = '<svg viewBox="0 0 ' + W + ' ' + (H + 6) + '" width="100%" height="' + (H + 6) +
          '" role="img" aria-label="Faturamento por categoria">';
  for (var i = 0; i < L.length; i++) {
    var y = i * (BH + GAP) + 3, larg = Math.max(2, (L[i].valor / max) * (W - LB - PR));
    var rot = L[i].cat.length > 26 ? L[i].cat.slice(0, 25) + '…' : L[i].cat;
    s += '<text x="' + (LB - 11) + '" y="' + (y + BH/2 + 4) + '" text-anchor="end" class="blabel">' + rot + '</text>';
    s += '<path d="M' + LB + ' ' + y + ' H' + (LB + larg - 4) + ' a4 4 0 0 1 4 4 v' + (BH - 8) +
         ' a4 4 0 0 1 -4 4 H' + LB + ' Z" fill="' + COR_ABC[L[i].classe] + '"/>';
    s += '<rect x="' + LB + '" y="' + y + '" width="' + (W - LB) + '" height="' + BH +
         '" fill="transparent" class="hit" data-c="' + i + '"/>';
    s += '<text x="' + (LB + larg + 9) + '" y="' + (y + BH/2 + 4) + '" class="vlabel">' + BRL0(L[i].valor) + '</text>';
  }
  s += '<line x1="' + LB + '" y1="0" x2="' + LB + '" y2="' + H + '" class="axis"/></svg>';
  $('#abcBarras').innerHTML = s;
  ligarHit($('#abcBarras'), function (el) {
    var d = L[Number(el.getAttribute('data-c'))];
    return [BRL(d.valor), d.cat + ' · classe ' + d.classe + ' · ' + PCT(d.pct) + ' do total'];
  });

  var W2 = 380, H2 = 252, ML = 46, MR = 18, MT = 14, MB = 36;
  var pw = W2 - ML - MR, ph = H2 - MT - MB;
  var X = function (i) { return ML + (L.length === 1 ? pw : (i / (L.length - 1)) * pw) };
  var Y = function (p) { return MT + ph - (p / 100) * ph };
  var c = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" width="100%" height="' + H2 +
          '" role="img" aria-label="Percentual acumulado do faturamento">';
  [0, 50, 100].forEach(function (g) {
    c += '<line x1="' + ML + '" y1="' + Y(g) + '" x2="' + (W2 - MR) + '" y2="' + Y(g) + '" class="gridline"/>';
    c += '<text x="' + (ML - 9) + '" y="' + (Y(g) + 4) + '" text-anchor="end" class="tick">' + g + '%</text>';
  });
  c += '<line x1="' + ML + '" y1="' + Y(80) + '" x2="' + (W2 - MR) + '" y2="' + Y(80) +
       '" stroke="var(--axis)" stroke-width="1"/>';
  c += '<text x="' + (W2 - MR) + '" y="' + (Y(80) - 6) + '" text-anchor="end" class="plabel">corte A · 80%</text>';
  var d = '';
  for (var k = 0; k < L.length; k++) d += (k ? ' L' : 'M') + X(k) + ' ' + Y(L[k].acum);
  c += '<path d="' + d + ' L' + X(L.length-1) + ' ' + (MT+ph) + ' L' + X(0) + ' ' + (MT+ph) +
       ' Z" fill="var(--serie)" opacity=".10"/>';
  c += '<path d="' + d + '" fill="none" stroke="var(--serie)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  for (var k2 = 0; k2 < L.length; k2++) {
    c += '<circle cx="' + X(k2) + '" cy="' + Y(L[k2].acum) + '" r="3.5" fill="var(--serie)" stroke="var(--surface)" stroke-width="2"/>';
    c += '<rect x="' + (X(k2)-13) + '" y="' + MT + '" width="26" height="' + ph +
         '" fill="transparent" class="hit" data-c="' + k2 + '"/>';
  }
  c += '<text x="' + ML + '" y="' + (H2 - 13) + '" class="tick">1ª</text>';
  c += '<text x="' + (W2 - MR) + '" y="' + (H2 - 13) + '" text-anchor="end" class="tick">' + L.length + 'ª categoria</text>';
  c += '<line x1="' + ML + '" y1="' + (MT+ph) + '" x2="' + (W2-MR) + '" y2="' + (MT+ph) + '" class="axis"/></svg>';
  $('#abcCurva').innerHTML = c;
  ligarHit($('#abcCurva'), function (el) {
    var x = L[Number(el.getAttribute('data-c'))];
    return [PCT(x.acum) + ' acumulado', 'somando até ' + x.cat];
  });

  var cont = { A:0, B:0, C:0 };
  L.forEach(function (x) { cont[x.classe]++ });
  var leg = '';
  ['A','B','C'].forEach(function (cl) {
    if (!cont[cl]) return;
    var txt = cl === 'A' ? 'até 80% do faturamento' : cl === 'B' ? 'de 80% a 95%' : 'os 5% finais';
    leg += '<span><i class="sw" style="background:' + COR_ABC[cl] + '"></i>Classe ' + cl +
           ' — ' + txt + ' (' + cont[cl] + ')</span>';
  });
  $('#abcLegenda').innerHTML = leg;

  var tb = $('#abcTabela').querySelector('tbody');
  tb.textContent = '';
  L.forEach(function (x) {
    var tr = document.createElement('tr');
    [[x.cat,''],['Classe ' + x.classe,''],[BRL(x.valor),'num'],[PCT(x.pct),'num'],[PCT(x.acum),'num']]
      .forEach(function (cel) {
        var td = document.createElement('td');
        if (cel[1]) td.className = cel[1];
        td.textContent = cel[0];
        tr.appendChild(td);
      });
    tb.appendChild(tr);
  });
}

/* ---- série temporal ---- */
function renderSerie(itens) {
  var mapa = {};
  for (var i = 0; i < itens.length; i++) {
    if (itens[i].status !== 'criado') continue;
    var m = String(itens[i].lanc.dataVencimento || '').slice(0, 7);
    if (!m) continue;
    mapa[m] = (mapa[m] || 0) + Number(itens[i].lanc.valor);
  }
  var chaves = Object.keys(mapa).sort();
  if (!chaves.length) {
    $('#serie').innerHTML = '<p class="cap" style="margin-top:14px">Nenhuma conta a receber criada no período.</p>';
    return;
  }
  var pts = chaves.map(function (k) { return { m:k, v:mapa[k] } });
  var bruto = Math.max.apply(null, pts.map(function (p) { return p.v }));
  var max = (function (v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var passos = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < passos.length; i++) if (v <= passos[i] * mag) return passos[i] * mag;
    return 10 * mag;
  })(bruto);

  var W = 760, H = 214, ML = 66, MR = 26, MT = 16, MB = 30;
  var pw = W - ML - MR, ph = H - MT - MB;
  var X = function (i) { return ML + (pts.length === 1 ? pw/2 : (i/(pts.length-1)) * pw) };
  var Y = function (v) { return MT + ph - (v/max) * ph };
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
          '" role="img" aria-label="Valor por mês de vencimento" id="svgSerie">';
  for (var g = 0; g <= 2; g++) {
    var val = (max/2) * g, y = Y(val);
    s += '<line x1="' + ML + '" y1="' + y + '" x2="' + (W-MR) + '" y2="' + y + '" class="gridline"/>';
    s += '<text x="' + (ML-10) + '" y="' + (y+4) + '" text-anchor="end" class="tick">' + BRL0(val) + '</text>';
  }
  var dPath = '';
  for (var i2 = 0; i2 < pts.length; i2++) dPath += (i2 ? ' L' : 'M') + X(i2) + ' ' + Y(pts[i2].v);
  s += '<path d="' + dPath + ' L' + X(pts.length-1) + ' ' + (MT+ph) + ' L' + X(0) + ' ' + (MT+ph) +
       ' Z" fill="var(--serie)" opacity=".10"/>';
  s += '<path d="' + dPath + '" fill="none" stroke="var(--serie)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  for (var i3 = 0; i3 < pts.length; i3++) {
    s += '<text x="' + X(i3) + '" y="' + (H-8) + '" text-anchor="middle" class="tick">' + MES_BR(pts[i3].m) + '</text>';
  }
  var last = pts.length - 1;
  s += '<circle cx="' + X(last) + '" cy="' + Y(pts[last].v) + '" r="5" fill="var(--serie)" stroke="var(--surface)" stroke-width="2"/>';
  s += '<text x="' + (X(last)-6) + '" y="' + (Y(pts[last].v)-12) + '" text-anchor="end" class="vlabel">' + BRL0(pts[last].v) + '</text>';
  s += '<line id="cross" x1="0" y1="' + MT + '" x2="0" y2="' + (MT+ph) + '" class="axis" style="opacity:0"/>';
  s += '<rect id="capta" x="' + ML + '" y="' + MT + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
  s += '</svg>';
  $('#serie').innerHTML = s;

  var capta = $('#capta'), cross = $('#cross'), svg = $('#svgSerie');
  capta.addEventListener('pointermove', function (ev) {
    var box = svg.getBoundingClientRect();
    var px = (ev.clientX - box.left) / box.width * W;
    var idx = 0, melhor = Infinity;
    for (var k = 0; k < pts.length; k++) {
      var dd = Math.abs(X(k) - px);
      if (dd < melhor) { melhor = dd; idx = k }
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
  if (x + 300 > window.innerWidth) x = ev.clientX - 310;
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
function esconderTip() { $('#tip').style.opacity = '0' }

/* ---- esteira: cápsulas viajando do Projuris ao Conta Azul ---- */
var FAIXAS = [-48, -16, 16, 48];
var esteira = { timer:null, i:0, pista:0, entregues:0, saidas:0, rodando:false, pills:[] };

function montarEsteira() {
  $('#esteira').innerHTML =
    '<svg class="trilho" viewBox="0 0 900 250" preserveAspectRatio="none" aria-hidden="true">' +
      // uma faixa por pista: capsulas simultaneas nao podem se sobrepor
      FAIXAS.map(function (dy) {
        return '<line x1="180" y1="' + (125 + dy) + '" x2="720" y2="' + (125 + dy) +
               '" stroke="var(--grid)" stroke-width="1" stroke-dasharray="3 7"/>';
      }).join('') +
      '<line x1="450" y1="58" x2="450" y2="192" stroke="var(--axis)" stroke-width="1" stroke-dasharray="2 5"/>' +
    '</svg>' +
    '<div class="no orig"><div class="nt">Origem</div><div class="nn">Projuris</div>' +
      '<div class="nc" id="cSai">0</div><div class="ncl">enviados</div></div>' +
    '<div class="porta"><div class="pl">regras</div></div>' +
    '<div class="no dest"><div class="nt">Destino</div><div class="nn">Conta Azul</div>' +
      '<div class="nc" id="cChega">0</div><div class="ncl">contas criadas</div></div>' +
    '<div class="cont" id="cLegenda"></div>';
}

function soltarPill(item) {
  var host = $('#esteira');
  var box = host.getBoundingClientRect();
  if (!box.width) return;
  var xIni = 180, xPorta = box.width / 2 - 34, xFim = box.width - 232;
  var passa = item.status === 'criado';
  var dy = FAIXAS[esteira.pista % FAIXAS.length];
  esteira.pista++;
  var mov = function (x, extraY) {
    return 'translate(' + x + 'px, calc(-50% + ' + (dy + (extraY || 0)) + 'px))';
  };

  var p = document.createElement('div');
  p.className = 'pill' + (passa ? '' : ' rej');
  var d = document.createElement('span'); d.className = 'pd';
  var b = document.createElement('b'); b.textContent = BRL0(item.lanc.valor);
  var s = document.createElement('span');
  s.style.color = 'var(--muted)'; s.textContent = '#' + item.lanc.id;
  p.appendChild(d); p.appendChild(b); p.appendChild(s);
  p.style.left = '0px'; p.style.top = '50%';
  p.style.transform = mov(xIni);
  p.style.opacity = '0';
  host.appendChild(p);
  esteira.pills.push(p);

  requestAnimationFrame(function () {
    p.style.transition = 'transform 1.15s cubic-bezier(.4,0,.2,1), opacity .3s';
    p.style.transform = mov(xPorta);
    p.style.opacity = '1';
    esteira.saidas++;
    var cs = $('#cSai'); if (cs) cs.textContent = String(esteira.saidas);
  });

  setTimeout(function () {
    if (!p.isConnected) return;
    if (passa) {
      p.style.transition = 'transform 1.15s cubic-bezier(.4,0,.2,1), opacity .45s .5s';
      p.style.transform = mov(xFim);
      p.style.opacity = '0';
      setTimeout(function () {
        esteira.entregues++;
        var cc = $('#cChega'); if (cc) cc.textContent = String(esteira.entregues);
      }, 1050);
    } else {
      p.style.transition = 'transform .9s cubic-bezier(.5,0,.75,0), opacity .9s';
      p.style.transform = mov(xPorta, 150);
      p.style.opacity = '0';
      var lg = $('#cLegenda');
      if (lg) lg.textContent = '#' + item.lanc.id + ' não passou — ' + item.motivo;
    }
    setTimeout(function () {
      p.remove();
      var k = esteira.pills.indexOf(p);
      if (k >= 0) esteira.pills.splice(k, 1);
    }, 2400);
  }, 1200);
}

function tocarEsteira() {
  if (esteira.timer) clearInterval(esteira.timer);
  if (!estado.itens.length) return;
  esteira.rodando = true;
  esteira.timer = setInterval(function () {
    soltarPill(estado.itens[esteira.i % estado.itens.length]);
    esteira.i++;
  }, 900);
}
function pararEsteira() {
  esteira.rodando = false;
  if (esteira.timer) { clearInterval(esteira.timer); esteira.timer = null }
}
function reiniciarEsteira() {
  pararEsteira();
  esteira.i = 0; esteira.pista = 0; esteira.entregues = 0; esteira.saidas = 0;
  for (var i = 0; i < esteira.pills.length; i++) esteira.pills[i].remove();
  esteira.pills = [];
  montarEsteira();
  var b = $('#btnPlay');
  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduz) {
    // quem pediu menos movimento não recebe animação em laço
    b.textContent = 'Reproduzir';
    b.setAttribute('aria-pressed', 'false');
    $('#cLegenda').textContent = 'Animação desligada porque o sistema pede menos movimento.';
    return;
  }
  b.textContent = 'Pausar';
  b.setAttribute('aria-pressed', 'true');
  tocarEsteira();
}
$('#btnPlay').onclick = function () {
  if (esteira.rodando) {
    pararEsteira();
    this.textContent = 'Reproduzir';
    this.setAttribute('aria-pressed', 'false');
  } else {
    tocarEsteira();
    this.textContent = 'Pausar';
    this.setAttribute('aria-pressed', 'true');
  }
};

/* ---- transformação registro a registro ---- */
var ROTULO_ST = { criado:'Criado', ignorado:'Ignorado', erro:'Atenção' };

function linhaKV(dl, chave, valor) {
  var dt = document.createElement('dt'); dt.textContent = chave;
  var dd = document.createElement('dd');
  dd.textContent = valor == null || valor === '' ? '—' : String(valor);
  dl.appendChild(dt); dl.appendChild(dd);
}

function renderRegistros(itens) {
  var host = $('#registros');
  host.textContent = '';
  for (var i = 0; i < itens.length; i++) {
    var it = itens[i], l = it.lanc, b = l.bruto || {};

    var det = document.createElement('details'); det.className = 'rec';
    var sum = document.createElement('summary');
    var chev = document.createElement('span'); chev.className = 'chev'; chev.textContent = '▸';
    var sid = document.createElement('span'); sid.className = 'rid'; sid.textContent = '#' + l.id;
    var sde = document.createElement('span'); sde.className = 'rdesc'; sde.textContent = l.descricao;
    var sst = document.createElement('span'); sst.className = 'st ' + it.status;
    sst.innerHTML = ICONES[it.status];
    sst.appendChild(document.createTextNode(' ' + ROTULO_ST[it.status]));
    var sva = document.createElement('span'); sva.className = 'rval'; sva.textContent = BRL(l.valor);
    sum.appendChild(chev); sum.appendChild(sid); sum.appendChild(sde);
    sum.appendChild(sst); sum.appendChild(sva);
    det.appendChild(sum);

    var flow = document.createElement('div'); flow.className = 'flow';

    var esq = document.createElement('div'); esq.className = 'side';
    var h4a = document.createElement('h4'); h4a.textContent = 'Projuris · receita-despesa';
    esq.appendChild(h4a);
    var dlA = document.createElement('dl'); dlA.className = 'kv';
    linhaKV(dlA, 'codigoReceitaDespesa', b.codigoReceitaDespesa);
    linhaKV(dlA, 'data', b.data != null ? b.data + '  (' + DATA_BR(l.dataVencimento) + ')' : '');
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
      linhaKV(dlB, 'negociacao.tipo', it.payload.negociacao && it.payload.negociacao.tipo);
      dir.appendChild(dlB);
    } else {
      var pw2 = document.createElement('p'); pw2.className = 'why';
      pw2.textContent = it.motivo; dir.appendChild(pw2);
    }

    flow.appendChild(esq); flow.appendChild(seta); flow.appendChild(dir);

    var regra = document.createElement('div'); regra.className = 'rule';
    regra.textContent = it.status === 'criado' && b.valorReal != null
      ? 'Regra: valorReal (' + b.valorReal + ') tem prioridade sobre valor (' + b.valor +
        '); a data epoch vira ' + l.dataVencimento + '; o processo entra na descrição para rastreabilidade.'
      : 'Regra: ' + (it.motivo || 'lançamento aprovado pelas regras de envio.');
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
    var cel = [['#' + l.id,''],[l.descricao,''],[l.clienteNome,''],
      [BRL(l.valor),'num'],[DATA_BR(l.dataVencimento),''],[null,''],[it.motivo || '—','']];
    for (var c = 0; c < cel.length; c++) {
      var td = document.createElement('td');
      if (cel[c][1]) td.className = cel[c][1];
      if (c === 5) {
        var sp = document.createElement('span'); sp.className = 'st ' + it.status;
        sp.innerHTML = ICONES[it.status];
        sp.appendChild(document.createTextNode(' ' + ROTULO_ST[it.status]));
        td.appendChild(sp);
      } else td.textContent = cel[c][0];
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
}

function pintar() {
  var r = resumo(estado.itens);
  renderTiles(r);
  renderFunil(estado.itens, r);
  renderABC(estado.itens);
  renderSerie(estado.itens);
  renderRegistros(estado.itens);
  renderTabela(estado.itens);
  reiniciarEsteira();
}

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
           { href:'/painel', rotulo:'Abrir o painel' });
    return;
  }
  $('#mDemo').setAttribute('aria-pressed', 'false');
  $('#mReal').setAttribute('aria-pressed', 'true');
  banner('Consultando o Projuris…');
  try {
    var r = await fetch('/sync/preview', {
      method:'POST', headers:{ 'x-api-key':chave, 'Content-Type':'application/json' },
      body:JSON.stringify({})
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.erro || ('HTTP ' + r.status));
    estado.modo = 'real';
    estado.itens = (j.itens || []).map(function (i) {
      return {
        lanc:{ id:i.projuris_id, descricao:i.descricao, valor:i.valor,
               dataVencimento:(i.payload && i.payload.data_vencimento) || '',
               dataCompetencia:i.payload && i.payload.data_competencia,
               clienteNome:'—', processo:'',
               categoria:String(i.descricao || '').split(' — ')[0] || 'Sem categoria',
               tipo:'RECEITA', bruto:{} },
        status:i.status === 'dry_run' ? 'criado' : i.status,
        motivo:i.motivo || '', payload:i.payload || null
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
// sem listener de resize: os SVG escalam por viewBox, e repintar fecharia o
// registro que a pessoa abriu para ler.
usarDemo();
</script>
</body>
</html>`

analiseRouter.get('/', (_req, res) => res.type('html').send(HTML))
