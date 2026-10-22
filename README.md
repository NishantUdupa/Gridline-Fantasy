# Gridline

Gridline is an NFL fantasy analytics workbench powered by the read-only [Sleeper API](https://docs.sleeper.com/). It includes weekly and rest-of-season rankings, player outlooks, matchup calendars, boom/bust picks, a locally saved roster, trade analysis, and start/sit comparisons for QB, RB, WR, TE, K, and DEF.

Gridline uses live Sleeper player, schedule, injury, statistical, and projection data. It never substitutes fictional player data. If Sleeper is unavailable and Vercel has no cached live response, the app displays an error and retry option. Projections are estimates, not guarantees.

## Model training

Training stays on the server. Gridline reads Sleeper’s `previous_season` value and uses that regular season as walk-forward training data; prior-season rows are never rendered in rankings or player pages. Each completed target week can use only information available before that week.

For every position, six candidate ensembles are evaluated: balanced, volume-first, recent-form, season-stable, consensus-anchored, and Sleeper consensus. The lowest-MAE candidate is selected by position. Usage and efficiency signals are added only when their walk-forward error improves the model.

Rest-of-season schedule grades compare fantasy points allowed by each player’s remaining opponents. Injury designations and notes reduce expected games and post-return workload when appropriate.

## Local development

Requirements:

- Node.js 20.9 or newer
- npm

```bash
npm ci
npm run dev
```

Open [http://localhost:43127](http://localhost:43127).

Before pushing:

```bash
npm run verify
```

This runs ESLint, TypeScript, and a production Next.js build.

## Automatic data refresh

Sleeper responses use Next.js Data Cache on Vercel:

- NFL state refreshes every 5 minutes.
- current players, injuries, and projections refresh every 15 minutes.
- completed-week data refreshes every 6 hours.
- schedules refresh daily.
- prior-season training data refreshes monthly.

[`vercel.json`](vercel.json) also invokes `/api/cron/refresh` once daily at 10:00 UTC. The job invalidates and warms the live cache. This schedule works on Vercel Hobby; timing can vary within the scheduled hour. A normal visitor request can also revalidate expired data, so weekly Sleeper state changes do not require a redeploy.

## Publish to GitHub

1. Create an empty repository on [github.com/new](https://github.com/new). Do not add a README or `.gitignore`.
2. From this project folder, run:

```powershell
git init -b main
git add .
git commit -m "Initial Gridline release"
git remote add origin https://github.com/YOUR_USER/GridlineFantasy.git
git push -u origin main
```

The included GitHub Actions workflow runs `npm run verify` on pushes to `main` and on pull requests.

## Deploy to Vercel

1. Open [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. Keep **Framework Preset** set to **Next.js**.
3. Keep the install command as `npm install` and build command as `npm run build`.
4. In **Environment Variables**, add `CRON_SECRET` for Production. Use a random value of at least 16 characters. Do not prefix it with `NEXT_PUBLIC_`.
5. Deploy. Vercel will assign a `*.vercel.app` URL and run the daily job from `vercel.json`.
6. In Project Settings, confirm Node.js 22.x or another version meeting the `>=20.9.0` requirement.

After deployment, check:

- `/` renders the current Sleeper week.
- `/rankings` and `/rest-of-season` load live boards.
- player search returns current active players.
- `/api/cron/refresh` returns `401` without the cron authorization header.
- Project Settings → Cron Jobs lists `/api/cron/refresh`.

Preview deployments have a separate cache from Production. The scheduled job runs only against the production deployment.
