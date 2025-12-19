import { NextRequest, NextResponse } from 'next/server';
import { validateApiKeyHeader } from '@/lib/security/auth';

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production' && !process.env.LOCAL_API_KEY) {
    return NextResponse.next();
  }

  const result = validateApiKeyHeader(request.headers, process.env.LOCAL_API_KEY);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*'
};
