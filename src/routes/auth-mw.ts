import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'

/** Protege as rotas operacionais com uma chave estática (header ou query). */
export function exigirApiKey(req: Request, res: Response, next: NextFunction) {
  const esperada = config.sync.apiKey
  if (!esperada) return res.status(500).json({ erro: 'SYNC_API_KEY não configurada' })

  const recebida =
    (req.header('x-api-key') ?? '') ||
    (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '') ||
    String(req.query.api_key ?? '')

  if (recebida !== esperada) return res.status(401).json({ erro: 'não autorizado' })
  next()
}

/** O Vercel Cron manda "Authorization: Bearer <CRON_SECRET>". */
export function exigirCronSecret(req: Request, res: Response, next: NextFunction) {
  const esperada = config.sync.cronSecret
  if (!esperada) return res.status(500).json({ erro: 'CRON_SECRET não configurado' })

  const recebida = (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (recebida !== esperada) return res.status(401).json({ erro: 'não autorizado' })
  next()
}
