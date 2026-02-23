import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const VALID_USERNAME = process.env.AUTH_USERNAME || 'admin';
    const VALID_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      const session = await getSession();
      session.isLoggedIn = true;
      session.username = username;
      await session.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
