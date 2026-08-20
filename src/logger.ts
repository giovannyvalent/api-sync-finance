type Nivel = 'info' | 'warn' | 'error'

function log(nivel: Nivel, escopo: string, msg: string, extra?: unknown) {
  const linha = `[${escopo}] ${msg}`
  const fn = nivel === 'error' ? console.error : nivel === 'warn' ? console.warn : console.log
  if (extra === undefined) fn(linha)
  else fn(linha, typeof extra === 'string' ? extra : JSON.stringify(extra))
}

export const logger = {
  info: (escopo: string, msg: string, extra?: unknown) => log('info', escopo, msg, extra),
  warn: (escopo: string, msg: string, extra?: unknown) => log('warn', escopo, msg, extra),
  error: (escopo: string, msg: string, extra?: unknown) => log('error', escopo, msg, extra),
}
