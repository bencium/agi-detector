import { NextRequest, NextResponse } from 'next/server'
import { validateApiKeyHeader } from '@/lib/security/auth'

export function requireApiKey(req: NextRequest): NextResponse | null {
  const result = validateApiKeyHeader(req.headers, process.env.LOCAL_API_KEY)
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    )
  }

  return null
}
