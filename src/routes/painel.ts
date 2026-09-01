import { Router } from 'express'

export const painelRouter = Router()

/**
 * Painel operacional, servido pelo próprio Express.
 * Um front separado exigiria segundo deploy, CORS e outra autenticação — para
 * uma tela interna de operação isso é custo sem retorno.
 *
 * O HTML mora aqui como template string de propósito: leitura de arquivo em
 * runtime é frágil no empacotamento serverless da Vercel.
 *
 * A página em si é pública (não carrega segredo nenhum). Toda chamada de dados
 * manda a SYNC_API_KEY, que o operador digita uma vez e fica no localStorage.
 */
const HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Automatizar Financeiro — Projuris para Conta Azul</title>
<style>
  :root{
    --bg:#f6f7f9; --card:#fff; --txt:#16191d; --dim:#666e7a; --line:#e3e6ea;
    --accent:#2f6df6; --ok:#1a7f4b; --warn:#9a6400; --err:#c02626;
    --okbg:#e8f6ee; --warnbg:#fdf3e0; --errbg:#fdeaea; --chip:#eef1f5;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --bg:#14161a; --card:#1b1e24; --txt:#e8eaed; --dim:#9aa3af; --line:#2b3038;
      --accent:#6f9bff; --ok:#4ec98a; --warn:#e0ab4a; --err:#f0736f;
      --okbg:#16301f; --warnbg:#332812; --errbg:#3a1c1c; --chip:#252932;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:1100px;margin:0 auto;padding:24px 20px 60px}
  header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:4px}
  h1{font-size:20px;margin:0;letter-spacing:-.01em}
  .sub{color:var(--dim);font-size:13px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:10px;
    padding:16px 18px;margin-top:16px}
  .card h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;
    color:var(--dim);margin:0 0 12px;font-weight:600}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
  label{display:block;font-size:12px;color:var(--dim);margin-bottom:4px}
  input,select{background:var(--bg);color:var(--txt);border:1px solid var(--line);
    border-radius:7px;padding:8px 10px;font-size:14px;font-family:inherit}
  input[type=date]{min-width:150px}
  button{background:var(--accent);color:#fff;border:0;border-radius:7px;
    padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
  button:hover{filter:brightness(1.08)} button:disabled{opacity:.5;cursor:not-allowed}
  button.ghost{background:transparent;color:var(--accent);border:1px solid var(--line)}
  a{text-decoration:none}
  .pill{display:inline-flex;align-items:center;gap:6px;border-radius:99px;
    padding:3px 11px;font-size:12px;font-weight:600;background:var(--chip);color:var(--dim)}
  .pill.ok{background:var(--okbg);color:var(--ok)}
  .pill.warn{background:var(--warnbg);color:var(--warn)}
  .pill.err{background:var(--errbg);color:var(--err)}
  .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
  .stat{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
  .stat .n{font-size:24px;font-weight:700;letter-spacing:-.02em}
  .stat .l{font-size:12px;color:var(--dim);margin-top:2px}
  .scroll{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px;min-width:620px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;
    color:var(--dim);border-bottom:1px solid var(--line);padding:8px 10px 8px 0;font-weight:600}
  td{padding:9px 10px 9px 0;border-bottom:1px solid var(--line);vertical-align:top}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .muted{color:var(--dim)}
  .msg{padding:10px 12px;border-radius:7px;font-size:13px;margin-top:12px;display:none}
  .msg.show{display:block}
  .msg.e{background:var(--errbg);color:var(--err)}
  .msg.i{background:var(--okbg);color:var(--ok)}
  .bars{display:flex;align-items:flex-end;gap:6px;height:120px;margin-top:8px}
  .bars div{flex:1;background:var(--accent);border-radius:3px 3px 0 0;min-height:2px;opacity:.85}
  .barlbl{display:flex;gap:6px;margin-top:6px}
  .barlbl span{flex:1;font-size:10px;color:var(--dim);text-align:center;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  code{background:var(--chip);padding:1px 5px;border-radius:4px;font-size:12px}
  details{margin-top:8px} summary{cursor:pointer;color:var(--dim);font-size:12px}
  pre{background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:10px;
    overflow-x:auto;font-size:11px;margin:6px 0 0}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Automatizar Financeiro</h1>
  <span class="sub">Projuris para Conta Azul</span>
  <span style="flex:1"></span>
  <span id="statusPills"></span>
</header>

<div class="card">
  <h2>Acesso</h2>
  <div class="row">
    <div style="flex:1;min-width:220px">
      <label for="key">Chave da API (SYNC_API_KEY)</label>
      <input id="key" type="password" placeholder="cole a chave" style="width:100%">
    </div>
    <button id="btnKey">Salvar</button>
    <button class="ghost" id="btnLimpar">Esquecer</button>
  </div>
  <div class="msg" id="msgKey"></div>
</div>

<div class="card">
  <h2>Situacao da integracao</h2>
  <div id="saude" class="muted">carregando...</div>
  <div class="row" style="margin-top:12px">
    <a href="/oauth/contaazul/start"><button class="ghost">Autorizar Conta Azul</button></a>
    <button class="ghost" id="btnRefs">Ver contas e categorias</button>
    <button class="ghost" id="btnSaude">Atualizar</button>
  </div>
  <details id="detRefs" hidden><summary>Resposta</summary><pre id="preRefs"></pre></details>
</div>

<div class="card">
  <h2>Executar sincronizacao</h2>
  <div class="row">
    <div><label for="ini">De (vencimento)</label><input id="ini" type="date"></div>
    <div><label for="fim">Ate</label><input id="fim" type="date"></div>
    <div>
      <label for="modo">Modo</label>
      <select id="modo">
        <option value="preview">Simular (nao escreve)</option>
        <option value="run">Executar de verdade</option>
      </select>
    </div>
    <button id="btnSync">Rodar</button>
  </div>
  <div class="msg" id="msgSync"></div>
  <div id="resumoSync" class="grid" style="margin-top:14px"></div>
  <div class="scroll"><table id="tblSync" hidden>
    <thead><tr><th>Projuris</th><th>Descricao</th><th class="num">Valor</th>
      <th>Situacao</th><th>Motivo</th></tr></thead><tbody></tbody></table></div>
</div>

<div class="card">
  <h2>Analytics</h2>
  <div class="row" style="margin-bottom:12px">
    <div><label for="aIni">De</label><input id="aIni" type="date"></div>
    <div><label for="aFim">Ate</label><input id="aFim" type="date"></div>
    <button class="ghost" id="btnAnalytics">Atualizar</button>
  </div>
  <div id="aResumo" class="grid"></div>
  <div id="aMes" style="margin-top:18px"></div>
  <div class="scroll" style="margin-top:18px"><table id="tblCli" hidden>
    <thead><tr><th>Cliente</th><th>Documento</th><th class="num">Lancamentos</th>
      <th class="num">Valor</th></tr></thead><tbody></tbody></table></div>
</div>

<div class="card">
  <h2>Execucoes e erros</h2>
  <button class="ghost" id="btnExec">Atualizar</button>
  <div class="scroll" style="margin-top:12px"><table id="tblExec" hidden>
    <thead><tr><th>Quando</th><th>Origem</th><th>Periodo</th><th class="num">Lidos</th>
      <th class="num">Criados</th><th class="num">Erros</th><th class="num">Duracao</th>
      </tr></thead><tbody></tbody></table></div>
  <div id="errosAbertos" style="margin-top:16px"></div>
</div>

</div>
<script>
var $ = function(s){ return document.querySelector(s) };
var KEY = 'sync_api_key';
var apiKey = '';
try { apiKey = localStorage.getItem(KEY) || '' } catch (e) { apiKey = '' }
if (apiKey) $('#key').value = apiKey;

function brl(n){
  if (n === null || n === undefined || isNaN(Number(n))) return '--';
  return Number(n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
function esc(s){
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}
function hoje(){ return new Date().toISOString().slice(0,10) }
function diasAtras(d){ return new Date(Date.now() - d*864e5).toISOString().slice(0,10) }

function msg(sel, texto, tipo){
  var e = $(sel);
  e.textContent = texto || '';
  e.className = texto ? ('msg show ' + (tipo === 'e' ? 'e' : 'i')) : 'msg';
}

async function api(path, opts){
  opts = opts || {};
  if (!apiKey) throw new Error('Informe a chave da API primeiro.');
  var headers = { 'x-api-key': apiKey };
  if (opts.body) headers['Content-Type'] = 'application/json';
  var r = await fetch(path, { method: opts.method || 'GET', body: opts.body, headers: headers });
  var t = await r.text();
  var j = null;
  if (t) { try { j = JSON.parse(t) } catch (e) { throw new Error('Resposta invalida: ' + t.slice(0,200)) } }
  if (!r.ok) throw new Error((j && j.erro) || ('HTTP ' + r.status));
  return j;
}

$('#btnKey').onclick = function(){
  apiKey = $('#key').value.trim();
  try { localStorage.setItem(KEY, apiKey) } catch (e) {}
  msg('#msgKey', 'Chave salva neste navegador.', 'i');
  carregarSaude(); carregarAnalytics(); carregarExec();
};
$('#btnLimpar').onclick = function(){
  apiKey = '';
  try { localStorage.removeItem(KEY) } catch (e) {}
  $('#key').value = '';
  msg('#msgKey', 'Chave removida deste navegador.', 'i');
};

async function carregarSaude(){
  try {
    var r = await fetch('/health');
    var h = await r.json();
    var pills = [];
    pills.push(h.ok
      ? '<span class="pill ok">config ok</span>'
      : '<span class="pill err">' + h.env_faltando.length + ' env faltando</span>');
    var ca = h.contaazul || {};
    if (ca.autorizado) {
      pills.push(ca.risco_expiracao_refresh
        ? '<span class="pill warn">token: renovar</span>'
        : '<span class="pill ok">Conta Azul ok</span>');
    } else {
      pills.push('<span class="pill err">Conta Azul nao autorizado</span>');
    }
    if (h.dry_run_global) pills.push('<span class="pill warn">modo simulacao</span>');
    $('#statusPills').innerHTML = pills.join(' ');

    var txt = '';
    if (!h.ok) txt += '<div>Faltando: <code>' + h.env_faltando.join('</code> <code>') + '</code></div>';
    if (ca.autorizado) {
      txt += '<div>Token do Conta Azul renovado ha <b>' + ca.dias_desde_ultima_renovacao +
             ' dia(s)</b>. O refresh_token vence com 14 dias sem uso.</div>';
    } else {
      txt += '<div>Conta Azul ainda nao autorizado - use o botao abaixo.</div>';
    }
    txt += '<div class="muted" style="margin-top:6px">Endpoint Projuris: <code>' +
           esc(h.projuris_lancamentos_path) + '</code></div>';
    $('#saude').innerHTML = txt;
  } catch (e) {
    $('#saude').innerHTML = '<span class="pill err">' + esc(e.message) + '</span>';
  }
}
$('#btnSaude').onclick = carregarSaude;

$('#btnRefs').onclick = async function(){
  try {
    var r = await api('/sync/contaazul-refs');
    $('#detRefs').hidden = false;
    $('#detRefs').open = true;
    $('#preRefs').textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    $('#detRefs').hidden = false;
    $('#detRefs').open = true;
    $('#preRefs').textContent = e.message;
  }
};

$('#btnSync').onclick = async function(){
  var b = $('#btnSync');
  b.disabled = true; b.textContent = 'Rodando...';
  msg('#msgSync', '');
  try {
    var rota = $('#modo').value === 'run' ? '/sync/run' : '/sync/preview';
    var r = await api(rota, { method:'POST', body: JSON.stringify({
      inicio: $('#ini').value || undefined,
      fim: $('#fim').value || undefined
    })});

    var stats = [['Lidos', r.total_lidos], ['Criados', r.total_criados],
                 ['Ignorados', r.total_ignorados], ['Erros', r.total_erros]];
    $('#resumoSync').innerHTML = stats.map(function(s){
      return '<div class="stat"><div class="n">' + s[1] + '</div><div class="l">' + s[0] + '</div></div>';
    }).join('');

    var tb = $('#tblSync').querySelector('tbody');
    tb.innerHTML = '';
    var itens = r.itens || [];
    for (var i = 0; i < itens.length; i++) {
      var it = itens[i];
      var cor = it.status === 'criado' ? 'ok' : it.status === 'erro' ? 'err' : '';
      tb.insertAdjacentHTML('beforeend',
        '<tr><td>#' + esc(it.projuris_id) + '</td><td>' + esc(it.descricao) +
        '</td><td class="num">' + brl(it.valor) + '</td><td><span class="pill ' + cor + '">' +
        esc(it.status) + '</span></td><td class="muted">' + esc(it.motivo || '') + '</td></tr>');
    }
    $('#tblSync').hidden = itens.length === 0;
    msg('#msgSync', r.dry_run
      ? 'Simulacao concluida - nada foi escrito no Conta Azul.'
      : 'Sincronizacao concluida.', 'i');
    carregarExec();
  } catch (e) {
    msg('#msgSync', e.message, 'e');
  } finally {
    b.disabled = false; b.textContent = 'Rodar';
  }
};

async function carregarAnalytics(){
  if (!apiKey) return;
  var q = '?inicio=' + ($('#aIni').value || diasAtras(90)) + '&fim=' + ($('#aFim').value || hoje());
  try {
    var out = await Promise.all([
      api('/analytics/resumo' + q), api('/analytics/por-mes' + q), api('/analytics/por-cliente' + q)
    ]);
    var res = out[0], mes = out[1], cli = out[2];

    var stats = [['Lancamentos', res.total_lancamentos],
                 ['Criados no Conta Azul', res.quantidade_criada],
                 ['Valor sincronizado', brl(res.valor_total_criado)]];
    $('#aResumo').innerHTML = stats.map(function(s){
      return '<div class="stat"><div class="n">' + s[1] + '</div><div class="l">' + s[0] + '</div></div>';
    }).join('');

    var s = mes.series || [];
    if (s.length) {
      var max = Math.max.apply(null, s.map(function(x){ return x.valor })) || 1;
      $('#aMes').innerHTML =
        '<div class="muted" style="font-size:12px">Valor por mes de vencimento</div>' +
        '<div class="bars">' + s.map(function(x){
          return '<div style="height:' + Math.round(x.valor / max * 100) + '%" title="' +
                 x.mes + ': ' + brl(x.valor) + '"></div>';
        }).join('') + '</div>' +
        '<div class="barlbl">' + s.map(function(x){
          return '<span>' + x.mes.slice(5) + '/' + x.mes.slice(2,4) + '</span>';
        }).join('') + '</div>';
    } else {
      $('#aMes').innerHTML = '<div class="muted">Sem dados no periodo.</div>';
    }

    var tb = $('#tblCli').querySelector('tbody');
    tb.innerHTML = '';
    var clientes = cli.clientes || [];
    for (var i = 0; i < clientes.length; i++) {
      var c = clientes[i];
      tb.insertAdjacentHTML('beforeend',
        '<tr><td>' + esc(c.cliente) + '</td><td class="muted">' + esc(c.documento || '--') +
        '</td><td class="num">' + c.quantidade + '</td><td class="num">' + brl(c.valor) + '</td></tr>');
    }
    $('#tblCli').hidden = clientes.length === 0;
  } catch (e) {
    $('#aResumo').innerHTML = '<span class="pill err">' + esc(e.message) + '</span>';
  }
}
$('#btnAnalytics').onclick = carregarAnalytics;

async function carregarExec(){
  if (!apiKey) return;
  try {
    var r = await api('/analytics/execucoes');
    var tb = $('#tblExec').querySelector('tbody');
    tb.innerHTML = '';
    var ex = r.execucoes || [];
    for (var i = 0; i < ex.length; i++) {
      var e = ex[i];
      tb.insertAdjacentHTML('beforeend',
        '<tr><td>' + new Date(e.criado_em).toLocaleString('pt-BR') + '</td><td>' + esc(e.origem) +
        (e.dry_run ? ' <span class="pill warn">simulacao</span>' : '') +
        '</td><td class="muted">' + e.data_inicio + ' a ' + e.data_fim +
        '</td><td class="num">' + e.total_lidos + '</td><td class="num">' + e.total_criados +
        '</td><td class="num">' + e.total_erros + '</td><td class="num">' +
        (e.duracao_ms / 1000).toFixed(1) + 's</td></tr>');
    }
    $('#tblExec').hidden = ex.length === 0;

    var er = r.erros_abertos || [];
    if (er.length) {
      $('#errosAbertos').innerHTML =
        '<div class="pill err">' + er.length + ' lancamento(s) com erro</div>' +
        '<div class="scroll"><table><thead><tr><th>Projuris</th><th>Descricao</th>' +
        '<th class="num">Valor</th><th>Erro</th></tr></thead><tbody>' +
        er.map(function(x){
          return '<tr><td>#' + esc(x.projuris_id) + '</td><td>' + esc(x.descricao) +
                 '</td><td class="num">' + brl(x.valor) + '</td><td class="muted">' +
                 esc(x.motivo) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      $('#errosAbertos').innerHTML = '<div class="pill ok">nenhum erro pendente</div>';
    }
  } catch (e) {
    $('#errosAbertos').innerHTML = '<span class="pill err">' + esc(e.message) + '</span>';
  }
}
$('#btnExec').onclick = carregarExec;

$('#ini').value = diasAtras(30);
$('#fim').value = hoje();
$('#aIni').value = diasAtras(90);
$('#aFim').value = hoje();
carregarSaude();
carregarAnalytics();
carregarExec();
</script>
</body>
</html>`

painelRouter.get('/', (_req, res) => res.type('html').send(HTML))
