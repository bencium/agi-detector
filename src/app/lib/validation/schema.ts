import { z } from 'zod'

export const crawlRequestSchema = z.object({
  url: z.string().url(),
  depth: z.number().min(1).max(5).optional().default(1)
})

export const authSchema = z.object({
  apiKey: z.string().min(32)
})

export type CrawlRequest = z.infer<typeof crawlRequestSchema>
export type AuthRequest = z.infer<typeof authSchema>
