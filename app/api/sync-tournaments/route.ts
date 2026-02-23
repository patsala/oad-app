import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// Your 28-event schedule - 7 events per segment
const SEASON_SCHEDULE = [
  // Q1 - 7 events
  { key: 'Pebble Beach', week: 1, segment: 'Q1', purse: 20000000, type: 'Signature' },
  { key: 'Genesis Invitational', week: 2, segment: 'Q1', purse: 20000000, type: 'Signature' },
  { key: 'Cognizant', week: 3, segment: 'Q1', purse: 8600000, type: 'Regular' },
  { key: 'Arnold Palmer', week: 4, segment: 'Q1', purse: 20000000, type: 'Signature' },
  { key: 'PLAYERS', week: 5, segment: 'Q1', purse: 25000000, type: 'Signature' },
  { key: 'Valspar', week: 6, segment: 'Q1', purse: 8600000, type: 'Regular' },
  { key: 'Houston Open', week: 7, segment: 'Q1', purse: 9000000, type: 'Regular' },
  
  // Q2 - 7 events
  { key: 'Valero Texas', week: 8, segment: 'Q2', purse: 9200000, type: 'Regular' },
  { key: 'Masters', week: 9, segment: 'Q2', purse: 20000000, multiplier: 1.5, type: 'Major' },
  { key: 'RBC Heritage', week: 10, segment: 'Q2', purse: 20000000, type: 'Signature' },
  { key: 'Miami', week: 11, segment: 'Q2', purse: 8000000, type: 'Regular' },
  { key: 'Truist', week: 12, segment: 'Q2', purse: 20000000, type: 'Signature' },
  { key: 'PGA Championship', week: 13, segment: 'Q2', purse: 18500000, multiplier: 1.5, type: 'Major' },
  { key: 'CJ Cup', week: 14, segment: 'Q2', purse: 9500000, type: 'Regular' },
  
  // Q3 - 7 events
  { key: 'Schwab Challenge', week: 15, segment: 'Q3', purse: 9500000, type: 'Regular' },
  { key: 'Memorial', week: 16, segment: 'Q3', purse: 20000000, type: 'Signature' },
  { key: 'Canadian Open', week: 17, segment: 'Q3', purse: 9300000, type: 'Regular' },
  { key: 'U.S. Open', week: 18, segment: 'Q3', purse: 21500000, multiplier: 1.5, type: 'Major' },
  { key: 'Travelers', week: 19, segment: 'Q3', purse: 20000000, type: 'Signature' },
  { key: 'John Deere', week: 20, segment: 'Q3', purse: 8000000, type: 'Regular' },
  { key: 'Scottish Open', week: 21, segment: 'Q3', purse: 9000000, type: 'Regular' },
  
  // Q4 - 7 events
  { key: 'Open Championship', week: 22, segment: 'Q4', purse: 17000000, multiplier: 1.5, type: 'Major' },
  { key: '3M Open', week: 23, segment: 'Q4', purse: 8000000, type: 'Regular' },
  { key: 'Rocket', week: 24, segment: 'Q4', purse: 8400000, type: 'Regular' },
  { key: 'Wyndham', week: 25, segment: 'Q4', purse: 7600000, type: 'Regular' },
  { key: 'St. Jude', week: 26, segment: 'Q4', purse: 20000000, type: 'Signature' },
  { key: 'BMW Championship', week: 27, segment: 'Q4', purse: 20000000, type: 'Signature' },
  { key: 'TOUR Championship', week: 28, segment: 'Q4', purse: 28500000, type: 'Signature' },
];

function fuzzyMatch(dgName: string, searchKey: string): boolean {
  const dgLower = dgName.toLowerCase();
  const keyLower = searchKey.toLowerCase();
  return dgLower.includes(keyLower);
}

function parseCity(location: string): string {
  // "Honolulu, HI" -> "Honolulu"
  return location.split(',')[0].trim();
}

function calculateEndDate(startDate: string): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + 3); // Tournaments are 4 days (Thu-Sun)
  return start.toISOString().split('T')[0];
}

// DataGolf returns winners as "Last, First (dg_id)" e.g. "Morikawa, Collin (22085)"
// Convert to "First Last"
function parseDgWinnerName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip trailing " (12345)"
  const stripped = raw.replace(/\s*\(\d+\)\s*$/, '').trim();
  // Flip "Last, First" → "First Last"
  if (stripped.includes(',')) {
    const parts = stripped.split(',').map((s: string) => s.trim());
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : stripped;
  }
  return stripped;
}

export async function POST() {
  try {
    const response = await fetch(
      `https://feeds.datagolf.com/get-schedule?tour=pga&season=2026&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch schedule from DataGolf');
    }
    
    const data = await response.json();
    
    // Clear existing tournaments completely
    await query('TRUNCATE TABLE tournaments CASCADE');
    
    let count = 0;
    let notFound: string[] = [];
    const processedIds = new Set<string>();
    
    for (const scheduleEvent of SEASON_SCHEDULE) {
      // Find matching tournament in DataGolf feed using fuzzy matching
      const dgEvent = data.schedule.find((e: any) => {
        const eventId = e.event_id;
        return !processedIds.has(eventId) && fuzzyMatch(e.event_name || '', scheduleEvent.key);
      });
      
      if (!dgEvent) {
        notFound.push(scheduleEvent.key);
        continue;
      }
      
      const eventId = dgEvent.event_id;
      processedIds.add(eventId);
      
      const multiplier = scheduleEvent.multiplier || 1.0;
      const purse = scheduleEvent.purse;
      const eventType = scheduleEvent.type;
      const isCompleted = dgEvent.status === 'completed';
      const city = parseCity(dgEvent.location || '');
      const endDate = calculateEndDate(dgEvent.start_date);
      
      await query(
        `INSERT INTO tournaments (
          id, event_id, event_name, course_name, course_id, 
          city, country, latitude, longitude, 
          start_date, end_date, season, purse, multiplier, 
          segment, event_type, tour, winner, is_completed, week_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          eventId,
          dgEvent.event_id,
          dgEvent.event_name,
          dgEvent.course,
          dgEvent.course_key,
          city,
          dgEvent.country,
          dgEvent.latitude,
          dgEvent.longitude,
          dgEvent.start_date,
          endDate,
          2026,
          purse,
          multiplier,
          scheduleEvent.segment,
          eventType,
          'pga',
          parseDgWinnerName(dgEvent.winner),
          isCompleted,
          scheduleEvent.week
        ]
      );
      count++;
    }
    
    return NextResponse.json({ 
      success: true, 
      count,
      notFound: notFound.length > 0 ? notFound : undefined,
      message: `Synced ${count} tournaments - 7 per segment (Q1-Q4)`,
      breakdown: {
        Q1: SEASON_SCHEDULE.filter(e => e.segment === 'Q1').length,
        Q2: SEASON_SCHEDULE.filter(e => e.segment === 'Q2').length,
        Q3: SEASON_SCHEDULE.filter(e => e.segment === 'Q3').length,
        Q4: SEASON_SCHEDULE.filter(e => e.segment === 'Q4').length,
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync tournaments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}