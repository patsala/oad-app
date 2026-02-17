# Golf Pool Command Center

One & Done Golf Pool Management Tool

## Features
- ✅ Weekly tournament analysis with player recommendations
- ✅ Scenario modeling (compare pick strategies)
- 🚧 Roster management (track used/available players)
- 🚧 Full tournament schedule
- 🚧 Expected value calculator
- 🚧 Course history analytics

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

This app is deployed on Vercel with Neon PostgreSQL database.

### Environment Variables
```
DATABASE_URL=your_neon_connection_string
ODDS_API_KEY=your_odds_api_key
WEATHER_API_KEY=your_weather_api_key
```

## Tech Stack
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Vercel (hosting)
- Neon PostgreSQL (database)
