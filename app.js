const TRADING_DAYS_PER_WEEK = 5;
const MIN_LOT = 0.01;
const LOT_STEP = 0.01;

const STORAGE_KEYS = {
  projection: 'forex-plan-projection',
  logs: 'forex-plan-logs',
};

// --- Projection ---

function roundLotDown(lot) {
  if (lot < MIN_LOT) return MIN_LOT;
  return Math.floor(lot / LOT_STEP) * LOT_STEP;
}

function runProjection(params) {
  const {
    capital: initialCapital,
    riskPct,
    tpPoints,
    slPoints,
    maxTradesPerDay,
    targetPerDay,
  } = params;

  const targetWeekly = targetPerDay * TRADING_DAYS_PER_WEEK;
  const weeks = [];
  let capital = initialCapital;
  let weekIndex = 0;

  while (true) {
    const riskDollar = capital * (riskPct / 100);
    const rawLot = riskDollar / slPoints;
    const maxLot = roundLotDown(rawLot);

    const profitPerWin = maxLot * tpPoints;
    const tradesPerWeek = maxTradesPerDay * TRADING_DAYS_PER_WEEK;
    const weeklyProfit = tradesPerWeek * profitPerWin;

    weeks.push({
      week: weekIndex + 1,
      capitalStart: capital,
      riskDollar,
      maxLot,
      profitPerWin,
      weeklyProfit,
      capitalEnd: capital + weeklyProfit,
    });

    capital += weeklyProfit;
    weekIndex += 1;

    const earningPerDay = weeklyProfit / TRADING_DAYS_PER_WEEK;
    if (earningPerDay >= targetPerDay || weekIndex > 200) break;
  }

  return {
    weeks,
    totalWeeks: weeks.length,
    finalCapital: capital,
    targetPerDay,
  };
}

function renderProjectionResult(data) {
  const summaryEl = document.getElementById('projection-summary');
  const weeksEl = document.getElementById('projection-weeks');
  const last = data.weeks[data.weeks.length - 1];

  summaryEl.textContent = `Max lot per order: ${last.maxLot.toFixed(2)}. Weeks to reach $${data.targetPerDay}/day: ${data.totalWeeks}. Final capital (projected): $${data.finalCapital.toFixed(2)}.`;

  weeksEl.innerHTML = data.weeks
    .map(
      (w) =>
        `<div class="week-row">Week ${w.week}: capital $${w.capitalStart.toFixed(2)} → max lot ${w.maxLot.toFixed(2)}, $${w.profitPerWin.toFixed(2)}/win → week profit $${w.weeklyProfit.toFixed(2)} → capital $${w.capitalEnd.toFixed(2)}</div>`
    )
    .join('');

  document.getElementById('projection-result').hidden = false;
}

function saveProjection(params, result) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.projection,
      JSON.stringify({ params, result, at: new Date().toISOString() })
    );
  } catch (e) {
    console.warn('Could not save projection', e);
  }
}

// --- Logs ---

function getLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
}

function addLog(entry) {
  const logs = getLogs();
  const id = String(Date.now());
  logs.push({ id, ...entry });
  saveLogs(logs);
  renderLogs();
  updateLogSummary();
  updateComparison();
}

function deleteLog(id) {
  const logs = getLogs().filter((l) => l.id !== id);
  saveLogs(logs);
  renderLogs();
  updateLogSummary();
  updateComparison();
}

function totalFromLogs(logs) {
  return logs.reduce((sum, l) => sum + (l.outcome === 'win' ? l.amount : -l.amount), 0);
}

function renderLogs() {
  const logs = getLogs();
  const tbody = document.getElementById('log-tbody');
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No logs yet.</td></tr>';
    return;
  }
  tbody.innerHTML = logs
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (l) =>
        `<tr>
          <td>${l.date}</td>
          <td class="${l.outcome}">${l.outcome}</td>
          <td>${l.amount.toFixed(2)}</td>
          <td>${l.points}</td>
          <td><button type="button" class="btn-delete" data-id="${l.id}">Delete</button></td>
        </tr>`
    )
    .join('');

  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteLog(btn.dataset.id));
  });
}

function updateLogSummary() {
  const logs = getLogs();
  const el = document.getElementById('log-summary');
  if (logs.length === 0) {
    el.hidden = true;
    return;
  }
  const total = totalFromLogs(logs);
  el.textContent = `Total P&L from logs: $${total >= 0 ? '' : '-'}$${Math.abs(total).toFixed(2)}`;
  el.className = 'summary ' + (total >= 0 ? 'on-track' : 'behind');
  el.hidden = false;
}

function updateComparison() {
  const logs = getLogs();
  const raw = localStorage.getItem(STORAGE_KEYS.projection);
  const el = document.getElementById('log-vs-projection');
  if (!raw || logs.length === 0) {
    el.hidden = true;
    return;
  }
  try {
    const { params, result } = JSON.parse(raw);
    const initialCapital = params.capital;
    const logProfit = totalFromLogs(logs);
    const actualCapital = initialCapital + logProfit;

    const firstLogDate = new Date(Math.min(...logs.map((l) => new Date(l.date))));
    const latestLogDate = new Date(Math.max(...logs.map((l) => new Date(l.date))));
    const daysSinceStart = (latestLogDate - firstLogDate) / (1000 * 60 * 60 * 24);
    const weeksSinceStart = Math.max(0, Math.floor(daysSinceStart / 7));
    const projectedForPeriod =
      weeksSinceStart < result.weeks.length
        ? result.weeks[weeksSinceStart].capitalEnd
        : result.finalCapital;

    const diff = actualCapital - projectedForPeriod;
    const status =
      diff >= 0
        ? `On track: actual $${actualCapital.toFixed(2)} vs projected ~$${projectedForPeriod.toFixed(2)} (+$${diff.toFixed(2)})`
        : `Behind: actual $${actualCapital.toFixed(2)} vs projected ~$${projectedForPeriod.toFixed(2)} (${diff.toFixed(2)})`;
    el.textContent = status;
  } catch (e) {
    el.textContent = 'Could not compare to projection.';
  }
  el.hidden = false;
}

// --- Init ---

document.getElementById('projection-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const params = {
    capital: Number(form.capital.value),
    riskPct: Number(form.riskPct.value),
    tpPoints: Number(form.tpPoints.value),
    slPoints: Number(form.slPoints.value),
    maxTradesPerDay: Number(form.maxTradesPerDay.value),
    targetPerDay: Number(form.targetPerDay.value),
  };
  const result = runProjection(params);
  renderProjectionResult(result);
  saveProjection(params, result);
  updateComparison();
});

document.getElementById('log-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  addLog({
    outcome: form.outcome.value,
    amount: Number(form.amount.value),
    points: Number(form.points.value),
    date: form.date.value,
  });
  form.amount.value = '';
  form.points.value = '';
  form.date.value = new Date().toISOString().slice(0, 10);
});

// Default today for date
document.querySelector('input[name="date"]').value = new Date().toISOString().slice(0, 10);

renderLogs();
updateLogSummary();
updateComparison();
