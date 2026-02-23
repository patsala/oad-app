import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // APP_URL must be set in Vercel env vars to the stable production URL
  // (e.g. https://oad-app.vercel.app). VERCEL_URL alone points to the
  // deployment-specific subdomain which may have Deployment Protection enabled.
  const baseUrl = process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const results: Record<string, any> = {};
  const startTime = Date.now();

  // 1. Sync tournaments (schedule updates, completion status)
  try {
    const res = await fetch(`${baseUrl}/api/sync-tournaments`, { method: 'POST' });
    results.tournaments = await res.json();
  } catch (error) {
    results.tournaments = { error: error instanceof Error ? error.message : 'Failed' };
  }

  // 2. Sync player rankings
  try {
    const res = await fetch(`${baseUrl}/api/sync-players`, { method: 'POST' });
    results.players = await res.json();
  } catch (error) {
    results.players = { error: error instanceof Error ? error.message : 'Failed' };
  }

  // 3. Sync player enrichment (strokes gained, course fit, etc.)
  try {
    const res = await fetch(`${baseUrl}/api/sync-player-enrichment`, { method: 'POST' });
    results.enrichment = await res.json();
  } catch (error) {
    results.enrichment = { error: error instanceof Error ? error.message : 'Failed' };
  }

  // 4. Auto-complete past tournaments and fetch winners from DataGolf
  try {
    const res = await fetch(`${baseUrl}/api/update-completed-tournaments`, { method: 'POST' });
    results.completions = await res.json();
  } catch (error) {
    results.completions = { error: error instanceof Error ? error.message : 'Failed' };
  }

  const duration = Date.now() - startTime;

  return NextResponse.json({
    success: true,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    results
  });
}
