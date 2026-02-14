# Viral Trend Planner

A lightweight web app that analyzes viral social videos and generates a practical weekly content plan.

## What it does

- Ingests reference video performance signals (views, engagement, watch time, hook, format, hashtags)
- Scores viral patterns to identify top topics, hooks, and formats
- Recommends target duration and trend-risk level
- Builds a post-ready weekly schedule with concept, hook, format, and CTA

## Quick start

1. Make sure you have Node.js 18+.
2. Run:

```bash
npm start
```

3. Open `http://localhost:3000`.

## API

### `POST /api/analyze`

Request example:

```json
{
  "niche": "fitness",
  "audience": "busy professionals",
  "goal": "followers",
  "postingDaysPerWeek": 4,
  "dailyTimeBudgetHours": 2,
  "platforms": ["tiktok", "instagram"],
  "references": [
    {
      "topic": "office workouts",
      "hookType": "before-after",
      "format": "montage",
      "durationSec": 24,
      "views": 225000,
      "likes": 17400,
      "comments": 920,
      "shares": 3500,
      "watchTimePct": 74,
      "hashtags": "#deskworkout,#busyfitness"
    }
  ]
}
```

### `GET /api/health`

Returns service status.

## Notes

- This first version uses heuristic scoring, not live social APIs.
- Next step is adding connectors for TikTok/Instagram/YouTube trend feeds and per-account performance history.
