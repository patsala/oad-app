import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/app/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow auth API endpoints through
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Allow internal/admin API endpoints (cron, sync, manual trigger)
  if (
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/sync-') ||
    pathname.startsWith('/api/update-completed-tournaments') ||
    pathname.startsWith('/api/migrate-') ||
    pathname.startsWith('/api/debug-apis')
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  // Root (/) is the login page — redirect to dashboard if already authenticated
  if (pathname === '/') {
    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // All other routes require authentication
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
