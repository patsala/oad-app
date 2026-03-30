import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Derive used_in_tournament_id / used_in_week from the picks table directly
    // so this is always accurate even if the column was wiped by a sync.
    const players = await query(`
      SELECT
        p.id, p.name, p.tier, p.dg_id, p.owgr_rank, p.primary_tour,
        pk.tournament_id  AS used_in_tournament_id,
        t.week_number     AS used_in_week
      FROM players p
      LEFT JOIN picks pk ON p.name = pk.player_name
      LEFT JOIN tournaments t ON pk.tournament_id = t.id
      ORDER BY p.name ASC
    `);
    return NextResponse.json({ players });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}