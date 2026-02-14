import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const bestTimes = {
  tiktok: ['11:30', '18:30', '21:00'],
  instagram: ['12:00', '17:30', '20:30'],
  youtube: ['13:00', '19:00', '21:30'],
  x: ['08:30', '12:30', '18:00']
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function normalizePlatform(name) {
  const v = String(name || '').toLowerCase();
  if (v.includes('tik')) return 'tiktok';
  if (v.includes('insta')) return 'instagram';
  if (v.includes('you')) return 'youtube';
  if (v === 'x' || v.includes('twitter')) return 'x';
  return 'tiktok';
}

function scoreReference(reference) {
  const views = Number(reference.views || 0);
  const likes = Number(reference.likes || 0);
  const comments = Number(reference.comments || 0);
  const shares = Number(reference.shares || 0);
  const watchTimePct = Math.max(0, Math.min(100, Number(reference.watchTimePct || 0)));
  const durationSec = Math.max(1, Number(reference.durationSec || 1));

  const engagementRate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;
  const velocityWeight = Math.log10(Math.max(views, 10));
  const retentionWeight = watchTimePct / 100;
  const durationFit = durationSec <= 35 ? 1.1 : durationSec <= 60 ? 1.0 : 0.85;

  return Number(((engagementRate * 1.8 + watchTimePct * 0.9) * velocityWeight * retentionWeight * durationFit).toFixed(2));
}

function incrementMap(map, key, amount) {
  const current = map.get(key) || 0;
  map.set(key, current + amount);
}

function topFromMap(map, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, score]) => ({ label, score: Number(score.toFixed(2)) }));
}

function deriveDurationTarget(references) {
  if (!references.length) return '20-35 seconds';
  const avgWatch = references.reduce((sum, ref) => sum + Number(ref.watchTimePct || 0), 0) / references.length;
  const avgDuration = references.reduce((sum, ref) => sum + Number(ref.durationSec || 0), 0) / references.length;

  if (avgWatch >= 70 && avgDuration <= 35) return '18-30 seconds';
  if (avgWatch >= 60) return '25-45 seconds';
  if (avgWatch >= 50) return '35-60 seconds';
  return '45-75 seconds with stronger pattern interrupts';
}

function buildPostingSlots(platforms, daysPerWeek) {
  const normalized = (platforms || []).map(normalizePlatform);
  const primary = normalized[0] || 'tiktok';
  const slots = bestTimes[primary] || bestTimes.tiktok;
  const today = new Date();
  const plan = [];

  for (let i = 0; plan.length < daysPerWeek && i < 14; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i + 1);
    const dayIndex = date.getDay();

    if (dayIndex !== 0) {
      const slot = slots[plan.length % slots.length];
      plan.push({
        date: date.toISOString().slice(0, 10),
        day: dayNames[dayIndex],
        time: slot
      });
    }
  }

  return plan;
}

function buildContentPlan(input, analysis) {
  const pillars = analysis.topTopics.length
    ? analysis.topTopics.slice(0, 3).map((x) => x.label)
    : [input.niche || 'Industry insight', 'Beginner mistakes', 'Template breakdown'];

  const hooks = analysis.topHooks.length
    ? analysis.topHooks.map((x) => x.label)
    : ['Contrarian take', '3-step blueprint', 'Before/after transformation'];

  const formats = analysis.topFormats.length
    ? analysis.topFormats.map((x) => x.label)
    : ['Talking head with captions', 'Screen recording + voiceover', 'Quick montage'];

  const slots = buildPostingSlots(input.platforms, input.postingDaysPerWeek);

  return slots.map((slot, idx) => {
    const pillar = pillars[idx % pillars.length];
    const hook = hooks[idx % hooks.length];
    const format = formats[idx % formats.length];

    return {
      ...slot,
      pillar,
      concept: `${pillar}: actionable angle #${idx + 1}`,
      hook,
      format,
      cta: idx % 2 === 0 ? 'Comment "PLAN" for the checklist' : 'Follow for daily trend breakdowns'
    };
  });
}

function analyze(input) {
  const references = Array.isArray(input.references) ? input.references : [];
  const topicMap = new Map();
  const hookMap = new Map();
  const formatMap = new Map();
  const hashtagMap = new Map();

  const scored = references.map((ref) => {
    const score = scoreReference(ref);
    const topic = String(ref.topic || 'general').trim().toLowerCase();
    const hook = String(ref.hookType || 'unknown').trim().toLowerCase();
    const format = String(ref.format || 'short-form').trim().toLowerCase();
    const hashtags = Array.isArray(ref.hashtags)
      ? ref.hashtags
      : String(ref.hashtags || '')
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean);

    incrementMap(topicMap, topic, score);
    incrementMap(hookMap, hook, score);
    incrementMap(formatMap, format, score);
    hashtags.forEach((tag) => incrementMap(hashtagMap, tag.toLowerCase(), score / 2));

    return { ...ref, score };
  });

  const benchmarkScore = scored.length
    ? Number((scored.reduce((sum, item) => sum + item.score, 0) / scored.length).toFixed(2))
    : 0;

  const topTopics = topFromMap(topicMap, 5);
  const topHooks = topFromMap(hookMap, 4);
  const topFormats = topFromMap(formatMap, 4);
  const topHashtags = topFromMap(hashtagMap, 8);

  const focus = topTopics[0]?.label || String(input.niche || 'general').toLowerCase();
  const durationTarget = deriveDurationTarget(references);

  const strategy = {
    focus,
    durationTarget,
    postingCadence: `${input.postingDaysPerWeek} posts/week`,
    creativeDirection:
      benchmarkScore >= 120
        ? 'Double down on high-retention, pattern-interrupt hooks with clear payoffs in the first 2 seconds.'
        : 'Increase hook clarity and pacing; tighten edits every 2-3 seconds to improve retention.',
    trendRisk:
      benchmarkScore >= 100
        ? 'Medium: trend fit is good, but creative fatigue risk increases after 2 weeks.'
        : 'High: test multiple hooks and formats rapidly before scaling spend or production time.'
  };

  return {
    benchmarkScore,
    referencesAnalyzed: scored.length,
    topTopics,
    topHooks,
    topFormats,
    topHashtags,
    strategy,
    weeklyPlan: buildContentPlan(input, { topTopics, topHooks, topFormats })
  };
}

function validateInput(input) {
  if (!input || typeof input !== 'object') return 'Request body must be a JSON object.';
  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    return 'Select at least one platform.';
  }
  if (!Number.isFinite(Number(input.postingDaysPerWeek)) || Number(input.postingDaysPerWeek) < 1) {
    return 'postingDaysPerWeek must be a positive number.';
  }
  return null;
}

function serveStatic(req, res) {
  const safePath = path.normalize(req.url === '/' ? '/index.html' : req.url).replace(/^\.+/, '');
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      sendJson(res, 500, { error: 'Server error' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'viral-trend-planner' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/analyze') {
    try {
      const input = await parseBody(req);
      input.postingDaysPerWeek = Number(input.postingDaysPerWeek || 4);
      const validationError = validateInput(input);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      const result = analyze(input);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to analyze request' });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(port, () => {
  console.log(`Viral Trend Planner running at http://localhost:${port}`);
});
