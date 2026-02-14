const form = document.getElementById('analyzer-form');
const referenceBody = document.getElementById('reference-body');
const rowTemplate = document.getElementById('row-template');
const addRowBtn = document.getElementById('add-row');
const sampleBtn = document.getElementById('sample-data');
const resultsPanel = document.getElementById('results-panel');
const summaryCards = document.getElementById('summary-cards');
const signals = document.getElementById('signals');
const planBody = document.getElementById('plan-body');

function addRow(data = {}) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  for (const input of row.querySelectorAll('input')) {
    input.value = data[input.name] ?? '';
  }
  referenceBody.append(row);
}

function seedRows() {
  referenceBody.innerHTML = '';
  addRow({
    topic: 'low-impact cardio',
    hookType: 'myth bust',
    format: 'talking head',
    durationSec: 28,
    views: 182000,
    likes: 12300,
    comments: 640,
    shares: 2400,
    watchTimePct: 72,
    hashtags: '#fitness,#fatloss,#dailyhabits'
  });
  addRow({
    topic: 'meal prep',
    hookType: '3-step tutorial',
    format: 'overhead demo',
    durationSec: 36,
    views: 141000,
    likes: 9600,
    comments: 520,
    shares: 1800,
    watchTimePct: 66,
    hashtags: '#mealprep,#highprotein,#easyrecipes'
  });
  addRow({
    topic: 'office workouts',
    hookType: 'before-after',
    format: 'montage',
    durationSec: 24,
    views: 225000,
    likes: 17400,
    comments: 920,
    shares: 3500,
    watchTimePct: 74,
    hashtags: '#deskworkout,#busyfitness,#wellness'
  });
}

function collectReferences() {
  return [...referenceBody.querySelectorAll('tr')].map((row) => {
    const data = {};
    for (const input of row.querySelectorAll('input')) {
      const value = input.value.trim();
      if (input.type === 'number') {
        data[input.name] = value === '' ? 0 : Number(value);
      } else {
        data[input.name] = value;
      }
    }
    return data;
  });
}

function collectPayload() {
  const fd = new FormData(form);
  const payload = {
    niche: fd.get('niche')?.toString() || '',
    audience: fd.get('audience')?.toString() || '',
    goal: fd.get('goal')?.toString() || 'reach',
    postingDaysPerWeek: Number(fd.get('postingDaysPerWeek') || 4),
    dailyTimeBudgetHours: Number(fd.get('dailyTimeBudgetHours') || 2),
    platforms: fd.getAll('platforms').map(String),
    references: collectReferences().filter((r) => Object.values(r).some(Boolean))
  };

  return payload;
}

function toList(items) {
  if (!items.length) return '<li>Not enough data yet</li>';
  return items.map((item) => `<li><strong>${item.label}</strong> (${item.score})</li>`).join('');
}

function renderSummary(result) {
  summaryCards.innerHTML = `
    <article class="card">
      <span>Benchmark Score</span>
      <strong>${result.benchmarkScore}</strong>
    </article>
    <article class="card">
      <span>References Analyzed</span>
      <strong>${result.referencesAnalyzed}</strong>
    </article>
    <article class="card">
      <span>Duration Target</span>
      <strong>${result.strategy.durationTarget}</strong>
    </article>
  `;

  signals.innerHTML = `
    <article class="signal-list">
      <h4>Top Topics</h4>
      <ul>${toList(result.topTopics)}</ul>
    </article>
    <article class="signal-list">
      <h4>Best Hooks</h4>
      <ul>${toList(result.topHooks)}</ul>
    </article>
    <article class="signal-list">
      <h4>Strong Hashtags</h4>
      <ul>${toList(result.topHashtags.slice(0, 5))}</ul>
    </article>
  `;

  planBody.innerHTML = result.weeklyPlan
    .map(
      (item) => `
      <tr>
        <td>${item.date}</td>
        <td>${item.day} ${item.time}</td>
        <td>${item.pillar}</td>
        <td>${item.concept}</td>
        <td>${item.hook}</td>
        <td>${item.format}</td>
        <td>${item.cta}</td>
      </tr>
    `
    )
    .join('');

  resultsPanel.classList.remove('hidden');
}

async function submitAnalysis(event) {
  event.preventDefault();
  const payload = collectPayload();

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    renderSummary(data);
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    alert(error.message);
  }
}

addRow();
addRow();

addRowBtn.addEventListener('click', () => addRow());
sampleBtn.addEventListener('click', seedRows);
form.addEventListener('submit', submitAnalysis);
