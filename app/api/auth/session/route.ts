import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      isLoggedIn: true,
      username: session.username,
    });
  } catch {
    return NextResponse.json({ error: 'Session error' }, { status: 500 });
  }
}
