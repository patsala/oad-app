import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// Your 28-event schedule - using key words for fuzzy matching
const SEASON_SCHEDULE = [
  { key: 'Pebble Beach', week: 1, segment: 'Q1' },
  { key: 'Genesis Invitational', week: 2, segment: 'Q1' },
  { key: 'Cognizant', week: 3, segment: 'Q1' },
  { key: 'Arnold Palmer', week: 4, segment: 'Q1' },
  { key: 'PLAYERS', week: 5, segment: 'Q1' },
  { key: 'Valspar', week: 6, segment: 'Q1' },
  { key: 'Houston Open', week: 7, segment: 'Q1' },
  { key: 'Valero Texas', week: 8, segment: 'Q1' },
  { key: 'Masters', week: 9, segment: 'Q2', multiplier: 1.5 },
  { key: 'RBC Heritage', week: 10, segment: 'Q2' },
  { key: 'Miami', week: 11, segment: 'Q2' },
  { key: 'Truist', week: 12, segment: 'Q2' },
  { key: 'PGA Championship', week: 13, segment: 'Q2', multiplier: 1.5 },
  { key: 'CJ Cup', week: 14, segment: 'Q2' },
  { key: 'Schwab Challenge', week: 15, segment: 'Q2' },
  { key: 'Memorial', week: 16, segment: 'Q2' },
  { key: 'Canadian Open', week: 17, segment: 'Q3' },
  { key: 'U.S. Open', week: 18, segment: 'Q3', multiplier: 1.5 },
  { key: 'Travelers', week: 19, segment: 'Q3' },
  { key: 'John Deere', week: 20, segment: 'Q3' },
  { key: 'Scottish Open', week: 21, segment: 'Q3' },
  { key: 'Open Championship', week: 22, segment: 'Q3', multiplier: 1.5 },
  { key: '3M Open', week: 23, segment: 'Q3' },
  { key: 'Rocket', week: 24, segment: 'Q3' },
  { key: 'Wyndham', week: 25, segment: 'Q3' },
  { key: 'St. Jude', week: 26, segment: 'Q4' },
  { key: 'BMW Championship', week: 27, segment: 'Q4' },
  { key: 'TOUR Championship', week: 28, segment: 'Q4' },
];

function fuzzyMatch(dgName: string, searchKey: string): boolean {
  const dgLower = dgName.toLowerCase();
  const keyLower = searchKey.toLowerCase();
  return dgLower.includes(keyLower);
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
        const eventId = e.calendar_key || e.event_id;
        return !processedIds.has(eventId) && fuzzyMatch(e.event_name || '', scheduleEvent.key);
      });
      
      if (!dgEvent) {
        notFound.push(scheduleEvent.key);
        continue;
      }
      
      const eventId = dgEvent.calendar_key || dgEvent.event_id;
      processedIds.add(eventId);
      
      const multiplier = scheduleEvent.multiplier || 1.0;
      
      // Determine event type
      let eventType = 'Regular';
      if (multiplier === 1.5) eventType = 'Major';
      else if (dgEvent.purse >= 20000000) eventType = 'Signature';
      
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
          dgEvent.course_name || dgEvent.course,
          dgEvent.course_key || dgEvent.course_id,
          dgEvent.city,
          dgEvent.country,
          dgEvent.lat,
          dgEvent.lon,
          dgEvent.start_date,
          dgEvent.end_date,
          2026,
          dgEvent.purse || 0,
          multiplier,
          scheduleEvent.segment,
          eventType,
          'pga',
          dgEvent.winner,
          dgEvent.event_completed === true || dgEvent.winner !== null,
          scheduleEvent.week
        ]
      );
      count++;
    }
    
    return NextResponse.json({ 
      success: true, 
      count,
      notFound: notFound.length > 0 ? notFound : undefined,
      message: `Synced ${count} of ${SEASON_SCHEDULE.length} scheduled tournaments`
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync tournaments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}