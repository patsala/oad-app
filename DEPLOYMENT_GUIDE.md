# Deployment Guide

## Step 1: Set Up Locally in VS Code

1. **Copy project to your machine**
   - Download the entire `golf-pool-app` folder
   - Open in VS Code

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000

## Step 2: Push to GitHub

1. **Initialize Git** (in VS Code terminal)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub repo**
   - Go to github.com
   - Click "New Repository"
   - Name it "golf-pool-app"
   - Don't initialize with README (we have one)

3. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/golf-pool-app.git
   git branch -M main
   git push -u origin main
   ```

## Step 3: Deploy to Vercel (FREE)

1. **Sign up for Vercel**
   - Go to vercel.com
   - Sign up with GitHub

2. **Import project**
   - Click "Add New... → Project"
   - Select your `golf-pool-app` repo
   - Click "Import"

3. **Configure & Deploy**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: ./
   - Click "Deploy"

4. **Get your live URL**
   - Will be something like: `golf-pool-app.vercel.app`

## Step 4: Set Up Database (Neon PostgreSQL - FREE)

1. **Sign up for Neon**
   - Go to neon.tech
   - Sign up (free tier: 0.5GB)

2. **Create database**
   - Click "Create Project"
   - Name: "golf-pool-db"
   - Region: Choose closest to you
   - Copy the connection string

3. **Add to Vercel**
   - Go to your Vercel project
   - Settings → Environment Variables
   - Add: `DATABASE_URL` = your Neon connection string
   - Click "Save"
   - Redeploy (Vercel will prompt you)

## Step 5: Set Up API Keys (Optional for now)

Later, when we add live data:

1. **The Odds API** (free tier)
   - theoddsapi.com → Sign up
   - Get API key
   - Add to Vercel: `ODDS_API_KEY`

2. **OpenWeatherMap** (free tier)
   - openweathermap.org → Sign up
   - Get API key
   - Add to Vercel: `WEATHER_API_KEY`

## Step 6: Update on GitHub = Auto-Deploy

Every time you push to GitHub, Vercel auto-deploys:

```bash
git add .
git commit -m "Added new feature"
git push
```

Vercel will automatically build and deploy!

## Costs

- **Vercel**: $0/month (free tier)
- **Neon**: $0/month (free tier)
- **APIs**: $0/month (free tiers)
- **Total**: $0/month

Upgrade only if you need:
- More API calls
- Larger database
- Custom domain (can add domain to Vercel free tier though!)

## Need Help?

Common issues:
- Build fails → Check package.json dependencies
- Database errors → Verify connection string in env vars
- CSS not loading → Run `npm run build` locally first to test

## Next Steps After Deployment

1. Test the live URL
2. Share with pool members
3. Start building Features 2-6:
   - Roster management
   - Full schedule
   - EV calculator
   - Course history stats
