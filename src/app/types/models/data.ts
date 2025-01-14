export interface CrawlResult {
  id: string
  url: string
  title: string
  content: string
  timestamp: Date
  metadata: Record<string, unknown>
}

export interface AnalysisResult {
  id: string
  crawlId: string
  score: number
  indicators: string[]
  confidence: number
  timestamp: Date
}
