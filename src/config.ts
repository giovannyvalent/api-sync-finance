/**
 * Configuração central. Tudo vem de env var — nada de segredo em código.
 * Os *_PATH e *_FIELD existem porque a doc pública do Projuris ADV não
 * descreve o módulo financeiro; deixamos ajustável sem redeploy de código.
 */

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

function envList(name: string, fallback: string[]): string[] {
  const raw = env(name)
  if (!raw) return fallback
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export const config = {
  projuris: {
    authUrl: env('PROJURIS_AUTH_URL', 'https://apigw.projurisadv.com.br/auth/token'),
    apiUrl: env('PROJURIS_API_URL', 'https://api.projurisadv.com.br/adv-service'),
    clientId: env('PROJURIS_CLIENT_ID'),
    clientSecret: env('PROJURIS_CLIENT_SECRET'),
    // formato obrigatório: USUARIO$$DOMINIO_ESCRITORIO
    username: env('PROJURIS_USERNAME'),
    password: env('PROJURIS_PASSWORD'),
    // POST /receita-despesa/consulta — módulo Financeiro
    // docs.projurisadv.com.br/resource_Financeiro.html
    lancamentosPath: env('PROJURIS_LANCAMENTOS_PATH', '/receita-despesa/consulta'),
    // a que data o período se aplica: VENCIMENTO é o que interessa aqui
    dataFiltro: env('PROJURIS_DATA_FILTRO', 'VENCIMENTO'),
    // enum do Projuris: RECEITA | DESPESA | TRANSFERENCIA (vazio = sem filtro)
    planoContaNatureza: env('PROJURIS_PLANO_CONTA_NATUREZA', 'RECEITA'),
    tamanhoPagina: Number(env('PROJURIS_TAMANHO_PAGINA', '100')),
    maxPaginas: Number(env('PROJURIS_MAX_PAGINAS', '50')),
    // busca o CPF/CNPJ do favorecido antes de casar o cliente no Conta Azul.
    // Custa 1 request por favorecido novo, mas evita cliente duplicado.
    enriquecerFavorecido: env('PROJURIS_ENRIQUECER_FAVORECIDO', 'true') === 'true',
  },

  contaazul: {
    authBase: env('CONTAAZUL_AUTH_BASE', 'https://auth.contaazul.com'),
    apiBase: env('CONTAAZUL_API_BASE', 'https://api-v2.contaazul.com/v1'),
    clientId: env('CONTAAZUL_CLIENT_ID'),
    clientSecret: env('CONTAAZUL_CLIENT_SECRET'),
    redirectUri: env('CONTAAZUL_REDIRECT_URI'),
    // escopo fixo da API v2 (Cognito)
    scope: env('CONTAAZUL_SCOPE', 'openid profile aws.cognito.signin.user.admin'),
    // ids default no Conta Azul (resolvidos uma vez e colocados em env)
    contaFinanceiraId: env('CONTAAZUL_CONTA_FINANCEIRA_ID'),
    categoriaId: env('CONTAAZUL_CATEGORIA_ID'),
    centroCustoId: env('CONTAAZUL_CENTRO_CUSTO_ID'),
    // conta identificadora quando há mais de uma empresa conectada
    companyId: env('CONTAAZUL_COMPANY_ID', 'default'),
  },

  supabase: {
    url: env('SUPABASE_URL'),
    serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  },

  sync: {
    // chave que protege /sync/* e /analytics/*
    apiKey: env('SYNC_API_KEY'),
    // segredo do Vercel Cron (header Authorization: Bearer <CRON_SECRET>)
    cronSecret: env('CRON_SECRET'),
    // janela padrão do cron, em dias para trás
    janelaDias: Number(env('SYNC_JANELA_DIAS', '7')),
    // só sincroniza lançamentos com estes status no Projuris (vazio = todos)
    statusPermitidos: envList('SYNC_STATUS_PERMITIDOS', []),
    // valor mínimo para criar conta a receber
    valorMinimo: Number(env('SYNC_VALOR_MINIMO', '0.01')),
    // se true, nunca escreve no Conta Azul (só registra o que faria)
    dryRunGlobal: env('SYNC_DRY_RUN', 'false') === 'true',
  },
}

export function assertConfig(): string[] {
  const faltando: string[] = []
  const req: Array<[string, string]> = [
    ['PROJURIS_CLIENT_ID', config.projuris.clientId],
    ['PROJURIS_CLIENT_SECRET', config.projuris.clientSecret],
    ['PROJURIS_USERNAME', config.projuris.username],
    ['PROJURIS_PASSWORD', config.projuris.password],
    ['CONTAAZUL_CLIENT_ID', config.contaazul.clientId],
    ['CONTAAZUL_CLIENT_SECRET', config.contaazul.clientSecret],
    ['CONTAAZUL_REDIRECT_URI', config.contaazul.redirectUri],
    ['SUPABASE_URL', config.supabase.url],
    ['SUPABASE_SERVICE_ROLE_KEY', config.supabase.serviceRoleKey],
  ]
  for (const [nome, valor] of req) if (!valor) faltando.push(nome)
  return faltando
}
