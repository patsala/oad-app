import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastDay {
  date: string;
  day: string;
  temp_high: number;
  temp_low: number | null;
  wind_speed: number;
  wind_direction: string;
  precipitation: number;
  conditions: string;
  icon: string;
}

interface Impact {
  severity: 'low' | 'medium' | 'high';
  message: string;
  favors: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function getDayName(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function wmoCodeToConditions(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain Showers';
  if (code <= 86) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Cloudy';
}

function conditionsToIcon(conditions: string): string {
  const c = conditions.toLowerCase();
  if (c.includes('thunder')) return '⛈️';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('fog')) return '🌫️';
  if (c.includes('cloud') || c.includes('overcast')) return '⛅';
  if (c.includes('sunny') || c.includes('clear')) return '☀️';
  return '🌤️';
}

function analyzeImpact(forecast: ForecastDay[]): Impact | null {
  if (forecast.length === 0) return null;
  const maxWind = Math.max(...forecast.map(d => d.wind_speed));
  const maxRain = Math.max(...forecast.map(d => d.precipitation));
  const avgTemp = forecast.reduce((s, d) => s + d.temp_high, 0) / forecast.length;

  if (maxWind > 20) {
    return {
      severity: 'high',
      message: 'Strong winds expected — accuracy favored over distance',
      favors: 'Accuracy players',
    };
  }
  if (maxWind > 15) {
    return {
      severity: 'medium',
      message: 'Moderate wind — trajectory control matters',
      favors: 'Ball-strikers',
    };
  }
  if (maxRain > 60) {
    return {
      severity: 'medium',
      message: 'Rain likely — soft conditions favor bombers',
      favors: 'Distance players',
    };
  }
  if (avgTemp < 50) {
    return {
      severity: 'medium',
      message: 'Cold temps reduce ball flight distance',
      favors: 'Accuracy players',
    };
  }
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Fetch upcoming tournament coordinates
    const rows = await query(
      `SELECT latitude, longitude, start_date, event_name, course_name
       FROM tournaments
       WHERE is_completed = false
       ORDER BY start_date ASC
       LIMIT 1`
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No upcoming tournament' }, { status: 404 });
    }

    const t = rows[0];
    if (t.latitude == null || t.longitude == null) {
      return NextResponse.json({ error: 'Tournament has no coordinates' }, { status: 422 });
    }

    const lat = Number(t.latitude);
    const lon = Number(t.longitude);
    const startDateStr: string =
      typeof t.start_date === 'string'
        ? t.start_date.substring(0, 10)
        : new Date(t.start_date).toISOString().split('T')[0];

    // 2. Build 4-day tournament date range (Thu–Sun)
    const tournamentDates = [0, 1, 2, 3].map(n => addDays(startDateStr, n));
    const endDate = tournamentDates[3];

    // 3. Fetch from Open-Meteo
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('daily', [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'windspeed_10m_max',
      'winddirection_10m_dominant',
      'weathercode',
    ].join(','));
    url.searchParams.set('start_date', startDateStr);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('windspeed_unit', 'mph');
    url.searchParams.set('timezone', 'auto');

    const weatherRes = await fetch(url.toString(), { cache: 'no-store' });
    if (!weatherRes.ok) {
      return NextResponse.json(
        { error: `Weather service unavailable: ${weatherRes.status}` },
        { status: 503 }
      );
    }

    const weatherData = await weatherRes.json();
    const daily = weatherData.daily;

    if (!daily?.time) {
      return NextResponse.json({ error: 'Unexpected weather response format' }, { status: 503 });
    }

    // 4. Map to ForecastDay[]
    const forecast: ForecastDay[] = (daily.time as string[]).map((date: string, i: number) => {
      const conditions = wmoCodeToConditions(daily.weathercode?.[i] ?? 0);
      return {
        date,
        day: getDayName(date),
        temp_high: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        temp_low: daily.temperature_2m_min?.[i] != null
          ? Math.round(daily.temperature_2m_min[i])
          : null,
        wind_speed: Math.round(daily.windspeed_10m_max?.[i] ?? 0),
        wind_direction: degreesToCompass(daily.winddirection_10m_dominant?.[i] ?? 0),
        precipitation: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
        conditions,
        icon: conditionsToIcon(conditions),
      };
    });

    // 5. Impact analysis
    const impact = analyzeImpact(forecast);

    return NextResponse.json({
      tournament_name: t.event_name,
      course_name: t.course_name,
      start_date: startDateStr,
      forecast,
      impact,
    });
  } catch (error) {
    console.error('tournament-weather error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
