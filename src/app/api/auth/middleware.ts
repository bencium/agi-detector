import { NextRequest, NextResponse } from 'next/server'
import { authSchema } from '@/lib/validation/schema'

export async function validateApiKey(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key required' },
      { status: 401 }
    )
  }

  try {
    await authSchema.parseAsync({ apiKey })
    // In a real app, validate against database/env
    return NextResponse.next()
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    )
  }
}
