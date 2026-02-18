import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function POST() {
  try {
    // Only fetch PGA Tour events (includes majors)
    const response = await fetch(
      `https://feeds.datagolf.com/get-schedule?tour=pga&season=2026&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch schedule from DataGolf');
    }
    
    const data = await response.json();
    
    // Clear existing PGA tournaments for 2026
    await query('DELETE FROM tournaments WHERE season = 2026 AND tour = $1', ['pga']);
    
    let count = 0;
    for (const event of data.schedule) {
      // Skip non-PGA events (extra safety check, though tour=pga should already filter)
      if (event.tour && event.tour !== 'pga') continue;
      
      // Determine multiplier (1.5x for majors, 1.0x otherwise)
      const isMajor = event.event_name?.includes('Masters') || 
                     event.event_name?.includes('PGA Championship') ||
                     event.event_name?.includes('U.S. Open') ||
                     event.event_name?.includes('Open Championship') ||
                     event.event_name?.includes('The Open');
      const multiplier = isMajor ? 1.5 : 1.0;
      
      // Determine segment based on end date
      const endDate = new Date(event.end_date);
      let segment = 'Q1';
      if (endDate >= new Date('2026-04-01')) segment = 'Q2';
      if (endDate >= new Date('2026-07-01')) segment = 'Q3';
      if (endDate >= new Date('2026-10-01')) segment = 'Q4';
      
      // Determine event type
      let eventType = 'Regular';
      if (isMajor) eventType = 'Major';
      else if (event.purse >= 20000000) eventType = 'Signature';
      
      await query(
        `INSERT INTO tournaments (
          id, event_id, event_name, course_name, course_id, 
          city, country, latitude, longitude, 
          start_date, end_date, season, purse, multiplier, 
          segment, event_type, tour, winner, is_completed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          event.calendar_key || event.event_id,
          event.event_id,
          event.event_name,
          event.course_name || event.course,
          event.course_key || event.course_id,
          event.city,
          event.country,
          event.lat,
          event.lon,
          event.start_date,
          event.end_date,
          2026,
          event.purse || 0,
          multiplier,
          segment,
          eventType,
          'pga',
          event.winner,
          event.event_completed === true || event.winner !== null
        ]
      );
      count++;
    }
    
    return NextResponse.json({ 
      success: true, 
      count,
      message: `Synced ${count} PGA Tour events (including majors) for 2026`
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync tournaments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}