import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dgId = searchParams.get('dg_id');
  const eventId = searchParams.get('event_id');

  if (!dgId || !eventId) {
    return NextResponse.json({ error: 'dg_id and event_id are required' }, { status: 400 });
  }

  try {
    const rows = await query(
      `SELECT year, finish_label, made_cut, withdrew, earnings
       FROM course_history
       WHERE dg_id = $1 AND event_id = $2
       ORDER BY year DESC`,
      [Number(dgId), Number(eventId)]
    );

    return NextResponse.json({ history: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
