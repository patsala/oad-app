import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/app/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API endpoints through
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  // Allow internal/admin API endpoints (cron, sync, manual trigger)
  if (
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/sync-') ||
    pathname.startsWith('/api/update-completed-tournaments') ||
    pathname.startsWith('/api/migrate-')
  ) {
    return NextResponse.next();
  }

  // Check session
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
